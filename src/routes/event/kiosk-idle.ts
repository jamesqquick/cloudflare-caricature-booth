import { Hono } from 'hono';
import type { EventEnv } from '../../lib/types';
import { kioskPage, escapeAttr } from '../../lib/html';

const app = new Hono<EventEnv>();

/**
 * Idle / landing screen. Shown to passersby when no one is using the booth.
 * GET /kiosk
 */
app.get('/kiosk', async (c) => {
	const { event, scenes } = c.get('eventCtx');
	const basePath = c.get('basePath');
	const origin = new URL(c.req.url).origin;
	const qrTarget = `${origin}${basePath}/kiosk`;
	const qrSrc = `${basePath}/api/kiosk/qr?url=${encodeURIComponent(qrTarget)}`;
	const sceneGridColumns = scenes.length === 1 ? 'grid-cols-1' : 'grid-cols-2';

	if (scenes.length === 0) {
		return c.html(
			kioskPage(
				`${event.name} — Scenes unavailable`,
				`<main class="min-h-[100dvh] w-full flex flex-col items-center justify-center px-8 text-center">
					<div class="text-2xl font-semibold text-red-300">Scenes unavailable</div>
					<p class="mt-3 text-sm text-white/60 max-w-md">No active scenes found for this event. Please ask a booth attendant for help.</p>
				</main>`,
			),
			500,
		);
	}

	const cards = scenes
		.map(
			(s) => `<button type="button"
				data-scene-id="${escapeAttr(s.id)}"
				data-scene-name="${escapeAttr(s.name)}"
				data-scene-emoji="${escapeAttr(s.emoji)}"
				aria-pressed="false"
				class="scene-card group relative flex min-h-36 flex-col items-start rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:border-white/30 hover:bg-white/[0.08] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-cf-orange sm:min-h-40 sm:p-5">
				<div class="text-4xl sm:text-5xl leading-none mb-2 sm:mb-3" aria-hidden="true">${escapeAttr(s.emoji)}</div>
				<div class="text-base sm:text-lg font-semibold leading-tight">${escapeAttr(s.name)}</div>
				<div class="mt-1 text-xs sm:text-sm text-white/60 leading-snug line-clamp-2">${escapeAttr(s.description)}</div>
			</button>`,
		)
		.join('\n');

	return c.html(
		kioskPage(
			`${event.name} — Start`,
			`			<div class="flex justify-center pt-4 sm:fixed sm:top-4 sm:left-4 sm:z-50 sm:pt-0 sm:block">
				<img src="${qrSrc}" alt="QR code — scan to start"
					class="w-20 sm:w-24 rounded-xl border border-white/10 bg-white p-1.5" />
			</div>
			<main class="min-h-[100dvh] w-full flex flex-col pt-4 sm:pt-8">
				<section class="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 text-center">
					<h1 class="text-[clamp(2rem,6vw,3.5rem)] font-bold leading-tight text-balance">
						AI Caricature Booth
					</h1>
					<p class="mt-3 max-w-md text-base sm:text-lg text-white/70 text-balance">
						${escapeAttr(event.tagline)}
					</p>

					<div class="mt-6 sm:mt-8 w-full max-w-2xl">
						<div id="scene-grid" class="grid ${sceneGridColumns} gap-3 sm:gap-4">
							${cards}
						</div>
					</div>

					<button id="kiosk-start" type="button" disabled
						class="mt-7 inline-flex items-center justify-center rounded-full bg-cf-orange px-14 py-5 text-xl sm:px-16 sm:py-6 sm:text-2xl font-bold text-black shadow-[0_0_60px_rgba(246,130,31,0.45)] transition hover:bg-cf-orange-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none">
						Start
					</button>
				</section>
			</main>
			<script>
			(function () {
				const basePath = ${JSON.stringify(basePath)};
				const eventId = ${JSON.stringify(event.id)};
				const grid = document.getElementById("scene-grid");
				const startBtn = document.getElementById("kiosk-start");
				let selectedScene = null;

				sessionStorage.removeItem("kiosk:scene");
				sessionStorage.removeItem("kiosk:selfie");

				grid.addEventListener("click", function (event) {
					const card = event.target.closest(".scene-card");
					if (!card) return;
					selectedScene = {
						eventId: eventId,
						sceneId: card.getAttribute("data-scene-id"),
						sceneName: card.getAttribute("data-scene-name"),
						sceneEmoji: card.getAttribute("data-scene-emoji") || "",
						sceneChosenAt: Date.now(),
					};
					grid.querySelectorAll(".scene-card").forEach(function (button) {
						const active = button === card;
						button.setAttribute("aria-pressed", active ? "true" : "false");
						button.classList.toggle("border-cf-orange", active);
						button.classList.toggle("bg-cf-orange/10", active);
						button.classList.toggle("ring-2", active);
						button.classList.toggle("ring-cf-orange", active);
					});
					sessionStorage.setItem("kiosk:scene", JSON.stringify(selectedScene));
					startBtn.disabled = false;
				});

				startBtn.addEventListener("click", function () {
					if (!selectedScene || !selectedScene.sceneId) return;
					window.location.href = basePath + "/kiosk/capture";
				});
			})();
			</script>`,
		),
	);
});

export { app as kioskIdleRoutes };
