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

// Zodiac Constellation sign from birthDate
export const getZodiacSign = (birthDate) => {
  const md = parseMD(birthDate);
  if (!md) return null;
  const { month, day } = md;
  const zodiac = [
    { sign: 'Capricorn', symbol: '♑', element: 'Earth', start: [1, 1], end: [1, 19] },
    { sign: 'Aquarius', symbol: '♒', element: 'Air', start: [1, 20], end: [2, 18] },
    { sign: 'Pisces', symbol: '♓', element: 'Water', start: [2, 19], end: [3, 20] },
    { sign: 'Aries', symbol: '♈', element: 'Fire', start: [3, 21], end: [4, 19] },
    { sign: 'Taurus', symbol: '♉', element: 'Earth', start: [4, 20], end: [5, 20] },
    { sign: 'Gemini', symbol: '♊', element: 'Air', start: [5, 21], end: [6, 20] },
    { sign: 'Cancer', symbol: '♋', element: 'Water', start: [6, 21], end: [7, 22] },
    { sign: 'Leo', symbol: '♌', element: 'Fire', start: [7, 23], end: [8, 22] },
    { sign: 'Virgo', symbol: '♍', element: 'Earth', start: [8, 23], end: [9, 22] },
    { sign: 'Libra', symbol: '♎', element: 'Air', start: [9, 23], end: [10, 22] },
    { sign: 'Scorpio', symbol: '♏', element: 'Water', start: [10, 23], end: [11, 21] },
    { sign: 'Sagittarius', symbol: '♐', element: 'Fire', start: [11, 22], end: [12, 21] },
    { sign: 'Capricorn', symbol: '♑', element: 'Earth', start: [12, 22], end: [12, 31] },
  ];
  for (const z of zodiac) {
    if (
      (month === z.start[0] && day >= z.start[1]) ||
      (month === z.end[0] && day <= z.end[1])
    ) {
      return z;
    }
  }
  return null;
};

export default { isBirthdayToday, daysUntilBirthday, isBirthdayWithin, getZodiacSign };
