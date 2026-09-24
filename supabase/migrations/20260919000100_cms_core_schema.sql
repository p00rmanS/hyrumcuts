-- HyrumHaircuts CMS: core schema.
--
-- Single-owner design. `public.site_owner` holds exactly one row: the Auth
-- user allowed to manage the site. Every content table references it through
-- `owner_id`, so a row can only ever be created by that one registered user
-- (the foreign key is checked by the database, not by the browser).
--
-- No prices, payments or booking/client personal data live in this schema.
-- Booking stays on Calendly plus Netlify Forms.

-- ---------------------------------------------------------------------------
-- Private schema: helper functions that must never be reachable through the
-- Data API. It is not in `[api] schemas`, and no API role may use it.
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- site_owner: the one account allowed to manage content.
-- ---------------------------------------------------------------------------
create table public.site_owner (
  owner_id   uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- At most one owner, ever. `(true)` makes every row collide on the same key.
create unique index site_owner_single_row on public.site_owner ((true));

comment on table public.site_owner is
  'Exactly one row: the Auth user who owns the site. Written only by the developer (private.bootstrap_owner), never by API roles.';

-- ---------------------------------------------------------------------------
-- site_settings: public-safe, owner-editable website content (one row).
-- Every column is intentionally readable by visitors. Never add secrets here.
-- ---------------------------------------------------------------------------
create table public.site_settings (
  owner_id uuid primary key default auth.uid()
    references public.site_owner (owner_id) on delete cascade on update cascade,

  -- Brand and hero copy
  brand_name          text not null default 'HyrumHaircuts',
  barber_name         text not null default 'Hyrum',
  hero_eyebrow        text not null default 'Precision cuts. Personal style.',
  hero_heading        text not null default 'A sharper look, cut for you.',
  hero_subheading     text not null default 'Modern cuts, clean fades, and detail-first grooming by Hyrum.',
  cta_book_label      text not null default 'Book Your Next Cut',
  cta_view_work_label text not null default 'View My Work',
  cta_gallery_label   text not null default 'Let''s Get You Fresh',
  cta_banner_label    text not null default 'Reserve Your Chair',
  gallery_all_label   text not null default 'All Cuts',

  -- About
  about_heading        text not null default 'The barber behind the chair.',
  about_bio            text not null default '',
  about_specialties    text not null default '',
  location_general     text not null default '',
  availability_note    text not null default '',
  preferred_contact    text not null default '',
  profile_photo_alt    text not null default '',

  -- Contact and social
  phone              text not null default '',
  email              text not null default '',
  instagram_url      text not null default '',
  facebook_url       text not null default '',
  map_url            text not null default '',
  privacy_contact_email text not null default '',

  -- Booking (the provider stays external; only the link and labels are editable)
  booking_provider     text not null default 'calendly',
  booking_url          text not null default '',
  booking_time_windows text[] not null default array[
    'Morning (9am–12pm)',
    'Early afternoon (12pm–3pm)',
    'Late afternoon (3pm–6pm)',
    'Evening (6pm–8pm)'
  ],

  -- SEO and sharing
  seo_title       text not null default 'HyrumHaircuts — Precision Cuts, Personal Style',
  seo_description text not null default '',
  canonical_url   text not null default '',
  timezone        text not null default 'America/Denver',
  credit_text     text not null default '',

  -- Media (Storage object paths inside the `site-media` bucket)
  hero_video_path    text,
  hero_poster_path   text,
  profile_photo_path text,
  seo_image_path     text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint site_settings_text_lengths check (
    char_length(brand_name) between 1 and 80
    and char_length(barber_name) between 1 and 80
    and char_length(hero_eyebrow) <= 120
    and char_length(hero_heading) <= 160
    and char_length(hero_subheading) <= 300
    and char_length(cta_book_label) between 1 and 40
    and char_length(cta_view_work_label) between 1 and 40
    and char_length(cta_gallery_label) between 1 and 40
    and char_length(cta_banner_label) between 1 and 40
    and char_length(gallery_all_label) between 1 and 40
    and char_length(about_heading) <= 160
    and char_length(about_bio) <= 3000
    and char_length(about_specialties) <= 300
    and char_length(location_general) <= 200
    and char_length(availability_note) <= 200
    and char_length(preferred_contact) <= 120
    and char_length(profile_photo_alt) <= 250
    and char_length(seo_title) <= 70
    and char_length(seo_description) <= 320
    and char_length(credit_text) <= 120
    and char_length(timezone) between 1 and 64
  ),
  constraint site_settings_contact_format check (
    phone ~ '^[0-9+()./ -]{0,40}$'
    and (email = '' or (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' and char_length(email) <= 254))
    and (privacy_contact_email = '' or (privacy_contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' and char_length(privacy_contact_email) <= 254))
  ),
  -- https only, no whitespace, and the social links must point at the right site.
  constraint site_settings_urls check (
    (instagram_url = '' or instagram_url ~* '^https://([a-z0-9-]+\.)?instagram\.com/[^[:space:]]+$')
    and (facebook_url = '' or facebook_url ~* '^https://([a-z0-9-]+\.)?(facebook\.com|fb\.com|fb\.me)/[^[:space:]]+$')
    and (map_url = '' or map_url ~* '^https://[^[:space:]]+$')
    and (booking_url = '' or booking_url ~* '^https://[^[:space:]]+$')
    and (canonical_url = '' or canonical_url ~* '^https://[^[:space:]]+$')
    and char_length(instagram_url) <= 300 and char_length(facebook_url) <= 300
    and char_length(map_url) <= 500 and char_length(booking_url) <= 500
    and char_length(canonical_url) <= 300
  ),
  constraint site_settings_booking_provider check (
    booking_provider in ('calendly', 'google_calendar', 'other', 'none')
  ),
  constraint site_settings_time_windows check (
    cardinality(booking_time_windows) <= 8
  ),
  -- Media paths must live in this owner's own folder and must not traverse.
  constraint site_settings_media_paths check (
    (hero_video_path    is null or (hero_video_path    like owner_id::text || '/hero/%'    and hero_video_path    !~ '\.\.'))
    and (hero_poster_path   is null or (hero_poster_path   like owner_id::text || '/hero/%'    and hero_poster_path   !~ '\.\.'))
    and (profile_photo_path is null or (profile_photo_path like owner_id::text || '/profile/%' and profile_photo_path !~ '\.\.'))
    and (seo_image_path     is null or (seo_image_path     like owner_id::text || '/seo/%'     and seo_image_path     !~ '\.\.'))
  )
);

comment on table public.site_settings is
  'Public-safe website settings (one row). Everything here is readable by visitors; never store secrets.';

-- ---------------------------------------------------------------------------
-- gallery_categories: data-driven filters.
-- ---------------------------------------------------------------------------
create table public.gallery_categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid()
    references public.site_owner (owner_id) on delete cascade on update cascade,
  name        text not null,
  slug        text not null,
  description text not null default '',
  sort_order  integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint gallery_categories_slug_unique unique (owner_id, slug),
  constraint gallery_categories_name_length check (char_length(btrim(name)) between 1 and 60),
  constraint gallery_categories_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  constraint gallery_categories_description_length check (char_length(description) <= 300)
);

create index gallery_categories_order_idx on public.gallery_categories (owner_id, sort_order);

-- ---------------------------------------------------------------------------
-- gallery_items: one portfolio entry (a photo, a before/after pair or a clip).
-- ---------------------------------------------------------------------------
create table public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid()
    references public.site_owner (owner_id) on delete cascade on update cascade,
  -- RESTRICT: a category cannot be deleted while work still points at it.
  category_id uuid references public.gallery_categories (id) on delete restrict,
  title        text not null,
  description  text not null default '',
  alt_text     text not null default '',
  service_label text not null default '',
  is_featured  boolean not null default false,
  is_published boolean not null default false,
  -- Before/after grouping: an item with `before` and `after` media renders as a pair.
  is_transformation boolean not null default false,
  sort_order   integer not null default 0,
  archived_at  timestamptz,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint gallery_items_title_length check (char_length(btrim(title)) between 1 and 120),
  constraint gallery_items_description_length check (char_length(description) <= 1000),
  constraint gallery_items_alt_length check (char_length(alt_text) <= 300),
  constraint gallery_items_service_length check (char_length(service_label) <= 80),
  -- Accessibility is enforced by the database: nothing goes public without alt text.
  constraint gallery_items_published_needs_alt check (
    not is_published or char_length(btrim(alt_text)) > 0
  ),
  -- An archived item can never be published at the same time.
  constraint gallery_items_archived_not_published check (
    archived_at is null or not is_published
  )
);

create index gallery_items_public_idx
  on public.gallery_items (owner_id, sort_order)
  where is_published and archived_at is null;
create index gallery_items_category_idx on public.gallery_items (category_id);
create index gallery_items_owner_order_idx on public.gallery_items (owner_id, archived_at, sort_order);

-- ---------------------------------------------------------------------------
-- gallery_media: files belonging to an item. Only Storage paths, never blobs.
-- ---------------------------------------------------------------------------
create table public.gallery_media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid()
    references public.site_owner (owner_id) on delete cascade on update cascade,
  item_id  uuid not null references public.gallery_items (id) on delete cascade,
  media_type text not null,
  role       text not null default 'gallery',
  storage_path text not null,          -- full-size image, or the video file
  card_path    text,                   -- pre-generated thumbnail variant (images)
  poster_path  text,                   -- poster frame (videos)
  width  integer,
  height integer,
  duration_seconds numeric(8, 2),
  mime_type  text not null,
  byte_size  bigint,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint gallery_media_type check (media_type in ('image', 'video')),
  constraint gallery_media_role check (role in ('cover', 'gallery', 'before', 'after', 'poster')),
  constraint gallery_media_mime check (
    (media_type = 'image' and mime_type in ('image/jpeg', 'image/png', 'image/webp'))
    or (media_type = 'video' and mime_type in ('video/mp4', 'video/webm'))
  ),
  constraint gallery_media_dimensions check (
    (width is null or width between 1 and 12000) and (height is null or height between 1 and 12000)
  ),
  constraint gallery_media_size check (byte_size is null or byte_size between 1 and 52428800),
  constraint gallery_media_duration check (duration_seconds is null or duration_seconds between 0 and 600),
  -- Files must sit in <owner>/gallery/<item>/ so a row can only reference its own folder.
  constraint gallery_media_paths check (
    storage_path like owner_id::text || '/gallery/' || item_id::text || '/%'
    and storage_path !~ '\.\.'
    and (card_path   is null or (card_path   like owner_id::text || '/gallery/' || item_id::text || '/%' and card_path   !~ '\.\.'))
    and (poster_path is null or (poster_path like owner_id::text || '/gallery/' || item_id::text || '/%' and poster_path !~ '\.\.'))
  )
);

create index gallery_media_item_idx on public.gallery_media (item_id, sort_order);
-- One cover, one "before" and one "after" per item.
create unique index gallery_media_one_cover on public.gallery_media (item_id) where role = 'cover';
create unique index gallery_media_one_before on public.gallery_media (item_id) where role = 'before';
create unique index gallery_media_one_after on public.gallery_media (item_id) where role = 'after';

-- ---------------------------------------------------------------------------
-- reviews: owner-entered, approved before they appear.
-- ---------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid()
    references public.site_owner (owner_id) on delete cascade on update cascade,
  reviewer_name text not null,
  quote         text not null,
  haircut_type  text not null default '',
  is_published  boolean not null default false,
  sort_order    integer not null default 0,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint reviews_name_length check (char_length(btrim(reviewer_name)) between 1 and 60),
  constraint reviews_quote_length check (char_length(btrim(quote)) between 1 and 600),
  constraint reviews_haircut_length check (char_length(haircut_type) <= 80),
  constraint reviews_archived_not_published check (archived_at is null or not is_published)
);

create index reviews_public_idx on public.reviews (owner_id, sort_order)
  where is_published and archived_at is null;

-- ---------------------------------------------------------------------------
-- faqs
-- ---------------------------------------------------------------------------
create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid()
    references public.site_owner (owner_id) on delete cascade on update cascade,
  question     text not null,
  answer       text not null,
  is_published boolean not null default false,
  sort_order   integer not null default 0,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint faqs_question_length check (char_length(btrim(question)) between 1 and 200),
  constraint faqs_answer_length check (char_length(btrim(answer)) between 1 and 2000),
  constraint faqs_archived_not_published check (archived_at is null or not is_published)
);

create index faqs_public_idx on public.faqs (owner_id, sort_order)
  where is_published and archived_at is null;

-- ---------------------------------------------------------------------------
-- services: cut types offered in the appointment-request form. No prices.
-- ---------------------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid()
    references public.site_owner (owner_id) on delete cascade on update cascade,
  name         text not null,
  description  text not null default '',
  is_published boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint services_name_length check (char_length(btrim(name)) between 1 and 80),
  constraint services_description_length check (char_length(description) <= 300)
);

create index services_public_idx on public.services (owner_id, sort_order) where is_published;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger set_updated_at before update on public.site_settings
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.gallery_categories
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.gallery_items
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.gallery_media
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.reviews
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.faqs
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.services
  for each row execute function private.set_updated_at();

-- published_at is set the first time an item goes public.
create or replace function private.stamp_published_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_published and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

create trigger stamp_published_at before insert or update on public.gallery_items
  for each row execute function private.stamp_published_at();
