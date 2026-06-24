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

  it('points the link at the og-meta function for rich previews when configured', () => {
    const fns = 'https://x.supabase.co/functions/v1';
    expect(eventShareUrl('abc', { functionsUrl: fns })).toBe(`${fns}/og-meta/event/abc`);
    expect(buildShareText({ title: 'X', id: 'abc' }, { functionsUrl: fns }))
      .toContain('/og-meta/event/abc');
  });

  it('falls back to the app deep link when no functions URL is set', () => {
    expect(eventShareUrl('abc', { functionsUrl: '' })).toBe('https://thegruvs.app?event=abc');
    expect(eventShareUrl(null, { functionsUrl: '' })).toBe('https://thegruvs.app');
  });

  it('is robust to an empty/garbage event', () => {
    expect(buildShareText()).toContain('The Gruvs');
    expect(buildShareText({ event_date: 'not-a-date' })).not.toContain('Invalid Date');
  });
});
