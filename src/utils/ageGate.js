/**
 * ageGate — the ONE legally-required hard restriction (per safety principles):
 * an under-age user must not be able to RSVP to or Touch Down at an age-
 * restricted (e.g. 18+ alcohol/nightlife) Gruv.
 *
 * Everything else in The Gruvs is soft prioritisation — only age is a wall.
 * This is the client-side check (friendly UX); a DB trigger enforces it server-
 * side too so it can't be bypassed by calling the API directly.
 *
 * Fail-open on UNKNOWN age: if we can't determine the user's age (no DOB set) we
 * allow it but flag unknownAge so the UI can nudge them to add a birthday —
 * blocking everyone without a DOB would lock legitimate adults out.
 */

/** Whole years from a birth date (YYYY-MM-DD string or Date); null if invalid. */
export function computeAge(birthDate) {
  if (!birthDate) return null;
  const d = birthDate instanceof Date ? birthDate : new Date(birthDate);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

/** Best-effort age from whatever DOB field a profile happens to carry. */
export function profileAge(profile) {
  if (!profile) return null;
  const fromDob = computeAge(profile.birth_date);
  if (fromDob != null) return fromDob;
  if (Number.isFinite(profile.age) && profile.age > 0 && profile.age < 130) return profile.age;
  const by = Number(profile.birth_year);
  if (by > 1900 && by <= new Date().getFullYear()) return new Date().getFullYear() - by;
  return null;
}

/**
 * Age gate for one event.
 * @returns {{ allowed:boolean, requiredAge:number, userAge:(number|null), unknownAge?:boolean, reason?:string }}
 */
export function checkEventAge(profile, event) {
  const requiredAge = Number(event?.age_restriction) || 0;
  if (requiredAge <= 0) return { allowed: true, requiredAge: 0, userAge: profileAge(profile) };

  const userAge = profileAge(profile);
  if (userAge == null) {
    return { allowed: true, requiredAge, userAge: null, unknownAge: true };
  }
  const allowed = userAge >= requiredAge;
  return {
    allowed,
    requiredAge,
    userAge,
    reason: allowed ? null : `This Gruv is ${requiredAge}+. Add your birthday on your profile if this is a mistake.`,
  };
}

export default { computeAge, profileAge, checkEventAge };
