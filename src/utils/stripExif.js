/**
 * stripExif — remove EXIF (incl. GPS) from a JPEG's bytes, in pure JS.
 *
 * On web we already strip metadata by re-encoding through a canvas. On NATIVE
 * there's no canvas, and we don't want a native module (expo-image-manipulator)
 * that forces a rebuild — so we edit the JPEG bytes directly: a JPEG is a stream
 * of marker segments, and all camera metadata (EXIF with GPS, plus XMP) lives in
 * the APPn (0xFFE0–0xFFEF) and COM (0xFFFE) segments. Drop those, keep the image.
 *
 * This is the #352 native fix: a phone photo's embedded home coordinates never
 * reach the server, on every platform, without a native dependency.
 *
 * Correct-by-construction and unit-tested on real JPEG marker structure.
 */

const isJpeg = (b) => b && b.length > 3 && b[0] === 0xff && b[1] === 0xd8;

/**
 * Strip metadata segments from JPEG bytes.
 * @param {Uint8Array} bytes
 * @returns {Uint8Array} a new array with APPn/COM segments removed, or the input
 *   unchanged if it isn't a JPEG (PNG/WebP/GIF are returned as-is).
 */
export function stripJpegExifBytes(bytes) {
  if (!isJpeg(bytes)) return bytes;

  const out = [0xff, 0xd8]; // SOI
  let i = 2;
  const n = bytes.length;

  while (i + 1 < n) {
    // Every marker starts with 0xFF. Skip any fill bytes.
    if (bytes[i] !== 0xff) { out.push(bytes[i]); i += 1; continue; }
    const marker = bytes[i + 1];

    // SOS (0xDA) — start of compressed scan: copy the rest verbatim and stop.
    if (marker === 0xda) {
      for (let k = i; k < n; k++) out.push(bytes[k]);
      break;
    }
    // Standalone markers (no length): RSTn, SOI, EOI, TEM.
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 ||
        (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(0xff, marker); i += 2; continue;
    }
    // Length-prefixed segment: 2-byte big-endian length (includes the 2 length bytes).
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (len < 2 || i + 2 + len > n) {
      // Malformed length — bail safely by copying the remainder unchanged.
      for (let k = i; k < n; k++) out.push(bytes[k]);
      break;
    }
    const isMeta = (marker >= 0xe0 && marker <= 0xef) /* APPn */ || marker === 0xfe /* COM */;
    // Keep APP0/JFIF (0xE0) — it's harmless format info, and removing it can upset
    // some decoders. Strip APP1+ (EXIF/XMP, where GPS lives) and comments.
    if (isMeta && marker !== 0xe0) {
      i += 2 + len; // skip this whole segment
    } else {
      for (let k = i; k < i + 2 + len; k++) out.push(bytes[k]);
      i += 2 + len;
    }
  }
  return new Uint8Array(out);
}

/**
 * Strip EXIF from an image Blob. JPEG → cleaned; anything else → returned
 * unchanged. Never throws — a failure returns the original blob so an upload
 * can't be broken by this.
 * @param {Blob} blob
 * @returns {Promise<Blob>}
 */
export async function stripExifFromBlob(blob) {
  try {
    const type = blob?.type || '';
    if (!/jpe?g/i.test(type)) return blob; // only JPEG carries EXIF-GPS in practice
    const buf = new Uint8Array(await blob.arrayBuffer());
    const cleaned = stripJpegExifBytes(buf);
    if (cleaned === buf) return blob; // wasn't a JPEG after all
    return new Blob([cleaned], { type: 'image/jpeg' });
  } catch {
    return blob; // never break the upload
  }
}

export default { stripJpegExifBytes, stripExifFromBlob };
