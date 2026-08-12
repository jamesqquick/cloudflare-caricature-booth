# Capture Mute Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an accessible selfie-capture mute toggle whose device-wide state persists across events and reloads.

**Architecture:** Keep the feature inside the existing server-rendered capture route. A page-level boolean reads and writes one guarded `localStorage` key, drives the button's visual and accessible state, and causes both existing audio functions to return before using the shared `AudioContext`.

**Tech Stack:** TypeScript, Hono server-rendered HTML, browser DOM APIs, Tailwind CSS

---

### Task 1: Add The Persistent Mute Control

**Files:**
- Modify: `src/routes/event/kiosk-capture.ts:24-181`

- [x] **Step 1: Add the accessible header button**

Replace the right-side spacer with a 44px circular button containing sound-on and muted SVG elements. Set the initial server-rendered state to `aria-label="Mute sounds"` and `aria-pressed="false"`.

- [x] **Step 2: Add guarded persistent state**

Read only the exact string `true` from `localStorage.getItem("kiosk:capture-muted")`. Catch storage read and write failures so kiosk capture remains usable in restricted browser modes.

- [x] **Step 3: Synchronize the interface**

Add one `renderMuteState()` function that updates `aria-label`, `aria-pressed`, button styling, and the visibility of the two SVG icons. Call it on initialization and after each button click.

- [x] **Step 4: Gate both sound generators**

Change both audio guards to:

```js
if (isMuted || !audioCtx) return;
```

This preserves countdown visuals, shutter flash, capture, and Safari audio unlocking.

### Task 2: Verify The Route

**Files:**
- Verify: `src/routes/event/kiosk-capture.ts`

- [x] **Step 1: Run static checks**

Run `npx tsc --noEmit` and expect exit code 0. Run `npm run build` and expect Tailwind to complete successfully.

- [x] **Step 2: Inspect generated route behavior**

Start the local Worker and request an event capture route. Confirm the response contains the mute button, both accessible labels, the stable storage key, and guards for both audio functions.

- [x] **Step 3: Prepare local testing state**

Copy `.dev.vars` from the main checkout into the worktree. Run `npx wrangler d1 migrations apply nyc-booth-db --local` and expect all migrations to report applied.

- [ ] **Step 4: Commit and publish**

Review the diff and staged files for secrets, commit with a conventional message, push `feat/issue-38-capture-mute`, and create a pull request closing issue 38.
