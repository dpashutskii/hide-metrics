# Hide Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old "Focus Blocker for Creators" code with Hide Metrics v1.0.0: a Chrome extension that hides metrics by type on YouTube Studio and youtube.com, with a date-and-time hard-mode lock and a weekly check-in, ready to upload to the Chrome Web Store.

**Architecture:** Plain classic scripts sharing one global namespace `globalThis.HM` (same pattern as the old `config.js`), so the same files load in the service worker (`importScripts`), the popup (`<script>`), content scripts (manifest), and Node tests (`import` for side effects). Pure logic (time math, state, lock rules, effective hiding) lives in `src/core/`. The background service worker is the single writer of `chrome.storage.local` keys `state` and `effective`; content scripts and pages only read `effective` / send actions. Everything YouTube-specific lives in one file per site in `src/sites/`.

**Tech Stack:** Manifest V3, vanilla JS/HTML/CSS, no dependencies, Node ≥ 20 built-in test runner (`node --test`), Python 3 + Pillow for icons/screenshots (already used by the author's other extension).

**Spec:** `docs/superpowers/specs/2026-11-12-hide-metrics-design.md` (mockups in `docs/superpowers/specs/2026-11-12-hide-metrics-mockups/`). Read both before starting.

## Global Constraints

- Work on branch `hide-metrics-v1` off `main`. First commit: the spec, mockups and this plan (they start uncommitted). Never commit to `main` directly; never force-push.
- Public repo: no real channel names, channel/video IDs, real numbers, screenshots of a real Studio, local filesystem paths, or links to private repos — in files or commit messages. Test fixtures and demo pages are synthetic (fictional "Demo Channel"). Don't use real-place hints in test data (use `UTC` / `America/New_York` time zones only).
- Name `Hide Metrics`, manifest `version` `1.0.0`, Manifest V3, Chrome only.
- No network requests of our own, no remote code, no npm dependencies.
- Permissions exactly: `storage`, `alarms`; host permissions `https://studio.youtube.com/*`, `https://www.youtube.com/*`; `optional_permissions: ["tabs"]`. Nothing else.
- Storage: `chrome.storage.local` only (never `sync`).
- Switch ids, labels and order (exact): `statsPages` "Stats pages", `views` "Views", `subscribers` "Subscribers", `revenue` "Revenue", `likes` "Likes", `comments` "Comments", `aiFeatures` "AI features".
- Site ids, labels (exact): `youtubeStudio` "YouTube Studio" (`studio.youtube.com`), `youtube` "YouTube" (`www.youtube.com`).
- Defaults: every switch on except `comments`; both sites on; not paused; no lock.
- Hidden means `display: none !important`. No placeholders, blur, counters of hidden items, or "show anyway".
- Blocked page copy (exact): title `{statsWord} are hidden`, line `Your numbers will still be here later.`, rows `Locked until` / `Next check-in` (only while locked), one button (`Back to Studio` on Studio, `Back to YouTube` on YouTube).
- Date format everywhere: `Mon 30 Nov, 09:00` (short weekday, day, short month, 24-hour), local time.
- Look: black-and-white tokens, font stack and row style from `docs/superpowers/specs/2026-11-12-hide-metrics-mockups/popup-states.html` (`:root` variables, light + dark via `prefers-color-scheme`). Grouped rows with thin separators; no "·" chains; minimal helper text.
- Tests: `npm test` runs `TZ=UTC node --test tests/*.test.js && TZ=America/New_York node --test tests/tz/*.test.js`. All must pass before each commit.

## Review Focus

1. **Flash on load** — a hard reload of the Studio dashboard must never show a metric, even for a frame (content CSS starts as "hide everything" before settings load). Owner: Task 4 (code), Task 6 (on-device check).
2. **In-app navigation into Insights** — clicking "Insights" in Studio's sidebar (no page load) must show the blocked page within ~250 ms; navigating away removes it. Owner: Task 4.
3. **Chrome closed across a boundary** — if Chrome starts after the lock ended, or in the middle of a check-in window, the state is right immediately (lock gone / numbers shown), without waiting for an alarm. Owner: Task 2 (tests), Task 3 (`onStartup`).
4. **Daylight-saving change** — a Sunday 10:00 check-in opens at 10:00 local time on both sides of a DST switch. Owner: Task 1.
5. **Loosening by editing storage directly** (e.g. from the extension's DevTools) while locked is reverted. Owner: Task 2 (tests), Task 3 (manual check).

---

### Task 1: Time math (`src/core/schedule.js`)

**Files:**
- Create: `package.json`, `src/core/schedule.js`, `tests/schedule.test.js`, `tests/tz/dst.test.js`

**Interfaces:**
- Produces (on `globalThis.HM`):
  - `checkInWindowAt(checkIn, now: number) → {start: number, end: number} | null` — the window containing `now` (`start ≤ now < end`).
  - `nextCheckInWindow(checkIn, now: number) → {start: number, end: number}` — first window with `start > now`.
  - `quickPick(kind: 'tomorrow' | 'week', now: number) → number` — tomorrow 09:00 local / 7 days from today at 09:00 local.
  - `formatWhen(ms: number) → string` — `Mon 30 Nov, 09:00`.
  - `formatLeft(ms: number) → string` — `N days left` / `1 day left` (≥ 24 h, floor), `N hours left` / `1 hour left` (≥ 1 h, floor), else `N min left` (ceil).
  - `CheckIn` = `{ day: 0..6 (0 = Sunday), startMin: 0..1439, lengthMin: 15 | 30 | 60 }`. All ms are epoch milliseconds; all calendar math in local time.

- [ ] **Step 1: Branch and scaffold.** `git switch -c hide-metrics-v1`; commit the spec, mockups and this plan. Create `package.json` with `"private": true`, `"type": "module"`, and the `test` script from Global Constraints. File pattern for every shared file: `(function (HM) { … })(globalThis.HM = globalThis.HM || {});`.

- [ ] **Step 2: Write the failing tests** in `tests/schedule.test.js` (import `../src/core/schedule.js` for side effects, then use `globalThis.HM`). Thursday 2026-11-12 is "now"; `ci = { day: 0, startMin: 600, lengthMin: 30 }`.

```js
const U = Date.UTC;
test('window containing now', () => {
  assert.deepEqual(HM.checkInWindowAt(ci, U(2026,10,15,10,10)), { start: U(2026,10,15,10,0), end: U(2026,10,15,10,30) });
  assert.equal(HM.checkInWindowAt(ci, U(2026,10,15,10,30)), null); // end is exclusive
  assert.equal(HM.checkInWindowAt(ci, U(2026,10,12,10,10)), null);
});
test('next window is strictly after now', () => {
  assert.equal(HM.nextCheckInWindow(ci, U(2026,10,12,12,0)).start, U(2026,10,15,10,0));
  assert.equal(HM.nextCheckInWindow(ci, U(2026,10,15,10,10)).start, U(2026,10,22,10,0));
});
test('quick picks', () => {
  assert.equal(HM.quickPick('tomorrow', U(2026,10,12,16,40)), U(2026,10,13,9,0));
  assert.equal(HM.quickPick('week', U(2026,10,12,16,40)), U(2026,10,19,9,0));
});
test('formatting', () => {
  assert.equal(HM.formatWhen(U(2026,10,30,9,0)), 'Mon 30 Nov, 09:00');
  assert.equal(HM.formatLeft(17*864e5 + 5*36e5), '17 days left');
  assert.equal(HM.formatLeft(864e5 + 2*36e5), '1 day left');
  assert.equal(HM.formatLeft(5*36e5 + 10*6e4), '5 hours left');
  assert.equal(HM.formatLeft(36e5), '1 hour left');
  assert.equal(HM.formatLeft(22*6e4 - 500), '22 min left');
});
```

`tests/tz/dst.test.js` (runs under `America/New_York`; DST ends Sun 1 Nov 2026): from Sat 24 Oct 12:00 local (`U(2026,9,24,16,0)`) the next Sunday 10:00 window starts at `U(2026,9,25,14,0)`; from Sat 31 Oct 12:00 local (`U(2026,9,31,16,0)`) it starts at `U(2026,10,1,15,0)`.

- [ ] **Step 3: Run `npm test`** — expected: FAIL (`HM.checkInWindowAt is not a function`).
- [ ] **Step 4: Implement `src/core/schedule.js`.** Build window starts with `new Date(y, m, d, 0, startMin)` on local calendar days (never by adding 7×24 h), so DST is handled by the `Date` constructor. `formatWhen` via `Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })` parts, assembled as `${weekday} ${day} ${month}, ${hour}:${minute}`.
- [ ] **Step 5: Run `npm test`** — expected: all pass.
- [ ] **Step 6: Commit** — `git commit -m "Core: check-in windows, quick picks, date formatting"`.

### Task 2: State, lock rules, effective hiding (`src/core/state.js`)

**Files:**
- Create: `src/core/state.js`, `tests/state.test.js`

**Interfaces:**
- Consumes: Task 1 functions.
- Produces (on `globalThis.HM`):
  - `SWITCHES: Array<{id, label}>`, `SITES: Array<{id, label}>` — exact values from Global Constraints, in order.
  - `State` = `{ v: 1, paused: boolean, hide: Record<SwitchId, boolean>, sites: Record<SiteId, boolean>, lock: null | { until: number, checkIn: CheckIn | null, guard: boolean, skipUntil: number | null } }`.
  - `defaultState() → State`; `normalizeState(raw: unknown) → State` (fills missing/invalid fields from defaults, drops unknown keys).
  - `isLocked(state, now) → boolean` (`lock && now < lock.until`).
  - `settle(state, now) → State` — clears an expired lock.
  - `enforceLock(prev: State, next: State, now) → State` — while `prev` is locked, reverts any loosening in `next`: a `hide`/`sites` value true→false, `paused` false→true, `lock` removed, `until` earlier, `checkIn` changed, `guard` true→false. `skipUntil` may be set. When `prev` isn't locked, returns `next` unchanged.
  - `reduce(state, action, now) → State` — `settle` first, then apply, then `enforceLock(settled, candidate, now)`. Actions:
    - `{ type: 'set', path: ['paused'] | ['hide', SwitchId] | ['sites', SiteId], value: boolean }`
    - `{ type: 'lock', until, checkIn: CheckIn | null, guard: boolean }` — only when not locked; sets `paused: false`, `skipUntil: null`.
    - `{ type: 'extend', until }`
    - `{ type: 'endCheckIn' }` — if a check-in window is open, `skipUntil = window.end`.
  - `Effective` = `{ paused: boolean, hide: Record<SwitchId, boolean>, sites: Record<SiteId, boolean>, lock: null | { until: number, checkInOpen: boolean, checkInEndsAt: number | null, nextCheckIn: number | null } }`.
  - `computeEffective(state, now) → Effective` — paused → every `hide` false. Locked and a check-in window open and not skipped (`!(skipUntil > now)`) → every `hide` false except `aiFeatures` keeps `state.hide.aiFeatures`. Expired lock → `lock: null`.
  - `nextTransition(state, now) → number | null` — earliest of lock end, current window end, next window start (only those before lock end); `null` when unlocked.

- [ ] **Step 1: Write the failing tests** in `tests/state.test.js`. Use `ci` from Task 1, `T = Date.UTC(2026,10,30,9,0)` (lock end), `NOW = Date.UTC(2026,10,12,12,0)`, `locked = HM.reduce(HM.defaultState(), { type: 'lock', until: T, checkIn: ci, guard: true }, NOW)`.
  - `defaults`: all `hide` true except `comments` false; both sites true; `paused` false; `lock` null.
  - `normalize drops junk`: `normalizeState({ hide: { views: false, bogus: true }, sites: 'x' })` → `hide.views === false`, no `bogus` key, `sites` equals defaults.
  - `lock bounds`: `isLocked(locked, T - 1) === true`, `isLocked(locked, T) === false`.
  - `only-on while locked`: `{ type: 'set', path: ['hide', 'views'], value: false }` → stays true; `['hide', 'comments']` true → becomes true; `['sites', 'youtube']` false → stays true; `['paused']` true → stays false.
  - `lock clears pause`: paused state + lock action → `paused === false`.
  - `lock while locked is ignored`; `extend`: `T + 1` accepted, `T - 1` ignored.
  - `storage edits are reverted` (Review Focus 5): `enforceLock(locked, { ...locked, lock: null }, NOW).lock.until === T`; changed `checkIn` → restored; `hide.views: false` → `true`.
  - `check-in opens numbers but not AI`: `computeEffective(locked, Date.UTC(2026,10,15,10,10))` → every `hide` false except `aiFeatures` true; `lock.checkInOpen === true`; `lock.checkInEndsAt === Date.UTC(2026,10,15,10,30)`.
  - `end check-in early`: after `endCheckIn` at 10:10, effective at 10:12 has `checkInOpen === false` and `hide.views === true`.
  - `paused hides nothing`.
  - `transitions`: at `NOW` → `Date.UTC(2026,10,15,10,0)`; at Sun 10:10 → `Date.UTC(2026,10,15,10,30)`; lock without check-in → `T`; unlocked → `null`.
  - `Chrome closed across a boundary` (Review Focus 3): `computeEffective(locked, T + 1).lock === null` and `settle(locked, T + 1).lock === null`; with `now` inside a window (Chrome started mid check-in), `checkInOpen === true`.
- [ ] **Step 2: Run `npm test`** — expected: FAIL.
- [ ] **Step 3: Implement `src/core/state.js`.**
- [ ] **Step 4: Run `npm test`** — expected: all pass.
- [ ] **Step 5: Commit** — `"Core: state, lock rules, effective hiding"`.

### Task 3: Manifest + background service worker; remove old code

**Files:**
- Delete: `background.js`, `blocked.*`, `config.js`, `content.js`, `content.css`, `options.*`, `popup.*` (old root files)
- Create: `manifest.json` (replace), `src/background.js`, `.gitignore` (add `dist/`, `.DS_Store`, `.superpowers/`)

**Interfaces:**
- Consumes: Task 2 (`reduce`, `normalizeState`, `enforceLock`, `settle`, `computeEffective`, `nextTransition`, `defaultState`).
- Produces:
  - Storage: `state: State`, `effective: Effective` (background is the only writer).
  - Messages (`chrome.runtime.sendMessage`): `{ type: 'get' }` → `{ state, effective, now }`; `{ type: 'action', action }` → `{ state, effective, now }`.
  - Alarm name `hm-tick`.

- [ ] **Step 1: Write `manifest.json`** — MV3, name/version/permissions from Global Constraints, `background.service_worker: "src/background.js"` (classic, not module), `action.default_popup: "src/popup/popup.html"`, icons paths `icons/icon{16,48,128}.png` (icons arrive in Task 9; until then omit the `icons` keys). Content scripts are added in Task 4.
- [ ] **Step 2: Implement `src/background.js`.** `importScripts('core/schedule.js', 'core/state.js')`. `save(state)` writes `state` and `computeEffective(state, now)` together, remembers the JSON it wrote, and (re)schedules `hm-tick` at `nextTransition` (clears it when `null`). Handlers: `onMessage` (`get`, `action` → `reduce` → `save`; reply async with `return true`); `storage.onChanged` for `state` whose JSON differs from the last write → `save(enforceLock(normalize(old), normalize(new), now))`; `alarms.onAlarm` and `runtime.onStartup` → `save(settle(load(), now))`; `runtime.onInstalled` → `save(load())` (defaults when empty).
- [ ] **Step 3: Verify loading.** Load unpacked in Chrome (`chrome://extensions` → Developer mode → Load unpacked → repo root). Expected: no errors on the extension card; in the service worker console, `chrome.storage.local.get(null)` shows `state` with defaults and `effective`.
- [ ] **Step 4: Verify Review Focus 5 by hand.** In the service worker console (top-level `load`/`save` are reachable there): `await save(HM.reduce(await load(), { type: 'lock', until: Date.now() + 6e5, checkIn: null, guard: false }, Date.now()))`, then read `state` from storage and write it back with `hide.views = false`. Expected: within a second `state.hide.views` is `true` again.
- [ ] **Step 5: Run `npm test`**, then commit — `"Background worker and MV3 manifest; remove old extension"`.

### Task 4: Content engine — CSS hiding and the blocked page

**Files:**
- Create: `src/content/registry.js`, `src/content/hide.js`, `src/content/block.js`, `scripts/dev-bundle.mjs`, `tests/registry.test.js`
- Modify: `manifest.json` (add `content_scripts`)

**Interfaces:**
- Consumes: storage key `effective` (Task 3); `formatWhen` (Task 1).
- Produces (on `globalThis.HM`):
  - `Site` = `{ id: SiteId, hosts: string[], statsWord: string, homeUrl: string, backLabel: string, isStatsPage(url: URL) → boolean, selectors: Partial<Record<SwitchId, string[]>> }`.
  - `registerSite(site)`, `siteFor(hostname: string) → Site | null`.
  - `buildCss(site, hide: Record<SwitchId, boolean>) → string` — **one rule per selector** (`<selector> { display: none !important; }`, joined with `\n`), so one bad selector can't disable a whole group; `''` when nothing is hidden.
  - `report(site, doc = document) → Array<{ switch: SwitchId, selector: string, count: number }>` — `count` is `-1` when the selector throws. Used from DevTools (pick the extension's context in the console) to spot selectors that stopped matching.
- Manifest `content_scripts`: matches both hosts, `run_at: "document_start"`, js in this order: `src/core/schedule.js`, `src/content/registry.js`, `src/sites/youtube-studio.js`, `src/sites/youtube.js`, `src/content/hide.js`, `src/content/block.js`. (Site files arrive in Tasks 6–7; create them now as empty `registerSite` stubs with `selectors: {}` so the manifest loads.)

- [ ] **Step 1: Write the failing tests** (`tests/registry.test.js`, synthetic site `{ id: 'demo', hosts: ['demo.example'], selectors: { views: ['.a', '.b:has(.c)'], likes: ['.d'] }, … }`):
  - `buildCss(site, { views: true, likes: false })` equals `'.a { display: none !important; }\n.b:has(.c) { display: none !important; }'`.
  - `buildCss(site, { views: false, likes: false })` equals `''`.
  - `siteFor('demo.example')` is the site; `siteFor('other.example')` is `null`.
- [ ] **Step 2: Run `npm test`** — expected: FAIL. **Step 3: implement `registry.js`.** **Step 4: run** — expected: pass.
- [ ] **Step 5: Implement `hide.js`.** Synchronously at `document_start`: find the site, append `<style id="hide-metrics-style">` to `document.documentElement` with `buildCss(site, <every switch true>)` (Review Focus 1: hide everything until settings load). Then read `effective`; apply `''` if the site is off, else `buildCss(site, effective.hide)`. Re-apply on `storage.onChanged` for `effective`. Keep `HM.current = { site, effective }` for `block.js`.
- [ ] **Step 6: Implement `block.js`.** Should-block = site on ∧ `hide.statsPages` ∧ `site.isStatsPage(new URL(location.href))` (before settings load, assume `statsPages` on). Watch URL changes with a 250 ms interval plus `popstate` (Studio navigates without page loads — Review Focus 2) and re-check on `effective` changes. When blocking: mount a fixed, full-viewport element in a shadow root using the mockup's blocked-page design (`hidden-look.html`, lower half) and the exact copy from Global Constraints; show `Locked until` / `Next check-in` rows only when `effective.lock` is set (format with `formatWhen`); button navigates to `site.homeUrl`. Hide the page underneath (`html.hm-blocked body { visibility: hidden }`, overlay itself visible) and remove both when should-block turns false.
- [ ] **Step 7: Write `scripts/dev-bundle.mjs`** — prints one self-contained script: a stub `chrome.storage.local`/`onChanged` holding an `effective` (default: `computeEffective(defaultState())`, or JSON from `argv[2]`), followed by the content files in manifest order. Purpose: paste into a live page's console (or the built-in browser's JS tool) to check hiding without installing the extension. Never commit its output.
- [ ] **Step 8: Verify Review Focus 2** on live Studio: run the bundle on the Studio dashboard, click "Insights" in the sidebar. Expected: blocked page within ~250 ms with "Insights are hidden" (once Task 6 fills `isStatsPage`); browser Back → blocked page gone, dashboard visible.
- [ ] **Step 9: Run `npm test`**, commit — `"Content engine: per-switch CSS, blocked page, dev bundle"`.

### Task 5: Popup

**Files:**
- Create: `src/shared/tokens.css`, `src/popup/popup.html`, `src/popup/popup.css`, `src/popup/popup.js`

**Interfaces:**
- Consumes: messages from Task 3; `SWITCHES`, `SITES`, `isLocked`, `quickPick`, `formatWhen`, `formatLeft`, `checkInWindowAt` (Tasks 1–2). `popup.html` loads `../core/schedule.js`, `../core/state.js`, then `popup.js`.
- Produces: `src/shared/tokens.css` (the mockup `:root` tokens, light + dark) reused by Task 8 pages.

- [ ] **Step 1: Build the popup** to match the mockups: layout from `popup-sites.html` option A; states from `popup-states.html` (with "Stats pages" as the first switch and the "On" group above "Hard mode"). Views, all rendered from `{ state, effective }`:
  - **Main** — header (icon, "Hide Metrics", pause switch hidden while locked), "Hide" group (7 switches), "On" group (2 sites), "Hard mode" row (`Off` / nothing while locked).
  - **Hard mode setup** — Back; "Lock until": date input + time input (default: `quickPick('week')`); chips `Tomorrow`, `1 week`, `Until a date`; "Weekly check-in" group: toggle (default on), Day (Monday…Sunday select, default Sunday), Starts (time, default 10:00), Lasts (15 / 30 / 60 min, default 30); note `Until the lock ends, switches only turn on. The lock can be extended, not shortened.`; `Lock` button (disabled unless the chosen time is in the future) → `lock` action.
  - **Locked** — black banner `Locked until {formatWhen}` / `{formatLeft}`; switches that are on show the small lock and are disabled; off switches still work; rows `Next check-in` (`formatWhen`) and `Extend lock` (opens a variant of the setup screen with only the date/time and chips; only later times enabled → `extend` action).
  - **During check-in** — green banner `Check-in open until {HH:MM}` / `{formatLeft}`; rows show `Showing`, AI features shows `Still hidden` when on; `End check-in now` → `endCheckIn` action.
  - Refresh the view every 30 s while open (countdowns, lock ending).
- [ ] **Step 2: Dev preview.** When `chrome.runtime?.id` is missing, `popup.js` uses an in-memory fake backend (`reduce` + `computeEffective` on a local state) so the popup can be opened from a static server (`python3 -m http.server` at the repo root → `/src/popup/popup.html`) and checked in light and dark.
- [ ] **Step 3: Verify** in the dev preview: flip switches; lock for 1 week with Sunday check-in; on switches are disabled with the lock glyph; extend accepts only later times. Then in Chrome (unpacked): toggling `Views` updates an open Studio tab without reload.
- [ ] **Step 4: Run `npm test`**, commit — `"Popup: switches, sites, hard mode, locked and check-in states"`.

### Task 6: YouTube Studio site module

**Files:**
- Modify: `src/sites/youtube-studio.js`
- Create: `tests/sites.test.js`

**Interfaces:**
- Consumes: `registerSite` (Task 4), `SWITCHES` (Task 2).
- Produces: Studio `Site` with `statsWord: 'Insights'`, `homeUrl: 'https://studio.youtube.com/'`, `backLabel: 'Back to Studio'`.

- [ ] **Step 1: Write the failing tests** (`tests/sites.test.js`; import `state.js`, `registry.js`, both site files; synthetic IDs):
  - `isStatsPage` true for `https://studio.youtube.com/channel/UCxxxxxxxxxxxxxxxxxxxxxx/analytics/hub_overview` and `https://studio.youtube.com/video/abcdefghijk/analytics/tab-overview/period-default`; false for `…/channel/UCxxxxxxxxxxxxxxxxxxxxxx/videos/upload` and `…/comments/inbox`.
  - Every key in each site's `selectors` is a `SWITCHES` id; every selector is a non-empty string.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** `isStatsPage` (path contains `/analytics`) and the selector map. Start from the spec's "Observed Studio structure" and the switch table; on the live page (dev bundle from Task 4 in a signed-in Studio), cover at least:
  - Stats pages → sidebar Insights entry, "Go to channel insights", "View realtime data", per-video Insights tab and video-row analytics buttons.
  - Views / Subscribers / Revenue → Channel analytics card rows (whole card when all three on, via `:has()`), latest-video-performance numbers, published-videos metric rows, Content list columns (`.tablecell-views`, `.tablecell-revenue` + headers), "View live count", Recent subscribers card.
  - Likes / Comments → like and comment counts in dashboard rows and the latest-post stats; Comments → dashboard Comments card, Community comments list, `.tablecell-comments`.
  - AI features → Ask Studio header button/chat, "Catch me up on this video", Ask Studio summary cards, AI suggestion chips in upload/edit screens.
  - Where a number can't be separated from neighbouring text, hide the whole line (spec).
- [ ] **Step 4: Run `npm test`** — pass. In the live Studio, run `HM.report(HM.current.site)` — expected: no `-1` entries; zero-count selectors only for things absent on that page.
- [ ] **Step 5: On-device check (author, real Chrome, unpacked)** — defaults on: Dashboard, Content, Community, an Insights URL, a video's Insights tab, the upload dialog. Expected: no metric visible; Insights shows the blocked page; Comments still visible (off by default); a hard reload with DevTools CPU throttling 6× never flashes a number (Review Focus 1); switch Studio's language to another one and repeat the dashboard check.
- [ ] **Step 6: Commit** — `"YouTube Studio: selectors for all seven switches"`.

### Task 7: youtube.com site module

**Files:**
- Modify: `src/sites/youtube.js`, `tests/sites.test.js` (already covers selector-key validity)

**Interfaces:**
- Produces: YouTube `Site` with `statsWord: 'Analytics'`, `homeUrl: 'https://www.youtube.com/'`, `backLabel: 'Back to YouTube'`, `isStatsPage` true only for paths starting `/analytics`.

- [ ] **Step 1: Implement the selector map** on the live site (dev bundle), covering: view counts on thumbnails (home, search, channel, playlists, sidebar), the watch-page view line, "watching now" on lives; subscriber counts (channel header, under the video owner, search channel cards); like counts on videos, posts and comments; comment counts and the comment section (`comments` switch); AI entry points on the watch page where present. Separate numbers from dates by structure where possible; otherwise hide the whole line.
- [ ] **Step 2: Run `npm test`** — pass. `HM.report` on home, search, a watch page, a channel page — no `-1`.
- [ ] **Step 3: On-device check** — same pages with defaults: no counts; titles, channel names and dates stay where they're separable; the `YouTube` site switch off restores everything on youtube.com but not Studio.
- [ ] **Step 4: Commit** — `"YouTube: hide views, subscribers, likes, comments, AI"`.

### Task 8: Hard-mode guard, Incognito, welcome and locked pages

**Files:**
- Modify: `src/core/state.js` (+ `isExtensionsPage`), `tests/state.test.js`, `src/background.js`, `src/popup/popup.js`
- Create: `src/pages/locked.html`, `src/pages/welcome.html`, `src/pages/pages.css`

**Interfaces:**
- Produces: `isExtensionsPage(url: string) → boolean`.

- [ ] **Step 1: Failing test** — `isExtensionsPage` true for `chrome://extensions/`, `chrome://extensions/?id=abc`, `edge://extensions`, `brave://extensions/shortcuts`; false for `chrome://settings`, `https://example.com/chrome://extensions`. Run — FAIL; implement; run — pass.
- [ ] **Step 2: Guard in `background.js`.** Always register `tabs.onUpdated`; when `changeInfo.url` (present only once `tabs` is granted) is an extensions page and `isLocked` and `lock.guard` → `tabs.update(tabId, { url: runtime.getURL('src/pages/locked.html') })`, falling back to `tabs.remove`. On a successful `lock` action, also check existing tabs (`tabs.query({})`). Keep guarding during check-ins.
- [ ] **Step 3: Popup.** `Lock` click first calls `chrome.permissions.request({ permissions: ['tabs'] })` (user gesture) and sends `guard: granted`. In setup, if `chrome.extension.isAllowedIncognitoAccess()` is false, show a row "Not running in Incognito" with an `Open settings` button (`tabs.create({ url: 'chrome://extensions/?id=' + chrome.runtime.id })`); skippable. While locked, show the same row without the button and with `Can be allowed after the lock ends`.
- [ ] **Step 4: Pages.** `locked.html`: icon, `Hide Metrics is locked`, `Until {formatWhen}` (via `get` message). `welcome.html`, opened from `onInstalled` when `reason === 'install'`: short plain copy (what it does, how to pin the icon) and the popup embedded in an `<iframe src="../popup/popup.html">`. Both use `tokens.css`.
- [ ] **Step 5: Verify** in Chrome: lock for 10 minutes, accept the permission → opening `chrome://extensions` lands on the locked page; decline instead → lock works, extensions page opens normally. Fresh install opens the welcome page.
- [ ] **Step 6: Run `npm test`**, commit — `"Hard mode: extensions-page guard, Incognito hint, welcome and locked pages"`.

### Task 9: Store package, listing, privacy, icons, screenshots, README

**Files:**
- Create: `scripts/gen_icons.py`, `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`, `scripts/package.sh`, `scripts/store_screenshot.py`, `store/demo-studio.html`, `STORE_LISTING.md`, `PRIVACY.md`
- Modify: `manifest.json` (icons), `README.md`

- [ ] **Step 1: Icons.** `gen_icons.py` (Pillow, 4× supersampling like the author's other extension) draws the popup's eye-with-slash glyph in white on a black rounded square → 16/48/128 PNGs; add `icons` and `action.default_icon` to the manifest.
- [ ] **Step 2: `package.sh`** zips `manifest.json src icons` (excluding `.DS_Store`) into `dist/hide-metrics-<version>.zip` and lists the contents. Expected: no `tests/`, `docs/`, `store/`, `scripts/` in the zip.
- [ ] **Step 3: `PRIVACY.md`** — nothing collected; settings stored only in `chrome.storage.local`; no network requests; what each permission is for. **`STORE_LISTING.md`** — same sections as the author's other listing: name `Hide Metrics` (optional descriptor after it, no logo), summary ≤ 132 chars, category Productivity, detailed description (switches, sites, hard mode, check-in; plain, no lecturing; "Not affiliated with YouTube or Google."), privacy URL `https://github.com/dpashutskii/analytics-blocker/blob/main/PRIVACY.md` (update if the repo is renamed), data-use declaration, a justification line per permission (`storage`, `alarms`, both hosts, optional `tabs`), remote code: No.
- [ ] **Step 4: Screenshots.** `store/demo-studio.html`: a fictional "Demo Channel" Studio-like dashboard as it looks with Hide Metrics (numbers gone), with the popup composited at top-right; plus the blocked Insights page and the locked popup. Capture at 1280×800 with headless Chrome (`--headless --screenshot --window-size=1280,800`), normalize with `store_screenshot.py` (1280×800, RGB, no alpha) into `dist/`. No real channel anywhere.
- [ ] **Step 5: README** — what it does, the seven switches and two sites, hard mode, install (store link placeholder until published), load unpacked, `npm test`, debugging selectors (`HM.report`, `scripts/dev-bundle.mjs`), privacy link.
- [ ] **Step 6: Privacy scan.** `git grep -nIE 'UC[A-Za-z0-9_-]{22}|/Users/|192\.168\.' ; git log --format=%B main..HEAD | grep -nE 'UC[A-Za-z0-9_-]{22}|/Users/'` — expected: no output (the 22-char pattern in `tests/sites.test.js` uses `x`s; adjust the grep to skip it or confirm it's synthetic). Also eyeball `store/` and screenshots for real names.
- [ ] **Step 7: Final check** — `npm test` passes; `bash scripts/package.sh` builds the zip; load the zip's contents unpacked in a clean Chrome profile: welcome page opens, defaults hide everything except comments, Studio and YouTube behave as in Tasks 6–7.
- [ ] **Step 8: Commit** — `"Store: icons, package script, listing, privacy, screenshots, README"`. Then ask the author before: opening a PR, renaming the GitHub repo, and uploading to the Chrome Web Store.
