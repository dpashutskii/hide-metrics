// YouTube Studio (studio.youtube.com). Filled in Task 6.
(function (HM) {
  HM.registerSite({
    id: 'youtubeStudio',
    hosts: ['studio.youtube.com'],
    statsWord: 'Insights',
    homeUrl: 'https://studio.youtube.com/',
    backLabel: 'Back to Studio',
    isStatsPage: () => false,
    selectors: {},
  });
})(globalThis.HM = globalThis.HM || {});
