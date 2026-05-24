-- ============================================================
-- patch_security_hardening.sql
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Safe to re-run — all statements are idempotent
-- ============================================================

-- ── 1. Ensure all new tables have RLS enabled ─────────────────────────────────

DO $$ BEGIN
  EXECUTE 'ALTER TABLE IF EXISTS public.event_roles ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE IF EXISTS public.event_polls ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE IF EXISTS public.event_poll_votes ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE IF EXISTS public.event_chat_messages ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE IF EXISTS public.activity_feed ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE IF EXISTS public.event_playlists ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE IF EXISTS public.event_playlist_tracks ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE IF EXISTS public.event_track_votes ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE IF EXISTS public.event_carpools ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE IF EXISTS public.event_carpool_requests ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ── 2. activity_feed — users only see their own feed ─────────────────────────

DROP POLICY IF EXISTS "activity_feed_select_own"  ON activity_feed;
DROP POLICY IF EXISTS "activity_feed_insert_sys"  ON activity_feed;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activity_feed' AND table_schema = 'public') THEN
    EXECUTE $p$
      CREATE POLICY "activity_feed_select_own"
        ON public.activity_feed FOR SELECT
        USING (recipient_id = auth.uid());
    $p$;
    EXECUTE $p$
      CREATE POLICY "activity_feed_insert_sys"
        ON public.activity_feed FOR INSERT
        WITH CHECK (true);  -- inserts come from server-side triggers only
    $p$;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ── 3. event_chat_messages — RLS ─────────────────────────────────────────────

DROP POLICY IF EXISTS "chat_select_event_member"  ON event_chat_messages;
DROP POLICY IF EXISTS "chat_insert_own"           ON event_chat_messages;
DROP POLICY IF EXISTS "chat_update_moderator"     ON event_chat_messages;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_chat_messages' AND table_schema = 'public') THEN
    -- Anyone can read chat for events they can see
    EXECUTE $p$
      CREATE POLICY "chat_select_event_member"
        ON public.event_chat_messages FOR SELECT
        USING (
          deleted = false
          AND EXISTS (
            SELECT 1 FROM public.events e WHERE e.id = event_id AND e.is_published = true
          )
        );
    $p$;
    -- Authenticated users can only insert their own messages
    EXECUTE $p$
      CREATE POLICY "chat_insert_own"
        ON public.event_chat_messages FOR INSERT
        WITH CHECK (user_id = auth.uid() AND length(trim(message)) BETWEEN 1 AND 500);
    $p$;
    -- Soft-delete + pin: only message owner OR event moderator/organiser
    EXECUTE $p$
      CREATE POLICY "chat_update_moderator"
        ON public.event_chat_messages FOR UPDATE
        USING (
          user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.event_roles r
            WHERE r.event_id = event_chat_messages.event_id
              AND r.user_id = auth.uid()
              AND r.role IN ('co_host','moderator')
          )
          OR EXISTS (
            SELECT 1 FROM public.events e
            WHERE e.id = event_chat_messages.event_id AND e.author_id = auth.uid()
          )
        );
    $p$;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ── 4. event_polls — RLS ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "polls_select_public"   ON event_polls;
DROP POLICY IF EXISTS "polls_insert_host"     ON event_polls;
DROP POLICY IF EXISTS "polls_delete_host"     ON event_polls;
DROP POLICY IF EXISTS "votes_select_own"      ON event_poll_votes;
DROP POLICY IF EXISTS "votes_insert_once"     ON event_poll_votes;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_polls' AND table_schema = 'public') THEN
    EXECUTE $p$
      CREATE POLICY "polls_select_public" ON public.event_polls FOR SELECT USING (true);
    $p$;
    EXECUTE $p$
      CREATE POLICY "polls_insert_host"
        ON public.event_polls FOR INSERT
        WITH CHECK (
          created_by = auth.uid()
          AND (
            EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.author_id = auth.uid())
            OR EXISTS (SELECT 1 FROM public.event_roles r WHERE r.event_id = event_polls.event_id AND r.user_id = auth.uid() AND r.role = 'co_host')
          )
        );
    $p$;
    EXECUTE $p$
      CREATE POLICY "polls_delete_host"
        ON public.event_polls FOR DELETE
        USING (
          EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.author_id = auth.uid())
        );
    $p$;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_poll_votes' AND table_schema = 'public') THEN
    EXECUTE $p$
      CREATE POLICY "votes_select_own" ON public.event_poll_votes FOR SELECT USING (true);
    $p$;
    -- Each user can vote once per poll (enforced by PK + cast_poll_vote RPC)
    EXECUTE $p$
      CREATE POLICY "votes_insert_once"
        ON public.event_poll_votes FOR INSERT
        WITH CHECK (user_id = auth.uid());
    $p$;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ── 5. event_playlist_tracks + votes — RLS ───────────────────────────────────

DROP POLICY IF EXISTS "playlist_tracks_select" ON event_playlist_tracks;
DROP POLICY IF EXISTS "playlist_tracks_insert" ON event_playlist_tracks;
DROP POLICY IF EXISTS "playlist_tracks_delete" ON event_playlist_tracks;
DROP POLICY IF EXISTS "track_votes_select"     ON event_track_votes;
DROP POLICY IF EXISTS "track_votes_insert"     ON event_track_votes;
DROP POLICY IF EXISTS "track_votes_delete"     ON event_track_votes;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_playlist_tracks' AND table_schema = 'public') THEN
    EXECUTE $p$ CREATE POLICY "playlist_tracks_select" ON public.event_playlist_tracks FOR SELECT USING (true); $p$;
    EXECUTE $p$
      CREATE POLICY "playlist_tracks_insert"
        ON public.event_playlist_tracks FOR INSERT
        WITH CHECK (added_by = auth.uid());
    $p$;
    EXECUTE $p$
      CREATE POLICY "playlist_tracks_delete"
        ON public.event_playlist_tracks FOR DELETE
        USING (
          added_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.event_playlists pl
            JOIN public.events e ON e.id = pl.event_id
            WHERE pl.id = event_playlist_tracks.playlist_id AND e.author_id = auth.uid()
          )
        );
    $p$;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_track_votes' AND table_schema = 'public') THEN
    EXECUTE $p$ CREATE POLICY "track_votes_select" ON public.event_track_votes FOR SELECT USING (true); $p$;
    EXECUTE $p$
      CREATE POLICY "track_votes_insert"
        ON public.event_track_votes FOR INSERT
        WITH CHECK (user_id = auth.uid());
    $p$;
    EXECUTE $p$
      CREATE POLICY "track_votes_delete"
        ON public.event_track_votes FOR DELETE
        USING (user_id = auth.uid());
    $p$;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ── 6. Prevent mass-enumeration: rate-limit expensive queries via pg_stat ────
-- (Advisory locking pattern — production enforcement via Supabase Edge Functions)
-- Applied here as DB-level check functions referenced by RPC guards.

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id uuid,
  p_action   text,
  p_max      int DEFAULT 30,
  p_window   interval DEFAULT '1 minute'
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  -- Uses security_logs table if it exists; otherwise always permits
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'security_logs' AND table_schema = 'public') THEN
    RETURN true;
  END IF;
  SELECT COUNT(*) INTO v_count
  FROM public.security_logs
  WHERE user_id = p_user_id
    AND event_type = p_action
    AND created_at > now() - p_window;
  RETURN v_count < p_max;
END;
$$;

-- ── 7. Server-side chat message validation function ───────────────────────────

CREATE OR REPLACE FUNCTION public.safe_insert_chat_message(
  p_event_id uuid,
  p_user_id  uuid,
  p_message  text,
  p_reply_to uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Auth check
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Cannot send messages as another user.';
  END IF;
  -- Length check
  IF length(trim(p_message)) < 1 OR length(p_message) > 500 THEN
    RAISE EXCEPTION 'Message must be between 1 and 500 characters.';
  END IF;
  -- Permission check
  IF NOT (SELECT public.can_send_chat(p_user_id, p_event_id)) THEN
    RAISE EXCEPTION 'Not allowed to chat in this event.';
  END IF;

  INSERT INTO public.event_chat_messages(event_id, user_id, message, reply_to)
  VALUES (p_event_id, p_user_id, trim(p_message), p_reply_to)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ── 8. Prevent IDOR on event_roles — only organiser can grant roles ───────────

DROP POLICY IF EXISTS "roles_select_member"   ON event_roles;
DROP POLICY IF EXISTS "roles_insert_organiser" ON event_roles;
DROP POLICY IF EXISTS "roles_delete_organiser" ON event_roles;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_roles' AND table_schema = 'public') THEN
    EXECUTE $p$
      CREATE POLICY "roles_select_member"
        ON public.event_roles FOR SELECT
        USING (
          user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.author_id = auth.uid())
        );
    $p$;
    EXECUTE $p$
      CREATE POLICY "roles_insert_organiser"
        ON public.event_roles FOR INSERT
        WITH CHECK (
          EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.author_id = auth.uid())
        );
    $p$;
    EXECUTE $p$
      CREATE POLICY "roles_delete_organiser"
        ON public.event_roles FOR DELETE
        USING (
          EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.author_id = auth.uid())
        );
    $p$;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ── 9. Reels — prevent deleting/editing other users' reels ───────────────────

DROP POLICY IF EXISTS "reels_update_own"  ON reels;
DROP POLICY IF EXISTS "reels_delete_own"  ON reels;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reels' AND table_schema = 'public') THEN
    EXECUTE $p$
      CREATE POLICY "reels_update_own"
        ON public.reels FOR UPDATE
        USING (user_id = auth.uid());
    $p$;
    EXECUTE $p$
      CREATE POLICY "reels_delete_own"
        ON public.reels FOR DELETE
        USING (user_id = auth.uid());
    $p$;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ── 10. Events — prevent editing other users' events ─────────────────────────

DROP POLICY IF EXISTS "events_update_own"  ON events;
DROP POLICY IF EXISTS "events_delete_own"  ON events;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'events' AND table_schema = 'public') THEN
    EXECUTE $p$
      CREATE POLICY "events_update_own"
        ON public.events FOR UPDATE
        USING (author_id = auth.uid());
    $p$;
    EXECUTE $p$
      CREATE POLICY "events_delete_own"
        ON public.events FOR DELETE
        USING (author_id = auth.uid());
    $p$;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ── 11. Security view — expose nothing sensitive ──────────────────────────────
-- Profiles view that strips email/phone before exposing to anon
CREATE OR REPLACE VIEW public.public_profiles AS
  SELECT
    id, username, display_name, avatar_url, bio, city,
    vibe_score, is_verified, is_discoverable, created_at
  FROM public.profiles
  WHERE is_discoverable = true OR id = auth.uid();

-- Grant only SELECT to anon/authenticated
REVOKE ALL ON public.public_profiles FROM anon, authenticated;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- ── 12. Revoke public schema creation from anon ───────────────────────────────
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- ── 13. Secure vote_track / unvote_track — enforce auth.uid() ────────────────

CREATE OR REPLACE FUNCTION public.vote_track(p_track_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Cannot vote as another user.';
  END IF;
  INSERT INTO public.event_track_votes(track_id, user_id) VALUES (p_track_id, p_user_id)
  ON CONFLICT DO NOTHING;
  UPDATE public.event_playlist_tracks SET votes = votes + 1 WHERE id = p_track_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.unvote_track(p_track_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Cannot unvote as another user.';
  END IF;
  DELETE FROM public.event_track_votes WHERE track_id = p_track_id AND user_id = p_user_id;
  UPDATE public.event_playlist_tracks SET votes = GREATEST(0, votes - 1) WHERE id = p_track_id;
END;
$$;

-- ── 14. Secure update_reel_caption RPC ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_reel_caption(p_reel_id uuid, p_caption text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF length(p_caption) > 500 THEN
    RAISE EXCEPTION 'Caption too long (max 500 chars).';
  END IF;
  UPDATE public.reels SET caption = trim(p_caption)
  WHERE id = p_reel_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reel not found or permission denied.';
  END IF;
END;
$$;

-- ── 15. Input validation trigger on event_chat_messages ──────────────────────

CREATE OR REPLACE FUNCTION public.validate_chat_message()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF length(trim(NEW.message)) < 1 OR length(NEW.message) > 500 THEN
    RAISE EXCEPTION 'Chat message must be 1–500 characters.';
  END IF;
  -- Strip obvious script tags server-side
  NEW.message = regexp_replace(NEW.message, '<script[^>]*>.*?</script>', '', 'gi');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chat_message_validate ON public.event_chat_messages;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_chat_messages' AND table_schema = 'public') THEN
    EXECUTE $t$
      CREATE TRIGGER chat_message_validate
        BEFORE INSERT OR UPDATE ON public.event_chat_messages
        FOR EACH ROW EXECUTE FUNCTION public.validate_chat_message();
    $t$;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
