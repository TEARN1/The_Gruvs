import { stripJpegExifBytes } from '../src/utils/stripExif';

// Build a tiny but structurally-real JPEG:
//   SOI · APP1(EXIF "Exif\0\0") · APP0(JFIF) · SOS + scan · EOI
const EXIF = [0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
const APP0 = [0xff, 0xe0, 0x00, 0x06, 0x4a, 0x46, 0x49, 0x46];             // "JFIF"
const SCAN = [0xff, 0xda, 0x00, 0x03, 0x01, 0xaa, 0xbb, 0xff, 0xd9];       // SOS + data + EOI
const jpeg = (segs) => new Uint8Array([0xff, 0xd8, ...segs.flat(), ...SCAN]);

describe('stripJpegExifBytes', () => {
  it('removes the EXIF (APP1) segment — where GPS lives', () => {
    const out = stripJpegExifBytes(jpeg([EXIF, APP0]));
    // "Exif" bytes must be gone.
    expect([...out].join(',')).not.toContain('69,102'); // 'E','x' as decimals is 69,120…
    expect(Array.from(out).includes(0x45) && Array.from(out).includes(0x78) &&
           Array.from(out).includes(0x69) && Array.from(out).includes(0x66)).toBe(false);
  });

  it('keeps the image intact (SOI, APP0/JFIF, scan data, EOI)', () => {
    const out = Array.from(stripJpegExifBytes(jpeg([EXIF, APP0])));
    expect(out.slice(0, 2)).toEqual([0xff, 0xd8]);          // SOI
    expect(out.slice(2, 10)).toEqual(APP0);                 // JFIF preserved
    expect(out.slice(-9)).toEqual(SCAN);                    // scan + EOI intact
    // Exactly the EXIF segment (10 bytes) was removed.
    expect(out.length).toBe(jpeg([EXIF, APP0]).length - EXIF.length);
  });

  it('strips multiple/large APP1 (real cameras write big EXIF blocks)', () => {
    const bigExif = [0xff, 0xe1, 0x01, 0x00, ...Array(0x0100 - 2).fill(0x00)]; // 256-byte APP1
    const out = stripJpegExifBytes(jpeg([bigExif]));
    expect(out.length).toBe(jpeg([bigExif]).length - (bigExif.length));
  });

  it('leaves a non-JPEG (PNG/WebP) untouched', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    expect(stripJpegExifBytes(png)).toBe(png);
  });

  it('never corrupts on a truncated/garbage stream', () => {
    const truncated = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0xff]); // claims 255 bytes, has none
    const out = stripJpegExifBytes(truncated);
    expect(out[0]).toBe(0xff); expect(out[1]).toBe(0xd8); // still a JPEG header, didn't throw
  });
});
