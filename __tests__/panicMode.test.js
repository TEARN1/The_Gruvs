import { PANIC_PATCH, RESTORE_PATCH } from '../src/services/panicMode';

describe('PanicMode patches — disappear / restore', () => {
  it('panic makes you ghost, undiscoverable, beacon off', () => {
    expect(PANIC_PATCH).toEqual({ identity_mode: 'ghost', is_discoverable: false, is_beacon_active: false });
  });

  it('restore brings you back to public + discoverable', () => {
    expect(RESTORE_PATCH.is_discoverable).toBe(true);
    expect(RESTORE_PATCH.identity_mode).toBe('public');
  });

  it('panic never leaves you discoverable', () => {
    expect(PANIC_PATCH.is_discoverable).toBe(false);
    expect(PANIC_PATCH.is_beacon_active).toBe(false);
  });
});
