// Runs with TZ=America/New_York (see package.json). DST ends Sun 1 Nov 2026.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../../src/core/schedule.js';

const HM = globalThis.HM;
const U = Date.UTC;
const ci = { day: 0, startMin: 600, lengthMin: 30 };

test('runs in New York time', () => {
  assert.equal(new Date(U(2026, 9, 24, 16, 0)).getHours(), 12);
});

test('Sunday 10:00 check-in stays at 10:00 local across the DST change', () => {
  // Sat 24 Oct 12:00 EDT → Sun 25 Oct 10:00 EDT (14:00 UTC)
  assert.equal(HM.nextCheckInWindow(ci, U(2026, 9, 24, 16, 0)).start, U(2026, 9, 25, 14, 0));
  // Sat 31 Oct 12:00 EDT → Sun 1 Nov 10:00 EST (15:00 UTC)
  assert.equal(HM.nextCheckInWindow(ci, U(2026, 9, 31, 16, 0)).start, U(2026, 10, 1, 15, 0));
  // and the window is 30 real minutes long
  const w = HM.nextCheckInWindow(ci, U(2026, 9, 31, 16, 0));
  assert.equal(w.end - w.start, 30 * 6e4);
  assert.deepEqual(HM.checkInWindowAt(ci, U(2026, 10, 1, 15, 10)), w);
});

test('quick pick tomorrow is 09:00 local after the change', () => {
  assert.equal(HM.quickPick('tomorrow', U(2026, 9, 31, 16, 0)), U(2026, 10, 1, 14, 0));
});
