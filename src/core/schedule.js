// Time math for the lock and the weekly check-in. All calendar math is in
// local time; all timestamps are epoch milliseconds.
//
// CheckIn = { day: 0..6 (0 = Sunday), startMin: 0..1439, lengthMin: 15 | 30 | 60 }
(function (HM) {
  const MIN = 6e4;
  const HOUR = 36e5;
  const DAY = 864e5;
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Local wall-clock time `minutes` after midnight, `offset` calendar days from
  // the day containing `now`. The Date constructor resolves DST for us.
  function atLocal(now, offset, minutes) {
    const d = new Date(now);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset, 0, minutes).getTime();
  }

  function span(checkIn, start) {
    return { start, end: start + checkIn.lengthMin * MIN };
  }

  // The window containing `now` (start <= now < end), or null.
  function checkInWindowAt(checkIn, now) {
    const back = (new Date(now).getDay() - checkIn.day + 7) % 7;
    let start = atLocal(now, -back, checkIn.startMin);
    if (start > now) start = atLocal(now, -back - 7, checkIn.startMin);
    const w = span(checkIn, start);
    return now < w.end ? w : null;
  }

  // The first window that starts strictly after `now`.
  function nextCheckInWindow(checkIn, now) {
    const ahead = (checkIn.day - new Date(now).getDay() + 7) % 7;
    let start = atLocal(now, ahead, checkIn.startMin);
    if (start <= now) start = atLocal(now, ahead + 7, checkIn.startMin);
    return span(checkIn, start);
  }

  // 'tomorrow' = tomorrow 09:00; 'week' = 7 days from today at 09:00.
  function quickPick(kind, now) {
    return atLocal(now, kind === 'tomorrow' ? 1 : 7, 9 * 60);
  }

  const pad = (n) => String(n).padStart(2, '0');

  function formatTime(ms) {
    const d = new Date(ms);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // "Mon 30 Nov, 09:00"
  function formatWhen(ms) {
    const d = new Date(ms);
    return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}, ${formatTime(ms)}`;
  }

  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'} left`;

  // "17 days left" / "5 hours left" / "22 min left"
  function formatLeft(ms) {
    if (ms >= DAY) return plural(Math.floor(ms / DAY), 'day');
    if (ms >= HOUR) return plural(Math.floor(ms / HOUR), 'hour');
    return `${Math.max(0, Math.ceil(ms / MIN))} min left`;
  }

  Object.assign(HM, { checkInWindowAt, nextCheckInWindow, quickPick, formatWhen, formatTime, formatLeft });
})(globalThis.HM = globalThis.HM || {});
