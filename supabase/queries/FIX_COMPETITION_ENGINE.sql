-- ════════════════════════════════════════════════════════════════════════════
--  THE GRUVS — COMPETITION ENGINE FUNCTIONS (deploy to live DB)
--  Paste this whole file into Supabase → SQL Editor → Run. Safe to re-run.
--
--  WHY: the competition tables exist on live, but 4 engine RPCs were never
--  deployed — so standings never recompute, player careers never update, and
--  governance votes / match predictions 404. These are the exact CREATE OR
--  REPLACE definitions from schema_part_3 / schema_part_4 (idempotent, no data
--  loss) — extracted so you don't have to run the giant schema files on prod.
--    • recompute_league_table   — rebuilds the league table after a match
--    • recompute_player_career  — rolls match events up into FIFA-card stats
--    • cast_role_vote           — tournament governance voting
--    • cast_match_prediction    — match prediction casting
-- ════════════════════════════════════════════════════════════════════════════

-- 1) recompute_league_table ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recompute_league_table(p_event_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_config  public.event_sport_config%ROWTYPE;
  v_match   RECORD;
BEGIN
  SELECT * INTO v_config FROM public.event_sport_config WHERE event_id = p_event_id;
  UPDATE public.sport_league_table SET
    played=0,won=0,drawn=0,lost=0,goals_for=0,goals_against=0,
    goal_diff=0,points=0,form='{}',
    home_played=0,home_won=0,home_drawn=0,home_lost=0,
    away_played=0,away_won=0,away_drawn=0,away_lost=0,
    last_updated=now()
  WHERE event_id = p_event_id;
  INSERT INTO public.sport_league_table (event_id, team_id, group_id)
    SELECT t.event_id, t.id, t.group_id FROM public.sport_teams t
    WHERE t.event_id = p_event_id
  ON CONFLICT (event_id, team_id) DO NOTHING;
  FOR v_match IN
    SELECT * FROM public.sport_matches
    WHERE event_id = p_event_id AND status = 'completed'
      AND home_team_id IS NOT NULL AND away_team_id IS NOT NULL
  LOOP
    IF v_match.result = 'home_win' OR (v_match.result IS NULL AND v_match.home_score > v_match.away_score) THEN
      UPDATE public.sport_league_table SET played=played+1,won=won+1,goals_for=goals_for+v_match.home_score,goals_against=goals_against+v_match.away_score,goal_diff=goal_diff+(v_match.home_score-v_match.away_score),points=points+(v_config.win_points),form=array_append(form,'W'),home_played=home_played+1,home_won=home_won+1,last_updated=now() WHERE event_id=p_event_id AND team_id=v_match.home_team_id;
      UPDATE public.sport_league_table SET played=played+1,lost=lost+1,goals_for=goals_for+v_match.away_score,goals_against=goals_against+v_match.home_score,goal_diff=goal_diff+(v_match.away_score-v_match.home_score),points=points+(v_config.loss_points),form=array_append(form,'L'),away_played=away_played+1,away_lost=away_lost+1,last_updated=now() WHERE event_id=p_event_id AND team_id=v_match.away_team_id;
    ELSIF v_match.result = 'away_win' OR (v_match.result IS NULL AND v_match.away_score > v_match.home_score) THEN
      UPDATE public.sport_league_table SET played=played+1,lost=lost+1,goals_for=goals_for+v_match.home_score,goals_against=goals_against+v_match.away_score,goal_diff=goal_diff+(v_match.home_score-v_match.away_score),points=points+(v_config.loss_points),form=array_append(form,'L'),home_played=home_played+1,home_lost=home_lost+1,last_updated=now() WHERE event_id=p_event_id AND team_id=v_match.home_team_id;
      UPDATE public.sport_league_table SET played=played+1,won=won+1,goals_for=goals_for+v_match.away_score,goals_against=goals_against+v_match.home_score,goal_diff=goal_diff+(v_match.away_score-v_match.home_score),points=points+(v_config.win_points),form=array_append(form,'W'),away_played=away_played+1,away_won=away_won+1,last_updated=now() WHERE event_id=p_event_id AND team_id=v_match.away_team_id;
    ELSE
      UPDATE public.sport_league_table SET played=played+1,drawn=drawn+1,goals_for=goals_for+v_match.home_score,goals_against=goals_against+v_match.away_score,goal_diff=goal_diff+(v_match.home_score-v_match.away_score),points=points+(v_config.draw_points),form=array_append(form,'D'),home_played=home_played+1,home_drawn=home_drawn+1,last_updated=now() WHERE event_id=p_event_id AND team_id=v_match.home_team_id;
      UPDATE public.sport_league_table SET played=played+1,drawn=drawn+1,goals_for=goals_for+v_match.away_score,goals_against=goals_against+v_match.home_score,goal_diff=goal_diff+(v_match.away_score-v_match.home_score),points=points+(v_config.draw_points),form=array_append(form,'D'),away_played=away_played+1,away_drawn=away_drawn+1,last_updated=now() WHERE event_id=p_event_id AND team_id=v_match.away_team_id;
    END IF;
  END LOOP;
  UPDATE public.sport_league_table SET form=form[greatest(1,cardinality(form)-4):cardinality(form)] WHERE event_id=p_event_id;
  WITH ranked AS (SELECT id,ROW_NUMBER() OVER (ORDER BY points DESC,goal_diff DESC,goals_for DESC) AS rn FROM public.sport_league_table WHERE event_id=p_event_id)
  UPDATE public.sport_league_table lt SET position=r.rn FROM ranked r WHERE lt.id=r.id;
  UPDATE public.sport_teams t SET played=lt.played,won=lt.won,drawn=lt.drawn,lost=lt.lost,goals_for=lt.goals_for,goals_against=lt.goals_against,goal_diff=lt.goal_diff,points=lt.points,form=lt.form,position=lt.position,updated_at=now()
  FROM public.sport_league_table lt WHERE lt.event_id=p_event_id AND lt.team_id=t.id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.recompute_league_table(UUID) TO authenticated;

-- 2) recompute_player_career ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recompute_player_career(p_player_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.players p SET
    career_apps    = COALESCE((SELECT COUNT(*) FROM public.sport_athletes WHERE player_id = p_player_id), 0),
    career_events  = COALESCE((SELECT COUNT(DISTINCT event_id) FROM public.event_guests WHERE player_id = p_player_id), 0),
    career_awards  = COALESCE((SELECT COUNT(*) FROM public.event_guests WHERE player_id = p_player_id AND award IS NOT NULL AND award <> ''), 0),
    career_goals   = COALESCE((SELECT COUNT(*) FROM public.sport_match_events me JOIN public.sport_athletes sa ON sa.id = me.athlete_id WHERE sa.player_id = p_player_id AND me.event_type = 'goal'), 0),
    career_yellow  = COALESCE((SELECT COUNT(*) FROM public.sport_match_events me JOIN public.sport_athletes sa ON sa.id = me.athlete_id WHERE sa.player_id = p_player_id AND me.event_type = 'yellow_card'), 0),
    career_red     = COALESCE((SELECT COUNT(*) FROM public.sport_match_events me JOIN public.sport_athletes sa ON sa.id = me.athlete_id WHERE sa.player_id = p_player_id AND me.event_type = 'red_card'), 0),
    career_rating  = COALESCE((
      SELECT ROUND(AVG(r)::numeric, 2) FROM (
        SELECT rating AS r FROM public.player_match_ratings WHERE player_id = p_player_id
        UNION ALL
        SELECT rating AS r FROM public.event_guests WHERE player_id = p_player_id AND rating IS NOT NULL
      ) all_ratings
    ), 0),
    follower_count = COALESCE((SELECT COUNT(*) FROM public.player_followers WHERE player_id = p_player_id), 0),
    updated_at     = now()
  WHERE p.id = p_player_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.recompute_player_career(UUID) TO authenticated;

-- 3) cast_role_vote ────────────────────────────────────────────────────────────
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

-- 4) cast_match_prediction ──────────────────────────────────────────────────────
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

-- ✅ Done — competition engine deployed.
