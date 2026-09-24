-- HyrumHaircuts CMS: append-only audit log.
--
-- Entries are written ONLY by database triggers on the content tables, so the
-- browser cannot forge, edit or delete them: no API role has INSERT, UPDATE
-- or DELETE on this table. The owner may read their own history.
--
-- What is stored: who, what kind of action, which table/row and which column
-- NAMES changed. Never values, passwords, tokens or review text, so the log
-- holds no personal data.

create table public.admin_audit_log (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users (id) on delete set null,
  action      text not null,
  entity_type text not null,
  entity_id   text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),

  constraint admin_audit_log_action check (
    action in ('create', 'update', 'delete', 'publish', 'unpublish', 'archive', 'restore')
  ),
  constraint admin_audit_log_metadata_shape check (
    jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) < 4096
  )
);

create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;

revoke all on public.admin_audit_log from anon, authenticated;
grant select on public.admin_audit_log to authenticated;

create policy "admin_audit_log: owner reads own history"
  on public.admin_audit_log for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- The trigger function. SECURITY DEFINER is required so it can insert into a
-- table the API roles cannot write to. It is safe because:
--   * it lives in the `private` schema, which no API role can reach, so it
--     cannot be called over the Data API;
--   * search_path is pinned to '' and every object is schema-qualified;
--   * it takes no arguments and only records what the triggering statement
--     already changed;
--   * the acting user comes from auth.uid(), never from client input.
-- ---------------------------------------------------------------------------
create or replace function private.log_admin_action()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action  text;
  v_old     jsonb;
  v_new     jsonb;
  v_id      text;
  v_changed text[];
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_action := 'create';
    v_id := coalesce(v_new ->> 'id', v_new ->> 'owner_id');
  elsif tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    v_action := 'delete';
    v_id := coalesce(v_old ->> 'id', v_old ->> 'owner_id');
  else
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_id := coalesce(v_new ->> 'id', v_new ->> 'owner_id');

    select array_agg(k order by k)
      into v_changed
      from jsonb_object_keys(v_new) as k
     where (v_new -> k) is distinct from (v_old -> k)
       and k not in ('updated_at', 'sort_order');

    -- Nothing meaningful changed (a pure drag-and-drop reorder, or a no-op
    -- save): keep the log readable.
    if v_changed is null then
      return new;
    end if;

    v_action := 'update';
    -- Archive/restore first: archiving also unpublishes, and that should be
    -- recorded as what the owner actually did.
    if (v_old ->> 'archived_at') is null and (v_new ->> 'archived_at') is not null then
      v_action := 'archive';
    elsif (v_old ->> 'archived_at') is not null and (v_new ->> 'archived_at') is null then
      v_action := 'restore';
    elsif (v_old ->> 'is_published') is distinct from (v_new ->> 'is_published') then
      v_action := case when (v_new ->> 'is_published')::boolean then 'publish' else 'unpublish' end;
    end if;
  end if;

  insert into public.admin_audit_log (user_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    v_action,
    tg_table_name,
    v_id,
    case when v_changed is null then '{}'::jsonb
         else jsonb_build_object('changed', to_jsonb(v_changed)) end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.log_admin_action() from public, anon, authenticated;

create trigger audit_log after insert or update or delete on public.site_settings
  for each row execute function private.log_admin_action();
create trigger audit_log after insert or update or delete on public.gallery_categories
  for each row execute function private.log_admin_action();
create trigger audit_log after insert or update or delete on public.gallery_items
  for each row execute function private.log_admin_action();
create trigger audit_log after insert or update or delete on public.gallery_media
  for each row execute function private.log_admin_action();
create trigger audit_log after insert or update or delete on public.reviews
  for each row execute function private.log_admin_action();
create trigger audit_log after insert or update or delete on public.faqs
  for each row execute function private.log_admin_action();
create trigger audit_log after insert or update or delete on public.services
  for each row execute function private.log_admin_action();
