-- Opening hours, typed by the owner one day at a time ("9am–6pm", "Closed",
-- "By appointment"). Free text on purpose: a one-chair barber's hours rarely
-- fit a rigid schema, and empty days are simply not shown. Public-safe like
-- every other site_settings column; existing grants and policies cover them.

alter table public.site_settings
  add column hours_mon  text not null default '',
  add column hours_tue  text not null default '',
  add column hours_wed  text not null default '',
  add column hours_thu  text not null default '',
  add column hours_fri  text not null default '',
  add column hours_sat  text not null default '',
  add column hours_sun  text not null default '',
  add column hours_note text not null default '';

alter table public.site_settings
  add constraint site_settings_hours check (
    char_length(hours_mon) <= 40 and char_length(hours_tue) <= 40
    and char_length(hours_wed) <= 40 and char_length(hours_thu) <= 40
    and char_length(hours_fri) <= 40 and char_length(hours_sat) <= 40
    and char_length(hours_sun) <= 40 and char_length(hours_note) <= 160
  );
