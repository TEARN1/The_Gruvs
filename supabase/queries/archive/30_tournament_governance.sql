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
