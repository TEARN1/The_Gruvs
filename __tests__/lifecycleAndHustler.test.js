import { EventLifecycleManager } from '../src/services/eventLifecycleManager';
import { SmartAlertEngine } from '../src/services/smartAlertEngine';
import { HUSTLER_CATEGORIES, HUSTLER_CLUSTERS, HUSTLER_CATEGORY_MAP } from '../src/constants/hustlerCategories';

describe('Phase 1: Shared Data Spine & Hustler Directory Registry', () => {
  test('Hustler categories contains exactly 28 categories across 6 clusters', () => {
    expect(HUSTLER_CATEGORIES).toHaveLength(28);
    expect(HUSTLER_CLUSTERS).toHaveLength(6);

    const clusterIds = HUSTLER_CLUSTERS.map(c => c.id);
    expect(clusterIds).toEqual(['food', 'logistics', 'sound', 'fashion', 'venue', 'safety_media']);

    // Check essential categories
    expect(HUSTLER_CATEGORY_MAP['shisanyama_braai']).toBeDefined();
    expect(HUSTLER_CATEGORY_MAP['bakkie_haulers']).toBeDefined();
    expect(HUSTLER_CATEGORY_MAP['drum_percussion_rentals']).toBeDefined();
    expect(HUSTLER_CATEGORY_MAP['fashion_designers']).toBeDefined();
    expect(HUSTLER_CATEGORY_MAP['pa_line_array']).toBeDefined();
    expect(HUSTLER_CATEGORY_MAP['bouncers_security']).toBeDefined();

    // Verify commission rates
    expect(HUSTLER_CATEGORY_MAP['bakkie_haulers'].commissionRate).toBe(0.075);
    expect(HUSTLER_CATEGORY_MAP['fashion_designers'].commissionRate).toBe(0.10);
  });

  test('EventLifecycleManager detects phases accurately', () => {
    const now = Date.now();
    const upcomingEvent = {
      id: 'test_up',
      date_time: new Date(now + 48 * 3600000).toISOString(),
    };
    const phaseInfo = EventLifecycleManager.getPhase(upcomingEvent, { now });
    expect(phaseInfo.phase).toBe('pre_event');
    expect(phaseInfo.isUpcoming).toBe(true);
    expect(phaseInfo.isLive).toBe(false);

    const liveEvent = {
      id: 'test_live',
      date_time: new Date(now - 3600000).toISOString(),
      end_date: new Date(now + 3600000).toISOString().split('T')[0],
      end_time: '23:59',
    };
    const livePhase = EventLifecycleManager.getPhase(liveEvent, { now });
    expect(livePhase.phase).toBe('during_event');
    expect(livePhase.isLive).toBe(true);
  });

  test('EventLifecycleManager handles starring and unstarring schedule lineup items', async () => {
    const eventId = 'ev_lineup_test';
    const itemId = 'item_slot_1';

    expect(EventLifecycleManager.isItemStarred(eventId, itemId)).toBe(false);

    await EventLifecycleManager.starScheduleItem(eventId, itemId, { title: 'Kabza De Small' });
    expect(EventLifecycleManager.isItemStarred(eventId, itemId)).toBe(true);

    const lineup = await EventLifecycleManager.getStarredLineup(eventId);
    expect(lineup).toContain(itemId);

    await EventLifecycleManager.unstarScheduleItem(eventId, itemId);
    expect(EventLifecycleManager.isItemStarred(eventId, itemId)).toBe(false);
  });

  test('EventLifecycleManager handles Fit Check submissions and retrieval', async () => {
    const eventId = 'ev_fit_test';
    const entry = await EventLifecycleManager.submitFitCheck(eventId, {
      userId: 'user_lerato',
      userName: 'Lerato',
      photoUrl: 'https://example.com/fit.jpg',
      caption: 'Gold & black aesthetic',
    });

    expect(entry).toBeDefined();
    expect(entry.userName).toBe('Lerato');

    const fits = await EventLifecycleManager.getFitChecks(eventId);
    expect(fits.length).toBeGreaterThan(0);
    expect(fits[0].caption).toBe('Gold & black aesthetic');
  });

  test('EventLifecycleManager generates category-tailored packing checklist', () => {
    const eventId = 'ev_pack_test';
    const musicItems = EventLifecycleManager.getPackingChecklist('outdoor festival', eventId);
    expect(musicItems.some(i => i.id === 'item_ticket')).toBe(true);
    expect(musicItems.some(i => i.id === 'item_blanket')).toBe(true);

    const soccerItems = EventLifecycleManager.getPackingChecklist('soccer', eventId);
    expect(soccerItems.some(i => i.id === 'item_scarf')).toBe(true);
  });

  test('SmartAlertEngine evaluates match day and player alerts', async () => {
    const userId = 'fan_001';
    await SmartAlertEngine.followTeamOrPlayer(userId, 'Soweto Stars FC', 'team');
    await SmartAlertEngine.followTeamOrPlayer(userId, 'Lethabo Khumalo', 'player');

    expect(SmartAlertEngine.isFollowing('Soweto Stars FC', 'team')).toBe(true);
    expect(SmartAlertEngine.isFollowing('Lethabo Khumalo', 'player')).toBe(true);

    const matchAlert = SmartAlertEngine.evaluateMatchAlert(
      { id: 'match_1', home_team: 'Soweto Stars FC', away_team: 'Tembisa Kings', time: '15:30' },
      [{ id: 'Lethabo Khumalo', name: 'Lethabo Khumalo' }]
    );

    expect(matchAlert.hasAlert).toBe(true);
    expect(matchAlert.message).toContain('Lethabo Khumalo is in the starting lineup');

    await SmartAlertEngine.unfollowTeamOrPlayer(userId, 'Soweto Stars FC', 'team');
    expect(SmartAlertEngine.isFollowing('Soweto Stars FC', 'team')).toBe(false);
  });

  test('SmartAlertEngine returns fashion recommendations for event dress code', async () => {
    const recommendations = await SmartAlertEngine.getFashionMatchesForEvent({
      id: 'fashion_ev',
      category: 'fashion',
      dress_code: 'All-Black Chic',
    });
    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0].matchReason).toContain('All-Black Chic');
  });
});
