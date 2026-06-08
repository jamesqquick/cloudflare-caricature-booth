import { Hono } from 'hono';
import { loadAdminSessions, loadAdminStats, countAdminSessions, SESSIONS_PER_PAGE } from '../lib/admin-data';
import { page, escapeScriptJson } from '../lib/html';
import { renderAdminStatCards, renderAdminSceneBreakdown, renderAdminCardGrid } from '../lib/admin-render';

const app = new Hono<{ Bindings: Env }>();

/**
 * Admin dashboard. Server-renders the initial card grid; client polls
 * /api/admin/sessions + /api/admin/stats every 10s and re-renders.
 * GET /admin
 */
app.get('/admin', async (c) => {
	const [rows, stats, total] = await Promise.all([
		loadAdminSessions(c.env, 1),
		loadAdminStats(c.env),
		countAdminSessions(c.env),
	]);
	const totalPages = Math.max(1, Math.ceil(total / SESSIONS_PER_PAGE));
	const initialJson = JSON.stringify({ sessions: rows, stats, page: 1, totalPages });

	return c.html(
		page(
			'Admin dashboard',
			`<main class="min-h-screen px-6 py-8 max-w-7xl mx-auto">
				<header class="flex items-center justify-between mb-8">
					<div>
						<div class="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-white/50">
							Booth admin
						</div>
						<h1 class="mt-1 text-2xl font-bold">Live sessions</h1>
					</div>
					<div class="flex items-center gap-4 text-xs text-white/50">
						<span id="admin-poll-indicator" class="inline-flex items-center gap-2">
							<span class="size-2 rounded-full bg-emerald-400 animate-pulse"></span>
							<span>Auto-refresh · 10s</span>
						</span>
						<a href="/admin/events" class="text-cf-orange hover:text-white underline underline-offset-4">Events</a>
						<a href="/admin/metrics" class="text-cf-orange hover:text-white underline underline-offset-4">Metrics</a>
						<a href="/admin/logout" class="text-cf-orange hover:text-white underline underline-offset-4">Sign out</a>
					</div>
				</header>

				<!-- Notyf toast library (loaded only on /admin) -->
				<link rel="stylesheet" href="https://unpkg.com/notyf@3.10.0/notyf.min.css" />
				<script src="https://unpkg.com/notyf@3.10.0/notyf.min.js"></script>
				<style>
					.notyf__toast { font-family: inherit; border-radius: 12px; }
					.notyf__toast--success { background: #f6821f; }
					.notyf__toast--error   { background: #ef4444; }
					.notyf__icon { background: transparent !important; }
					.notyf__icon-success, .notyf__icon-error {
						background: transparent !important;
						border-color: rgba(255,255,255,0.9) !important;
					}
					.notyf__icon-success::after, .notyf__icon-success::before,
					.notyf__icon-error::after,   .notyf__icon-error::before {
						background: #ffffff !important;
					}
					.notyf__message { font-weight: 500; }
				</style>

				<section id="admin-stats" class="mb-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
					${renderAdminStatCards(stats)}
				</section>

				<section class="mb-8 rounded-xl border border-white/10 bg-white/[0.02] px-5 py-4">
					<div class="flex items-center justify-between mb-3">
						<h2 class="text-sm font-semibold text-white/80">Sessions by scene</h2>
						<span class="text-[11px] uppercase tracking-widest text-white/40">All-time</span>
					</div>
					<div id="admin-scene-breakdown" class="flex flex-wrap gap-2">
						${renderAdminSceneBreakdown(stats)}
					</div>
				</section>

				<section>
					<div id="admin-grid" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
						${renderAdminCardGrid(rows)}
					</div>
					<div class="mt-4 flex items-center justify-between text-[11px] uppercase tracking-widest text-white/40">
						<span id="admin-last-updated">Updated just now</span>
						<div id="admin-pagination" class="flex items-center gap-3">
							<button id="admin-prev" type="button" class="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition" disabled>
								&#8592; Prev
							</button>
							<span id="admin-page-info" class="text-xs text-white/50">Page 1 of ${totalPages}</span>
							<button id="admin-next" type="button" class="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"${totalPages <= 1 ? ' disabled' : ''}>
								Next &#8594;
							</button>
						</div>
					</div>
				</section>
			</main>

			<script id="admin-initial" type="application/json">${escapeScriptJson(initialJson)}</script>
			<script>
			(function () {
				var initialEl = document.getElementById("admin-initial");
				var lastSnapshot = JSON.parse(initialEl.textContent || '{"sessions":[],"stats":null,"page":1,"totalPages":1}');
				var gridEl = document.getElementById("admin-grid");
				var lastUpdated = document.getElementById("admin-last-updated");
				var statsEl = document.getElementById("admin-stats");
				var sceneEl = document.getElementById("admin-scene-breakdown");
				var prevBtn = document.getElementById("admin-prev");
				var nextBtn = document.getElementById("admin-next");
				var pageInfo = document.getElementById("admin-page-info");

				var currentPage = lastSnapshot.page || 1;
				var totalPages = lastSnapshot.totalPages || 1;

				function escapeHtml(s) {
					return String(s == null ? "" : s)
						.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
						.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
				}

				function statusClass(s) {
					if (s === "completed") return "bg-emerald-500/20 text-emerald-300 ring-emerald-400/30";
					if (s === "errored")   return "bg-red-500/20 text-red-300 ring-red-400/30";
					if (!s || s === "pending") return "bg-white/10 text-white/60 ring-white/20";
					return "bg-amber-500/20 text-amber-300 ring-amber-400/30";
				}

				function fmtRelative(secs) {
					if (!secs) return "";
					var diff = Math.floor(Date.now() / 1000) - Number(secs);
					if (diff < 60) return "just now";
					if (diff < 3600) return Math.floor(diff / 60) + "m ago";
					if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
					return Math.floor(diff / 86400) + "d ago";
				}

				function formatTimes() {
					var nodes = document.querySelectorAll("time[data-ts]");
					for (var i = 0; i < nodes.length; i++) {
						var n = nodes[i];
						var secs = Number(n.getAttribute("data-ts"));
						if (secs > 0) n.textContent = fmtRelative(secs);
					}
				}

				function thumbUrl(postcardKey) {
					return "/api/admin/image?key=" + encodeURIComponent(postcardKey) + "&w=400";
				}

				function renderCard(r) {
					var status = r.status || "pending";
					var isCompleted = status === "completed" && !!r.postcardKey;
					var isErrored = status === "errored";

					var imageHtml;
					if (isCompleted && r.postcardKey) {
						imageHtml = '<img src="' + escapeHtml(thumbUrl(r.postcardKey)) + '" alt="Postcard" loading="lazy" class="absolute inset-0 w-full h-full object-cover" />';
					} else if (isErrored) {
						imageHtml = '<div class="absolute inset-0 flex flex-col items-center justify-center bg-red-500/10 px-4">'
							+ '<span class="text-3xl mb-2">&#x26A0;</span>'
							+ '<span class="text-xs text-red-300 text-center line-clamp-2">' + escapeHtml(r.errorMsg || "Unknown error") + '</span>'
							+ '</div>';
					} else {
						imageHtml = '<div class="absolute inset-0 flex items-center justify-center bg-white/5 animate-pulse"><span class="text-2xl text-white/20">&#x23F3;</span></div>';
					}

					var actions = [];
					if (isCompleted) {
						actions.push(
							'<button type="button" data-action="retry-print" data-session="' + escapeHtml(r.sessionId) + '" class="inline-flex items-center justify-center size-8 rounded-full bg-cf-orange/80 text-black hover:bg-cf-orange disabled:opacity-50 disabled:cursor-not-allowed transition" title="Retry print">'
							+ '<svg class="size-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.25 7.034v-.534" /></svg>'
							+ '</button>'
						);
					}
					actions.push(
						'<button type="button" data-action="delete-session" data-session="' + escapeHtml(r.sessionId) + '" class="inline-flex items-center justify-center size-8 rounded-full bg-red-500/80 text-white hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition" title="Delete">'
						+ '<svg class="size-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>'
						+ '</button>'
					);
					actions.push(
						'<a href="/admin/sessions/' + escapeHtml(r.sessionId) + '" class="inline-flex items-center justify-center size-8 rounded-full bg-white/20 text-white hover:bg-white/40 transition" title="View details">'
						+ '<svg class="size-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>'
						+ '</a>'
					);

					var detailHref = "/admin/sessions/" + escapeHtml(r.sessionId);

					return '<a href="' + detailHref + '" class="admin-card group relative aspect-[3/2] rounded-xl overflow-hidden border border-white/10 bg-white/[0.02] hover:scale-[1.02] transition-transform cursor-pointer block" data-session-card="' + escapeHtml(r.sessionId) + '">'
						+ imageHtml
						+ '<div class="absolute top-2 left-2 z-10"><span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ring-1 ' + statusClass(status) + '">' + escapeHtml(status) + '</span></div>'
						+ '<div class="absolute bottom-2 right-2 z-10"><time data-ts="' + (r.createdAt || 0) + '" class="text-[10px] text-white/60 bg-black/50 rounded px-1.5 py-0.5">' + (r.createdAt ? fmtRelative(r.createdAt) : "") + '</time></div>'
						+ '<div class="admin-card-overlay absolute inset-0 z-20 flex items-start justify-end gap-1.5 p-2 bg-gradient-to-b from-black/60 via-transparent to-transparent transition-opacity pointer-events-none">' + actions.map(function (a) { return '<span class="pointer-events-auto">' + a + '</span>'; }).join("") + '</div>'
						+ '</a>';
				}

				function fmtAvg(secs) {
					if (secs == null) return "\u2014";
					if (secs < 60) return secs.toFixed(1) + "s";
					var m = Math.floor(secs / 60);
					var s = Math.round(secs - m * 60);
					return m + "m " + s + "s";
				}

				function renderStatCard(label, value, accent) {
					var accentCls = accent || "text-white";
					return ''
						+ '<div class="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">'
						+ '<div class="text-[10px] uppercase tracking-widest text-white/40">' + escapeHtml(label) + '</div>'
						+ '<div class="mt-1 text-2xl font-bold ' + accentCls + '">' + escapeHtml(value) + '</div>'
						+ '</div>';
				}

				function renderStats(stats) {
					if (!stats) return;
					statsEl.innerHTML = ''
						+ renderStatCard("Total", String(stats.totalSessions))
						+ renderStatCard("Completed", String(stats.completed), "text-emerald-300")
						+ renderStatCard("Errored", String(stats.errored), "text-red-300")
						+ renderStatCard("Avg pipeline", fmtAvg(stats.avgPipelineSec))
						+ renderStatCard("Emails", String(stats.emailsCollected), "text-cf-orange")
						+ renderStatCard("Printed", String(stats.postcardsPrinted), "text-cf-orange");

					var scenes = stats.sceneBreakdown || [];
					if (scenes.length === 0) {
						sceneEl.innerHTML = '<span class="text-xs text-white/40">No scenes used yet.</span>';
					} else {
						sceneEl.innerHTML = scenes.map(function (s) {
							return '<span class="inline-flex items-center gap-2 rounded-full bg-white/[0.04] border border-white/10 px-3 py-1.5 text-xs">'
								+ '<span class="text-white/80">' + escapeHtml(s.sceneName) + '</span>'
								+ '<span class="text-white/40">\u00b7</span>'
								+ '<span class="font-mono text-cf-orange">' + s.count + '</span>'
								+ '</span>';
						}).join("");
					}
				}

				function renderCards(sessions) {
					if (sessions.length === 0) {
						gridEl.innerHTML = '<div class="col-span-full py-12 text-center text-white/40">No sessions yet.</div>';
					} else {
						gridEl.innerHTML = sessions.map(renderCard).join("");
					}
				}

				function updatePagination() {
					pageInfo.textContent = "Page " + currentPage + " of " + totalPages;
					prevBtn.disabled = currentPage <= 1;
					nextBtn.disabled = currentPage >= totalPages;
				}

				function render(snapshot) {
					renderCards(snapshot.sessions || []);
					if (snapshot.stats) renderStats(snapshot.stats);
					if (snapshot.totalPages != null) totalPages = snapshot.totalPages;
					formatTimes();
					updatePagination();
					lastUpdated.textContent = "Updated " + new Date().toLocaleTimeString();
				}

				async function poll() {
					try {
						var results = await Promise.all([
							fetch("/api/admin/sessions?page=" + currentPage, { credentials: "same-origin" }),
							fetch("/api/admin/stats",    { credentials: "same-origin" }),
						]);
						if (results[0].status === 401 || results[1].status === 401) {
							window.location.href = "/admin/login";
							return;
						}
						if (!results[0].ok || !results[1].ok) {
							throw new Error("HTTP " + results[0].status + "/" + results[1].status);
						}
						var sessionsBody = await results[0].json();
						var stats = await results[1].json();
						lastSnapshot = {
							sessions: sessionsBody.sessions,
							stats: stats,
							page: sessionsBody.page,
							totalPages: sessionsBody.totalPages,
						};
						currentPage = sessionsBody.page;
						totalPages = sessionsBody.totalPages;
						render(lastSnapshot);
					} catch (err) {
						console.error("[admin] poll failed:", err);
					}
				}

				var notyf = new Notyf({
					duration: 4000,
					position: { x: "right", y: "bottom" },
					dismissible: true,
					ripple: false,
				});
				function toast(msg, isError) {
					if (isError) notyf.error(msg);
					else         notyf.success(msg);
				}

				async function callJson(url, opts) {
					var r = await fetch(url, Object.assign({ credentials: "same-origin" }, opts || {}));
					if (r.status === 401) {
						window.location.href = "/admin/login";
						throw new Error("unauthorized");
					}
					var body = await r.json().catch(function () { return {}; });
					if (!r.ok) {
						var err = (body && body.error) ? body.error : ("HTTP " + r.status);
						throw new Error(err);
					}
					return body;
				}

				// Action button delegation on the card grid
				gridEl.addEventListener("click", function (ev) {
					var btn = ev.target.closest && ev.target.closest("button[data-action]");
					if (!btn) return;
					ev.preventDefault();
					ev.stopPropagation();
					var action = btn.getAttribute("data-action");
					var sessionId = btn.getAttribute("data-session");
					if (!sessionId) return;
					if (btn.disabled) return;
					btn.disabled = true;
					var shortId = sessionId.slice(0, 8);

					var promise;
					if (action === "retry-print") {
						promise = callJson("/api/admin/reprint/" + encodeURIComponent(sessionId), {
							method: "POST",
						}).then(function () {
							toast("Queued reprint for " + shortId);
							poll();
						});
					} else if (action === "delete-session") {
						if (!confirm("Permanently delete ALL data for session " + shortId + "...?" + "\\n\\n" + "This removes the selfie, caricature, postcard, print jobs, and email from our systems. Cannot be undone.")) {
							btn.disabled = false;
							return;
						}
						promise = callJson("/api/admin/session/" + encodeURIComponent(sessionId), {
							method: "DELETE",
						}).then(function (j) {
							toast("Deleted session " + shortId + " (" + (j.deleted || []).length + " items)");
							poll();
						});
					} else {
						btn.disabled = false;
						return;
					}

					promise.catch(function (err) {
						toast("Failed: " + err.message, true);
					}).finally(function () {
						btn.disabled = false;
					});
				});

				// Pagination
				prevBtn.addEventListener("click", function () {
					if (currentPage > 1) { currentPage--; poll(); }
				});
				nextBtn.addEventListener("click", function () {
					if (currentPage < totalPages) { currentPage++; poll(); }
				});

				formatTimes();
				setInterval(poll, 10000);
			})();
			</script>`,
		),
	);
});

export { app as adminDashboardRoutes };
