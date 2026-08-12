import { Hono } from 'hono';
import type { EventEnv } from '../../lib/types';
import { UUID_RE } from '../../lib/helpers';

const app = new Hono<EventEnv>();

/**
 * R2 image proxy constrained to `runs/` and `kiosk/` key prefixes.
 * GET /api/run-img?key=(runs|kiosk)/<sessionId>/...
 */
app.get('/api/run-img', async (c) => {
	const key = c.req.query('key');
	if (!key) return c.json({ error: 'invalid key' }, 400);

	const keyParts = key.split('/');
	const [root, sessionId, ...objectPath] = keyParts;
	if (
		(root !== 'runs' && root !== 'kiosk') ||
		!sessionId ||
		!UUID_RE.test(sessionId) ||
		objectPath.length === 0 ||
		objectPath.some((part) => !part || part === '.' || part === '..')
	) {
		return c.json({ error: 'invalid key' }, 400);
	}

	const eventId = c.get('eventCtx').event.id;
	const session = await c.env.DB.prepare(
		'SELECT 1 FROM sessions WHERE id = ? AND event_id = ?',
	)
		.bind(sessionId, eventId)
		.first();
	if (!session) return c.json({ error: 'not found' }, 404);

	const obj = await c.env.BUCKET.get(key);
	if (!obj) return c.json({ error: 'not found', key }, 404);

	const headers: Record<string, string> = {
		'content-type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
		'content-length': String(obj.size),
		'cache-control': 'public, max-age=3600',
	};

	if (c.req.query('download')) {
		const tail = key.split('/').pop() ?? 'image';
		headers['content-disposition'] = `attachment; filename="caricature-${tail}"`;
	}

	return new Response(obj.body, { headers });
});

export { app as imagesRoutes };
