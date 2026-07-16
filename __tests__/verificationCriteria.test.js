// A2 — the Verified engine's client criteria mirror. The server re-checks
// everything; these tests keep the UI checklist honest with the SQL rules.
import { verificationChecklist } from '../src/utils/verificationCriteria';

const NOW = Date.now();
const daysAgo = (d) => new Date(NOW - d * 86400000).toISOString();

const solid = {
  created_at: daysAgo(60),
  social_integrity_score: 70,
  vibe_score: 250,
};

describe('verificationChecklist', () => {
  it('all four criteria green → eligible', () => {
    const r = verificationChecklist(solid, 15, NOW);
    expect(r.checks.every(c => c.ok)).toBe(true);
    expect(r.eligible).toBe(true);
  });

  it('each unmet rule blocks eligibility and reports progress', () => {
    expect(verificationChecklist({ ...solid, created_at: daysAgo(5) }, 15, NOW).eligible).toBe(false);
    expect(verificationChecklist({ ...solid, social_integrity_score: 40 }, 15, NOW).eligible).toBe(false);
    expect(verificationChecklist({ ...solid, vibe_score: 50 }, 15, NOW).eligible).toBe(false);
    const r = verificationChecklist(solid, 3, NOW);
    expect(r.eligible).toBe(false);
    expect(r.checks.find(c => c.key === 'touchdowns')).toMatchObject({ ok: false, have: 3, need: 10 });
  });

  it('Resident trust fast-tracks presence (already vetted there)', () => {
    const r = verificationChecklist({ ...solid, resident_trust_tier: 'trusted' }, 0, NOW);
    expect(r.residentFastTrack).toBe(true);
    expect(r.checks.find(c => c.key === 'touchdowns').ok).toBe(true);
    expect(r.eligible).toBe(true);
  });

  it('null-safe: an empty profile is simply not eligible (never crashes)', () => {
    const r = verificationChecklist({}, 0, NOW);
    expect(r.eligible).toBe(false);
    expect(r.checks).toHaveLength(4);
    // unknown SIS defaults to 50 → below the 60 bar, not a free pass
    expect(r.checks.find(c => c.key === 'sis').ok).toBe(false);
  });
});
