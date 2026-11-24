// The map engine loads from jsdelivr (src/components/LiveMap.js) with a
// subresource-integrity hash, so a changed file on the CDN never runs. The
// hash and version must match the installed package.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

test('the CDN map engine is pinned to the installed version and its exact contents', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'LiveMap.js'), 'utf8');
  const version = /const MAPLIBRE_VERSION = '([^']+)'/.exec(src)[1];
  const integrity = /const MAPLIBRE_INTEGRITY = '([^']+)'/.exec(src)[1];
  expect(version).toBe(require('maplibre-gl/package.json').version);
  const file = fs.readFileSync(require.resolve('maplibre-gl/dist/maplibre-gl.js'));
  expect(integrity).toBe(`sha384-${crypto.createHash('sha384').update(file).digest('base64')}`);
  expect(src).toMatch(/script\.integrity = MAPLIBRE_INTEGRITY/);
});
