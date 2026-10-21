// The web motion layer must respect "reduce motion": every animation and
// transition lives inside the prefers-reduced-motion guard. And fx() must not
// leak web-only props into native views.
import { fx, FX_CSS } from '../src/styles/webFx';

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
