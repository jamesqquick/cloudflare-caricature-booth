import { Hono } from 'hono';
import type { EventEnv } from '../../lib/types';
import { kioskPage } from '../../lib/html';

const app = new Hono<EventEnv>();

/**
 * Live camera capture screen (step 1 of 3).
 * GET /kiosk/capture
 */
app.get('/kiosk/capture', (c) => {
	const basePath = c.get('basePath');
	const origin = new URL(c.req.url).origin;
	const eventUrl = `${origin}${basePath}/`;
	const qrSrc = `${basePath}/api/kiosk/qr?url=${encodeURIComponent(eventUrl)}`;
	return c.html(
		kioskPage(
			'Capture your selfie',
			`			<main id="capture-root" class="studio-shell">
				<aside class="studio-rail">
					<div class="studio-brand">
						<span class="studio-cloud" aria-hidden="true"></span>
						<span>Caricature Booth</span>
					</div>
					<a href="${basePath}/kiosk" class="studio-mobile-cancel">Cancel</a>

					<section class="studio-intro" aria-labelledby="capture-heading">
						<p class="studio-eyebrow">Step 01 / 03</p>
						<h1 id="capture-heading">Meet your best angle.</h1>
						<p>Center your face in the frame. Good light and a straight-on pose make the best caricature.</p>
						<div class="studio-progress" aria-label="Step 1 of 3">
							<span></span><span></span><span></span>
						</div>
					</section>

					<p class="studio-privacy">
						Your selfie is removed after the event.<br />
						<a href="${basePath}/privacy">Read our privacy promise</a>
					</p>
				</aside>

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
							<p id="cap-hint" class="studio-hint">Look at the lens, keep your shoulders visible, and hold still.</p>
							<div id="cap-shutter-row" class="studio-shutter-row flex">
								<button id="cap-shutter" type="button" disabled class="studio-shutter">
									<span class="sr-only">Take photo</span>
								</button>
								<span class="studio-shutter-label">Take photo</span>
							</div>
							<div id="cap-confirm-row" class="studio-confirm hidden flex-col">
								<button id="cap-use" type="button" class="studio-use">Use this photo</button>
								<button id="cap-retake" type="button" class="studio-retake">Retake</button>
							</div>
							<p id="cap-status" class="studio-status" aria-live="polite"></p>
							<a href="${basePath}/kiosk" class="studio-cancel">Cancel session</a>
							<div class="studio-handoff">
								<img src="${qrSrc}" alt="QR code to continue on your phone" />
								<span>Continue on your phone</span>
							</div>
							<p class="studio-mobile-privacy">Photo removed after the event · <a href="${basePath}/privacy">Privacy</a></p>
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
				display: grid;
				grid-template-columns: minmax(15rem, 20rem) minmax(0, 1fr);
				height: 100dvh;
				min-height: 100dvh;
				overflow: hidden;
			}
			.studio-rail {
				border-right: 1px solid oklch(96% 0.012 70 / 0.12);
				display: flex;
				flex-direction: column;
				padding: clamp(1.75rem, 3.5vw, 3.5rem);
			}
			.studio-brand {
				align-items: center;
				display: flex;
				font-size: 0.95rem;
				font-weight: 800;
				gap: 0.7rem;
				letter-spacing: -0.02em;
			}
			.studio-cloud {
				background: var(--studio-orange);
				border-radius: 1.1rem 1.1rem 0.45rem 0.45rem;
				height: 1.35rem;
				position: relative;
				width: 2.2rem;
			}
			.studio-cloud::before {
				background: var(--studio-orange);
				border-radius: 50%;
				content: "";
				height: 1.05rem;
				left: 0.45rem;
				position: absolute;
				top: -0.45rem;
				width: 1.05rem;
			}
			.studio-mobile-cancel { display: none; }
			.studio-intro { margin: auto 0; }
			.studio-eyebrow {
				color: var(--studio-orange);
				font-size: 0.72rem;
				font-weight: 800;
				letter-spacing: 0.17em;
				text-transform: uppercase;
			}
			.studio-intro h1 {
				font-size: clamp(2.2rem, 4vw, 3.75rem);
				font-weight: 800;
				letter-spacing: -0.055em;
				line-height: 0.98;
				margin: 0.9rem 0 0.8rem;
				max-width: 9ch;
			}
			.studio-intro > p:last-of-type {
				color: var(--studio-muted);
				font-size: 0.9rem;
				line-height: 1.55;
				max-width: 28ch;
			}
			.studio-progress { display: flex; gap: 0.45rem; margin-top: 1.75rem; }
			.studio-progress span {
				background: oklch(96% 0.012 70 / 0.15);
				border-radius: 999px;
				height: 0.25rem;
				width: 2.25rem;
			}
			.studio-progress span:first-child { background: var(--studio-orange); }
			.studio-privacy {
				color: oklch(67% 0.012 70);
				font-size: 0.7rem;
				line-height: 1.55;
			}
			.studio-privacy a, .studio-mobile-privacy a { text-decoration: underline; text-underline-offset: 0.2rem; }
			.studio-stage { display: grid; min-width: 0; padding: clamp(1.25rem, 3vw, 2.75rem); place-items: center; }
			.studio-capture {
				align-items: center;
				display: grid;
				gap: clamp(1.5rem, 4vw, 3.5rem);
				grid-template-columns: minmax(17.5rem, 38rem) minmax(10.5rem, 15rem);
				max-width: 62rem;
				width: 100%;
			}
			.studio-viewfinder {
				aspect-ratio: 4 / 5;
				background: var(--studio-panel);
				border-radius: 2.15rem;
				box-shadow: 0 2.2rem 5.5rem oklch(5% 0.01 55 / 0.6);
				max-height: calc(100dvh - 5rem);
				overflow: hidden;
				position: relative;
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
			.studio-controls { align-items: center; display: flex; flex-direction: column; text-align: center; }
			.studio-hint { color: var(--studio-muted); font-size: 0.88rem; line-height: 1.5; max-width: 22ch; min-height: 2.65rem; }
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
			.studio-cancel {
				align-items: center;
				color: var(--studio-muted);
				display: inline-flex;
				font-size: 0.8rem;
				justify-content: center;
				margin-top: 0.75rem;
				min-height: 2.75rem;
				text-decoration: underline;
				text-underline-offset: 0.25rem;
			}
			.studio-handoff { align-items: center; display: flex; flex-direction: column; margin-top: 1.25rem; }
			.studio-handoff img { background: var(--studio-paper); border-radius: 0.75rem; padding: 0.35rem; width: 4.5rem; }
			.studio-handoff span { color: var(--studio-muted); font-size: 0.67rem; margin-top: 0.45rem; }
			.studio-mobile-privacy { display: none; }
			#capture-root button:focus-visible, #capture-root a:focus-visible { outline: 3px solid var(--studio-orange); outline-offset: 4px; }
			@media (hover: hover) {
				.studio-shutter:not(:disabled):hover, .studio-use:not(:disabled):hover { filter: brightness(1.08); }
				.studio-retake:not(:disabled):hover { background: oklch(96% 0.012 70 / 0.08); border-color: oklch(96% 0.012 70 / 0.55); }
				.studio-cancel:hover, .studio-privacy a:hover, .studio-mobile-privacy a:hover { color: var(--studio-paper); }
			}

			@media (max-width: 879px) {
				#capture-root { display: flex; flex-direction: column; }
				.studio-rail {
					align-items: center;
					border: 0;
					flex-direction: row;
					justify-content: space-between;
					padding: max(0.85rem, env(safe-area-inset-top)) 1.1rem 0.55rem;
				}
				.studio-intro {
					clip: rect(0 0 0 0);
					clip-path: inset(50%);
					height: 1px;
					overflow: hidden;
					position: absolute;
					white-space: nowrap;
					width: 1px;
				}
				.studio-privacy { display: none; }
				.studio-mobile-cancel { align-items: center; color: var(--studio-muted); display: inline-flex; font-size: 0.78rem; min-height: 2.75rem; }
				.studio-stage { flex: 1; min-height: 0; padding: 0.35rem 1rem max(0.75rem, env(safe-area-inset-bottom)); }
				.studio-capture { display: flex; flex-direction: column; gap: 0.75rem; height: 100%; }
				.studio-viewfinder { flex: 1; max-height: calc(100dvh - 13.75rem); min-height: 0; width: min(100%, 29rem); }
				.studio-controls { width: min(100%, 29rem); }
				.studio-hint { font-size: 0.8rem; max-width: 35ch; min-height: 1.25rem; }
				.studio-shutter { border-width: 6px; height: 4.65rem; margin: 0.6rem 0 0.45rem; width: 4.65rem; }
				.studio-shutter-label::after { color: var(--studio-muted); content: " · Step 1 of 3"; font-weight: 500; }
				.studio-confirm { flex-direction: row; margin-top: 0.5rem; }
				.studio-use, .studio-retake { flex: 1; }
				.studio-status { margin-top: 0.35rem; }
				.studio-cancel, .studio-handoff { display: none; }
				.studio-mobile-privacy { color: oklch(67% 0.012 70); display: block; font-size: 0.61rem; margin-top: 0.25rem; }
			}
			@media (min-width: 600px) and (max-width: 879px) {
				.studio-handoff { display: flex; flex-direction: row; gap: 0.65rem; margin-top: 0.45rem; }
				.studio-handoff img { border-radius: 0.55rem; width: 3rem; }
				.studio-handoff span { margin: 0; }
			}
			@media (max-width: 879px) and (orientation: landscape) {
				.studio-stage { padding-inline: 1.25rem; }
				.studio-capture { display: grid; gap: 1.5rem; grid-template-columns: minmax(15rem, 1fr) minmax(12rem, 17rem); max-width: 52rem; }
				.studio-viewfinder { max-height: calc(100dvh - 5.5rem); width: auto; }
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

				let stream = null;
				let capturedBlob = null;
				let capturedUrl = null;
				let countdownTimer = null;
				const countdownEl = document.getElementById("cap-countdown");
				const countdownNum = document.getElementById("cap-countdown-num");
				const flashEl = document.getElementById("cap-flash");

				// ── Audio ──
				var audioCtx = null;
				try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}

				function unlockAudio() {
					if (audioCtx && audioCtx.state === "suspended") {
						audioCtx.resume().catch(function () {});
					}
				}

				function playBeep(frequency, duration) {
					if (!audioCtx) return;
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
					if (!audioCtx) return;
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
							'<a href="' + basePath + '/kiosk" class="mt-6 inline-flex items-center justify-center rounded-full bg-cf-orange px-8 py-3 text-base font-bold text-black hover:bg-cf-orange-dark active:scale-[0.98] transition">\u2190 Back to start</a>'
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
							'<a href="' + basePath + '/kiosk" class="mt-3 text-sm text-white/50 hover:text-white underline underline-offset-4">\u2190 Back to start</a>'
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
						const fd = new FormData();
						fd.append("selfie", capturedBlob, "selfie.jpg");
						const r = await fetch(basePath + "/api/kiosk/selfie", { method: "POST", body: fd });
						const j = await r.json();
						if (!r.ok || !j.ok) throw new Error(j.error || "upload failed");
						sessionStorage.setItem("kiosk:selfie", JSON.stringify({
							sessionId: j.sessionId,
							selfieKey: j.selfieKey,
							size: j.size,
							capturedAt: Date.now(),
						}));
						statusEl.textContent = "✓ Uploaded. Pick a scene next…";
						window.location.href = basePath + "/kiosk/scene";
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
