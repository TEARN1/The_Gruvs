import { buildSafetyShareUrl } from '../src/services/nightSafetyService';

// The safety panel must only promise what actually happens. Nothing is sent
// automatically, so every action hands the user a WhatsApp share to a person
// they choose. These pin the message content that person receives.
const textOf = (url) => decodeURIComponent(url.split('?text=')[1]);

describe('buildSafetyShareUrl', () => {
  it('builds a recipient-less wa.me link (the user picks who)', () => {
    const url = buildSafetyShareUrl('trip', { destination: 'Home', minutes: 30 });
    expect(url.startsWith('https://wa.me/?text=')).toBe(true);
  });

  it('trip message carries destination, ETA and what to do if silent', () => {
    const t = textOf(buildSafetyShareUrl('trip', { eventTitle: 'Kota Fest', destination: 'Fourways', minutes: 25 }));
    expect(t).toContain('Kota Fest');
    expect(t).toContain('Fourways');
    expect(t).toContain('25 min');
    expect(t).toMatch(/call me/);
  });

  it('walk message carries the parking spot', () => {
    expect(textOf(buildSafetyShareUrl('walk', { parkingArea: 'Gate B' }))).toContain('Gate B');
  });

  it('home message confirms arrival', () => {
    expect(textOf(buildSafetyShareUrl('home'))).toMatch(/Home safe/);
  });

  it('survives missing details without "undefined"', () => {
    expect(textOf(buildSafetyShareUrl('trip'))).not.toContain('undefined');
  });
});
