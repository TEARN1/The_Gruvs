// ── Touch Down streak ─────────────────────────────────────────────────────────
// Consecutive weekends out, CELEBRATED — never guilt-tripped (#41 / #101). A
// streak is a high-five for showing up in the real world, not a debt you owe:
// a broken streak gets an encouraging nudge, never a scold. Pure.
//
// Weeks are Mon–Sun so a Fri/Sat/Sun weekend shares one week bucket.

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MONDAY_EPOCH = Date.UTC(1970, 0, 5); // Jan 5 1970 was a Monday

const weekIndex = (t) => Math.floor((t - MONDAY_EPOCH) / WEEK_MS);

export function buildTouchDownStreak(checkinDates = [], now = Date.now()) {
  const weeks = new Set();
  for (const d of (Array.isArray(checkinDates) ? checkinDates : [])) {
    const t = d ? new Date(d).getTime() : NaN;
    if (Number.isFinite(t)) weeks.add(weekIndex(t));
  }
  const sorted = [...weeks].sort((a, b) => a - b);
  const thisWeek = weekIndex(now);
  const thisWeekendOut = weeks.has(thisWeek);

  // longest consecutive run anywhere in history
  let longest = 0, run = 0, prev = null;
  for (const w of sorted) {
    run = (prev !== null && w === prev + 1) ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = w;
  }

  // current streak: consecutive weeks ending this weekend (out now), or still
  // "alive" from last weekend if you simply haven't been out yet this one.
  const anchor = thisWeekendOut ? thisWeek : (weeks.has(thisWeek - 1) ? thisWeek - 1 : null);
  let current = 0;
  if (anchor !== null) { let w = anchor; while (weeks.has(w)) { current++; w--; } }
  const alive = anchor !== null;

  let message;
  if (current >= 2) message = `🔥 ${current} weekends running${thisWeekendOut ? '' : ' — keep it alive this weekend'}`;
  else if (thisWeekendOut)  message = 'You started a streak — nice';
  else if (alive)           message = 'One more weekend keeps it going';
  else                      message = 'Your next night out starts a streak';

  return { current, longest, thisWeekendOut, alive, message };
}
