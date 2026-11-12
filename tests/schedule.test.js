import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/core/schedule.js';

const HM = globalThis.HM;
const U = Date.UTC;
// Thursday 2026-11-12 is "now". Sunday 10:00, 30 minutes.
const ci = { day: 0, startMin: 600, lengthMin: 30 };

test('window containing now', () => {
  assert.deepEqual(HM.checkInWindowAt(ci, U(2026, 10, 15, 10, 10)), { start: U(2026, 10, 15, 10, 0), end: U(2026, 10, 15, 10, 30) });
  assert.deepEqual(HM.checkInWindowAt(ci, U(2026, 10, 15, 10, 0)), { start: U(2026, 10, 15, 10, 0), end: U(2026, 10, 15, 10, 30) }); // start is inclusive
  assert.equal(HM.checkInWindowAt(ci, U(2026, 10, 15, 10, 30)), null); // end is exclusive
  assert.equal(HM.checkInWindowAt(ci, U(2026, 10, 12, 10, 10)), null);
});

test('window that crosses midnight is found from the next day', () => {
  const late = { day: 6, startMin: 23 * 60 + 45, lengthMin: 30 }; // Sat 23:45 → Sun 00:15
  assert.deepEqual(HM.checkInWindowAt(late, U(2026, 10, 15, 0, 5)), { start: U(2026, 10, 14, 23, 45), end: U(2026, 10, 15, 0, 15) });
});

test('next window is strictly after now', () => {
  assert.equal(HM.nextCheckInWindow(ci, U(2026, 10, 12, 12, 0)).start, U(2026, 10, 15, 10, 0));
  assert.equal(HM.nextCheckInWindow(ci, U(2026, 10, 15, 10, 10)).start, U(2026, 10, 22, 10, 0));
  assert.equal(HM.nextCheckInWindow(ci, U(2026, 10, 15, 10, 0)).start, U(2026, 10, 22, 10, 0));
  assert.equal(HM.nextCheckInWindow(ci, U(2026, 10, 15, 9, 59)).end, U(2026, 10, 15, 10, 30));
});

test('quick picks', () => {
  assert.equal(HM.quickPick('tomorrow', U(2026, 10, 12, 16, 40)), U(2026, 10, 13, 9, 0));
  assert.equal(HM.quickPick('week', U(2026, 10, 12, 16, 40)), U(2026, 10, 19, 9, 0));
});

test('formatting', () => {
  assert.equal(HM.formatWhen(U(2026, 10, 30, 9, 0)), 'Mon 30 Nov, 09:00');
  assert.equal(HM.formatWhen(U(2026, 10, 1, 0, 5)), 'Sun 1 Nov, 00:05');
  assert.equal(HM.formatLeft(17 * 864e5 + 5 * 36e5), '17 days left');
  assert.equal(HM.formatLeft(864e5 + 2 * 36e5), '1 day left');
  assert.equal(HM.formatLeft(5 * 36e5 + 10 * 6e4), '5 hours left');
  assert.equal(HM.formatLeft(36e5), '1 hour left');
  assert.equal(HM.formatLeft(22 * 6e4 - 500), '22 min left');
});
