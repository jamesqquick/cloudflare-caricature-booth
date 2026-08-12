-- Separate immutable numeric event identity from the mutable public slug.
-- Foreign keys remain enforced while their checks are deferred until the
-- migration transaction has rebuilt and renamed every related table.
PRAGMA defer_foreign_keys = true;

-- Fail before rebuilding if a non-null legacy event slug cannot be mapped.
-- D1 rolls back the migration transaction when this CHECK constraint fails.
CREATE TABLE migration_0008_event_reference_guard (
	is_valid INTEGER NOT NULL CHECK (is_valid = 1)
);

INSERT INTO migration_0008_event_reference_guard (is_valid)
SELECT CASE WHEN EXISTS (
	SELECT 1
	FROM sessions
	LEFT JOIN events ON events.id = sessions.event_id
	WHERE sessions.event_id IS NOT NULL AND events.id IS NULL

	UNION ALL

	SELECT 1
	FROM print_jobs
	LEFT JOIN events ON events.id = print_jobs.event_id
	WHERE print_jobs.event_id IS NOT NULL AND events.id IS NULL
) THEN 0 ELSE 1 END;

DROP TABLE migration_0008_event_reference_guard;

CREATE TABLE events_new (
	id                    INTEGER PRIMARY KEY,
	slug                  TEXT NOT NULL UNIQUE,
	name                  TEXT NOT NULL,
	status                TEXT NOT NULL DEFAULT 'draft',
	accent_color          TEXT NOT NULL DEFAULT '#f6821f',
	watermark_image_key   TEXT,
	watermark_image_key_left TEXT,
	tagline               TEXT NOT NULL DEFAULT 'Take a selfie, pick a scene, walk away with a printed postcard.',
	kiosk_idle_subhead    TEXT NOT NULL DEFAULT 'Cloudflare Kiosk · For more information on Cloudflare, visit cloudflare.com',
	scene_picker_heading  TEXT NOT NULL DEFAULT 'Pick your scene',
	scene_style_preamble  TEXT,
	scene_constraints     TEXT,
	timezone              TEXT NOT NULL DEFAULT 'America/New_York',
	privacy_email         TEXT NOT NULL DEFAULT '',
	created_at            INTEGER NOT NULL DEFAULT (unixepoch()),
	created_by            TEXT,
	watermark_w           INTEGER,
	watermark_left_w      INTEGER
);

INSERT INTO events_new (
	id, slug, name, status, accent_color,
	watermark_image_key, watermark_image_key_left,
	tagline, kiosk_idle_subhead, scene_picker_heading,
	scene_style_preamble, scene_constraints,
	timezone, privacy_email, created_at, created_by,
	watermark_w, watermark_left_w
)
SELECT
	ROW_NUMBER() OVER (ORDER BY id),
	id, name, status, accent_color,
	watermark_image_key, watermark_image_key_left,
	tagline, kiosk_idle_subhead, scene_picker_heading,
	scene_style_preamble, scene_constraints,
	timezone, privacy_email, created_at, created_by,
	watermark_w, watermark_left_w
FROM events
ORDER BY id;

CREATE TABLE scenes_new (
	event_id    INTEGER NOT NULL,
	id          TEXT NOT NULL,
	name        TEXT NOT NULL,
	emoji       TEXT NOT NULL DEFAULT '',
	description TEXT NOT NULL DEFAULT '',
	prompt      TEXT NOT NULL DEFAULT '',
	sort_order  INTEGER NOT NULL DEFAULT 0,
	is_active   INTEGER NOT NULL DEFAULT 1,
	PRIMARY KEY (event_id, id),
	FOREIGN KEY (event_id) REFERENCES events_new(id) ON DELETE CASCADE
);

INSERT INTO scenes_new (
	event_id, id, name, emoji, description, prompt, sort_order, is_active
)
SELECT
	events_new.id, scenes.id, scenes.name, scenes.emoji,
	scenes.description, scenes.prompt, scenes.sort_order, scenes.is_active
FROM scenes
JOIN events_new ON events_new.slug = scenes.event_id;

CREATE TABLE sessions_new (
	id                   TEXT PRIMARY KEY,
	created_at           INTEGER NOT NULL DEFAULT (unixepoch()),
	status               TEXT NOT NULL DEFAULT 'pending',
	scene_id             TEXT,
	scene_name           TEXT,
	selfie_key           TEXT,
	caricature_key       TEXT,
	postcard_key         TEXT,
	workflow_instance_id TEXT,
	completed_at         INTEGER,
	error_msg            TEXT,
	email                TEXT,
	email_submitted_at   INTEGER,
	event_id             INTEGER REFERENCES events_new(id) ON DELETE RESTRICT,
	pipeline_ms          INTEGER
);

INSERT INTO sessions_new (
	id, created_at, status, scene_id, scene_name,
	selfie_key, caricature_key, postcard_key, workflow_instance_id,
	completed_at, error_msg, email, email_submitted_at, event_id, pipeline_ms
)
SELECT
	sessions.id, sessions.created_at, sessions.status,
	sessions.scene_id, sessions.scene_name,
	sessions.selfie_key, sessions.caricature_key, sessions.postcard_key,
	sessions.workflow_instance_id, sessions.completed_at, sessions.error_msg,
	sessions.email, sessions.email_submitted_at, events_new.id,
	sessions.pipeline_ms
FROM sessions
LEFT JOIN events_new ON events_new.slug = sessions.event_id;

CREATE TABLE print_jobs_new (
	id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
	session_id   TEXT NOT NULL,
	postcard_key TEXT NOT NULL,
	postcard_url TEXT NOT NULL,
	scene_name   TEXT NOT NULL,
	status       TEXT NOT NULL DEFAULT 'pending',
	created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
	printed_at   INTEGER,
	error_msg    TEXT,
	event_id     INTEGER REFERENCES events_new(id) ON DELETE RESTRICT,
	FOREIGN KEY (session_id) REFERENCES sessions_new(id)
);

INSERT INTO print_jobs_new (
	id, session_id, postcard_key, postcard_url, scene_name,
	status, created_at, printed_at, error_msg, event_id
)
SELECT
	print_jobs.id, print_jobs.session_id, print_jobs.postcard_key,
	print_jobs.postcard_url, print_jobs.scene_name, print_jobs.status,
	print_jobs.created_at, print_jobs.printed_at, print_jobs.error_msg,
	events_new.id
FROM print_jobs
LEFT JOIN events_new ON events_new.slug = print_jobs.event_id;

CREATE TABLE event_admins_new (
	event_id    INTEGER NOT NULL,
	admin_email TEXT NOT NULL,
	role        TEXT NOT NULL DEFAULT 'editor',
	added_at    INTEGER NOT NULL DEFAULT (unixepoch()),
	PRIMARY KEY (event_id, admin_email),
	FOREIGN KEY (event_id) REFERENCES events_new(id) ON DELETE CASCADE
);

INSERT INTO event_admins_new (event_id, admin_email, role, added_at)
SELECT events_new.id, event_admins.admin_email, event_admins.role, event_admins.added_at
FROM event_admins
JOIN events_new ON events_new.slug = event_admins.event_id;

DROP TABLE print_jobs;
DROP TABLE scenes;
DROP TABLE event_admins;
DROP TABLE sessions;
DROP TABLE events;

ALTER TABLE events_new RENAME TO events;
ALTER TABLE sessions_new RENAME TO sessions;
ALTER TABLE print_jobs_new RENAME TO print_jobs;
ALTER TABLE scenes_new RENAME TO scenes;
ALTER TABLE event_admins_new RENAME TO event_admins;

CREATE INDEX idx_sessions_created_at ON sessions(created_at DESC);
CREATE INDEX idx_sessions_workflow_instance ON sessions(workflow_instance_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_print_jobs_status ON print_jobs(status, created_at);
CREATE INDEX idx_scenes_event ON scenes(event_id, sort_order);
CREATE INDEX idx_sessions_event ON sessions(event_id, created_at DESC);
CREATE INDEX idx_print_jobs_event ON print_jobs(event_id, status, created_at);
