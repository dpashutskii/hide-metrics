// YouTube (www.youtube.com). Filled in Task 7.
(function (HM) {
  HM.registerSite({
    id: 'youtube',
    hosts: ['www.youtube.com'],
    statsWord: 'Analytics',
    homeUrl: 'https://www.youtube.com/',
    backLabel: 'Back to YouTube',
    isStatsPage: (url) => /^\/analytics(\/|$)/.test(url.pathname),
    selectors: {},
  });
})(globalThis.HM = globalThis.HM || {});
