/**
 * AudienceTargeting — the vocabulary for "who is this event / survey for".
 *
 * Two halves that mirror each other:
 *   COMMUNITY_TAGS  — opt-in self-identification a USER adds to their profile
 *                     (accessibility needs, life-stage, faith, …). Hosts target
 *                     these; users always choose them voluntarily.
 *   GENDER_OPTIONS / LANGUAGE_OPTIONS — shared pick-lists.
 *
 * Free, no API, no AI. The host's selections live in events.audience (JSONB);
 * the matching attributes live on profiles. See 18_event_audience_targeting.sql.
 *
 * The tags below are grouped so the same component can render the picker on the
 * profile-edit side ("which of these are you?") and the host side ("who is this
 * for?") from one source of truth.
 */

export const COMMUNITY_TAGS = [
  // Accessibility & specific needs (the "workshop for paralysed people",
  // "surgery outreach for the blind" use-cases).
  { key: 'wheelchair_user',  label: 'Wheelchair user',     emoji: '♿',  group: 'Access & needs' },
  { key: 'blind',            label: 'Blind / low vision',  emoji: '🦯', group: 'Access & needs' },
  { key: 'deaf',             label: 'Deaf / hard of hearing', emoji: '🤟', group: 'Access & needs' },
  { key: 'mobility',         label: 'Mobility needs',      emoji: '🦽', group: 'Access & needs' },
  { key: 'neurodivergent',   label: 'Neurodivergent',      emoji: '🧩', group: 'Access & needs' },
  { key: 'chronic_illness',  label: 'Chronic illness',     emoji: '💊', group: 'Access & needs' },
  { key: 'caregiver',        label: 'Caregiver',           emoji: '🤲', group: 'Access & needs' },

  // Life stage
  { key: 'student',          label: 'Student',             emoji: '🎓', group: 'Life stage' },
  { key: 'parent',           label: 'Parent',              emoji: '👶', group: 'Life stage' },
  { key: 'newlywed',         label: 'Getting married',     emoji: '💍', group: 'Life stage' },
  { key: 'entrepreneur',     label: 'Entrepreneur',        emoji: '💼', group: 'Life stage' },
  { key: 'job_seeker',       label: 'Job seeker',          emoji: '🔍', group: 'Life stage' },
  { key: 'retired',          label: 'Retired',             emoji: '🌅', group: 'Life stage' },

  // Faith / culture (opt-in)
  { key: 'christian',        label: 'Christian',           emoji: '✝️', group: 'Faith' },
  { key: 'muslim',           label: 'Muslim',              emoji: '☪️', group: 'Faith' },
  { key: 'traditional',      label: 'Traditional / ancestral', emoji: '🪶', group: 'Faith' },

  // Interest communities
  { key: 'lgbtq',            label: 'LGBTQ+',              emoji: '🏳️‍🌈', group: 'Community' },
  { key: 'creatives',        label: 'Creatives',           emoji: '🎨', group: 'Community' },
  { key: 'athletes',         label: 'Athletes',            emoji: '🏃', group: 'Community' },
  { key: 'gamers',           label: 'Gamers',              emoji: '🎮', group: 'Community' },
];

export const COMMUNITY_TAG_MAP = Object.fromEntries(COMMUNITY_TAGS.map((t) => [t.key, t]));

export const COMMUNITY_TAG_GROUPS = COMMUNITY_TAGS.reduce((acc, t) => {
  (acc[t.group] = acc[t.group] || []).push(t);
  return acc;
}, {});

export const GENDER_OPTIONS = [
  { key: 'female', label: 'Women', emoji: '👩' },
  { key: 'male',   label: 'Men',   emoji: '👨' },
  { key: 'nonbinary', label: 'Non-binary', emoji: '🧑' },
];

// Major South African languages (keyless, just labels).
export const LANGUAGE_OPTIONS = [
  { key: 'zul', label: 'isiZulu' },
  { key: 'xho', label: 'isiXhosa' },
  { key: 'afr', label: 'Afrikaans' },
  { key: 'eng', label: 'English' },
  { key: 'nso', label: 'Sepedi' },
  { key: 'tsn', label: 'Setswana' },
  { key: 'sot', label: 'Sesotho' },
  { key: 'tso', label: 'Xitsonga' },
  { key: 'ssw', label: 'siSwati' },
  { key: 'ven', label: 'Tshivenda' },
  { key: 'nbl', label: 'isiNdebele' },
];

export const LANGUAGE_MAP = Object.fromEntries(LANGUAGE_OPTIONS.map((l) => [l.key, l]));

/** True when an audience object actually narrows anything (i.e. isn't empty). */
export const hasAudienceTargeting = (a) => {
  if (!a || typeof a !== 'object') return false;
  return (
    (a.age_min > 0) || (a.age_max > 0) || (a.radius_km > 0) ||
    ['genders', 'clans', 'surnames', 'villages', 'cities', 'languages', 'community_tags']
      .some((k) => Array.isArray(a[k]) && a[k].length > 0)
  );
};

/** Short human summary of an audience object, e.g. "Women · 18–35 · Mthethwa clan · within 40km". */
export const describeAudience = (a) => {
  if (!hasAudienceTargeting(a)) return 'Everyone';
  const parts = [];
  if (a.genders?.length) parts.push(a.genders.map((g) => GENDER_OPTIONS.find((o) => o.key === g)?.label || g).join('/'));
  if (a.age_min > 0 || a.age_max > 0) parts.push(`${a.age_min || 'any'}–${a.age_max || '∞'}`);
  if (a.clans?.length) parts.push(`${a.clans.join(', ')} clan`);
  if (a.surnames?.length) parts.push(`${a.surnames.join(', ')} surname`);
  if (a.villages?.length) parts.push(a.villages.join(', '));
  if (a.cities?.length) parts.push(a.cities.join(', '));
  if (a.community_tags?.length) parts.push(a.community_tags.map((t) => COMMUNITY_TAG_MAP[t]?.label || t).join(', '));
  if (a.languages?.length) parts.push(a.languages.map((l) => LANGUAGE_MAP[l]?.label || l).join(', '));
  if (a.radius_km > 0) parts.push(`within ${a.radius_km}km`);
  return parts.join(' · ');
};