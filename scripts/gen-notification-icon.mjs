/**
 * gen-notification-icon.mjs — build the Android notification icon.
 *
 * Android renders notification icons as a SILHOUETTE: every non-transparent
 * pixel is repainted a flat colour and only the ALPHA channel survives. Feeding
 * it the full-colour app icon is why you get a white blob in the status bar.
 *
 * So this draws the crowned "H" as flat geometry — bold enough to survive being
 * scaled to 24dp — and writes white pixels whose alpha carries the shape.
 * Deliberately dependency-free (no sharp/jimp): the PNG is encoded by hand with
 * the zlib that ships with Node, so this keeps working after any npm churn.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const SIZE = 96;   // Android's recommended notification-icon source size
const SS = 4;      // supersample factor — our only anti-aliasing
const N = SIZE * SS;

// ── Geometry, expressed in a 96×96 space ────────────────────────────────────
// Strokes are deliberately fat. Anything under ~10 units disappears entirely
// once the status bar scales this down to 24dp.
const BAR_W = 13;
const H_TOP = 36, H_BOT = 86;
const L_X = 21, R_X = 96 - 21 - BAR_W;

const rects = [
  [L_X, H_TOP, BAR_W, H_BOT - H_TOP],           // left leg of the H
  [R_X, H_TOP, BAR_W, H_BOT - H_TOP],           // right leg
];

// The crossbar slopes up to the right, echoing the lightning seam in the logo.
const polys = [
  [[L_X, 64], [R_X + BAR_W, 50], [R_X + BAR_W, 62], [L_X, 76]],
  // Crown: a three-point zigzag sitting on a solid band.
  [[26, 27], [26, 8], [37, 19], [48, 4], [59, 19], [70, 8], [70, 27]],
];
rects.push([26, 25, 44, 7]);                     // crown band

const inRect = (x, y, [rx, ry, rw, rh]) => x >= rx && x < rx + rw && y >= ry && y < ry + rh;

// Standard even-odd ray cast — enough for these simple convex-ish shapes.
function inPoly(x, y, pts) {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

// Android clips and pads notification icons, so the glyph must not run to the
// edge. Everything above is drawn full-bleed for readable geometry, then shrunk
// about the centre to leave a safe margin.
const FIT = 0.84;
const shapeHit = (x, y) => rects.some((r) => inRect(x, y, r)) || polys.some((p) => inPoly(x, y, p));
const covered = (x, y) => shapeHit(
  (x - SIZE / 2) / FIT + SIZE / 2,
  (y - SIZE / 2) / FIT + SIZE / 2,
);

// ── Rasterise at SS× then box-filter down ───────────────────────────────────
const hi = new Uint8Array(N * N);
for (let y = 0; y < N; y++) {
  for (let x = 0; x < N; x++) {
    // Sample at the pixel centre in 96-space.
    if (covered((x + 0.5) / SS, (y + 0.5) / SS)) hi[y * N + x] = 1;
  }
}

// RGBA, one filter byte (0 = None) per scanline.
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
let p = 0;
for (let y = 0; y < SIZE; y++) {
  raw[p++] = 0;
  for (let x = 0; x < SIZE; x++) {
    let sum = 0;
    for (let dy = 0; dy < SS; dy++) {
      for (let dx = 0; dx < SS; dx++) sum += hi[(y * SS + dy) * N + (x * SS + dx)];
    }
    const alpha = Math.round((sum / (SS * SS)) * 255);
    raw[p++] = 255; raw[p++] = 255; raw[p++] = 255;  // white; only alpha matters
    raw[p++] = alpha;
  }
}

// ── Minimal PNG encoder ─────────────────────────────────────────────────────
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;   // bit depth
ihdr[9] = 6;   // colour type 6 = RGBA
// 10,11,12 = deflate / adaptive filtering / no interlace — all zero already.

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = new URL('../assets/notification-icon.png', import.meta.url);
writeFileSync(out, png);
console.log(`wrote assets/notification-icon.png — ${SIZE}x${SIZE}, ${png.length} bytes`);
