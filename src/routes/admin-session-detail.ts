import { Hono } from 'hono';
import { loadAdminSession } from '../lib/admin-data';
import { page, escapeScriptJson } from '../lib/html';
import { escapeHtml, escapeAttr } from '../lib/html';
import { adminStatusClass, adminPrintClass, adminTimeTag, adminFmtDuration } from '../lib/admin-render';
import { UUID_RE } from '../lib/helpers';

const app = new Hono<{ Bindings: Env }>();

/**
 * Session detail page — shows all data for a single session.
 * GET /admin/sessions/:id
 */
app.get('/admin/sessions/:id', async (c) => {
	const id = c.req.param('id');
	if (!UUID_RE.test(id)) {
		return c.html(page('Invalid session', errorPage('Invalid session ID format.')), 400);
	}

	const session = await loadAdminSession(c.env, id);
	if (!session) {
		return c.html(page('Session not found', errorPage('No session found with that ID.')), 404);
	}

	const shortId = session.sessionId.slice(0, 8);
	const status = session.status;

	function imgProxy(key: string | null, w?: number): string {
		if (!key) return '';
		const params = new URLSearchParams({ key });
		if (w) params.set('w', String(w));
		return `/api/admin/image?${params.toString()}`;
	}

	// Build metadata rows
	const metaRows: [string, string][] = [
		['Status', `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs ring-1 ${adminStatusClass(status)}">${escapeHtml(status)}</span>`],
		['Session ID', `<code class="font-mono text-xs text-white/80">${escapeHtml(session.sessionId)}</code>`],
		['Event', escapeHtml(session.eventId ?? '—')],
		['Scene', escapeHtml(session.sceneName ? `${session.sceneName} (${session.sceneId ?? ''})` : '—')],
		['Created', adminTimeTag(session.createdAt)],
		['Completed', adminTimeTag(session.completedAt)],
		['Pipeline', escapeHtml(adminFmtDuration(session.pipelineDurationMs))],
		['Workflow ID', session.workflowInstanceId ? `<code class="font-mono text-xs text-white/60">${escapeHtml(session.workflowInstanceId)}</code>` : '—'],
		['Email', escapeHtml(session.email ?? '—')],
	];
	if (session.errorMsg) {
		metaRows.push(['Error', `<span class="text-red-300">${escapeHtml(session.errorMsg)}</span>`]);
	}

	const metaHtml = metaRows
		.map(([label, value]) =>
			`<div class="flex items-start gap-4 py-2 border-b border-white/5 last:border-0">` +
			`<dt class="w-28 shrink-0 text-[11px] uppercase tracking-widest text-white/40 pt-0.5">${label}</dt>` +
			`<dd class="text-sm text-white/80">${value}</dd>` +
			`</div>`,
		)
		.join('');

	// Print jobs table
	let printHtml: string;
	if (session.printJobs.length === 0) {
		printHtml = `<p class="text-sm text-white/40">No print jobs.</p>`;
	} else {
		printHtml =
			`<div class="overflow-x-auto rounded-lg border border-white/10">` +
			`<table class="w-full text-sm">` +
			`<thead class="bg-white/5 text-left text-[11px] uppercase tracking-widest text-white/50">` +
			`<tr>` +
			`<th class="px-4 py-2 font-medium">Job ID</th>` +
			`<th class="px-4 py-2 font-medium">Status</th>` +
			`<th class="px-4 py-2 font-medium">Created</th>` +
			`<th class="px-4 py-2 font-medium">Printed</th>` +
			`<th class="px-4 py-2 font-medium">Error</th>` +
			`</tr></thead><tbody class="divide-y divide-white/5">` +
			session.printJobs
				.map(
					(pj) =>
						`<tr class="hover:bg-white/[0.03]">` +
						`<td class="px-4 py-2 font-mono text-xs text-white/60">${escapeHtml(pj.id.slice(0, 8))}</td>` +
						`<td class="px-4 py-2"><span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs ring-1 ${adminPrintClass(pj.status)}">${escapeHtml(pj.status)}</span></td>` +
						`<td class="px-4 py-2 text-white/60">${adminTimeTag(pj.createdAt)}</td>` +
						`<td class="px-4 py-2 text-white/60">${adminTimeTag(pj.printedAt)}</td>` +
						`<td class="px-4 py-2 text-red-300 text-xs">${escapeHtml(pj.errorMsg ?? '')}</td>` +
						`</tr>`,
				)
				.join('') +
			`</tbody></table></div>`;
	}

	// Action buttons
	const isCompleted = status === 'completed' && !!session.postcardKey;
	const actionsHtml: string[] = [];
	if (isCompleted) {
		actionsHtml.push(
			`<button type="button" id="btn-retry-print" data-session="${escapeAttr(session.sessionId)}"` +
			` class="inline-flex items-center gap-2 rounded-xl border border-cf-orange/40 bg-cf-orange/10 px-5 py-2.5 text-sm font-medium text-cf-orange hover:bg-cf-orange/20 hover:border-cf-orange/60 disabled:opacity-50 disabled:cursor-not-allowed transition">` +
			`<svg class="size-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.25 7.034v-.534" /></svg>` +
			` Retry print</button>`,
		);
	}
	actionsHtml.push(
		`<button type="button" id="btn-delete" data-session="${escapeAttr(session.sessionId)}"` +
		` class="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/20 hover:border-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition">` +
		`<svg class="size-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>` +
		` Delete session</button>`,
	);

	// Image sections
	function imageSection(label: string, key: string | null, allowDownload = false): string {
		if (!key) {
			return (
				`<div class="rounded-xl border border-white/10 bg-white/[0.02] p-4">` +
				`<h3 class="text-sm font-semibold text-white/60 mb-3">${label}</h3>` +
				`<div class="aspect-[3/2] rounded-lg bg-white/5 flex items-center justify-center text-white/20 text-sm">No image</div>` +
				`</div>`
			);
		}
		const fullUrl = imgProxy(key);
		const downloadUrl = imgProxy(key) + '&download=1';
		return (
			`<div class="rounded-xl border border-white/10 bg-white/[0.02] p-4">` +
			`<div class="flex items-center justify-between mb-3">` +
			`<h3 class="text-sm font-semibold text-white/80">${label}</h3>` +
			(allowDownload ? `<a href="${escapeAttr(downloadUrl)}" class="text-xs text-cf-orange hover:text-white underline underline-offset-2">Download</a>` : '') +
			`</div>` +
			`<img src="${escapeAttr(fullUrl)}" alt="${escapeAttr(label)}" loading="lazy" class="w-full rounded-lg" />` +
			`</div>`
		);
	}

	return c.html(
		page(
			`Session ${shortId}`,
			`<main class="min-h-screen px-6 py-8 max-w-5xl mx-auto">
				<!-- Notyf -->
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

				<header class="mb-8">
					<nav class="flex items-center gap-2 text-xs text-white/50 mb-2">
						<a href="/admin" class="text-cf-orange hover:text-white underline underline-offset-4">Dashboard</a>
						<span class="text-white/30">/</span>
						<span>Session ${escapeHtml(shortId)}</span>
					</nav>
					<h1 class="text-2xl font-bold">Session details</h1>
				</header>

				<!-- Images -->
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
					${imageSection('Postcard', session.postcardKey, true)}
					${imageSection('Selfie', session.selfieKey)}
				</div>

				<!-- Metadata -->
				<section class="mb-8 rounded-xl border border-white/10 bg-white/[0.02] px-5 py-4">
					<h2 class="text-sm font-semibold text-white/80 mb-3">Metadata</h2>
					<dl>${metaHtml}</dl>
				</section>

				<!-- Print history -->
				<section class="mb-8">
					<h2 class="text-sm font-semibold text-white/80 mb-3">Print history</h2>
					${printHtml}
				</section>

				<!-- Actions -->
				<section class="flex items-center gap-3 mb-8">
					${actionsHtml.join('')}
				</section>
			</main>

			<script>
			(function () {
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

				function formatTimes() {
					var nodes = document.querySelectorAll("time[data-ts]");
					for (var i = 0; i < nodes.length; i++) {
						var n = nodes[i];
						var secs = Number(n.getAttribute("data-ts"));
						if (secs > 0) {
							var d = new Date(secs * 1000);
							n.textContent = d.toLocaleString(undefined, {
								month: "short", day: "numeric",
								hour: "numeric", minute: "2-digit",
							});
						}
					}
				}

				var retryBtn = document.getElementById("btn-retry-print");
				if (retryBtn) {
					retryBtn.addEventListener("click", function () {
						var sid = retryBtn.getAttribute("data-session");
						retryBtn.disabled = true;
						callJson("/api/admin/reprint/" + encodeURIComponent(sid), { method: "POST" })
							.then(function () { toast("Queued reprint"); })
							.catch(function (err) { toast("Failed: " + err.message, true); })
							.finally(function () { retryBtn.disabled = false; });
					});
				}

				var deleteBtn = document.getElementById("btn-delete");
				deleteBtn.addEventListener("click", function () {
					var sid = deleteBtn.getAttribute("data-session");
					var shortId = sid.slice(0, 8);
					if (!confirm("Permanently delete ALL data for session " + shortId + "?\\n\\nThis removes the selfie, caricature, postcard, print jobs, and email. Cannot be undone.")) return;
					deleteBtn.disabled = true;
					callJson("/api/admin/session/" + encodeURIComponent(sid), { method: "DELETE" })
						.then(function (j) {
							toast("Deleted session " + shortId);
							setTimeout(function () { window.location.href = "/admin"; }, 1500);
						})
						.catch(function (err) { toast("Failed: " + err.message, true); })
						.finally(function () { deleteBtn.disabled = false; });
				});

				formatTimes();
			})();
			</script>`,
		),
	);
});

function errorPage(msg: string): string {
	return (
		`<main class="min-h-screen flex flex-col items-center justify-center px-6 py-12">` +
		`<div class="text-center max-w-xl">` +
		`<h1 class="text-2xl font-bold mb-3">Error</h1>` +
		`<p class="text-white/60 mb-6">${escapeHtml(msg)}</p>` +
		`<a href="/admin" class="inline-block rounded-full bg-cf-orange px-6 py-3 text-sm font-semibold text-black hover:bg-cf-orange-dark transition">Back to dashboard</a>` +
		`</div></main>`
	);
}

export { app as adminSessionDetailRoutes };
