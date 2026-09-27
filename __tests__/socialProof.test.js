import { friendsLabel } from '../src/services/socialProof';

describe('friendsLabel', () => {
  // A named person is far stronger than an abstract count. "3 friends going"
  // is a statistic; "Thabo is going" is a reason to leave the house.
  it('names the person', () => {
    expect(friendsLabel([{ username: 'thabo' }])).toBe('thabo is going');
  });

  it('names both when there are two', () => {
    expect(friendsLabel([{ username: 'thabo' }, { username: 'lerato' }]))
      .toBe('thabo and lerato are going');
  });

  it('names one and counts the rest', () => {
    expect(friendsLabel([{ username: 'thabo' }, { username: 'a' }, { username: 'b' }, { username: 'c' }]))
      .toBe('thabo and 3 others you follow are going');
  });

  it('says nothing when nobody you follow is going', () => {
    expect(friendsLabel([])).toBe('');
    expect(friendsLabel(null)).toBe('');
  });
});
