import { parsePosterText, parseDate, parseTime, parsePrice, detectCategories, parsePower, detectEventTags, parseEventFormat, parseSecretAct, parseAgeRange, parseTiers, parseLineup, normalizeOcr } from '../src/utils/posterParser';

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
  it('pulls VIP / VVIP tiers when labelled', () => {
    const r = parsePosterText('General R150  VIP R400  VVIP R900', NOW);
    expect(r.price).toBe(150);
    expect(r.vipPrice).toBe(400);
    expect(r.vvipPrice).toBe(900);
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

describe('load-shedding power', () => {
  it('reads the backup source', () => {
    expect(parsePower('Generator on site — no load-shedding blackouts')).toBe('generator');
    expect(parsePower('100% solar powered venue')).toBe('solar');
    expect(parsePower('Backed by UPS / inverter')).toBe('ups');
    expect(parsePower('Party at Kitcheners')).toBe(null);
  });
});

describe('good-to-know tags', () => {
  it('maps copy to EVENT_TAGS keys', () => {
    const t = detectEventTags('Wheelchair access · gated parking · car guards on duty. Strobe lights used. Sober-friendly space near the Gautrain.');
    expect(t).toEqual(expect.arrayContaining([
      'wheelchair', 'gated_parking', 'car_guards', 'strobe', 'sober_friendly', 'near_transit',
    ]));
  });
  it('returns nothing when the poster says nothing', () => {
    expect(detectEventTags('Live jazz all night')).toEqual([]);
  });
});

describe('event format', () => {
  it('maps to an EVENT_TYPES value', () => {
    expect(parseEventFormat('Warehouse rave till sunrise')).toBe('Rave');
    expect(parseEventFormat('Photography workshop')).toBe('Workshop');
    expect(parseEventFormat('Summer music festival')).toBe('Festival');
    expect(parseEventFormat('Founders networking mixer')).toBe('Meetup');
    expect(parseEventFormat('A quiet evening')).toBe('');
  });
});

describe('secret headliner', () => {
  it('pulls the named act', () => {
    expect(parseSecretAct('Secret headliner: Black Coffee')).toBe('Black Coffee');
    expect(parseSecretAct('Special guest - Kabza De Small')).toBe('Kabza De Small');
  });
  it('flags TBA when teased but unnamed', () => {
    expect(parseSecretAct('Plus a surprise guest you do NOT want to miss')).toBe('TBA');
  });
  it('is empty when absent', () => {
    expect(parseSecretAct('Doors at 9pm')).toBe('');
  });
});

describe('age range', () => {
  it('reads an explicit range', () => {
    expect(parseAgeRange('Ages 21-35 only')).toEqual({ min: 21, max: 35 });
    expect(parseAgeRange('18 to 30 year olds')).toEqual({ min: 18, max: 30 });
  });
  it('never mistakes prices or times for ages', () => {
    expect(parseAgeRange('R150-R300 · 21:00 - 02:00')).toEqual({ min: 0, max: 0 });
  });
});

describe('parsePosterText — full poster', () => {
  it('fills every field the poster mentions', () => {
    const p = parsePosterText(`AMAPIANO SUNSET
    Rooftop rave at The Bannister Hotel, Braamfontein, Johannesburg
    Saturday 15 August 2026 · 18h00 - 02h00
    Ages 21-35 · Entry R150 · VIP R400
    Secret headliner: Kabza De Small
    Generator on site — load-shedding proof
    Wheelchair access · gated parking · car guards
    Tickets: https://quicket.co.za/amapiano-sunset
    Info: 082 123 4567 / hello@gruvs.co.za`, NOW);

    expect(p.date).toBe('2026-08-15');
    expect(p.time).toEqual({ h: 18, m: 0 });
    expect(p.endTime).toEqual({ h: 2, m: 0 });
    expect(p.city).toBe('Johannesburg');
    expect(p.price).toBe(150);
    expect(p.vipPrice).toBe(400);
    expect(p.ageMin).toBe(21);
    expect(p.ageMax).toBe(35);
    expect(p.eventType).toBe('Rave');
    expect(p.powerBackup).toBe('generator');
    expect(p.secretAct).toBe('Kabza De Small');
    expect(p.eventTags).toEqual(expect.arrayContaining(['wheelchair', 'gated_parking', 'car_guards']));
    expect(p.ticketUrl).toContain('quicket');
    expect(p.email).toBe('hello@gruvs.co.za');
    expect(p.phone).toContain('082');
    expect(p.categories.length).toBeGreaterThan(0);
  });
});

describe('ticket tiers', () => {
  it('pulls named tiers off one line', () => {
    expect(parseTiers('Early Bird R100 · Phase 1 R150 · Table booking R2500')).toEqual([
      { name: 'Early Bird', price: '100' },
      { name: 'Phase 1', price: '150' },
      { name: 'Table Booking', price: '2500' },
    ]);
  });
  it('ignores prices with no tier name', () => {
    expect(parseTiers('Entry R150')).toEqual([]);
  });
});

describe('lineup', () => {
  it('turns a running order into schedule slots', () => {
    expect(parseLineup('21:00 Kabza De Small\n22h30 — DJ Maphorisa (live set)')).toEqual([
      { time: '21:00', title: 'Kabza De Small', performer: 'Kabza De Small', notes: '' },
      { time: '22:30', title: 'DJ Maphorisa', performer: 'DJ Maphorisa', notes: 'live set' },
    ]);
  });
  it('does not treat a lone start time as a lineup', () => {
    expect(parseLineup('Doors 20:00 sharp')).toEqual([]);
    expect(parseLineup('21:00 Kabza De Small')).toEqual([]);
  });
});

describe('description', () => {
  it('keeps human copy and drops anything already captured as a field', () => {
    const p = parsePosterText(`AMAPIANO SUNSET
    Rooftop rave with the best view in the city.
    Entry R150 · VIP R400 · Ages 21-35
    Generator on site — load-shedding proof
    Wheelchair access · gated parking
    Tickets: https://quicket.co.za/x
    Info: 082 123 4567 / hello@gruvs.co.za`, NOW);

    expect(p.description).toContain('best view in the city');
    expect(p.description).not.toMatch(/R150|R400|21-35|082|http|wheelchair|generator/i);
  });
});

describe('venue', () => {
  it('reads a real venue from an @ / at cue', () => {
    expect(parsePosterText('AMAPIANO SUNSET\nat The Bannister Hotel, Braamfontein', NOW).venue)
      .toBe('The Bannister Hotel, Braamfontein');
    expect(parsePosterText('BIG NIGHT\n@ Kitcheners Carvery Bar', NOW).venue)
      .toBe('Kitcheners Carvery Bar');
  });
  it('reads a bare venue name line', () => {
    expect(parsePosterText('JAZZ NIGHT\nThe Orbit Jazz Club', NOW).venue).toBe('The Orbit Jazz Club');
  });
  it('never mistakes marketing copy for a venue', () => {
    // "rooftop" is a venue word, but this line is prose — better to leave Venue
    // empty for the host than to fill it with a slogan.
    expect(parsePosterText('SUNSET\nRooftop rave with the best view in the city.', NOW).venue).toBe('');
    expect(parsePosterText('SUNSET\nCome join us at the biggest party of the year', NOW).venue).toBe('');
  });
  it('falls back to a street address', () => {
    expect(parsePosterText('POP UP\n12 Juta Street, Braamfontein', NOW).venue).toBe('12 Juta Street, Braamfontein');
  });
});

describe('OCR repair', () => {
  it('fixes digits misread as letters inside prices and times', () => {
    expect(normalizeOcr('Entry RI5O')).toBe('Entry R150');
    expect(normalizeOcr('Doors 2I:OO')).toBe('Doors 21:00');
    expect(normalizeOcr('I8h3O')).toBe('18h30');
  });
  it('never touches ordinary words', () => {
    expect(normalizeOcr('ROOFTOP RAVE at LOUNGE, SOWETO')).toBe('ROOFTOP RAVE at LOUNGE, SOWETO');
    expect(normalizeOcr('RSVP now')).toBe('RSVP now');
  });
  it('recovers a price and time a raw OCR pass would have lost', () => {
    const p = parsePosterText('AMAPIANO\nDoors 2I:OO · Entry RI5O', NOW);
    expect(p.price).toBe(150);
    expect(p.time).toEqual({ h: 21, m: 0 });
  });
});
