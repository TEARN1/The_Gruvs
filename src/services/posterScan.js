/**
 * posterScan — read text off an uploaded event poster, on-device, keyless.
 *
 * Uses Tesseract.js loaded at RUNTIME from a free public CDN (jsDelivr) — so it
 * never enters the Metro bundle (Metro resolves import() at build time) and adds
 * no build risk. No API key, no server, no recurring cost: the OCR runs entirely
 * in the user's browser. The trained model (~a few MB) is fetched lazily from
 * the CDN the first time someone scans.
 *
 * ADVANCED read pipeline (this is what makes the auto-fill actually land):
 *   1. Preprocess the image on a canvas — upscale small flyers, convert to
 *      grayscale, and stretch contrast. OCR is FAR more accurate on clean, high-
 *      contrast, adequately-sized text than on a small colourful poster.
 *   2. Recognise with automatic page segmentation (PSM 3).
 *   3. If that comes back thin (heavily-designed poster), run a second SPARSE
 *      pass (PSM 11 — "find text anywhere") and merge — catches scattered blocks.
 *
 * Fully guarded: on native, or if the CDN/OCR/canvas fails for ANY reason,
 * returns null and the caller falls back to manual entry — a scan can never
 * block or break posting.
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

function loadImageEl(uri) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('img-load-failed'));
    img.src = uri;
  });
}

/**
 * Enhance a poster for OCR: upscale small images toward ~2000px, grayscale, and
 * linearly stretch contrast (min→0, max→255) with a slight gamma lift so faint
 * text pops. Returns a PNG data-URL, or the original URI if anything fails.
 */
async function preprocess(uri) {
  try {
    const img = await loadImageEl(uri);
    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    if (!srcW || !srcH) return uri;
    // Upscale small flyers (OCR likes big text); cap huge ones for speed.
    const target = 2000;
    const scale = srcW < 1100 ? Math.min(2.5, target / srcW) : Math.min(1, target / srcW);
    const w = Math.max(1, Math.round(srcW * scale));
    const h = Math.max(1, Math.round(srcH * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);

    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;
    const n = w * h;
    const lum = new Uint8ClampedArray(n);
    // histogram for a robust (2nd–98th percentile) contrast stretch
    const hist = new Uint32Array(256);
    for (let i = 0, p = 0; p < n; i += 4, p++) {
      const l = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
      lum[p] = l; hist[l]++;
    }
    let lo = 0, hi = 255, cum = 0;
    const loCut = n * 0.02, hiCut = n * 0.98;
    for (let v = 0; v < 256; v++) { cum += hist[v]; if (cum >= loCut) { lo = v; break; } }
    cum = 0;
    for (let v = 0; v < 256; v++) { cum += hist[v]; if (cum >= hiCut) { hi = v; break; } }
    const range = Math.max(8, hi - lo);
    for (let i = 0, p = 0; p < n; i += 4, p++) {
      let v = ((lum[p] - lo) / range) * 255;
      v = v < 0 ? 0 : v > 255 ? 255 : v;
      // slight gamma to deepen mid-darks (sharpens text edges)
      v = 255 * Math.pow(v / 255, 0.9);
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL('image/png');
  } catch {
    return uri; // fall back to the raw image
  }
}

const meaningfulLen = (s) => (s || '').replace(/\s+/g, '').length;

function mergeText(a, b) {
  const seen = new Set();
  const out = [];
  for (const block of [a || '', b || '']) {
    for (const line of block.split(/\r?\n/)) {
      const key = line.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!line.trim()) continue;
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      out.push(line.trim());
    }
  }
  return out.join('\n');
}

/**
 * OCR an image into raw text (advanced pipeline).
 * @param {string} imageUri  data: URI, blob: URL, or https URL of the poster
 * @param {(pct:number)=>void} [onProgress]  0..1 recognition progress
 * @returns {Promise<string|null>} recognised text, or null if unavailable/failed
 */
export async function scanPoster(imageUri, onProgress) {
  if (!canScanPoster() || !imageUri) return null;
  let worker = null;
  try {
    const Tesseract = await loadTesseract();
    const processed = await preprocess(imageUri);

    worker = await Tesseract.createWorker('eng', 1, {
      logger: (m) => {
        if (m && m.status === 'recognizing text' && typeof m.progress === 'number') {
          try { onProgress?.(m.progress); } catch {}
        }
      },
    });

    // Pass 1 — automatic page segmentation (whole poster as blocks).
    await worker.setParameters({ tessedit_pageseg_mode: '3', preserve_interword_spaces: '1' });
    let text = (await worker.recognize(processed))?.data?.text || '';

    // Pass 2 — only if pass 1 was thin: sparse mode finds scattered text.
    if (meaningfulLen(text) < 60) {
      await worker.setParameters({ tessedit_pageseg_mode: '11' });
      const sparse = (await worker.recognize(processed))?.data?.text || '';
      text = mergeText(text, sparse);
    }

    text = text.trim();
    return meaningfulLen(text) >= 3 ? text : null;
  } catch {
    return null; // graceful — caller falls back to manual entry
  } finally {
    try { await worker?.terminate(); } catch {}
  }
}

export default { scanPoster, canScanPoster };
