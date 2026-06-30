import { notificationPriority, isQuietHours, shouldInterrupt } from '../src/utils/notificationPolicy';

const at = (h) => new Date(2026, 5, 30, h, 0, 0);

describe('notificationPolicy — signal over noise', () => {
  it('classifies priority', () => {
    expect(notificationPriority('crew_out')).toBe('high');
    expect(notificationPriority('message')).toBe('high');
    expect(notificationPriority('vibe')).toBe('normal');
    expect(notificationPriority('profile_view')).toBe('low');
  });

  it('quiet hours wrap midnight (22:00–08:00)', () => {
    expect(isQuietHours(at(23))).toBe(true);
    expect(isQuietHours(at(3))).toBe(true);
    expect(isQuietHours(at(7))).toBe(true);
    expect(isQuietHours(at(8))).toBe(false);
    expect(isQuietHours(at(13))).toBe(false);
    expect(isQuietHours(at(22))).toBe(true);
  });

  it('respects custom + disabled quiet hours', () => {
    expect(isQuietHours(at(3), { quietEnabled: false })).toBe(false);
    expect(isQuietHours(at(13), { quietStart: 12, quietEnd: 14 })).toBe(true);
  });

  it('low priority never interrupts, even midday', () => {
    expect(shouldInterrupt('profile_view', at(13))).toBe(false);
  });

  it('quiet hours: only high priority interrupts', () => {
    expect(shouldInterrupt('crew_out', at(3))).toBe(true);   // urgent → wake them
    expect(shouldInterrupt('vibe', at(3))).toBe(false);      // normal → hush till morning
  });

  it('normal hours: normal + high interrupt', () => {
    expect(shouldInterrupt('vibe', at(13))).toBe(true);
    expect(shouldInterrupt('message', at(13))).toBe(true);
  });
});
