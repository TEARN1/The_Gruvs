import { buildSosMessage, normalizePhone, whatsappLink, smsLink } from '../src/utils/sosMessage';

describe('sosMessage — actionable emergency contacts', () => {
  it('builds a help message with a maps link when location is known', () => {
    const m = buildSosMessage({ fromName: 'Lindi', lat: -26.2, lon: 28.04 });
    expect(m).toMatch(/🆘 Lindi needs help/);
    expect(m).toMatch(/maps\.google\.com\/\?q=-26\.2,28\.04/);
  });

  it('still builds a useful message without location', () => {
    const m = buildSosMessage({ fromName: 'Lindi' });
    expect(m).toMatch(/needs help/);
    expect(m).not.toMatch(/maps\.google/);
  });

  it('normalizes phones, keeping a leading +', () => {
    expect(normalizePhone(' +27 82 123 4567 ')).toBe('+27821234567');
    expect(normalizePhone('082-123-4567')).toBe('0821234567');
  });

  it('builds a wa.me link without the + and url-encodes the text', () => {
    const link = whatsappLink('+27821234567', '🆘 help\nnow');
    expect(link).toBe('https://wa.me/27821234567?text=' + encodeURIComponent('🆘 help\nnow'));
  });

  it('builds an sms: link', () => {
    expect(smsLink('+27821234567', 'help')).toBe('sms:+27821234567?body=help');
  });

  it('returns null for an empty/garbage phone', () => {
    expect(whatsappLink('', 'x')).toBeNull();
    expect(smsLink('abc', 'x')).toBeNull();
  });
});
