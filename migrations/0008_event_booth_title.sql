-- Customer-facing booth title, configurable per event.
ALTER TABLE events ADD COLUMN booth_title TEXT NOT NULL DEFAULT 'AI Caricature Booth';
