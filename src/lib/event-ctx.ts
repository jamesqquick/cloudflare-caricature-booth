/**
 * Event context loader — reads events + scenes from D1, caches in KV.
 */

import type { EventContext, EventRecord, SceneRecord } from "./types";

const KV_TTL_SECONDS = 60;
const CONTEXT_PREFIX = "event:id:";
const SLUG_PREFIX = "event:slug:";

function contextKey(eventId: number): string {
	return `${CONTEXT_PREFIX}${eventId}`;
}

function slugKey(eventSlug: string): string {
	return `${SLUG_PREFIX}${eventSlug}`;
}

async function rebuildEventContext(
	env: Env,
	event: EventRecord,
): Promise<EventContext> {
	const { results } = await env.DB.prepare(
		`SELECT * FROM scenes WHERE event_id = ? AND is_active = 1 ORDER BY sort_order`,
	)
		.bind(event.id)
		.all<SceneRecord>();
	const ctx: EventContext = { event, scenes: results };

	void env.CONFIG.put(contextKey(event.id), JSON.stringify(ctx), {
		expirationTtl: KV_TTL_SECONDS,
	}).catch(() => {});

	return ctx;
}

async function loadEventContextBySlug(
	env: Env,
	eventSlug: string,
	activeOnly: boolean,
): Promise<EventContext | null> {
	const event = await env.DB.prepare(
		`SELECT * FROM events WHERE slug = ?${activeOnly ? " AND status = 'active'" : ""}`,
	)
		.bind(eventSlug)
		.first<EventRecord>();
	if (!event) return null;

	return rebuildEventContext(env, event);
}

// -----------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------

/**
 * Load an event and its active scenes by immutable numeric ID. Event status
 * is intentionally not filtered so already-running workflows can finish if
 * an event is archived after they start.
 *
 * Reads from KV cache first; falls back to D1 and populates the cache.
 */
export async function loadEventContext(
	env: Env,
	eventId: number,
): Promise<EventContext | null> {
	const cacheKey = contextKey(eventId);

	// Try KV cache first
	const cached = await env.CONFIG.get(cacheKey, "json");
	if (cached) return cached as EventContext;

	// Miss — query D1
	const [eventRes, scenesRes] = await env.DB.batch([
		env.DB.prepare(
			`SELECT * FROM events WHERE id = ?`,
		).bind(eventId),
		env.DB.prepare(
			`SELECT * FROM scenes WHERE event_id = ? AND is_active = 1 ORDER BY sort_order`,
		).bind(eventId),
	]);

	const eventRow = eventRes.results[0] as EventRecord | undefined;
	if (!eventRow) return null;

	const ctx: EventContext = {
		event: eventRow,
		scenes: (scenesRes.results ?? []) as SceneRecord[],
	};

	void env.CONFIG.put(cacheKey, JSON.stringify(ctx), {
		expirationTtl: KV_TTL_SECONDS,
	}).catch(() => {});

	return ctx;
}

/** Rebuild an event context from authoritative D1 state, bypassing KV. */
export async function refreshEventContext(
	env: Env,
	eventId: number,
): Promise<EventContext | null> {
	const event = await env.DB.prepare(`SELECT * FROM events WHERE id = ?`)
		.bind(eventId)
		.first<EventRecord>();
	return event ? rebuildEventContext(env, event) : null;
}

/** Load an active public event by its mutable URL slug. */
export async function loadPublicEventContextBySlug(
	env: Env,
	eventSlug: string,
): Promise<EventContext | null> {
	return loadEventContextBySlug(env, eventSlug, true);
}

/** Resolve new numeric and legacy slug workflow event references. */
export async function resolveEventContext(
	env: Env,
	eventId: number | string,
): Promise<EventContext | null> {
	if (typeof eventId === "number") return loadEventContext(env, eventId);
	return loadEventContextBySlug(env, eventId, false);
}

/**
 * Invalidate the KV cache for an event so the next request picks up
 * admin edits immediately.
 */
export async function invalidateEventCache(
	env: Env,
	eventId: number,
	...eventSlugs: string[]
): Promise<void> {
	const cacheKey = contextKey(eventId);
	const [cached, current] = await Promise.all([
		env.CONFIG.get(cacheKey, "json") as Promise<EventContext | null>,
		env.DB.prepare(`SELECT slug FROM events WHERE id = ?`)
			.bind(eventId)
			.first<{ slug: string }>(),
	]);
	const slugs = new Set(eventSlugs);
	if (cached?.event.slug) slugs.add(cached.event.slug);
	if (current?.slug) slugs.add(current.slug);

	await Promise.all([
		env.CONFIG.delete(cacheKey),
		...Array.from(slugs, (slug) => env.CONFIG.delete(slugKey(slug))),
	]);
}

/**
 * List all events (for the admin index / root page).
 * Not cached — admin-only, low frequency.
 */
export async function listEvents(env: Env): Promise<EventRecord[]> {
	const { results } = await env.DB.prepare(
		`SELECT * FROM events ORDER BY created_at DESC`,
	).all<EventRecord>();
	return results;
}

/**
 * Load a single event record by slug (any status, not just active).
 * Used by admin pages that need to edit draft/archived events.
 */
export async function loadEvent(
	env: Env,
	eventSlug: string,
): Promise<EventRecord | null> {
	const ctx = await loadEventContextBySlug(env, eventSlug, false);
	return ctx?.event ?? null;
}

/**
 * Load all scenes for an event (including inactive), ordered by sort_order.
 * Used by admin scene editor.
 */
export async function loadAllScenes(
	env: Env,
	eventId: number,
): Promise<SceneRecord[]> {
	const { results } = await env.DB.prepare(
		`SELECT * FROM scenes WHERE event_id = ? ORDER BY sort_order`,
	).bind(eventId).all<SceneRecord>();
	return results;
}
