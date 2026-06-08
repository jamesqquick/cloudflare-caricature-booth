/**
 * Admin dashboard data layer (Phase 10.2).
 *
 * Reads the last N sessions + their most recent print job. Used by both the
 * server-rendered initial /admin paint and the /api/admin/sessions polling
 * endpoint, so the two views never disagree on the same request.
 */

export const SESSIONS_PER_PAGE = 30;

export interface AdminSessionRow {
	sessionId: string;
	status: string;
	sceneId: string | null;
	sceneName: string | null;
	createdAt: number | null;       // unix seconds
	completedAt: number | null;     // unix seconds
	/**
	 * Pipeline duration in ms — the workflow-measured `pipeline_ms` (true
	 * end-to-end, retry-aware). Null for in-flight rows and legacy rows that
	 * predate the measurement.
	 */
	pipelineDurationMs: number | null;
	/** "jam***@example.com" or null if no email captured. */
	emailMasked: string | null;
	/** Has the attendee submitted an email (regardless of send success). */
	hasEmail: boolean;
	/** Latest print_jobs.status for this session, or null if none. */
	printStatus: string | null;
	printJobId: string | null;
	postcardKey: string | null;
	errorMsg: string | null;
	/** The event this session belongs to, or null if unassigned. */
	eventId: string | null;
}

interface RawSessionRow {
	id: string;
	status: string | null;
	scene_id: string | null;
	scene_name: string | null;
	created_at: number | null;
	completed_at: number | null;
	pipeline_ms: number | null;
	email: string | null;
	postcard_key: string | null;
	error_msg: string | null;
	print_status: string | null;
	print_job_id: string | null;
	event_id: string | null;
}

/**
 * Fetch the most recent N sessions with their latest print job status.
 *
 * The LEFT JOIN uses a correlated subquery to pick exactly one print_jobs
 * row per session (the newest by created_at). SQLite is happy with this
 * shape; it's O(N) in the join because sessions is already limited to 30.
 *
 * Supports pagination via `page` (1-indexed). Returns `SESSIONS_PER_PAGE`
 * rows per page.
 */
export async function loadAdminSessions(env: Env, page = 1): Promise<AdminSessionRow[]> {
	const offset = (Math.max(1, page) - 1) * SESSIONS_PER_PAGE;
	const { results } = await env.DB.prepare(
		`SELECT
			s.id,
			s.status,
			s.scene_id,
			s.scene_name,
			s.created_at,
			s.completed_at,
			s.pipeline_ms,
			s.email,
			s.postcard_key,
			s.error_msg,
			s.event_id,
			(SELECT pj.status FROM print_jobs pj
			   WHERE pj.session_id = s.id
			   ORDER BY pj.created_at DESC LIMIT 1) AS print_status,
			(SELECT pj.id FROM print_jobs pj
			   WHERE pj.session_id = s.id
			   ORDER BY pj.created_at DESC LIMIT 1) AS print_job_id
		 FROM sessions s
		 ORDER BY s.created_at DESC
		 LIMIT ? OFFSET ?`,
	)
		.bind(SESSIONS_PER_PAGE, offset)
		.all<RawSessionRow>();

	return results.map<AdminSessionRow>((r) => {
		const pipelineMs = r.pipeline_ms;
		return {
			sessionId: r.id,
			status: r.status ?? "pending",
			sceneId: r.scene_id,
			sceneName: r.scene_name,
			createdAt: r.created_at,
			completedAt: r.completed_at,
			pipelineDurationMs: pipelineMs,
			emailMasked: maskEmail(r.email),
			hasEmail: !!r.email,
			printStatus: r.print_status,
			printJobId: r.print_job_id,
			postcardKey: r.postcard_key,
			errorMsg: r.error_msg,
			eventId: r.event_id,
		};
	});
}

/** Total session count — used for pagination page count. */
export async function countAdminSessions(env: Env): Promise<number> {
	const row = await env.DB.prepare('SELECT COUNT(*) AS cnt FROM sessions').first<{ cnt: number }>();
	return row?.cnt ?? 0;
}

// ---------------------------------------------------------------------------
// Session detail (single session with full data)
// ---------------------------------------------------------------------------

export interface AdminPrintJob {
	id: string;
	status: string;
	sceneName: string;
	createdAt: number | null;
	printedAt: number | null;
	errorMsg: string | null;
}

export interface AdminSessionDetail {
	sessionId: string;
	status: string;
	sceneId: string | null;
	sceneName: string | null;
	createdAt: number | null;
	completedAt: number | null;
	pipelineDurationMs: number | null;
	email: string | null;
	selfieKey: string | null;
	caricatureKey: string | null;
	postcardKey: string | null;
	errorMsg: string | null;
	eventId: string | null;
	workflowInstanceId: string | null;
	printJobs: AdminPrintJob[];
}

interface RawDetailRow {
	id: string;
	status: string | null;
	scene_id: string | null;
	scene_name: string | null;
	created_at: number | null;
	completed_at: number | null;
	pipeline_ms: number | null;
	email: string | null;
	selfie_key: string | null;
	caricature_key: string | null;
	postcard_key: string | null;
	error_msg: string | null;
	event_id: string | null;
	workflow_instance_id: string | null;
}

interface RawPrintJobRow {
	id: string;
	status: string;
	scene_name: string;
	created_at: number | null;
	printed_at: number | null;
	error_msg: string | null;
}

/**
 * Load full detail for a single session, including all print jobs.
 * Returns null if the session doesn't exist.
 */
export async function loadAdminSession(env: Env, sessionId: string): Promise<AdminSessionDetail | null> {
	const session = await env.DB.prepare(
		`SELECT
			id, status, scene_id, scene_name, created_at, completed_at,
			pipeline_ms, email, selfie_key, caricature_key, postcard_key,
			error_msg, event_id, workflow_instance_id
		 FROM sessions WHERE id = ?`,
	)
		.bind(sessionId)
		.first<RawDetailRow>();

	if (!session) return null;

	const { results: printJobs } = await env.DB.prepare(
		`SELECT id, status, scene_name, created_at, printed_at, error_msg
		 FROM print_jobs WHERE session_id = ?
		 ORDER BY created_at DESC`,
	)
		.bind(sessionId)
		.all<RawPrintJobRow>();

	return {
		sessionId: session.id,
		status: session.status ?? 'pending',
		sceneId: session.scene_id,
		sceneName: session.scene_name,
		createdAt: session.created_at,
		completedAt: session.completed_at,
		pipelineDurationMs: session.pipeline_ms,
		email: session.email,
		selfieKey: session.selfie_key,
		caricatureKey: session.caricature_key,
		postcardKey: session.postcard_key,
		errorMsg: session.error_msg,
		eventId: session.event_id,
		workflowInstanceId: session.workflow_instance_id,
		printJobs: printJobs.map((pj) => ({
			id: pj.id,
			status: pj.status,
			sceneName: pj.scene_name,
			createdAt: pj.created_at,
			printedAt: pj.printed_at,
			errorMsg: pj.error_msg,
		})),
	};
}

// ---------------------------------------------------------------------------
// Stats (Phase 10.3)
// ---------------------------------------------------------------------------

export interface SceneBreakdownEntry {
	sceneId: string;
	sceneName: string;
	count: number;
}

export interface AdminStats {
	totalSessions: number;
	completed: number;
	errored: number;
	inFlight: number;
	/** Average pipeline duration (completed sessions only), seconds. Null if no completed sessions. */
	avgPipelineSec: number | null;
	emailsCollected: number;
	postcardsPrinted: number;
	sceneBreakdown: SceneBreakdownEntry[];
}

/**
 * One-shot dashboard stats. Two D1 queries:
 *   1. Aggregate counts/avg over sessions + a single count over print_jobs.
 *   2. Scene breakdown grouped by scene_id.
 *
 * The aggregate query uses COUNT(CASE WHEN …) so we only scan `sessions` once.
 * Pipeline avg is computed in SQL over completed rows that have a real
 * `pipeline_ms` measurement (converted to seconds). Legacy rows predating
 * pipeline_ms are deliberately excluded: their created_at == completed_at, so
 * including them would average in zeros and drag the metric toward 0 — the very
 * bug this is fixing. Kept in seconds and rounded at the JSON layer.
 */
export async function loadAdminStats(env: Env): Promise<AdminStats> {
	const [aggRes, printedRes, scenesRes] = await env.DB.batch<
		Record<string, number | null>
	>([
		env.DB.prepare(
			`SELECT
				COUNT(*) AS total,
				COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed,
				COUNT(CASE WHEN status = 'errored'   THEN 1 END) AS errored,
				COUNT(CASE WHEN status NOT IN ('completed', 'errored') THEN 1 END) AS in_flight,
				COUNT(CASE WHEN email IS NOT NULL AND email != '' THEN 1 END) AS emails,
				AVG(CASE WHEN status = 'completed' AND pipeline_ms IS NOT NULL
				         THEN pipeline_ms / 1000.0 END) AS avg_pipeline_sec
			 FROM sessions`,
		),
		env.DB.prepare(
			`SELECT COUNT(*) AS printed FROM print_jobs WHERE status = 'printed'`,
		),
		env.DB.prepare(
			`SELECT
				COALESCE(scene_id, 'unknown') AS scene_id,
				COALESCE(scene_name, 'Unknown') AS scene_name,
				COUNT(*) AS count
			 FROM sessions
			 WHERE scene_id IS NOT NULL
			 GROUP BY scene_id, scene_name
			 ORDER BY count DESC`,
		),
	]);

	const agg = aggRes.results[0] ?? {};
	const printedRow = printedRes.results[0] ?? {};
	const scenes = (scenesRes.results ?? []) as unknown as Array<{
		scene_id: string;
		scene_name: string;
		count: number;
	}>;

	const avgRaw = agg.avg_pipeline_sec;
	const avgPipelineSec =
		typeof avgRaw === "number" && Number.isFinite(avgRaw) ? Math.round(avgRaw * 10) / 10 : null;

	return {
		totalSessions: numberOr0(agg.total),
		completed: numberOr0(agg.completed),
		errored: numberOr0(agg.errored),
		inFlight: numberOr0(agg.in_flight),
		avgPipelineSec,
		emailsCollected: numberOr0(agg.emails),
		postcardsPrinted: numberOr0(printedRow.printed),
		sceneBreakdown: scenes.map((s) => ({
			sceneId: s.scene_id,
			sceneName: s.scene_name,
			count: Number(s.count) || 0,
		})),
	};
}

function numberOr0(n: number | null | undefined): number {
	return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

/**
 * Mask an email like `jamesqquick@example.com` → `jam***@example.com`.
 * Returns null if the input is null/empty.
 */
export function maskEmail(email: string | null | undefined): string | null {
	if (!email) return null;
	const at = email.indexOf("@");
	if (at <= 0) return "***";
	const local = email.slice(0, at);
	const domain = email.slice(at + 1);
	const visible = local.slice(0, Math.min(3, local.length));
	return `${visible}***@${domain}`;
}
