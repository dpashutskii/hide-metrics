// Hides metrics with one <style> element. Runs at document_start and starts
// by hiding everything the site knows about, so nothing flashes while the
// settings load; then follows `effective` from storage, live.
(function (HM) {
  const site = HM.siteFor(location.hostname);
  if (!site) return;

  const style = document.createElement('style');
  style.id = 'hide-metrics-style';
  style.textContent = HM.buildCss(site, HM.allSwitchesOn(site));

  // Keep the style attached even if the page rebuilds <head>.
  function attach() {
    if (!style.isConnected) (document.head || document.documentElement).appendChild(style);
  }
  attach();
  const keeper = new MutationObserver(attach);
  keeper.observe(document.documentElement, { childList: true });
  document.addEventListener('DOMContentLoaded', () => {
    attach();
    if (document.head) keeper.observe(document.head, { childList: true });
  });

  const listeners = [];
  HM.current = { site, effective: null, onChange: (fn) => listeners.push(fn) };

  let checkInTimer = null;

  function render() {
    const css = HM.buildCss(site, HM.hideFor(site, HM.current.effective, Date.now()));
    if (style.textContent !== css) style.textContent = css;
  }

  function apply(effective) {
    if (!effective) return; // keep hiding everything until the worker has written settings
    HM.current.effective = effective;
    render();
    // When a check-in ends, hide again on time even if the worker is late.
    clearTimeout(checkInTimer);
    const lock = effective.lock;
    if (lock && lock.checkInOpen && typeof lock.checkInEndsAt === 'number') {
      checkInTimer = setTimeout(() => {
        render();
        for (const fn of listeners) fn(HM.current.effective);
      }, Math.max(0, lock.checkInEndsAt - Date.now()) + 50);
    }
    for (const fn of listeners) fn(effective);
  }

  chrome.storage.local.get('effective').then(({ effective }) => apply(effective));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.effective) apply(changes.effective.newValue);
  });

  (HM.cleanup = HM.cleanup || []).push(() => {
    clearTimeout(checkInTimer);
    keeper.disconnect();
    style.remove();
  });
})(globalThis.HM = globalThis.HM || {});
