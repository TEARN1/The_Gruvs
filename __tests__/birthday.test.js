import { isBirthdayToday, daysUntilBirthday, isBirthdayWithin } from '../src/utils/birthday';

// Build a 'YYYY-MM-DD' string for `now` shifted by `dayDelta` days (year ignored by the helpers).
const dateStr = (dayDelta = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + dayDelta);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `1995-${mm}-${dd}`;
};

describe('birthday helpers', () => {
  describe('isBirthdayToday', () => {
    it('is true when month+day match today (year ignored)', () => {
      expect(isBirthdayToday(dateStr(0))).toBe(true);
    });
    it('is false for a different day', () => {
      expect(isBirthdayToday(dateStr(1))).toBe(false);
    });
    it('is false for null / malformed input', () => {
      expect(isBirthdayToday(null)).toBe(false);
      expect(isBirthdayToday('not-a-date')).toBe(false);
      expect(isBirthdayToday('1995-13-40')).toBe(false); // parses but won't match today
      expect(isBirthdayToday(undefined)).toBe(false);
    });
  });

  describe('daysUntilBirthday', () => {
    it('is 0 on the birthday', () => {
      expect(daysUntilBirthday(dateStr(0))).toBe(0);
    });
    it('counts forward to an upcoming birthday', () => {
      expect(daysUntilBirthday(dateStr(3))).toBe(3);
    });
    it('returns null for invalid input', () => {
      expect(daysUntilBirthday(null)).toBeNull();
      expect(daysUntilBirthday('xyz')).toBeNull();
    });
    it('never returns negative (wraps to next year)', () => {
      const d = daysUntilBirthday(dateStr(-5));
      expect(d).toBeGreaterThan(0);
    });
  });

  describe('isBirthdayWithin', () => {
    it('is true within the window but not today', () => {
      expect(isBirthdayWithin(dateStr(2), 7)).toBe(true);
    });
    it('is false on the day itself (d>0 required)', () => {
      expect(isBirthdayWithin(dateStr(0), 7)).toBe(false);
    });
    it('is false outside the window', () => {
      expect(isBirthdayWithin(dateStr(20), 7)).toBe(false);
    });
    it('is false for invalid input', () => {
      expect(isBirthdayWithin(null)).toBe(false);
    });
  });
});