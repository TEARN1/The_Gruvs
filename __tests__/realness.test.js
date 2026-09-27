import { realnessScore } from '../src/utils/realness';

describe('realnessScore — Truth Protocol quantified', () => {
  it('no signal when nothing has happened', () => {
    expect(realnessScore({})).toEqual({ tier: 'none', label: 'No signal yet' });
    expect(realnessScore()).toEqual({ tier: 'none', label: 'No signal yet' });
  });

  it('hyped-but-empty: lots of buzz, nobody actually there', () => {
    expect(realnessScore({ vibes: 200, going: 50, here: 0 }).tier).toBe('hyped');
  });

  it('the real deal: a genuine crowd on the ground', () => {
    expect(realnessScore({ vibes: 200, going: 0, here: 60 }).tier).toBe('real');
    expect(realnessScore({ vibes: 0, here: 60 }).tier).toBe('real'); // presence with no hype is still real
  });

  it('real when presence backs up the hype (>= half)', () => {
    expect(realnessScore({ vibes: 10, going: 0, here: 6 }).tier).toBe('real');
  });

  it('building: some presence but not yet a crowd', () => {
    expect(realnessScore({ vibes: 200, here: 5 }).tier).toBe('building');
    expect(realnessScore({ here: 3 }).tier).toBe('building');
  });

  it('is null-safe with junk input', () => {
    expect(realnessScore({ vibes: 'x', going: null, here: undefined }).tier).toBe('none');
  });
});
