// ── Ad placement control ──────────────────────────────────────────────────────
// ONE place to control WHERE and WHEN ads appear in The Gruvs.
//
//   • Flip a slot's `enabled` to false and that placement goes dark everywhere.
//   • Optional `hours: [start, end]` (24h local time) limits WHEN a slot shows —
//     e.g. nightlife promos only in the evening. Omit it to show all day.
//   • Set ADS_ENABLED = false to kill every ad across the app at once.
//
// This is the CONTROL layer only — it decides whether a slot may show an ad.
// WHAT fills the slot is decided by the ad components: today that's first-party
// promoted Gruvs / booked campaigns (`contextual_ads`, `ad_campaigns`). A
// third-party network (AdMob on native, AdSense on web) can be added later as a
// backfill for empty slots without changing this file's contract.

export const ADS_ENABLED = true;

export const AD_SLOTS = {
  feed:        { enabled: true, label: 'The Drop feed (AdFlywheel)' },
  eventDetail: { enabled: true, label: 'Event detail page (contextual campaigns)' },
  // Add new slots here as you place ads (e.g. explore, lineup, betweenReels).
};

// True if the given slot may show an ad right now:
// global switch ON + slot enabled + (no time window OR inside it).
export const adSlotActive = (slotKey) => {
  if (!ADS_ENABLED) return false;
  const slot = AD_SLOTS[slotKey];
  if (!slot || !slot.enabled) return false;
  if (Array.isArray(slot.hours) && slot.hours.length === 2) {
    const h = new Date().getHours();
    const [start, end] = slot.hours;
    const inWindow = start <= end ? (h >= start && h < end) : (h >= start || h < end);
    if (!inWindow) return false;
  }
  return true;
};
