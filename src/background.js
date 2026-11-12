// Background service worker: the only writer of chrome.storage.local
// `state` (the settings) and `effective` (what is hidden right now).
// Content scripts read `effective`; the popup and pages send messages.
importScripts('core/schedule.js', 'core/state.js');

const ALARM = 'hm-tick';

// JSON with sorted keys, so two equal objects always compare equal.
function stable(x) {
  return JSON.stringify(x, (k, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((key) => [key, v[key]]))
      : v);
}

async function load() {
  const { state } = await chrome.storage.local.get('state');
  return HM.normalizeState(state);
}

async function save(state) {
  const now = Date.now();
  const s = HM.settle(HM.normalizeState(state), now);
  const effective = HM.computeEffective(s, now);
  await chrome.storage.local.set({ state: s, effective });
  const when = HM.nextTransition(s, now);
  if (when == null) await chrome.alarms.clear(ALARM);
  else await chrome.alarms.create(ALARM, { when });
  return { state: s, effective, now };
}

async function refresh() {
  return save(await load());
}

// One change at a time, so a message and a storage edit can't interleave.
let chain = Promise.resolve();
function queue(fn) {
  const run = chain.then(fn);
  chain = run.catch((err) => console.error('Hide Metrics:', err));
  return run;
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (sender.id !== chrome.runtime.id) return;
  if (msg?.type === 'get') {
    queue(refresh).then(reply, () => reply(null));
    return true;
  }
  if (msg?.type === 'action') {
    queue(async () => save(HM.reduce(await load(), msg.action, Date.now()))).then(reply, () => reply(null));
    return true;
  }
});

// Edits made outside this worker (for example from DevTools) can't loosen a
// lock, and `effective` always follows `state`. This worker's own writes pass
// both checks unchanged, so they cause no further writes.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  const now = Date.now();
  if (changes.state) {
    const raw = changes.state.newValue;
    const fixed = HM.enforceLock(HM.normalizeState(changes.state.oldValue), HM.normalizeState(raw), now);
    queue(async () => {
      if (stable(fixed) !== stable(raw)) return save(fixed);
      const cur = await chrome.storage.local.get(['state', 'effective']);
      if (stable(cur.state) === stable(raw) && stable(cur.effective) !== stable(HM.computeEffective(fixed, Date.now()))) {
        return save(fixed);
      }
    });
  } else if (changes.effective) {
    queue(async () => {
      const expected = HM.computeEffective(HM.settle(await load(), Date.now()), Date.now());
      if (stable(changes.effective.newValue) !== stable(expected)) return refresh();
    });
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) queue(refresh);
});

// Chrome may have been closed across a lock end or a check-in boundary.
chrome.runtime.onStartup.addListener(() => queue(refresh));

chrome.runtime.onInstalled.addListener(() => {
  queue(refresh);
});
