import { buildShareText } from '../src/utils/shareText';

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

  it('embeds the event deep link, and falls back to the bare URL without an id', () => {
    expect(buildShareText({ title: 'X', id: 'abc' })).toContain('thegruvs.app?event=abc');
    expect(buildShareText({ title: 'X' })).toMatch(/thegruvs\.app$/);
    expect(buildShareText({ title: 'X' })).not.toContain('?event=');
  });

  it('is robust to an empty/garbage event', () => {
    expect(buildShareText()).toContain('The Gruvs');
    expect(buildShareText({ event_date: 'not-a-date' })).not.toContain('Invalid Date');
  });
});
