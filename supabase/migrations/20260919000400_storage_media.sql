-- HyrumHaircuts CMS: Storage bucket, object policies and the cleanup queue.
--
-- One PUBLIC-READ bucket, `site-media`. Public means visitors can fetch an
-- object if they know its URL (that is how the website shows photos). It does
-- NOT let anyone list the bucket or write to it. Writes, replacements and
-- deletes are limited to the registered owner, inside the owner's own folder:
--
--   <owner uuid>/gallery/<item uuid>/<random>-card.webp
--   <owner uuid>/gallery/<item uuid>/<random>-full.webp
--   <owner uuid>/hero/<random>-hero.mp4        (and -poster.webp)
--   <owner uuid>/profile/<random>-portrait.webp
--   <owner uuid>/seo/<random>-share.webp
--
-- Object names are always unique. Replacing media means uploading a NEW path,
-- switching the database row, then removing the old object, which avoids stale
-- CDN caches.

-- ---------------------------------------------------------------------------
-- Bucket. Limits are enforced by the Storage server as well as by the browser.
-- 52428800 bytes = 50 MiB, the largest object the Free plan accepts. The CMS
-- applies stricter, friendlier limits before uploading (see web/src/lib/media-config.js).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-media',
  'site-media',
  true,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Object policies (storage.objects already has RLS enabled by Supabase).
--
-- There is deliberately NO policy for `anon`: public buckets serve objects
-- through their public URL without one, and leaving anon without a SELECT
-- policy is what stops anyone listing the bucket contents.
--
-- The owner needs:  INSERT              to upload
--                   SELECT + UPDATE     to upsert/replace and to move
--                   SELECT + DELETE     to remove
--
-- "Owner" means: the signed-in user's uid equals the first folder segment AND
-- that uid is the registered site owner. The second check matters: a second
-- Auth user must not be able to store files even in a folder named after
-- themselves.
-- ---------------------------------------------------------------------------
create policy "site-media: owner can read own folder"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'site-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.site_owner o where o.owner_id = (select auth.uid()))
  );

create policy "site-media: owner can upload to own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'site-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and name !~ '\.\.'
    and exists (select 1 from public.site_owner o where o.owner_id = (select auth.uid()))
  );

create policy "site-media: owner can update own folder"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'site-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.site_owner o where o.owner_id = (select auth.uid()))
  )
  with check (
    bucket_id = 'site-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and name !~ '\.\.'
    and exists (select 1 from public.site_owner o where o.owner_id = (select auth.uid()))
  );

create policy "site-media: owner can delete from own folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'site-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.site_owner o where o.owner_id = (select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- storage_cleanup_queue: objects that should be deleted but could not be yet
-- (offline, a failed request, a tab closed mid-replace). The admin app retries
-- the queue every time it opens, so replaced or abandoned files do not pile up
-- as orphans. Owner-only; contains paths, never file contents.
-- ---------------------------------------------------------------------------
create table public.storage_cleanup_queue (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid()
    references public.site_owner (owner_id) on delete cascade on update cascade,
  object_path text not null,
  reason      text not null default '',
  attempts    integer not null default 0,
  created_at  timestamptz not null default now(),

  constraint storage_cleanup_queue_path check (
    object_path like owner_id::text || '/%' and object_path !~ '\.\.' and char_length(object_path) <= 512
  ),
  constraint storage_cleanup_queue_reason check (char_length(reason) <= 120),
  constraint storage_cleanup_queue_unique_path unique (owner_id, object_path)
);

alter table public.storage_cleanup_queue enable row level security;

revoke all on public.storage_cleanup_queue from anon, authenticated;
grant select, insert, update, delete on public.storage_cleanup_queue to authenticated;

create policy "storage_cleanup_queue: owner read"
  on public.storage_cleanup_queue for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "storage_cleanup_queue: owner insert"
  on public.storage_cleanup_queue for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "storage_cleanup_queue: owner update"
  on public.storage_cleanup_queue for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "storage_cleanup_queue: owner delete"
  on public.storage_cleanup_queue for delete to authenticated
  using (owner_id = (select auth.uid()));
