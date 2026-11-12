// Settings, lock rules and what is effectively hidden right now.
// Pure functions; the background worker is the only place that stores state.
//
// State = { v: 1, paused, hide: {switchId: bool}, sites: {siteId: bool},
//           lock: null | { until, checkIn: CheckIn | null, guard, skipUntil } }
(function (HM) {
  const SWITCHES = [
    { id: 'statsPages', label: 'Stats pages' },
    { id: 'views', label: 'Views' },
    { id: 'subscribers', label: 'Subscribers' },
    { id: 'revenue', label: 'Revenue' },
    { id: 'likes', label: 'Likes' },
    { id: 'comments', label: 'Comments' },
    { id: 'aiFeatures', label: 'AI features' },
  ];
  const SITES = [
    { id: 'youtubeStudio', label: 'YouTube Studio' },
    { id: 'youtube', label: 'YouTube' },
  ];
  const LENGTHS = [15, 30, 60];

  const isBool = (x) => typeof x === 'boolean';
  const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
  const isTime = (x) => typeof x === 'number' && Number.isFinite(x);

  function defaultState() {
    const hide = {};
    for (const { id } of SWITCHES) hide[id] = id !== 'comments';
    const sites = {};
    for (const { id } of SITES) sites[id] = true;
    return { v: 1, paused: false, hide, sites, lock: null };
  }

  function normalizeCheckIn(c) {
    if (!isObj(c)) return null;
    const ok = Number.isInteger(c.day) && c.day >= 0 && c.day <= 6 &&
      Number.isInteger(c.startMin) && c.startMin >= 0 && c.startMin < 1440 &&
      LENGTHS.includes(c.lengthMin);
    return ok ? { day: c.day, startMin: c.startMin, lengthMin: c.lengthMin } : null;
  }

  function normalizeLock(l) {
    if (!isObj(l) || !isTime(l.until)) return null;
    return {
      until: l.until,
      checkIn: normalizeCheckIn(l.checkIn),
      guard: l.guard === true,
      skipUntil: isTime(l.skipUntil) ? l.skipUntil : null,
    };
  }

  function boolMap(list, raw, fallback) {
    const src = isObj(raw) ? raw : {};
    const out = {};
    for (const { id } of list) out[id] = isBool(src[id]) ? src[id] : fallback[id];
    return out;
  }

  // Fill missing or invalid fields from defaults; drop unknown keys.
  function normalizeState(raw) {
    const d = defaultState();
    const src = isObj(raw) ? raw : {};
    return {
      v: 1,
      paused: isBool(src.paused) ? src.paused : d.paused,
      hide: boolMap(SWITCHES, src.hide, d.hide),
      sites: boolMap(SITES, src.sites, d.sites),
      lock: normalizeLock(src.lock),
    };
  }

  function isLocked(state, now) {
    return !!state.lock && now < state.lock.until;
  }

  // Clear a lock whose end has passed. Returns the same object if nothing changed.
  function settle(state, now) {
    return state.lock && !isLocked(state, now) ? { ...state, lock: null } : state;
  }

  const sameCheckIn = (a, b) =>
    a === b || (!!a && !!b && a.day === b.day && a.startMin === b.startMin && a.lengthMin === b.lengthMin);

  // While `prev` is locked, undo anything in `next` that loosens it.
  function enforceLock(prev, next, now) {
    if (!isLocked(prev, now)) return next;
    const keepOn = (was, now_) => {
      const out = { ...now_ };
      for (const id of Object.keys(was)) if (was[id] && !out[id]) out[id] = true;
      return out;
    };
    const p = prev.lock;
    const n = next.lock;
    const lock = !n ? { ...p } : {
      until: Math.max(p.until, n.until),
      checkIn: sameCheckIn(p.checkIn, n.checkIn) ? n.checkIn : p.checkIn,
      guard: p.guard || n.guard,
      // skipping may grow (ends a check-in early), never shrink (reopens one)
      skipUntil: (n.skipUntil ?? -Infinity) >= (p.skipUntil ?? -Infinity) ? n.skipUntil : p.skipUntil,
    };
    return {
      ...next,
      paused: prev.paused ? next.paused : false,
      hide: keepOn(prev.hide, next.hide),
      sites: keepOn(prev.sites, next.sites),
      lock,
    };
  }

  function applySet(state, path, value) {
    if (!Array.isArray(path) || !isBool(value)) return state;
    const [group, id] = path;
    if (group === 'paused' && path.length === 1) return { ...state, paused: value };
    const list = group === 'hide' ? SWITCHES : group === 'sites' ? SITES : null;
    if (!list || path.length !== 2 || !list.some((x) => x.id === id)) return state;
    return { ...state, [group]: { ...state[group], [id]: value } };
  }

  function reduce(state, action, now) {
    const settled = settle(state, now);
    const a = isObj(action) ? action : {};
    const locked = isLocked(settled, now);
    let next = settled;
    switch (a.type) {
      case 'set':
        next = applySet(settled, a.path, a.value);
        break;
      case 'lock':
        if (!locked && isTime(a.until) && a.until > now) {
          next = { ...settled, paused: false, lock: normalizeLock({ until: a.until, checkIn: a.checkIn, guard: a.guard, skipUntil: null }) };
        }
        break;
      case 'extend':
        if (locked && isTime(a.until) && a.until > settled.lock.until) {
          next = { ...settled, lock: { ...settled.lock, until: a.until } };
        }
        break;
      case 'endCheckIn': {
        const w = locked && settled.lock.checkIn && HM.checkInWindowAt(settled.lock.checkIn, now);
        if (w) next = { ...settled, lock: { ...settled.lock, skipUntil: w.end } };
        break;
      }
    }
    return enforceLock(settled, next, now);
  }

  // What content scripts and the popup act on right now.
  function computeEffective(state, now) {
    const s = settle(state, now);
    const hide = { ...s.hide };
    let lock = null;
    if (isLocked(s, now)) {
      const { until, checkIn, skipUntil } = s.lock;
      const w = checkIn ? HM.checkInWindowAt(checkIn, now) : null;
      const open = !!w && !(skipUntil > now);
      const next = checkIn ? HM.nextCheckInWindow(checkIn, now) : null;
      lock = {
        until,
        checkInOpen: open,
        checkInEndsAt: open ? Math.min(w.end, until) : null,
        nextCheckIn: next && next.start < until ? next.start : null,
      };
      if (open) for (const { id } of SWITCHES) hide[id] = id === 'aiFeatures' ? s.hide.aiFeatures : false;
    }
    if (s.paused) for (const { id } of SWITCHES) hide[id] = false;
    return { paused: s.paused, hide, sites: { ...s.sites }, lock };
  }

  // When `computeEffective` will next change on its own: lock end, the end of
  // the open check-in window, or the next window start. null when unlocked.
  function nextTransition(state, now) {
    const s = settle(state, now);
    if (!isLocked(s, now)) return null;
    const { until, checkIn } = s.lock;
    let t = until;
    if (checkIn) {
      const w = HM.checkInWindowAt(checkIn, now);
      if (w && w.end < t) t = w.end;
      const n = HM.nextCheckInWindow(checkIn, now);
      if (n.start < t) t = n.start;
    }
    return t;
  }

  Object.assign(HM, {
    SWITCHES, SITES, defaultState, normalizeState, isLocked, settle, enforceLock, reduce, computeEffective, nextTransition,
  });
})(globalThis.HM = globalThis.HM || {});
