CREATE TABLE reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_label TEXT NOT NULL,
    quote TEXT NOT NULL,
    haircut_type TEXT,
    is_approved INTEGER NOT NULL DEFAULT 0 CHECK (is_approved IN (0, 1)),
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now'))
);

CREATE INDEX idx_reviews_approved_order ON reviews (is_approved, display_order);
