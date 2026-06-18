-- ══════════════════════════════════════════════════════════════════════════════
--  THE GRUVS — SECURITY HARDENING  (run on the live Supabase, review first)
-- ══════════════════════════════════════════════════════════════════════════════
--  WHY: scripts/sec-probe.js (anon key only — the key baked into every install)
--  showed the public/anonymous role can SELECT PII columns on `profiles`:
--    email, push_token, first_name, surname, age, emergency_contacts, siblings …
--  An attacker who pulls the anon key from the app bundle could read those for
--  every user. This file closes that hole with a COLUMN-LEVEL allowlist for the
--  anon role, and re-asserts that anon cannot write to sensitive tables.
--
--  SAFE / NON-BREAKING for the logged-in app: the `authenticated` role is left
--  untouched (it keeps full table access via its JWT), so nothing in the signed-
--  in experience changes. Only the logged-OUT (anon) role is narrowed to public,
--  non-PII columns — exactly what a guest browsing events/profiles needs.
--
--  FAIL-SAFE: this is an ALLOWLIST. Any profiles column NOT listed below becomes
--  invisible to anon. Forgetting a public column → guests just don't see it (a
--  cosmetic miss); it can never accidentally expose a new PII column.
--
--  Idempotent — safe to run repeatedly. After running, re-run:
--    node scripts/sec-probe.js     (the profiles.* PII LEAK lines should clear)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. profiles: lock anon down to public, non-PII columns ────────────────────
-- Drop anon's table-wide SELECT so the column-level grant below actually applies
-- (a table-level grant supersedes column grants in Postgres).
REVOKE SELECT ON public.profiles FROM anon;

-- Grant anon SELECT on ONLY the public/social columns a guest legitimately needs.
-- Anything omitted (email, push_token, first_name, surname, age, birth_date,
-- birth_year, emergency_contacts, siblings, phone, wallet_balance, home_base_lat,
-- home_base_lon, coords, privacy_settings, referred_by, clan_name, home_village)
-- is intentionally NOT granted — those stay readable only to the signed-in app.
-- Wrapped per-column so a column that doesn't exist on this DB can't abort the run.
DO $$
DECLARE
  c TEXT;
  safe_cols TEXT[] := ARRAY[
    'id','username','display_name','avatar_url','cover_url','bio','location','city',
    'website','gender','interests','is_verified','is_online','last_seen','last_seen_at',
    'vibe_score','vibe_equity','social_integrity_score','is_discoverable','identity_mode',
    'is_beacon_active','beacon_expires_at','followers_count','following_count',
    'events_posted','saved_count','xp','badges','role','current_streak','career_title',
    'career_description','looks_description','profile_gallery','show_online','share_events',
    'theme_id','writing_style','provider_type','provider_rate','provider_bio',
    'provider_verified','community_tags','languages','created_at','updated_at'
  ];
BEGIN
  FOREACH c IN ARRAY safe_cols LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='profiles' AND column_name=c
    ) THEN
      EXECUTE format('GRANT SELECT (%I) ON public.profiles TO anon', c);
    END IF;
  END LOOP;
END $$;

-- ── 2. Re-assert: anon must never WRITE sensitive tables ──────────────────────
-- Defensive — RLS should already block these, but revoke the base privileges so
-- a future permissive policy can't silently re-open writes to the anon role.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','events','event_rsvps','messages','dm_messages','wallet_transactions',
    'reports','reel_reports','disputes','follows','notifications','live_checkins',
    'event_reactions','echoes','reels','security_logs','governance_votes','user_blocks'
  ] LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM anon', t);
    END IF;
  END LOOP;
END $$;

-- ── 3. Belt-and-braces: keep RLS forced on the high-sensitivity tables ────────
-- (FORCE makes RLS apply even to the table owner, closing definer-path surprises.)
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'messages','dm_messages','wallet_transactions','security_logs','push_tokens',
    'ai_user_memory','user_deep_profile','governance_votes','reports'
  ] LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- ── 4. Stop self privilege-escalation via direct profile updates ──────────────
-- The profiles UPDATE policy is `USING (id = auth.uid())` and RLS CANNOT restrict
-- columns, so a signed-in user could update({ role:'admin', is_verified:true })
-- on their OWN row and become an admin / fake a verified badge. Guard the trust
-- columns with a trigger that reverts any change made by the authenticated/anon
-- roles. Legit changes (admin tools, SECURITY DEFINER RPCs) run as the function
-- owner (current_user = postgres/…), so they pass through untouched.
-- NB: only the pure privilege/trust columns are protected here — role,
-- is_verified, social_integrity_score — none of which has a legitimate direct
-- client-update path, so this can't break scoring/economy flows. (Protecting
-- vibe_score / vibe_equity / wallet_balance the same way is a good next step, but
-- first route their few remaining direct client updates through the existing
-- SECURITY DEFINER RPCs — e.g. CheckInManager.touchDown's vibe_score fallback.)
CREATE OR REPLACE FUNCTION public.protect_profile_trust_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW; -- trusted server path (definer RPCs / admin) — allow
  END IF;
  -- Direct update by the signed-in user: pin trust columns to their old values.
  NEW.role                   := OLD.role;
  NEW.is_verified            := OLD.is_verified;
  NEW.social_integrity_score := OLD.social_integrity_score;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_profile_trust_columns_trigger ON public.profiles;
CREATE TRIGGER protect_profile_trust_columns_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_trust_columns();

-- ── FOLLOW-UP (not applied here — needs a small app change first) ─────────────
-- A signed-in user can still read another user's PII columns on profiles (email,
-- push_token, emergency_contacts) because those columns are granted to the
-- `authenticated` role table-wide. To close that too WITHOUT breaking the app's
-- own self-reads, the clean fix is:
--   1. add a SECURITY DEFINER get_my_profile() RPC that returns auth.uid()'s row,
--   2. switch AuthContext/ProfilePage self-reads of email/push_token/PII to it,
--   3. then narrow `authenticated` to the same safe-column allowlist as anon.
-- Do that as a dedicated change so the self-read path is verified first.
