/**
 * writingStyles — fancy Unicode "fonts" for The Gruvs auras.
 *
 * Each style maps A–Z / a–z / 0–9 to a Unicode variant so a user can stamp
 * their own writing signature. Grouped by aura/gender vibe (15 each) — masculine
 * leans bold/blocky, feminine leans script/soft, non-binary leans experimental —
 * but everyone can pick any of them. transform(text, key) is a pure function.
 */

// ── transform builders ───────────────────────────────────────────────────────
const offset = (U, L, D) => (t) => Array.from(t, (ch) => {
  const c = ch.codePointAt(0);
  if (U != null && c >= 65 && c <= 90) return String.fromCodePoint(U + (c - 65));
  if (L != null && c >= 97 && c <= 122) return String.fromCodePoint(L + (c - 97));
  if (D != null && c >= 48 && c <= 57) return String.fromCodePoint(D + (c - 48));
  return ch;
}).join('');

// offset with BMP exceptions (script / fraktur / double-struck have stray glyphs)
const offsetEx = (U, L, D, ex) => (t) => Array.from(t, (ch) => {
  if (ex[ch]) return ex[ch];
  const c = ch.codePointAt(0);
  if (U != null && c >= 65 && c <= 90) return String.fromCodePoint(U + (c - 65));
  if (L != null && c >= 97 && c <= 122) return String.fromCodePoint(L + (c - 97));
  if (D != null && c >= 48 && c <= 57) return String.fromCodePoint(D + (c - 48));
  return ch;
}).join('');

const mapFn = (map) => (t) => Array.from(t, (ch) => map[ch] || map[ch.toLowerCase()] || ch).join('');
const combine = (mark) => (t) => Array.from(t, (ch) => (/\s/.test(ch) ? ch : ch + mark)).join('');

const SCRIPT_EX = { B: 'ℬ', E: 'ℰ', F: 'ℱ', H: 'ℋ', I: 'ℐ', L: 'ℒ', M: 'ℳ', R: 'ℛ', e: 'ℯ', g: 'ℊ', o: 'ℴ' };
const FRAK_EX  = { C: 'ℭ', H: 'ℌ', I: 'ℑ', R: 'ℜ', Z: 'ℨ' };
const DBL_EX   = { C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ' };
const SMALLCAPS = { a:'ᴀ',b:'ʙ',c:'ᴄ',d:'ᴅ',e:'ᴇ',f:'ꜰ',g:'ɢ',h:'ʜ',i:'ɪ',j:'ᴊ',k:'ᴋ',l:'ʟ',m:'ᴍ',n:'ɴ',o:'ᴏ',p:'ᴘ',q:'ǫ',r:'ʀ',s:'s',t:'ᴛ',u:'ᴜ',v:'ᴠ',w:'ᴡ',x:'x',y:'ʏ',z:'ᴢ' };
const circledFn = (t) => Array.from(t, (ch) => {
  const c = ch.codePointAt(0);
  if (c >= 65 && c <= 90) return String.fromCodePoint(0x24B6 + (c - 65));
  if (c >= 97 && c <= 122) return String.fromCodePoint(0x24D0 + (c - 97));
  if (c === 48) return '⓪';
  if (c >= 49 && c <= 57) return String.fromCodePoint(0x2460 + (c - 49));
  return ch;
}).join('');

// ── style registry ───────────────────────────────────────────────────────────
export const STYLES = {
  normal:        { label: 'Normal',        fn: (t) => t },
  bold:          { label: 'Bold',          fn: offset(0x1D400, 0x1D41A, 0x1D7CE) },
  italic:        { label: 'Italic',        fn: offsetEx(0x1D434, 0x1D44E, null, { h: 'ℎ' }) },
  boldItalic:    { label: 'Bold Italic',   fn: offset(0x1D468, 0x1D482) },
  script:        { label: 'Script',        fn: offsetEx(0x1D49C, 0x1D4B6, null, SCRIPT_EX) },
  boldScript:    { label: 'Cursive',       fn: offset(0x1D4D0, 0x1D4EA) },
  fraktur:       { label: 'Gothic',        fn: offsetEx(0x1D504, 0x1D51E, null, FRAK_EX) },
  boldFraktur:   { label: 'Gothic Bold',   fn: offset(0x1D56C, 0x1D586) },
  doubleStruck:  { label: 'Outline',       fn: offsetEx(0x1D538, 0x1D552, 0x1D7D8, DBL_EX) },
  sans:          { label: 'Clean',         fn: offset(0x1D5A0, 0x1D5BA, 0x1D7E2) },
  sansBold:      { label: 'Heavy',         fn: offset(0x1D5D4, 0x1D5EE, 0x1D7EC) },
  sansItalic:    { label: 'Slant',         fn: offset(0x1D608, 0x1D622) },
  sansBoldItalic:{ label: 'Heavy Slant',   fn: offset(0x1D63C, 0x1D656) },
  mono:          { label: 'Mono',          fn: offset(0x1D670, 0x1D68A, 0x1D7F6) },
  fullwidth:     { label: 'Wide',          fn: offset(0xFF21, 0xFF41, 0xFF10) },
  circled:       { label: 'Bubble',        fn: circledFn },
  smallCaps:     { label: 'Small Caps',    fn: mapFn(SMALLCAPS) },
  underline:     { label: 'Underline',     fn: combine('̲') },
  strike:        { label: 'Strike',        fn: combine('̶') },
};

// 15 per aura (curated vibe; overlap is fine — every user can pick any).
export const GENDER_STYLES = {
  male:          ['bold', 'sansBold', 'sansBoldItalic', 'boldFraktur', 'fraktur', 'mono', 'doubleStruck', 'underline', 'strike', 'fullwidth', 'boldItalic', 'sans', 'sansItalic', 'circled', 'smallCaps'],
  female:        ['boldScript', 'script', 'italic', 'sansItalic', 'smallCaps', 'fullwidth', 'doubleStruck', 'circled', 'bold', 'boldItalic', 'underline', 'fraktur', 'sans', 'mono', 'strike'],
  'non binary':  ['doubleStruck', 'fraktur', 'boldFraktur', 'mono', 'fullwidth', 'circled', 'smallCaps', 'underline', 'strike', 'script', 'boldScript', 'sansItalic', 'bold', 'sansBold', 'italic'],
};

export const transform = (text, key) => {
  const style = STYLES[key];
  if (!style || !text) return text || '';
  try { return style.fn(text); } catch { return text; }
};

export const stylesForGender = (gender) => {
  const keys = GENDER_STYLES[gender] || GENDER_STYLES.male;
  return keys.map((k) => ({ key: k, label: STYLES[k]?.label || k }));
};

export default { STYLES, GENDER_STYLES, transform, stylesForGender };