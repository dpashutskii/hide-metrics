# Privacy Policy — Hide Metrics

_Last updated: 2026-11-12_

Hide Metrics is a browser extension that hides numbers (views, subscribers,
likes, revenue, comments), stats pages and AI prompts on YouTube Studio
(studio.youtube.com) and YouTube (www.youtube.com). This policy explains
exactly what the extension does with data.

## What we collect

**Nothing.** The extension has no server, no analytics and no tracking. Nothing
is sent to the developer or to anyone else.

## Data stored on your device

Your settings are stored only in your browser with `chrome.storage.local`:

- which switches are on (Stats pages, Views, Subscribers, Revenue, Likes,
  Comments, AI features) and on which sites;
- hard mode, if you use it: when the lock ends and your weekly check-in time.

These settings stay on the device where you set them. They are not synced and
never leave your browser. Removing the extension deletes them.

## Network requests

None. The extension makes no network requests of its own and loads no remote
code. It only changes how YouTube Studio and YouTube pages look in your
browser, by hiding parts of them.

## Permissions

- `storage` — to keep your settings on this device.
- `alarms` — to end a hard-mode lock and open or close the weekly check-in on
  time.
- Access to `studio.youtube.com` and `www.youtube.com` — to hide numbers,
  stats pages and AI prompts on those two sites. It looks only at the page
  address (to recognise stats pages) and at the page's layout (to know what to
  hide); it doesn't read or keep what you watch, write or see, and sends
  nothing anywhere.
- `tabs` (optional, asked only when you turn on hard mode) — lets the
  extension notice when the browser's extensions page is opened during a lock
  and show a "locked" page instead. Chrome describes this permission as
  "Read your browsing history"; the extension only checks whether a tab is the
  extensions page and keeps no record of the pages you visit. You can decline
  it; the lock still works without it.

## Contact

Questions: open an issue at
https://github.com/dpashutskii/analytics-blocker/issues
