// Toolbar popup. Renders from { state, effective, now } sent by the
// background worker; every change goes back to the worker as an action.
// Opened outside the extension (e.g. from a local static server) it runs on
// an in-memory stand-in, for previews: add ?demo=locked or ?demo=checkin.
(function () {
  const HM = globalThis.HM;
  const app = document.getElementById('app');

  // ---------- backend ----------

  const inExtension = !!(globalThis.chrome && chrome.runtime && chrome.runtime.id);

  function demoBackend() {
    let state = HM.defaultState();
    const now = Date.now();
    const demo = new URLSearchParams(location.search).get('demo');
    if (demo === 'locked' || demo === 'checkin') {
      const d = new Date(now);
      const until = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 17, 9, 0).getTime();
      const minutesNow = d.getHours() * 60 + d.getMinutes();
      const checkIn = demo === 'checkin'
        ? { day: d.getDay(), startMin: Math.max(0, minutesNow - 8), lengthMin: 30 }
        : { day: 0, startMin: 600, lengthMin: 30 };
      state = HM.reduce(state, { type: 'set', path: ['hide', 'likes'], value: false }, now);
      state = HM.reduce(state, { type: 'lock', until, checkIn, guard: true }, now);
    }
    return {
      async send(msg) {
        const t = Date.now();
        if (msg.type === 'action') state = HM.reduce(state, msg.action, t);
        return { state, effective: HM.computeEffective(state, t), now: t };
      },
    };
  }

  const backend = inExtension ? { send: (msg) => chrome.runtime.sendMessage(msg) } : demoBackend();

  // ---------- tiny DOM helpers ----------

  function h(tag, props, ...kids) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'value') node.value = v;
      else node.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) node.append(kid);
    return node;
  }

  const ICONS = {
    eye: ['0 0 16 16', { stroke: 'var(--panel)', 'stroke-width': 1.6, 'stroke-linecap': 'round' },
      [['path', { d: 'M2 8c1.6-2.7 3.6-4 6-4s4.4 1.3 6 4c-1.6 2.7-3.6 4-6 4s-4.4-1.3-6-4z' }], ['path', { d: 'M3 13L13 3' }]]],
    chev: ['0 0 12 12', { stroke: 'currentColor', 'stroke-width': 1.6 }, [['path', { d: 'M4.5 2.5L8 6l-3.5 3.5' }]]],
    back: ['0 0 12 12', { stroke: 'currentColor', 'stroke-width': 1.6 }, [['path', { d: 'M7.5 2.5L4 6l3.5 3.5' }]]],
    lk: ['0 0 12 12', { stroke: 'currentColor', 'stroke-width': 1.4 },
      [['rect', { x: 2.5, y: 5.5, width: 7, height: 5, rx: 1.2 }], ['path', { d: 'M4 5.5V4a2 2 0 0 1 4 0v1.5' }]]],
    lock: ['0 0 18 18', { stroke: 'currentColor', 'stroke-width': 1.6 },
      [['rect', { x: 3.5, y: 8, width: 11, height: 7.5, rx: 2 }], ['path', { d: 'M6 8V5.8a3 3 0 0 1 6 0V8' }]]],
    clock: ['0 0 18 18', { stroke: 'currentColor', 'stroke-width': 1.6 },
      [['circle', { cx: 9, cy: 9, r: 6.5 }], ['path', { d: 'M9 5.5V9l2.5 1.5' }]]],
    play: ['0 0 10 10', {},
      [['rect', { x: 0.5, y: 1.5, width: 9, height: 7, rx: 2, fill: 'var(--ink)' }], ['path', { d: 'M4 3.4v3.2L6.6 5z', fill: 'var(--panel)' }]]],
  };

  function icon(name, cls) {
    const [viewBox, attrs, parts] = ICONS[name];
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', viewBox);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('aria-hidden', 'true');
    if (cls) svg.setAttribute('class', cls);
    for (const [k, v] of Object.entries(attrs)) svg.setAttribute(k, v);
    for (const [tag, a] of parts) {
      const el = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(a)) el.setAttribute(k, v);
      svg.append(el);
    }
    return svg;
  }

  // A switch. `onchange(next)` gets the new value.
  function toggle({ checked, disabled, label, onchange }) {
    const btn = h('button', { class: 'tg', role: 'switch', 'aria-checked': String(!!checked), 'aria-label': label, disabled: !!disabled });
    btn.addEventListener('click', () => {
      const next = btn.getAttribute('aria-checked') !== 'true';
      btn.setAttribute('aria-checked', String(next));
      onchange(next);
    });
    return btn;
  }

  const label = (text) => h('div', { class: 'label', text });
  const group = (cls, rows) => h('div', { class: `group ${cls}`.trim() }, rows);
  const valueRow = (name, value) => h('div', { class: 'row' }, h('span', { text: name }), h('span', { class: 'v', text: value }));
  const linkRow = (name, value, onclick) =>
    h('button', { class: 'row link', onclick }, h('span', { text: name }), h('span', { class: 'v' }, value, icon('chev', 'chev')));
  const siteName = (text) => h('span', { class: 'site' }, h('span', { class: 'fav' }, icon('play')), text);

  function banner(kind, iconName, title, sub) {
    return h('div', { class: `banner ${kind}`, role: 'status' }, icon(iconName), h('div', {}, h('b', { text: title }), h('span', { text: sub })));
  }

  function backHead(title) {
    return h('div', { class: 'head' },
      h('button', { class: 'back', onclick: () => go('main') }, icon('back', 'chev'), 'Back'),
      h('div', { class: 'title-c', text: title }));
  }

  // ---------- data ----------

  let data = null; // { state, effective, now }
  let view = 'main';

  async function act(action) {
    const res = await backend.send({ type: 'action', action });
    if (res) data = res;
    render();
  }

  async function refresh() {
    const res = await backend.send({ type: 'get' });
    if (!res) return;
    data = res;
    if (view === 'extend' && !HM.isLocked(data.state, data.now)) view = 'main';
    if (view === 'setup' && HM.isLocked(data.state, data.now)) view = 'main';
    if (view === 'main') render();
  }

  function go(next) {
    view = next;
    render();
  }

  // ---------- main view (normal, locked, check-in) ----------

  function switchRow(path, name, text, checked, locked) {
    const disabled = locked && checked; // while locked, switches only turn on
    const tg = toggle({ checked, disabled, label: text, onchange: (value) => act({ type: 'set', path, value }) });
    return h('div', { class: 'row', onclick: (e) => { if (!tg.contains(e.target) && !tg.disabled) tg.click(); } },
      name, h('span', { class: 'v' }, disabled && icon('lk', 'lk'), tg));
  }

  function viewMain() {
    const { state, effective, now } = data;
    const locked = HM.isLocked(state, now);
    const lock = effective.lock;
    const open = locked && lock && lock.checkInOpen;
    const kids = [];

    kids.push(h('div', { class: 'head' },
      h('div', { class: 'appicon' }, icon('eye')),
      h('div', { class: 'name', text: 'Hide Metrics' }),
      !locked && toggle({ checked: !state.paused, label: 'Hide Metrics on', onchange: (on) => act({ type: 'set', path: ['paused'], value: !on }) })));

    if (open) {
      kids.push(banner('check', 'clock', `Check-in open until ${HM.formatTime(lock.checkInEndsAt)}`, HM.formatLeft(lock.checkInEndsAt - now)));
    } else if (locked) {
      kids.push(banner('lock', 'lock', `Locked until ${HM.formatWhen(state.lock.until)}`, HM.formatLeft(state.lock.until - now)));
    }

    kids.push(label('Hide'));
    kids.push(group('switches', HM.SWITCHES.map((sw) => {
      if (!open) return switchRow(['hide', sw.id], h('span', { text: sw.label }), sw.label, state.hide[sw.id], locked);
      const still = sw.id === 'aiFeatures' && effective.hide.aiFeatures;
      return h('div', { class: still ? 'row dim' : 'row' }, h('span', { text: sw.label }),
        h('span', { class: still ? 'v' : 'showing', text: still ? 'Still hidden' : 'Showing' }));
    })));

    kids.push(label('On'));
    kids.push(group('switches', HM.SITES.map((site) =>
      switchRow(['sites', site.id], siteName(site.label), site.label, state.sites[site.id], locked))));

    if (open) {
      kids.push(h('button', { class: 'btn ghost', text: 'End check-in now', onclick: () => act({ type: 'endCheckIn' }) }));
    } else if (locked) {
      kids.push(group('', [
        lock.nextCheckIn && valueRow('Next check-in', HM.formatWhen(lock.nextCheckIn)),
        linkRow('Extend lock', '', () => go('extend')),
      ]));
      kids.push(incognitoGroup(true));
    } else {
      kids.push(group('', [linkRow('Hard mode', 'Off', () => go('setup'))]));
    }

    app.classList.toggle('paused', state.paused && !locked);
    show(kids);
  }

  // ---------- hard mode setup and extend ----------

  const pad = (n) => String(n).padStart(2, '0');
  const dateValue = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const timeValue = (ms) => HM.formatTime(ms);
  const minutesOf = (value) => { const [hh, mm] = value.split(':').map(Number); return hh * 60 + mm; };
  const DAYS = [[1, 'Monday'], [2, 'Tuesday'], [3, 'Wednesday'], [4, 'Thursday'], [5, 'Friday'], [6, 'Saturday'], [0, 'Sunday']];

  // The "Lock until" fields and quick picks. `floor` = the time the new end
  // must be later than (now, or the current lock end when extending).
  function untilPicker(initial, floor, onValid) {
    const date = h('input', { type: 'date', class: 'field grow', 'aria-label': 'Lock until date', value: dateValue(initial), min: dateValue(Math.max(Date.now(), floor)) });
    const time = h('input', { type: 'time', class: 'field', 'aria-label': 'Lock until time', value: timeValue(initial) });
    const picks = [['tomorrow', 'Tomorrow'], ['week', '1 week'], ['date', 'Until a date']];
    const chips = picks.map(([kind, text]) => h('button', { class: 'chip', text, onclick: () => pick(kind) }));

    function read() {
      const [y, m, d] = date.value.split('-').map(Number);
      if (!y || !m || !d || !time.value) return NaN;
      return new Date(y, m - 1, d, 0, minutesOf(time.value)).getTime();
    }
    function sync() {
      const now = Date.now();
      const t = read();
      const preset = { tomorrow: HM.quickPick('tomorrow', now), week: HM.quickPick('week', now) };
      chips[0].classList.toggle('sel', t === preset.tomorrow);
      chips[1].classList.toggle('sel', t === preset.week);
      chips[2].classList.toggle('sel', t !== preset.tomorrow && t !== preset.week);
      chips[0].disabled = preset.tomorrow <= floor;
      chips[1].disabled = preset.week <= floor;
      onValid(t > Math.max(now, floor) ? t : null);
    }
    function pick(kind) {
      if (kind === 'date') {
        date.focus();
        try { date.showPicker(); } catch { /* not supported or not allowed */ }
        return;
      }
      const t = HM.quickPick(kind, Date.now());
      date.value = dateValue(t);
      time.value = timeValue(t);
      sync();
    }
    date.addEventListener('input', sync);
    time.addEventListener('input', sync);
    queueMicrotask(sync);
    return [label('Lock until'), h('div', { class: 'fields' }, date, time), h('div', { class: 'chips' }, chips)];
  }

  function viewSetup() {
    let until = null;
    const btn = h('button', { class: 'btn', text: 'Lock', disabled: true });
    const picker = untilPicker(HM.quickPick('week', Date.now()), Date.now(), (t) => { until = t; btn.disabled = t == null; });

    const day = h('select', { class: 'plain', 'aria-label': 'Check-in day' }, DAYS.map(([v, text]) => h('option', { value: String(v), text })));
    day.value = '0';
    const starts = h('input', { type: 'time', class: 'plain', 'aria-label': 'Check-in starts', value: '10:00' });
    const lasts = h('select', { class: 'plain', 'aria-label': 'Check-in length' },
      [15, 30, 60].map((n) => h('option', { value: String(n), text: `${n} min` })));
    lasts.value = '30';
    const detail = [
      h('div', { class: 'row' }, h('span', { text: 'Day' }), day),
      h('div', { class: 'row' }, h('span', { text: 'Starts' }), starts),
      h('div', { class: 'row' }, h('span', { text: 'Lasts' }), lasts),
    ];
    let checkInOn = true;
    const ciToggle = toggle({ checked: true, label: 'Weekly check-in', onchange: (on) => { checkInOn = on; detail.forEach((r) => { r.hidden = !on; }); } });

    btn.addEventListener('click', () => {
      if (until == null) return;
      // Ask for `tabs` (lets the lock guard the extensions page) inside this
      // click, and send the lock right away: Chrome's permission prompt can
      // close the popup before the answer comes back. Declining only means
      // no guard; the lock itself works either way.
      if (inExtension) chrome.permissions.request({ permissions: ['tabs'] }).catch(() => {});
      const checkIn = checkInOn && starts.value
        ? { day: Number(day.value), startMin: minutesOf(starts.value), lengthMin: Number(lasts.value) }
        : null;
      view = 'main';
      act({ type: 'lock', until, checkIn, guard: true });
    });

    app.classList.remove('paused');
    show(
      backHead('Hard mode'),
      ...picker,
      label('Weekly check-in'),
      group('', [h('div', { class: 'row' }, h('span', { text: 'Check-in' }), ciToggle), ...detail]),
      incognitoGroup(false),
      h('p', { class: 'note', text: 'Until the lock ends, switches only turn on. The lock can be extended, not shortened.' }),
      btn,
    );
  }

  // Extensions don't run in Incognito unless allowed on their details page,
  // which the lock guards; so it's offered before locking. Assumed allowed
  // until Chrome says otherwise (preview: ?incognito=off).
  let incognitoAllowed = inExtension || new URLSearchParams(location.search).get('incognito') !== 'off';
  if (inExtension && chrome.extension && chrome.extension.isAllowedIncognitoAccess) {
    chrome.extension.isAllowedIncognitoAccess().then((ok) => {
      incognitoAllowed = ok;
      if (!ok) render();
    }, () => {});
  }

  function incognitoGroup(locked) {
    if (incognitoAllowed) return null;
    const open = () => chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
    return group('', [h('div', { class: 'row' },
      h('span', { class: 'stack' }, h('span', { text: 'Not running in Incognito' }),
        locked && h('small', { text: 'Can be allowed after the lock ends' })),
      !locked && h('button', { class: 'mini', text: 'Open settings', onclick: open }))]);
  }

  function viewExtend() {
    const current = data.state.lock.until;
    let until = null;
    const btn = h('button', { class: 'btn', text: 'Extend lock', disabled: true });
    const picker = untilPicker(current, current, (t) => { until = t; btn.disabled = t == null; });
    btn.addEventListener('click', async () => {
      if (until == null) return;
      view = 'main';
      await act({ type: 'extend', until });
    });
    app.classList.remove('paused');
    show(backHead('Extend lock'), ...picker, btn);
  }

  function show(...parts) {
    app.replaceChildren(...parts.flat().filter((p) => p != null && p !== false));
  }

  function render() {
    if (!data) return;
    if (view === 'setup') viewSetup();
    else if (view === 'extend') viewExtend();
    else viewMain();
  }

  refresh();
  setInterval(refresh, 30000);
  if (inExtension) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.effective) refresh();
    });
  }
})();
