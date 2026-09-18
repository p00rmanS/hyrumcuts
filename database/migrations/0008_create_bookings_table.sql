-- Bookings are appointment REQUESTS, not confirmed calendar holds. Live
-- scheduling (the actual exclusive time slot) is delegated to Calendly per
-- the project owner's direction; this table is the record Hyrum reviews in
-- the admin dashboard and that a future n8n automation can read to notify
-- him or mirror into Google Calendar. See README "Booking architecture".
CREATE TABLE bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference_code TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    service_id INTEGER REFERENCES services (id) ON DELETE SET NULL,
    preferred_date TEXT NOT NULL,
    preferred_time_slot TEXT NOT NULL,
    client_type TEXT NOT NULL CHECK (client_type IN ('first_time', 'returning')),
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
    admin_notes TEXT,
    consent_at TEXT NOT NULL,
    request_ip TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now'))
);

CREATE UNIQUE INDEX idx_bookings_reference_code ON bookings (reference_code);
CREATE UNIQUE INDEX idx_bookings_token_hash ON bookings (token_hash);
CREATE INDEX idx_bookings_status ON bookings (status);
CREATE INDEX idx_bookings_preferred_date ON bookings (preferred_date);
