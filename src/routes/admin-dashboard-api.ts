import { Hono } from 'hono';
import { loadAdminSessions, loadAdminStats, countAdminSessions, SESSIONS_PER_PAGE } from '../lib/admin-data';

const app = new Hono<{ Bindings: Env }>();

/**
 * Sessions JSON feed for the admin dashboard. Polled every 10s by /admin.
 * Supports pagination via `?page=N` (1-indexed, defaults to 1).
 * GET /api/admin/sessions  →  { sessions, page, totalPages }
 */
app.get('/api/admin/sessions', async (c) => {
	const page = Math.max(1, Number(c.req.query('page')) || 1);
	const [rows, total] = await Promise.all([
		loadAdminSessions(c.env, page),
		countAdminSessions(c.env),
	]);
	const totalPages = Math.max(1, Math.ceil(total / SESSIONS_PER_PAGE));
	return c.json({ sessions: rows, page, totalPages });
});

/**
 * Aggregate stats for the dashboard cards. Polled every 10s alongside sessions.
 * GET /api/admin/stats  →  AdminStats
 */
app.get('/api/admin/stats', async (c) => {
	const stats = await loadAdminStats(c.env);
	return c.json(stats);
});

export { app as adminDashboardApiRoutes };
