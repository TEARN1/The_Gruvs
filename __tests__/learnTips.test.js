import { buildTipSchedule, TIPS } from '../src/services/learnTips';

const VALID_TABS = ['feed', 'explore', 'map', 'chats', 'profile'];

describe('learnTips', () => {
  it('schedules one tip a day at 18:00, starting tomorrow', () => {
    const now = new Date(2026, 10, 19, 20, 30); // installed at 20:30
    const plan = buildTipSchedule(now);
    expect(plan).toHaveLength(TIPS.length);
    plan.forEach((tip, i) => {
      expect(tip.at.getDate()).toBe(new Date(2026, 10, 20 + i).getDate());
      expect(tip.at.getHours()).toBe(18);
      expect(tip.at.getMinutes()).toBe(0);
      expect(tip.at.getTime()).toBeGreaterThan(now.getTime());
    });
  });

  it('never fires the same evening, even if installed before 18:00', () => {
    const now = new Date(2026, 10, 19, 9, 0);
    expect(buildTipSchedule(now)[0].at.getDate()).toBe(20);
  });

  it('uses fixed ids so re-scheduling replaces instead of duplicating', () => {
    const ids = buildTipSchedule().map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe('gruvs-tip-1');
  });

  it('only points at tabs that exist', () => {
    TIPS.forEach(t => expect(VALID_TABS).toContain(t.tab));
  });
});
