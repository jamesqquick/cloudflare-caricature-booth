import { Hono } from 'hono';
import { trackEvent } from '../lib/analytics';

const app = new Hono<{ Bindings: Env }>();

/**
 * Returns pending print jobs for the agent to process.
 * GET /api/print-agent/jobs?limit=5&eventSlug=<event-slug>
 *
 * eventSlug is required — each print agent is scoped to one event.
 */
app.get('/api/print-agent/jobs', async (c) => {
	const eventSlug = c.req.query('eventSlug') ?? c.req.query('eventId');
	if (!eventSlug) {
		return c.json({ error: 'eventSlug query param is required' }, 400);
	}

	const limit = Math.min(Number(c.req.query('limit')) || 5, 20);
	const { results } = await c.env.DB.prepare(
		`SELECT print_jobs.id, session_id, event_id, events.slug AS event_slug,
			postcard_key, postcard_url, scene_name, print_jobs.created_at
		 FROM print_jobs
		 JOIN events ON events.id = print_jobs.event_id
		 WHERE print_jobs.status = 'pending' AND events.slug = ?
		 ORDER BY print_jobs.created_at ASC
		 LIMIT ?`,
	)
		.bind(eventSlug, limit)
		.all<{
			id: string;
			session_id: string;
			event_id: number;
			event_slug: string;
			postcard_key: string;
			postcard_url: string;
			scene_name: string;
			created_at: number;
		}>();

	return c.json({ jobs: results });
});

/**
 * Acknowledge a print job (mark it printed or failed).
 * POST /api/print-agent/jobs/:id/ack
 * Body: { "status": "printed" } or { "status": "failed", "error": "reason" }
 */
app.post('/api/print-agent/jobs/:id/ack', async (c) => {
	const jobId = c.req.param('id');
	const body = await c.req.json<{ status: 'printed' | 'failed'; error?: string }>();

	if (body.status !== 'printed' && body.status !== 'failed') {
		return c.json({ error: "status must be 'printed' or 'failed'" }, 400);
	}

	const result = await c.env.DB.prepare(
		`UPDATE print_jobs
		 SET status = ?, printed_at = CASE WHEN ? = 'printed' THEN unixepoch() ELSE NULL END, error_msg = ?
		 WHERE id = ? AND status IN ('pending', 'printing')`,
	)
		.bind(body.status, body.status, body.error ?? null, jobId)
		.run();

	if ((result.meta.changes ?? 0) === 0) {
		return c.json({ error: 'job not found or already acked' }, 404);
	}

	const job = await c.env.DB.prepare('SELECT session_id FROM print_jobs WHERE id = ?').bind(jobId).first<{ session_id: string }>();
	const sid = job?.session_id ?? '';
	trackEvent(c.env.ANALYTICS, body.status === 'printed' ? 'print.completed' : 'print.failed', sid, body.error ?? '');

	return c.json({ ok: true, jobId, status: body.status });
});

export { app as printAgentRoutes };
