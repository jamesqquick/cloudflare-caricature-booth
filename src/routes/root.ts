import { Hono } from 'hono';
import { listEvents } from '../lib/event-ctx';
import { page, escapeAttr } from '../lib/html';

const app = new Hono<{ Bindings: Env }>();

app.get('/', async (c) => {
	const events = await listEvents(c.env);
	const activeEvents = events.filter((e) => e.status === 'active');

	const eventCards =
		activeEvents.length === 0
			? `<p class="text-white/60 text-center py-8">No events are running right now. Check back soon!</p>`
			: activeEvents
					.map(
						(e) => `<a href="/e/${escapeAttr(e.id)}" class="block rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/30 transition p-6">
			<div class="text-xl font-bold">${escapeAttr(e.name)}</div>
			<p class="mt-2 text-sm text-white/60">${escapeAttr(e.tagline)}</p>
		</a>`,
					)
					.join('\n');

	return c.html(
		page(
			'AI Caricature Booth — Built on Cloudflare',
			`<main class="px-6 sm:px-8 pb-20">
				<!-- Hero -->
				<section class="max-w-4xl mx-auto pt-10 sm:pt-20 flex flex-col items-center text-center">
					<h1 class="text-[clamp(2rem,5vw,3.5rem)] font-bold leading-tight text-balance">
						AI Caricature Booth
					</h1>
					<p class="mt-4 max-w-xl text-lg text-white/70 text-balance">
						An AI-powered photo booth that transforms selfies into
						hand-drawn ink caricature postcards — generated, composited,
						and printed on the spot. Built end-to-end on Cloudflare.
					</p>
				</section>

				<!-- How it works -->
				<section class="max-w-4xl mx-auto mt-20 sm:mt-28">
					<h2 class="text-center text-xs uppercase tracking-[0.3em] text-white/40 mb-8">
						How it works
					</h2>
					<ol class="grid sm:grid-cols-3 gap-4 sm:gap-6">
						<li class="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
							<div class="text-cf-orange font-mono text-xs tracking-widest">STEP 01</div>
							<div class="mt-3 text-lg font-semibold">Snap a selfie</div>
							<p class="mt-2 text-sm text-white/60">
								Step up to the booth and take a photo. No app, no signup.
							</p>
						</li>
						<li class="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
							<div class="text-cf-orange font-mono text-xs tracking-widest">STEP 02</div>
							<div class="mt-3 text-lg font-semibold">Pick a scene</div>
							<p class="mt-2 text-sm text-white/60">
								Choose a backdrop from the scene picker to set the vibe.
							</p>
						</li>
						<li class="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
							<div class="text-cf-orange font-mono text-xs tracking-widest">STEP 03</div>
							<div class="mt-3 text-lg font-semibold">Take home a postcard</div>
							<p class="mt-2 text-sm text-white/60">
								AI generates your caricature, we print it on the spot, and
								you get a digital copy too.
							</p>
						</li>
					</ol>
				</section>

				<!-- Built on Cloudflare -->
				<section class="max-w-4xl mx-auto mt-20 sm:mt-24">
					<h2 class="text-center text-xs uppercase tracking-[0.3em] text-white/40 mb-8">
						Built on Cloudflare
					</h2>
					<p class="text-center text-sm text-white/60 max-w-2xl mx-auto mb-8">
						The entire application — from the camera capture to the printed
						postcard — runs on 10 Cloudflare services.
					</p>
					<div class="grid sm:grid-cols-2 gap-4">
						<a href="https://developers.cloudflare.com/workers/" target="_blank" rel="noopener" class="rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/30 transition p-5">
							<div class="text-sm font-semibold text-cf-orange">Workers</div>
							<p class="mt-1 text-sm text-white/60">Runtime for the entire application.</p>
						</a>
						<a href="https://developers.cloudflare.com/workers-ai/" target="_blank" rel="noopener" class="rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/30 transition p-5">
							<div class="text-sm font-semibold text-cf-orange">Workers AI</div>
							<p class="mt-1 text-sm text-white/60">Content moderation via Llama 3.2 Vision.</p>
						</a>
						<a href="https://developers.cloudflare.com/workflows/" target="_blank" rel="noopener" class="rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/30 transition p-5">
							<div class="text-sm font-semibold text-cf-orange">Workflows</div>
							<p class="mt-1 text-sm text-white/60">Durable 4-step caricature pipeline.</p>
						</a>
						<a href="https://developers.cloudflare.com/durable-objects/" target="_blank" rel="noopener" class="rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/30 transition p-5">
							<div class="text-sm font-semibold text-cf-orange">Durable Objects</div>
							<p class="mt-1 text-sm text-white/60">Per-session WebSocket state machine.</p>
						</a>
						<a href="https://developers.cloudflare.com/d1/" target="_blank" rel="noopener" class="rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/30 transition p-5">
							<div class="text-sm font-semibold text-cf-orange">D1</div>
							<p class="mt-1 text-sm text-white/60">SQLite database for sessions, events, and scenes.</p>
						</a>
						<a href="https://developers.cloudflare.com/r2/" target="_blank" rel="noopener" class="rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/30 transition p-5">
							<div class="text-sm font-semibold text-cf-orange">R2</div>
							<p class="mt-1 text-sm text-white/60">Object storage for selfies, caricatures, and postcards.</p>
						</a>
						<a href="https://developers.cloudflare.com/kv/" target="_blank" rel="noopener" class="rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/30 transition p-5">
							<div class="text-sm font-semibold text-cf-orange">KV</div>
							<p class="mt-1 text-sm text-white/60">Event and scene config cache.</p>
						</a>
						<a href="https://developers.cloudflare.com/images/" target="_blank" rel="noopener" class="rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/30 transition p-5">
							<div class="text-sm font-semibold text-cf-orange">Cloudflare Images</div>
							<p class="mt-1 text-sm text-white/60">Postcard compositing and watermark overlays.</p>
						</a>
						<a href="https://developers.cloudflare.com/analytics/analytics-engine/" target="_blank" rel="noopener" class="rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/30 transition p-5">
							<div class="text-sm font-semibold text-cf-orange">Analytics Engine</div>
							<p class="mt-1 text-sm text-white/60">Event telemetry and metrics.</p>
						</a>
						<a href="https://developers.cloudflare.com/email-routing/" target="_blank" rel="noopener" class="rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/30 transition p-5">
							<div class="text-sm font-semibold text-cf-orange">Email Sending</div>
							<p class="mt-1 text-sm text-white/60">Digital postcard delivery.</p>
						</a>
					</div>
				</section>

				<!-- Active events -->
				<section class="max-w-4xl mx-auto mt-20 sm:mt-24">
					<h2 class="text-center text-xs uppercase tracking-[0.3em] text-white/40 mb-8">
						${activeEvents.length > 0 ? 'Active events' : 'Events'}
					</h2>
					<div class="flex flex-col gap-4 max-w-2xl mx-auto">${eventCards}</div>
				</section>
			</main>

			<footer class="px-6 sm:px-8 pb-10 text-center text-[11px] uppercase tracking-[0.25em] text-white/30">
				Built end-to-end on Cloudflare
			</footer>`,
		),
	);
});

export { app as rootRoutes };
