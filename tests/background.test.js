// Runs src/background.js against a small in-memory stand-in for the chrome.*
// APIs it uses, to check the storage rules without a browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = (f) => fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
const tick = () => new Promise((r) => setTimeout(r, 15));
async function idle() { for (let i = 0; i < 8; i++) await tick(); }

function boot(initial = {}, opts = {}) {
  const data = structuredClone(initial);
  const on = { changed: [], message: [], alarm: [], startup: [], installed: [], tabUpdated: [], permAdded: [] };
  const alarms = new Map();
  const tabs = { list: [], updated: [], removed: [], created: [], failUpdate: false, granted: opts.granted ?? true };
  const event = (list) => ({ addListener: (f) => list.push(f) });
  const chrome = {
    runtime: { id: 'test-ext', getURL: (p) => `chrome-extension://test-ext/${p}`, onMessage: event(on.message), onStartup: event(on.startup), onInstalled: event(on.installed) },
    tabs: {
      onUpdated: event(on.tabUpdated),
      async query() { return tabs.granted ? structuredClone(tabs.list) : tabs.list.map(({ id }) => ({ id })); },
      async update(id, props) { if (tabs.failUpdate) throw new Error('cannot'); tabs.updated.push([id, props.url]); },
      async remove(id) { tabs.removed.push(id); },
      async create(props) { tabs.created.push(props.url); },
    },
    permissions: {
      async contains() { return tabs.granted; },
      onAdded: event(on.permAdded),
    },
    storage: {
      local: {
        async get(keys) {
          const out = {};
          for (const k of keys == null ? Object.keys(data) : [].concat(keys)) if (k in data) out[k] = structuredClone(data[k]);
          return out;
        },
        async set(obj) {
          const changes = {};
          for (const [k, v] of Object.entries(obj)) {
            if (JSON.stringify(data[k]) === JSON.stringify(v)) continue; // Chrome skips unchanged values
            changes[k] = { oldValue: data[k], newValue: structuredClone(v) };
            data[k] = structuredClone(v);
          }
          if (Object.keys(changes).length) setTimeout(() => on.changed.forEach((f) => f(structuredClone(changes), 'local')));
        },
      },
      onChanged: event(on.changed),
    },
    alarms: {
      async create(name, info) { alarms.set(name, info.when); },
      async clear(name) { alarms.delete(name); },
      onAlarm: event(on.alarm),
    },
  };
  const ctx = vm.createContext({ chrome, console, setTimeout });
  ctx.importScripts = (...files) => files.forEach((f) => vm.runInContext(src(f), ctx));
  vm.runInContext(src('background.js'), ctx);
  const send = (msg) => new Promise((resolve) => {
    const keep = on.message.map((f) => f(msg, { id: 'test-ext' }, resolve));
    assert.ok(keep.includes(true));
  });
  return { data, on, alarms, tabs, chrome, send, HM: ctx.HM };
}

test('install writes defaults and effective', async () => {
  const b = boot();
  b.on.installed.forEach((f) => f({ reason: 'install' }));
  await idle();
  assert.deepEqual(b.data.state, structuredClone(b.HM.defaultState()));
  assert.equal(b.data.effective.hide.views, true);
  assert.equal(b.data.effective.hide.comments, false);
  assert.equal(b.alarms.size, 0);
});

test('actions go through the lock rules and schedule the next change', async () => {
  const b = boot();
  const until = Date.now() + 36e5;
  const res = await b.send({ type: 'action', action: { type: 'lock', until, checkIn: null, guard: false } });
  assert.equal(res.state.lock.until, until);
  assert.equal(b.alarms.get('hm-tick'), until);
  const after = await b.send({ type: 'action', action: { type: 'set', path: ['hide', 'views'], value: false } });
  assert.equal(after.state.hide.views, true);
  const got = await b.send({ type: 'get' });
  assert.equal(got.effective.lock.until, until);
  await idle();
});

test('editing state in storage while locked is reverted', async () => {
  const b = boot();
  await b.send({ type: 'action', action: { type: 'lock', until: Date.now() + 6e5, checkIn: null, guard: false } });
  await idle();
  const edited = structuredClone(b.data.state);
  edited.hide.views = false;
  edited.lock = null;
  await b.chrome.storage.local.set({ state: edited });
  await idle();
  assert.equal(b.data.state.hide.views, true);
  assert.ok(b.data.state.lock);
  assert.equal(b.data.effective.hide.views, true);
});

test('editing effective directly is reverted', async () => {
  const b = boot();
  b.on.installed.forEach((f) => f({ reason: 'install' }));
  await idle();
  const eff = structuredClone(b.data.effective);
  eff.hide.views = false;
  await b.chrome.storage.local.set({ effective: eff });
  await idle();
  assert.equal(b.data.effective.hide.views, true);
});

test('allowed edits while unlocked update effective', async () => {
  const b = boot();
  b.on.installed.forEach((f) => f({ reason: 'install' }));
  await idle();
  const s = structuredClone(b.data.state);
  s.hide.views = false;
  await b.chrome.storage.local.set({ state: s });
  await idle();
  assert.equal(b.data.state.hide.views, false);
  assert.equal(b.data.effective.hide.views, false);
});

test('starting Chrome after the lock ended clears it at once', async () => {
  const b = boot();
  const s = b.HM.defaultState();
  s.lock = { until: Date.now() - 1000, checkIn: null, guard: false, skipUntil: null };
  const eff = b.HM.computeEffective(s, Date.now() - 2000);
  Object.assign(b.data, { state: s, effective: eff });
  assert.ok(b.data.effective.lock);
  b.on.startup.forEach((f) => f());
  await idle();
  assert.equal(b.data.state.lock, null);
  assert.equal(b.data.effective.lock, null);
  assert.equal(b.data.state.hide.views, true); // switches stay as they were
});

test('rapid actions are not undone by late change events', async () => {
  const b = boot();
  await Promise.all([
    b.send({ type: 'action', action: { type: 'set', path: ['hide', 'likes'], value: false } }),
    b.send({ type: 'action', action: { type: 'set', path: ['hide', 'views'], value: false } }),
    b.send({ type: 'action', action: { type: 'set', path: ['hide', 'likes'], value: true } }),
  ]);
  await idle();
  assert.equal(b.data.state.hide.likes, true);
  assert.equal(b.data.state.hide.views, false);
});

const LOCKED_PAGE = 'chrome-extension://test-ext/src/pages/locked.html';
const lockFor = (b, guard = true) => b.send({ type: 'action', action: { type: 'lock', until: Date.now() + 6e5, checkIn: null, guard } });
// With `tabs` granted Chrome reports the new URL; without it, changeInfo has no url.
const navigate = (b, id, url) => b.on.tabUpdated.forEach((f) => f(id, b.tabs.granted ? { url } : { status: 'loading' }, b.tabs.granted ? { id, url } : { id }));

test('locked: opening the extensions page lands on the locked page', async () => {
  const b = boot();
  await lockFor(b);
  navigate(b, 7, 'chrome://extensions/');
  navigate(b, 8, 'brave://extensions/?id=abc');
  navigate(b, 9, 'https://example.com/');
  await idle();
  assert.deepEqual(b.tabs.updated, [[7, LOCKED_PAGE], [8, LOCKED_PAGE]]);
});

test('not locked: the extensions page opens normally', async () => {
  const b = boot();
  navigate(b, 7, 'chrome://extensions/');
  await idle();
  assert.deepEqual(b.tabs.updated, []);
});

test('lock without the guard does not touch the extensions page', async () => {
  const b = boot();
  await lockFor(b, false);
  navigate(b, 7, 'chrome://extensions/');
  await idle();
  assert.deepEqual(b.tabs.updated, []);
});

test('without the tabs permission the lock still works and nothing is guarded', async () => {
  const b = boot({}, { granted: false });
  const res = await lockFor(b);
  assert.ok(res.state.lock);
  navigate(b, 7, 'chrome://extensions/');
  await idle();
  assert.deepEqual(b.tabs.updated, []);
});

test('locking closes an extensions page that is already open', async () => {
  const b = boot();
  b.tabs.list = [{ id: 3, url: 'chrome://extensions/' }, { id: 4, url: 'https://studio.youtube.com/' }];
  await lockFor(b);
  await idle();
  assert.deepEqual(b.tabs.updated, [[3, LOCKED_PAGE]]);
});

test('if the tab cannot be redirected it is closed', async () => {
  const b = boot();
  await lockFor(b);
  b.tabs.failUpdate = true;
  navigate(b, 7, 'edge://extensions');
  await idle();
  assert.deepEqual(b.tabs.removed, [7]);
});

test('welcome page opens on install only', async () => {
  const b = boot();
  b.on.installed.forEach((f) => f({ reason: 'update' }));
  await idle();
  assert.deepEqual(b.tabs.created, []);
  b.on.installed.forEach((f) => f({ reason: 'install' }));
  await idle();
  assert.deepEqual(b.tabs.created, ['chrome-extension://test-ext/src/pages/welcome.html']);
});
