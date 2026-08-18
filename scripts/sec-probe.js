/**
 * sec-probe.js — NON-DESTRUCTIVE security probe against the live Supabase.
 *
 * Uses ONLY the public anon key (the same key baked into every app install) to
 * answer the question that actually matters: "if an attacker pulls the anon key
 * out of the app bundle, what can they read or write?"
 *
 * READ tests:  SELECT from sensitive tables — anything returned = exposed.
 * WRITE tests: update/delete with an impossible filter (0 rows touched) so we
 *              learn whether RLS *would* allow the write without changing data.
 *
 * Read-only / no-op by design. Run: node scripts/sec-probe.js
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const g = (k) => { const m = env.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim() : null; };
const URL = g('EXPO_PUBLIC_SUPABASE_URL');
const ANON = g('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const sb = createClient(URL, ANON, { auth: { persistSession: false } });

const IMPOSSIBLE = '00000000-0000-0000-0000-000000000000';

// Tables that should NEVER be readable by an anonymous (logged-out) user.
const PRIVATE_READ = [
  'messages', 'event_chat_messages', 'dm_rooms', 'wallet_transactions',
  'service_bookings', 'disputes', 'reel_reports', 'reports', 'muted_users',
  'user_blocks', 'security_logs', 'ai_user_memory', 'user_deep_profile',
  'event_rsvps', 'notifications', 'push_tokens', 'governance_votes',
  'business_invoice_requests', 'touch_downs', 'live_checkins', 'path_crossings',
];

// Public-ish tables — readable is fine, but check for leaked PII columns.
const PII_CHECK = {
  profiles: ['email', 'push_token', 'first_name', 'surname', 'age', 'emergency_contacts', 'siblings'],
  events: ['author_id'],
  live_checkins: ['lat', 'lon', 'ghost_alias'],
};

// Tables an anonymous user must NOT be able to write.
const WRITE_TABLES = ['profiles', 'events', 'event_rsvps', 'messages', 'wallet_transactions', 'reports', 'follows', 'business_invoice_requests'];

const RLS_DENIED = new Set(['42501', 'PGRST301']); // permission denied / JWT required

(async () => {
  console.log(`\n🔍 Security probe vs ${URL}\n   (anon key only — simulating an attacker with the public key)\n`);

  // ── 1. Anonymous READ exposure ──
  console.log('═══ 1. ANONYMOUS READ — private tables ═══');
  let exposedReads = 0;
  for (const t of PRIVATE_READ) {
    const { data, error } = await sb.from(t).select('*').limit(1);
    if (error) {
      const denied = RLS_DENIED.has(error.code) || /permission denied|rls|policy/i.test(error.message);
      console.log(`  ${denied ? '🔒 protected' : '⚠️  ' + error.code} ${t}${denied ? '' : ' — ' + error.message.slice(0, 50)}`);
    } else {
      const rows = data?.length || 0;
      if (rows > 0) { console.log(`  🔴 EXPOSED   ${t} — anon read ${rows} row(s): [${Object.keys(data[0]).slice(0, 6).join(', ')}…]`); exposedReads++; }
      else console.log(`  🟡 readable  ${t} — anon SELECT allowed but table empty (RLS likely open)`);
    }
  }

  // ── 2. PII column exposure ──
  console.log('\n═══ 2. PII COLUMN EXPOSURE (anon) ═══');
  let piiLeaks = 0;
  for (const [t, cols] of Object.entries(PII_CHECK)) {
    for (const c of cols) {
      const { data, error } = await sb.from(t).select(c).limit(1);
      if (!error) {
        const hasValue = data?.[0] && data[0][c] != null && data[0][c] !== '';
        if (hasValue) { console.log(`  🔴 LEAK     ${t}.${c} = ${JSON.stringify(data[0][c]).slice(0, 40)}`); piiLeaks++; }
        else console.log(`  🟢 column ${t}.${c} selectable (no value in sample row)`);
      }
    }
  }

  // ── 3. Anonymous WRITE (safe no-op probes) ──
  console.log('\n═══ 3. ANONYMOUS WRITE — should all be blocked ═══');
  let writable = 0;
  for (const t of WRITE_TABLES) {
    // UPDATE with impossible filter: touches 0 rows; reveals if RLS allows writes.
    const { error } = await sb.from(t).update({ updated_at: new Date().toISOString() }).eq('id', IMPOSSIBLE);
    if (error) {
      const denied = RLS_DENIED.has(error.code) || /permission denied|rls|policy|jwt/i.test(error.message);
      // 42703 (no updated_at col) or 0-row success both mean "not RLS-blocked"
      const colMiss = error.code === '42703';
      if (denied) console.log(`  🔒 blocked   ${t} (update denied by RLS)`);
      else console.log(`  ⚠️  ${error.code}  ${t} — ${error.message.slice(0, 45)} (not an RLS denial)`);
      if (!denied && !colMiss) writable++;
    } else {
      console.log(`  🔴 WRITABLE  ${t} — anon UPDATE not blocked by RLS`); writable++;
    }
  }

  // ── 4. Summary ──
  console.log('\n═══ SUMMARY ═══');
  console.log(`  🔴 Private tables exposed to anon read: ${exposedReads}`);
  console.log(`  🔴 PII values leaked to anon:           ${piiLeaks}`);
  console.log(`  🔴 Tables anon may write:               ${writable}`);
  if (exposedReads + piiLeaks + writable === 0) console.log('\n  ✅ No anonymous read/write/PII exposure detected via the anon key.');
  else console.log('\n  ⚠️  Findings above need RLS policies in Supabase (client code cannot fix this).');
})();
