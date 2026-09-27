import { buildVibePassport } from '../src/utils/vibePassport';

const td = (venue_name, city, category) => ({ venue_name, city, category });

describe('buildVibePassport', () => {
  it('is empty for no Touch Downs', () => {
    const p = buildVibePassport([]);
    expect(p.totalTouchDowns).toBe(0);
    expect(p.venues).toEqual([]);
    expect(p.cities).toEqual([]);
    expect(p.badges).toEqual([]);
  });

  it('counts and ranks venues/cities/scenes by frequency', () => {
    const p = buildVibePassport([
      td('Taboo', 'Jozi', 'amapiano'),
      td('Taboo', 'Jozi', 'amapiano'),
      td('Kong', 'Jozi', 'house'),
      td('Beach Bar', 'Cape Town', 'house'),
    ]);
    expect(p.totalTouchDowns).toBe(4);
    expect(p.venues[0]).toEqual({ name: 'Taboo', count: 2 });
    expect(p.cities[0]).toEqual({ name: 'Jozi', count: 3 });
    expect(p.scenes[0]).toEqual({ name: 'amapiano', count: 2 }); // tie on count → name asc
  });

  it('marks a venue a "regular" at 3+ visits', () => {
    const p = buildVibePassport([td('Taboo'), td('Taboo'), td('Taboo'), td('Kong')]);
    expect(p.regulars.map((v) => v.name)).toEqual(['Taboo']);
  });

  it('awards First Touch Down, and Globetrotter at 3+ cities', () => {
    const one = buildVibePassport([td('A', 'Jozi')]);
    expect(one.badges.some((b) => b.key === 'first_touchdown')).toBe(true);
    expect(one.badges.some((b) => b.key === 'globetrotter')).toBe(false);

    const many = buildVibePassport([td('A', 'Jozi'), td('B', 'Cape Town'), td('C', 'Durban')]);
    expect(many.badges.some((b) => b.key === 'globetrotter')).toBe(true);
  });

  it('ignores blank/missing fields and bad input safely', () => {
    const p = buildVibePassport([td('', '', ''), null, td('Taboo', null, undefined), undefined]);
    expect(p.totalTouchDowns).toBe(4); // counts entries, even sparse ones
    expect(p.venues).toEqual([{ name: 'Taboo', count: 1 }]);
    expect(p.cities).toEqual([]);
    expect(buildVibePassport(null).totalTouchDowns).toBe(0);
  });
});
