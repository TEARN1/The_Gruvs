/**
 * surveys — businesses ask the community questions, served as a gentle DRIP
 * (zero cost, no API, no AI). We never hand a user a whole questionnaire; the
 * app calls getNextSurvey() once in a while and shows a single question they
 * haven't answered yet AND that they're eligible for (audience match).
 *
 * Data model lives in 19_business_surveys.sql.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const CURRENT_YEAR = new Date().getFullYear();

// Don't pester: only surface a new question if it's been a while since the last.
export const SURVEY_COOLDOWN_HOURS = 20;
const LAST_SHOWN_KEY = 'survey:lastShownAt';

/**
 * audienceMatchesProfile — same JSONB shape as events.audience. Empty audience
 * means "everyone". Mirrors routeTargetedEvent's logic, profile-side.
 */
export function audienceMatchesProfile(audience, profile) {
  if (!audience || typeof audience !== 'object') return true;
  const lc = (s) => (typeof s === 'string' ? s.trim().toLowerCase() : '');
  const lcArr = (a) => (Array.isArray(a) ? a.map(lc).filter(Boolean) : []);
  const checks = [];

  const ageMin = audience.age_min > 0 ? audience.age_min : null;
  const ageMax = audience.age_max > 0 ? audience.age_max : null;
  if (ageMin || ageMax) {
    const age = profile.birth_year ? CURRENT_YEAR - profile.birth_year : null;
    checks.push(age != null && (!ageMin || age >= ageMin) && (!ageMax || age <= ageMax));
  }
  const genders = lcArr(audience.genders);
  if (genders.length) checks.push(genders.includes(lc(profile.gender)));
  const clans = lcArr(audience.clans);
  if (clans.length) checks.push(clans.includes(lc(profile.clan_name)));
  const surnames = lcArr(audience.surnames);
  if (surnames.length) checks.push(surnames.includes(lc(profile.surname)));
  const villages = lcArr(audience.villages);
  if (villages.length) checks.push(villages.includes(lc(profile.home_village)));
  const cities = lcArr(audience.cities);
  if (cities.length) checks.push(cities.includes(lc(profile.city)));
  const langs = lcArr(audience.languages);
  if (langs.length) checks.push((profile.languages || []).some((l) => langs.includes(lc(l))));
  const tags = Array.isArray(audience.community_tags) ? audience.community_tags : [];
  if (tags.length) checks.push((profile.community_tags || []).some((t) => tags.includes(t)));

  if (!checks.length) return true; // no targeting set → everyone
  return audience.match_mode === 'all' ? checks.every(Boolean) : checks.some(Boolean);
}

/**
 * getNextSurvey — the single question to ask this user right now, or null.
 * Respects the cooldown, the audience filter, and anything already answered/skipped.
 *
 * @param {string} userId
 * @param {object} [opts]
 * @param {boolean} [opts.ignoreCooldown] — bypass the time gate (e.g. a "Surveys" tab)
 */
export async function getNextSurvey(userId, { ignoreCooldown = false } = {}) {
  if (!userId) return null;

  if (!ignoreCooldown) {
    // AsyncStorage, not localStorage — the cooldown must hold on native too,
    // otherwise Android/iOS users get pestered on every app open.
    try {
      const last = parseInt((await AsyncStorage.getItem(LAST_SHOWN_KEY)) || '0', 10);
      if (last && Date.now() - last < SURVEY_COOLDOWN_HOURS * 3600000) return null;
    } catch { /* storage unavailable — fall through and serve */ }
  }

  try {
    const nowIso = new Date().toISOString();
    const [profileRes, surveysRes, answeredRes] = await Promise.all([
      supabase.from('profiles')
        .select('gender, birth_year, clan_name, surname, home_village, city, languages, community_tags')
        .eq('id', userId).single(),
      supabase.from('surveys')
        .select('id, author_id, title, question, answer_type, options, audience, reward_xp, expires_at')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(100),
      supabase.from('survey_responses')
        .select('survey_id').eq('user_id', userId).limit(1000),
    ]);

    const profile = profileRes.data || {};
    const surveys = surveysRes.data || [];
    const answered = new Set((answeredRes.data || []).map((r) => r.survey_id));

    const next = surveys.find((s) =>
      !answered.has(s.id) &&
      s.author_id !== userId &&                                  // don't ask the author
      (!s.expires_at || s.expires_at > nowIso) &&
      audienceMatchesProfile(s.audience, profile)
    );
    return next || null;
  } catch (e) {
    console.warn('[surveys] getNextSurvey failed:', e.message);
    return null;
  }
}

/** Record an answer (or a skip). answer is an array of chosen values / free text. */
export async function submitSurveyResponse(surveyId, userId, answer, { skipped = false } = {}) {
  if (!surveyId || !userId) return false;
  try {
    const { error } = await supabase.from('survey_responses').upsert(
      {
        survey_id: surveyId,
        user_id: userId,
        answer: Array.isArray(answer) ? answer : answer != null ? [String(answer)] : [],
        skipped,
        answered_at: new Date().toISOString(),
      },
      { onConflict: 'survey_id,user_id' }
    );
    if (error) throw error;
    AsyncStorage.setItem(LAST_SHOWN_KEY, String(Date.now())).catch(() => {});
    return true;
  } catch (e) {
    console.warn('[surveys] submitSurveyResponse failed:', e.message);
    return false;
  }
}

/** Create a survey (business side). Returns the new row or null. */
export async function createSurvey(authorId, { title, question, answerType = 'single', options = [], audience = {}, rewardXp = 5, businessId = null, expiresAt = null }) {
  if (!authorId || !question?.trim()) return null;
  try {
    const { data, error } = await supabase.from('surveys').insert({
      author_id: authorId,
      business_id: businessId,
      title: title?.trim() || 'Quick question',
      question: question.trim(),
      answer_type: answerType,
      options,
      audience,
      reward_xp: rewardXp,
      expires_at: expiresAt,
    }).select().single();
    if (error) throw error;
    return data;
  } catch (e) {
    console.warn('[surveys] createSurvey failed:', e.message);
    return null;
  }
}

/** All surveys the caller authored (business side), newest first. */
export async function listMySurveys(authorId) {
  if (!authorId) return [];
  try {
    const { data, error } = await supabase.from('surveys')
      .select('id, title, question, answer_type, options, reward_xp, is_active, expires_at, created_at')
      .eq('author_id', authorId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.warn('[surveys] listMySurveys failed:', e.message);
    return [];
  }
}

/** Pause / resume a survey the caller owns (RLS enforces ownership). */
export async function setSurveyActive(surveyId, isActive) {
  if (!surveyId) return false;
  try {
    const { error } = await supabase.from('surveys')
      .update({ is_active: !!isActive }).eq('id', surveyId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('[surveys] setSurveyActive failed:', e.message);
    return false;
  }
}

/** Anonymous aggregate results for a survey the caller owns. */
export async function getSurveyResults(surveyId) {
  if (!surveyId) return [];
  try {
    const { data, error } = await supabase.rpc('survey_results', { p_survey_id: surveyId });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.warn('[surveys] getSurveyResults failed:', e.message);
    return [];
  }
}

export default {
  SURVEY_COOLDOWN_HOURS,
  audienceMatchesProfile,
  getNextSurvey,
  submitSurveyResponse,
  createSurvey,
  listMySurveys,
  setSurveyActive,
  getSurveyResults,
};