import { Hono } from 'hono';
import { loadEvent, loadAllScenes, invalidateEventCache } from '../lib/event-ctx';
import { SLUG_RE } from '../lib/admin-render';

const app = new Hono<{ Bindings: Env }>();

/** Create a new event. POST /api/admin/events */
app.post('/api/admin/events', async (c) => {
	const body = await c.req.json<{ slug: string; name: string; status?: string }>();
	if (!body.slug || !body.name) return c.json({ error: 'slug and name are required' }, 400);
	if (!SLUG_RE.test(body.slug)) return c.json({ error: 'Invalid slug. Lowercase letters, numbers, hyphens, 3–64 chars.' }, 400);

	const status = body.status || 'draft';
	if (!['draft', 'active', 'archived'].includes(status)) return c.json({ error: 'Invalid status' }, 400);

	try {
		await c.env.DB.prepare(`INSERT INTO events (slug, name, status) VALUES (?, ?, ?)`).bind(body.slug, body.name, status).run();
	} catch (err) {
		if (err instanceof Error && err.message.includes('UNIQUE constraint')) {
			return c.json({ error: 'An event with this slug already exists' }, 409);
		}
		throw err;
	}

	return c.json({ ok: true, slug: body.slug });
});

/** Update an event's fields. Supports partial updates + slug rename. PUT /api/admin/events/:eventSlug */
app.put('/api/admin/events/:eventSlug', async (c) => {
	const eventSlug = c.req.param('eventSlug');
	const ev = await loadEvent(c.env, eventSlug);
	if (!ev) return c.json({ error: 'Event not found' }, 404);

	const body = await c.req.json<Record<string, unknown>>();

	const ALLOWED = new Set([
		'slug', 'name', 'status', 'accent_color', 'watermark_w', 'watermark_left_w',
		'tagline', 'kiosk_idle_subhead', 'scene_picker_heading',
		'scene_style_preamble', 'scene_constraints', 'timezone', 'privacy_email',
	]);
	const NULLABLE_STRINGS = new Set(['scene_style_preamble', 'scene_constraints']);

	const sets: string[] = [];
	const vals: Array<string | number | null> = [];
	for (const [key, val] of Object.entries(body)) {
		if (!ALLOWED.has(key)) continue;
		if (key === 'slug') continue;
		if (key === 'status' && (typeof val !== 'string' || !['draft', 'active', 'archived'].includes(val))) {
			return c.json({ error: 'Invalid status' }, 400);
		}
		if ((key === 'watermark_w' || key === 'watermark_left_w') && val !== null) {
			const n = Number(val);
			if (!Number.isInteger(n) || n < 100 || n > 900) {
				return c.json({ error: `${key} must be an integer between 100 and 900, or null` }, 400);
			}
		}
		if (val !== null && typeof val !== 'string' && typeof val !== 'number') {
			return c.json({ error: `Invalid value for ${key}` }, 400);
		}
		sets.push(`${key} = ?`);
		vals.push(NULLABLE_STRINGS.has(key) && val === '' ? null : val);
	}

	const newSlug = body.slug;
	const slugChanging = typeof newSlug === 'string' && newSlug !== ev.slug;
	if (slugChanging) {
		if (!SLUG_RE.test(newSlug)) return c.json({ error: 'Invalid slug' }, 400);
		sets.push('slug = ?');
		vals.push(newSlug);
	}

	if (sets.length === 0) return c.json({ error: 'No valid fields to update' }, 400);
	vals.push(ev.id);

	try {
		await c.env.DB.prepare(`UPDATE events SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
	} catch (err) {
		if (err instanceof Error && err.message.includes('UNIQUE constraint')) {
			return c.json({ error: 'An event with this slug already exists' }, 409);
		}
		throw err;
	}

	const currentSlug = slugChanging ? newSlug : ev.slug;
	await invalidateEventCache(c.env, ev.id, ev.slug, currentSlug);
	return c.json({ ok: true, slug: currentSlug });
});

/** Delete a draft event with no sessions. DELETE /api/admin/events/:eventSlug */
app.delete('/api/admin/events/:eventSlug', async (c) => {
	const eventSlug = c.req.param('eventSlug');
	const ev = await loadEvent(c.env, eventSlug);
	if (!ev) return c.json({ error: 'Event not found' }, 404);
	if (ev.status !== 'draft') return c.json({ error: 'Only draft events can be deleted' }, 409);

	const cnt = await c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM sessions WHERE event_id = ?`).bind(ev.id).first<{ cnt: number }>();
	if (cnt && cnt.cnt > 0) return c.json({ error: 'Cannot delete event with existing sessions' }, 409);

	await c.env.DB.batch([
		c.env.DB.prepare(`DELETE FROM scenes WHERE event_id = ?`).bind(ev.id),
		c.env.DB.prepare(`DELETE FROM event_admins WHERE event_id = ?`).bind(ev.id),
		c.env.DB.prepare(`DELETE FROM events WHERE id = ?`).bind(ev.id),
	]);

	await invalidateEventCache(c.env, ev.id, ev.slug);
	return c.json({ ok: true });
});

/** Clone an event with all its scenes. POST /api/admin/events/:eventSlug/clone */
app.post('/api/admin/events/:eventSlug/clone', async (c) => {
	const eventSlug = c.req.param('eventSlug');
	const ev = await loadEvent(c.env, eventSlug);
	if (!ev) return c.json({ error: 'Event not found' }, 404);

	const scenes = await loadAllScenes(c.env, ev.id);

	let newSlug = `${ev.slug}-copy`;
	let attempt = 0;
	while (true) {
		const slug = attempt === 0 ? newSlug : `${ev.slug}-copy-${attempt}`;
		const existing = await c.env.DB.prepare(`SELECT id FROM events WHERE slug = ?`).bind(slug).first();
		if (!existing) {
			newSlug = slug;
			break;
		}
		attempt++;
		if (attempt > 20) return c.json({ error: 'Could not generate unique slug' }, 500);
	}

	const clonedEvent = await c.env.DB.prepare(
		`INSERT INTO events (slug, name, status, accent_color,
			tagline, kiosk_idle_subhead, scene_picker_heading,
			scene_style_preamble, scene_constraints,
			timezone, privacy_email)
		 VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?)
		 RETURNING id`,
	)
		.bind(
			newSlug,
			`${ev.name} (Copy)`,
			ev.accent_color,
			ev.tagline,
			ev.kiosk_idle_subhead,
			ev.scene_picker_heading,
			ev.scene_style_preamble,
			ev.scene_constraints,
			ev.timezone,
			ev.privacy_email,
		)
		.first<{ id: number }>();
	if (!clonedEvent) return c.json({ error: 'Failed to clone event' }, 500);

	if (scenes.length > 0) {
		const stmts = scenes.map((s) =>
			c.env.DB.prepare(
				`INSERT INTO scenes (event_id, id, name, emoji, description, prompt, sort_order, is_active)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			).bind(clonedEvent.id, s.id, s.name, s.emoji, s.description, s.prompt, s.sort_order, s.is_active),
		);
		await c.env.DB.batch(stmts);
	}

	return c.json({ ok: true, newEventSlug: newSlug });
});

export { app as adminEventsApiRoutes };
