# Chrome Web Store listing — copy & answers

Paste these into the Web Store developer dashboard during submission.

## Name (≤ 75 chars)

```
Hide Metrics: views, likes and YouTube Studio stats
```

(Short name if a shorter one is needed: `Hide Metrics`.)

## Summary / short description (≤ 132 chars)

```
Hide views, subscribers, likes, revenue and stats pages on YouTube Studio and YouTube, with an optional lock until a date.
```

## Category

`Productivity`

## Language

English (UK)

## Detailed description

```
Hide Metrics takes the numbers off YouTube Studio and YouTube, so you can make
and watch videos without checking how they're doing.

Choose what to hide:
• Stats pages: Studio's Insights pages, live subscriber count and realtime data
• Views
• Subscribers
• Revenue
• Likes
• Comments (counts and the comment section; off by default)
• AI features: Ask Studio, "Catch me up", AI suggestions and summaries

Choose where:
• YouTube Studio
• YouTube (everyone's videos, not just your own)

Hidden things are simply gone: no grey bars, no blur, no "show anyway" button.
Open a stats page and you'll see a quiet page saying it's hidden.

HARD MODE
Lock your choices until a date and time. While locked, switches can only be
turned on, and the lock can only be extended. Add an optional weekly check-in,
for example Sunday 10:00 for 30 minutes, when your numbers come back for a
while (AI features stay hidden).

PRIVATE BY DESIGN
No account, no server, no analytics. Settings stay in your browser on this
device. The extension makes no network requests.

Not affiliated with YouTube or Google.
```

## Privacy

- **Single purpose:** Hide numbers, stats pages and AI prompts on YouTube Studio
  and YouTube.
- **Privacy policy URL:**
  `https://github.com/dpashutskii/analytics-blocker/blob/main/PRIVACY.md`
  (update if the repository is renamed)
- **Data collection:** Declare "does NOT collect or use user data" (no
  analytics, no server). Settings are stored locally via chrome.storage.local.

### Permission justifications (paste into the review form)

- **storage** — Save the user's switches, sites and hard-mode settings on this
  device.
- **alarms** — End a hard-mode lock and open/close the weekly check-in at the
  chosen times, even when no YouTube tab is open.
- **Host: studio.youtube.com** — Hide metrics, Insights pages and AI prompts in
  YouTube Studio with CSS and a full-page notice. Nothing is read or sent.
- **Host: www.youtube.com** — Hide view, subscriber, like and comment counts on
  YouTube pages. Nothing is read or sent.
- **Optional: tabs** — Requested only when the user turns on hard mode. Used to
  detect the browser's extensions page during a lock and replace it with a
  "locked" page. No browsing data is stored or sent. The lock works without it
  if declined.
- **Remote code:** No. All code is bundled in the package.

## Assets

- **Screenshots (1280×800):** built from a made-up demo channel, not a real
  Studio. Regenerate with the steps in the README ("Store screenshots"); they
  land in `dist/`.
- **Small promo tile (optional):** 440×280.
- The 128×128 store icon is taken from the packaged `icons/icon128.png`.
