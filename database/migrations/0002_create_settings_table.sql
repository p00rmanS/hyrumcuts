-- Simple editable key/value content store. Admin-managed public copy,
-- social/contact links, SEO fields, and the Calendly booking URL all live
-- here so they are edited from one settings screen instead of being
-- scattered through templates or environment files.
CREATE TABLE settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now'))
);
