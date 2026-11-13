// Hides cards by their visible title, for pages whose numbers carry no other
// marker (Site.labels). Only runs on the pages the site names, and only when
// that page isn't already replaced by the "hidden" notice. Cards are marked
// with an attribute; one CSS rule hides marked cards.
(function (HM) {
  const cur = HM.current;
  if (!cur || !cur.site.labels) return;
  const site = cur.site;
  const L = site.labels;
  const ATTR = 'data-hide-metrics-label';

  const style = document.createElement('style');
  style.id = 'hide-metrics-label-style';
  style.textContent = `[${ATTR}] { display: none !important; }`;

  function apply() {
    const url = new URL(location.href);
    const hide = HM.hideFor(site, cur.effective, Date.now());
    const on = L.where(url);
    if (on && !style.isConnected) document.documentElement.appendChild(style);
    for (const card of document.querySelectorAll(L.card)) {
      const title = card.querySelector(L.title);
      const kill = on && !!title && HM.labelSwitches(site, title.textContent).some((sw) => hide[sw]);
      if (kill !== card.hasAttribute(ATTR)) card.toggleAttribute(ATTR, kill);
    }
  }

  // Mutation callbacks run before the page paints, so a card is hidden before
  // its numbers show. Skip the work entirely off the site's labelled pages.
  const observer = new MutationObserver(() => {
    if (L.where(new URL(location.href))) apply();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  const nav = globalThis.navigation;
  if (nav) nav.addEventListener('currententrychange', apply);
  cur.onChange(apply);
  apply();

  (HM.cleanup = HM.cleanup || []).push(() => {
    observer.disconnect();
    if (nav) nav.removeEventListener('currententrychange', apply);
    style.remove();
    for (const card of document.querySelectorAll(`[${ATTR}]`)) card.removeAttribute(ATTR);
  });
})(globalThis.HM = globalThis.HM || {});
