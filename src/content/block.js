// Replaces a site's stats pages with a calm full-page notice. Works on full
// page loads and on in-app navigation (single-page apps change the URL
// without loading a page, so the URL is checked every 250 ms).
(function (HM) {
  const cur = HM.current;
  if (!cur) return;
  const site = cur.site;
  const ATTR = 'data-hide-metrics-blocked';

  const pageStyle = document.createElement('style');
  pageStyle.id = 'hide-metrics-block-style';
  pageStyle.textContent =
    `html[${ATTR}] { overflow: hidden !important; }\n` +
    `html[${ATTR}] > body { visibility: hidden !important; }`;

  const CSS = `
    :host { all: initial; }
    .wrap {
      --panel: #ffffff; --ink: #1d1d1f; --ink-2: #6e6e73;
      position: fixed; inset: 0; z-index: 2147483647;
      display: grid; place-items: center; text-align: center; padding: 40px 20px;
      background: var(--panel); color: var(--ink);
      font: 14px/1.35 -apple-system, "SF Pro Text", Inter, system-ui, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    @media (prefers-color-scheme: dark) {
      .wrap { --panel: #1c1c1e; --ink: #f5f5f7; --ink-2: #a1a1a6; }
    }
    .ic { width: 44px; height: 44px; border-radius: 12px; background: var(--ink);
      display: grid; place-items: center; margin: 0 auto 18px; }
    .ic svg { width: 22px; height: 22px; }
    h1 { font-size: 22px; font-weight: 650; letter-spacing: -.015em; margin: 0 0 8px; }
    p { color: var(--ink-2); margin: 0 0 22px; font-size: 14px; }
    .meta { display: inline-grid; grid-template-columns: auto auto; gap: 6px 18px;
      text-align: left; font-size: 13px; margin-bottom: 26px; }
    .meta span:nth-child(odd) { color: var(--ink-2); }
    .meta span:nth-child(even) { font-weight: 550; }
    a { display: inline-block; padding: 10px 18px; border-radius: 10px; background: var(--ink);
      color: var(--panel); font-weight: 650; text-decoration: none; }
    a:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }
  `;

  const SVG = 'http://www.w3.org/2000/svg';
  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    Object.assign(node, props);
    node.append(...children);
    return node;
  }
  function eyeIcon() {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'var(--panel)');
    svg.setAttribute('stroke-width', '1.5');
    svg.setAttribute('stroke-linecap', 'round');
    for (const d of ['M2 8c1.6-2.7 3.6-4 6-4s4.4 1.3 6 4c-1.6 2.7-3.6 4-6 4s-4.4-1.3-6-4z', 'M3 13L13 3']) {
      const path = document.createElementNS(SVG, 'path');
      path.setAttribute('d', d);
      svg.append(path);
    }
    return svg;
  }

  let host = null;
  let rendered = '';

  function rows(effective) {
    const lock = effective && effective.lock;
    if (!lock) return [];
    const out = [['Locked until', HM.formatWhen(lock.until)]];
    if (lock.nextCheckIn) out.push(['Next check-in', HM.formatWhen(lock.nextCheckIn)]);
    return out;
  }

  function render(effective) {
    const meta = rows(effective);
    const key = JSON.stringify(meta);
    if (host && rendered === key) return;
    rendered = key;
    if (!host) {
      host = document.createElement('hide-metrics-blocked');
      host.attachShadow({ mode: 'open' });
    }
    const children = [
      el('div', { className: 'ic' }, [eyeIcon()]),
      el('h1', { textContent: `${site.statsWord} are hidden` }),
      el('p', { textContent: 'Your numbers will still be here later.' }),
    ];
    if (meta.length) {
      children.push(el('div', { className: 'meta' }, meta.flatMap(([k, v]) => [el('span', { textContent: k }), el('span', { textContent: v })])));
    }
    children.push(el('div', {}, [el('a', { href: site.homeUrl, textContent: site.backLabel })]));
    host.shadowRoot.replaceChildren(
      el('style', { textContent: CSS }),
      el('div', { className: 'wrap', role: 'main' }, [el('div', {}, children)]),
    );
  }

  function shouldBlock() {
    // Before settings load (or while a check-in is overdue), assume on.
    const hide = HM.hideFor(site, cur.effective, Date.now());
    const url = new URL(location.href);
    if (hide.statsPages && site.isStatsPage(url)) return true;
    const sw = site.pageSwitch ? site.pageSwitch(url) : null;
    return !!(sw && hide[sw]);
  }

  function check() {
    const root = document.documentElement;
    if (shouldBlock()) {
      render(cur.effective);
      if (!pageStyle.isConnected) root.appendChild(pageStyle);
      if (!root.hasAttribute(ATTR)) root.setAttribute(ATTR, '');
      if (!host.isConnected) root.appendChild(host);
    } else if (host && host.isConnected) {
      host.remove();
      root.removeAttribute(ATTR);
    }
  }

  check();
  // The Navigation API reports the page's own pushState calls at once; the
  // timer is the fallback (and re-attaches the notice if the page removes it).
  const nav = globalThis.navigation;
  if (nav) nav.addEventListener('currententrychange', check);
  const timer = setInterval(check, 250);
  addEventListener('popstate', check);
  cur.onChange(check);

  (HM.cleanup = HM.cleanup || []).push(() => {
    clearInterval(timer);
    if (nav) nav.removeEventListener('currententrychange', check);
    removeEventListener('popstate', check);
    if (host) host.remove();
    pageStyle.remove();
    document.documentElement.removeAttribute(ATTR);
  });
})(globalThis.HM = globalThis.HM || {});
