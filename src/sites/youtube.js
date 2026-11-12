// YouTube (www.youtube.com): everyone's videos, not just your own.
//
// Everything youtube.com-specific lives here. Selectors use page structure,
// never visible text, so they work in every language. YouTube renames its
// CSS classes now and then; class-name matches use [class*="…"] on the
// stable part. To find what broke: open the page, pick the extension in the
// DevTools console's context menu, run HM.report(HM.current.site).
//
// Observed 2026-11: video cards show views as a play icon + number
// ("LeadingIcon" + text) in yt-content-metadata-view-model; search results
// still use the older #metadata-line.
(function (HM) {
  const md = 'yt-content-metadata-view-model';

  HM.registerSite({
    id: 'youtube',
    hosts: ['www.youtube.com'],
    statsWord: 'Analytics',
    homeUrl: 'https://www.youtube.com/',
    backLabel: 'Back to YouTube',
    isStatsPage: (url) => /^\/analytics(\/|$)/.test(url.pathname),
    selectors: {
      statsPages: [
        // "Analytics" button on your own videos (links into Studio).
        'ytd-button-renderer:has(a[href*="/analytics"])',
        'a[href*="studio.youtube.com"][href*="/analytics"]',
      ],
      views: [
        // Video cards: play icon + count, and the dot next to it.
        `${md} [class*="LeadingIcon"]`,
        `${md} [class*="LeadingIcon"] + [class*="MetadataText"]`,
        `${md} [class*="Delimiter"]:has(+ [class*="LeadingIcon"])`,
        `${md} [class*="LeadingIcon"]:first-child + [class*="MetadataText"] + [class*="Delimiter"]`,
        // Live cards: "N watching" is a plain line; hide that whole line.
        `yt-lockup-view-model:has([class*="BadgeShapeThumbnailLive"]) ${md} [class*="MetadataRow"]:last-child`,
        // Older cards (search results): views come first, then the date.
        '#metadata-line > span.inline-metadata-item:first-of-type',
        // Shorts cards.
        'ytm-shorts-lockup-view-model [class*="MetadataSubhead"]',
        // Watch page: "N views" line (collapsed and expanded) and its tooltip.
        'ytd-watch-info-text #view-count',
        'ytd-watch-info-text #info > span:first-child',
        'ytd-watch-info-text tp-yt-paper-tooltip',
        'ytd-video-view-count-renderer',
        'yt-list-item-view-count-view-model',
        'view-count-factoid-renderer',
        // End screen.
        '.ytp-videowall-still-info-author',
        '.ytp-modern-videowall-still-view-count-and-date-info',
      ],
      subscribers: [
        '#owner-sub-count',
        'ytd-video-description-infocards-section-renderer #subtitle',
        // Channel header: keep the @handle, drop "N subscribers • N videos".
        `yt-page-header-view-model ${md} [class*="MetadataRow"]:not(:first-child)`,
        `yt-page-header-view-model ${md} [class*="MetadataRow"]:first-child > :not(:first-child)`,
        `yt-page-header-view-model ${md} > [class*="Delimiter"]`,
        'ytd-c4-tabbed-header-renderer #subscriber-count',
        // Channel cards in search: handle and count share one line.
        'ytd-channel-renderer #metadata',
      ],
      likes: [
        'like-button-view-model [class*="ButtonTextContent"]',
        'like-button-view-model [class*="button-text-content"]',
        'like-button-view-model [class*="WithLabelLabel"]',
        'like-button-view-model [class*="with-label__label"]',
        '#vote-count-middle',
        'yt-list-item-like-count-view-model',
      ],
      comments: [
        'ytd-comments#comments',
        'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-comments-section"]',
        'ytd-comments-entry-point-header-renderer',
        '#comments-button [class*="WithLabelLabel"]',
        '#comments-button [class*="with-label__label"]',
        // Shorts player: the button right after like/dislike is comments.
        'reel-action-bar-view-model > like-button-view-model + button-view-model [class*="WithLabelLabel"]',
        'ytd-backstage-post-renderer #reply-button-end',
      ],
      aiFeatures: [
        // "Ask" about a video (conversational AI panel).
        'ytd-engagement-panel-section-list-renderer[target-id="PAyouchat"]',
        'you-chat-item-view-model',
      ],
    },
  });
})(globalThis.HM = globalThis.HM || {});
