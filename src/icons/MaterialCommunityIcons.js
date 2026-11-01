// MaterialCommunityIcons cut down to the names this app uses (see
// scripts/subset-mci-icons.py). Same API as
// './MaterialCommunityIcons' at a fraction of the size.
import createIconSet from '@expo/vector-icons/createIconSet';
import glyphMap from './mciGlyphs.json';

export default createIconSet(glyphMap, 'material-community', require('../../assets/fonts/MaterialCommunityIconsSubset.ttf'));
