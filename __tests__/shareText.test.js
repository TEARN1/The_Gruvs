import { buildShareText, eventShareUrl } from '../src/utils/shareText';

describe('buildShareText — Truth Protocol in every share', () => {
  it('always leads with the title', () => {
    expect(buildShareText({ title: 'Amapiano Sundays' })).toMatch(/^🎉 "Amapiano Sundays"/);
  });

  it('leads social proof with verified presence, then intent', () => {
    const msg = buildShareText({ title: 'X', here_count: 5, going: 20 });
    expect(msg).toContain('🔥 5 already there');
    expect(msg).toContain('✅ 20 locked in');
    expect(msg.indexOf('already there')).toBeLessThan(msg.indexOf('locked in'));
  });

  it('omits proof entirely when there are no real signals', () => {
    const msg = buildShareText({ title: 'X', here_count: 0, going: 0 });
    expect(msg).not.toContain('already there');
    expect(msg).not.toContain('locked in');
  });

  it('marks FREE when there is no price', () => {
    expect(buildShareText({ title: 'X' })).toContain('🆓 FREE entry');
    expect(buildShareText({ title: 'X', price: 'R150' })).not.toContain('FREE entry');
  });

  it('defaults to the working app link (never a dead og-meta link)', () => {
    expect(eventShareUrl('abc')).toBe('https://thegruvs.com/?event=abc');
    expect(eventShareUrl(null)).toBe('https://thegruvs.com');
  });

  it('uses og-meta only when explicitly opted in (after it is deployed)', () => {
    const og = 'https://x.supabase.co/functions/v1';
    expect(eventShareUrl('abc', { ogMetaBase: og })).toBe(`${og}/og-meta/event/abc`);
  });

  it('is robust to an empty/garbage event', () => {
    expect(buildShareText()).toContain('The Gruvs');
    expect(buildShareText({ event_date: 'not-a-date' })).not.toContain('Invalid Date');
  });
});
