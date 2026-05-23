-- ============================================================
--  THE GRUVS SIMPLE — MISSING RPC PATCH (Part 2)
--  Apply AFTER patch_security_fixes.sql in Supabase SQL Editor.
--  Adds all callable RPCs that the client JS references but that
--  are absent from the original supabase_combined_schema.sql.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. AUTH — create_user_profile(p_payload JSONB)
--    Tier-3 fallback in AuthModal.handleSignUp.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_user_profile(p_payload JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (
    id, username, display_name, city, gender, birth_year,
    interests, vibe_score, is_discoverable, wants_email,
    email_confirmed, confirm_later
  )
  VALUES (
    (p_payload->>'id')::UUID,
    p_payload->>'username',
    p_payload->>'display_name',
    p_payload->>'city',
    p_payload->>'gender',
    (p_payload->>'birth_year')::INTEGER,
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'interests', '[]'::jsonb))),
    COALESCE((p_payload->>'vibe_score')::INTEGER, 0),
    COALESCE((p_payload->>'is_discoverable')::BOOLEAN, true),
    COALESCE((p_payload->>'wants_email')::BOOLEAN, true),
    COALESCE((p_payload->>'email_confirmed')::BOOLEAN, false),
    COALESCE((p_payload->>'confirm_later')::BOOLEAN, true)
  )
  ON CONFLICT (id) DO UPDATE
    SET username     = EXCLUDED.username,
        display_name = EXCLUDED.display_name,
        city         = EXCLUDED.city,
        gender       = EXCLUDED.gender,
        birth_year   = EXCLUDED.birth_year,
        interests    = EXCLUDED.interests,
        updated_at   = now();
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 2. PROFILE — update_username(p_user_id, p_username)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_username(p_user_id UUID, p_username TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = p_username AND id <> p_user_id) THEN
    RAISE EXCEPTION 'Username is already taken.';
  END IF;
  UPDATE public.profiles SET username = p_username, updated_at = now()
  WHERE id = p_user_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 3. PROFILE — update_sis_score(p_user_id UUID)
--    Recomputes Social Integrity Score and persists it.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_sis_score(p_user_id UUID)
RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_score NUMERIC;
BEGIN
  v_score := public.calculate_sis_score(p_user_id);
  UPDATE public.profiles
  SET social_integrity_score = v_score, updated_at = now()
  WHERE id = p_user_id;
  RETURN v_score;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 4. MESSAGING — send_message(p_sender, p_recipient, p_body, p_type)
--    Tier-3 fallback in MessageManager.sendMessage.
--    Inserts directly with SECURITY DEFINER, bypassing RLS quirks.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.send_message(
  p_sender    UUID,
  p_recipient UUID,
  p_body      TEXT DEFAULT NULL,
  p_type      TEXT DEFAULT 'text'
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_msg public.messages;
BEGIN
  -- Check blocks
  IF EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE blocker_id = p_recipient AND blocked_id = p_sender
  ) THEN
    RAISE EXCEPTION 'Blocked';
  END IF;

  INSERT INTO public.messages (sender_id, recipient_id, body, message_type)
  VALUES (p_sender, p_recipient, p_body, p_type)
  RETURNING * INTO v_msg;

  RETURN row_to_json(v_msg)::JSONB;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 5. MESSAGING — create_dm_room(p_user_a, p_user_b)
--    Called by PresenceBar.js when opening a chat.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_dm_room(p_user_a UUID, p_user_b UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_p1      UUID;
  v_p2      UUID;
  v_room_id UUID;
BEGIN
  IF p_user_a < p_user_b THEN v_p1 := p_user_a; v_p2 := p_user_b;
  ELSE                        v_p1 := p_user_b; v_p2 := p_user_a;
  END IF;

  SELECT id INTO v_room_id FROM public.dm_rooms
  WHERE participant_1 = v_p1 AND participant_2 = v_p2;

  IF v_room_id IS NULL THEN
    INSERT INTO public.dm_rooms (participant_1, participant_2)
    VALUES (v_p1, v_p2)
    RETURNING id INTO v_room_id;
  END IF;

  RETURN v_room_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 6. EVENTS — create_event(p_payload JSONB)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_event(p_payload JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.events (
    author_id, title, description, address, city,
    lat, lon, event_date, event_time, end_time,
    cover_url, media_urls, category, ticket_url,
    age_restriction, age_max, capacity, is_published, is_cancelled,
    schedule, price, price_min, price_max, coords
  )
  VALUES (
    (p_payload->>'author_id')::UUID,
    p_payload->>'title',
    p_payload->>'description',
    p_payload->>'address',
    p_payload->>'city',
    (p_payload->>'lat')::FLOAT,
    (p_payload->>'lon')::FLOAT,
    (p_payload->>'event_date')::DATE,
    p_payload->>'event_time',
    p_payload->>'end_time',
    p_payload->>'cover_url',
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'media_urls', '[]'::jsonb))),
    p_payload->>'category',
    p_payload->>'ticket_url',
    (p_payload->>'age_restriction')::INTEGER,
    (p_payload->>'age_max')::INTEGER,
    (p_payload->>'capacity')::INTEGER,
    COALESCE((p_payload->>'is_published')::BOOLEAN, true),
    COALESCE((p_payload->>'is_cancelled')::BOOLEAN, false),
    p_payload->'schedule',
    COALESCE(p_payload->>'price', 'FREE'),
    (p_payload->>'price_min')::NUMERIC,
    (p_payload->>'price_max')::NUMERIC,
    CASE
      WHEN (p_payload->>'lat') IS NOT NULL AND (p_payload->>'lon') IS NOT NULL
      THEN ST_SetSRID(ST_MakePoint((p_payload->>'lon')::double precision, (p_payload->>'lat')::double precision), 4326)::geography
      ELSE NULL
    END
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 7. EVENTS — update_event(p_event_id, p_payload JSONB)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_event(p_event_id UUID, p_payload JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_ev public.events;
BEGIN
  SELECT * INTO v_ev FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF v_ev.author_id <> auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  UPDATE public.events
  SET
    title         = COALESCE(p_payload->>'title',        title),
    description   = COALESCE(p_payload->>'description',  description),
    venue_name    = COALESCE(p_payload->>'venue_name',   venue_name),
    event_date    = COALESCE((p_payload->>'event_date')::DATE, event_date),
    event_time    = COALESCE(p_payload->>'event_time',   event_time),
    end_time      = COALESCE(p_payload->>'end_time',     end_time),
    cover_url     = COALESCE(p_payload->>'cover_url',    cover_url),
    ticket_url    = COALESCE(p_payload->>'ticket_url',   ticket_url),
    capacity      = COALESCE((p_payload->>'capacity')::INTEGER, capacity),
    price         = COALESCE(p_payload->>'price',        price),
    price_min     = COALESCE((p_payload->>'price_min')::NUMERIC, price_min),
    price_max     = COALESCE((p_payload->>'price_max')::NUMERIC, price_max),
    lat           = COALESCE((p_payload->>'lat')::FLOAT,     lat),
    lon           = COALESCE((p_payload->>'lon')::FLOAT,     lon),
    coords        = CASE
                      WHEN (p_payload->>'lat') IS NOT NULL AND (p_payload->>'lon') IS NOT NULL
                      THEN ST_SetSRID(ST_MakePoint((p_payload->>'lon')::double precision, (p_payload->>'lat')::double precision), 4326)::geography
                      ELSE coords
                    END,
    updated_at    = now()
  WHERE id = p_event_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 8. EVENTS — cancel_event(p_event_id)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_event(p_event_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  UPDATE public.events SET is_cancelled = true, updated_at = now()
  WHERE id = p_event_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 9. EVENTS — delete_event(p_event_id)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_event(p_event_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  DELETE FROM public.events WHERE id = p_event_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 10. EVENTS — bulk_notify_cancel(p_event_id)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bulk_notify_cancel(p_event_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_title TEXT;
  v_ids   UUID[];
BEGIN
  SELECT title INTO v_title FROM public.events WHERE id = p_event_id;

  SELECT ARRAY(
    SELECT DISTINCT user_id FROM (
      SELECT user_id FROM public.event_vibes WHERE event_id = p_event_id
      UNION
      SELECT user_id FROM public.event_rsvps WHERE event_id = p_event_id
    ) combined
  ) INTO v_ids;

  IF array_length(v_ids, 1) > 0 THEN
    INSERT INTO public.notifications (recipient_id, type, title, body, data)
    SELECT uid, 'event_cancelled',
      '🚫 Event Cancelled',
      format('"%s" has been cancelled by the organizer.', v_title),
      jsonb_build_object('event_id', p_event_id, 'event_title', v_title)
    FROM unnest(v_ids) AS uid;
  END IF;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 11. EVENTS — upsert_rsvp(p_event_id, p_user_id, p_status)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.upsert_rsvp(
  p_event_id UUID, p_user_id UUID, p_status TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.event_rsvps (event_id, user_id, status)
  VALUES (p_event_id, p_user_id, p_status)
  ON CONFLICT (event_id, user_id)
  DO UPDATE SET status = EXCLUDED.status, updated_at = now();
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 12. EVENTS — remove_rsvp(p_event_id, p_user_id)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.remove_rsvp(p_event_id UUID, p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  DELETE FROM public.event_rsvps WHERE event_id = p_event_id AND user_id = p_user_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 13. EVENTS — upsert_event_reaction(p_event_id, p_user_id, p_key)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.upsert_event_reaction(
  p_event_id UUID, p_user_id UUID, p_key TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.event_reactions (event_id, user_id, reaction_key)
  VALUES (p_event_id, p_user_id, p_key)
  ON CONFLICT (event_id, user_id)
  DO UPDATE SET reaction_key = EXCLUDED.reaction_key, updated_at = now();
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 14. EVENTS — remove_event_reaction(p_event_id, p_user_id)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.remove_event_reaction(p_event_id UUID, p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  DELETE FROM public.event_reactions WHERE event_id = p_event_id AND user_id = p_user_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 15. EVENTS — submit_event_rating(p_event_id, p_user_id, p_rating, p_review)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_event_rating(
  p_event_id UUID, p_user_id UUID, p_rating FLOAT, p_review TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.event_ratings (event_id, user_id, rating, review)
  VALUES (p_event_id, p_user_id, p_rating, p_review)
  ON CONFLICT (event_id, user_id)
  DO UPDATE SET rating = EXCLUDED.rating, review = EXCLUDED.review, updated_at = now();
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 16. EVENTS — add_gallery_item(p_event_id, p_user_id, p_url, p_type)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_gallery_item(
  p_event_id UUID, p_user_id UUID, p_url TEXT, p_type TEXT DEFAULT 'image'
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.event_gallery (event_id, user_id, url, media_type)
  VALUES (p_event_id, p_user_id, p_url, p_type);
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 17. REELS — create_reel(p_user_id, p_media_url, p_caption)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_reel(
  p_user_id  UUID, p_media_url TEXT, p_caption TEXT DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.reels (user_id, media_url, caption)
  VALUES (p_user_id, p_media_url, p_caption)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 18. REELS — increment_reel_like(p_reel_id, p_user_id)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_reel_like(p_reel_id UUID, p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.reel_likes (reel_id, user_id)
  VALUES (p_reel_id, p_user_id)
  ON CONFLICT (reel_id, user_id) DO NOTHING;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 19. REELS — decrement_reel_like(p_reel_id, p_user_id)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.decrement_reel_like(p_reel_id UUID, p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  DELETE FROM public.reel_likes WHERE reel_id = p_reel_id AND user_id = p_user_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 20. REELS — add_reel_comment(p_reel_id, p_user_id, p_body)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_reel_comment(
  p_reel_id UUID, p_user_id UUID, p_body TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.reel_comments (reel_id, user_id, body)
  VALUES (p_reel_id, p_user_id, p_body);
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 21. REELS — save_reel(p_reel_id, p_user_id)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.save_reel(p_reel_id UUID, p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.saved_reels (reel_id, user_id)
  VALUES (p_reel_id, p_user_id)
  ON CONFLICT (reel_id, user_id) DO NOTHING;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 22. REELS — unsave_reel(p_reel_id, p_user_id)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.unsave_reel(p_reel_id UUID, p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  DELETE FROM public.saved_reels WHERE reel_id = p_reel_id AND user_id = p_user_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 23. REELS — increment_vibe_count / decrement_vibe_count aliases
--    Some screens call these variants (note: _count suffix)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_vibe_count(p_event_id UUID, p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  PERFORM public.increment_vibe(p_event_id, p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_vibe_count(p_event_id UUID, p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  PERFORM public.decrement_vibe(p_event_id, p_user_id);
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 24. STORIES — create_story(p_user_id, p_url, p_type, p_expires_at)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_story(
  p_user_id   UUID,
  p_url       TEXT,
  p_type      TEXT DEFAULT 'image',
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.stories (user_id, url, media_type, expires_at)
  VALUES (p_user_id, p_url, p_type, COALESCE(p_expires_at, now() + INTERVAL '24 hours'))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 25. STORIES — mark_stories_seen(p_story_ids, p_viewer_id)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_stories_seen(
  p_story_ids UUID[], p_viewer_id UUID
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.story_views (story_id, viewer_id)
  SELECT unnest(p_story_ids), p_viewer_id
  ON CONFLICT (story_id, viewer_id) DO NOTHING;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 26. PRESENCE — check_in_live(p_event_id, p_user_id, p_lat, p_lon)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_in_live(
  p_event_id UUID, p_user_id UUID, p_lat FLOAT, p_lon FLOAT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.event_check_ins (event_id, user_id, lat, lon)
  VALUES (p_event_id, p_user_id, p_lat, p_lon)
  ON CONFLICT (event_id, user_id) DO UPDATE
    SET lat = EXCLUDED.lat, lon = EXCLUDED.lon, checked_in_at = now();
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 27. PRESENCE — check_in_attendee(p_event_id, p_rsvp_id, p_user_id)
--    Admin check-in from EventAdminPanel.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_in_attendee(
  p_event_id UUID, p_rsvp_id UUID, p_user_id UUID
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  UPDATE public.event_rsvps
  SET checked_in = true, checked_in_at = now()
  WHERE id = p_rsvp_id AND event_id = p_event_id AND user_id = p_user_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 28. PATHS — send_path_star(p_from, p_to, p_event_id)
--    PathMapScreen calls with 2 args; PresenceBar calls with 3.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.send_path_star(
  p_from     UUID,
  p_to       UUID,
  p_event_id UUID DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.path_stars (from_user_id, to_user_id, event_id)
  VALUES (p_from, p_to, p_event_id)
  ON CONFLICT DO NOTHING;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 29. PATHS — drop_path_trace(p_user_id, p_lat, p_lon, p_note)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.drop_path_trace(
  p_user_id UUID, p_lat FLOAT, p_lon FLOAT, p_note TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.path_traces (user_id, lat, lon, note)
  VALUES (p_user_id, p_lat, p_lon, p_note);
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 30. PATHS — count_path_crossings(p_user_a, p_user_b)
--    Returns how many times the two users have crossed paths.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.count_path_crossings(p_user_a UUID, p_user_b UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.path_crossings
  WHERE (user_a = p_user_a AND user_b = p_user_b)
     OR (user_a = p_user_b AND user_b = p_user_a);
  RETURN COALESCE(v_count, 0);
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 31. MODERATION — submit_report(p_reporter_id, p_target_id,
--                                p_target_type, p_reason)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_report(
  p_reporter_id UUID, p_target_id UUID, p_target_type TEXT, p_reason TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.reports (reporter_id, target_id, target_type, reason)
  VALUES (p_reporter_id, p_target_id, p_target_type, p_reason);
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 32. REELS — echo like helpers
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_echo_like(p_echo_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.echo_likes (echo_id, user_id)
  VALUES (p_echo_id, auth.uid())
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_echo_like(p_echo_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  DELETE FROM public.echo_likes WHERE echo_id = p_echo_id AND user_id = auth.uid();
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 33. COMMUNITY — add_pulse_request(p_event_id, p_user_id, p_content)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_pulse_request(
  p_event_id UUID, p_user_id UUID, p_content TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.pulse_requests (event_id, user_id, content)
  VALUES (p_event_id, p_user_id, p_content);
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 34. COMMUNITY — cast_pulse_vote(p_request_id, p_user_id)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cast_pulse_vote(p_request_id UUID, p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.pulse_votes (request_id, user_id)
  VALUES (p_request_id, p_user_id)
  ON CONFLICT (request_id, user_id) DO NOTHING;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 35. EVENTS — create_event_poll(p_event_id, p_author_id, p_question, p_options)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_event_poll(
  p_event_id  UUID,
  p_author_id UUID,
  p_question  TEXT,
  p_options   TEXT[]
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.event_polls (event_id, author_id, question, options)
  VALUES (p_event_id, p_author_id, p_question, p_options)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 36. EVENTS — cast_poll_vote(p_poll_id, p_votes TEXT[])
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cast_poll_vote(p_poll_id UUID, p_votes TEXT[])
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.poll_votes (poll_id, user_id, votes)
  VALUES (p_poll_id, auth.uid(), p_votes)
  ON CONFLICT (poll_id, user_id)
  DO UPDATE SET votes = EXCLUDED.votes, updated_at = now();
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 37. EVENTS — post_event_update(p_event_id, p_author, p_message, p_type)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.post_event_update(
  p_event_id UUID, p_author UUID, p_message TEXT, p_type TEXT DEFAULT 'info'
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.event_updates (event_id, author_id, message, update_type)
  VALUES (p_event_id, p_author, p_message, p_type);
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 38. ROUTES — join_route / leave_route
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.join_route(p_route_id UUID, p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.route_members (route_id, user_id)
  VALUES (p_route_id, p_user_id)
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_route(p_route_id UUID, p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  DELETE FROM public.route_members WHERE route_id = p_route_id AND user_id = p_user_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 39. SERVICES — submit_service_review(p_booking_id, p_rating, p_comment)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_service_review(
  p_booking_id UUID, p_rating FLOAT, p_comment TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  UPDATE public.bookings
  SET review_rating = p_rating, review_comment = p_comment, review_at = now()
  WHERE id = p_booking_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 40. GIGS — accept_gig(p_gig_id UUID)
--    Called by GigMarketplaceScreen
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_gig(p_gig_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  UPDATE public.gig_posts
  SET status = 'accepted', accepted_by = auth.uid(), accepted_at = now()
  WHERE id = p_gig_id AND status = 'open';
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 41. NOTIFICATIONS — send_spark_notifications
--    Called by SparkManager; inserts push tokens batch.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.send_spark_notifications(p_rows JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (recipient_id, type, title, body, data)
  SELECT
    (row->>'recipient_id')::UUID,
    row->>'type',
    row->>'title',
    row->>'body',
    row->'data'
  FROM jsonb_array_elements(p_rows) AS row;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- DONE
-- ────────────────────────────────────────────────────────────
