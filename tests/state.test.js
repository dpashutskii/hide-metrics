import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/core/schedule.js';
import '../src/core/state.js';

const HM = globalThis.HM;
const U = Date.UTC;
const ci = { day: 0, startMin: 600, lengthMin: 30 }; // Sunday 10:00, 30 min
const T = U(2026, 10, 30, 9, 0); // lock end, Mon 30 Nov 09:00
const NOW = U(2026, 10, 12, 12, 0); // Thu 12 Nov 12:00
const SUN_1010 = U(2026, 10, 15, 10, 10);
const lockAction = { type: 'lock', until: T, checkIn: ci, guard: true };
const locked = HM.reduce(HM.defaultState(), lockAction, NOW);
const set = (path, value) => ({ type: 'set', path, value });

test('switches and sites, in order', () => {
  assert.deepEqual(HM.SWITCHES.map((s) => [s.id, s.label]), [
    ['statsPages', 'Stats pages'], ['views', 'Views'], ['subscribers', 'Subscribers'], ['revenue', 'Revenue'],
    ['likes', 'Likes'], ['comments', 'Comments'], ['aiFeatures', 'AI features'], ['promotions', 'Promotions'],
  ]);
  assert.deepEqual(HM.SITES.map((s) => [s.id, s.label]), [['youtubeStudio', 'YouTube Studio'], ['youtube', 'YouTube']]);
});

test('defaults', () => {
  const s = HM.defaultState();
  assert.equal(s.v, 1);
  for (const { id } of HM.SWITCHES) assert.equal(s.hide[id], id !== 'comments', id);
  assert.deepEqual(s.sites, { youtubeStudio: true, youtube: true });
  assert.equal(s.paused, false);
  assert.equal(s.lock, null);
});

test('settings saved before Promotions existed get it switched on', () => {
  const old = { v: 1, paused: false, hide: { statsPages: true, views: false, subscribers: true, revenue: true, likes: true, comments: false, aiFeatures: true }, sites: { youtubeStudio: true, youtube: true }, lock: null };
  const s = HM.normalizeState(old);
  assert.equal(s.hide.promotions, true);
  assert.equal(s.hide.views, false);
});

test('normalize drops junk', () => {
  const s = HM.normalizeState({ hide: { views: false, bogus: true }, sites: 'x', extra: 1 });
  assert.equal(s.hide.views, false);
  assert.equal(s.hide.subscribers, true);
  assert.equal('bogus' in s.hide, false);
  assert.equal('extra' in s, false);
  assert.deepEqual(s.sites, HM.defaultState().sites);
  assert.deepEqual(HM.normalizeState(undefined), HM.defaultState());
  assert.deepEqual(HM.normalizeState('nope'), HM.defaultState());
});

test('normalize keeps a valid lock and rejects a broken one', () => {
  assert.deepEqual(HM.normalizeState(locked).lock, locked.lock);
  assert.equal(HM.normalizeState({ lock: { until: 'soon' } }).lock, null);
  const badCheckIn = HM.normalizeState({ lock: { until: T, checkIn: { day: 9, startMin: 600, lengthMin: 30 }, guard: true } });
  assert.equal(badCheckIn.lock.until, T);
  assert.equal(badCheckIn.lock.checkIn, null);
});

test('lock bounds', () => {
  assert.equal(HM.isLocked(locked, T - 1), true);
  assert.equal(HM.isLocked(locked, T), false);
  assert.equal(HM.isLocked(HM.defaultState(), NOW), false);
  assert.deepEqual(locked.lock, { until: T, checkIn: ci, guard: true, skipUntil: null });
});

test('switches change freely when not locked', () => {
  const s = HM.reduce(HM.defaultState(), set(['hide', 'views'], false), NOW);
  assert.equal(s.hide.views, false);
  assert.equal(HM.reduce(s, set(['paused'], true), NOW).paused, true);
  assert.equal(HM.reduce(s, set(['sites', 'youtube'], false), NOW).sites.youtube, false);
});

test('unknown paths are ignored', () => {
  const s = HM.reduce(HM.defaultState(), set(['hide', 'bogus'], false), NOW);
  assert.deepEqual(s, HM.defaultState());
  assert.deepEqual(HM.reduce(HM.defaultState(), { type: 'nope' }, NOW), HM.defaultState());
});

test('only-on while locked', () => {
  assert.equal(HM.reduce(locked, set(['hide', 'views'], false), NOW).hide.views, true);
  assert.equal(HM.reduce(locked, set(['hide', 'comments'], true), NOW).hide.comments, true);
  assert.equal(HM.reduce(locked, set(['sites', 'youtube'], false), NOW).sites.youtube, true);
  assert.equal(HM.reduce(locked, set(['paused'], true), NOW).paused, false);
});

test('a site switched off before locking can be switched on but not off again', () => {
  const offSite = HM.reduce(HM.defaultState(), set(['sites', 'youtube'], false), NOW);
  const l = HM.reduce(offSite, lockAction, NOW);
  const on = HM.reduce(l, set(['sites', 'youtube'], true), NOW);
  assert.equal(on.sites.youtube, true);
  assert.equal(HM.reduce(on, set(['sites', 'youtube'], false), NOW).sites.youtube, true);
});

test('lock clears pause', () => {
  const paused = HM.reduce(HM.defaultState(), set(['paused'], true), NOW);
  assert.equal(HM.reduce(paused, lockAction, NOW).paused, false);
});

test('lock in the past is ignored', () => {
  assert.equal(HM.reduce(HM.defaultState(), { ...lockAction, until: NOW - 1 }, NOW).lock, null);
});

test('lock while locked is ignored', () => {
  const again = HM.reduce(locked, { type: 'lock', until: T + 864e5, checkIn: null, guard: false }, NOW);
  assert.deepEqual(again.lock, locked.lock);
});

test('extend', () => {
  assert.equal(HM.reduce(locked, { type: 'extend', until: T + 1 }, NOW).lock.until, T + 1);
  assert.equal(HM.reduce(locked, { type: 'extend', until: T - 1 }, NOW).lock.until, T);
  assert.equal(HM.reduce(HM.defaultState(), { type: 'extend', until: T }, NOW).lock, null);
});

test('storage edits are reverted', () => {
  assert.equal(HM.enforceLock(locked, { ...locked, lock: null }, NOW).lock.until, T);
  const moved = { ...locked, lock: { ...locked.lock, checkIn: { day: 4, startMin: 700, lengthMin: 60 } } };
  assert.deepEqual(HM.enforceLock(locked, moved, NOW).lock.checkIn, ci);
  const dropped = { ...locked, lock: { ...locked.lock, checkIn: null } };
  assert.deepEqual(HM.enforceLock(locked, dropped, NOW).lock.checkIn, ci);
  const shorter = { ...locked, lock: { ...locked.lock, until: NOW + 1 } };
  assert.equal(HM.enforceLock(locked, shorter, NOW).lock.until, T);
  const noGuard = { ...locked, lock: { ...locked.lock, guard: false } };
  assert.equal(HM.enforceLock(locked, noGuard, NOW).lock.guard, true);
  const viewsOff = { ...locked, hide: { ...locked.hide, views: false } };
  assert.equal(HM.enforceLock(locked, viewsOff, NOW).hide.views, true);
  const pausedNow = { ...locked, paused: true };
  assert.equal(HM.enforceLock(locked, pausedNow, NOW).paused, false);
  const siteOff = { ...locked, sites: { ...locked.sites, youtubeStudio: false } };
  assert.equal(HM.enforceLock(locked, siteOff, NOW).sites.youtubeStudio, true);
  // reopening a check-in that was ended early
  const ended = HM.reduce(locked, { type: 'endCheckIn' }, SUN_1010);
  const reopened = { ...ended, lock: { ...ended.lock, skipUntil: null } };
  assert.equal(HM.enforceLock(ended, reopened, SUN_1010).lock.skipUntil, ended.lock.skipUntil);
});

test('storage edits that tighten are kept', () => {
  const tighter = { ...locked, hide: { ...locked.hide, comments: true }, lock: { ...locked.lock, until: T + 1, skipUntil: SUN_1010 } };
  assert.deepEqual(HM.enforceLock(locked, tighter, NOW), tighter);
});

test('enforceLock does nothing when not locked', () => {
  const next = { ...HM.defaultState(), paused: true };
  assert.equal(HM.enforceLock(HM.defaultState(), next, NOW), next);
  assert.equal(HM.enforceLock(locked, next, T), next); // lock already over
});

test('check-in opens numbers but not AI or promotions', () => {
  const e = HM.computeEffective(locked, SUN_1010);
  for (const { id } of HM.SWITCHES) assert.equal(e.hide[id], id === 'aiFeatures' || id === 'promotions', id);
  assert.equal(e.lock.checkInOpen, true);
  assert.equal(e.lock.checkInEndsAt, U(2026, 10, 15, 10, 30));
  assert.equal(e.lock.until, T);
});

test('check-in keeps AI visible if AI features was off', () => {
  const aiOff = HM.reduce(HM.reduce(HM.defaultState(), set(['hide', 'aiFeatures'], false), NOW), lockAction, NOW);
  assert.equal(HM.computeEffective(aiOff, SUN_1010).hide.aiFeatures, false);
});

test('locked outside check-in hides as set', () => {
  const e = HM.computeEffective(locked, NOW);
  assert.deepEqual(e.hide, locked.hide);
  assert.deepEqual(e.lock, { until: T, checkInOpen: false, checkInEndsAt: null, nextCheckIn: U(2026, 10, 15, 10, 0) });
});

test('end check-in early', () => {
  const ended = HM.reduce(locked, { type: 'endCheckIn' }, SUN_1010);
  assert.equal(ended.lock.skipUntil, U(2026, 10, 15, 10, 30));
  const e = HM.computeEffective(ended, U(2026, 10, 15, 10, 12));
  assert.equal(e.lock.checkInOpen, false);
  assert.equal(e.hide.views, true);
  assert.equal(e.lock.nextCheckIn, U(2026, 10, 22, 10, 0));
  // next week's window opens again
  assert.equal(HM.computeEffective(ended, U(2026, 10, 22, 10, 5)).lock.checkInOpen, true);
  // outside a window, endCheckIn does nothing
  assert.equal(HM.reduce(locked, { type: 'endCheckIn' }, NOW).lock.skipUntil, null);
});

test('no next check-in after the lock ends', () => {
  const short = HM.reduce(HM.defaultState(), { ...lockAction, until: U(2026, 10, 14, 9, 0) }, NOW);
  assert.equal(HM.computeEffective(short, NOW).lock.nextCheckIn, null);
  const noCheckIn = HM.reduce(HM.defaultState(), { ...lockAction, checkIn: null }, NOW);
  assert.equal(HM.computeEffective(noCheckIn, SUN_1010).lock.checkInOpen, false);
  assert.equal(HM.computeEffective(noCheckIn, NOW).lock.nextCheckIn, null);
});

test('paused hides nothing', () => {
  const paused = HM.reduce(HM.defaultState(), set(['paused'], true), NOW);
  const e = HM.computeEffective(paused, NOW);
  assert.equal(e.paused, true);
  for (const { id } of HM.SWITCHES) assert.equal(e.hide[id], false, id);
  assert.equal(e.lock, null);
});

test('effective carries sites', () => {
  const s = HM.reduce(HM.defaultState(), set(['sites', 'youtube'], false), NOW);
  assert.deepEqual(HM.computeEffective(s, NOW).sites, { youtubeStudio: true, youtube: false });
});

test('transitions', () => {
  assert.equal(HM.nextTransition(locked, NOW), U(2026, 10, 15, 10, 0));
  assert.equal(HM.nextTransition(locked, SUN_1010), U(2026, 10, 15, 10, 30));
  const noCheckIn = HM.reduce(HM.defaultState(), { ...lockAction, checkIn: null }, NOW);
  assert.equal(HM.nextTransition(noCheckIn, NOW), T);
  assert.equal(HM.nextTransition(HM.defaultState(), NOW), null);
  // last window before the lock end: next transition is the lock end
  assert.equal(HM.nextTransition(locked, U(2026, 10, 29, 10, 40)), T);
});

test('Chrome closed across a boundary', () => {
  assert.equal(HM.computeEffective(locked, T + 1).lock, null);
  assert.equal(HM.settle(locked, T + 1).lock, null);
  assert.deepEqual(HM.settle(locked, T + 1).hide, locked.hide); // switches stay as they are
  assert.equal(HM.settle(locked, NOW), locked);
  assert.equal(HM.computeEffective(locked, U(2026, 10, 22, 10, 29)).lock.checkInOpen, true);
  assert.equal(HM.nextTransition(locked, T + 1), null);
});

test('extensions pages of Chrome-based browsers', () => {
  for (const url of ['chrome://extensions/', 'chrome://extensions/?id=abc', 'chrome://extensions', 'edge://extensions', 'brave://extensions/shortcuts', 'opera://extensions', 'vivaldi://extensions/', 'CHROME://EXTENSIONS/']) {
    assert.equal(HM.isExtensionsPage(url), true, url);
  }
  for (const url of ['chrome://settings', 'https://example.com/chrome://extensions', 'chrome://extensions-internals', '', undefined, 'about:blank']) {
    assert.equal(HM.isExtensionsPage(url), false, String(url));
  }
});

test('after the lock ends, switches turn off again', () => {
  const s = HM.reduce(locked, set(['hide', 'views'], false), T);
  assert.equal(s.lock, null);
  assert.equal(s.hide.views, false);
});
