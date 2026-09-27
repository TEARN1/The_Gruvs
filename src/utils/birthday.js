/**
 * birthday — tiny helpers for the free birthday spotlight.
 * birth_date is a 'YYYY-MM-DD' string (or null). We only ever compare month+day,
 * never the year, so age stays private.
 */

const parseMD = (birthDate) => {
  if (!birthDate || typeof birthDate !== 'string') return null;
  const m = birthDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return { month: parseInt(m[2], 10), day: parseInt(m[3], 10) };
};

// Is today this person's birthday? (local time)
export const isBirthdayToday = (birthDate) => {
  const md = parseMD(birthDate);
  if (!md) return false;
  const now = new Date();
  return md.month === now.getMonth() + 1 && md.day === now.getDate();
};

// Days until the next birthday (0 = today). Returns null if no valid date.
export const daysUntilBirthday = (birthDate) => {
  const md = parseMD(birthDate);
  if (!md) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), md.month - 1, md.day);
  if (next < today) next = new Date(now.getFullYear() + 1, md.month - 1, md.day);
  return Math.round((next - today) / 86400000);
};

// Turning soon (within `days`, not counting today)? Useful for "birthday this week".
export const isBirthdayWithin = (birthDate, days = 7) => {
  const d = daysUntilBirthday(birthDate);
  return d != null && d > 0 && d <= days;
};

export default { isBirthdayToday, daysUntilBirthday, isBirthdayWithin };
