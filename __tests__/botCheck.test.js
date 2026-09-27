import { isLikelyBot } from '../src/utils/botCheck';

describe('isLikelyBot', () => {
  // A hidden field a human never sees — filling it is a dead giveaway.
  it('flags a filled honeypot', () => {
    expect(isLikelyBot({ honeypot: 'http://spam', elapsedMs: 9000 }).bot).toBe(true);
    expect(isLikelyBot({ honeypot: 'x', elapsedMs: 9000 }).reason).toBe('honeypot');
  });

  it('flags an impossibly fast submit', () => {
    expect(isLikelyBot({ honeypot: '', elapsedMs: 200 }).bot).toBe(true);
    expect(isLikelyBot({ honeypot: '', elapsedMs: 200 }).reason).toBe('too_fast');
  });

  // Never block a real human — even a fast one with a password manager.
  it('passes a normal human signup', () => {
    expect(isLikelyBot({ honeypot: '', elapsedMs: 4000 }).bot).toBe(false);
    expect(isLikelyBot({ honeypot: '', elapsedMs: 1200 }).bot).toBe(false); // fast but human
  });

  it('is safe with no inputs', () => {
    expect(isLikelyBot().bot).toBe(false);
    expect(isLikelyBot({}).bot).toBe(false);
  });
});
