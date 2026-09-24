-- HyrumHaircuts CMS: Row Level Security and grants.
--
-- The model, enforced by PostgreSQL (not by the browser):
--   * anon / visitors  : read ONLY published, non-archived content and the
--                        public-safe settings row. No writes of any kind.
--   * the owner        : full access to rows where owner_id = their own uid.
--   * everyone else    : nothing. A second Auth user is not an owner: they
--                        cannot insert (the owner_id foreign key to
--                        public.site_owner rejects them) and cannot read or
--                        change the owner's rows.
--
-- Policies are always targeted (`to anon`, `to authenticated`), never rely on
-- auth.role(), and never use a blanket `to authenticated using (true)`.
-- auth.uid() is wrapped in (select ...) so Postgres evaluates it once per
-- statement instead of once per row.

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.site_owner        enable row level security;
alter table public.site_settings     enable row level security;
alter table public.gallery_categories enable row level security;
alter table public.gallery_items     enable row level security;
alter table public.gallery_media     enable row level security;
alter table public.reviews           enable row level security;
alter table public.faqs              enable row level security;
alter table public.services          enable row level security;

-- ---------------------------------------------------------------------------
-- Grants: start from nothing, then add the minimum. RLS still applies on top.
-- ---------------------------------------------------------------------------
revoke all on public.site_owner, public.site_settings, public.gallery_categories,
  public.gallery_items, public.gallery_media, public.reviews, public.faqs,
  public.services from anon, authenticated;

-- Visitors may read public content tables (RLS narrows this to published rows).
grant select on public.site_settings, public.gallery_categories, public.gallery_items,
  public.gallery_media, public.reviews, public.faqs, public.services to anon;

-- The signed-in user needs the same reads (their own session is `authenticated`).
grant select on public.site_settings, public.gallery_categories, public.gallery_items,
  public.gallery_media, public.reviews, public.faqs, public.services to authenticated;

grant insert, update, delete on public.gallery_categories, public.gallery_items,
  public.gallery_media, public.reviews, public.faqs, public.services to authenticated;

-- The settings row is created by the owner-bootstrap trigger; the owner may only edit it.
grant update on public.site_settings to authenticated;

-- The admin app asks "am I the owner?". Read-only, own row only.
grant select on public.site_owner to authenticated;

-- ---------------------------------------------------------------------------
-- site_owner
-- ---------------------------------------------------------------------------
create policy "site_owner: read own row"
  on public.site_owner for select to authenticated
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- site_settings (public-safe by design)
-- ---------------------------------------------------------------------------
create policy "site_settings: public read"
  on public.site_settings for select to anon, authenticated
  using (true);

create policy "site_settings: owner update"
  on public.site_settings for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- gallery_categories
-- ---------------------------------------------------------------------------
create policy "gallery_categories: public read published"
  on public.gallery_categories for select to anon, authenticated
  using (is_published);

create policy "gallery_categories: owner read"
  on public.gallery_categories for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "gallery_categories: owner insert"
  on public.gallery_categories for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "gallery_categories: owner update"
  on public.gallery_categories for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "gallery_categories: owner delete"
  on public.gallery_categories for delete to authenticated
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- gallery_items
-- ---------------------------------------------------------------------------
create policy "gallery_items: public read published"
  on public.gallery_items for select to anon, authenticated
  using (is_published and archived_at is null);

create policy "gallery_items: owner read"
  on public.gallery_items for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "gallery_items: owner insert"
  on public.gallery_items for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "gallery_items: owner update"
  on public.gallery_items for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "gallery_items: owner delete"
  on public.gallery_items for delete to authenticated
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- gallery_media: visible to the public only through a published parent item.
-- The subquery runs under the caller's own RLS, so a draft parent stays hidden.
-- ---------------------------------------------------------------------------
create policy "gallery_media: public read via published item"
  on public.gallery_media for select to anon, authenticated
  using (
    exists (
      select 1 from public.gallery_items i
      where i.id = gallery_media.item_id
        and i.is_published
        and i.archived_at is null
    )
  );

create policy "gallery_media: owner read"
  on public.gallery_media for select to authenticated
  using (owner_id = (select auth.uid()));

-- The item must also belong to the owner: a media row cannot be attached to
-- someone else's item even if the ids are known.
create policy "gallery_media: owner insert"
  on public.gallery_media for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.gallery_items i
      where i.id = gallery_media.item_id and i.owner_id = (select auth.uid())
    )
  );

create policy "gallery_media: owner update"
  on public.gallery_media for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "gallery_media: owner delete"
  on public.gallery_media for delete to authenticated
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------
create policy "reviews: public read approved"
  on public.reviews for select to anon, authenticated
  using (is_published and archived_at is null);

create policy "reviews: owner read"
  on public.reviews for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "reviews: owner insert"
  on public.reviews for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "reviews: owner update"
  on public.reviews for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "reviews: owner delete"
  on public.reviews for delete to authenticated
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- faqs
-- ---------------------------------------------------------------------------
create policy "faqs: public read published"
  on public.faqs for select to anon, authenticated
  using (is_published and archived_at is null);

create policy "faqs: owner read"
  on public.faqs for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "faqs: owner insert"
  on public.faqs for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "faqs: owner update"
  on public.faqs for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "faqs: owner delete"
  on public.faqs for delete to authenticated
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- services
-- ---------------------------------------------------------------------------
create policy "services: public read published"
  on public.services for select to anon, authenticated
  using (is_published);

create policy "services: owner read"
  on public.services for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "services: owner insert"
  on public.services for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "services: owner update"
  on public.services for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "services: owner delete"
  on public.services for delete to authenticated
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Atomic drag-and-drop ordering.
--
-- SECURITY INVOKER (the default, stated explicitly): it runs with the caller's
-- rights, so RLS decides which rows can change. It is NOT a privileged
-- function; it only saves the client from sending N separate updates and
-- makes a reorder all-or-nothing. The table name is matched against a fixed
-- list, never concatenated into SQL.
-- ---------------------------------------------------------------------------
create or replace function public.reorder_content(p_kind text, p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_ids is null or cardinality(p_ids) = 0 then
    return;
  end if;
  if cardinality(p_ids) > 500 then
    raise exception 'Too many items to reorder at once';
  end if;

  if p_kind = 'gallery_items' then
    update public.gallery_items t set sort_order = o.pos::integer
      from unnest(p_ids) with ordinality as o(id, pos) where t.id = o.id;
  elsif p_kind = 'gallery_categories' then
    update public.gallery_categories t set sort_order = o.pos::integer
      from unnest(p_ids) with ordinality as o(id, pos) where t.id = o.id;
  elsif p_kind = 'gallery_media' then
    update public.gallery_media t set sort_order = o.pos::integer
      from unnest(p_ids) with ordinality as o(id, pos) where t.id = o.id;
  elsif p_kind = 'reviews' then
    update public.reviews t set sort_order = o.pos::integer
      from unnest(p_ids) with ordinality as o(id, pos) where t.id = o.id;
  elsif p_kind = 'faqs' then
    update public.faqs t set sort_order = o.pos::integer
      from unnest(p_ids) with ordinality as o(id, pos) where t.id = o.id;
  elsif p_kind = 'services' then
    update public.services t set sort_order = o.pos::integer
      from unnest(p_ids) with ordinality as o(id, pos) where t.id = o.id;
  else
    raise exception 'Unknown content kind: %', p_kind;
  end if;
end;
$$;

revoke all on function public.reorder_content(text, uuid[]) from public, anon;
grant execute on function public.reorder_content(text, uuid[]) to authenticated;
