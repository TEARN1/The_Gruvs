import { feature } from '../src/constants/launchConfig';

// Demo surfaces stay hidden until each has a migration, a checked server
// function and a test (master spec v2.5, section 5). Turning one on should be
// a deliberate edit to this test too.
describe('parked demo features', () => {
  it.each(['ticketVault', 'inPersonVibe', 'boothStreet', 'proofOfSweat', 'safetyExtras'])('%s is off', (k) => {
    expect(feature(k)).toBe(false);
  });
  it('the honest safety panel and core surfaces stay on', () => {
    expect(feature('liveMap')).toBe(true);
    expect(feature('business')).toBe(true);
  });
});
