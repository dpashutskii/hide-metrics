// YouTube Studio (studio.youtube.com).
//
// Everything Studio-specific lives here. Selectors use page structure (tag
// names, ids, classes, link targets, icon names), never visible text, so they
// work in every Studio language. When Studio changes and something shows
// again: open the page, pick the extension in the DevTools console's context
// menu, run HM.report(HM.current.site), and fix the lines that match 0.
//
// Observed 2026-11: the dashboard still uses the older ytcd-* cards; the new
// Insights pages carry no metric types in their markup, so they are blocked
// as whole pages instead (isStatsPage).
(function (HM) {
  // A dashboard/video-list metric: <div class="metric"><yt-icon icon="…">N
  const metric = (icon) => `.video-metrics > .metric:has(> yt-icon[icon$="${icon}"])`;
  // The like count is the metric with neither the views nor the comments icon.
  const likeMetric = '.video-metrics > .metric:not(:has(> yt-icon[icon$=":bar_chart"], > yt-icon[icon$=":comment"]))';
  // The "Summary" block of the Channel analytics card mixes views, watch time
  // and revenue rows with nothing but the label to tell them apart, so it goes
  // whenever Views or Revenue is on.
  const summary = [
    'ytcd-channel-facts-item .section-title:has(+ .apply-item-padding > #metrics-table)',
    'ytcd-channel-facts-item .apply-item-padding:has(> #metrics-table)',
  ];
  // Latest post: likes and comments as two unlabeled rows.
  const postStats = 'ytcd-post-stats-item';

  HM.registerSite({
    id: 'youtubeStudio',
    hosts: ['studio.youtube.com'],
    statsWord: 'Insights',
    homeUrl: 'https://studio.youtube.com/',
    backLabel: 'Back to Studio',
    // Insights (channel and per video, incl. Advanced mode) and the
    // realtime / live-count pages.
    isStatsPage: (url) => /\/(analytics|explore)(\/|$)/.test(url.pathname),
    selectors: {
      statsPages: [
        'ytcp-navigation-drawer li:has(a[href*="/analytics"])',
        'ytcp-ve:has(> a[href*="/analytics"])',
        'ytcp-ve:has(> a[href*="/explore?"])',
        'a[href*="/analytics"]',
        'a[href*="/explore?"]',
      ],
      views: [
        metric(':bar_chart'),
        'ytcd-entity-snapshot-item #collapsable-button',
        'ytcd-entity-snapshot-item tp-yt-iron-collapse',
        ...summary,
        'ytcd-channel-facts-item .section-title:has(+ .top-videos)',
        'ytcd-channel-facts-item .top-videos',
        '.tablecell-views',
      ],
      subscribers: [
        'ytcd-channel-facts-item .apply-item-padding:has(> .subscribers-title)',
        'ytcp-ve:has(> a[href*="explore_type=SUBSCRIBERS"])',
        'ytcd-card:has(ytcd-recent-activity-subscribers)',
        // Account switcher (avatar → Switch account): name, @handle, subscribers.
        'ytd-account-item-renderer tp-yt-paper-item-body > yt-formatted-string:nth-of-type(3)',
      ],
      revenue: [
        ...summary,
        '.tablecell-revenue',
      ],
      likes: [
        likeMetric,
        postStats,
        'ytcp-comment-action-buttons #vote-count',
        '.tablecell-likes',
        '.tablecell-votes', // Posts tab
      ],
      comments: [
        metric(':comment'),
        postStats,
        'ytcd-card:has(ytcd-comments-snapshot-item)',
        'ytcd-entity-snapshot-item ytcp-ve:has(#view-comments-button)',
        '.tablecell-comments',
        'ytcp-comments-section',
      ],
      aiFeatures: [
        'ytcp-creator-chat-trigger',
        'ytcp-creator-chat-spark',
        'ytcp-sam-chat',
        'ytcp-creator-chat-entrypoint-button',
        'ytcp-ask-studio-card-view-model',
        '.ask-studio-container',
        'ytcp-metadata-suggestions-container',
        'ytcp-comment [id^="comment-smart-replies"]', // AI reply chips + their label
        'ytcp-comments-digest',
        'tp-yt-paper-tab#inspiration-tab', // Content → Ideas
      ],
      promotions: [
        // Dashboard cards from YouTube itself, not about your channel.
        // "Ideas for you" (brand deals, shopping) and "Creator Insider" are the
        // dashboard's carousel cards. Their ids are JS properties, not attributes.
        'ytcd-card:has(ytcd-carousel-card)',
        'ytcd-card:has(ytcd-help-center-issues-item)', // What's new in Studio
      ],
    },
    whenAll: [
      // Channel analytics card: nothing but numbers and links to Insights.
      { switches: ['statsPages', 'views', 'subscribers'], selectors: ['ytcd-card:has(ytcd-channel-facts-item)'] },
    ],
  });
})(globalThis.HM = globalThis.HM || {});
