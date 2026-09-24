-- Site-wide announcement bar (for example "Away Oct 3–10, booking reopens the 11th").
--
-- Plain text plus an optional https link, shown at the top of every public
-- page. Optional start/end dates (inclusive, in the site's time zone) let the
-- owner schedule it and have it disappear on its own. Public-safe like every
-- other site_settings column; the existing table grants and RLS policies
-- already cover new columns.

alter table public.site_settings
  add column announcement_text       text not null default '',
  add column announcement_link_url   text not null default '',
  add column announcement_link_label text not null default '',
  add column announcement_starts_on  date,
  add column announcement_ends_on    date;

alter table public.site_settings
  add constraint site_settings_announcement check (
    char_length(announcement_text) <= 200
    and char_length(announcement_link_label) <= 40
    and char_length(announcement_link_url) <= 500
    and (announcement_link_url = '' or announcement_link_url ~* '^https://[^[:space:]]+$')
    and (announcement_starts_on is null or announcement_ends_on is null or announcement_ends_on >= announcement_starts_on)
  );
