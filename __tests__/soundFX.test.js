import { SoundFX, CHANNELS } from '../src/services/soundFX';

// jest.setup.js mocks AsyncStorage with a real in-memory implementation, so
// SoundFX's persistence genuinely round-trips here — no need to fake Storage.

beforeEach(async () => {
  // Reset every channel to its TRUE default (from the registry, not from
  // whatever listChannels() currently reports) — otherwise an override set in
  // one test would leak into the next, since listChannels() reflects state.
  await SoundFX.setEnabled(true);
  for (const [key, c] of Object.entries(CHANNELS)) {
    await SoundFX.setChannelSound(key, c.defaultSound);
  }
});

describe('SoundFX — channels', () => {
  it('every channel has a real, playable default sound', () => {
    // Catches the class of bug this whole system exists to fix: a channel
    // pointing at a sound name that doesn't actually exist in SOUNDS.
    for (const c of SoundFX.listChannels()) {
      expect(SoundFX.availableSounds()).toContain(c.sound);
    }
  });

  it('a channel with no override plays its default', () => {
    expect(SoundFX.getChannelSound('dm')).toBe('messageReceived');
    expect(SoundFX.getChannelSound('match')).toBe('match');
    expect(SoundFX.getChannelSound('levelUp')).toBe('levelUp');
  });

  it('setChannelSound persists an override that getChannelSound then returns', async () => {
    const ok = await SoundFX.setChannelSound('dm', 'notification');
    expect(ok).toBe(true);
    expect(SoundFX.getChannelSound('dm')).toBe('notification');
  });

  it('refuses to assign a sound that does not exist', async () => {
    const ok = await SoundFX.setChannelSound('dm', 'not_a_real_sound');
    expect(ok).toBe(false);
    // Must not have silently corrupted the existing preference.
    expect(SoundFX.getChannelSound('dm')).toBe('messageReceived');
  });

  it('refuses to set a channel that does not exist', async () => {
    const ok = await SoundFX.setChannelSound('not_a_real_channel', 'follow');
    expect(ok).toBe(false);
  });

  it('an override on one channel never leaks onto another', async () => {
    await SoundFX.setChannelSound('dm', 'notification');
    expect(SoundFX.getChannelSound('follow')).toBe('follow');
    expect(SoundFX.getChannelSound('match')).toBe('match');
  });

  it('the match and hostAlert channels resolve to their own distinct sounds', () => {
    // Part 4's whole point: the match tone must not be the generic ping, and
    // must not collide with levelUp (an achievement) or touchDown (a crowd
    // moment) — they're different emotional registers.
    expect(SoundFX.getChannelSound('match')).toBe('match');
    expect(SoundFX.getChannelSound('hostAlert')).toBe('hostAlert');
    expect(SoundFX.getChannelSound('match')).not.toBe(SoundFX.getChannelSound('levelUp'));
    expect(SoundFX.getChannelSound('match')).not.toBe(SoundFX.getChannelSound('touchDown'));
  });

  it('playChannel and play on an unknown name are both silent no-ops, never throw', () => {
    expect(() => SoundFX.playChannel('not_a_real_channel')).not.toThrow();
    expect(() => SoundFX.play('not_a_real_sound')).not.toThrow();
  });

  it('turns a camelCase sound name into a readable picker label', () => {
    expect(SoundFX.soundLabel('messageReceived')).toBe('Message Received');
    expect(SoundFX.soundLabel('hostAlert')).toBe('Host Alert');
    expect(SoundFX.soundLabel('match')).toBe('Match');
    expect(SoundFX.soundLabel('')).toBe('');
  });

  it('listChannels reports the resolved sound for every channel, override included', async () => {
    await SoundFX.setChannelSound('follow', 'levelUp');
    const rows = SoundFX.listChannels();
    const follow = rows.find((r) => r.key === 'follow');
    expect(follow.sound).toBe('levelUp');
    expect(follow.label).toBe('New followers');
  });
});
