/**
 * Kiosk idle-detection dialog.
 *
 * Shows a fullscreen "Are you still here?" overlay with a visible countdown.
 * Designed for the kiosk done page to automatically return to the idle screen
 * when nobody is interacting with the booth.
 *
 * Inject `idleDialogFragment()` once into a kiosk page body, then call:
 *
 *   window.kioskIdleDialog.show({
 *     seconds: 15,
 *     onDone: function () { ... },   // user tapped "I'm done" or countdown hit 0
 *     onStay: function () { ... },   // user tapped "Not yet", backdrop, or Escape
 *   });
 *
 *   window.kioskIdleDialog.hide();    // programmatic dismiss (e.g. "Start over")
 *
 * The fragment is self-contained (markup + script) and safe to include on any
 * kiosk page.
 */
export function idleDialogFragment(): string {
	return `
		<!-- Kiosk idle-detection dialog -->
		<div id="idle-dialog-root" class="fixed inset-0 z-[100] hidden items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="idle-dialog-title" aria-describedby="idle-dialog-message">
			<div data-idle-backdrop class="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
			<div class="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-cf-ink p-6 shadow-2xl">
				<div class="flex flex-col items-center text-center gap-4">
					<div class="flex size-14 shrink-0 items-center justify-center rounded-full bg-cf-orange/15 text-cf-orange">
						<svg class="size-7" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
					</div>
					<div>
						<h2 id="idle-dialog-title" class="text-2xl font-bold text-white">Are you still here?</h2>
						<p id="idle-dialog-message" class="mt-2 text-base leading-relaxed text-white/60">We'll redirect back to the kiosk in <span id="idle-countdown" class="font-bold text-white tabular-nums">15</span> seconds.</p>
					</div>
					<div class="flex w-full gap-3 mt-2">
						<button type="button" data-idle-stay class="cursor-pointer flex-1 rounded-full border border-white/20 bg-white/5 px-5 py-3 text-base font-semibold text-white/80 transition hover:bg-white/10 hover:text-white">Not yet</button>
						<button type="button" data-idle-done class="cursor-pointer flex-1 rounded-full bg-cf-orange px-5 py-3 text-base font-bold text-black transition hover:bg-cf-orange-dark">I'm done</button>
					</div>
				</div>
			</div>
		</div>
		<script>
		(function () {
			if (window.kioskIdleDialog) return;
			var root = document.getElementById("idle-dialog-root");
			if (!root) return;
			var countdownEl = document.getElementById("idle-countdown");
			var doneBtn = root.querySelector("[data-idle-done]");
			var stayBtn = root.querySelector("[data-idle-stay]");
			var backdrop = root.querySelector("[data-idle-backdrop]");

			var timer = null;
			var opts = null;

			function settle(action) {
				clearInterval(timer);
				timer = null;
				root.classList.add("hidden");
				root.classList.remove("flex");
				document.removeEventListener("keydown", onKeydown, true);
				var cb = opts ? opts[action] : null;
				opts = null;
				if (typeof cb === "function") cb();
			}

			function onKeydown(ev) {
				if (ev.key === "Escape") { ev.preventDefault(); settle("onStay"); return; }
				if (ev.key === "Tab") {
					var order = [stayBtn, doneBtn];
					var idx = order.indexOf(document.activeElement);
					ev.preventDefault();
					var next = ev.shiftKey
						? (idx <= 0 ? order[order.length - 1] : order[idx - 1])
						: (idx === order.length - 1 ? order[0] : order[idx + 1]);
					next.focus();
				}
			}

			doneBtn.addEventListener("click", function () { settle("onDone"); });
			stayBtn.addEventListener("click", function () { settle("onStay"); });
			backdrop.addEventListener("click", function () { settle("onStay"); });

			window.kioskIdleDialog = {
				show: function (o) {
					opts = o || {};
					var remaining = opts.seconds || 15;
					countdownEl.textContent = String(remaining);
					root.classList.remove("hidden");
					root.classList.add("flex");
					document.addEventListener("keydown", onKeydown, true);
					stayBtn.focus();

					timer = setInterval(function () {
						remaining -= 1;
						countdownEl.textContent = String(remaining);
						if (remaining <= 0) { settle("onDone"); }
					}, 1000);
				},
				hide: function () {
					if (timer) clearInterval(timer);
					timer = null;
					opts = null;
					root.classList.add("hidden");
					root.classList.remove("flex");
					document.removeEventListener("keydown", onKeydown, true);
				},
			};
		})();
		</script>`;
}
