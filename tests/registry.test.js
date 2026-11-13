import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/content/registry.js';

const HM = globalThis.HM;
const site = {
  id: 'demo',
  hosts: ['demo.example'],
  statsWord: 'Stats',
  homeUrl: 'https://demo.example/',
  backLabel: 'Back to Demo',
  isStatsPage: (url) => url.pathname.startsWith('/stats'),
  selectors: { views: ['.a', '.b:has(.c)'], likes: ['.d'] },
  whenAll: [{ switches: ['views', 'likes'], selectors: ['.card'] }],
};
HM.registerSite(site);

test('one rule per selector for the switches that are on', () => {
  assert.equal(HM.buildCss(site, { views: true, likes: false }),
    '.a { display: none !important; }\n.b:has(.c) { display: none !important; }');
});

test('nothing hidden → empty css', () => {
  assert.equal(HM.buildCss(site, { views: false, likes: false }), '');
  assert.equal(HM.buildCss(site, {}), '');
});

test('whenAll rules only when every listed switch is on', () => {
  const css = HM.buildCss(site, { views: true, likes: true });
  assert.equal(css.split('\n').at(-1), '.card { display: none !important; }');
  assert.equal(css.split('\n').length, 4);
});

test('site lookup by hostname', () => {
  assert.equal(HM.siteFor('demo.example'), site);
  assert.equal(HM.siteFor('other.example'), null);
});

test('allSwitchesOn covers every switch the site uses', () => {
  assert.deepEqual(HM.allSwitchesOn(site), { views: true, likes: true });
});

test('report counts matches per selector and flags broken ones', () => {
  const counts = { '.a': 2, '.b:has(.c)': 0, '.d': 1, '.card': 3 };
  const doc = {
    querySelectorAll(sel) {
      if (!(sel in counts)) throw new SyntaxError('bad selector');
      return { length: counts[sel] };
    },
  };
  const broken = { ...site, selectors: { ...site.selectors, likes: ['.d', ':bogus('] } };
  assert.deepEqual(HM.report(broken, doc), [
    { switch: 'views', selector: '.a', count: 2 },
    { switch: 'views', selector: '.b:has(.c)', count: 0 },
    { switch: 'likes', selector: '.d', count: 1 },
    { switch: 'likes', selector: ':bogus(', count: -1 },
    { switch: 'views+likes', selector: '.card', count: 3 },
  ]);
});

test('hideFor: what a page should hide right now', () => {
  const T = Date.UTC(2026, 10, 15, 10, 30);
  const base = { paused: false, hide: { views: true, likes: false }, sites: { demo: true }, lock: null };
  assert.deepEqual(HM.hideFor(site, null, T), { views: true, likes: true }); // before settings load: everything
  assert.deepEqual(HM.hideFor(site, base, T), { views: true, likes: false });
  assert.deepEqual(HM.hideFor(site, { ...base, sites: { demo: false } }, T), {});
  const open = { ...base, hide: { views: false, likes: false }, lock: { until: T + 864e5, checkInOpen: true, checkInEndsAt: T, nextCheckIn: null } };
  assert.deepEqual(HM.hideFor(site, open, T - 1), { views: false, likes: false }); // check-in still open
  // check-in should be over but the worker hasn't said so yet: hide everything, not nothing
  assert.deepEqual(HM.hideFor(site, open, T), { views: true, likes: true });
});
