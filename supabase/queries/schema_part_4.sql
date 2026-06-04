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
  -- The caller must own / captain the team they vote with.
  IF NOT EXISTS (
    SELECT 1 FROM public.clubs WHERE id = p_club AND owner_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.sport_teams WHERE event_id IS NOT NULL AND captain_user_id = auth.uid()
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
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
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
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT unnest(r.answer) AS answer, count(*) AS votes
  FROM public.survey_responses r
  JOIN public.surveys s ON s.id = r.survey_id
  WHERE r.survey_id = p_survey_id
    AND r.skipped = false
    AND s.author_id = auth.uid()
  GROUP BY 1
  ORDER BY votes DESC;
$$;
