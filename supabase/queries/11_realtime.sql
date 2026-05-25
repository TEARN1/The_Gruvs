-- ============================================================
--  THE GRUVS — 11: REALTIME PUBLICATIONS
--  Enable Supabase Realtime for all tables that need live updates
-- ============================================================

-- ── Enable Realtime for all key tables ───────────────────────
DO $$ BEGIN
  -- Social core
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='profiles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='follows') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.follows; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; END IF;

  -- Events
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='events') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.events; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='event_vibes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_vibes; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='event_rsvps') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_rsvps; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='event_checkins') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_checkins; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='live_checkins') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_checkins; END IF;

  -- Pulse (live voting)
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='pulse_requests') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pulse_requests; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='pulse_votes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pulse_votes; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='pulse_schedules') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pulse_schedules; END IF;

  -- Chat & DMs
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='dm_rooms') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_rooms; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='dm_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_messages; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='event_chat_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_chat_messages; END IF;

  -- Reels
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='reels') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reels; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='reel_likes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reel_likes; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='reel_comments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reel_comments; END IF;

  -- Moments & stories
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='event_moments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_moments; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='stories') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stories; END IF;

  -- Echoes & reactions
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='echoes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.echoes; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='echo_likes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.echo_likes; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='event_reactions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_reactions; END IF;

  -- Movement OS
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='paths') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.paths; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='path_crossings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.path_crossings; END IF;

  -- Services & gigs
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='service_nodes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.service_nodes; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='service_bookings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.service_bookings; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='gig_posts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.gig_posts; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='gig_acceptances') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.gig_acceptances; END IF;

  -- Activity & polls
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='activity_feed') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_feed; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='event_polls') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_polls; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='poll_votes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes; END IF;

  -- Wallet
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='wallet_transactions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_transactions; END IF;

  -- Trending
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='trending_events') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trending_events; END IF;

  -- Notification queue (user sees their push notif land live)
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='notification_queue') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_queue; END IF;
END $$;
