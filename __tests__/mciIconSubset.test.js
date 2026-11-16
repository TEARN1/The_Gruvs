// The MaterialCommunityIcons subset (src/icons/) must contain every icon name
// the app uses, or that icon renders as "?". Fix a failure by re-running
//   pip install fonttools && python3 scripts/subset-mci-icons.py
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const full = require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json');
const subset = require('../src/icons/mciGlyphs.json');

function jsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? jsFiles(path.join(dir, e.name)) : e.name.endsWith('.js') ? [path.join(dir, e.name)] : []);
}

test('every MaterialCommunityIcons name used in the app is in the subset', () => {
  const missing = new Set();
  for (const f of [path.join(ROOT, 'App.js'), ...jsFiles(path.join(ROOT, 'src'))]) {
    const src = fs.readFileSync(f, 'utf8');
    for (const [, name] of src.matchAll(/['"`]([a-z0-9][a-z0-9-]*)['"`]/g)) {
      if (full[name] !== undefined && subset[name] === undefined) missing.add(name);
    }
  }
  expect([...missing]).toEqual([]);
});

test('nothing imports the full MaterialCommunityIcons set', () => {
  const offenders = jsFiles(path.join(ROOT, 'src')).concat(path.join(ROOT, 'App.js'))
    .filter((f) => fs.readFileSync(f, 'utf8').includes('@expo/vector-icons/MaterialCommunityIcons'));
  expect(offenders).toEqual([]);
});
