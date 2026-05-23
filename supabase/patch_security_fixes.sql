-- ============================================================
--  THE GRUVS SIMPLE — SECURITY & LOGIC PATCH
--  Apply once in the Supabase SQL Editor.
--  Resolves all findings from the audit (audit_report.md).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- A. MESSAGES — Consolidate INSERT policies (block-list fix)
--    Remove the overlapping loose policy that ignored blocks.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "messages_insert"        ON public.messages;
DROP POLICY IF EXISTS "Users send own messages" ON public.messages;

CREATE POLICY "messages_insert" ON public.messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id
  AND NOT EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE blocker_id = recipient_id AND blocked_id = auth.uid()
  )
);

-- ────────────────────────────────────────────────────────────
-- B. MESSAGES — Fix enforce_message_limits() operator precedence
--    AND has higher precedence than OR; add parentheses and
--    use EXISTS so a single accepted row is detected correctly.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION enforce_message_limits()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  msg_count  INTEGER;
  is_accepted BOOLEAN;
BEGIN
  -- Check whether any accepted message exists between these two users (either direction)
  SELECT EXISTS (
    SELECT 1 FROM public.messages
    WHERE (
            (sender_id = NEW.sender_id AND recipient_id = NEW.recipient_id)
         OR (sender_id = NEW.recipient_id AND recipient_id = NEW.sender_id)
          )
      AND request_accepted = true
  ) INTO is_accepted;

  IF is_accepted IS NOT TRUE THEN
    SELECT count(*) INTO msg_count
    FROM public.messages
    WHERE sender_id = NEW.sender_id
      AND recipient_id = NEW.recipient_id
      AND request_accepted = false;

    IF msg_count >= 3 THEN
      RAISE EXCEPTION 'Message limit reached. Wait for the recipient to accept your request.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Re-attach trigger (was already on the table; re-create for safety)
DROP TRIGGER IF EXISTS dm_limit_trigger ON public.messages;
CREATE TRIGGER dm_limit_trigger
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION enforce_message_limits();

-- ────────────────────────────────────────────────────────────
-- C. MESSAGES — Auto-resolve DM room on INSERT (room_id fix)
--    Tiers 1 & 2 in dataFlow.js omit room_id.  This BEFORE INSERT
--    trigger looks up or creates the dm_rooms row and fills it in.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.resolve_message_room()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_room_id UUID;
  p1        UUID;
  p2        UUID;
BEGIN
  -- Already has a room_id — nothing to do
  IF NEW.room_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.sender_id IS NULL OR NEW.recipient_id IS NULL THEN
    RAISE EXCEPTION 'sender_id and recipient_id are required to resolve a DM room.';
  END IF;

  -- Canonical ordering matches the unique index on dm_rooms
  IF NEW.sender_id < NEW.recipient_id THEN
    p1 := NEW.sender_id;  p2 := NEW.recipient_id;
  ELSE
    p1 := NEW.recipient_id; p2 := NEW.sender_id;
  END IF;

  -- Look up existing room
  SELECT id INTO v_room_id
  FROM public.dm_rooms
  WHERE participant_1 = p1 AND participant_2 = p2;

  -- Create it if missing
  IF v_room_id IS NULL THEN
    INSERT INTO public.dm_rooms (participant_1, participant_2)
    VALUES (p1, p2)
    ON CONFLICT (LEAST(participant_1, participant_2), GREATEST(participant_1, participant_2))
    DO UPDATE SET updated_at = now()
    RETURNING id INTO v_room_id;
  END IF;

  NEW.room_id := v_room_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_resolve_message_room ON public.messages;
CREATE TRIGGER trg_resolve_message_room
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.resolve_message_room();

-- ────────────────────────────────────────────────────────────
-- D. STORAGE — Secure path-restricted RLS policies
--    Replace wildcard / missing policies with folder-ownership checks.
-- ────────────────────────────────────────────────────────────

-- Drop every existing storage policy we are replacing
DROP POLICY IF EXISTS "Avatar public read"              ON storage.objects;
DROP POLICY IF EXISTS "Avatar auth upload"              ON storage.objects;
DROP POLICY IF EXISTS "Avatar auth write"               ON storage.objects;
DROP POLICY IF EXISTS "Auth upload avatars"             ON storage.objects;
DROP POLICY IF EXISTS "Auth update avatars"             ON storage.objects;
DROP POLICY IF EXISTS "Auth delete avatars"             ON storage.objects;
DROP POLICY IF EXISTS "Public read avatars"             ON storage.objects;

DROP POLICY IF EXISTS "Cover public read"               ON storage.objects;
DROP POLICY IF EXISTS "Cover auth upload"               ON storage.objects;
DROP POLICY IF EXISTS "Cover auth write"                ON storage.objects;
DROP POLICY IF EXISTS "Auth upload covers"              ON storage.objects;
DROP POLICY IF EXISTS "Auth update covers"              ON storage.objects;
DROP POLICY IF EXISTS "Public read covers"              ON storage.objects;

DROP POLICY IF EXISTS "EventMedia public read"          ON storage.objects;
DROP POLICY IF EXISTS "EventMedia auth upload"          ON storage.objects;
DROP POLICY IF EXISTS "EventMedia auth write"           ON storage.objects;
DROP POLICY IF EXISTS "Public read event-media"         ON storage.objects;
DROP POLICY IF EXISTS "Auth upload event-media"         ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view media"           ON storage.objects;

DROP POLICY IF EXISTS "ChatMedia auth access"           ON storage.objects;
DROP POLICY IF EXISTS "ChatMedia public read"           ON storage.objects;
DROP POLICY IF EXISTS "ChatMedia auth write"            ON storage.objects;
DROP POLICY IF EXISTS "Auth upload chat_media"          ON storage.objects;
DROP POLICY IF EXISTS "Auth delete chat_media"          ON storage.objects;
DROP POLICY IF EXISTS "Public read chat_media"          ON storage.objects;

DROP POLICY IF EXISTS "Authenticated users can update"  ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload"  ON storage.objects;
DROP POLICY IF EXISTS "Public access to media"          ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files"      ON storage.objects;

-- ── 1. Avatars ──────────────────────────────────────────────
CREATE POLICY "Avatar public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- INSERT / UPDATE / DELETE restricted to the user's own folder
CREATE POLICY "Avatar owner write" ON storage.objects
  FOR ALL USING (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── 2. Covers ───────────────────────────────────────────────
CREATE POLICY "Cover public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'covers');

CREATE POLICY "Cover owner write" ON storage.objects
  FOR ALL USING (
    bucket_id = 'covers'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'covers'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── 3. Event Media ──────────────────────────────────────────
-- Paths inside this bucket:
--   events/<user_id>/<file>          → PostEventModal  (path[2] = user id)
--   events/<event_id>/<file>         → EditEventModal  (user must be author)
--   gallery/<event_id>/<uid>_<ts>.<ext> → EventGallery (filename prefix = user id)
CREATE POLICY "EventMedia public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'event-media');

CREATE POLICY "EventMedia owner write" ON storage.objects
  FOR ALL USING (
    bucket_id = 'event-media'
    AND auth.role() = 'authenticated'
    AND (
      (
        -- events/<user_id>/... or events/<event_id>/... (author only)
        (storage.foldername(name))[1] = 'events'
        AND (
          (storage.foldername(name))[2] = auth.uid()::text
          OR EXISTS (
            SELECT 1 FROM public.events
            WHERE id::text = (storage.foldername(name))[2]
              AND author_id = auth.uid()
          )
        )
      )
      OR
      (
        -- gallery/<event_id>/<uid>_<timestamp>.<ext>
        (storage.foldername(name))[1] = 'gallery'
        AND split_part(name, '/', 3) LIKE auth.uid()::text || '_%'
      )
    )
  )
  WITH CHECK (
    bucket_id = 'event-media'
    AND auth.role() = 'authenticated'
    AND (
      (
        (storage.foldername(name))[1] = 'events'
        AND (
          (storage.foldername(name))[2] = auth.uid()::text
          OR EXISTS (
            SELECT 1 FROM public.events
            WHERE id::text = (storage.foldername(name))[2]
              AND author_id = auth.uid()
          )
        )
      )
      OR
      (
        (storage.foldername(name))[1] = 'gallery'
        AND split_part(name, '/', 3) LIKE auth.uid()::text || '_%'
      )
    )
  );

-- ── 4. Chat Media ───────────────────────────────────────────
-- Path: dms/<user_id>_<timestamp>.<ext>
-- Any authenticated participant may read; only the uploader may write.
CREATE POLICY "ChatMedia authenticated read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'chat_media'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "ChatMedia owner write" ON storage.objects
  FOR ALL USING (
    bucket_id = 'chat_media'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = 'dms'
    AND split_part(name, '/', 2) LIKE auth.uid()::text || '_%'
  )
  WITH CHECK (
    bucket_id = 'chat_media'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = 'dms'
    AND split_part(name, '/', 2) LIKE auth.uid()::text || '_%'
  );

-- ────────────────────────────────────────────────────────────
-- E. VIBES — Fix increment_vibe / decrement_vibe table name
--    The functions referenced non-existent table "vibes".
--    The correct table is public.event_vibes.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_vibe(ev_id uuid, uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.event_vibes (event_id, user_id)
  VALUES (ev_id, uid)
  ON CONFLICT (event_id, user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_vibe(ev_id uuid, uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  DELETE FROM public.event_vibes
  WHERE event_id = ev_id AND user_id = uid;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- F. EVENT RSVPS — Add 'maybe' to status CHECK constraint
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.event_rsvps DROP CONSTRAINT IF EXISTS event_rsvps_status_check;
ALTER TABLE public.event_rsvps DROP CONSTRAINT IF EXISTS event_rsvps_status_check1;
ALTER TABLE public.event_rsvps
  ADD CONSTRAINT event_rsvps_status_check
  CHECK (status IN ('going', 'interested', 'not_going', 'maybe'));

-- ────────────────────────────────────────────────────────────
-- G. PROFILES — update_profile() RPC
--    Used as Tier 3 fallback in UserManager.updateProfile.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_profile(
  p_user_id UUID,
  p_updates  JSONB
)
RETURNS public.profiles
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_profile public.profiles;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found: %', p_user_id;
  END IF;

  -- Populate the record with any fields present in the JSON object
  v_profile := jsonb_populate_record(v_profile, p_updates);

  -- Guard: never let the caller change the primary key
  v_profile.id := p_user_id;

  UPDATE public.profiles
  SET
    username           = v_profile.username,
    display_name       = v_profile.display_name,
    avatar_url         = v_profile.avatar_url,
    cover_url          = v_profile.cover_url,
    bio                = v_profile.bio,
    location           = v_profile.location,
    website            = v_profile.website,
    interests          = v_profile.interests,
    looks_description  = v_profile.looks_description,
    career_title       = v_profile.career_title,
    career_description = v_profile.career_description,
    gender             = v_profile.gender,
    birth_year         = v_profile.birth_year,
    looking_for        = v_profile.looking_for,
    preferred_areas    = v_profile.preferred_areas,
    profile_gallery    = v_profile.profile_gallery,
    wallet_balance     = v_profile.wallet_balance,
    current_streak     = v_profile.current_streak,
    last_active        = v_profile.last_active,
    updated_at         = now()
  WHERE id = p_user_id;

  RETURN v_profile;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- H. DAILY ACTIVITY — persist streak + last_active to profiles
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_daily_activity(p_user UUID)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_streak INT := 0;
  v_day    DATE;
  v_prev   DATE;
BEGIN
  -- Upsert today's activity record
  INSERT INTO public.daily_activity (user_id, day)
  VALUES (p_user, CURRENT_DATE)
  ON CONFLICT (user_id, day)
  DO UPDATE SET action_count = daily_activity.action_count + 1;

  -- Walk backwards through activity days to compute current streak
  FOR v_day IN
    SELECT day FROM public.daily_activity
    WHERE user_id = p_user
    ORDER BY day DESC
  LOOP
    IF v_streak = 0 THEN
      -- Allow today OR yesterday to start a streak
      IF v_day = CURRENT_DATE OR v_day = CURRENT_DATE - 1 THEN
        v_streak := 1; v_prev := v_day;
      ELSE EXIT;
      END IF;
    ELSE
      IF v_day = v_prev - 1 THEN
        v_streak := v_streak + 1; v_prev := v_day;
      ELSE EXIT;
      END IF;
    END IF;
  END LOOP;

  -- Persist the computed streak and refresh last_active on the profile
  UPDATE public.profiles
  SET
    current_streak = v_streak,
    last_active    = CURRENT_DATE
  WHERE id = p_user;

  RETURN v_streak;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- I. TRUST LEDGER — get_follower_integrity_aggregate()
--    Returns the average SIS score of all followers as JSONB
--    so that JS code can access data.aggregate_score directly.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_follower_integrity_aggregate(u_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_score NUMERIC;
BEGIN
  SELECT COALESCE(AVG(p.social_integrity_score), 0.0)
  INTO v_score
  FROM public.follows f
  JOIN public.profiles p ON p.id = f.follower_id
  WHERE f.following_id = u_id;

  RETURN jsonb_build_object('aggregate_score', v_score);
END;
$$;

-- ────────────────────────────────────────────────────────────
-- J. ECONOMY — get_economic_velocity()
--    Returns a JSONB object { velocity: numeric }.
--    Velocity = 24-hour transaction volume / total wallet supply.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_economic_velocity()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_volume   NUMERIC;
  v_supply   NUMERIC;
  v_velocity NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount), 0.0) INTO v_volume
  FROM public.wallet_transactions
  WHERE created_at >= now() - INTERVAL '1 day';

  SELECT COALESCE(SUM(wallet_balance), 0.0) INTO v_supply
  FROM public.profiles;

  IF v_supply = 0 THEN
    v_velocity := 0.0;
  ELSE
    v_velocity := ABS(v_volume) / v_supply;
  END IF;

  RETURN jsonb_build_object('velocity', v_velocity);
END;
$$;

-- ────────────────────────────────────────────────────────────
-- K. ECONOMY — get_precision_economic_metrics()
--    Returns total credited (minted) and debited (burned) amounts
--    from wallet_transactions, used by the CEO sovereign audit.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_precision_economic_metrics()
RETURNS TABLE (total_minted NUMERIC, total_burned NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(amount) FILTER (WHERE direction = 'credit'), 0.0)::NUMERIC AS total_minted,
    COALESCE(SUM(amount) FILTER (WHERE direction = 'debit'),  0.0)::NUMERIC AS total_burned
  FROM public.wallet_transactions;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- L. ECONOMY — Extend global_economy_params table
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.global_economy_params
  ADD COLUMN IF NOT EXISTS war_chest_balance NUMERIC     DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS last_decay_at     TIMESTAMPTZ;

-- ────────────────────────────────────────────────────────────
-- M. ECONOMY — distribute_to_war_chest(amount)
--    Accrues funds to the global war chest balance.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.distribute_to_war_chest(amount NUMERIC)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  UPDATE public.global_economy_params
  SET war_chest_balance = COALESCE(war_chest_balance, 0.0) + amount;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- N. ECONOMY — apply_vibe_decay()
--    Rate-limited to once per 24 hours.  Uses vibe_tax_rate from
--    global_economy_params as the daily decay factor.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_vibe_decay()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_last_decay TIMESTAMPTZ;
  v_decay_rate FLOAT;
BEGIN
  SELECT last_decay_at, vibe_tax_rate
  INTO v_last_decay, v_decay_rate
  FROM public.global_economy_params
  LIMIT 1;

  IF v_decay_rate IS NULL THEN
    v_decay_rate := 0.05;
  END IF;

  -- Guard: only run if 24 h have elapsed since last decay
  IF v_last_decay IS NULL OR v_last_decay <= now() - INTERVAL '1 day' THEN

    -- Decay vibe_score for every profile (floor to 0)
    UPDATE public.profiles
    SET vibe_score = GREATEST(0, ROUND(vibe_score * (1.0 - v_decay_rate)))::INTEGER;

    -- Record when decay last ran
    IF EXISTS (SELECT 1 FROM public.global_economy_params) THEN
      UPDATE public.global_economy_params
      SET last_decay_at = now();
    ELSE
      INSERT INTO public.global_economy_params (vibe_tax_rate, last_decay_at)
      VALUES (v_decay_rate, now());
    END IF;

  END IF;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- O. WALLET — increment_wallet_balance(user_id, amount)
--    Atomically bumps wallet_balance and logs a credit transaction.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_wallet_balance(
  user_id UUID,
  amount  NUMERIC
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_new_bal NUMERIC;
BEGIN
  UPDATE public.profiles
  SET wallet_balance = COALESCE(wallet_balance, 0.0) + amount
  WHERE id = user_id
  RETURNING wallet_balance INTO v_new_bal;

  INSERT INTO public.wallet_transactions
    (user_id, amount, direction, reason, balance_after)
  VALUES
    (user_id, amount, 'credit', 'Escrow Release / Earnings', v_new_bal);
END;
$$;

-- ────────────────────────────────────────────────────────────
-- P. SOCIAL GRAPH — Overloaded follow_user / unfollow_user
--    Accepts either (p_follower, p_following) or
--    (p_follower_id, p_following_id) — or a mix — via COALESCEs.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.follow_user(
  p_follower    UUID DEFAULT NULL,
  p_following   UUID DEFAULT NULL,
  p_follower_id UUID DEFAULT NULL,
  p_following_id UUID DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_follower  UUID;
  v_following UUID;
BEGIN
  v_follower  := COALESCE(p_follower,  p_follower_id);
  v_following := COALESCE(p_following, p_following_id);

  IF v_follower IS NULL OR v_following IS NULL THEN
    RAISE EXCEPTION 'Both follower and following IDs must be provided.';
  END IF;

  INSERT INTO public.follows (follower_id, following_id)
  VALUES (v_follower, v_following)
  ON CONFLICT (follower_id, following_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.unfollow_user(
  p_follower    UUID DEFAULT NULL,
  p_following   UUID DEFAULT NULL,
  p_follower_id UUID DEFAULT NULL,
  p_following_id UUID DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_follower  UUID;
  v_following UUID;
BEGIN
  v_follower  := COALESCE(p_follower,  p_follower_id);
  v_following := COALESCE(p_following, p_following_id);

  IF v_follower IS NULL OR v_following IS NULL THEN
    RAISE EXCEPTION 'Both follower and following IDs must be provided.';
  END IF;

  DELETE FROM public.follows
  WHERE follower_id = v_follower AND following_id = v_following;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- DONE — Pin search_path on every new function for safety
-- ────────────────────────────────────────────────────────────
DO $$ DECLARE f RECORD; BEGIN
  FOR f IN
    SELECT routine_name FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
      AND routine_name IN (
        'resolve_message_room', 'enforce_message_limits',
        'update_profile', 'record_daily_activity',
        'get_follower_integrity_aggregate', 'get_economic_velocity',
        'get_precision_economic_metrics', 'distribute_to_war_chest',
        'apply_vibe_decay', 'increment_wallet_balance',
        'follow_user', 'unfollow_user',
        'increment_vibe', 'decrement_vibe'
      )
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION public.%I SET search_path = public', f.routine_name);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────
-- Q. STORAGE BUCKETS & RLS POLICIES FOR REELS & STORIES
-- ────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('reels', 'reels', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('stories', 'stories', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies for reels and stories to avoid duplication errors
DROP POLICY IF EXISTS "Reels public read" ON storage.objects;
DROP POLICY IF EXISTS "Reels owner write" ON storage.objects;
DROP POLICY IF EXISTS "Stories public read" ON storage.objects;
DROP POLICY IF EXISTS "Stories owner write" ON storage.objects;

-- ── Reels Storage ──
CREATE POLICY "Reels public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'reels');

CREATE POLICY "Reels owner write" ON storage.objects
  FOR ALL USING (
    bucket_id = 'reels'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'reels'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── Stories Storage ──
CREATE POLICY "Stories public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'stories');

CREATE POLICY "Stories owner write" ON storage.objects
  FOR ALL USING (
    bucket_id = 'stories'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'stories'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

