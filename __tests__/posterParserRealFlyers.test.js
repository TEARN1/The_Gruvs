/**
 * Real-world flyer regressions.
 *
 * The unit tests were all written against text I invented, which made the parser
 * look far more accurate than it was. These five are the shapes SA hosts ACTUALLY
 * post — artist-name-first club flyers, WhatsApp blasts with no date, prize money,
 * decimal prices. Every assertion below is a bug that shipped.
 *
 * Guiding rule: an EMPTY field beats a WRONG one. A blank field prompts the host
 * to fill it; a plausible-but-wrong value gets published without a second look.
 */
import { parsePosterText } from '../src/utils/posterParser';

const NOW = new Date('2026-07-12T12:00:00'); // a Sunday

describe('artist-name-first club flyer', () => {
  const p = parsePosterText(`KABZA DE SMALL
& DJ MAPHORISA
SCORPION KINGS LIVE
SATURDAY 15 AUGUST
KONKA SOWETO
GATES OPEN 14:00
R250 EARLY BIRD | R350 AT THE DOOR
NO UNDER 18s`, NOW);

  // "NO UNDE-R 18s" — the trailing R of UNDER was read as a Rand sign, so the
  // entry price came out as R18 instead of R250.
  it('does not read the R inside a word as a price', () => {
    expect(p.price).toBe(250);
  });
  // "R350 AT THE DOOR" is a price, not a place. It was filling Venue as "THE DOOR".
  it('does not mistake "at the door" for the venue', () => {
    expect(p.venue).toBe('KONKA SOWETO');
  });
  it('still reads the tiers, date, time and age gate', () => {
    expect(p.extraTiers).toEqual([
      { name: 'EARLY BIRD', price: '250' },
      { name: 'DOOR', price: '350' },
    ]);
    expect(p.date).toBe('2026-08-15');
    expect(p.time).toEqual({ h: 14, m: 0 });
    expect(p.ageMin).toBe(18);
  });
});

describe('prize money must not become the ticket price', () => {
  const p = parsePosterText(`SOWETO DERBY FUN DAY
Win R50 000 in cash prizes!
Entry only R30 per person
Sunday 3 August 2026, 10am
Call 072 555 1234 to book`, NOW);

  it('takes the entry price, not the prize', () => {
    expect(p.price).toBe(30);
  });
  // The title carries a city name — the venue fallback was stealing it.
  it('does not let a city in the title become the venue', () => {
    expect(p.title).toBe('SOWETO DERBY FUN DAY');
    expect(p.venue).toBe('');
  });
  it('reads the phone', () => expect(p.phone).toBe('0725551234'));
});

describe('WhatsApp blast — no date, no title, lowercase', () => {
  const p = parsePosterText(`guys we are doing a picnic this saturday
emmarentia dam jhb
bring your own food
starts 11am till late
its free just come through`, NOW);

  // The paste box IS the WhatsApp path, and a blast almost never carries a
  // calendar date. "this saturday" used to parse as null.
  it('resolves a relative date', () => {
    expect(p.date).toBe('2026-07-18'); // the Saturday after Sun 12 Jul
  });
  it('understands SA shorthand for cities', () => {
    expect(p.city).toBe('Johannesburg'); // "jhb"
  });
  it('finds a venue with no venue-keyword in it', () => {
    expect(p.venue).toBe('emmarentia dam jhb');
  });
  it('leaves the title EMPTY rather than grabbing a sentence', () => {
    expect(p.title).toBe(''); // not "bring your own food"
  });
  it('detects free entry', () => expect(p.isFree).toBe(true));
});

describe('decimal price', () => {
  const p = parsePosterText(`WINE TASTING
Glass from R1.500 for the premium flight
Fri 22 Aug · 18:00
The Winery, Stellenbosch`, NOW);

  // On SA flyers "R1.500" is a thousands separator, not R1.50. It parsed as R1.
  it('reads R1.500 as R1 500, not R1', () => {
    expect(p.price).toBe(1500);
  });
});

describe('all-caps club flyer with label lines and decoration', () => {
  const p = parsePosterText(`~~~ FRIDAY ~~~
AMAPIANO INVASION
VENUE: THE MIX LOUNGE
TIME: 21H00 TILL LATE
ENTRANCE: R100 B4 22H00 / R150 AFTER
INFO: 083 999 0000`, NOW);

  it('resolves a bare weekday to the next one', () => {
    expect(p.date).toBe('2026-07-17'); // the Friday after Sun 12 Jul
  });
  it('reads the venue off a VENUE: label', () => expect(p.venue).toBe('THE MIX LOUNGE'));
  it('takes the cheaper entry price', () => expect(p.price).toBe(100));
  // "~~~ FRIDAY ~~~" and "VENUE: ..." are decoration/labels, not description.
  it('keeps decoration and label lines out of the description', () => {
    expect(p.description).toBe('');
  });
});

/**
 * The Gruvs is GLOBAL — South Africa is the launch market, not the scope.
 * The parser was written Rand-only + SA-cities-only, so a flyer from London,
 * Lagos or New York produced NO price, NO city and NO phone. That is not a
 * missing nicety — it is the app being unusable outside one country.
 */
describe('international flyers', () => {
  it('reads a London flyer', () => {
    const p = parsePosterText(`WAREHOUSE PROJECT
Printworks, London
Sat 15 August · 22:00
Entry £15 · VIP £40
Info: +44 20 7946 0958`, NOW);
    expect(p.price).toBe(15);
    expect(p.vipPrice).toBe(40);
    expect(p.city).toBe('London');
    expect(p.phone).toBe('+442079460958');
  });

  it('reads a Lagos flyer', () => {
    const p = parsePosterText(`DETTY DECEMBER
Landmark Beach, Lagos
Sun 20 December · 18:00
Gate ₦5000
Call +234 802 123 4567`, NOW);
    expect(p.price).toBe(5000);
    expect(p.city).toBe('Lagos');
    expect(p.phone).toBe('+2348021234567');
  });

  it('reads a New York flyer', () => {
    const p = parsePosterText(`BROOKLYN MIRAGE OPENING
Brooklyn, New York
Fri 5 June · 21:00
Tickets $25 · VIP $80`, NOW);
    expect(p.price).toBe(25);
    expect(p.vipPrice).toBe(80);
    expect(p.city).toBe('New York'); // "Brooklyn, New York" — the CITY is New York
  });

  it('reads a Nairobi flyer with a word-symbol currency', () => {
    const p = parsePosterText(`KOROGA FESTIVAL
Arboretum, Nairobi
Sat 2 May · 12:00
Entry KSh 1500`, NOW);
    expect(p.price).toBe(1500);
    expect(p.city).toBe('Nairobi');
  });

  it('still refuses to read a letter-R inside a word as a price', () => {
    // The global token list must not reintroduce the "NO UNDER 18s" → R18 bug.
    const p = parsePosterText(`BERLIN RAVE\nBerlin\nSat 1 August · 23:00\nEntry €20\nNO UNDER 18s`, NOW);
    expect(p.price).toBe(20);
    expect(p.ageMin).toBe(18);
  });
});

/**
 * FIELD PLACEMENT — the data must land in the RIGHT box.
 * Parsing a value correctly and then putting it in the wrong field is just as
 * broken as not parsing it, and it's worse for the host: it looks filled in.
 */
describe('field placement', () => {
  it('does not repeat the city inside the venue field', () => {
    const p = parsePosterText(`AMAPIANO SUNSET
The Bannister Hotel, Braamfontein, Johannesburg
Saturday 15 August 2026 · 18h00
Entry R150`, NOW);
    expect(p.city).toBe('Johannesburg');
    expect(p.venue).toBe('The Bannister Hotel, Braamfontein'); // city stripped
  });

  it('leaves a venue whose NAME contains the city alone', () => {
    const p = parsePosterText(`KONKA LIVE\nKONKA SOWETO\nSat 15 Aug · 20:00\nR200`, NOW);
    expect(p.venue).toBe('KONKA SOWETO'); // that IS its name, not a duplicate
    expect(p.city).toBe('Soweto');
  });

  it('never echoes the venue line back into the description', () => {
    const p = parsePosterText(`AMAPIANO SUNSET
The Bannister Hotel, Braamfontein, Johannesburg
Saturday 15 August 2026 · 18h00
Entry R150`, NOW);
    expect(p.description).not.toMatch(/Bannister/);
  });
});

/**
 * DATE ORDER — the ambiguity that silently destroys an event.
 * "05/07/2026" is 5 July in ZA/UK/NG but 7 May in the US. Getting this wrong
 * moves a host's event by two months and nobody notices until nobody shows up.
 */
describe('country-aware date order', () => {
  it('reads slash dates day-first by default (ZA/UK/NG/most of the world)', () => {
    expect(parsePosterText('GIG\nBraamfontein\n05/07/2026', NOW).date).toBe('2026-07-05');
  });

  it('reads a US host month-first', () => {
    expect(parsePosterText('GIG\nSomewhere\n05/07/2026', NOW, { dateOrder: 'MDY' }).date)
      .toBe('2026-05-07');
  });

  // The flyer's own city outranks the reader's location: a New York poster is
  // month-first even when pasted by someone sitting in Johannesburg.
  it("lets the flyer's US city override the host's region", () => {
    const p = parsePosterText(`SUMMER BLOCK PARTY
Bushwick, New York
05/07/2026 · 8pm
Tickets $25`, NOW, { dateOrder: 'DMY' });
    expect(p.date).toBe('2026-05-07'); // May 7, because it's a NYC flyer
  });

  it('trusts a number over the convention when it can only be a day', () => {
    // 25 cannot be a month, so this is 25 July whatever the country says.
    expect(parsePosterText('GIG\nX\n25/07/2026', NOW, { dateOrder: 'MDY' }).date)
      .toBe('2026-07-25');
  });
});

/**
 * The paste box IS the WhatsApp path, so the text arrives full of chat artifacts
 * and emoji decoration. Each of these was a real failure found by probing.
 */
describe('WhatsApp / decoration noise', () => {
  it('strips forward headers, *bold* markers and emoji bullets', () => {
    const p = parsePosterText(`[15/08, 20:14] Thabo 🔥: \u200E<attached: 00000042-PHOTO.jpg>
*AMAPIANO SUNSET* 🌅🎶
📍 Konka, Soweto
🗓 Sat 15 August
⏰ Doors 18:00
💰 R150 presale`, NOW);
    expect(p.title).toBe('AMAPIANO SUNSET');   // no asterisks, no emoji
    expect(p.venue).toBe('Konka');             // no 📍
    expect(p.city).toBe('Soweto');
    expect(p.date).toBe('2026-08-15');
  });

  // "FRIDAY VIBES" is a TITLE. The relative-weekday parser matched the bare word
  // "FRIDAY", so the line was discarded as a date and the event had NO name.
  it('does not mistake a weekday in the title for a date line', () => {
    const p = parsePosterText(`🔥🔥 FRIDAY VIBES 🔥🔥
✨ THE MIX LOUNGE ✨
📆 Fri 24 July · ⏰ 21h00 till late`, NOW);
    expect(p.title).toBe('FRIDAY VIBES');
    expect(p.venue).toBe('THE MIX LOUNGE');
    expect(p.date).toBe('2026-07-24');         // the real date line still wins
  });
});

describe('multi-day festivals (date ranges)', () => {
  // "15 - 17 August" used to yield the 17th (the digit touching the month) and
  // lose the end date — a festival with the wrong start and no duration.
  it('reads a range as start + end, not just the last day', () => {
    const p = parsePosterText(`ROCKING THE DAISIES
15 - 17 August 2026
Darling, Cape Town`, NOW);
    expect(p.date).toBe('2026-08-15');
    expect(p.endDate).toBe('2026-08-17');
  });

  it('handles month-first and cross-month ranges', () => {
    expect(parsePosterText('FEST\nAugust 15 - 17, 2026', NOW).endDate).toBe('2026-08-17');
    const cross = parsePosterText('FEST\n30 July – 2 August 2026', NOW);
    expect(cross.date).toBe('2026-07-30');
    expect(cross.endDate).toBe('2026-08-02');
  });
});

describe('tour posters (several dates + cities)', () => {
  // A tour listed 3 dates/cities and the parser silently kept only the first.
  it('detects every stop instead of keeping only the first date', () => {
    const p = parsePosterText(`SCORPION KINGS TOUR 2026
14 Aug — Johannesburg
21 Aug — Durban
28 Aug — Cape Town
Tickets from R350`, NOW);
    expect(p.tourStops).toEqual([
      { date: '2026-08-14', city: 'Johannesburg' },
      { date: '2026-08-21', city: 'Durban' },
      { date: '2026-08-28', city: 'Cape Town' },
    ]);
  });

  it('does NOT call a single event with a schedule a tour', () => {
    const p = parsePosterText(`ONE NIGHT ONLY
Konka, Soweto
Sat 15 August
21:00 Kabza De Small
22:30 DJ Maphorisa`, NOW);
    expect(p.tourStops).toEqual([]);   // one city, one date — not a tour
  });
});
