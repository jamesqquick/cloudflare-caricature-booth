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

				<!-- Animated pipeline -->
				<section class="max-w-4xl mx-auto mt-20 sm:mt-28">
					<h2 class="text-center text-xs uppercase tracking-[0.3em] text-white/40 mb-10">
						Under the hood
					</h2>

					<style>
						@keyframes pipe-glow {
							0%, 14% { opacity: 1; border-color: rgba(246,130,31,0.6); background: rgba(246,130,31,0.08); box-shadow: 0 0 30px rgba(246,130,31,0.12); }
							18%, 100% { opacity: 0.45; border-color: rgba(255,255,255,0.1); background: rgba(255,255,255,0.02); box-shadow: none; }
						}
						@keyframes pipe-icon-pop {
							0%, 14% { transform: scale(1.18); }
							18%, 100% { transform: scale(1); }
						}
						.pipe-card { animation: pipe-glow 9s infinite; transition: all 0.4s ease; }
						.pipe-card .pipe-icon { animation: pipe-icon-pop 9s infinite; transition: transform 0.4s ease; }
						.pipe-card:nth-child(1), .pipe-card:nth-child(1) .pipe-icon { animation-delay: 0s; }
						.pipe-card:nth-child(2), .pipe-card:nth-child(2) .pipe-icon { animation-delay: 1.5s; }
						.pipe-card:nth-child(3), .pipe-card:nth-child(3) .pipe-icon { animation-delay: 3s; }
						.pipe-card:nth-child(4), .pipe-card:nth-child(4) .pipe-icon { animation-delay: 4.5s; }
						.pipe-card:nth-child(5), .pipe-card:nth-child(5) .pipe-icon { animation-delay: 6s; }
						.pipe-card:nth-child(6), .pipe-card:nth-child(6) .pipe-icon { animation-delay: 7.5s; }
					</style>

					<div class="grid sm:grid-cols-3 gap-4 sm:gap-6">
						<div class="pipe-card rounded-2xl border border-white/10 bg-white/[0.02] p-6">
							<div class="flex items-center gap-3 mb-3">
								<div class="pipe-icon text-2xl">📸</div>
								<div class="text-cf-orange font-mono text-xs tracking-widest">STEP 01</div>
							</div>
							<div class="text-lg font-semibold">Upload</div>
							<p class="mt-2 text-sm text-white/60">Selfie captured and uploaded to <span class="text-cf-orange font-semibold">R2</span> object storage.</p>
						</div>
						<div class="pipe-card rounded-2xl border border-white/10 bg-white/[0.02] p-6">
							<div class="flex items-center gap-3 mb-3">
								<div class="pipe-icon text-2xl">🛡️</div>
								<div class="text-cf-orange font-mono text-xs tracking-widest">STEP 02</div>
							</div>
							<div class="text-lg font-semibold">Moderate</div>
							<p class="mt-2 text-sm text-white/60">Photo screened for safety by <span class="text-cf-orange font-semibold">Workers AI</span> using Llama 3.2 Vision.</p>
						</div>
						<div class="pipe-card rounded-2xl border border-white/10 bg-white/[0.02] p-6">
							<div class="flex items-center gap-3 mb-3">
								<div class="pipe-icon text-2xl">🎨</div>
								<div class="text-cf-orange font-mono text-xs tracking-widest">STEP 03</div>
							</div>
							<div class="text-lg font-semibold">Generate</div>
							<p class="mt-2 text-sm text-white/60">Caricature created through a durable <span class="text-cf-orange font-semibold">Workflows</span> pipeline.</p>
						</div>
						<div class="pipe-card rounded-2xl border border-white/10 bg-white/[0.02] p-6">
							<div class="flex items-center gap-3 mb-3">
								<div class="pipe-icon text-2xl">🖼️</div>
								<div class="text-cf-orange font-mono text-xs tracking-widest">STEP 04</div>
							</div>
							<div class="text-lg font-semibold">Composite</div>
							<p class="mt-2 text-sm text-white/60">Print-ready postcard assembled with <span class="text-cf-orange font-semibold">Cloudflare Images</span>.</p>
						</div>
						<div class="pipe-card rounded-2xl border border-white/10 bg-white/[0.02] p-6">
							<div class="flex items-center gap-3 mb-3">
								<div class="pipe-icon text-2xl">💾</div>
								<div class="text-cf-orange font-mono text-xs tracking-widest">STEP 05</div>
							</div>
							<div class="text-lg font-semibold">Store</div>
							<p class="mt-2 text-sm text-white/60">Session saved to <span class="text-cf-orange font-semibold">D1</span> and images persisted to <span class="text-cf-orange font-semibold">R2</span>.</p>
						</div>
						<div class="pipe-card rounded-2xl border border-white/10 bg-white/[0.02] p-6">
							<div class="flex items-center gap-3 mb-3">
								<div class="pipe-icon text-2xl">🖨️</div>
								<div class="text-cf-orange font-mono text-xs tracking-widest">STEP 06</div>
							</div>
							<div class="text-lg font-semibold">Deliver</div>
							<p class="mt-2 text-sm text-white/60">Postcard printed on-site and digital copy sent via <span class="text-cf-orange font-semibold">Email</span>.</p>
						</div>
					</div>

					<p class="text-center text-xs text-white/30 mt-8">
						The full pipeline runs in ~30–90 seconds with real-time status via <span class="text-white/50">Durable Objects</span> + WebSockets.
					</p>
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
							<div class="flex items-center gap-1.5 text-sm font-semibold text-cf-orange">Workers <svg class="w-3 h-3 opacity-50" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3.5 1.5h7m0 0v7m0-7L1.5 10.5"/></svg></div>
							<p class="mt-1 text-sm text-white/60">Runtime for the entire application.</p>
						</a>
						<a href="https://developers.cloudflare.com/workers-ai/" target="_blank" rel="noopener" class="rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/30 transition p-5">
							<div class="flex items-center gap-1.5 text-sm font-semibold text-cf-orange">Workers AI <svg class="w-3 h-3 opacity-50" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3.5 1.5h7m0 0v7m0-7L1.5 10.5"/></svg></div>
							<p class="mt-1 text-sm text-white/60">Content moderation via Llama 3.2 Vision.</p>
						</a>
						<a href="https://developers.cloudflare.com/workflows/" target="_blank" rel="noopener" class="rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/30 transition p-5">
							<div class="flex items-center gap-1.5 text-sm font-semibold text-cf-orange">Workflows <svg class="w-3 h-3 opacity-50" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3.5 1.5h7m0 0v7m0-7L1.5 10.5"/></svg></div>
							<p class="mt-1 text-sm text-white/60">Durable 4-step caricature pipeline.</p>
						</a>
						<a href="https://developers.cloudflare.com/durable-objects/" target="_blank" rel="noopener" class="rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/30 transition p-5">
							<div class="flex items-center gap-1.5 text-sm font-semibold text-cf-orange">Durable Objects <svg class="w-3 h-3 opacity-50" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3.5 1.5h7m0 0v7m0-7L1.5 10.5"/></svg></div>
							<p class="mt-1 text-sm text-white/60">Per-session WebSocket state machine.</p>
						</a>
						<a href="https://developers.cloudflare.com/d1/" target="_blank" rel="noopener" class="rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/30 transition p-5">
							<div class="flex items-center gap-1.5 text-sm font-semibold text-cf-orange">D1 <svg class="w-3 h-3 opacity-50" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3.5 1.5h7m0 0v7m0-7L1.5 10.5"/></svg></div>
							<p class="mt-1 text-sm text-white/60">SQLite database for sessions, events, and scenes.</p>
						</a>
						<a href="https://developers.cloudflare.com/r2/" target="_blank" rel="noopener" class="rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/30 transition p-5">
							<div class="flex items-center gap-1.5 text-sm font-semibold text-cf-orange">R2 <svg class="w-3 h-3 opacity-50" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3.5 1.5h7m0 0v7m0-7L1.5 10.5"/></svg></div>
							<p class="mt-1 text-sm text-white/60">Object storage for selfies, caricatures, and postcards.</p>
						</a>
						<a href="https://developers.cloudflare.com/kv/" target="_blank" rel="noopener" class="rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/30 transition p-5">
							<div class="flex items-center gap-1.5 text-sm font-semibold text-cf-orange">KV <svg class="w-3 h-3 opacity-50" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3.5 1.5h7m0 0v7m0-7L1.5 10.5"/></svg></div>
							<p class="mt-1 text-sm text-white/60">Event and scene config cache.</p>
						</a>
						<a href="https://developers.cloudflare.com/images/" target="_blank" rel="noopener" class="rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/30 transition p-5">
							<div class="flex items-center gap-1.5 text-sm font-semibold text-cf-orange">Cloudflare Images <svg class="w-3 h-3 opacity-50" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3.5 1.5h7m0 0v7m0-7L1.5 10.5"/></svg></div>
							<p class="mt-1 text-sm text-white/60">Postcard compositing and watermark overlays.</p>
						</a>
						<a href="https://developers.cloudflare.com/analytics/analytics-engine/" target="_blank" rel="noopener" class="rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/30 transition p-5">
							<div class="flex items-center gap-1.5 text-sm font-semibold text-cf-orange">Analytics Engine <svg class="w-3 h-3 opacity-50" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3.5 1.5h7m0 0v7m0-7L1.5 10.5"/></svg></div>
							<p class="mt-1 text-sm text-white/60">Event telemetry and metrics.</p>
						</a>
						<a href="https://developers.cloudflare.com/email-routing/" target="_blank" rel="noopener" class="rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/30 transition p-5">
							<div class="flex items-center gap-1.5 text-sm font-semibold text-cf-orange">Email Sending <svg class="w-3 h-3 opacity-50" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3.5 1.5h7m0 0v7m0-7L1.5 10.5"/></svg></div>
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
