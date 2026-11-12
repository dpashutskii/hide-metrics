// YouTube (www.youtube.com). Filled in Task 7.
(function (HM) {
  HM.registerSite({
    id: 'youtube',
    hosts: ['www.youtube.com'],
    statsWord: 'Analytics',
    homeUrl: 'https://www.youtube.com/',
    backLabel: 'Back to YouTube',
    isStatsPage: () => false,
    selectors: {},
  });
})(globalThis.HM = globalThis.HM || {});
