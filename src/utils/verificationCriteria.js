/**
 * verificationCriteria — the CLIENT mirror of request_verification()'s
 * server-side rules (verification_engine.sql), so the profile can show a live
 * "how close am I?" checklist. The server re-checks everything — this is UI
 * guidance, never the gate. Earned-only: no purchase path exists.
 */

export const VERIFICATION_RULES = [
  { key: 'age',        label: 'Account 30+ days old',                     need: 30 },
  { key: 'sis',        label: 'Integrity score 60+',                      need: 60 },
  { key: 'vibe',       label: 'Elite Viber (vibe score 101+)',            need: 101 },
  { key: 'touchdowns', label: '10 Touch Downs (real-world presence)',     need: 10 },
];

/**
 * @param p { created_at, social_integrity_score, vibe_score, resident_trust_tier }
 * @param touchDownCount number
 * @returns { checks: [{key,label,ok,have,need}], eligible, residentFastTrack }
 */
export function verificationChecklist(p = {}, touchDownCount = 0, now = Date.now()) {
  const ageDays = p?.created_at ? Math.floor((now - new Date(p.created_at).getTime()) / 86400000) : 0;
  const sis = Number(p?.social_integrity_score ?? 50);
  const vibe = Number(p?.vibe_score ?? 0);
  const residentFastTrack = p?.resident_trust_tier === 'trusted' || p?.resident_trust_tier === 'verified';

  const checks = [
    { key: 'age',        label: VERIFICATION_RULES[0].label, ok: ageDays >= 30, have: ageDays, need: 30 },
    { key: 'sis',        label: VERIFICATION_RULES[1].label, ok: sis >= 60, have: Math.round(sis), need: 60 },
    { key: 'vibe',       label: VERIFICATION_RULES[2].label, ok: vibe >= 101, have: Math.round(vibe), need: 101 },
    {
      key: 'touchdowns',
      label: residentFastTrack ? 'Presence — fast-tracked via The Resident ✓' : VERIFICATION_RULES[3].label,
      ok: residentFastTrack || Number(touchDownCount) >= 10,
      have: Number(touchDownCount) || 0,
      need: 10,
    },
  ];

  return { checks, eligible: checks.every(c => c.ok), residentFastTrack };
}

export default { VERIFICATION_RULES, verificationChecklist };
