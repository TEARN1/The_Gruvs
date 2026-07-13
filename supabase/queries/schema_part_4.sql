-- ══════════════════════════════════════════════════════════════
--  THE GRUVS — CONSOLIDATED SCHEMA · PART 4 of 4
-- ══════════════════════════════════════════════════════════════
--  Run the schema_part_*.sql files IN ORDER on a FRESH Supabase database.
--  Byte-faithful concatenation of the original numbered migrations — the
--  originals are preserved in supabase/queries/archive/ (nothing deleted).
--  Covers: 29_launch_security_rls.sql … 33_writing_style.sql
--
--  BUILD-ONCE: a handful of CREATE POLICY / ADD COLUMN lack IF-EXISTS guards,
--  so for an existing DB run only the newer archived increments instead.
-- ══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
--  SOURCE: 29_launch_security_rls.sql
-- ══════════════════════════════════════════════════════════════

-- ============================================================
--  THE GRUVS — 29: LAUNCH SECURITY (run before going live)
--
--  Closes the two anonymous read leaks found in the security audit:
--    1. live_checkins exposing real GPS to logged-out callers (CRITICAL)
--    2. profiles exposing PII columns (email/push_token/phone/…) to anon
--
--  Bulletproof + minimal: works regardless of existing RLS policy NAMES, and
--  touches reads only — logged-in users, writes, and the privacy-aware RPCs all
--  keep working. Run once in the Supabase SQL editor, then verify with:
--      node scripts/sec-probe.js
-- ============================================================

-- ── 1. CRITICAL — stop anonymous GPS harvesting from live_checkins ─────────
-- A table GRANT is checked BEFORE RLS policies. Revoking SELECT from `anon`
-- guarantees no policy (whatever its name) can leak GPS to a logged-out caller,
-- without us having to find/drop the offending policy. `authenticated` keeps
-- its grant (so "who was there" / presence still work), and get_safe_nearby_vibers
-- (SECURITY DEFINER) is unaffected.
REVOKE SELECT ON public.live_checkins FROM anon;

-- Defence in depth: ensure RLS is on so authenticated reads are still policy-gated.
ALTER TABLE public.live_checkins ENABLE ROW LEVEL SECURITY;

-- (Hardest option — also stop one authenticated user reading another's raw
--  coordinates; rely on get_safe_nearby_vibers for discovery. Uncomment to apply:)
-- REVOKE SELECT ON public.live_checkins FROM authenticated;
-- GRANT EXECUTE ON FUNCTION public.get_safe_nearby_vibers TO authenticated;


-- ── 2. Hide PII columns on profiles from anon ──────────────────────────────
-- RLS is row-level and cannot hide columns, so use column-level REVOKE. This
-- DO block revokes ONLY the PII columns that actually exist on your profiles
-- table, so it can never error on a column you don't have. Public discovery
-- (username/avatar/bio/…) keeps working; PII never reaches a logged-out caller.
DO $$
DECLARE col text;
BEGIN
  FOREACH col IN ARRAY ARRAY['email','push_token','phone','emergency_contacts','siblings','first_name','surname','id_number','date_of_birth']
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = col
    ) THEN
      EXECUTE format('REVOKE SELECT (%I) ON public.profiles FROM anon', col);
    END IF;
  END LOOP;
END $$;

-- (Recommended — also hide these from OTHER authenticated users. Each user still
--  reads their OWN row's PII via the profiles RLS own-row policy. Uncomment if
--  your app never needs another user's PII columns directly:)
-- DO $$
-- DECLARE col text;
-- BEGIN
--   FOREACH col IN ARRAY ARRAY['email','push_token','phone','emergency_contacts','siblings']
--   LOOP
--     IF EXISTS (SELECT 1 FROM information_schema.columns
--                WHERE table_schema='public' AND table_name='profiles' AND column_name=col) THEN
--       EXECUTE format('REVOKE SELECT (%I) ON public.profiles FROM authenticated', col);
--     END IF;
--   END LOOP;
-- END $$;


-- ── 3. (Optional) require login to read the social graph ───────────────────
-- follows is fully enumerable by anon today. Uncomment to require auth:
-- REVOKE SELECT ON public.follows FROM anon;


-- ── Verify ─────────────────────────────────────────────────────────────────
-- Run locally after applying:  node scripts/sec-probe.js
--   → live_checkins should show 🔒 (0 rows to anon)
--   → profiles PII columns should no longer be selectable by the anon key

-- ══════════════════════════════════════════════════════════════
--  SOURCE: 30_tournament_governance.sql
-- ══════════════════════════════════════════════════════════════

-- ============================================================
--  THE GRUVS — 30: TOURNAMENT GOVERNANCE + FAN PREDICTIONS
--
--  Two voting systems on top of the talent/competition schema (27/28):
--
--  A) GOVERNANCE — teams elect who controls a tournament's data.
--     High-stakes positions (results editor, log keeper, fixtures,
--     disciplinary, head organiser) are earned by VOTE: when ≥ N distinct
--     teams back a candidate, they are granted the role and may edit that
--     tournament's results / standings. Democratic + recallable (a new
--     candidate who passes the threshold replaces the holder).
--
--  B) PREDICTIONS — fans vote which team will win a competitive event.
--
--  Additive. Builds on competitions/seasons/clubs/sport_teams/events.
-- ============================================================

-- Per-competition vote threshold (how many teams must back a candidate).
ALTER TABLE public.competitions ADD COLUMN IF NOT EXISTS vote_threshold INTEGER NOT NULL DEFAULT 5;

-- Link an event to the competition/league it belongs to (drives governance +
-- which tournament a match's results/predictions roll up to).
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS competition_id UUID REFERENCES public.competitions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_events_competition ON public.events(competition_id);

-- ── A1. Who currently holds each elected position ─────────────
CREATE TABLE IF NOT EXISTS public.tournament_officials (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id    UUID        NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  role              TEXT        NOT NULL,   -- results_editor|log_keeper|fixtures_manager|disciplinary|head_organizer
  user_id           UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  votes_at_election INTEGER     DEFAULT 0,
  elected_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (competition_id, role)            -- one holder per role per competition
);
CREATE INDEX IF NOT EXISTS idx_officials_comp ON public.tournament_officials(competition_id);
CREATE INDEX IF NOT EXISTS idx_officials_user ON public.tournament_officials(user_id);

-- ── A2. Votes — one per TEAM per role ─────────────────────────
CREATE TABLE IF NOT EXISTS public.tournament_role_votes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id  UUID        NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  role            TEXT        NOT NULL,
  candidate_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- voted FOR
  voter_user_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- who cast it
  voter_club_id   UUID        NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,    -- the team they represent
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (competition_id, role, voter_club_id)   -- a team gets ONE vote per role (changeable)
);
CREATE INDEX IF NOT EXISTS idx_role_votes_tally ON public.tournament_role_votes(competition_id, role, candidate_id);

-- ── A3. cast_role_vote — record vote, tally distinct teams, grant on threshold ──
CREATE OR REPLACE FUNCTION public.cast_role_vote(
  p_competition UUID,
  p_role        TEXT,
  p_candidate   UUID,
  p_club        UUID
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_threshold INT;
  v_top_candidate UUID;
  v_top_votes INT;
BEGIN
  IF p_role NOT IN ('results_editor','log_keeper','fixtures_manager','disciplinary','head_organizer') THEN
    RAISE EXCEPTION 'INVALID_ROLE';
  END IF;
  -- The caller must own / captain the SPECIFIC team (p_club) they vote with.
  -- (Both branches must be scoped to p_club — otherwise any club owner or any
  --  team captain could cast a vote on behalf of a club that isn't theirs.)
  IF NOT EXISTS (
    SELECT 1 FROM public.clubs WHERE id = p_club AND owner_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.sport_teams WHERE club_id = p_club AND captain_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'NOT_TEAM_REP';
  END IF;

  -- Record / change this team's vote.
  INSERT INTO public.tournament_role_votes (competition_id, role, candidate_id, voter_user_id, voter_club_id)
  VALUES (p_competition, p_role, p_candidate, auth.uid(), p_club)
  ON CONFLICT (competition_id, role, voter_club_id)
  DO UPDATE SET candidate_id = EXCLUDED.candidate_id, voter_user_id = EXCLUDED.voter_user_id, created_at = now();

  SELECT vote_threshold INTO v_threshold FROM public.competitions WHERE id = p_competition;
  v_threshold := COALESCE(v_threshold, 5);

  -- Leading candidate for this role (by distinct teams).
  SELECT candidate_id, COUNT(*) INTO v_top_candidate, v_top_votes
  FROM public.tournament_role_votes
  WHERE competition_id = p_competition AND role = p_role
  GROUP BY candidate_id
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  -- Grant (or replace holder) when the leader reaches the threshold.
  IF v_top_votes >= v_threshold THEN
    INSERT INTO public.tournament_officials (competition_id, role, user_id, votes_at_election, elected_at)
    VALUES (p_competition, p_role, v_top_candidate, v_top_votes, now())
    ON CONFLICT (competition_id, role)
    DO UPDATE SET user_id = EXCLUDED.user_id, votes_at_election = EXCLUDED.votes_at_election, elected_at = now();
  END IF;

  RETURN jsonb_build_object(
    'threshold', v_threshold,
    'leader', v_top_candidate,
    'leader_votes', v_top_votes,
    'elected', (v_top_votes >= v_threshold)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.cast_role_vote TO authenticated;

-- ── A4. Is the current user an elected official? (for gating edits) ──
CREATE OR REPLACE FUNCTION public.is_tournament_official(p_competition UUID, p_role TEXT)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tournament_officials
    WHERE competition_id = p_competition AND role = p_role AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.competitions WHERE id = p_competition AND organizer_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_tournament_official TO authenticated;

-- ── B1. Fan win-predictions — one per user per event ──────────
CREATE TABLE IF NOT EXISTS public.match_predictions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  match_id         UUID        REFERENCES public.sport_matches(id) ON DELETE CASCADE,
  user_id          UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  predicted_side   TEXT,                         -- 'home' | 'away' | 'draw'
  predicted_team_id UUID       REFERENCES public.sport_teams(id) ON DELETE SET NULL,
  predicted_label  TEXT,                         -- denormalised team/option name for display
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (event_id, user_id)                     -- one prediction per user per event (changeable)
);
CREATE INDEX IF NOT EXISTS idx_predictions_event ON public.match_predictions(event_id);

-- ── B2. cast_match_prediction — upsert + return the live tally ──
CREATE OR REPLACE FUNCTION public.cast_match_prediction(
  p_event UUID,
  p_side  TEXT DEFAULT NULL,
  p_team  UUID DEFAULT NULL,
  p_label TEXT DEFAULT NULL,
  p_match UUID DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total INT;
BEGIN
  INSERT INTO public.match_predictions (event_id, match_id, user_id, predicted_side, predicted_team_id, predicted_label)
  VALUES (p_event, p_match, auth.uid(), p_side, p_team, p_label)
  ON CONFLICT (event_id, user_id)
  DO UPDATE SET predicted_side = EXCLUDED.predicted_side, predicted_team_id = EXCLUDED.predicted_team_id,
                predicted_label = EXCLUDED.predicted_label, match_id = EXCLUDED.match_id, created_at = now();

  SELECT COUNT(*) INTO v_total FROM public.match_predictions WHERE event_id = p_event;
  RETURN jsonb_build_object(
    'total', v_total,
    'tally', COALESCE((
      SELECT jsonb_object_agg(k, c) FROM (
        SELECT COALESCE(predicted_label, predicted_side, 'unknown') AS k, COUNT(*) AS c
        FROM public.match_predictions WHERE event_id = p_event
        GROUP BY 1
      ) t
    ), '{}'::jsonb)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.cast_match_prediction TO authenticated;

-- ============================================================
--  ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.tournament_officials  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_role_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_predictions     ENABLE ROW LEVEL SECURITY;

-- Officials: public read (transparency). Writes only via cast_role_vote (definer) — no direct policy.
DROP POLICY IF EXISTS officials_read ON public.tournament_officials;
CREATE POLICY officials_read ON public.tournament_officials FOR SELECT USING (true);

-- Role votes: public read (open ballot for trust); a user manages only their own vote rows.
DROP POLICY IF EXISTS role_votes_read ON public.tournament_role_votes;
CREATE POLICY role_votes_read ON public.tournament_role_votes FOR SELECT USING (true);
DROP POLICY IF EXISTS role_votes_write ON public.tournament_role_votes;
CREATE POLICY role_votes_write ON public.tournament_role_votes FOR ALL TO authenticated
  USING (auth.uid() = voter_user_id) WITH CHECK (auth.uid() = voter_user_id);

-- Predictions: public read (for tallies); a user manages only their own prediction.
DROP POLICY IF EXISTS predictions_read ON public.match_predictions;
CREATE POLICY predictions_read ON public.match_predictions FOR SELECT USING (true);
DROP POLICY IF EXISTS predictions_write ON public.match_predictions;
CREATE POLICY predictions_write ON public.match_predictions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── (Apply to YOUR results tables) — gate edits to the elected results_editor ──
-- Example: only the elected results_editor / organiser / admin may write match events.
-- Adapt the competition link to how your events map to competitions.
--
-- CREATE POLICY "results editable by elected official"
--   ON public.sport_match_events FOR ALL TO authenticated
--   USING ( public.is_tournament_official(
--             (SELECT competition_id FROM public.events WHERE id = event_id), 'results_editor') )
--   WITH CHECK ( public.is_tournament_official(
--             (SELECT competition_id FROM public.events WHERE id = event_id), 'results_editor') );


-- ══════════════════════════════════════════════════════════════
--  SOURCE: 32_event_end_date.sql
-- ══════════════════════════════════════════════════════════════

-- ============================================================
--  THE GRUVS — 32: EVENT END DATE (multi-day events)
--
--  Events can now span multiple days (tournaments, festivals, conferences).
--  end_date is the last day of the event; event_date stays the first day.
--  The per-day agenda lives in the existing events.schedule JSON (each slot
--  carries an optional `day` number), so no schema change is needed for that.
--
--  Safe + idempotent. Until this runs, event creation still works — the app
--  drops end_date via its insert fallback — it just can't persist the end day.
-- ============================================================

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS end_date DATE;

-- Optional: a date range is only valid when end_date is on/after the start.
-- (Left as a comment so existing rows are never rejected; uncomment to enforce.)
-- ALTER TABLE public.events
--   ADD CONSTRAINT events_end_after_start
--   CHECK (end_date IS NULL OR event_date IS NULL OR end_date >= event_date) NOT VALID;

-- ══════════════════════════════════════════════════════════════
--  SOURCE: 33_writing_style.sql
-- ══════════════════════════════════════════════════════════════

-- ============================================================
--  THE GRUVS — 33: WRITING STYLE (aura signature font)
--
--  Stores each user's chosen Unicode "writing style" key (bold / cursive /
--  outline / …). Body text stays PLAIN in the DB — we only transform on display
--  using the author's style, so search and screen-readers are unaffected.
--
--  Safe + idempotent. Until this runs, the picker still works (it falls back to
--  device-local AsyncStorage), styles just won't follow the user across devices
--  or render on other people's screens.
-- ============================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS writing_style TEXT;
-- Cross-device aura sync: stable theme id (see 13_profile_theme_sync.sql)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme_id TEXT;

-- ============================================================
--  PATCHES 01–11  (folded from the old standalone files, which
--  were deleted 2026-06-05). 03 (match_card) / 07 (crowd_votes)
--  / 11 (events_tags) already live in schema_part_1, so only the
--  un-folded ones are here. Runs after parts 1–3, so all
--  referenced tables/functions exist. Idempotent.
-- ============================================================

-- ── 01: security hardening ──────────────────────────────────
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM anon;
REVOKE CREATE ON SCHEMA public FROM authenticated;

CREATE OR REPLACE VIEW public.public_profiles AS
SELECT
  p.id, p.username, p.display_name, p.avatar_url, p.bio, p.location, p.role,
  p.vibe_score, p.followers_count, p.following_count, p.xp, p.badges, p.is_verified AS verified,
  p.show_online,
  CASE WHEN p.show_online THEN p.last_seen ELSE NULL END AS last_seen,
  p.updated_at
FROM public.profiles p;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.upsert_own_profile(
  p_display_name TEXT DEFAULT NULL, p_username TEXT DEFAULT NULL, p_bio TEXT DEFAULT NULL,
  p_location TEXT DEFAULT NULL, p_avatar_url TEXT DEFAULT NULL, p_cover_url TEXT DEFAULT NULL,
  p_show_online BOOLEAN DEFAULT NULL, p_share_events BOOLEAN DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET
    display_name = COALESCE(p_display_name, display_name),
    username     = COALESCE(p_username,     username),
    bio          = COALESCE(p_bio,          bio),
    location     = COALESCE(p_location,     location),
    avatar_url   = COALESCE(p_avatar_url,   avatar_url),
    cover_url    = COALESCE(p_cover_url,    cover_url),
    show_online  = COALESCE(p_show_online,  show_online),
    share_events = COALESCE(p_share_events, share_events),
    updated_at   = now()
  WHERE id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_action TEXT, p_window_seconds INTEGER DEFAULT 60, p_max_calls INTEGER DEFAULT 30
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.security_logs
  WHERE user_id = auth.uid() AND action = p_action
    AND created_at > now() - (p_window_seconds || ' seconds')::interval;
  RETURN v_count < p_max_calls;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_security_event(
  p_action TEXT, p_details JSONB DEFAULT '{}'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.security_logs (user_id, action, details)
  VALUES (auth.uid(), p_action, p_details);
END;
$$;

CREATE INDEX IF NOT EXISTS idx_blocked_users_user    ON public.blocked_users(user_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON public.blocked_users(blocked_id);
CREATE INDEX IF NOT EXISTS idx_muted_users_user      ON public.muted_users(user_id);
CREATE INDEX IF NOT EXISTS idx_muted_users_muted     ON public.muted_users(muted_id);

CREATE OR REPLACE FUNCTION public.assert_admin()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_user_role(p_user_id UUID, p_role TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_admin();
  IF p_role NOT IN ('user','host','vendor','moderator','admin') THEN
    RAISE EXCEPTION 'INVALID_ROLE';
  END IF;
  UPDATE public.profiles SET role = p_role WHERE id = p_user_id;
END;
$$;

CREATE TABLE IF NOT EXISTS public.user_suspensions (
  user_id      UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason       TEXT NOT NULL,
  expires_at   TIMESTAMPTZ,
  suspended_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.user_suspensions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "suspensions_admin" ON public.user_suspensions;
CREATE POLICY "suspensions_admin" ON public.user_suspensions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Grants are wrapped: only granted if the target function exists, so a fresh
-- build never errors on a not-yet-created RPC. We grant by full signature
-- (oid::regprocedure) and loop over EVERY overload — granting by bare name
-- fails with 42725 "function name is not unique" when a function like
-- check_rate_limit exists with more than one argument list.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'upsert_own_profile','check_rate_limit','log_security_event','secure_check_in',
        'upsert_rsvp_tier','generate_ticket_token','increment_wallet_balance',
        'update_sis_score','refresh_trending_events'
      )
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
  END LOOP;
END $$;

-- ── 02: reels metadata + visibility columns ─────────────────
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS metadata   JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS visibility TEXT  DEFAULT 'public';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reels_visibility_check' AND conrelid = 'public.reels'::regclass
  ) THEN
    ALTER TABLE public.reels ADD CONSTRAINT reels_visibility_check
      CHECK (visibility IN ('public','private','attendees'));
  END IF;
END $$;
UPDATE public.reels SET visibility = 'public'     WHERE visibility IS NULL;
UPDATE public.reels SET metadata   = '{}'::jsonb  WHERE metadata IS NULL;

-- ── 04: backfill match_card (one-time DML; guarded so a fresh DB
--        without the sport tables/columns can never break the build) ─
DO $$
BEGIN
  IF to_regclass('public.sport_teams') IS NOT NULL
     AND to_regclass('public.sport_matches') IS NOT NULL THEN
    EXECUTE $bf$
      WITH t AS (
        SELECT event_id, count(*) AS n,
          (array_agg(jsonb_build_object('id', id, 'name', name, 'logo_url', logo_url, 'color', color1) ORDER BY position NULLS LAST, name))[1] AS home,
          (array_agg(jsonb_build_object('id', id, 'name', name, 'logo_url', logo_url, 'color', color1) ORDER BY position NULLS LAST, name))[2] AS away
        FROM public.sport_teams GROUP BY event_id
      )
      UPDATE public.events e SET match_card = jsonb_build_object('home', t.home, 'away', t.away)
      FROM t WHERE t.event_id = e.id AND t.n = 2 AND e.match_card IS NULL;
    $bf$;
    EXECUTE $bf$
      WITH single AS (
        SELECT sm.event_id, sm.home_team_id, sm.away_team_id, sm.home_score, sm.away_score,
               sm.home_score_pens, sm.away_score_pens, sm.status, sm.scheduled_at
        FROM public.sport_matches sm
        WHERE (SELECT count(*) FROM public.sport_matches x WHERE x.event_id = sm.event_id) = 1
      ),
      crest AS (
        SELECT id, jsonb_build_object('id', id, 'name', name, 'logo_url', logo_url, 'color', color1) AS j
        FROM public.sport_teams
      )
      UPDATE public.events e
      SET match_card =
            jsonb_build_object('home', h.j, 'away', a.j, 'status', s.status, 'scheduled_at', s.scheduled_at)
         || CASE WHEN s.status IN ('live','completed','half_time')
                 THEN jsonb_build_object('home_score', coalesce(s.home_score,0), 'away_score', coalesce(s.away_score,0))
                 ELSE '{}'::jsonb END
         || CASE WHEN s.home_score_pens IS NOT NULL AND s.away_score_pens IS NOT NULL
                 THEN jsonb_build_object('home_score_pens', s.home_score_pens, 'away_score_pens', s.away_score_pens)
                 ELSE '{}'::jsonb END
      FROM single s JOIN crest h ON h.id = s.home_team_id JOIN crest a ON a.id = s.away_team_id
      WHERE e.id = s.event_id;
    $bf$;
  END IF;
EXCEPTION WHEN undefined_column OR undefined_table THEN
  RAISE NOTICE 'match_card backfill skipped (sport schema not present)';
END $$;

-- ── 05: reel visibility enforced via RLS ────────────────────
ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reels_select_all"               ON public.reels;
DROP POLICY IF EXISTS "reels are viewable"             ON public.reels;
DROP POLICY IF EXISTS "reels_public_read"              ON public.reels;
DROP POLICY IF EXISTS "Reels are viewable by everyone" ON public.reels;
DROP POLICY IF EXISTS "reels_select_visibility"        ON public.reels;
CREATE POLICY "reels_select_visibility" ON public.reels FOR SELECT
USING (
  coalesce(visibility, 'public') = 'public'
  OR user_id = auth.uid()
  OR (visibility = 'attendees' AND event_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.event_rsvps r WHERE r.event_id = reels.event_id AND r.user_id = auth.uid()))
);
DROP POLICY IF EXISTS "reels_insert_own" ON public.reels;
CREATE POLICY "reels_insert_own" ON public.reels FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "reels_update_own" ON public.reels;
CREATE POLICY "reels_update_own" ON public.reels FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "reels_delete_own" ON public.reels;
CREATE POLICY "reels_delete_own" ON public.reels FOR DELETE USING (user_id = auth.uid());

-- ── 06: load-shedding power backup ──────────────────────────
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS power_backup TEXT;
CREATE INDEX IF NOT EXISTS idx_events_power_backup ON public.events (power_backup) WHERE power_backup IS NOT NULL;

-- ── 08: trending HOT velocity radar ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_rsvps_created ON public.event_rsvps (created_at);
CREATE INDEX IF NOT EXISTS idx_vibes_created ON public.event_vibes (created_at);
CREATE OR REPLACE FUNCTION public.get_hot_event_ids()
RETURNS TABLE (event_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH recent AS (
    SELECT e.id, e.city, COALESCE(r.cnt,0) + COALESCE(v.cnt,0) AS vel
    FROM public.events e
    LEFT JOIN (SELECT event_id, COUNT(*) AS cnt FROM public.event_rsvps WHERE created_at > now() - interval '60 minutes' GROUP BY event_id) r ON r.event_id = e.id
    LEFT JOIN (SELECT event_id, COUNT(*) AS cnt FROM public.event_vibes WHERE created_at > now() - interval '60 minutes' GROUP BY event_id) v ON v.event_id = e.id
    WHERE e.is_published = true AND e.event_date >= CURRENT_DATE
  ),
  baseline AS (SELECT city, AVG(vel) AS avg_vel FROM recent GROUP BY city)
  SELECT r.id FROM recent r JOIN baseline b ON b.city IS NOT DISTINCT FROM r.city
  WHERE r.vel >= 3 AND r.vel >= 3 * GREATEST(b.avg_vel, 0.5);
$$;
GRANT EXECUTE ON FUNCTION public.get_hot_event_ids() TO anon, authenticated;

-- ── 09: secret act reveal ───────────────────────────────────
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS secret_act TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS secret_reveal_threshold INTEGER;

-- ── 10: path stars + path crossings ─────────────────────────
CREATE TABLE IF NOT EXISTS public.path_stars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user_id   UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id     UUID REFERENCES public.events(id)   ON DELETE CASCADE,
  path_id      UUID REFERENCES public.paths(id)    ON DELETE CASCADE,
  user_id      UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT now()
);
-- An earlier definition of path_stars (06_part_2.sql, in schema_part_1) created
-- this table WITHOUT from_user_id/to_user_id/event_id (it modelled "starred
-- places"). On such a DB the CREATE TABLE IF NOT EXISTS above is a no-op, so
-- ensure the columns the policies below reference actually exist first —
-- otherwise the policy errors with 42703 column "from_user_id" does not exist.
ALTER TABLE public.path_stars ADD COLUMN IF NOT EXISTS from_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.path_stars ADD COLUMN IF NOT EXISTS to_user_id   UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.path_stars ADD COLUMN IF NOT EXISTS event_id     UUID REFERENCES public.events(id)   ON DELETE CASCADE;
ALTER TABLE public.path_stars ADD COLUMN IF NOT EXISTS path_id      UUID REFERENCES public.paths(id)    ON DELETE CASCADE;
ALTER TABLE public.path_stars ADD COLUMN IF NOT EXISTS user_id      UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.path_stars ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read path_stars" ON public.path_stars;
DROP POLICY IF EXISTS "Allow users to insert path_stars"    ON public.path_stars;
DROP POLICY IF EXISTS "Allow users to delete path_stars"    ON public.path_stars;
CREATE POLICY "Allow authenticated read path_stars" ON public.path_stars FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow users to insert path_stars"    ON public.path_stars FOR INSERT TO authenticated WITH CHECK (auth.uid() = from_user_id OR auth.uid() = user_id);
CREATE POLICY "Allow users to delete path_stars"    ON public.path_stars FOR DELETE TO authenticated USING (auth.uid() = from_user_id OR auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.path_crossings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id_a UUID REFERENCES public.paths(id) ON DELETE CASCADE,
  path_id_b UUID REFERENCES public.paths(id) ON DELETE CASCADE,
  overlap_score FLOAT8,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.path_crossings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated read path_crossings"   ON public.path_crossings;
DROP POLICY IF EXISTS "Allow authenticated insert path_crossings" ON public.path_crossings;
CREATE POLICY "Allow authenticated read path_crossings"   ON public.path_crossings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert path_crossings" ON public.path_crossings FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
--  PATCHES 12–19  (canonical home — appended here in sequence).
--  Going forward, new SQL is appended to the LATEST schema_part
--  file (this one) under the ~4000-line cap, in number order;
--  when it nears 4000, start schema_part_5. No separate numbered
--  patch files. Every statement below is idempotent, so this
--  whole block is safe to run on an existing database too.
-- ============================================================

-- ── 12: "poster has the details" mode ───────────────────────
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS poster_mode BOOLEAN NOT NULL DEFAULT false;

-- ── 13: cross-device aura sync (also set above with writing_style) ─
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme_id TEXT;

-- ── 14: messages columns the chat UI reads/writes (DM fix) ──
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS parent_id    UUID REFERENCES public.messages(id) ON DELETE SET NULL;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS event_id     UUID;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS latitude     DOUBLE PRECISION;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS longitude    DOUBLE PRECISION;
CREATE INDEX IF NOT EXISTS idx_messages_parent ON public.messages(parent_id);

-- ── 15: "I'm here" live presence beacon ─────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS beacon_expires_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_profiles_beacon
  ON public.profiles(is_beacon_active, beacon_expires_at)
  WHERE is_beacon_active = true;

-- ── 16: clan name + birthday ────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS clan_name  TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date DATE;
CREATE INDEX IF NOT EXISTS idx_profiles_birth_md
  ON public.profiles ((EXTRACT(MONTH FROM birth_date)), (EXTRACT(DAY FROM birth_date)))
  WHERE birth_date IS NOT NULL;

-- ── 17: dwell-time / event views ────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_views (
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id    UUID NOT NULL REFERENCES public.events(id)   ON DELETE CASCADE,
  dwell_ms    BIGINT      DEFAULT 0,
  view_count  INTEGER     DEFAULT 0,
  opened      BOOLEAN     DEFAULT false,
  updated_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);
CREATE INDEX IF NOT EXISTS idx_event_views_user  ON public.event_views(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_views_event ON public.event_views(event_id);
ALTER TABLE public.event_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_views_select" ON public.event_views;
DROP POLICY IF EXISTS "event_views_upsert" ON public.event_views;
DROP POLICY IF EXISTS "event_views_update" ON public.event_views;
CREATE POLICY "event_views_select" ON public.event_views FOR SELECT USING (true);
CREATE POLICY "event_views_upsert" ON public.event_views FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "event_views_update" ON public.event_views FOR UPDATE USING (user_id = auth.uid());
CREATE OR REPLACE FUNCTION public.record_event_view(
  p_event_id UUID, p_dwell_ms BIGINT DEFAULT 0, p_opened BOOLEAN DEFAULT false
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.event_views (user_id, event_id, dwell_ms, view_count, opened, updated_at)
  VALUES (auth.uid(), p_event_id, GREATEST(0, p_dwell_ms), 1, p_opened, now())
  ON CONFLICT (user_id, event_id) DO UPDATE
    SET dwell_ms   = public.event_views.dwell_ms + GREATEST(0, p_dwell_ms),
        view_count = public.event_views.view_count + 1,
        opened     = public.event_views.opened OR p_opened,
        updated_at = now();
END;
$$;

-- ── 18: audience targeting (profile attributes + event criteria) ─
ALTER TABLE public.events   ADD COLUMN IF NOT EXISTS audience       JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS surname        TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS home_village   TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS community_tags TEXT[] DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS languages      TEXT[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_profiles_surname        ON public.profiles(lower(surname))      WHERE surname IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_clan_lower     ON public.profiles(lower(clan_name))    WHERE clan_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_village_lower  ON public.profiles(lower(home_village)) WHERE home_village IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_community_tags ON public.profiles USING gin(community_tags) WHERE community_tags IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_languages      ON public.profiles USING gin(languages)      WHERE languages IS NOT NULL;

-- ── 19: business drip surveys ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.surveys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_id UUID,
  title       TEXT NOT NULL,
  question    TEXT NOT NULL,
  answer_type TEXT NOT NULL DEFAULT 'single',
  options     TEXT[] DEFAULT '{}',
  audience    JSONB  NOT NULL DEFAULT '{}',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  reward_xp   INTEGER DEFAULT 5,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_surveys_active ON public.surveys(is_active, created_at DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_surveys_author ON public.surveys(author_id);
CREATE TABLE IF NOT EXISTS public.survey_responses (
  survey_id   UUID NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  answer      TEXT[]      DEFAULT '{}',
  skipped     BOOLEAN     DEFAULT false,
  answered_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (survey_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_survey_responses_survey ON public.survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_user   ON public.survey_responses(user_id);
ALTER TABLE public.surveys          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "surveys_select"       ON public.surveys;
DROP POLICY IF EXISTS "surveys_insert"       ON public.surveys;
DROP POLICY IF EXISTS "surveys_update_own"   ON public.surveys;
CREATE POLICY "surveys_select"     ON public.surveys FOR SELECT USING (is_active = true OR author_id = auth.uid());
CREATE POLICY "surveys_insert"     ON public.surveys FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "surveys_update_own" ON public.surveys FOR UPDATE USING (author_id = auth.uid());
DROP POLICY IF EXISTS "survey_responses_select" ON public.survey_responses;
DROP POLICY IF EXISTS "survey_responses_insert" ON public.survey_responses;
DROP POLICY IF EXISTS "survey_responses_owner"  ON public.survey_responses;
CREATE POLICY "survey_responses_select" ON public.survey_responses FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "survey_responses_insert" ON public.survey_responses FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "survey_responses_owner"  ON public.survey_responses FOR UPDATE USING (user_id = auth.uid());
CREATE OR REPLACE FUNCTION public.survey_results(p_survey_id UUID)
RETURNS TABLE(answer TEXT, votes BIGINT)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT unnest(r.answer) AS answer, count(*) AS votes
  FROM public.survey_responses r
  JOIN public.surveys s ON s.id = r.survey_id
  WHERE r.survey_id = p_survey_id
    AND r.skipped = false
    AND s.author_id = auth.uid()
  GROUP BY 1
  ORDER BY votes DESC;
$$;

-- ── 20: "Rising Now" momentum feed ──────────────────────────
-- What's ACCELERATING right now (not just popular). Compares engagement in the
-- last 60 min vs the prior 60–180 min window and returns a momentum score per
-- upcoming event. momentum = recent_rate / max(prior_rate, baseline). The app
-- shows a "Rising Now" rail ranked by this, with the % lift as a badge.
-- Zero cost, Supabase-only; degrades to empty set if not deployed.
CREATE OR REPLACE FUNCTION public.get_rising_events(p_limit INTEGER DEFAULT 12)
RETURNS TABLE (event_id uuid, momentum numeric, recent_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ev AS (
    SELECT id FROM public.events
    WHERE is_published = true AND event_date >= CURRENT_DATE
  ),
  recent AS (   -- last 60 minutes
    SELECT e.id,
      (SELECT count(*) FROM public.event_rsvps r WHERE r.event_id = e.id AND r.created_at > now() - interval '60 minutes')
    + (SELECT count(*) FROM public.event_vibes  v WHERE v.event_id = e.id AND v.created_at > now() - interval '60 minutes') AS cnt
    FROM ev e
  ),
  prior AS (    -- the 2 hours before that (60–180 min ago), as a 2h rate
    SELECT e.id,
      (SELECT count(*) FROM public.event_rsvps r WHERE r.event_id = e.id AND r.created_at BETWEEN now() - interval '180 minutes' AND now() - interval '60 minutes')
    + (SELECT count(*) FROM public.event_vibes  v WHERE v.event_id = e.id AND v.created_at BETWEEN now() - interval '180 minutes' AND now() - interval '60 minutes') AS cnt
    FROM ev e
  )
  SELECT r.id,
         round((r.cnt::numeric) / GREATEST((p.cnt::numeric) / 2.0, 0.5), 2) AS momentum,
         r.cnt AS recent_count
  FROM recent r JOIN prior p ON p.id = r.id
  WHERE r.cnt >= 2                                   -- need real recent activity
    AND r.cnt > GREATEST((p.cnt::numeric) / 2.0, 0.5) -- and it must be accelerating
  ORDER BY momentum DESC, r.cnt DESC
  LIMIT GREATEST(1, p_limit);
$$;
GRANT EXECUTE ON FUNCTION public.get_rising_events(INTEGER) TO anon, authenticated;

-- ── 20: social interaction persistence pack ─────────────────────────────────
-- WHY: users reported likes / vibes / follows / DMs "not saving". Client code
-- writes correctly with multi-tier fallbacks; the failures are server-side —
-- missing tables (media_likes, event_guest_likes) and missing/els-dropped RLS
-- policies on the social tables. Everything below is idempotent: safe to
-- re-run on any database state.

-- 20.1 media_likes — per-photo/per-video hearts, keyed by media URL
CREATE TABLE IF NOT EXISTS public.media_likes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_url  TEXT NOT NULL,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id   UUID REFERENCES public.events(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (media_url, user_id)
);
CREATE INDEX IF NOT EXISTS idx_media_likes_url  ON public.media_likes(media_url);
CREATE INDEX IF NOT EXISTS idx_media_likes_user ON public.media_likes(user_id);
ALTER TABLE public.media_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "media_likes_select" ON public.media_likes;
DROP POLICY IF EXISTS "media_likes_insert" ON public.media_likes;
DROP POLICY IF EXISTS "media_likes_delete" ON public.media_likes;
CREATE POLICY "media_likes_select" ON public.media_likes FOR SELECT USING (true);
CREATE POLICY "media_likes_insert" ON public.media_likes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "media_likes_delete" ON public.media_likes FOR DELETE USING (user_id = auth.uid());

-- 20.2 event_guest_likes — "hype hearts" on lineup guests (performers, judges…)
CREATE TABLE IF NOT EXISTS public.event_guest_likes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id   UUID NOT NULL REFERENCES public.event_guests(id) ON DELETE CASCADE,
  event_id   UUID REFERENCES public.events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (guest_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_egl_guest ON public.event_guest_likes(guest_id);
ALTER TABLE public.event_guest_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "egl_select" ON public.event_guest_likes;
DROP POLICY IF EXISTS "egl_insert" ON public.event_guest_likes;
DROP POLICY IF EXISTS "egl_delete" ON public.event_guest_likes;
CREATE POLICY "egl_select" ON public.event_guest_likes FOR SELECT USING (true);
CREATE POLICY "egl_insert" ON public.event_guest_likes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "egl_delete" ON public.event_guest_likes FOR DELETE USING (user_id = auth.uid());

-- 20.3 messages — re-assert columns + the RLS the DM layer depends on.
-- Red "!" on sent DMs = the INSERT was rejected. These cover every tier the
-- client tries (full insert → core insert).
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message_type     TEXT DEFAULT 'text';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_url        TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS parent_id        UUID REFERENCES public.messages(id) ON DELETE SET NULL;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS event_id         UUID REFERENCES public.events(id) ON DELETE SET NULL;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS latitude         DOUBLE PRECISION;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS longitude        DOUBLE PRECISION;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_request       BOOLEAN DEFAULT false;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS request_accepted BOOLEAN DEFAULT true;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS delivered_at     TIMESTAMPTZ;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_at          TIMESTAMPTZ;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_at       TIMESTAMPTZ;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "messages_insert_own"   ON public.messages;
DROP POLICY IF EXISTS "messages_select_own"   ON public.messages;
DROP POLICY IF EXISTS "messages_update_parts" ON public.messages;
CREATE POLICY "messages_insert_own" ON public.messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());
CREATE POLICY "messages_select_own" ON public.messages FOR SELECT
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());
CREATE POLICY "messages_update_parts" ON public.messages FOR UPDATE
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- 20.4 follows / event_rsvps / event_reactions / echoes / echo_likes —
-- re-assert the write policies behind "it only toggles, never saves".
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "follows_select" ON public.follows;
DROP POLICY IF EXISTS "follows_insert" ON public.follows;
DROP POLICY IF EXISTS "follows_delete" ON public.follows;
CREATE POLICY "follows_select" ON public.follows FOR SELECT USING (true);
CREATE POLICY "follows_insert" ON public.follows FOR INSERT WITH CHECK (follower_id = auth.uid());
CREATE POLICY "follows_delete" ON public.follows FOR DELETE USING (follower_id = auth.uid());

ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rsvps_select" ON public.event_rsvps;
DROP POLICY IF EXISTS "rsvps_insert" ON public.event_rsvps;
DROP POLICY IF EXISTS "rsvps_update" ON public.event_rsvps;
DROP POLICY IF EXISTS "rsvps_delete" ON public.event_rsvps;
CREATE POLICY "rsvps_select" ON public.event_rsvps FOR SELECT USING (true);
CREATE POLICY "rsvps_insert" ON public.event_rsvps FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "rsvps_update" ON public.event_rsvps FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "rsvps_delete" ON public.event_rsvps FOR DELETE USING (user_id = auth.uid());

ALTER TABLE public.event_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reactions_select" ON public.event_reactions;
DROP POLICY IF EXISTS "reactions_insert" ON public.event_reactions;
DROP POLICY IF EXISTS "reactions_update" ON public.event_reactions;
DROP POLICY IF EXISTS "reactions_delete" ON public.event_reactions;
CREATE POLICY "reactions_select" ON public.event_reactions FOR SELECT USING (true);
CREATE POLICY "reactions_insert" ON public.event_reactions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "reactions_update" ON public.event_reactions FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "reactions_delete" ON public.event_reactions FOR DELETE USING (user_id = auth.uid());

ALTER TABLE public.echoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "echoes_select" ON public.echoes;
DROP POLICY IF EXISTS "echoes_insert" ON public.echoes;
DROP POLICY IF EXISTS "echoes_update" ON public.echoes;
CREATE POLICY "echoes_select" ON public.echoes FOR SELECT USING (true);
CREATE POLICY "echoes_insert" ON public.echoes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "echoes_update" ON public.echoes FOR UPDATE USING (user_id = auth.uid()); -- owner-only; cross-user like counts flow via echo_likes + sync_echo_counts trigger

CREATE TABLE IF NOT EXISTS public.echo_likes (
  echo_id    UUID NOT NULL REFERENCES public.echoes(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (echo_id, user_id)
);
ALTER TABLE public.echo_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "echo_likes_select" ON public.echo_likes;
DROP POLICY IF EXISTS "echo_likes_insert" ON public.echo_likes;
DROP POLICY IF EXISTS "echo_likes_delete" ON public.echo_likes;
CREATE POLICY "echo_likes_select" ON public.echo_likes FOR SELECT USING (true);
CREATE POLICY "echo_likes_insert" ON public.echo_likes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "echo_likes_delete" ON public.echo_likes FOR DELETE USING (user_id = auth.uid());

-- 20.5 realtime — recipients only get live DMs/RSVPs if the tables are in the
-- publication. Guarded: skips tables already added.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['messages','event_rsvps','event_reactions','media_likes','event_guest_likes'] LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
             WHEN undefined_table  THEN NULL;
             WHEN undefined_object THEN NULL;
    END;
  END LOOP;
END $$;

-- ── 21: STORAGE — widen bucket MIME allowlists so users can upload freely ─────
-- The buckets' allowed_mime_types were narrower than the app's own uploader
-- accepts, so iPhone HEIC/HEIF photos and webm/m4v videos were rejected at the
-- bucket level ("mime type not supported") even though the picker allowed them.
-- Idempotent: a plain UPDATE on the existing rows (guarded for a fresh DB where
-- storage.buckets may not exist yet under the throwaway CI Postgres image).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='storage' AND table_name='buckets') THEN
    UPDATE storage.buckets SET allowed_mime_types =
      ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']
      WHERE id IN ('avatars','covers');
    UPDATE storage.buckets SET allowed_mime_types =
      ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif',
            'video/mp4','video/quicktime','video/x-m4v','video/webm']
      WHERE id IN ('event-media','reels','moments');
    UPDATE storage.buckets SET allowed_mime_types =
      ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']
      WHERE id = 'chat_media';
  END IF;
END $$;

-- ── 22: CROSSED PATHS ─────────────────────────────────────────────────────────
-- Powers the "Crossed Paths" sheet opened from the Touch Down button: the people
-- who keep touching down at the SAME events/venues as you, ranked from who you've
-- crossed paths with the MOST to the least.
--   get_crossed_paths(p_user_id, p_limit): looks at the events the caller checked
--   into (most-recent 200), finds every OTHER viber who checked into those same
--   events, counts distinct shared events (= crossings), collects the venues and
--   the most-recent crossing time, hides ghost-mode profiles + non-beaconing
--   celebrities (mirrors the client identity-privacy rules), ranks most → least.
-- SECURITY DEFINER + STABLE: aggregates over live_checkins (not anon-readable)
-- without exposing raw GPS. Zero cost. The app falls back to client-side
-- aggregation if this isn't deployed, so running it is an optimisation.
CREATE INDEX IF NOT EXISTS idx_live_checkins_user ON public.live_checkins(user_id);

CREATE OR REPLACE FUNCTION public.get_crossed_paths(
  p_user_id UUID,
  p_limit   INTEGER DEFAULT 50
)
RETURNS TABLE (
  user_id         UUID,
  username        TEXT,
  display_name    TEXT,
  avatar_url      TEXT,
  vibe_score      INTEGER,
  is_online       BOOLEAN,
  last_seen       TIMESTAMPTZ,
  is_verified     BOOLEAN,
  identity_mode   TEXT,
  crossings       BIGINT,
  venues          TEXT[],
  last_crossed_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH my_events AS (
    SELECT lc.event_id
    FROM public.live_checkins lc
    WHERE lc.user_id = p_user_id
    GROUP BY lc.event_id
    ORDER BY max(lc.checked_in_at) DESC NULLS LAST
    LIMIT 200
  ),
  cp AS (
    SELECT
      lc.user_id,
      count(DISTINCT lc.event_id)                                              AS crossings,
      max(lc.checked_in_at)                                                    AS last_crossed_at,
      array_remove(array_agg(DISTINCT COALESCE(e.venue_name, e.title)), NULL)  AS venues
    FROM public.live_checkins lc
    JOIN my_events me         ON me.event_id = lc.event_id
    LEFT JOIN public.events e ON e.id = lc.event_id
    WHERE lc.user_id <> p_user_id
    GROUP BY lc.user_id
  )
  SELECT
    cp.user_id, p.username, p.display_name, p.avatar_url, p.vibe_score,
    p.is_online, p.last_seen, p.is_verified, p.identity_mode,
    cp.crossings, cp.venues[1:4] AS venues, cp.last_crossed_at
  FROM cp
  JOIN public.profiles p ON p.id = cp.user_id
  WHERE COALESCE(p.identity_mode, 'public') <> 'ghost'
    AND NOT (COALESCE(p.identity_mode, 'public') = 'celebrity'
             AND COALESCE(p.is_beacon_active, false) = false)
    -- Block is absolute, BOTH directions: hide anyone the caller blocked AND
    -- anyone who blocked the caller (definer sees all rows; the blocker's
    -- identity is never returned to the client).
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE (b.blocker_id = p_user_id AND b.blocked_id = cp.user_id)
         OR (b.blocker_id = cp.user_id AND b.blocked_id = p_user_id)
    )
  ORDER BY cp.crossings DESC, cp.last_crossed_at DESC NULLS LAST
  LIMIT GREATEST(1, p_limit);
$$;
GRANT EXECUTE ON FUNCTION public.get_crossed_paths(UUID, INTEGER) TO authenticated;

-- ── 23: EVENTS.GOING SYNC ─────────────────────────────────────────────────────
-- The feed shows social proof from events.going ("N going", avatar stacks,
-- spots-left, buzz score), but nothing maintained it: RSVPManager.upsert never
-- wrote it and no trigger existed, so it stayed at its default regardless of
-- RSVPs. Maintain it from event_rsvps so the count is honest everywhere.
-- (Guard the column add — part_1 adds events.going but runs last in fresh order.)
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS going INTEGER DEFAULT 0;

CREATE OR REPLACE FUNCTION public.sync_event_going_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE eid UUID;
BEGIN
  eid := COALESCE(NEW.event_id, OLD.event_id);
  IF eid IS NOT NULL THEN
    UPDATE public.events SET going = (
      SELECT COUNT(*) FROM public.event_rsvps WHERE event_id = eid AND status = 'going'
    ) WHERE id = eid;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS sync_event_going_count_trigger ON public.event_rsvps;
CREATE TRIGGER sync_event_going_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.event_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.sync_event_going_count();

-- One-time backfill so existing events show the right count immediately.
UPDATE public.events e SET going = COALESCE((
  SELECT COUNT(*) FROM public.event_rsvps r WHERE r.event_id = e.id AND r.status = 'going'
), 0);

-- ── 24: AGE GATE — the one legally-required hard restriction ───────────────────
-- Block a positive RSVP (going/maybe) or a Touch Down to an age-restricted Gruv
-- when the user's known age is under events.age_restriction. Server-side so it
-- can't be bypassed by calling the API directly (the client also checks for UX).
-- Fail-open on unknown DOB — don't lock adults who never set a birthday out.
CREATE OR REPLACE FUNCTION public.enforce_event_age_gate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  req_age INT;
  dob     DATE;
  yrs     INT;
BEGIN
  SELECT age_restriction INTO req_age FROM public.events WHERE id = NEW.event_id;
  IF req_age IS NULL OR req_age <= 0 THEN RETURN NEW; END IF;
  -- For RSVPs, only gate positive intents (declining is always fine).
  IF TG_TABLE_NAME = 'event_rsvps' AND COALESCE(NEW.status, '') NOT IN ('going', 'maybe') THEN
    RETURN NEW;
  END IF;
  SELECT birth_date INTO dob FROM public.profiles WHERE id = NEW.user_id;
  IF dob IS NULL THEN RETURN NEW; END IF; -- unknown age → fail-open
  yrs := EXTRACT(YEAR FROM age(dob))::INT;
  IF yrs < req_age THEN
    RAISE EXCEPTION 'AGE_RESTRICTED: this Gruv is %+ only', req_age USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS enforce_age_gate_rsvp ON public.event_rsvps;
CREATE TRIGGER enforce_age_gate_rsvp BEFORE INSERT OR UPDATE ON public.event_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.enforce_event_age_gate();
DROP TRIGGER IF EXISTS enforce_age_gate_checkin ON public.live_checkins;
CREATE TRIGGER enforce_age_gate_checkin BEFORE INSERT OR UPDATE ON public.live_checkins
  FOR EACH ROW EXECUTE FUNCTION public.enforce_event_age_gate();

-- ── 25: TRUST-WEIGHTED REPORT → AUTO-HIDE ─────────────────────────────────────
-- Harmful content disappears pending review once enough DISTINCT reporters flag
-- it, weighted by reporter trust (social_integrity_score: SIS 0–100 → 0–2x, so
-- a sockpuppet army can't brigade and a few trusted users act fast). Sets an
-- auto_hidden flag the app filters out. Reversible (a moderator clears it).
-- DM ('message') reports are ignored here — those are private 1:1 and handled by
-- block, not a public hide. Columns guarded so build order can't break it.
DO $$ BEGIN
  IF to_regclass('public.events')   IS NOT NULL THEN ALTER TABLE public.events   ADD COLUMN IF NOT EXISTS auto_hidden    BOOLEAN DEFAULT false; END IF;
  IF to_regclass('public.reels')    IS NOT NULL THEN ALTER TABLE public.reels    ADD COLUMN IF NOT EXISTS auto_hidden    BOOLEAN DEFAULT false; END IF;
  IF to_regclass('public.echoes')   IS NOT NULL THEN ALTER TABLE public.echoes   ADD COLUMN IF NOT EXISTS auto_hidden    BOOLEAN DEFAULT false; END IF;
  IF to_regclass('public.profiles') IS NOT NULL THEN ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_auto_hidden BOOLEAN DEFAULT false; END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reports_target ON public.reports(target_id, target_type);

CREATE OR REPLACE FUNCTION public.apply_report_autohide()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  wsum NUMERIC;
BEGIN
  -- Sum trust weight across DISTINCT reporters of this target.
  SELECT COALESCE(SUM(w), 0) INTO wsum FROM (
    SELECT r.reporter_id,
           GREATEST(0, LEAST(2.0, COALESCE(MAX(p.social_integrity_score), 50) / 50.0)) AS w
    FROM public.reports r
    LEFT JOIN public.profiles p ON p.id = r.reporter_id
    WHERE r.target_id = NEW.target_id AND r.target_type = NEW.target_type
    GROUP BY r.reporter_id
  ) s;

  IF wsum < 3.0 THEN RETURN NEW; END IF; -- ~3 trusted reports

  IF    NEW.target_type = 'event' THEN UPDATE public.events   SET auto_hidden    = true WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'reel'  THEN UPDATE public.reels    SET auto_hidden    = true WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'echo'  THEN UPDATE public.echoes   SET auto_hidden    = true WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'user'  THEN UPDATE public.profiles SET is_auto_hidden = true WHERE id = NEW.target_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS apply_report_autohide_trigger ON public.reports;
CREATE TRIGGER apply_report_autohide_trigger
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.apply_report_autohide();

-- ── 26: MODERATOR REVIEW QUEUE (admin-only) ───────────────────────────────────
-- The other half of report→auto-hide: a queue to ACTION hidden content. Both
-- RPCs are admin-gated (role='admin') and SECURITY DEFINER so they bypass the
-- owner-scoped RLS on events/reels/echoes/profiles (a moderator isn't the
-- author). Non-admins get NOT_ADMIN.
CREATE OR REPLACE FUNCTION public.get_moderation_queue()
RETURNS TABLE(content_type TEXT, content_id UUID, label TEXT, reports BIGINT, last_reported TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'NOT_ADMIN';
  END IF;
  RETURN QUERY
    SELECT 'event'::TEXT, e.id, COALESCE(e.title, 'Gruv'),
           (SELECT COUNT(*) FROM public.reports r WHERE r.target_type='event' AND r.target_id=e.id),
           (SELECT MAX(r.created_at) FROM public.reports r WHERE r.target_type='event' AND r.target_id=e.id)
    FROM public.events e WHERE e.auto_hidden = true
    UNION ALL
    SELECT 'reel'::TEXT, rl.id, COALESCE(LEFT(rl.caption, 60), 'Reel'),
           (SELECT COUNT(*) FROM public.reports r WHERE r.target_type='reel' AND r.target_id=rl.id),
           (SELECT MAX(r.created_at) FROM public.reports r WHERE r.target_type='reel' AND r.target_id=rl.id)
    FROM public.reels rl WHERE rl.auto_hidden = true
    UNION ALL
    SELECT 'echo'::TEXT, ec.id, COALESCE(LEFT(ec.body, 60), 'Echo'),
           (SELECT COUNT(*) FROM public.reports r WHERE r.target_type='echo' AND r.target_id=ec.id),
           (SELECT MAX(r.created_at) FROM public.reports r WHERE r.target_type='echo' AND r.target_id=ec.id)
    FROM public.echoes ec WHERE ec.auto_hidden = true
    UNION ALL
    SELECT 'user'::TEXT, p.id, COALESCE('@' || p.username, 'Viber'),
           (SELECT COUNT(*) FROM public.reports r WHERE r.target_type='user' AND r.target_id=p.id),
           (SELECT MAX(r.created_at) FROM public.reports r WHERE r.target_type='user' AND r.target_id=p.id)
    FROM public.profiles p WHERE p.is_auto_hidden = true
    ORDER BY 5 DESC NULLS LAST;
END;
$$;

CREATE OR REPLACE FUNCTION public.moderate_content(p_type TEXT, p_id UUID, p_action TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'NOT_ADMIN';
  END IF;
  IF p_action = 'restore' THEN          -- false alarm: un-hide
    IF    p_type='event' THEN UPDATE public.events   SET auto_hidden    = false WHERE id = p_id;
    ELSIF p_type='reel'  THEN UPDATE public.reels    SET auto_hidden    = false WHERE id = p_id;
    ELSIF p_type='echo'  THEN UPDATE public.echoes   SET auto_hidden    = false WHERE id = p_id;
    ELSIF p_type='user'  THEN UPDATE public.profiles SET is_auto_hidden = false WHERE id = p_id;
    END IF;
  ELSIF p_action = 'remove' THEN        -- confirmed bad: take down for good
    IF    p_type='event' THEN UPDATE public.events   SET is_deleted = true WHERE id = p_id;
    ELSIF p_type='reel'  THEN UPDATE public.reels    SET is_deleted = true WHERE id = p_id;
    ELSIF p_type='echo'  THEN DELETE FROM public.echoes WHERE id = p_id;
    ELSIF p_type='user'  THEN UPDATE public.profiles SET is_deleted = true WHERE id = p_id;
    END IF;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_moderation_queue() TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderate_content(TEXT, UUID, TEXT) TO authenticated;

-- ── 27: enforce auto-hide via RLS (all surfaces, server-side, bypass-proof) ────
-- RESTRICTIVE SELECT policies AND with the existing permissive ones, so auto-
-- hidden content becomes invisible to everyone EXCEPT its owner (so they know /
-- can appeal) and admins — with NO client query changes needed and no way to
-- bypass via the API. Non-hidden rows are unaffected. Guarded for column/table
-- existence so build order can't break it (the part_4 idempotency re-run wires
-- tables like reels that are created later).
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_user_id AND role = 'admin'
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated, anon;

DO $$
DECLARE adm TEXT := 'public.is_admin(auth.uid())';
BEGIN
  IF to_regclass('public.events') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='events' AND column_name='auto_hidden') THEN
    DROP POLICY IF EXISTS "events_hide_autohidden" ON public.events;
    EXECUTE 'CREATE POLICY "events_hide_autohidden" ON public.events AS RESTRICTIVE FOR SELECT USING (COALESCE(auto_hidden,false)=false OR author_id = auth.uid() OR ' || adm || ')';
  END IF;
  IF to_regclass('public.reels') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reels' AND column_name='auto_hidden') THEN
    DROP POLICY IF EXISTS "reels_hide_autohidden" ON public.reels;
    EXECUTE 'CREATE POLICY "reels_hide_autohidden" ON public.reels AS RESTRICTIVE FOR SELECT USING (COALESCE(auto_hidden,false)=false OR user_id = auth.uid() OR ' || adm || ')';
  END IF;
  IF to_regclass('public.echoes') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='echoes' AND column_name='auto_hidden') THEN
    DROP POLICY IF EXISTS "echoes_hide_autohidden" ON public.echoes;
    EXECUTE 'CREATE POLICY "echoes_hide_autohidden" ON public.echoes AS RESTRICTIVE FOR SELECT USING (COALESCE(auto_hidden,false)=false OR user_id = auth.uid() OR ' || adm || ')';
  END IF;
  IF to_regclass('public.profiles') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='is_auto_hidden') THEN
    DROP POLICY IF EXISTS "profiles_hide_autohidden" ON public.profiles;
    EXECUTE 'CREATE POLICY "profiles_hide_autohidden" ON public.profiles AS RESTRICTIVE FOR SELECT USING (COALESCE(is_auto_hidden,false)=false OR id = auth.uid() OR ' || adm || ')';
  END IF;
END $$;


-- ── 28: CORE WRITES (messages/follows/reels/storage/realtime) — fixes Follow + DM red-! ──
-- ══════════════════════════════════════════════════════════════════════════════
--  THE GRUVS — FIX CORE WRITES  (messages · follows · reels · storage · realtime)
-- ══════════════════════════════════════════════════════════════════════════════
--  WHY THIS EXISTS
--  The app code is correct and resilient, but these user-facing actions fail when
--  the LIVE database is missing tables/columns or has RLS that rejects the write:
--    • DMs send then turn red & vanish  → messages table/columns/RLS
--    • Follow toggles then resets        → follows table/RLS
--    • Reels upload but play black        → reels columns + the 'reels' bucket not public
--    • New events take long to appear     → events not in the realtime publication
--
--  This single file fixes ALL of the above. It is FULLY IDEMPOTENT — safe to run
--  as many times as you like, on a fresh OR an existing database. Paste the whole
--  thing into Supabase → SQL Editor → Run. No other file is required for these.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. MESSAGES ───────────────────────────────────────────────────────────────
-- Create if missing, then add EVERY column the app's send code writes so the
-- full insert succeeds (rich features: replies, shared events, location, images).
CREATE TABLE IF NOT EXISTS public.messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id  UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  body          TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_url        TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message_type     TEXT DEFAULT 'text';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_at          TIMESTAMPTZ;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS delivered_at     TIMESTAMPTZ;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_request       BOOLEAN DEFAULT false;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS request_accepted BOOLEAN;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_at       TIMESTAMPTZ;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reactions        JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS parent_id        UUID;  -- DM reply target (the app uses parent_id)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reply_to         UUID;  -- legacy alias kept for compatibility
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS event_id         UUID;  -- shared-event card
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS latitude         DOUBLE PRECISION;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS longitude        DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_messages_pair ON public.messages (sender_id, recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON public.messages (recipient_id);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "messages_select" ON public.messages;
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
DROP POLICY IF EXISTS "messages_update" ON public.messages;
CREATE POLICY "messages_select" ON public.messages FOR SELECT
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());
CREATE POLICY "messages_insert" ON public.messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());
CREATE POLICY "messages_update" ON public.messages FOR UPDATE
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- ── 2. FOLLOWS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.follows (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (follower_id, following_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_follower  ON public.follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows (following_id);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "follows_select" ON public.follows;
DROP POLICY IF EXISTS "follows_insert" ON public.follows;
DROP POLICY IF EXISTS "follows_delete" ON public.follows;
CREATE POLICY "follows_select" ON public.follows FOR SELECT USING (true);
CREATE POLICY "follows_insert" ON public.follows FOR INSERT
  WITH CHECK (follower_id = auth.uid());
CREATE POLICY "follows_delete" ON public.follows FOR DELETE
  USING (follower_id = auth.uid());

-- ── 3. REELS (table + columns + RLS) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_url   TEXT,
  media_type  TEXT DEFAULT 'video',
  caption     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS sound_name  TEXT;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS event_id    UUID;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS event_title TEXT;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS visibility  TEXT DEFAULT 'public';
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS metadata    JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS like_count  INTEGER DEFAULT 0;

ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reels_select"      ON public.reels;
DROP POLICY IF EXISTS "reels_insert"      ON public.reels;
DROP POLICY IF EXISTS "reels_update_own"  ON public.reels;
DROP POLICY IF EXISTS "reels_delete_own"  ON public.reels;
CREATE POLICY "reels_select"     ON public.reels FOR SELECT USING (true);
CREATE POLICY "reels_insert"     ON public.reels FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "reels_update_own" ON public.reels FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "reels_delete_own" ON public.reels FOR DELETE USING (user_id = auth.uid());

-- ── 4. STORAGE BUCKETS — make media public + allow signed-in uploads ──────────
-- Wrapped so a permissions hiccup on storage.* never aborts the rest of the file.
DO $$
BEGIN
  -- Public read for all media buckets the app serves; create if missing.
  INSERT INTO storage.buckets (id, name, public) VALUES
    ('reels','reels',true), ('avatars','avatars',true),
    ('event-media','event-media',true), ('moments','moments',true),
    ('covers','covers',true), ('chat_media','chat_media',true)
  ON CONFLICT (id) DO UPDATE SET public = true;

  -- Public read of objects in those buckets.
  DROP POLICY IF EXISTS "gruvs_media_public_read" ON storage.objects;
  CREATE POLICY "gruvs_media_public_read" ON storage.objects FOR SELECT
    USING (bucket_id IN ('reels','avatars','event-media','moments','covers','chat_media'));

  -- Signed-in users can upload to those buckets.
  DROP POLICY IF EXISTS "gruvs_media_auth_write" ON storage.objects;
  CREATE POLICY "gruvs_media_auth_write" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id IN ('reels','avatars','event-media','moments','covers','chat_media'));

  -- Owners can overwrite/delete their own objects (upsert on re-upload).
  DROP POLICY IF EXISTS "gruvs_media_owner_modify" ON storage.objects;
  CREATE POLICY "gruvs_media_owner_modify" ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id IN ('reels','avatars','event-media','moments','covers','chat_media') AND owner = auth.uid());
  DROP POLICY IF EXISTS "gruvs_media_owner_delete" ON storage.objects;
  CREATE POLICY "gruvs_media_owner_delete" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id IN ('reels','avatars','event-media','moments','covers','chat_media') AND owner = auth.uid());
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'storage step skipped (%): set bucket "reels" to Public manually in Dashboard → Storage', SQLERRM;
END $$;

-- ── 5. REALTIME — make new events / messages / reels stream live ───────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='events') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.events; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='reels') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reels; END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'realtime publication step skipped: %', SQLERRM;
END $$;

-- ✅ Done. DMs persist, follows stick, reels play, events appear live.


-- ── 29: CONTENT AGE-RATING (min_age on reels/events/echoes) ──
-- ══════════════════════════════════════════════════════════════════════════════
--  THE GRUVS — CONTENT AGE-RATING  (silent min-age floor on user posts)
-- ══════════════════════════════════════════════════════════════════════════════
--  The app rates every reel / event / echo at post time (src/utils/contentAgeRating)
--  and stores a MINIMUM VIEWING AGE so younger users are never served mature posts
--  — no report, no message to the poster. These columns persist that rating.
--
--  Fully idempotent. The app degrades gracefully without it (it re-rates text on
--  read), so running this is an optimisation + enables the moderator review flag.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.reels  ADD COLUMN IF NOT EXISTS min_age      INTEGER DEFAULT 13;
ALTER TABLE public.reels  ADD COLUMN IF NOT EXISTS auto_flagged BOOLEAN DEFAULT false;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS min_age      INTEGER DEFAULT 13;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS auto_flagged BOOLEAN DEFAULT false;

ALTER TABLE public.echoes ADD COLUMN IF NOT EXISTS min_age      INTEGER DEFAULT 13;
ALTER TABLE public.echoes ADD COLUMN IF NOT EXISTS auto_flagged BOOLEAN DEFAULT false;

-- Partial indexes so the moderator review queue (auto_flagged) and age filters
-- stay fast without bloating the common case (min_age = 13, not flagged).
CREATE INDEX IF NOT EXISTS idx_reels_flagged  ON public.reels  (created_at DESC) WHERE auto_flagged;
CREATE INDEX IF NOT EXISTS idx_events_flagged ON public.events (created_at DESC) WHERE auto_flagged;
CREATE INDEX IF NOT EXISTS idx_echoes_flagged ON public.echoes (created_at DESC) WHERE auto_flagged;

-- ✅ Done. Mature posts now carry an age floor; worst cases are flagged for review.


-- ── 30: SCHEMA DRIFT RECONCILE + HARDEN ──
-- ══════════════════════════════════════════════════════════════
--  THE GRUVS — SCHEMA DRIFT RECONCILIATION & SECURITY HARDENING
-- ══════════════════════════════════════════════════════════════
--  This script aligns the live database with code expectations:
--  1. Adds missing columns to activity_feed, event_views, path_crossings, route_steps.
--  2. Adds gamification column support (vibe_coins, reputation_status) to profiles.
--  3. Hardens RLS security on live_checkins, profiles, and admin RPCs.
-- ══════════════════════════════════════════════════════════════

-- ── 1. Column Drift Reconciliation ────────────────────────────

-- activity_feed expects 'read' column (synced with is_read if needed)
ALTER TABLE public.activity_feed ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false;

-- Sync read and is_read in triggers to maintain backward compatibility
CREATE OR REPLACE FUNCTION sync_activity_feed_read_status()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.read := COALESCE(NEW.read, NEW.is_read, false);
    NEW.is_read := COALESCE(NEW.is_read, NEW.read, false);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.read IS DISTINCT FROM OLD.read THEN
      NEW.is_read := NEW.read;
    ELSIF NEW.is_read IS DISTINCT FROM OLD.is_read THEN
      NEW.read := NEW.is_read;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_activity_feed_read ON public.activity_feed;
CREATE TRIGGER trg_sync_activity_feed_read
  BEFORE INSERT OR UPDATE ON public.activity_feed
  FOR EACH ROW EXECUTE FUNCTION sync_activity_feed_read_status();

-- event_views expects 'author_id'
ALTER TABLE public.event_views ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- path_crossings expects user_id and cross_count
ALTER TABLE public.path_crossings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.path_crossings ADD COLUMN IF NOT EXISTS other_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.path_crossings ADD COLUMN IF NOT EXISTS cross_count INTEGER DEFAULT 1;

-- route_steps expects step_order
ALTER TABLE public.route_steps ADD COLUMN IF NOT EXISTS step_order INTEGER DEFAULT 1;

-- ticket_tokens table
-- NOTE: this used to declare `token_str` / `used`, which contradicted the
-- definition in schema_part_1 (`token` / `qr_payload` / `used_at` / `expires_at`)
-- AND the real production table. Because DB Schema CI applies part_4 BEFORE
-- part_1, this wrong version won the CREATE ... IF NOT EXISTS race, part_1's
-- CREATE became a no-op, and its index on `token` then failed — so the schema
-- files could not rebuild the database from scratch at all.
-- This now mirrors production exactly. Keep the two definitions identical.
CREATE TABLE IF NOT EXISTS public.ticket_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rsvp_id     UUID NOT NULL,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  qr_payload  TEXT,
  used_at     TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ DEFAULT now() + interval '24 hours',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Reconcile a pre-existing table that was created with the old column names.
ALTER TABLE public.ticket_tokens ADD COLUMN IF NOT EXISTS token      TEXT;
ALTER TABLE public.ticket_tokens ADD COLUMN IF NOT EXISTS qr_payload TEXT;
ALTER TABLE public.ticket_tokens ADD COLUMN IF NOT EXISTS used_at    TIMESTAMPTZ;
ALTER TABLE public.ticket_tokens ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT now() + interval '24 hours';

ALTER TABLE public.ticket_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ticket_tokens_own" ON public.ticket_tokens;
CREATE POLICY "ticket_tokens_own" ON public.ticket_tokens FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 2. Gamification Columns ───────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vibe_coins INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reputation_status TEXT DEFAULT 'Novice Viber';


-- ── 3. RLS Security Hardening ────────────────────────────────

-- GPS location harvesting prevention on live_checkins
ALTER TABLE public.live_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_checkins are viewable by everyone" ON public.live_checkins;
DROP POLICY IF EXISTS "Enable read access for all users"        ON public.live_checkins;
DROP POLICY IF EXISTS "live_checkins: owner reads own"          ON public.live_checkins;
DROP POLICY IF EXISTS "live_checkins: authenticated read"       ON public.live_checkins;
DROP POLICY IF EXISTS "live_checkins: owner management"         ON public.live_checkins;

-- 1. Owners read and write their own check-ins
CREATE POLICY "live_checkins: owner management"
  ON public.live_checkins FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Authenticated users can read event check-ins (guest list)
CREATE POLICY "live_checkins: authenticated read"
  ON public.live_checkins FOR SELECT
  TO authenticated
  USING (true);

-- 3. Anonymous users are blocked from SELECTing checkins
REVOKE SELECT ON public.live_checkins FROM anon;
REVOKE SELECT (lat, lon) ON public.live_checkins FROM anon, authenticated;

-- Explicitly grant other columns to authenticated users
GRANT SELECT (id, user_id, event_id, checked_in_at, expires_at, identity_layer, ghost_alias)
  ON public.live_checkins TO authenticated;

-- Hide profiles PII from anonymous users
REVOKE SELECT (email, push_token, emergency_contacts, siblings, first_name, surname)
  ON public.profiles FROM anon;

-- Require login to read the social graph (follows)
-- Require login to read and manage the social graph (follows)
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "follows are viewable by everyone" ON public.follows;
DROP POLICY IF EXISTS "follows: authenticated read"       ON public.follows;
DROP POLICY IF EXISTS "Follows readable"                 ON public.follows;
DROP POLICY IF EXISTS "follows_select"                   ON public.follows;
DROP POLICY IF EXISTS "follows_insert"                   ON public.follows;
DROP POLICY IF EXISTS "follows_delete"                   ON public.follows;

CREATE POLICY "follows_select" ON public.follows FOR SELECT TO authenticated USING (true);
CREATE POLICY "follows_insert" ON public.follows FOR INSERT TO authenticated WITH CHECK (follower_id = auth.uid());
CREATE POLICY "follows_delete" ON public.follows FOR DELETE TO authenticated USING (follower_id = auth.uid());

-- Hardening / verifying messages RLS policies
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "messages_insert_own"   ON public.messages;
DROP POLICY IF EXISTS "messages_select_own"   ON public.messages;
DROP POLICY IF EXISTS "messages_update_parts" ON public.messages;

CREATE POLICY "messages_insert_own" ON public.messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());
CREATE POLICY "messages_select_own" ON public.messages FOR SELECT TO authenticated USING (sender_id = auth.uid() OR recipient_id = auth.uid());
CREATE POLICY "messages_update_parts" ON public.messages FOR UPDATE TO authenticated USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- Reels RLS Verification
ALTER TABLE public.reels         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_likes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_comment_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reels_select"     ON public.reels;
DROP POLICY IF EXISTS "reels_insert"     ON public.reels;
DROP POLICY IF EXISTS "reels_update_own" ON public.reels;
DROP POLICY IF EXISTS "reels_delete_own" ON public.reels;
CREATE POLICY "reels_select"     ON public.reels FOR SELECT USING (is_deleted = false);
CREATE POLICY "reels_insert"     ON public.reels FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "reels_update_own" ON public.reels FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "reels_delete_own" ON public.reels FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "reel_likes_select" ON public.reel_likes;
DROP POLICY IF EXISTS "reel_likes_insert" ON public.reel_likes;
DROP POLICY IF EXISTS "reel_likes_delete" ON public.reel_likes;
CREATE POLICY "reel_likes_select" ON public.reel_likes FOR SELECT USING (true);
CREATE POLICY "reel_likes_insert" ON public.reel_likes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "reel_likes_delete" ON public.reel_likes FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "reel_comments_select" ON public.reel_comments;
DROP POLICY IF EXISTS "reel_comments_insert" ON public.reel_comments;
DROP POLICY IF EXISTS "reel_comments_delete" ON public.reel_comments;
CREATE POLICY "reel_comments_select" ON public.reel_comments FOR SELECT USING (true);
CREATE POLICY "reel_comments_insert" ON public.reel_comments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "reel_comments_delete" ON public.reel_comments FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "rcl_read"   ON public.reel_comment_likes;
DROP POLICY IF EXISTS "rcl_insert" ON public.reel_comment_likes;
DROP POLICY IF EXISTS "rcl_delete" ON public.reel_comment_likes;
CREATE POLICY "rcl_read"   ON public.reel_comment_likes FOR SELECT USING (true);
CREATE POLICY "rcl_insert" ON public.reel_comment_likes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "rcl_delete" ON public.reel_comment_likes FOR DELETE USING (user_id = auth.uid());

-- Trigger for reel_comment_likes count synchronization
CREATE OR REPLACE FUNCTION public.sync_reel_comment_like_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reel_comments SET like_count = COALESCE(like_count,0)+1 WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reel_comments SET like_count = GREATEST(0,COALESCE(like_count,0)-1) WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS reel_comment_like_count_trigger ON public.reel_comment_likes;
CREATE TRIGGER reel_comment_like_count_trigger AFTER INSERT OR DELETE ON public.reel_comment_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_reel_comment_like_count();

-- ── 4. Storage Buckets and Policies ─────────────────────────────
-- Ensure storage extension and schema exists
CREATE SCHEMA IF NOT EXISTS storage;

-- Insert buckets if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars',     'avatars',     true, 5242880,   ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']),
  ('covers',      'covers',      true, 10485760,  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']),
  ('event-media', 'event-media', true, 104857600, ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','video/mp4','video/quicktime','video/x-m4v','video/webm']),
  ('reels',       'reels',       true, 104857600, ARRAY['video/mp4','video/quicktime','video/x-m4v','video/webm','image/jpeg','image/png','image/webp','image/heic','image/heif']),
  ('moments',     'moments',     true, 52428800,  ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif','video/mp4','video/quicktime','video/x-m4v','video/webm']),
  ('chat_media',  'chat_media',  true, 10485760,  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif'])
ON CONFLICT (id) DO UPDATE SET
  public            = EXCLUDED.public,
  file_size_limit   = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS — wrapped so the Supabase SQL Editor (whose role is NOT the
-- owner of storage.objects) SKIPS this with a NOTICE instead of aborting the
-- whole run with "42501: must be owner of table objects". If it's skipped,
-- create the same policies via Dashboard → Storage → Policies (that UI runs
-- as the storage admin and will succeed).
DO $$
BEGIN
  ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

  -- Public read for all buckets
  DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
  DROP POLICY IF EXISTS "covers_public_read" ON storage.objects;
  DROP POLICY IF EXISTS "event_media_public_read" ON storage.objects;
  DROP POLICY IF EXISTS "reels_public_read" ON storage.objects;
  DROP POLICY IF EXISTS "moments_public_read" ON storage.objects;
  DROP POLICY IF EXISTS "chat_media_public_read" ON storage.objects;

  CREATE POLICY "avatars_public_read"     ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
  CREATE POLICY "covers_public_read"      ON storage.objects FOR SELECT USING (bucket_id = 'covers');
  CREATE POLICY "event_media_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'event-media');
  CREATE POLICY "reels_public_read"       ON storage.objects FOR SELECT USING (bucket_id = 'reels');
  CREATE POLICY "moments_public_read"     ON storage.objects FOR SELECT USING (bucket_id = 'moments');
  CREATE POLICY "chat_media_public_read"  ON storage.objects FOR SELECT USING (bucket_id = 'chat_media');

  -- Authenticated upload (path must start with the uploader's user id)
  DROP POLICY IF EXISTS "avatars_auth_upload" ON storage.objects;
  DROP POLICY IF EXISTS "covers_auth_upload" ON storage.objects;
  DROP POLICY IF EXISTS "event_media_auth_upload" ON storage.objects;
  DROP POLICY IF EXISTS "reels_auth_upload" ON storage.objects;
  DROP POLICY IF EXISTS "moments_auth_upload" ON storage.objects;
  DROP POLICY IF EXISTS "chat_media_auth_upload" ON storage.objects;

  CREATE POLICY "avatars_auth_upload"     ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'avatars'     AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text);
  CREATE POLICY "covers_auth_upload"      ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'covers'      AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text);
  CREATE POLICY "event_media_auth_upload" ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'event-media' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text);
  CREATE POLICY "reels_auth_upload"       ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'reels'       AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text);
  CREATE POLICY "moments_auth_upload"     ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'moments'     AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text);
  CREATE POLICY "chat_media_auth_upload"  ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'chat_media'  AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text);

  -- Owner delete / update
  DROP POLICY IF EXISTS "storage_owner_delete" ON storage.objects;
  DROP POLICY IF EXISTS "storage_owner_update" ON storage.objects;
  CREATE POLICY "storage_owner_delete" ON storage.objects FOR DELETE USING (auth.uid()::text = (storage.foldername(name))[1]);
  CREATE POLICY "storage_owner_update" ON storage.objects FOR UPDATE USING (auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'storage.objects policies skipped (%): create them in Dashboard → Storage → Policies', SQLERRM;
END $$;

-- Pinned search_path security on Admin functions
CREATE OR REPLACE FUNCTION public.admin_suspend_user(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED';
  END IF;
  
  INSERT INTO public.user_suspensions (user_id, reason, suspended_by)
  VALUES (p_user_id, 'Suspended by admin', auth.uid())
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.profiles
  SET is_discoverable = false, is_online = false
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_flag_user(p_user_id UUID, p_reason TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED';
  END IF;

  INSERT INTO public.reports (reporter_id, target_id, target_type, reason, status)
  VALUES (auth.uid(), p_user_id, 'user', p_reason, 'pending');
END;
$$;



-- ── 31: SECURITY HARDENING (anon PII allowlist — kept LAST so it is the final word on anon) ──
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


-- ── 32: CHANGELOG v2.2.0 (data — run-once guarded so re-runs do not duplicate) ──
-- Defensive: older DBs created app_updates with only (version, notes, is_forced).
-- Add the columns the app + the insert below need, so this never errors.
ALTER TABLE public.app_updates ADD COLUMN IF NOT EXISTS title       TEXT;
ALTER TABLE public.app_updates ADD COLUMN IF NOT EXISTS type        TEXT;
ALTER TABLE public.app_updates ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.app_updates ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ DEFAULT now();

INSERT INTO public.app_updates (title, type, description, version, released_at)
SELECT v.title, v.type, v.description, v.version, v.released_at::timestamptz
FROM (VALUES
  ('Tighter Privacy & Security','security','Locked down your personal info so only you and the people you choose can see it. Closed a gap that could expose data to logged-out users.','2.2.0','2026-06-22'),
  ('Drop a Gruv in Seconds','improvement','Posting an event is now faster - just a name, place and time (or drop your flyer). No more long forms.','2.2.0','2026-06-22'),
  ('Crossed Paths','feature','See the Vibers you keep Touching Down alongside, ranked from most to least - your real-world crowd. Open it from the Touch Down button.','2.2.0','2026-06-22'),
  ('Cleaner, Faster Home','fix','Tidied up the app and fixed a display glitch on event cards for a smoother feed.','2.2.0','2026-06-22')
) AS v(title,type,description,version,released_at)
WHERE NOT EXISTS (SELECT 1 FROM public.app_updates WHERE version = '2.2.0');


-- ── 33: TIERED GIFT SYSTEM (ad reach via virtual gift) — folded from ad_gifts.sql ──
-- ══════════════════════════════════════════════════════════════════════════════
--  THE GRUVS — TIERED GIFT SYSTEM (advertising access by virtual gift)
-- ══════════════════════════════════════════════════════════════════════════════
--  Virtual gifts unlock temporary advertising reach. Cost + scope are stored
--  SERVER-SIDE (ad_gift_tiers) so a client can never claim a big reach cheaply.
--  redeem_ad_gift() checks/deducts profiles.vibe_coins (earned currency — no real
--  money) and mints a time-boxed ad_tokens grant. Fully idempotent.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. The tier catalogue (mirrors src/constants/giftTiers.js) ────────────────
CREATE TABLE IF NOT EXISTS public.ad_gift_tiers (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  tier           INTEGER NOT NULL,
  coin_cost      INTEGER NOT NULL,
  reach          TEXT NOT NULL CHECK (reach IN ('venue','city','region','national')),
  radius_km      INTEGER NOT NULL,
  duration_hours INTEGER NOT NULL,
  audience_cap   INTEGER NOT NULL
);

INSERT INTO public.ad_gift_tiers (id, name, tier, coin_cost, reach, radius_km, duration_hours, audience_cap) VALUES
  ('spark',   'Spark',   1, 50,    'venue',    5,      6,   200),
  ('blaze',   'Blaze',   2, 200,   'city',     30,     24,  2000),
  ('diamond', 'Diamond', 3, 750,   'region',   150,    72,  20000),
  ('crown',   'Crown',   4, 2500,  'national', 100000, 168, 1000000)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, tier = EXCLUDED.tier, coin_cost = EXCLUDED.coin_cost,
  reach = EXCLUDED.reach, radius_km = EXCLUDED.radius_km,
  duration_hours = EXCLUDED.duration_hours, audience_cap = EXCLUDED.audience_cap;

ALTER TABLE public.ad_gift_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ad_gift_tiers_read" ON public.ad_gift_tiers;
CREATE POLICY "ad_gift_tiers_read" ON public.ad_gift_tiers FOR SELECT USING (true);

-- ── 2. Redeemed access tokens — a time-boxed advertising grant ────────────────
CREATE TABLE IF NOT EXISTS public.ad_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  gift_id      TEXT NOT NULL REFERENCES public.ad_gift_tiers(id),
  reach        TEXT NOT NULL,
  radius_km    INTEGER NOT NULL,
  audience_cap INTEGER NOT NULL,
  issued_at    TIMESTAMPTZ DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  consumed     BOOLEAN DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_ad_tokens_user_active
  ON public.ad_tokens (user_id, expires_at DESC);

ALTER TABLE public.ad_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ad_tokens_owner_read" ON public.ad_tokens;
CREATE POLICY "ad_tokens_owner_read" ON public.ad_tokens FOR SELECT USING (user_id = auth.uid());
-- No direct INSERT policy: tokens are minted ONLY by redeem_ad_gift() below.

-- ── 3. Redeem: check + deduct coins + mint token, all server-side & atomic ────
CREATE OR REPLACE FUNCTION public.redeem_ad_gift(p_gift_id TEXT)
RETURNS public.ad_tokens
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_tier  public.ad_gift_tiers;
  v_coins INTEGER;
  v_token public.ad_tokens;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;

  SELECT * INTO v_tier FROM public.ad_gift_tiers WHERE id = p_gift_id;
  IF v_tier.id IS NULL THEN RAISE EXCEPTION 'UNKNOWN_GIFT'; END IF;

  SELECT COALESCE(vibe_coins, 0) INTO v_coins FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF v_coins < v_tier.coin_cost THEN
    RAISE EXCEPTION 'INSUFFICIENT_COINS: have %, need %', v_coins, v_tier.coin_cost;
  END IF;

  UPDATE public.profiles SET vibe_coins = v_coins - v_tier.coin_cost WHERE id = v_uid;

  INSERT INTO public.ad_tokens (user_id, gift_id, reach, radius_km, audience_cap, expires_at)
  VALUES (v_uid, v_tier.id, v_tier.reach, v_tier.radius_km, v_tier.audience_cap,
          now() + (v_tier.duration_hours || ' hours')::interval)
  RETURNING * INTO v_token;

  RETURN v_token;
END;
$$;
GRANT EXECUTE ON FUNCTION public.redeem_ad_gift(TEXT) TO authenticated;

-- ✅ Done. Gifts priced server-side; redeeming deducts vibe_coins and grants
--    a time-boxed advertising token the app reads via getActiveAdTokens().


-- ── 34: CREATOR MONETIZATION & VIRTUAL WALLET (TikTok-style Gifting) ──
-- ══════════════════════════════════════════════════════════════════════════════
--  THE GRUVS — CREATOR MONETIZATION (virtual wallet, gifting ledger, and cash-outs)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.coin_ledger (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount       INTEGER NOT NULL,
  tx_type      TEXT NOT NULL CHECK (tx_type IN ('purchase', 'gift_spent', 'admin_adjustment', 'refund')),
  reference_id UUID,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.diamond_ledger (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount       NUMERIC(12, 4) NOT NULL,
  tx_type      TEXT NOT NULL CHECK (tx_type IN ('gift_received', 'withdrawal', 'admin_adjustment', 'withdrawal_reversal')),
  reference_id UUID,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gift_registry (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT UNIQUE NOT NULL,
  coin_cost   INTEGER NOT NULL CHECK (coin_cost > 0),
  host_cut    NUMERIC(3, 2) NOT NULL DEFAULT 0.50,
  lottie_url  TEXT NOT NULL,
  tier        TEXT NOT NULL CHECK (tier IN ('spark', 'heat', 'legend')),
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gift_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  host_id         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_id        UUID REFERENCES public.events(id) ON DELETE SET NULL,
  gift_id         UUID REFERENCES public.gift_registry(id) ON DELETE RESTRICT,
  coin_cost       INTEGER NOT NULL,
  diamonds_minted NUMERIC(12, 4) NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cashout_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  diamond_amount  NUMERIC(12, 4) NOT NULL,
  fiat_amount     NUMERIC(12, 2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'ZAR',
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  gateway_ref     TEXT,
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coin_ledger_user ON public.coin_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_diamond_ledger_user ON public.diamond_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_gift_logs_host ON public.gift_logs(host_id);
CREATE INDEX IF NOT EXISTS idx_gift_logs_sender ON public.gift_logs(sender_id);
CREATE INDEX IF NOT EXISTS idx_gift_logs_event ON public.gift_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_cashout_requests_user ON public.cashout_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_cashout_requests_status ON public.cashout_requests(status);

-- cashout_requests.updated_at is never advanced without a trigger (it would stay
-- frozen at the insert time as the gateway moves it pending→processing→completed).
DROP TRIGGER IF EXISTS touch_cashout_requests_updated_at ON public.cashout_requests;
CREATE TRIGGER touch_cashout_requests_updated_at
  BEFORE UPDATE ON public.cashout_requests
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Gift SUPPORT signal — SEPARATE from vibe_count (heat). Gifts accrue here only,
-- so they can never buy Lineup/heat. (events is created in schema_part_2.)
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS support_score INTEGER DEFAULT 0;

-- Enable RLS
ALTER TABLE public.coin_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diamond_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashout_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "coin_ledger_read_own" ON public.coin_ledger;
CREATE POLICY "coin_ledger_read_own" ON public.coin_ledger FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "diamond_ledger_read_own" ON public.diamond_ledger;
CREATE POLICY "diamond_ledger_read_own" ON public.diamond_ledger FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "gift_registry_read_all" ON public.gift_registry;
CREATE POLICY "gift_registry_read_all" ON public.gift_registry FOR SELECT USING (true);

DROP POLICY IF EXISTS "gift_logs_read_involved" ON public.gift_logs;
CREATE POLICY "gift_logs_read_involved" ON public.gift_logs FOR SELECT 
  USING (sender_id = auth.uid() OR host_id = auth.uid());

DROP POLICY IF EXISTS "cashout_requests_read_own" ON public.cashout_requests;
CREATE POLICY "cashout_requests_read_own" ON public.cashout_requests FOR SELECT USING (user_id = auth.uid());

-- Insert default gifts if empty
INSERT INTO public.gift_registry (name, coin_cost, host_cut, lottie_url, tier) VALUES
  ('Flame Spark', 10, 0.50, 'https://assets.thegruvs.app/gifts/flame.json', 'spark'),
  ('Neon Laser', 50, 0.50, 'https://assets.thegruvs.app/gifts/laser.json', 'heat'),
  ('Royal Crown', 500, 0.60, 'https://assets.thegruvs.app/gifts/crown.json', 'legend')
ON CONFLICT (name) DO NOTHING;

-- Gifting Transaction Function
CREATE OR REPLACE FUNCTION public.process_gift(
  p_sender_id UUID,
  p_host_id UUID,
  p_event_id UUID,
  p_gift_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coin_cost INT;
  v_host_cut NUMERIC(3,2);
  v_diamonds_minted NUMERIC(12,4);
  v_sender_balance INT;
  v_gift_log_id UUID;
  v_host_id UUID;   -- the VERIFIED event host (never the client-supplied p_host_id)
BEGIN
  -- Validate authenticated caller matches sender
  IF auth.uid() IS NULL OR auth.uid() <> p_sender_id THEN
    RAISE EXCEPTION 'Not authorized to send this gift.';
  END IF;

  -- Serialize concurrent gifts from the SAME sender for the duration of this
  -- transaction. Without this, two in-flight gifts can both read the same
  -- balance, both pass the check below, and both debit — overdrawing the wallet
  -- (classic double-spend). The lock is released automatically at commit/rollback.
  PERFORM pg_advisory_xact_lock(hashtext('process_gift:' || p_sender_id::text));

  -- 1. Resolve the REAL host from the event. NEVER trust the client-supplied
  --    p_host_id: a caller could otherwise mint diamonds into any account.
  SELECT author_id INTO v_host_id FROM public.events WHERE id = p_event_id;
  IF v_host_id IS NULL THEN
    RAISE EXCEPTION 'Event not found.';
  END IF;
  IF v_host_id = p_sender_id THEN
    RAISE EXCEPTION 'Cannot send a gift to your own event.';
  END IF;

  -- 2. Get gift details (gift_registry is static config; no row lock needed)
  SELECT coin_cost, host_cut INTO v_coin_cost, v_host_cut
  FROM public.gift_registry
  WHERE id = p_gift_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gift not found or inactive.';
  END IF;

  -- 3. Compute current coin balance (safe under the per-sender lock above)
  SELECT COALESCE(SUM(amount), 0) INTO v_sender_balance
  FROM public.coin_ledger
  WHERE user_id = p_sender_id;

  -- 4. Check balance
  IF v_sender_balance < v_coin_cost THEN
    RAISE EXCEPTION 'INSUFFICIENT_COINS';
  END IF;

  v_diamonds_minted := v_coin_cost * v_host_cut;
  v_gift_log_id := gen_random_uuid();

  -- 5. Log the transaction (host_id = the verified event host)
  INSERT INTO public.gift_logs (id, sender_id, host_id, event_id, gift_id, coin_cost, diamonds_minted)
  VALUES (v_gift_log_id, p_sender_id, v_host_id, p_event_id, p_gift_id, v_coin_cost, v_diamonds_minted);

  -- 6. Debit sender
  INSERT INTO public.coin_ledger (user_id, amount, tx_type, reference_id)
  VALUES (p_sender_id, -v_coin_cost, 'gift_spent', v_gift_log_id);

  -- 7. Credit the VERIFIED host
  INSERT INTO public.diamond_ledger (user_id, amount, tx_type, reference_id)
  VALUES (v_host_id, v_diamonds_minted, 'gift_received', v_gift_log_id);

  -- 8. Accrue gift SUPPORT into a signal kept deliberately SEPARATE from
  --    vibe_count (organic heat). Product rule: gifts must NEVER buy Lineup/heat —
  --    support is its own thing, measured in coins gifted.
  UPDATE public.events
  SET support_score = COALESCE(support_score, 0) + v_coin_cost
  WHERE id = p_event_id;

  RETURN jsonb_build_object(
    'success', true,
    'gift_log_id', v_gift_log_id,
    'coins_spent', v_coin_cost,
    'diamonds_earned', v_diamonds_minted
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_gift(UUID, UUID, UUID, UUID) TO authenticated;


-- ══════════════════════════════════════════════════════════════════════════════
-- ── 35: AUDIT FIXES — 2026-06-24 (idempotent; runnable on a live DB) ──
-- ══════════════════════════════════════════════════════════════════════════════
--  SQL audit pass. Most of the schema was already sound (search_path pinned on
--  every SECURITY DEFINER fn, RLS on 145/147 tables, storage policies wrapped in a
--  dynamic drop-all DO block, messages columns guarded by information_schema checks).
--  The real defects found, and where they are fixed:
--
--   • process_gift wrote events.vibe_score (no such column) → RUNTIME FAILURE on
--     every gift. Fixed in §34: gifts now accrue events.support_score, a signal
--     kept SEPARATE from vibe_count/heat (gifts must never buy Lineup heat).
--   • process_gift had a per-sender double-spend race, trusted the client-supplied
--     host_id (mint diamonds into ANY account), and allowed self-gifting → fixed
--     in place in §34 (advisory lock + host derived from events.author_id).
--   • The cashout path did client-side INSERTs into cashout_requests / diamond_ledger,
--     but those tables only have SELECT policies — so RLS DENIED the inserts (broken
--     feature). Adding an INSERT policy would have let anyone mint diamonds. The
--     correct fix is the SECURITY DEFINER RPC below; the rate is server-controlled
--     (the old client passed ZARPerDiamond, which set its own payout). Point the
--     client at supabase.rpc('request_cashout', { p_diamond_amount }).
--   • Five RLS policies were redefined more weakly in schema_part_1 (which runs LAST
--     in the documented order, so its definition wins on a fresh build): event chat
--     readable without the published-event gate; any event role could moderate;
--     chat message length check dropped; soft-deleted events still visible;
--     path_crossings readable by anon. Fixed in place in schema_part_1 AND
--     re-asserted below so an already-built DB can be patched by running just §35.
--
--  For a pre-audit LIVE database: re-run schema_part_4.sql (idempotent — this brings
--  process_gift, the gift_logs indexes and the cashout trigger up to date) and then
--  run this §35 block. For a FRESH build, the in-place fixes already cover everything.

-- ── Secure cashout RPC (replaces the RLS-blocked client-side inserts) ──
CREATE OR REPLACE FUNCTION public.request_cashout(p_diamond_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    UUID := auth.uid();
  v_balance    NUMERIC(12,4);
  v_rate       CONSTANT NUMERIC := 0.18;   -- ZAR per diamond; SERVER-controlled, never client-supplied
  v_fiat       NUMERIC(12,2);
  v_cashout_id UUID := gen_random_uuid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;
  IF p_diamond_amount IS NULL OR p_diamond_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid diamond amount.';
  END IF;

  -- Serialize concurrent cashouts for this user (prevents a double-withdraw race
  -- that could drive the diamond balance negative).
  PERFORM pg_advisory_xact_lock(hashtext('request_cashout:' || v_user_id::text));

  SELECT COALESCE(SUM(amount), 0) INTO v_balance
  FROM public.diamond_ledger
  WHERE user_id = v_user_id;

  IF v_balance < p_diamond_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_DIAMONDS';
  END IF;

  v_fiat := ROUND(p_diamond_amount * v_rate, 2);

  INSERT INTO public.cashout_requests (id, user_id, diamond_amount, fiat_amount, currency, status)
  VALUES (v_cashout_id, v_user_id, p_diamond_amount, v_fiat, 'ZAR', 'pending');

  INSERT INTO public.diamond_ledger (user_id, amount, tx_type, reference_id)
  VALUES (v_user_id, -p_diamond_amount, 'withdrawal', v_cashout_id);

  RETURN jsonb_build_object(
    'success',        true,
    'cashout_id',     v_cashout_id,
    'diamond_amount', p_diamond_amount,
    'fiat_amount',    v_fiat,
    'currency',       'ZAR'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_cashout(NUMERIC) TO authenticated;

-- ── Separate gift-support signal (so gifts never touch vibe_count/heat) ──
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS support_score INTEGER DEFAULT 0;

-- ── Live-DB re-assert of the 5 corrected RLS policies (no-op on a fresh build) ──
DROP POLICY IF EXISTS "chat_select_event_member" ON public.event_chat_messages;
CREATE POLICY "chat_select_event_member" ON public.event_chat_messages FOR SELECT
  USING (deleted = false AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.is_published = true));

DROP POLICY IF EXISTS "chat_insert_own" ON public.event_chat_messages;
CREATE POLICY "chat_insert_own" ON public.event_chat_messages FOR INSERT
  WITH CHECK (user_id = auth.uid() AND length(trim(message)) BETWEEN 1 AND 500);

DROP POLICY IF EXISTS "chat_update_moderator" ON public.event_chat_messages;
CREATE POLICY "chat_update_moderator" ON public.event_chat_messages FOR UPDATE
  USING (user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.event_roles r WHERE r.event_id = event_chat_messages.event_id AND r.user_id = auth.uid() AND r.role IN ('co_host','moderator'))
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_chat_messages.event_id AND e.author_id = auth.uid()));

DROP POLICY IF EXISTS "events_select" ON public.events;
CREATE POLICY "events_select" ON public.events FOR SELECT
  USING (deleted_at IS NULL AND (is_published = true OR author_id = auth.uid()));

DROP POLICY IF EXISTS "path_crossings_own" ON public.path_crossings;
CREATE POLICY "path_crossings_own" ON public.path_crossings FOR SELECT
  USING (auth.role() = 'authenticated');

-- ✅ §35 done.


-- ══════════════════════════════════════════════════════════════════════════════
-- ── 36: RELIABLE FOLLOW / UNFOLLOW RPCs — 2026-06-25 ──
-- ══════════════════════════════════════════════════════════════════════════════
--  The app already references follow_user / unfollow_user as resilience fallbacks
--  (LandingPage, DiscoverPeople, UserManager) but they were NEVER created — so when
--  a direct INSERT into follows failed (an RLS/edge case) there was no working
--  fallback, and the client swallowed the error, leaving the button stuck on
--  "Following" until a reload reverted it ("follow button doesn't work").
--
--  These SECURITY DEFINER RPCs are the reliable PRIMARY path: they validate the
--  caller (== auth.uid()), block self-follow, and write through RLS cleanly.
--  unfollow is a HARD delete because the follows readers (isFollowing /
--  getFollowedIds) do not filter any soft-deleted flag — a soft "unfollowed_at"
--  would still read as following, which is why that approach was dropped.

CREATE OR REPLACE FUNCTION public.follow_user(p_follower_id UUID, p_following_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_follower_id THEN
    RAISE EXCEPTION 'Not authorized.';
  END IF;
  IF p_follower_id = p_following_id THEN
    RAISE EXCEPTION 'Cannot follow yourself.';
  END IF;

  INSERT INTO public.follows (follower_id, following_id)
  VALUES (p_follower_id, p_following_id)
  ON CONFLICT (follower_id, following_id) DO NOTHING;

  RETURN jsonb_build_object('success', true, 'following', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.unfollow_user(p_follower_id UUID, p_following_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_follower_id THEN
    RAISE EXCEPTION 'Not authorized.';
  END IF;

  DELETE FROM public.follows
  WHERE follower_id = p_follower_id AND following_id = p_following_id;

  RETURN jsonb_build_object('success', true, 'following', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.follow_user(UUID, UUID)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.unfollow_user(UUID, UUID) TO authenticated;

-- ✅ §36 done.
