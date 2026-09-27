import { sanitizeSearch, isUuid, safeOpenURL, safeOpenExternal } from '../src/utils/sanitize';
import { Linking, Alert } from 'react-native';

jest.spyOn(Linking, 'canOpenURL').mockImplementation(async () => true);
jest.spyOn(Linking, 'openURL').mockImplementation(async () => {});

describe('sanitizeSearch', () => {
  it('preserves normal text and accents', () => {
    expect(sanitizeSearch('café São Paulo')).toBe('café São Paulo');
    expect(sanitizeSearch('Monday park run')).toBe('Monday park run');
  });

  it('strips PostgREST .or() filter-injection metacharacters', () => {
    // commas, parens, *, backslash, %, _ , : all have meaning in the filter grammar
    expect(sanitizeSearch('x,is_admin.eq.true')).not.toContain(',');
    expect(sanitizeSearch('x),or(id.eq.0')).not.toMatch(/[(),]/);
    expect(sanitizeSearch('a%b_c*d\\e:f')).toBe('a b c d e f');
  });

  it('collapses whitespace and trims', () => {
    expect(sanitizeSearch('  hello   world  ')).toBe('hello world');
  });

  it('caps length to 80 chars', () => {
    expect(sanitizeSearch('a'.repeat(200)).length).toBe(80);
  });

  it('handles null/undefined/non-strings safely', () => {
    expect(sanitizeSearch(null)).toBe('');
    expect(sanitizeSearch(undefined)).toBe('');
    expect(sanitizeSearch(12345)).toBe('12345');
  });
});

describe('isUuid', () => {
  it('accepts valid UUIDs', () => {
    expect(isUuid('a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c')).toBe(true);
  });
  it('rejects non-UUIDs', () => {
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid('123')).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(isUuid('a1b2ea24a0b9450c9a593ba7bbc5224c')).toBe(false); // no dashes
  });
});

describe('safeOpenURL', () => {
  it('allows safe whitelisted host URLs', async () => {
    const res = await safeOpenURL('https://thegruvs.com/privacy');
    expect(res).toBe(true);
    expect(Linking.openURL).toHaveBeenCalledWith('https://thegruvs.com/privacy');
  });

  it('allows subdomains of whitelisted hosts', async () => {
    const res = await safeOpenURL('https://open.spotify.com/track/123');
    expect(res).toBe(true);
  });

  it('rejects non-whitelisted hosts', async () => {
    const res = await safeOpenURL('https://malicious-site.com/steal');
    expect(res).toBe(false);
  });

  it('rejects disallowed schemes', async () => {
    const res = await safeOpenURL('ftp://thegruvs.com/files');
    expect(res).toBe(false);
  });

  it('allows native maps links', async () => {
    const res = await safeOpenURL('maps://coordinates');
    expect(res).toBe(true);
  });

  it('handles invalid inputs gracefully', async () => {
    const res = await safeOpenURL(null);
    expect(res).toBe(false);
  });
});

describe('safeOpenExternal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows safe http/https external links after user confirmation', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
      // Simulate clicking "Proceed"
      const proceed = buttons.find(b => b.text === 'Proceed');
      if (proceed) proceed.onPress();
    });

    const res = await safeOpenExternal('https://another-site.com/hello');
    expect(res).toBe(true);
    expect(alertSpy).toHaveBeenCalled();
    expect(Linking.openURL).toHaveBeenCalledWith('https://another-site.com/hello');
  });

  it('blocks navigation when user cancels the confirmation', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
      // Simulate clicking "Cancel"
      const cancel = buttons.find(b => b.text === 'Cancel');
      if (cancel) cancel.onPress();
    });

    const res = await safeOpenExternal('https://another-site.com/hello');
    expect(res).toBe(false);
    expect(alertSpy).toHaveBeenCalled();
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it('allows mailto: and tel: links without confirmation dialog', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');

    const resMail = await safeOpenExternal('mailto:test@example.com');
    expect(resMail).toBe(true);
    expect(alertSpy).not.toHaveBeenCalled();
    expect(Linking.openURL).toHaveBeenCalledWith('mailto:test@example.com');

    const resTel = await safeOpenExternal('tel:+27123456789');
    expect(resTel).toBe(true);
    expect(alertSpy).not.toHaveBeenCalled();
    expect(Linking.openURL).toHaveBeenCalledWith('tel:+27123456789');
  });

  it('blocks unsafe schemes like javascript:, data:, and file:', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');

    const resJS = await safeOpenExternal('javascript:alert(1)');
    expect(resJS).toBe(false);
    expect(alertSpy).not.toHaveBeenCalled();
    expect(Linking.openURL).not.toHaveBeenCalled();

    const resData = await safeOpenExternal('data:text/html,<h1>Hack</h1>');
    expect(resData).toBe(false);
    expect(alertSpy).not.toHaveBeenCalled();
    expect(Linking.openURL).not.toHaveBeenCalled();
  });
});

