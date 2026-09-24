-- A normal gallery item has a single 'primary' media row. A before/after
-- transformation item has one 'before' row and one 'after' row instead,
-- which keeps the relationship explicit and queryable rather than relying
-- on filename conventions or a drag-only slider.
CREATE TABLE gallery_media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gallery_item_id INTEGER NOT NULL REFERENCES gallery_items (id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'primary' CHECK (role IN ('primary', 'before', 'after')),
    image_path TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now'))
);

CREATE INDEX idx_gallery_media_item ON gallery_media (gallery_item_id);
CREATE UNIQUE INDEX idx_gallery_media_item_role ON gallery_media (gallery_item_id, role);
