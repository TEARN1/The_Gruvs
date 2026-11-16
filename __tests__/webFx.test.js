// The web motion layer must respect "reduce motion": every animation and
// transition lives inside the prefers-reduced-motion guard. And fx() must not
// leak web-only props into native views.
import { fx, FX_CSS, glassWanted } from '../src/styles/webFx';

test('every animation/transition is inside the reduced-motion guard', () => {
  const guard = FX_CSS.indexOf('@media (prefers-reduced-motion:no-preference)');
  expect(guard).toBeGreaterThan(0);
  const before = FX_CSS.slice(0, guard);
  expect(before).not.toMatch(/(^|[;{\s])animation(-name)?\s*:/);
  expect(before).not.toMatch(/(^|[;{\s])transition(-property)?\s*:/);
});

test('fx() adds nothing on native', () => {
  expect(fx('glass rise', 2)).toEqual({});
});

// Glass is the default; surfaces turn solid where it would cost readability
// or speed (the same rule as Excellency and The Resident).
test('glass is on for a capable device and solid where it would cost readability or speed', () => {
  const capable = { supportsBackdrop: true, reducedTransparency: false, forcedColors: false, saveData: false, deviceMemory: 8, cores: 8 };
  expect(glassWanted(capable)).toBe(true);
  expect(glassWanted({ ...capable, deviceMemory: undefined, cores: undefined })).toBe(true);
  for (const change of [{ supportsBackdrop: false }, { reducedTransparency: true }, { forcedColors: true }, { saveData: true }, { deviceMemory: 2 }, { cores: 2 }]) {
    expect(glassWanted({ ...capable, ...change })).toBe(false);
  }
});

test('with glass off nothing blurs, inline styles included', () => {
  expect(FX_CSS).toMatch(/\[data-glass="off"\] \*[^{]*\{-webkit-backdrop-filter:none!important;backdrop-filter:none!important\}/);
});
