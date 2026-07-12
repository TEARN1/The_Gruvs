/**
 * @jest-environment jsdom
 *
 * posterScan must NEVER break posting. A failed scan is an inconvenience; a
 * throw here would take the whole "Post a Gruv" flow down with it. These tests
 * pin the guarantee: every failure path resolves to null, quietly.
 */
// Platform.OS is read-only under the RN preset, so mock it to flip platforms.
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
import { Platform } from 'react-native';
import { scanPoster, canScanPoster } from '../src/services/posterScan';

describe('canScanPoster', () => {
  afterEach(() => { Platform.OS = 'web'; });

  it('is true on web where there is a DOM to run the reader in', () => {
    Platform.OS = 'web';
    expect(canScanPoster()).toBe(true);
  });

  it('is false on native — no DOM, so the caller must fall back to paste', () => {
    Platform.OS = 'ios';
    expect(canScanPoster()).toBe(false);
    Platform.OS = 'android';
    expect(canScanPoster()).toBe(false);
  });
});

describe('scanPoster', () => {
  // jsdom never fires onload for an <img>, which is exactly the stall we guard
  // against — fake timers let us jump the deadline instead of waiting it out.
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    Platform.OS = 'web';
    delete window.Tesseract;
  });

  // Drive the promise to settlement, pushing past any internal deadline.
  const settle = async (p) => {
    await jest.advanceTimersByTimeAsync(120000);
    return p;
  };

  it('resolves null on native instead of throwing', async () => {
    Platform.OS = 'ios';
    await expect(settle(scanPoster('file:///poster.jpg'))).resolves.toBeNull();
  });

  it('resolves null when the OCR engine fails, so posting still works', async () => {
    Platform.OS = 'web';
    window.Tesseract = { createWorker: () => Promise.reject(new Error('CDN down')) };
    await expect(settle(scanPoster('data:image/png;base64,xx'))).resolves.toBeNull();
  });

  it('resolves null on a junk image rather than surfacing a canvas error', async () => {
    Platform.OS = 'web';
    window.Tesseract = { createWorker: () => Promise.resolve({}) };
    await expect(settle(scanPoster('not-an-image'))).resolves.toBeNull();
  });

  // The image decoder and the CDN can both simply never call back (blocked CDN,
  // half-loaded image). Without a deadline the spinner hangs at 0% forever and
  // the upload button stays disabled — so a stall MUST resolve to null.
  it('never hangs when the image never loads — it times out to null', async () => {
    Platform.OS = 'web';
    window.Tesseract = { createWorker: () => Promise.resolve({}) };
    const p = scanPoster('https://example.com/never-loads.jpg'); // onload never fires
    await expect(settle(p)).resolves.toBeNull();
  });
});
