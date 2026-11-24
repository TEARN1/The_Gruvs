// Rewards are decided by the database (supabase/migrations/
// 20261124200500_rewards_server_side.sql): the app must never write score,
// badges, streak, XP, coins, reputation or equity onto a profile itself.
// A write would be ignored by protect_profile_trust_columns anyway; this test
// keeps the app honest about it.

const fs = require('fs');
const path = require('path');

const LOCKED = ['vibe_score', 'badges', 'current_streak', 'xp', 'vibe_coins', 'reputation_status', 'vibe_equity'];

function files(dir, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) files(p, out);
    else if (/\.(js|jsx|ts|tsx)$/.test(f.name) && !/\.test\./.test(f.name)) out.push(p);
  }
  return out;
}

describe('rewards are server-side', () => {
  it('no screen or service writes a reward column onto profiles', () => {
    const offenders = [];
    for (const file of files(path.join(__dirname, '..', 'src'))) {
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(/from\(\s*['"]profiles['"]\s*\)\s*\.(update|upsert)\(\s*\{([^}]*)\}/g)) {
        const keys = [...m[2].matchAll(/([a-z_]+)\s*:/g)].map((k) => k[1]);
        const bad = keys.filter((k) => LOCKED.includes(k));
        if (bad.length) offenders.push(`${path.relative(process.cwd(), file)}: ${bad.join(', ')}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
