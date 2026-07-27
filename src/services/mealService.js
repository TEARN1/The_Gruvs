/**
 * mealService — "The Meal": restaurant menus / specials / tastings.
 *
 * Business accounts only (RLS + owns_business enforce it server-side). Free to
 * post; visibility is metered by the feed_meals reach-throttle and lifted by a
 * boost. No money handling — a boost is a free flag whose caps live in the DB
 * (boost_meal) and mirror businessEntitlements.
 */
import { supabase } from './supabase';
import { resilient } from '../utils/resilience';

// Light display-safe clean: drop control chars + angle brackets (no markup is
// ever stored), trim, clamp length. The DB/RLS is the real authority.
const CTRL = new RegExp('[\\u0000-\\u001F<>]', 'g');
const clean = (s, max = 400) => String(s || '').replace(CTRL, '').trim().slice(0, max);

export const MealService = {
  /** The business owned by this user, or null. */
  async myBusiness(userId) {
    if (!userId) return null;
    const { data } = await supabase
      .from('business_profiles')
      .select('id, business_name, logo_url, tier, user_id')
      .eq('user_id', userId)
      .maybeSingle();
    return data || null;
  },

  /** Ranked, throttle-aware feed (boosted first). Public. */
  async listMeals({ lat = null, lon = null, limit = 40 } = {}) {
    return resilient(
      [
        async () => {
          const { data, error } = await supabase.rpc('feed_meals', { p_lat: lat, p_lon: lon, p_limit: limit });
          if (error) throw error;
          return data || [];
        },
        // Fallback if the RPC isn't present yet: raw active meals, boosted first.
        async () => {
          const { data, error } = await supabase
            .from('meal_posts')
            .select('*')
            .eq('is_active', true)
            .order('is_boosted', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(limit);
          if (error) throw error;
          return data || [];
        },
      ],
      { attemptsPerTier: 2, baseMs: 300, label: 'MealService.listMeals', fallbackValue: [] }
    );
  },

  /** Just the boosted, live meals — for injecting into Near You / The Drop. */
  async listBoosted({ lat = null, lon = null, limit = 8 } = {}) {
    const all = await this.listMeals({ lat, lon, limit: 40 });
    const now = Date.now();
    return (all || [])
      .filter(m => m.is_boosted && (!m.boosted_until || new Date(m.boosted_until).getTime() > now))
      .slice(0, limit);
  },

  async myMeals(businessId) {
    if (!businessId) return [];
    const { data } = await supabase
      .from('meal_posts')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });
    return data || [];
  },

  async createMeal(businessId, userId, m) {
    if (!businessId || !userId) throw new Error('A business profile is required to post a meal.');
    if (!m?.title?.trim()) throw new Error('Give the dish a name.');
    const payload = {
      business_id: businessId,
      owner_id: userId,
      title: clean(m.title, 120),
      description: clean(m.description, 600),
      price: m.price != null && m.price !== '' ? Number(m.price) : null,
      currency: m.currency || null,
      image_url: m.image_url || null,
      meal_type: ['menu', 'special', 'tasting', 'fastfood'].includes(m.meal_type) ? m.meal_type : 'menu',
      tags: Array.isArray(m.tags) ? m.tags.slice(0, 8) : [],
      lat: m.lat ?? null,
      lon: m.lon ?? null,
      available_from: m.available_from || null,
      available_to: m.available_to || null,
    };
    const { data, error } = await supabase.from('meal_posts').insert(payload).select().single();
    if (error) throw error;
    return data;
  },

  /** Server enforces the tier boost-cap; surfaces 'over_limit' for the upsell. */
  async boostMeal(mealId, hours = 24) {
    const { data, error } = await supabase.rpc('boost_meal', { p_meal: mealId, p_hours: hours });
    if (error) {
      if (/over_limit/.test(error.message || '')) { const e = new Error('over_limit'); e.code = 'over_limit'; throw e; }
      throw error;
    }
    return Array.isArray(data) ? data[0] : data;
  },

  async bumpView(mealId) {
    try { await supabase.rpc('bump_meal_view', { p_meal: mealId }); } catch { /* views are best-effort */ }
  },

  async setActive(mealId, isActive) {
    const { error } = await supabase.from('meal_posts').update({ is_active: !!isActive, updated_at: new Date().toISOString() }).eq('id', mealId);
    if (error) throw error;
    return true;
  },

  async deleteMeal(mealId) {
    const { error } = await supabase.from('meal_posts').delete().eq('id', mealId);
    if (error) throw error;
    return true;
  },
};

/** Is a meal inside its daily availability window right now? (specials at lunch) */
export function isMealLiveNow(meal, now = new Date()) {
  if (!meal?.available_from || !meal?.available_to) return true;
  const cur = now.getHours() * 60 + now.getMinutes();
  const toMin = (t) => { const [h, m] = String(t).split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  const a = toMin(meal.available_from), b = toMin(meal.available_to);
  return a <= b ? (cur >= a && cur <= b) : (cur >= a || cur <= b); // handles windows past midnight
}

export default MealService;
