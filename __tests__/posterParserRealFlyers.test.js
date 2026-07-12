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
