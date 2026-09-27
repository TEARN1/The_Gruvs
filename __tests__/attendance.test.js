import { showUpRate, expectedTurnout, capacityState, turnoutLabel, DEFAULT_SHOW_RATE } from '../src/utils/attendance';

describe('showUpRate', () => {
  it('computes a real rate once there is history', () => {
    const r = showUpRate({ rsvps: 10, touchdowns: 8 });
    expect(r.rate).toBe(0.8);
    expect(r.confident).toBe(true);
  });

  // With one or two data points a "rate" is noise dressed up as a fact.
  it('does not pretend to know from one data point', () => {
    const r = showUpRate({ rsvps: 1, touchdowns: 0 });
    expect(r.rate).toBe(DEFAULT_SHOW_RATE);
    expect(r.confident).toBe(false);
  });

  it('never exceeds 1 even on dirty data', () => {
    expect(showUpRate({ rsvps: 5, touchdowns: 50 }).rate).toBe(1);
  });

  it('never throws on junk', () => {
    expect(showUpRate(null).confident).toBe(false);
    expect(showUpRate({}).rate).toBe(DEFAULT_SHOW_RATE);
  });
});

describe('expectedTurnout', () => {
  it('uses each attendee\'s own reliability where we know it', () => {
    const t = expectedTurnout([
      { status: 'going', rate: 1.0 },   // always shows
      { status: 'going', rate: 0.0 },   // never shows
      { status: 'going', rate: 0.5 },
    ]);
    expect(t.going).toBe(3);
    expect(t.expected).toBe(2);         // 1 + 0 + 0.5 = 1.5 → 2
  });

  // "Maybe" means maybe. Counting it like "going" is how hosts over-order stock.
  it('weights a maybe far below a going', () => {
    const allGoing = expectedTurnout(Array(10).fill({ status: 'going', rate: 1 }));
    const allMaybe = expectedTurnout(Array(10).fill({ status: 'maybe', rate: 1 }));
    expect(allMaybe.expected).toBeLessThan(allGoing.expected / 2);
  });

  it('reports low confidence on a tiny sample', () => {
    expect(expectedTurnout([{ status: 'going' }]).confidence).toBe('low');
  });

  it('handles an empty list', () => {
    expect(expectedTurnout([])).toEqual({ expected: 0, going: 0, maybe: 0, confidence: 'low' });
  });
});

describe('capacityState', () => {
  // Judging "full" off raw RSVPs would scream SOLD OUT at a half-empty room.
  it('judges fullness on EXPECTED turnout, not raw RSVPs', () => {
    const event = { capacity: 100 };
    expect(capacityState(event, 95).state).toBe('likely_full');
    expect(capacityState(event, 75).state).toBe('filling');
    expect(capacityState(event, 20).state).toBe('open');
  });

  // Once people are physically walking in, stop guessing — that IS the number.
  it('trusts real arrivals over any estimate', () => {
    const event = { capacity: 100, checkin_count: 100 };
    const s = capacityState(event, 10); // estimate says nearly empty
    expect(s.state).toBe('full');       // but 100 people are actually inside
  });

  it('says nothing when the host set no capacity', () => {
    expect(capacityState({}, 500)).toEqual({ state: 'open', pct: 0, label: '' });
  });
});

describe('turnoutLabel', () => {
  it('tells the truth a spreadsheet cannot', () => {
    const label = turnoutLabel({}, { going: 42, expected: 26, confidence: 'high' });
    expect(label).toBe('42 going · ~26 usually show');
  });

  // Never invent precision we don't have.
  it('states no estimate when it has no basis for one', () => {
    expect(turnoutLabel({}, { going: 3, expected: 2, confidence: 'low' })).toBe('3 going');
  });

  it('is empty when nobody is going', () => {
    expect(turnoutLabel({}, { going: 0 })).toBe('');
  });
});
