/**
 * Admin-specific HTML rendering helpers.
 * All functions here are used only by admin route files.
 */

import type { AdminSessionRow, AdminStats } from './admin-data';
import { escapeHtml, escapeAttr } from './html';

// ---------------------------------------------------------------------------
// Slug validation
// ---------------------------------------------------------------------------

/** Slug validation: lowercase alphanumeric + hyphens, 3–64 chars. */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

// ---------------------------------------------------------------------------
// Status / pill helpers
// ---------------------------------------------------------------------------

/** Status pill class — must match the client-side `statusClass` in /admin JS. */
export function adminStatusClass(s: string): string {
	if (s === 'completed') return 'bg-emerald-500/20 text-emerald-300 ring-emerald-400/30';
	if (s === 'errored') return 'bg-red-500/20 text-red-300 ring-red-400/30';
	if (!s || s === 'pending') return 'bg-white/10 text-white/60 ring-white/20';
	return 'bg-amber-500/20 text-amber-300 ring-amber-400/30';
}

export function adminPrintClass(s: string | null): string {
	if (s === 'printed') return 'bg-emerald-500/20 text-emerald-300 ring-emerald-400/30';
	if (s === 'failed') return 'bg-red-500/20 text-red-300 ring-red-400/30';
	if (s === 'printing') return 'bg-cf-orange/20 text-cf-orange ring-cf-orange/30';
	if (s === 'pending') return 'bg-amber-500/20 text-amber-300 ring-amber-400/30';
	return 'bg-white/5 text-white/40 ring-white/10';
}

/** Status pill for event status. */
export function eventStatusPill(status: string): string {
	const cls =
		status === 'active'
			? 'bg-emerald-500/20 text-emerald-300 ring-emerald-400/30'
			: status === 'archived'
				? 'bg-amber-500/20 text-amber-300 ring-amber-400/30'
				: 'bg-white/10 text-white/60 ring-white/20';
	return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs ring-1 ${cls}">${escapeHtml(status)}</span>`;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/**
 * Server-side, we emit a <time data-ts="<unix-seconds>"> placeholder and
 * let the client JS format it in the viewer's locale on load. This avoids
 * the "flips from UTC 24h to local AM/PM after the first poll" bug.
 */
export function adminTimeTag(secs: number | null): string {
	if (!secs) return `<span class="text-white/40">—</span>`;
	return `<time data-ts="${secs}" class="whitespace-nowrap">…</time>`;
}

export function adminFmtDuration(ms: number | null): string {
	if (ms == null) return '—';
	if (ms < 1000) return `${ms} ms`;
	const s = Math.round(ms / 1000);
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	return `${m}m ${s % 60}s`;
}

export function adminFmtAvg(secs: number | null): string {
	if (secs == null) return '—';
	if (secs < 60) return `${secs.toFixed(1)}s`;
	const m = Math.floor(secs / 60);
	const s = Math.round(secs - m * 60);
	return `${m}m ${s}s`;
}

// ---------------------------------------------------------------------------
// Stat cards
// ---------------------------------------------------------------------------

export function statCard(label: string, value: string, accentCls = 'text-white'): string {
	return (
		`<div class="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">` +
		`<div class="text-[10px] uppercase tracking-widest text-white/40">${escapeHtml(label)}</div>` +
		`<div class="mt-1 text-2xl font-bold ${accentCls}">${escapeHtml(value)}</div>` +
		`</div>`
	);
}

export function renderAdminStatCards(stats: AdminStats): string {
	return (
		statCard('Total', String(stats.totalSessions)) +
		statCard('Completed', String(stats.completed), 'text-emerald-300') +
		statCard('Errored', String(stats.errored), 'text-red-300') +
		statCard('Avg pipeline', adminFmtAvg(stats.avgPipelineSec)) +
		statCard('Emails', String(stats.emailsCollected), 'text-cf-orange') +
		statCard('Printed', String(stats.postcardsPrinted), 'text-cf-orange')
	);
}

export function renderAdminSceneBreakdown(stats: AdminStats): string {
	if (stats.sceneBreakdown.length === 0) {
		return `<span class="text-xs text-white/40">No scenes used yet.</span>`;
	}
	return stats.sceneBreakdown
		.map(
			(s) =>
				`<span class="inline-flex items-center gap-2 rounded-full bg-white/[0.04] border border-white/10 px-3 py-1.5 text-xs">` +
				`<span class="text-white/80">${escapeHtml(s.sceneName)}</span>` +
				`<span class="text-white/40">·</span>` +
				`<span class="font-mono text-cf-orange">${s.count}</span>` +
				`</span>`,
		)
		.join('');
}

// ---------------------------------------------------------------------------
// Card grid rendering
// ---------------------------------------------------------------------------

/** Build the thumbnail URL for a session's postcard via the admin image proxy. */
function adminThumbUrl(postcardKey: string): string {
	return `/api/admin/image?key=${encodeURIComponent(postcardKey)}&w=400`;
}

/**
 * Render a single session card for the admin grid.
 *
 * The postcard image is the card's primary visual. Status pill overlays
 * top-left, timestamp bottom-right, and action buttons appear on hover
 * via a dark gradient overlay.
 */
export function renderAdminCard(r: AdminSessionRow): string {
	const status = r.status || 'pending';
	const isCompleted = status === 'completed' && !!r.postcardKey;
	const isErrored = status === 'errored';

	// Image or placeholder
	let imageHtml: string;
	if (isCompleted && r.postcardKey) {
		imageHtml = `<img src="${escapeAttr(adminThumbUrl(r.postcardKey))}" alt="Postcard" loading="lazy" class="absolute inset-0 w-full h-full object-cover" />`;
	} else if (isErrored) {
		imageHtml =
			`<div class="absolute inset-0 flex flex-col items-center justify-center bg-red-500/10 px-4">` +
			`<span class="text-3xl mb-2">&#x26A0;</span>` +
			`<span class="text-xs text-red-300 text-center line-clamp-2">${escapeHtml(r.errorMsg ?? 'Unknown error')}</span>` +
			`</div>`;
	} else {
		imageHtml = `<div class="absolute inset-0 flex items-center justify-center bg-white/5 animate-pulse"><span class="text-2xl text-white/20">&#x23F3;</span></div>`;
	}

	// Action buttons (shown on hover via CSS group-hover)
	const actions: string[] = [];
	if (isCompleted) {
		actions.push(
			`<button type="button" data-action="retry-print" data-session="${escapeAttr(r.sessionId)}" class="inline-flex items-center justify-center size-8 rounded-full bg-cf-orange/80 text-black hover:bg-cf-orange disabled:opacity-50 disabled:cursor-not-allowed transition" title="Retry print">` +
			`<svg class="size-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.25 7.034v-.534" /></svg>` +
			`</button>`,
		);
	}
	actions.push(
		`<button type="button" data-action="delete-session" data-session="${escapeAttr(r.sessionId)}" class="inline-flex items-center justify-center size-8 rounded-full bg-red-500/80 text-white hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition" title="Delete">` +
		`<svg class="size-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>` +
		`</button>`,
	);
	actions.push(
		`<a href="/admin/sessions/${escapeAttr(r.sessionId)}" class="inline-flex items-center justify-center size-8 rounded-full bg-white/20 text-white hover:bg-white/40 transition" title="View details">` +
		`<svg class="size-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>` +
		`</a>`,
	);

	const detailHref = `/admin/sessions/${escapeAttr(r.sessionId)}`;

	return (
		`<a href="${detailHref}" class="group relative aspect-[3/2] rounded-xl overflow-hidden border border-white/10 bg-white/[0.02] hover:scale-[1.02] transition-transform cursor-pointer block" data-session-card="${escapeAttr(r.sessionId)}">` +
		// Image layer
		imageHtml +
		// Status pill (top-left)
		`<div class="absolute top-2 left-2 z-10">` +
		`<span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ring-1 ${adminStatusClass(status)}">${escapeHtml(status)}</span>` +
		`</div>` +
		// Timestamp (bottom-right)
		`<div class="absolute bottom-2 right-2 z-10">` +
		`<time data-ts="${r.createdAt ?? 0}" class="text-[10px] text-white/60 bg-black/50 rounded px-1.5 py-0.5">${r.createdAt ? '...' : ''}</time>` +
		`</div>` +
		// Hover overlay with action buttons
		`<div class="absolute inset-0 z-20 flex items-start justify-end gap-1.5 p-2 bg-gradient-to-b from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">` +
		actions.map((a) => `<span class="pointer-events-auto">${a}</span>`).join('') +
		`</div>` +
		`</a>`
	);
}

/**
 * Render the full card grid for the admin dashboard.
 */
export function renderAdminCardGrid(rows: AdminSessionRow[]): string {
	if (rows.length === 0) {
		return `<div class="col-span-full py-12 text-center text-white/40">No sessions yet.</div>`;
	}
	return rows.map(renderAdminCard).join('');
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

/** Shared admin nav header for event management pages. */
export function adminEventNav(crumbs: string = ''): string {
	return `<header class="flex items-center justify-between mb-8">
		<div>
			<div class="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-white/50">
				Booth admin
			</div>
			${crumbs}
		</div>
		<div class="flex items-center gap-4 text-xs text-white/50">
			<a href="/admin" class="text-cf-orange hover:text-white underline underline-offset-4">Dashboard</a>
			<a href="/admin/events" class="text-cf-orange hover:text-white underline underline-offset-4">Events</a>
			<a href="/admin/logout" class="text-cf-orange hover:text-white underline underline-offset-4">Sign out</a>
		</div>
	</header>`;
}
