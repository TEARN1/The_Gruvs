#!/usr/bin/env python3
"""Cut MaterialCommunityIcons down to the icons the app actually uses.

The full set ships a 158 KB name->codepoint map inside the main JS bundle and
a 1.1 MB font, for ~40 icons. This keeps only the names that appear as string
literals anywhere in src/ or App.js (a safe superset: it also catches names
held in constants and passed in as props).

Re-run after using a new MaterialCommunityIcons name:
    pip install fonttools && python3 scripts/subset-mci-icons.py
__tests__/mciIconSubset.test.js fails if a used name is missing.
"""
import json, pathlib, re
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
VENDOR = ROOT / 'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons'
full = json.loads((VENDOR / 'glyphmaps/MaterialCommunityIcons.json').read_text())

literals = set()
for f in [ROOT / 'App.js', *(ROOT / 'src').rglob('*.js')]:
    literals.update(re.findall(r"""['"`]([a-z0-9][a-z0-9-]*)['"`]""", f.read_text(encoding='utf-8')))

used = {n: full[n] for n in sorted(literals) if n in full}
(ROOT / 'src/icons/mciGlyphs.json').write_text(json.dumps(used, indent=0, sort_keys=True) + '\n')

font = TTFont(VENDOR / 'Fonts/MaterialCommunityIcons.ttf')
opts = subset.Options(); opts.notdef_outline = True; opts.name_IDs = ['*']
s = subset.Subsetter(opts); s.populate(unicodes=sorted(set(used.values()))); s.subset(font)
out = ROOT / 'assets/fonts/MaterialCommunityIconsSubset.ttf'
font.save(out)
print(f'{len(used)} icons, font {out.stat().st_size} bytes')
