# Hide Metrics — design

Date: 2026-11-12
Status: draft, awaiting approval

## Why

Creators get pulled into checking numbers: views, subscribers, revenue, how the
latest upload is doing. The checking is impulsive, it changes the mood of the
day, and it steers what gets made. Viewers get the same pull from other
people's numbers on youtube.com.

This repo started as "Focus Blocker for Creators" (v0.2.0), a small extension
that hid parts of YouTube Studio. Since then YouTube redesigned Studio
(Analytics is now "Insights", with AI summaries and an "Ask Studio" chat), so
most of the old hiding no longer matches the page. This is a full redesign and
the first public release on the Chrome Web Store, under a new, site-neutral
name: **Hide Metrics**.

Prior art: *Goodbye Metrics* by Slow Growth did much of this (own Studio cards
plus other creators' numbers), had ~2,200 users and 4.8 stars, was last updated
in 2022, and was removed from the Chrome Web Store in September 2025. Users
complained it missed some counts and broke after a YouTube update. Other live
extensions are narrow: "YT Studio Focus Mode" (two dashboard cards), "Hide
YouTube Statistics" (Studio cards, subscriber rounding). None has a lock, none
hides AI features, none is built to cover other sites.

## Goals

- Hide metrics by **type**, not by individual card: a handful of switches that
  each mean the same thing everywhere.
- Work on **YouTube Studio** and **youtube.com** (everyone's videos, not just
  your own). Built so more sites (Substack, social sites) can be added later as
  one more row in the popup.
- A **hard mode** that can't be casually switched off: locked until a chosen
  date and time, with an optional weekly check-in window.
- Hidden things **disappear completely**. No placeholders, no blur.
- Calm, black-and-white, minimal look, light and dark.
- Published on the Chrome Web Store, free, the same way as the author's
  existing extension (listing copy, privacy page, zip script, icons).
- Keep the repo **public** and free of private information.

## Non-goals (v1)

- Sites other than YouTube Studio and youtube.com. The structure must allow
  them; the code for them is not part of v1.
- Firefox, Safari, mobile apps. (Chrome-based browsers that install from the
  Chrome Web Store, like Edge, Brave and Arc, should just work.)
- Per-card or per-element switches.
- Accounts, sync servers, analytics, or any network calls of our own.

## Anti-goals

- **Tease UI.** Grey bars, blurred numbers, "123 hidden" badges, or a "show
  anyway" button on the blocked page. Each of these keeps the number on your
  mind.
- **Preachy copy.** The blocked page states facts (what's hidden, when the lock
  ends); it does not lecture.
- **Switch sprawl.** If a new site needs new switches, that's a design problem,
  not a reason to grow the list.
- **Silent breakage.** Goodbye Metrics broke quietly when YouTube changed.
  Updating site-specific hiding must be quick, and breakage should be
  noticeable.
- **Private data in the repo.** No real channel names, channel or video IDs,
  real numbers, screenshots of a real Studio, local paths, or links to private
  repos, in new files or commit messages. (Existing history has one old
  README line with a local folder path that only shows the author's GitHub
  username; the author chose to leave history as is, so no rewrite or
  force-push.)

## The switches

Seven switches under **Hide**, then a list of sites under **On**.

| Switch | YouTube Studio | youtube.com |
|---|---|---|
| **Stats pages** | All Insights pages, channel and per video, including Advanced mode. Insights entries in the sidebar and "Go to channel insights" / "View realtime data" style buttons. | YouTube's own analytics URLs, if any are reachable. |
| **Views** | View counts, watch time, "watched right now" / realtime, top-content lists ranked by views, Views column in Content. | View counts on thumbnails, watch page, channel pages, search, playlists, "watching now" on lives. |
| **Subscribers** | Current subscribers, gained/lost, "View live count", Recent subscribers card. | Subscriber counts on channel pages, under videos, in search. |
| **Revenue** | Estimated revenue everywhere, including the Content list column and any revenue on the dashboard. | — |
| **Likes** | Like counts on videos and posts. | Like counts on videos, posts, comments. |
| **Comments** | Comment counts, the dashboard Comments card, the Community → Comments inbox. | Comment counts and the comment section under videos. |
| **AI features** | "Ask Studio" button and chat, "Catch me up on this video", AI summary cards ("Insights from Ask Studio"), and other AI prompts Studio shows, including in upload and edit screens. | AI entry points on the watch page (e.g. "Ask" about a video, AI comment summaries) where present. |

Notes:

- A card that contains only hidden numbers is removed entirely (e.g. the
  dashboard "Channel analytics" card when Views, Subscribers and Revenue are
  all on). A card that mixes content and numbers keeps the content and loses
  the numbers (e.g. "Published videos" keeps titles and thumbnails).
- Stats pages is a page-level block: on Studio's new Insights pages the numbers
  carry no type markers in the page code, only a visible label, so hiding just
  "views" there would mean matching English text. Instead, the whole page is
  blocked. Everywhere else, switches work by page structure, not by text, so
  they work in any Studio language.
- **When a number can't be separated from the text around it** (for example
  "1.2K views • 3 days ago" under a video, or "@handle • 6K subscribers •
  120 videos" on a channel page): first try to separate it by page structure
  (they are usually separate elements). If that's impossible, **hide the whole
  line** rather than leave the number showing. No word matching in v1, so
  everything works in any language.
- **Notifications** (e.g. Studio's "your channel reached N subscribers") are
  not covered in v1; a known gap.
- Revenue and Stats pages simply do nothing on youtube.com where those don't
  exist.
- A top switch in the popup header pauses everything (not available while
  locked).

**Defaults on install** (builder's call can tweak, but this is the intent):
Stats pages, Views, Subscribers, Revenue, Likes and AI features on; Comments
off (it hides the actual comments, not just a number); both sites on.

## Where (sites)

Under **On**: YouTube Studio (`studio.youtube.com`) and YouTube
(`www.youtube.com`), each with its own switch. Adding a site later means one
new row here plus one new site module (see Structure); the seven switches stay
the same.

## Hard mode

Set from the popup's "Hard mode" row.

- **Lock until** a date **and time** (local time). Quick picks: Tomorrow,
  1 week, Until a date.
- While locked:
  - Switches, sites and the pause switch can only be turned **on**, not off.
  - The lock can be **extended**, never shortened.
  - The weekly check-in schedule can't be changed (otherwise you'd move it to
    "now").
- **Weekly check-in** (optional): a day, a start time and a length
  (e.g. Sunday 10:00, 30 min). During the window, every metric switch is
  temporarily lifted and stats pages open; **AI features stay hidden**. The
  popup shows a countdown and an "End check-in now" button. Check-ins only
  exist as part of hard mode.
- When the lock ends: switches stay exactly as they are, they just become
  changeable again.
- **Guarding Chrome's extensions page:** while locked, if
  `chrome://extensions` is opened, the extension closes it (or replaces it with
  the blocked page saying when the lock ends). This needs the `tabs`
  permission, which makes Chrome say "Read your browsing history". So `tabs` is
  an **optional** permission, requested only when turning hard mode on; if
  declined, the lock still works without the guard. The install itself shows no
  such warning.
- **Incognito:** extensions don't run there unless allowed, and allowing it
  happens on the extension's own `chrome://extensions` page, which the guard
  closes while locked. So it's a step in hard-mode **setup**: if the extension
  isn't allowed in Incognito, setup says so and shows how to allow it before
  locking (the user may skip it). While locked, the popup only shows a quiet
  row that it isn't running in Incognito and can be allowed after the lock
  ends.
- **Accepted gaps** (the author knows and accepts these): anyone can still
  remove the extension via right-click on its toolbar icon → "Remove from
  Chrome", or switch off its site access from Chrome's toolbar menus; other
  browsers and the YouTube Studio phone app aren't covered; the lock trusts
  the device clock. The lock doesn't try to detect or fight these.
- The guard also covers the equivalent pages in other Chrome-based browsers
  (`edge://extensions`, `brave://extensions`) and keeps running during a
  check-in. Locking also clears the pause switch.
- **Storage is per device** (`chrome.storage.local`), not synced: a lock set
  on one computer applies to that computer only, and settings don't follow
  the user to other devices. (Decided by the designer; simpler and
  predictable. Reinstalling resets everything, which falls under the accepted
  "Remove from Chrome" gap.)

## Look

Black-and-white, minimal, Apple-like polish. Grouped rows separated by thin
lines (no "·" chains), very little helper text. Light and dark following the
system. Mockups are in
[`2026-11-12-hide-metrics-mockups/`](2026-11-12-hide-metrics-mockups/) —
open the HTML files in a browser:

- `popup-sites.html` — **option A ("What + where") is the chosen popup
  layout**: header with name and pause switch, "Hide" group with the seven
  switches, "On" group with the sites, then a "Hard mode" row. Option B was
  rejected.
- `popup-states.html` — the four states of the popup: normal, setting hard
  mode, locked, during check-in. Its switch list predates two changes: the
  first switch is now **"Stats pages"** (not "Insights"), and the "On" sites
  group from `popup-sites.html` A goes above "Hard mode". Otherwise these
  states are as approved.
- `hidden-look.html` — **option A ("Gone") is chosen**: numbers and
  all-number cards disappear; option B (grey bars) was rejected. The lower
  half shows the **blocked page** that replaces any stats page: icon,
  "Insights are hidden" (using the site's own word for its stats), "Your
  numbers will still be here later.", lock end and next check-in rows (only in
  hard mode), and a single "Back to Studio" button. No "show anyway".

## Structure (intent)

- Manifest V3, plain JavaScript/HTML/CSS, no framework, no build step needed
  to load unpacked (same as the existing code and the author's other
  extension). The builder may add a small dev-only test setup.
- **Site modules:** everything YouTube-specific (URL patterns, element
  selectors, which switch each selector belongs to) lives in one file per site
  (e.g. `sites/youtube-studio.js`, `sites/youtube.js`). The rest of the code
  (settings, lock, check-in, popup) knows nothing about YouTube. A new site =
  a new module + a row in "On".
- **Settings, lock and check-in logic** in one small, testable module.
- **Hiding:** CSS injected at `document_start` so nothing flashes, using
  `:has()` to remove whole cards; JavaScript only where CSS can't reach.
  Content scripts react live to setting changes and to check-in windows
  opening and closing (no reload needed).
- **Blocking stats pages:** Studio is a single-page app, so in-app navigation
  to Insights never hits the network. Blocking must work both on full page
  loads and on in-app navigation.
- **Lock enforcement** lives in the background service worker, not only in the
  popup: if a setting is loosened while locked (by any route), it's reverted.
  Timers (`chrome.alarms`) handle lock end and check-in start/end.
- **Breakage signal:** a way to notice when YouTube changes its pages and a
  selector stops matching — at minimum a dev script that lists which selectors
  matched nothing on the current page. Builder decides the mechanism; the
  intent is that fixes are quick and the author finds out early.
- Permissions: `storage`, `alarms`, plus whatever hiding/blocking needs; host
  access only to `studio.youtube.com` and `www.youtube.com`; `tabs` optional
  (see Hard mode). No remote code, no network requests.

## Observed Studio structure (2026-11-12)

For orientation only; verify against the live page before relying on it.

- Sidebar: Dashboard, Content, **Insights** (`/channel/<id>/analytics/hub_overview`),
  Community (`/channel/<id>/comments/inbox`), Earn, …
- Per-video Insights: `/video/<id>/analytics/...`.
- Dashboard still uses the older components: `ytcd-channel-dashboard`,
  `ytcd-card`, `ytcd-entity-snapshot-item` / `yta-entity-snapshot` (latest
  video performance), `ytcd-recent-videos-item` +
  `ytcd-video-list-cell-video-light` (published videos), `ytcd-channel-facts-item`
  (channel analytics), `ytcd-post-snapshot-item` + `ytcd-post-stats-item`
  (latest post), `ytcd-comments-snapshot-item`, `ytcd-recent-activity-item` /
  `ytcd-recent-activity-subscribers`.
- Content list: `ytcp-video-row` cells `.tablecell-views`, `.tablecell-revenue`,
  `.tablecell-comments`; headers in `ytcp-table-header`.
- New Insights pages use generic components with no metric type in the markup:
  `ytcp-simple-metric-view-model`, `ytcp-line-chart-view-model`,
  `ytcp-bar-chart-view-model`, `ytcp-ask-studio-card-view-model`.
- AI entry points: header "Ask Studio" (`ytcp-creator-chat-trigger`,
  `ytcp-creator-chat-spark`, `ytcp-sam-chat`), dashboard "Catch me up"
  (`ytcp-creator-chat-entrypoint-button`).
- Earn overview shows no numbers.

The old code in this repo (`config.js` selectors, DNR redirect rules) is a
useful reference but is not to be preserved; v1 replaces it.

## Publishing

Follow the same shape as the author's other Chrome Web Store extension:

- `STORE_LISTING.md` with the store name, summary (≤132 chars), category,
  detailed description and the permission justifications. Store name:
  "Hide Metrics" (a short descriptor after it is fine, e.g. "Hide Metrics:
  views, likes and YouTube Studio stats"; no YouTube logo).
- `PRIVACY.md`: no data collected, nothing leaves the browser. The store's
  privacy policy URL points to this file on GitHub.
- `scripts/package.sh` that zips only the shipped files into `dist/`.
- Icons at 16/48/128, black-and-white, matching the popup's icon.
- Store screenshots made from a **made-up demo channel** (a static demo page
  is fine), never a real Studio.
- A small welcome page opened on install: what it does, a hint to pin the
  icon, and the switches.
- Version 1.0.0. The author has an existing Chrome Web Store developer
  account; no new cost.
- README rewritten for the new name.
- Renaming the GitHub repo (e.g. to `hide-metrics`) is wanted but is an
  outward-facing step: ask the author before doing it.

## Left to the builder

- File layout beyond "one module per site" and "one settings/lock module".
- Exact selectors and how to hide each thing on the live pages, including
  anything new found while building that fits a switch.
- Exact wording of the welcome page and store listing (plain, short, no
  lecturing).
- Quick-pick definitions (e.g. what "Tomorrow" means) and check-in length
  options.
- How the breakage signal works.
- Test approach. Logic (lock, only-on rule, check-in windows, extend-only)
  should have tests; page hiding is verified by hand on the live sites. Any
  test fixtures must be synthetic, never copied from a real channel.
