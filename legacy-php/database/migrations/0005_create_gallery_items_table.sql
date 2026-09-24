CREATE TABLE gallery_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES gallery_categories (id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    description TEXT,
    alt_text TEXT NOT NULL,
    is_featured INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0, 1)),
    is_transformation INTEGER NOT NULL DEFAULT 0 CHECK (is_transformation IN (0, 1)),
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now'))
);

CREATE INDEX idx_gallery_items_category ON gallery_items (category_id);
CREATE INDEX idx_gallery_items_order ON gallery_items (display_order);
