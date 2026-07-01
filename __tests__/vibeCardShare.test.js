import { buildVibeCardShareText } from '../src/utils/vibeCardShare';

describe('buildVibeCardShareText — the flex that markets the app', () => {
  it('leads with the handle + earned level, not followers', () => {
    const msg = buildVibeCardShareText({ username: 'lindi', vibe_score: 750, followers_count: 40, is_verified: true });
    expect(msg).toMatch(/^🎫 @lindi on The Gruvs/);
    expect(msg).toMatch(/· 750 vibe pts/);
    expect(msg).toMatch(/40 in their crew/);
    expect(msg).toMatch(/✓ Verified/);
    expect(msg).toContain('thegruvs.com/u/lindi');
  });

  it('omits crew + verified when absent', () => {
    const msg = buildVibeCardShareText({ username: 'x', vibe_score: 10 });
    expect(msg).not.toMatch(/in their crew/);
    expect(msg).not.toMatch(/Verified/);
  });

  it('reflects the earned tier from vibe_score', () => {
    expect(buildVibeCardShareText({ username: 'a', vibe_score: 0 })).toMatch(/Viber ·/);
    expect(buildVibeCardShareText({ username: 'a', vibe_score: 999999 })).not.toMatch(/^.*Viber · 999999/);
  });

  it('is robust to an empty profile', () => {
    const msg = buildVibeCardShareText();
    expect(msg).toContain('The Gruvs');
    expect(msg).toContain('thegruvs.com');
  });
});
