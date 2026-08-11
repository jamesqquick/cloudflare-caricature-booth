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

	const scenes = (scenesRes.results ?? []) as SceneRecord[];

	const ctx: EventContext = { event: eventRow, scenes };

	// Cache ownership is canonical by numeric ID; slug entries only point to it.
	void Promise.all([
		env.CONFIG.put(cacheKey, JSON.stringify(ctx), {
			expirationTtl: KV_TTL_SECONDS,
		}),
		env.CONFIG.put(slugKey(eventRow.slug), JSON.stringify(eventRow.id), {
			expirationTtl: KV_TTL_SECONDS,
		}),
	]).catch(() => {});

	return ctx;
}

/** Load an active public event by its mutable URL slug. */
export async function loadPublicEventContextBySlug(
	env: Env,
	eventSlug: string,
): Promise<EventContext | null> {
	const cachedId = await env.CONFIG.get(slugKey(eventSlug), "json");
	if (typeof cachedId === "number") {
		const cachedCtx = await loadEventContext(env, cachedId);
		if (
			cachedCtx?.event.slug === eventSlug &&
			cachedCtx.event.status === "active"
		) {
			return cachedCtx;
		}
		await env.CONFIG.delete(slugKey(eventSlug));
	}

	const event = await env.DB.prepare(
		`SELECT * FROM events WHERE slug = ? AND status = 'active'`,
	)
		.bind(eventSlug)
		.first<EventRecord>();
	if (!event) return null;

	return loadEventContext(env, event.id);
}

/** Resolve new numeric and legacy slug workflow event references. */
export async function resolveEventContext(
	env: Env,
	eventId: number | string,
): Promise<EventContext | null> {
	if (typeof eventId === "number") return loadEventContext(env, eventId);
	const event = await loadEvent(env, eventId);
	return event ? loadEventContext(env, event.id) : null;
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
	const cachedId = await env.CONFIG.get(slugKey(eventSlug), "json");
	if (typeof cachedId === "number") {
		const cachedCtx = await loadEventContext(env, cachedId);
		if (cachedCtx?.event.slug === eventSlug) return cachedCtx.event;
		await env.CONFIG.delete(slugKey(eventSlug));
	}

	const event = await env.DB.prepare(
		`SELECT * FROM events WHERE slug = ?`,
	)
		.bind(eventSlug)
		.first<EventRecord>();
	if (!event) return null;

	const ctx = await loadEventContext(env, event.id);
	return ctx?.event ?? event;
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
