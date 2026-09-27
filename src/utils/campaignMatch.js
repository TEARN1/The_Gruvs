// ── Campaign match ────────────────────────────────────────────────────────────
// Does this ad campaign's audience targeting match the person viewing it? The B2B
// promise: businesses target an audience and only that audience sees the ad.
// Delivery already filters by event phase; this applies the rest. Pure.
//
// Rule: every targeting dimension the business SET must match. A dimension the
// viewer can't be judged on (no profile data) passes — we narrow on known
// mismatches, never exclude on missing data (maximise valid reach).

const lc = (s) => (typeof s === 'string' ? s.trim().toLowerCase() : '');
const lcArr = (a) => (Array.isArray(a) ? a.map(lc).filter(Boolean) : []);

export function campaignMatchesViewer(targeting = {}, viewer = {}, event = {}) {
  const t = targeting || {};
  const demo = t.demographics || {};
  const geo = t.geographic || {};
  const beh = t.behaviour || {};

  // gender
  const genders = lcArr(demo.gender);
  if (genders.length && viewer.gender && !genders.includes(lc(viewer.gender))) return false;

  // age (from explicit age or birth_year)
  const min = Number(demo.age_min) || 0;
  const max = Number(demo.age_max) || 0;
  if (min || max) {
    const age = Number(viewer.age) || (viewer.birth_year ? new Date().getFullYear() - Number(viewer.birth_year) : null);
    if (age != null && ((min && age < min) || (max && age > max))) return false;
  }

  // city
  const cities = lcArr(geo.cities);
  if (cities.length && viewer.city && !cities.includes(lc(viewer.city))) return false;

  // interests — flatten every interest array the business picked (music, food, hobbies…)
  const wantInterests = Object.values(t.interests || {}).flatMap(lcArr);
  if (wantInterests.length) {
    const mine = lcArr(viewer.interests);
    if (mine.length && !wantInterests.some((w) => mine.includes(w))) return false;
  }

  // event category (contextual to the Gruv being viewed)
  const cats = lcArr(beh.event_categories);
  if (cats.length && event.category && !cats.includes(lc(event.category))) return false;

  return true;
}
