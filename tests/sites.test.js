// Synthetic URLs only (made-up IDs).
import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/core/state.js';
import '../src/content/registry.js';
import '../src/sites/youtube-studio.js';
import '../src/sites/youtube.js';

const HM = globalThis.HM;
const studio = HM.siteFor('studio.youtube.com');
const youtube = HM.siteFor('www.youtube.com');
const CH = 'UCxxxxxxxxxxxxxxxxxxxxxx';
const VID = 'abcdefghijk';
const isStats = (site, url) => site.isStatsPage(new URL(url));

test('Studio stats pages', () => {
  assert.equal(isStats(studio, `https://studio.youtube.com/channel/${CH}/analytics/hub_overview`), true);
  assert.equal(isStats(studio, `https://studio.youtube.com/video/${VID}/analytics/tab-overview/period-default`), true);
  assert.equal(isStats(studio, `https://studio.youtube.com/channel/${CH}/analytics`), true);
  // realtime and live subscriber count
  assert.equal(isStats(studio, `https://studio.youtube.com/channel/${CH}/explore?entity_type=CHANNEL&explore_type=SUBSCRIBERS`), true);
  assert.equal(isStats(studio, `https://studio.youtube.com/channel/${CH}/videos/upload`), false);
  assert.equal(isStats(studio, `https://studio.youtube.com/channel/${CH}/comments/inbox`), false);
  assert.equal(isStats(studio, `https://studio.youtube.com/channel/${CH}`), false);
  assert.equal(isStats(studio, `https://studio.youtube.com/video/${VID}/edit`), false);
});

test('Studio site settings', () => {
  assert.equal(studio.id, 'youtubeStudio');
  assert.equal(studio.statsWord, 'Insights');
  assert.equal(studio.homeUrl, 'https://studio.youtube.com/');
  assert.equal(studio.backLabel, 'Back to Studio');
});

test('YouTube stats pages', () => {
  assert.equal(youtube.id, 'youtube');
  assert.equal(youtube.statsWord, 'Analytics');
  assert.equal(youtube.backLabel, 'Back to YouTube');
  assert.equal(isStats(youtube, 'https://www.youtube.com/analytics'), true);
  assert.equal(isStats(youtube, 'https://www.youtube.com/analytics?o=U'), true);
  assert.equal(isStats(youtube, `https://www.youtube.com/watch?v=${VID}`), false);
  assert.equal(isStats(youtube, 'https://www.youtube.com/@demo/videos'), false);
});

for (const site of [studio, youtube]) {
  test(`${site.id}: every selector belongs to a real switch`, () => {
    const ids = new Set(HM.SWITCHES.map((s) => s.id));
    for (const [sw, list] of Object.entries(site.selectors)) {
      assert.ok(ids.has(sw), `unknown switch ${sw}`);
      assert.ok(Array.isArray(list) && list.length > 0, `${sw} has no selectors`);
      for (const sel of list) assert.ok(typeof sel === 'string' && sel.trim().length > 0, `${sw}: empty selector`);
    }
    for (const group of site.whenAll || []) {
      assert.ok(group.switches.length > 1);
      for (const sw of group.switches) assert.ok(ids.has(sw), `unknown switch ${sw}`);
      for (const sel of group.selectors) assert.ok(typeof sel === 'string' && sel.trim().length > 0);
    }
  });
}

test('Studio covers every switch', () => {
  for (const { id } of HM.SWITCHES) assert.ok(studio.selectors[id], `Studio has nothing for ${id}`);
});

// Places found by the final review and checked live (structure only).
const ACCOUNT_SUBS = 'ytd-account-item-renderer tp-yt-paper-item-body > yt-formatted-string:nth-of-type(3)';

test('account switcher subscriber counts are hidden on both sites', () => {
  for (const site of [studio, youtube]) assert.ok(site.selectors.subscribers.includes(ACCOUNT_SUBS), site.id);
});

test('channel About dialog: subscribers and views rows', () => {
  assert.ok(youtube.selectors.subscribers.includes('ytd-about-channel-renderer tr:has(yt-icon[icon="person_radar"])'));
  assert.ok(youtube.selectors.views.includes('ytd-about-channel-renderer tr:has(yt-icon[icon="trending_up"])'));
});

test('page header counts (channel subscribers, playlist views) hide under both switches', () => {
  const header = youtube.selectors.subscribers.filter((sel) => sel.startsWith('yt-page-header-view-model'));
  assert.ok(header.length >= 2);
  for (const sel of header) assert.ok(youtube.selectors.views.includes(sel), sel);
});

test('Studio promo cards hide under Promotions', () => {
  // Card ids like #ideas are JS properties in Studio, not attributes, so CSS can't use them.
  assert.ok(!studio.selectors.promotions.some((x) => /#ideas|#creator_insider/.test(x)));
  for (const sel of ['ytcd-card:has(ytcd-carousel-card)', 'ytcd-help-center-issues-item']) {
    assert.ok(studio.selectors.promotions.some((x) => x.includes(sel)), sel);
  }
});

// Insights cards carry only an English title (chosen by the author; other
// Studio languages fall back to showing them). Titles below are Studio's own.
test('Studio Insights card titles map to switches', () => {
  const cases = {
    views: ['Views', 'Watch time (hours)', '48 hour views', 'Watched right now', 'Recent video performance', 'Top content',
      'How viewers find your content', 'How viewers found this video', 'Monthly audience', 'Watch behavior', 'Top demographics',
      'Top geographies', 'Impressions', 'Click-through rate', 'Audience retention', 'Average view duration'],
    subscribers: ['Subscribers', 'Total subscribers'],
    revenue: ['Estimated revenue', 'Top earning', 'Ways of earning', 'Monthly revenue', 'How you make money', 'Top ad type', 'RPM'],
    likes: ['Likes vs. dislikes'],
  };
  for (const [sw, titles] of Object.entries(cases)) {
    for (const t of titles) assert.ok(HM.labelSwitches(studio, t).includes(sw), `${t} → ${sw}`);
  }
  assert.deepEqual(HM.labelSwitches(studio, 'Overview'), []);
  assert.deepEqual(HM.labelSwitches(studio, 'Weergaven'), []);
});

test('Studio realtime and live-count pages are blocked by their own switch', () => {
  const at = (q) => new URL(`https://studio.youtube.com/channel/${CH}/explore?entity_type=CHANNEL&entity_id=${CH}&time_period=4_weeks&explore_type=${q}`);
  assert.equal(studio.pageSwitch(at('SUBSCRIBERS')), 'subscribers');
  assert.equal(studio.pageSwitch(at('LATEST_ACTIVITY')), 'views');
  assert.equal(studio.pageSwitch(new URL(`https://studio.youtube.com/channel/${CH}/analytics/hub_overview`)), null);
});

test('Insights AI card disappears with its frame', () => {
  assert.ok(studio.selectors.aiFeatures.includes('yt-card-view-model:has(ytcp-ask-studio-card-view-model)'));
});
