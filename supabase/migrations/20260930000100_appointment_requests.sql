-- Appointment requests: the on-site booking form, stored for the owner.
--
-- Replaces Netlify Forms (the site now also deploys to GitHub Pages, which has
-- no form handling). This is the ONE table that holds visitors' personal data,
-- so it is locked down harder than the content tables:
--
--   * visitors (anon) may INSERT a request and do nothing else: no SELECT, so
--     nobody can read anyone's request back, not even their own;
--   * only the columns a visitor fills in are insertable; owner_id, status and
--     timestamps are set by the database;
--   * only the site owner can read, update the status of, or delete requests;
--   * a database-wide flood limit stops a script from filling the inbox;
--   * no audit-log trigger: the audit log must never copy personal data.

create table public.appointment_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null
    references public.site_owner (owner_id) on delete cascade on update cascade,

  full_name           text not null,
  phone               text not null,
  email               text not null,
  service             text not null default '',
  client_type         text not null,
  preferred_date      date not null,
  preferred_time_slot text not null default '',
  notes               text not null default '',
  consent             boolean not null,

  status     text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint appointment_requests_lengths check (
    char_length(btrim(full_name)) between 1 and 120
    and char_length(phone) between 1 and 30
    and char_length(email) between 3 and 190
    and char_length(service) <= 80
    and char_length(preferred_time_slot) <= 60
    and char_length(notes) <= 1000
  ),
  constraint appointment_requests_contact_format check (
    phone ~ '^[0-9+()./ -]{7,30}$'
    and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  constraint appointment_requests_client_type check (client_type in ('first_time', 'returning')),
  constraint appointment_requests_status check (status in ('new', 'contacted', 'booked', 'closed')),
  constraint appointment_requests_consent check (consent),
  -- A request for a date long past (or absurdly far ahead) is a bot or a typo.
  constraint appointment_requests_date_range check (
    preferred_date between date '2024-01-01' and date '2100-12-31'
  )
);

create index appointment_requests_inbox_idx on public.appointment_requests (owner_id, status, created_at desc);

comment on table public.appointment_requests is
  'Booking-form requests. Visitors can only insert; only the owner can read, update status, or delete. Contains personal data: never expose, never audit-log.';

create trigger set_updated_at before update on public.appointment_requests
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Insert guard. SECURITY DEFINER because a visitor cannot read site_owner or
-- count existing requests. Safe because it lives in `private` (unreachable
-- over the Data API), pins search_path, takes no arguments, and only ever
-- sets server-controlled columns on the row being inserted.
-- ---------------------------------------------------------------------------
create or replace function private.prepare_appointment_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner  uuid;
  v_recent integer;
begin
  select owner_id into v_owner from public.site_owner limit 1;
  if v_owner is null then
    raise exception 'The site is not set up to take requests yet.' using errcode = 'P0001';
  end if;

  -- Flood limit across all visitors: plenty for a one-chair barbershop, but a
  -- script can't fill the inbox. Visitors see a friendly "try again" message.
  select count(*) into v_recent
    from public.appointment_requests
   where created_at > now() - interval '10 minutes';
  if v_recent >= 20 then
    raise exception 'Too many requests right now. Please try again in a few minutes.' using errcode = 'P0001';
  end if;

  new.owner_id   := v_owner;
  new.status     := 'new';
  new.created_at := now();
  new.updated_at := now();
  new.full_name  := btrim(new.full_name);
  new.email      := btrim(new.email);
  new.phone      := btrim(new.phone);
  return new;
end;
$$;

revoke all on function private.prepare_appointment_request() from public;

create trigger prepare_appointment_request before insert on public.appointment_requests
  for each row execute function private.prepare_appointment_request();

-- ---------------------------------------------------------------------------
-- Grants: column-level, so a visitor can't even try to set owner_id or status.
-- ---------------------------------------------------------------------------
alter table public.appointment_requests enable row level security;

revoke all on public.appointment_requests from anon, authenticated;

grant insert (full_name, phone, email, service, client_type, preferred_date, preferred_time_slot, notes, consent)
  on public.appointment_requests to anon, authenticated;
grant select, delete on public.appointment_requests to authenticated;
grant update (status) on public.appointment_requests to authenticated;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
create policy "appointment_requests: anyone can submit"
  on public.appointment_requests for insert to anon, authenticated
  with check (status = 'new' and consent);

create policy "appointment_requests: owner read"
  on public.appointment_requests for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "appointment_requests: owner update"
  on public.appointment_requests for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "appointment_requests: owner delete"
  on public.appointment_requests for delete to authenticated
  using (owner_id = (select auth.uid()));
