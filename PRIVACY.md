# Privacy Policy — Hide Metrics

_Last updated: 2026-11-23_

Published at https://tacodigest.com/hide-metrics/privacy

Hide Metrics is a free browser extension made by Taco Digest. It hides
numbers (views, subscribers, likes, revenue, comments), stats pages and AI
prompts on YouTube Studio (studio.youtube.com) and YouTube (www.youtube.com).
This policy explains exactly what the extension does with data.

## What we collect

**Nothing.** The extension has no server, no analytics and no tracking. Nothing
is sent to the developer or to anyone else.

## Data stored on your device

Your settings are stored only in your browser with `chrome.storage.local`:

- which switches are on (Stats pages, Views, Subscribers, Revenue, Likes,
  Comments, AI features, Promotions) and on which sites;
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
  address (to recognise stats pages), at the page's layout (to know what to
  hide) and, on Studio's Insights pages, at the card titles (like "Views") to
  match them to your switches. It doesn't keep or send anything it sees.
- `tabs` (optional, asked only when you turn on hard mode) — lets the
  extension notice when the browser's extensions page is opened during a lock
  and show a "locked" page instead. Chrome describes this permission as
  "Read your browsing history"; the extension only checks whether a tab is the
  extensions page and keeps no record of the pages you visit. You can decline
  it; the lock still works without it.

## Who makes it

ShiBoba (Taco Digest), Wiborgeiland 130, 1014 ZC Amsterdam, the Netherlands.
Questions about this policy: support@tacodigest.com. To report a problem with
the extension, open an issue at https://github.com/shi-boba/hide-metrics/issues
