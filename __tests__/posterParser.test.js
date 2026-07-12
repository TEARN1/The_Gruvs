import { parsePosterText, parseDate, parseTime, parsePrice, detectCategories } from '../src/utils/posterParser';

const NOW = new Date('2026-07-01T12:00:00');

describe('parseDate', () => {
  it('reads many formats to YYYY-MM-DD', () => {
    expect(parseDate('Sat, 05 Jul 2026', NOW)).toBe('2026-07-05');
    expect(parseDate('5 July 2026', NOW)).toBe('2026-07-05');
    expect(parseDate('July 5, 2026', NOW)).toBe('2026-07-05');
    expect(parseDate('5th July', NOW)).toBe('2026-07-05');
    expect(parseDate('2026-07-05', NOW)).toBe('2026-07-05');
    expect(parseDate('05/07/2026', NOW)).toBe('2026-07-05');   // SA day-first
    expect(parseDate('05-07-26', NOW)).toBe('2026-07-05');
  });
  it('infers the next future year when omitted', () => {
    // June already passed relative to NOW (1 July) → next year
    expect(parseDate('12 June', NOW)).toBe('2027-06-12');
    // August is still ahead → this year
    expect(parseDate('20 August', NOW)).toBe('2026-08-20');
  });
  it('returns null when there is no date', () => {
    expect(parseDate('Big party this weekend', NOW)).toBeNull();
  });
});

describe('parseTime', () => {
  it('parses 24h, h-notation and am/pm', () => {
    expect(parseTime('20:00').start).toEqual({ h: 20, m: 0 });
    expect(parseTime('Doors 21h00').start).toEqual({ h: 21, m: 0 });
    expect(parseTime('from 8pm').start).toEqual({ h: 20, m: 0 });
    expect(parseTime('8:30 PM').start).toEqual({ h: 20, m: 30 });
  });
  it('captures a start–end range', () => {
    const r = parseTime('20h00 - 02h00');
    expect(r.start).toEqual({ h: 20, m: 0 });
    expect(r.end).toEqual({ h: 2, m: 0 });
  });
  it('prefers a cued time over a stray number', () => {
    expect(parseTime('Only 5 tickets left. Starts 9pm').start).toEqual({ h: 21, m: 0 });
  });
});

describe('parsePrice', () => {
  it('reads Rand amounts and picks the entry (lowest)', () => {
    expect(parsePrice('R150').amount).toBe(150);
    expect(parsePrice('From R490').amount).toBe(490);
    expect(parsePrice('Presale R120 / Door R180')).toMatchObject({ amount: 120, fromPrice: true });
    expect(parsePrice('R1,500 VIP')).toMatchObject({ amount: 1500 });
  });
  it('detects free entry', () => {
    expect(parsePrice('FREE ENTRY')).toMatchObject({ isFree: true, amount: 0 });
    expect(parsePrice('Free event — all welcome').isFree).toBe(true);
    // but not "free" when a price is present (e.g. "free drink with R100 ticket")
    expect(parsePrice('Free drink with R100 ticket').isFree).toBe(false);
  });
});

describe('detectCategories', () => {
  it('maps keywords to real category keys', () => {
    expect(detectCategories('Amapiano party with top DJs')).toContain('nightlife');
    expect(detectCategories('Live music festival')).toEqual(expect.arrayContaining(['music']));
    expect(detectCategories('Soccer tournament cup final')).toContain('sport');
    expect(detectCategories('Business networking summit')).toContain('biz');
    expect(detectCategories('Singles mingle night')).toContain('dating');
  });
});

describe('parsePosterText — end to end on realistic flyers', () => {
  it('extracts a full nightlife flyer', () => {
    const poster = `BOOMTOWN
Presented by Johnnie Walker
Saturday 04 July 2026
Doors 21h00 til late
Hollywoodbets Greyville Racecourse
150 Avondale Road, Durban
Tickets from R490 on Quicket
18+ only`;
    const r = parsePosterText(poster, NOW);
    expect(r.title.toLowerCase()).toContain('boomtown');
    expect(r.date).toBe('2026-07-04');
    expect(r.time).toEqual({ h: 21, m: 0 });
    expect(r.price).toBe(490);
    expect(r.fromPrice).toBe(true);
    expect(r.city).toBe('Durban');
    expect(r.ageMin).toBe(18);
    expect(r.venue.toLowerCase()).toContain('greyville');
    expect(r.fields.date && r.fields.time && r.fields.price).toBe(true);
  });

  it('extracts a free daytime event', () => {
    const poster = `THE SHOPPING & FOOD FEST 2026
July Holiday Edition
10 July · 10am - 6pm
Roman Sports Emmarentia Palace
Johannesburg
FREE ENTRY
A massive Halaal food market`;
    const r = parsePosterText(poster, NOW);
    expect(r.date).toBe('2026-07-10');
    expect(r.isFree).toBe(true);
    expect(r.city).toBe('Johannesburg');
    expect(r.categories).toEqual(expect.arrayContaining(['food']));
    expect(r.description.length).toBeGreaterThan(0);
  });

  it('captures a phone number and ticket link', () => {
    const r = parsePosterText('Info 082 555 1234  Tickets: https://webtickets.co.za/gruv', NOW);
    expect(r.phone).toBe('0825551234');
    expect(r.ticketUrl).toContain('webtickets');
    expect(r.fields.phone).toBe(true);
  });

  it('never throws on empty / garbage input', () => {
    expect(() => parsePosterText('', NOW)).not.toThrow();
    expect(() => parsePosterText(null, NOW)).not.toThrow();
    const r = parsePosterText('@#$%^&*', NOW);
    expect(r.title).toBe('');
    expect(Object.keys(r.fields).length).toBe(0);
  });
});
