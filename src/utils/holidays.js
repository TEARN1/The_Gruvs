/**
 * South African public holidays (launch market). Used by the weekend/holiday
 * planner to suggest a Gruv for every long weekend / day off, ~5 weeks ahead.
 * Dates are explicit per year (Easter moves) — extend as new years are needed.
 */
const SA_HOLIDAYS = {
  2026: [
    ['2026-01-01', "New Year's Day"],
    ['2026-03-21', 'Human Rights Day'],
    ['2026-04-03', 'Good Friday'],
    ['2026-04-06', 'Family Day'],
    ['2026-04-27', 'Freedom Day'],
    ['2026-05-01', 'Workers’ Day'],
    ['2026-06-16', 'Youth Day'],
    ['2026-08-09', 'National Women’s Day'],
    ['2026-08-10', 'Women’s Day (observed)'],
    ['2026-09-24', 'Heritage Day'],
    ['2026-12-16', 'Day of Reconciliation'],
    ['2026-12-25', 'Christmas Day'],
    ['2026-12-26', 'Day of Goodwill'],
  ],
  2027: [
    ['2027-01-01', "New Year's Day"],
    ['2027-03-21', 'Human Rights Day'],
    ['2027-03-22', 'Human Rights Day (observed)'],
    ['2027-03-26', 'Good Friday'],
    ['2027-03-29', 'Family Day'],
    ['2027-04-27', 'Freedom Day'],
    ['2027-05-01', 'Workers’ Day'],
    ['2027-06-16', 'Youth Day'],
    ['2027-08-09', 'National Women’s Day'],
    ['2027-09-24', 'Heritage Day'],
    ['2027-12-16', 'Day of Reconciliation'],
    ['2027-12-25', 'Christmas Day'],
    ['2027-12-27', 'Day of Goodwill (observed)'],
  ],
};

/** Holidays (as { date:'YYYY-MM-DD', label }) falling within [from, to] inclusive. */
export function holidaysBetween(from, to) {
  const out = [];
  for (const year of [from.getFullYear(), to.getFullYear()]) {
    for (const [date, label] of (SA_HOLIDAYS[year] || [])) {
      const d = new Date(`${date}T00:00:00`);
      if (d >= from && d <= to) out.push({ date, label });
    }
  }
  // de-dupe (year overlap) + sort
  const seen = new Set();
  return out.filter(h => (seen.has(h.date) ? false : seen.add(h.date))).sort((a, b) => a.date.localeCompare(b.date));
}

export default { holidaysBetween };
