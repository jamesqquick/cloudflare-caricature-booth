/**
 * Shared fullscreen confirmation dialog for destructive admin actions.
 *
 * Replaces the browser's native `window.confirm()` with a styled, accessible
 * modal that matches the admin look-and-feel. Inject `confirmDialogFragment()`
 * once into a page body, then call the global it defines:
 *
 *   const ok = await window.confirmDialog({
 *     title: "Delete session?",
 *     message: "This cannot be undone.",
 *     confirmLabel: "Delete",
 *   });
 *   if (!ok) return;
 *
 * The fragment is self-contained (markup + script) and is safe to include on
 * any page. The global is defined only once even if injected more than once.
 */
export function confirmDialogFragment(): string {
	return `
			<!-- Shared confirmation dialog (replaces native confirm()) -->
			<div id="confirm-dialog-root" class="fixed inset-0 z-[100] hidden items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message">
				<div data-confirm-backdrop class="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
				<div class="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-cf-ink p-6 shadow-2xl">
					<div class="flex items-start gap-4">
						<div class="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-400">
							<svg class="size-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
						</div>
						<div class="min-w-0 flex-1">
							<h2 id="confirm-dialog-title" class="text-lg font-bold text-white">Are you sure?</h2>
							<p id="confirm-dialog-message" class="mt-2 whitespace-pre-line text-sm leading-relaxed text-white/60"></p>
						</div>
					</div>
					<div class="mt-6 flex justify-end gap-3">
						<button type="button" data-confirm-cancel class="cursor-pointer rounded-full px-5 py-2.5 text-sm font-semibold text-white/70 transition hover:bg-white/5 hover:text-white">Cancel</button>
						<button type="button" data-confirm-ok class="cursor-pointer rounded-full bg-red-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600">Delete</button>
					</div>
				</div>
			</div>
			<script>
			(function () {
				if (window.confirmDialog) return;
				var root = document.getElementById("confirm-dialog-root");
				if (!root) return;
				var titleEl = document.getElementById("confirm-dialog-title");
				var msgEl = document.getElementById("confirm-dialog-message");
				var okBtn = root.querySelector("[data-confirm-ok]");
				var cancelBtn = root.querySelector("[data-confirm-cancel]");
				var backdrop = root.querySelector("[data-confirm-backdrop]");
				var resolver = null;
				var lastFocused = null;

				function settle(result) {
					if (!resolver) return;
					var done = resolver;
					resolver = null;
					root.classList.add("hidden");
					root.classList.remove("flex");
					document.removeEventListener("keydown", onKeydown, true);
					if (lastFocused && lastFocused.focus) { try { lastFocused.focus(); } catch (e) {} }
					done(result);
				}

				function onKeydown(ev) {
					if (ev.key === "Escape") { ev.preventDefault(); settle(false); return; }
					if (ev.key === "Tab") {
						// Trap focus between the two buttons.
						var order = [cancelBtn, okBtn];
						var idx = order.indexOf(document.activeElement);
						ev.preventDefault();
						var next = ev.shiftKey
							? (idx <= 0 ? order[order.length - 1] : order[idx - 1])
							: (idx === order.length - 1 ? order[0] : order[idx + 1]);
						next.focus();
					}
				}

				okBtn.addEventListener("click", function () { settle(true); });
				cancelBtn.addEventListener("click", function () { settle(false); });
				backdrop.addEventListener("click", function () { settle(false); });

				window.confirmDialog = function (opts) {
					opts = opts || {};
					return new Promise(function (resolve) {
						// If a dialog is already open, cancel it first.
						if (resolver) settle(false);
						resolver = resolve;
						lastFocused = document.activeElement;
						titleEl.textContent = opts.title || "Are you sure?";
						msgEl.textContent = opts.message || "";
						okBtn.textContent = opts.confirmLabel || "Delete";
						root.classList.remove("hidden");
						root.classList.add("flex");
						document.addEventListener("keydown", onKeydown, true);
						cancelBtn.focus();
					});
				};
			})();
			</script>`;
}
