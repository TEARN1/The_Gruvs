/**
 * @jest-environment jsdom
 */
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));

import { checkForNewVersion } from '../src/hooks/useWebAppUpdate';

const setDocumentScript = (src) => {
  document.body.innerHTML = `<script src="${src}"></script>`;
};

describe('checkForNewVersion', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  it('returns false when there is no current bundle hash to compare (dev server)', async () => {
    document.body.innerHTML = '';
    expect(await checkForNewVersion()).toBe(false);
  });

  it('returns true on a confirmed hash mismatch', async () => {
    setDocumentScript('/AppEntry-aaa111.js');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('<script src="/AppEntry-bbb222.js"></script>'),
    });
    expect(await checkForNewVersion()).toBe(true);
  });

  it('returns false when the hash matches', async () => {
    setDocumentScript('/AppEntry-aaa111.js');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('<script src="/AppEntry-aaa111.js"></script>'),
    });
    expect(await checkForNewVersion()).toBe(false);
  });

  it('returns false (not true) on a network error — absence of evidence is not evidence of staleness', async () => {
    setDocumentScript('/AppEntry-aaa111.js');
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    expect(await checkForNewVersion()).toBe(false);
  });

  it('returns false on a non-ok response', async () => {
    setDocumentScript('/AppEntry-aaa111.js');
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    expect(await checkForNewVersion()).toBe(false);
  });
});
