import { Hono } from 'hono';
import { loadEvent, invalidateEventCache } from '../lib/event-ctx';

const app = new Hono<{ Bindings: Env }>();

/** Create a scene. POST /api/admin/events/:eventSlug/scenes */
app.post('/api/admin/events/:eventSlug/scenes', async (c) => {
	const eventSlug = c.req.param('eventSlug');
	const ev = await loadEvent(c.env, eventSlug);
	if (!ev) return c.json({ error: 'Event not found' }, 404);

	const body = await c.req.json<{
		id: string;
		name: string;
		emoji: string;
		description: string;
		prompt: string;
		sort_order: number;
		is_active: number;
	}>();

	if (!body.id || !body.name) return c.json({ error: 'id and name are required' }, 400);

	try {
		await c.env.DB.prepare(
			`INSERT INTO scenes (event_id, id, name, emoji, description, prompt, sort_order, is_active)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		)
			.bind(
				ev.id,
				body.id,
				body.name,
				body.emoji || '',
				body.description || '',
				body.prompt || '',
				body.sort_order ?? 0,
				body.is_active ?? 1,
			)
			.run();
	} catch (err) {
		if (err instanceof Error && err.message.includes('UNIQUE constraint')) {
			return c.json({ error: 'A scene with this ID already exists for this event' }, 409);
		}
		throw err;
	}

	await invalidateEventCache(c.env, ev.id, ev.slug);
	return c.json({ ok: true, id: body.id });
});

/** Bulk reorder scenes. PUT /api/admin/events/:eventSlug/scenes/reorder */
app.put('/api/admin/events/:eventSlug/scenes/reorder', async (c) => {
	const eventSlug = c.req.param('eventSlug');
	const ev = await loadEvent(c.env, eventSlug);
	if (!ev) return c.json({ error: 'Event not found' }, 404);
	const body = await c.req.json<{ id: string; sort_order: number }[]>();

	if (!Array.isArray(body) || body.length === 0) return c.json({ error: 'Expected array' }, 400);

	const stmts = body.map((item) =>
		c.env.DB.prepare(`UPDATE scenes SET sort_order = ? WHERE event_id = ? AND id = ?`).bind(item.sort_order, ev.id, item.id),
	);
	await c.env.DB.batch(stmts);

	await invalidateEventCache(c.env, ev.id, ev.slug);
	return c.json({ ok: true });
});

/** Update a scene. Supports partial updates. PUT /api/admin/events/:eventSlug/scenes/:sceneId */
app.put('/api/admin/events/:eventSlug/scenes/:sceneId', async (c) => {
	const eventSlug = c.req.param('eventSlug');
	const ev = await loadEvent(c.env, eventSlug);
	if (!ev) return c.json({ error: 'Event not found' }, 404);
	const sceneId = c.req.param('sceneId');
	const body = await c.req.json<Record<string, unknown>>();

	const ALLOWED = new Set(['name', 'emoji', 'description', 'prompt', 'sort_order', 'is_active']);
	const sets: string[] = [];
	const vals: Array<string | number> = [];
	for (const [key, val] of Object.entries(body)) {
		if (!ALLOWED.has(key)) continue;
		if (typeof val !== 'string' && typeof val !== 'number') {
			return c.json({ error: `Invalid value for ${key}` }, 400);
		}
		sets.push(`${key} = ?`);
		vals.push(val);
	}

	if (sets.length === 0) return c.json({ error: 'No valid fields' }, 400);

	vals.push(ev.id, sceneId);
	await c.env.DB.prepare(`UPDATE scenes SET ${sets.join(', ')} WHERE event_id = ? AND id = ?`)
		.bind(...vals)
		.run();

	await invalidateEventCache(c.env, ev.id, ev.slug);
	return c.json({ ok: true });
});

/** Delete a scene. DELETE /api/admin/events/:eventSlug/scenes/:sceneId */
app.delete('/api/admin/events/:eventSlug/scenes/:sceneId', async (c) => {
	const eventSlug = c.req.param('eventSlug');
	const ev = await loadEvent(c.env, eventSlug);
	if (!ev) return c.json({ error: 'Event not found' }, 404);
	const sceneId = c.req.param('sceneId');

	await c.env.DB.prepare(`DELETE FROM scenes WHERE event_id = ? AND id = ?`).bind(ev.id, sceneId).run();

	await invalidateEventCache(c.env, ev.id, ev.slug);
	return c.json({ ok: true });
});

export { app as adminScenesApiRoutes };
