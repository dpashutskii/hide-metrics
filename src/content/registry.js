// Site registry and CSS building. Knows nothing about any particular site.
//
// Site = {
//   id, hosts: string[], statsWord, homeUrl, backLabel,
//   isStatsPage(url: URL) → boolean,
//   selectors: { [switchId]: string[] },              // hidden when that switch is on
//   whenAll?: [{ switches: switchId[], selectors }],  // hidden when all listed switches are on
//   pageSwitch?(url: URL) → switchId | null,          // whole page blocked when that switch is on
//   labels?: { where(url) → bool, card, title, words: { [switchId]: RegExp[] } },
//            // cards whose visible title matches a hidden switch's words are hidden
// }
(function (HM) {
  const sites = [];

  function registerSite(site) {
    sites.push(site);
  }

  function siteFor(hostname) {
    return sites.find((s) => s.hosts.includes(hostname)) || null;
  }

  // Every rule the site would apply for `hide`, as [label, selector] pairs.
  function rules(site, hide) {
    const out = [];
    for (const [sw, list] of Object.entries(site.selectors || {})) {
      if (!hide || hide[sw]) for (const sel of list) out.push([sw, sel]);
    }
    for (const group of site.whenAll || []) {
      if (!hide || group.switches.every((sw) => hide[sw])) {
        for (const sel of group.selectors) out.push([group.switches.join('+'), sel]);
      }
    }
    return out;
  }

  // One rule per selector, so one selector the browser rejects can't
  // take the rest of its switch down with it.
  function buildCss(site, hide) {
    return rules(site, hide).map(([, sel]) => `${sel} { display: none !important; }`).join('\n');
  }

  function allSwitchesOn(site) {
    const hide = {};
    for (const sw of Object.keys(site.selectors || {})) hide[sw] = true;
    for (const group of site.whenAll || []) for (const sw of group.switches) hide[sw] = true;
    return hide;
  }

  // What this page should hide right now, from the worker's `effective`.
  // No settings yet → everything. A check-in that should be over but hasn't
  // been closed by the worker yet (late alarm, browser just started) → also
  // everything: when in doubt, hide.
  function hideFor(site, effective, now) {
    if (!effective) return allSwitchesOn(site);
    if (!(effective.sites && effective.sites[site.id])) return {};
    const lock = effective.lock;
    if (lock && lock.checkInOpen && typeof lock.checkInEndsAt === 'number' && now >= lock.checkInEndsAt) {
      return allSwitchesOn(site);
    }
    return effective.hide || {};
  }

  // Which switches a visible label belongs to, for sites whose pages carry no
  // other marker (see Site.labels). [] when the site has no labels or none match.
  function labelSwitches(site, text) {
    const words = site.labels && site.labels.words;
    if (!words) return [];
    const t = String(text || '').trim();
    return Object.keys(words).filter((sw) => words[sw].some((re) => re.test(t)));
  }

  // For DevTools: how many elements each selector matches on this page.
  // count -1 = the selector itself is invalid. 0 on a page that should have
  // the thing usually means the site changed its markup.
  function report(site, doc = document) {
    return rules(site, null).map(([sw, selector]) => {
      let count;
      try {
        count = doc.querySelectorAll(selector).length;
      } catch {
        count = -1;
      }
      return { switch: sw, selector, count };
    });
  }

  Object.assign(HM, { registerSite, siteFor, buildCss, allSwitchesOn, hideFor, labelSwitches, report });
})(globalThis.HM = globalThis.HM || {});
