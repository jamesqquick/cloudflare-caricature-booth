import { Hono } from 'hono';
import type { EventEnv } from '../../lib/types';
import { kioskPage } from '../../lib/html';

const app = new Hono<EventEnv>();

/**
 * Live camera capture screen (step 2 of 2).
 * GET /kiosk/capture
 */
app.get('/kiosk/capture', (c) => {
	const eventId = c.get('eventCtx').event.id;
	const basePath = c.get('basePath');
	return c.html(
		kioskPage(
			'Capture your selfie',
			`			<main id="capture-root" class="studio-shell">
				<div class="studio-topbar">
					<a href="${basePath}" class="studio-mobile-cancel">Cancel</a>
					<div class="studio-utilities">
						<button id="cap-mute" type="button" aria-label="Mute sounds" aria-pressed="false" class="studio-mute">
								<svg id="cap-sound-on-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
									<path d="M11 5 6 9H2v6h4l5 4V5Z"></path>
									<path d="M15.5 8.5a5 5 0 0 1 0 7"></path>
									<path d="M18.5 5.5a9 9 0 0 1 0 13"></path>
								</svg>
								<svg id="cap-muted-icon" class="hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
									<path d="M11 5 6 9H2v6h4l5 4V5Z"></path>
									<path d="m22 9-6 6"></path>
									<path d="m16 9 6 6"></path>
								</svg>
						</button>
					</div>
				</div>

				<section class="studio-stage" aria-label="Photo capture">
					<div class="studio-capture">
						<div class="studio-viewfinder">
							<video id="cap-video" class="absolute inset-0 h-full w-full object-cover -scale-x-100" playsinline muted autoplay></video>
							<img id="cap-preview" class="absolute inset-0 h-full w-full object-cover hidden -scale-x-100" alt="captured frame" />
							<div class="studio-guide-wrap" aria-hidden="true">
								<div class="studio-guide"></div>
							</div>
							<span class="studio-corner studio-corner-top" aria-hidden="true"></span>
							<span class="studio-corner studio-corner-bottom" aria-hidden="true"></span>
							<div id="cap-flash" class="absolute inset-0 bg-white pointer-events-none z-20 opacity-0 hidden"></div>
							<div id="cap-countdown" class="absolute inset-0 hidden flex items-center justify-center pointer-events-none z-10">
								<span id="cap-countdown-num" class="text-[10rem] sm:text-[12rem] font-black text-white drop-shadow-[0_0_40px_rgba(255,255,255,0.5)] leading-none countdown-pop"></span>
							</div>
							<div id="cap-overlay" class="absolute inset-0 flex flex-col items-center justify-center text-center px-6 bg-black/70 backdrop-blur">
								<div class="text-xl font-semibold">Starting camera…</div>
								<p class="mt-2 text-sm text-white/60">If you see a permissions prompt, tap Allow.</p>
							</div>
						</div>

						<div class="studio-controls">
							<p id="cap-hint" class="sr-only">Ready to take photo.</p>
							<div id="cap-shutter-row" class="studio-shutter-row flex">
								<button id="cap-shutter" type="button" disabled class="studio-shutter">
									<span class="sr-only">Take photo</span>
								</button>
								<span class="studio-shutter-label">Take photo</span>
							</div>
							<div id="cap-confirm-row" class="studio-confirm hidden flex-col">
								<button id="cap-use" type="button" class="studio-use">Generate</button>
								<button id="cap-retake" type="button" class="studio-retake">Retake</button>
							</div>
							<p id="cap-status" class="studio-status" aria-live="polite"></p>
						</div>
					</div>
				</section>
			</main>

			<style>
			#capture-root {
				--studio-ink: oklch(16% 0.012 55);
				--studio-panel: oklch(20% 0.014 55);
				--studio-paper: oklch(96% 0.012 70);
				--studio-muted: oklch(72% 0.012 70);
				--studio-orange: oklch(72% 0.19 52);
				background: var(--studio-ink);
				color: var(--studio-paper);
				height: 100dvh;
				min-height: 100dvh;
				overflow: hidden;
				position: relative;
			}
			.studio-topbar {
				align-items: center;
				display: flex;
				gap: 0.5rem;
				justify-content: space-between;
				left: 0;
				padding: max(1rem, env(safe-area-inset-top)) 1.25rem 0;
				position: absolute;
				right: 0;
				top: 0;
				z-index: 30;
			}
			.studio-utilities { align-items: center; display: flex; gap: 0.7rem; margin-left: auto; }
			.studio-qr { background: var(--studio-paper); border-radius: 0.65rem; padding: 0.3rem; width: 3.25rem; }
			.studio-mobile-cancel { display: none; }
			.studio-mute {
				align-items: center;
				background: oklch(96% 0.012 70 / 0.05);
				border: 1px solid oklch(96% 0.012 70 / 0.15);
				border-radius: 50%;
				color: var(--studio-muted);
				cursor: pointer;
				display: flex;
				height: 2.75rem;
				justify-content: center;
				transition: background-color 180ms ease, border-color 180ms ease, color 180ms ease, transform 180ms ease;
				width: 2.75rem;
			}
			.studio-mute svg { height: 1.25rem; width: 1.25rem; }
			.studio-mute:active { transform: scale(0.95); }
			.studio-mute.is-muted { background: oklch(72% 0.19 52 / 0.15); border-color: oklch(72% 0.19 52 / 0.5); color: var(--studio-orange); }
			.studio-stage { display: grid; height: 100%; min-width: 0; padding: clamp(1.25rem, 3vw, 2.75rem); place-items: center; }
			.studio-capture {
				align-items: center;
				display: flex;
				flex-direction: column;
				gap: 1rem;
				max-width: 38rem;
				width: 100%;
			}
			.studio-viewfinder {
				aspect-ratio: 4 / 5;
				background: var(--studio-panel);
				border-radius: 2.15rem;
				box-shadow: 0 2.2rem 5.5rem oklch(5% 0.01 55 / 0.6);
				height: min(calc(100dvh - 17rem), 42.5rem);
				max-width: 100%;
				overflow: hidden;
				position: relative;
				width: auto;
			}
			.studio-guide-wrap { align-items: center; display: flex; inset: 0; justify-content: center; pointer-events: none; position: absolute; }
			.studio-guide {
				border: 2px solid oklch(96% 0.012 70 / 0.7);
				border-radius: 48% 48% 44% 44%;
				height: 68%;
				width: 70%;
			}
			.studio-corner { border-color: var(--studio-orange); border-style: solid; height: 2rem; position: absolute; width: 2rem; }
			.studio-corner-top { border-width: 3px 0 0 3px; left: 1.4rem; top: 1.4rem; }
			.studio-corner-bottom { border-width: 0 3px 3px 0; bottom: 1.4rem; right: 1.4rem; }
			.studio-controls { align-items: center; display: flex; flex-direction: column; text-align: center; width: min(100%, 34rem); }
			.studio-shutter-row { align-items: center; flex-direction: column; }
			.studio-shutter {
				background: var(--studio-orange);
				border: 7px solid var(--studio-paper);
				border-radius: 50%;
				box-shadow: 0 0 0 7px oklch(96% 0.012 70 / 0.13), 0 1.1rem 2.8rem oklch(5% 0.01 55 / 0.45);
				cursor: pointer;
				height: clamp(5rem, 9vw, 6.5rem);
				margin: 1.5rem 0 1rem;
				transition: opacity 180ms ease, transform 180ms ease, box-shadow 180ms ease;
				width: clamp(5rem, 9vw, 6.5rem);
			}
			.studio-shutter:active { transform: scale(0.95); }
			.studio-shutter:disabled { box-shadow: none; cursor: wait; opacity: 0.4; }
			.studio-shutter-label { font-size: 0.72rem; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; }
			.studio-confirm { gap: 0.75rem; margin-top: 1.25rem; width: 100%; }
			.studio-use, .studio-retake {
				border-radius: 999px;
				cursor: pointer;
				font-weight: 750;
				min-height: 3.25rem;
				padding: 0.75rem 1.25rem;
				transition: background-color 180ms ease, border-color 180ms ease, filter 180ms ease, opacity 180ms ease, transform 180ms ease;
			}
			.studio-use { background: var(--studio-orange); color: var(--studio-ink); }
			.studio-retake { border: 1px solid oklch(96% 0.012 70 / 0.3); color: var(--studio-paper); }
			.studio-use:active, .studio-retake:active { transform: scale(0.98); }
			.studio-use:disabled, .studio-retake:disabled { cursor: wait; opacity: 0.55; }
			.studio-status { color: var(--studio-muted); font-size: 0.72rem; line-height: 1rem; margin-top: 0.75rem; min-height: 1rem; }
			#capture-root button:focus-visible, #capture-root a:focus-visible { outline: 3px solid var(--studio-orange); outline-offset: 4px; }
			@media (hover: hover) {
				.studio-shutter:not(:disabled):hover, .studio-use:not(:disabled):hover { filter: brightness(1.08); }
				.studio-retake:not(:disabled):hover { background: oklch(96% 0.012 70 / 0.08); border-color: oklch(96% 0.012 70 / 0.55); }
				.studio-mute:hover { background: oklch(96% 0.012 70 / 0.1); border-color: oklch(96% 0.012 70 / 0.3); color: var(--studio-paper); }
				.studio-mute.is-muted:hover { background: oklch(72% 0.19 52 / 0.22); border-color: var(--studio-orange); color: var(--studio-orange); }
			}

			@media (max-width: 879px) {
				.studio-mobile-cancel { align-items: center; color: var(--studio-muted); display: inline-flex; font-size: 0.78rem; min-height: 2.75rem; }
				.studio-stage { min-height: 0; padding: 5rem 1rem max(0.75rem, env(safe-area-inset-bottom)); }
				.studio-capture { display: flex; flex-direction: column; gap: 0.75rem; height: 100%; }
				.studio-viewfinder { flex: 1; height: auto; max-height: calc(100dvh - 10.75rem); min-height: 0; width: min(100%, 29rem); }
				.studio-controls { width: min(100%, 29rem); }
				.studio-shutter { border-width: 6px; height: 4.65rem; margin: 0 0 0.45rem; width: 4.65rem; }
				.studio-confirm { flex-direction: row; margin-top: 0.5rem; }
				.studio-use, .studio-retake { flex: 1; }
				.studio-status { margin-top: 0.35rem; }
			}
			@media (max-width: 879px) and (orientation: landscape) {
				.studio-stage { padding-inline: 1.25rem; }
				.studio-viewfinder { max-height: calc(100dvh - 11.5rem); width: auto; }
				.studio-controls { width: 100%; }
				.studio-shutter { height: 4.8rem; width: 4.8rem; }
			}
			@keyframes countdown-pop {
				0% { transform: scale(0.5); opacity: 0; }
				20% { transform: scale(1.15); opacity: 1; }
				40% { transform: scale(1); }
				80% { opacity: 1; }
				100% { opacity: 0.3; }
			}
			.countdown-pop { animation: countdown-pop 0.9s ease-out both; }
			@keyframes shutter-flash {
				0% { opacity: 0.95; }
				100% { opacity: 0; }
			}
			.shutter-flash { animation: shutter-flash 0.35s ease-out both; }
			</style>

			<script>
			(function () {
				const basePath = ${JSON.stringify(basePath)};
				const eventId = ${JSON.stringify(eventId)};
				let selectedScene;
				try {
					selectedScene = JSON.parse(sessionStorage.getItem("kiosk:scene") || "null");
					if (!selectedScene || selectedScene.eventId !== eventId || !selectedScene.sceneId) throw new Error("incomplete payload");
				} catch (err) {
					console.error("bad kiosk:scene payload:", err);
					sessionStorage.removeItem("kiosk:scene");
					window.location.replace(basePath);
					return;
				}
				const video = document.getElementById("cap-video");
				const preview = document.getElementById("cap-preview");
				const overlay = document.getElementById("cap-overlay");
				const hint = document.getElementById("cap-hint");
				const shutter = document.getElementById("cap-shutter");
				const shutterRow = document.getElementById("cap-shutter-row");
				const confirmRow = document.getElementById("cap-confirm-row");
				const useBtn = document.getElementById("cap-use");
				const retakeBtn = document.getElementById("cap-retake");
				const statusEl = document.getElementById("cap-status");
				const muteBtn = document.getElementById("cap-mute");
				const soundOnIcon = document.getElementById("cap-sound-on-icon");
				const mutedIcon = document.getElementById("cap-muted-icon");

				let stream = null;
				let capturedBlob = null;
				let capturedUrl = null;
				let uploadedSelfie = null;
				let countdownTimer = null;
				const countdownEl = document.getElementById("cap-countdown");
				const countdownNum = document.getElementById("cap-countdown-num");
				const flashEl = document.getElementById("cap-flash");

				// ── Audio ──
				var muteStorageKey = "kiosk:capture-muted";
				var isMuted = false;
				try { isMuted = localStorage.getItem(muteStorageKey) === "true"; } catch (e) {}

				function renderMuteState() {
					muteBtn.setAttribute("aria-label", isMuted ? "Unmute sounds" : "Mute sounds");
					muteBtn.setAttribute("aria-pressed", String(isMuted));
					soundOnIcon.classList.toggle("hidden", isMuted);
					mutedIcon.classList.toggle("hidden", !isMuted);
					muteBtn.classList.toggle("is-muted", isMuted);
				}

				muteBtn.addEventListener("click", function () {
					isMuted = !isMuted;
					try { localStorage.setItem(muteStorageKey, String(isMuted)); } catch (e) {}
					renderMuteState();
				});
				renderMuteState();

				var audioCtx = null;
				try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}

				function unlockAudio() {
					if (audioCtx && audioCtx.state === "suspended") {
						audioCtx.resume().catch(function () {});
					}
				}

				function playBeep(frequency, duration) {
					if (isMuted || !audioCtx) return;
					var osc = audioCtx.createOscillator();
					var gain = audioCtx.createGain();
					osc.connect(gain);
					gain.connect(audioCtx.destination);
					osc.frequency.value = frequency;
					gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
					gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
					osc.start();
					osc.stop(audioCtx.currentTime + duration);
				}

				function playShutterSound() {
					if (isMuted || !audioCtx) return;
					// Two-part shutter: sharp click + softer curtain close (SLR style)
					var now = audioCtx.currentTime;
					// Part 1: short sharp click
					var len1 = Math.floor(audioCtx.sampleRate * 0.025);
					var buf1 = audioCtx.createBuffer(1, len1, audioCtx.sampleRate);
					var d1 = buf1.getChannelData(0);
					for (var i = 0; i < len1; i++) {
						d1[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len1, 10);
					}
					var src1 = audioCtx.createBufferSource();
					src1.buffer = buf1;
					var filt1 = audioCtx.createBiquadFilter();
					filt1.type = "highpass";
					filt1.frequency.value = 2500;
					filt1.Q.value = 0.5;
					var gain1 = audioCtx.createGain();
					gain1.gain.setValueAtTime(0.7, now);
					src1.connect(filt1);
					filt1.connect(gain1);
					gain1.connect(audioCtx.destination);
					src1.start(now);
					// Part 2: softer curtain close
					var len2 = Math.floor(audioCtx.sampleRate * 0.06);
					var buf2 = audioCtx.createBuffer(1, len2, audioCtx.sampleRate);
					var d2 = buf2.getChannelData(0);
					for (var i = 0; i < len2; i++) {
						d2[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len2, 5);
					}
					var src2 = audioCtx.createBufferSource();
					src2.buffer = buf2;
					var filt2 = audioCtx.createBiquadFilter();
					filt2.type = "bandpass";
					filt2.frequency.value = 1800;
					filt2.Q.value = 0.8;
					var gain2 = audioCtx.createGain();
					gain2.gain.setValueAtTime(0.35, now + 0.04);
					src2.connect(filt2);
					filt2.connect(gain2);
					gain2.connect(audioCtx.destination);
					src2.start(now + 0.04);
				}

				function setOverlay(html) {
					if (html === null) {
						overlay.classList.add("hidden");
					} else {
						overlay.innerHTML = html;
						overlay.classList.remove("hidden");
					}
				}

				async function startCamera() {
					setOverlay(
						'<div class="size-12 rounded-full border-2 border-cf-orange/40 border-t-cf-orange animate-spin mb-4"></div>' +
						'<div class="text-xl font-semibold">Starting camera\u2026</div>' +
						'<p class="mt-2 text-sm text-white/60">If you see a permissions prompt, tap Allow.</p>'
					);
					if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
						setOverlay(
							'<div class="size-16 rounded-full border-2 border-red-400/30 bg-red-500/10 flex items-center justify-center text-2xl mb-4" aria-hidden="true">\u26a0\ufe0f</div>' +
							'<div class="text-xl font-semibold">Camera not supported</div>' +
							'<p class="mt-2 text-sm text-white/60 max-w-xs">This browser cannot access the camera. Try Safari on iPad or Chrome on desktop.</p>' +
							'<a href="' + basePath + '" class="mt-6 inline-flex items-center justify-center rounded-full bg-cf-orange px-8 py-3 text-base font-bold text-black hover:bg-cf-orange-dark active:scale-[0.98] transition">\u2190 Back to start</a>'
						);
						return;
					}
					try {
						stream = await navigator.mediaDevices.getUserMedia({
							video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } },
							audio: false,
						});
						video.srcObject = stream;
						await video.play().catch(function () {});
						setOverlay(null);
						shutter.disabled = false;
					} catch (err) {
						console.error("getUserMedia failed:", err);
						const denied = String(err && err.name) === "NotAllowedError";
						setOverlay(
							'<div class="size-16 rounded-full border-2 border-red-400/30 bg-red-500/10 flex items-center justify-center text-2xl mb-4" aria-hidden="true">' +
							(denied ? '\ud83d\udeab' : '\u26a0\ufe0f') + '</div>' +
							'<div class="text-xl font-semibold">' + (denied ? "Camera access blocked" : "Camera unavailable") + '</div>' +
							'<p class="mt-2 text-sm text-white/60 max-w-xs">' +
							(denied ? "We need camera access to take your selfie. Check your browser or device settings, then tap Retry." : "Make sure no other app is using the camera, then tap Retry.") +
							'</p>' +
							'<button id="cap-retry-perms" class="mt-6 inline-flex items-center justify-center rounded-full bg-cf-orange px-8 py-3 text-base font-bold text-black hover:bg-cf-orange-dark active:scale-[0.98] transition">Retry permissions</button>' +
							'<a href="' + basePath + '" class="mt-3 text-sm text-white/50 hover:text-white underline underline-offset-4">\u2190 Back to start</a>'
						);
						var retryPerms = document.getElementById("cap-retry-perms");
						if (retryPerms) retryPerms.addEventListener("click", function () { startCamera(); });
					}
				}

				function stopCamera() {
					if (stream) {
						stream.getTracks().forEach(function (t) { t.stop(); });
						stream = null;
					}
				}

				function cancelCountdown() {
					if (countdownTimer) {
						clearInterval(countdownTimer);
						countdownTimer = null;
					}
					countdownEl.classList.add("hidden");
					countdownEl.classList.remove("flex");
				}

				function startCountdown() {
					shutter.disabled = true;
					hint.textContent = "Get ready!";
					unlockAudio();
					var count = 3;

					countdownNum.textContent = count;
					countdownEl.classList.remove("hidden");
					countdownEl.classList.add("flex");
					// Re-trigger animation
					countdownNum.style.animation = "none";
					void countdownNum.offsetWidth;
					countdownNum.style.animation = "";
					playBeep(880, 0.15);

					countdownTimer = setInterval(function () {
						count--;
						if (count > 0) {
							countdownNum.textContent = count;
							// Re-trigger pop animation
							countdownNum.style.animation = "none";
							void countdownNum.offsetWidth;
							countdownNum.style.animation = "";
							playBeep(count === 1 ? 1200 : 880, 0.15);
						} else {
							clearInterval(countdownTimer);
							countdownTimer = null;
							countdownEl.classList.add("hidden");
							countdownEl.classList.remove("flex");
							takePhoto();
						}
					}, 1000);
				}

				function takePhoto() {
					if (!video.videoWidth) return;
					playShutterSound();
					// Flash the screen
					flashEl.classList.remove("hidden", "shutter-flash");
					void flashEl.offsetWidth;
					flashEl.classList.add("shutter-flash");
					flashEl.addEventListener("animationend", function () {
						flashEl.classList.add("hidden");
						flashEl.classList.remove("shutter-flash");
					}, { once: true });
					const canvas = document.createElement("canvas");
					canvas.width = video.videoWidth;
					canvas.height = video.videoHeight;
					const ctx = canvas.getContext("2d");
					ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
					canvas.toBlob(function (blob) {
						if (!blob) { statusEl.textContent = "✗ Failed to capture frame."; return; }
						capturedBlob = blob;
						if (capturedUrl) URL.revokeObjectURL(capturedUrl);
						capturedUrl = URL.createObjectURL(blob);
						preview.src = capturedUrl;
						preview.classList.remove("hidden");
						video.classList.add("hidden");
						stopCamera();
						shutterRow.classList.add("hidden");
						confirmRow.classList.remove("hidden");
						confirmRow.classList.add("flex");
						hint.textContent = "";
					}, "image/jpeg", 0.92);
				}

				async function retake() {
					capturedBlob = null;
					uploadedSelfie = null;
					if (capturedUrl) { URL.revokeObjectURL(capturedUrl); capturedUrl = null; }
					preview.classList.add("hidden");
					video.classList.remove("hidden");
					confirmRow.classList.add("hidden");
					confirmRow.classList.remove("flex");
					shutterRow.classList.remove("hidden");
					hint.textContent = "Frame your face inside the circle. Tap the shutter when you're ready.";
					statusEl.textContent = "";
					await startCamera();
				}

				async function approve() {
					if (!capturedBlob) return;
					useBtn.disabled = true;
					retakeBtn.disabled = true;
					statusEl.textContent = "Uploading…";
					try {
						if (!uploadedSelfie) {
							const fd = new FormData();
							fd.append("selfie", capturedBlob, "selfie.jpg");
							const uploadResponse = await fetch(basePath + "/api/kiosk/selfie", { method: "POST", body: fd });
							const uploadData = await uploadResponse.json();
							if (!uploadResponse.ok || !uploadData.ok) throw new Error(uploadData.error || "upload failed");
							uploadedSelfie = { sessionId: uploadData.sessionId, selfieKey: uploadData.selfieKey };
						}

						statusEl.textContent = "Starting generation…";
						const startResponse = await fetch(basePath + "/api/kiosk/start", {
							method: "POST",
							headers: { "content-type": "application/json" },
							body: JSON.stringify({
								sessionId: uploadedSelfie.sessionId,
								selfieKey: uploadedSelfie.selfieKey,
								sceneId: selectedScene.sceneId,
							}),
						});
						const startData = await startResponse.json();
						if (!startResponse.ok || !startData.ok) throw new Error(startData.error || "start failed");
						sessionStorage.removeItem("kiosk:scene");
						sessionStorage.removeItem("kiosk:selfie");
						window.location.href = startData.statusUrl;
					} catch (err) {
						console.error(err);
						statusEl.textContent = "✗ " + (err && err.message ? err.message : String(err));
						useBtn.disabled = false;
						retakeBtn.disabled = false;
					}
				}

				shutter.addEventListener("click", startCountdown);
				useBtn.addEventListener("click", approve);
				retakeBtn.addEventListener("click", retake);
				function cleanup() { cancelCountdown(); stopCamera(); if (audioCtx) { audioCtx.close().catch(function () {}); audioCtx = null; } }
				window.addEventListener("pagehide", cleanup);
				window.addEventListener("beforeunload", cleanup);
				startCamera();
			})();
			</script>`,
		),
	);
});

export { app as kioskCaptureRoutes };
