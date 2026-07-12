/**
 * posterScan — read text off an uploaded event poster, on-device, keyless.
 *
 * Uses Tesseract.js loaded at RUNTIME from a free public CDN (jsDelivr) — so it
 * never enters the Metro bundle (Metro resolves import() at build time) and adds
 * no build risk. No API key, no server, no recurring cost: the OCR runs entirely
 * in the user's browser. The trained model (~a few MB) is fetched lazily from
 * the CDN the first time someone scans.
 *
 * Fully guarded: on native, or if the CDN/OCR fails for ANY reason, returns
 * null and the caller falls back to manual entry — a scan can never block or
 * break posting.
 *
 * Pair with utils/posterParser to turn the returned text into event fields.
 */
import { Platform } from 'react-native';

const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
let _loadPromise = null;

function loadTesseract() {
  if (typeof window !== 'undefined' && window.Tesseract) return Promise.resolve(window.Tesseract);
  if (_loadPromise) return _loadPromise;
  _loadPromise = new Promise((resolve, reject) => {
    try {
      const s = document.createElement('script');
      s.src = TESSERACT_CDN;
      s.async = true;
      s.onload = () => (window.Tesseract ? resolve(window.Tesseract) : reject(new Error('tesseract-missing')));
      s.onerror = () => reject(new Error('tesseract-load-failed'));
      document.head.appendChild(s);
    } catch (e) { reject(e); }
  });
  return _loadPromise;
}

/** True where OCR can run (web with DOM). Lets the UI hide the button elsewhere. */
export const canScanPoster = () =>
  Platform.OS === 'web' && typeof document !== 'undefined' && typeof window !== 'undefined';

/**
 * OCR an image into raw text.
 * @param {string} imageUri  data: URI, blob: URL, or https URL of the poster
 * @param {(pct:number)=>void} [onProgress]  0..1 recognition progress
 * @returns {Promise<string|null>} recognised text, or null if OCR is unavailable/failed
 */
export async function scanPoster(imageUri, onProgress) {
  if (!canScanPoster() || !imageUri) return null;
  try {
    const Tesseract = await loadTesseract();
    const { data } = await Tesseract.recognize(imageUri, 'eng', {
      logger: (m) => {
        if (m && m.status === 'recognizing text' && typeof m.progress === 'number') {
          try { onProgress?.(m.progress); } catch {}
        }
      },
    });
    const text = (data && data.text) ? String(data.text).trim() : '';
    return text.length >= 3 ? text : null;
  } catch {
    return null; // graceful — caller falls back to manual entry
  }
}

export default { scanPoster, canScanPoster };
