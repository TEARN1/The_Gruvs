-- ═══════════════════════════════════════════════════════════════════════════
-- event_drafts.sql — the co-creation spine (features 41–48).
--
-- A group plans an event TOGETHER inside their chat: a shared draft object,
-- per-field attribution ("Thabo set the venue"), field claiming, a readiness
-- checklist, N-member launch confirmation, and a launch RPC that promotes the
-- draft into a real row in public.events + co-host roles in event_roles.
--
-- Security posture (per MESSAGING_FEATURES_SECURITY.md):
--   * ALL writes go through SECURITY DEFINER RPCs; the tables have NO
--     INSERT/UPDATE/DELETE policies for authenticated. Attribution
--     (who filled which field) is stamped server-side from auth.uid() and can
--     never be client-supplied — class-A (provenance forgery) closed at the root.
--   * Launch confirmations are one row per member inserted by that member's own
--     session; the launch RPC COUNTS rows. The client never submits a count —
--     class-B (state-machine cheating, the vibe-farming class) closed.
--   * Field values are allowlisted by name, length-capped, and drafts are
--     frozen once launched (one-way status). Member cap + active-draft cap
--     bound resource abuse on the free tier.
--
-- Idempotent, safe to re-run. Add to DEPLOY_SQL_RUNBOOK.md (independent).
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────
-- 1. Tables.
--    field_meta: { "<field>": { by, at, claimed_by, claimed_at } } — written
--    ONLY by the RPCs below, so its contents are trustworthy attribution.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_drafts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  crew_id      uuid REFERENCES public.crews(id) ON DELETE SET NULL,
  status       text NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft','launched','shelved')),
  title        text CHECK (title IS NULL OR length(title) <= 200),
  description  text CHECK (description IS NULL OR length(description) <= 4000),
  category     text CHECK (category IS NULL OR length(category) <= 60),
  venue_name   text CHECK (venue_name IS NULL OR length(venue_name) <= 200),
  location     text CHECK (location IS NULL OR length(location) <= 300),
  event_date   date,
  event_time   text CHECK (event_time IS NULL OR length(event_time) <= 20),
  cover_url    text CHECK (cover_url IS NULL OR length(cover_url) <= 2048),
  price        text CHECK (price IS NULL OR length(price) <= 100),
  capacity     integer CHECK (capacity IS NULL OR (capacity > 0 AND capacity <= 1000000)),
  min_age      integer CHECK (min_age IS NULL OR (min_age >= 0 AND min_age <= 99)),
  field_meta   jsonb NOT NULL DEFAULT '{}'::jsonb,
  launched_event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_draft_members (
  draft_id   uuid NOT NULL REFERENCES public.event_drafts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'editor' CHECK (role IN ('owner','editor')),
  added_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (draft_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.event_draft_confirms (
  draft_id   uuid NOT NULL REFERENCES public.event_drafts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (draft_id, user_id)
);

CREATE INDEX IF NOT EXISTS event_draft_members_user_idx
  ON public.event_draft_members (user_id);
CREATE INDEX IF NOT EXISTS event_drafts_creator_active_idx
  ON public.event_drafts (created_by) WHERE status = 'draft';


-- ─────────────────────────────────────────────────────────────────────────
-- 2. RLS: members read, NOBODY writes directly. Every mutation is an RPC.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.event_drafts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_draft_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_draft_confirms ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_draft_member(p_draft uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_draft_members
    WHERE draft_id = p_draft AND user_id = auth.uid()
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_draft_member(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.is_draft_member(uuid) TO authenticated;

DROP POLICY IF EXISTS drafts_select_members ON public.event_drafts;
CREATE POLICY drafts_select_members ON public.event_drafts
  FOR SELECT USING (public.is_draft_member(id));

DROP POLICY IF EXISTS draft_members_select ON public.event_draft_members;
CREATE POLICY draft_members_select ON public.event_draft_members
  FOR SELECT USING (public.is_draft_member(draft_id));

DROP POLICY IF EXISTS draft_confirms_select ON public.event_draft_confirms;
CREATE POLICY draft_confirms_select ON public.event_draft_confirms
  FOR SELECT USING (public.is_draft_member(draft_id));


-- ─────────────────────────────────────────────────────────────────────────
-- 3. Create a draft. Creator becomes owner-member. Caps: 10 active drafts
--    per creator (free-tier abuse bound).
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.draft_create(p_crew_id uuid DEFAULT NULL, p_title text DEFAULT NULL)
RETURNS public.event_drafts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  d   public.event_drafts;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;

  IF (SELECT count(*) FROM public.event_drafts
      WHERE created_by = uid AND status = 'draft') >= 10 THEN
    RAISE EXCEPTION 'Too many open drafts — launch or shelve one first.';
  END IF;

  IF p_crew_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.crews c
    WHERE c.id = p_crew_id
      AND (c.owner_id = uid OR EXISTS (
        SELECT 1 FROM public.crew_members m
        WHERE m.crew_id = c.id AND m.user_id = uid
      ))
  ) THEN
    -- Any member of the crew may plan under the crew's banner (feature 73).
    RAISE EXCEPTION 'not a member of this crew';
  END IF;

  INSERT INTO public.event_drafts (created_by, crew_id, title, field_meta)
  VALUES (uid, p_crew_id, NULLIF(btrim(COALESCE(p_title,'')), ''),
          CASE WHEN NULLIF(btrim(COALESCE(p_title,'')), '') IS NULL THEN '{}'::jsonb
               ELSE jsonb_build_object('title', jsonb_build_object('by', uid, 'at', now())) END)
  RETURNING * INTO d;

  INSERT INTO public.event_draft_members (draft_id, user_id, role, added_by)
  VALUES (d.id, uid, 'owner', uid);

  RETURN d;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Add a member. Any member may invite (it's their group chat), capped at
--    25, and the invitee must not have blocked (or be blocked by) the inviter.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.draft_add_member(p_draft uuid, p_user uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  IF NOT public.is_draft_member(p_draft) THEN RAISE EXCEPTION 'not a member of this draft'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.event_drafts WHERE id = p_draft AND status = 'draft') THEN
    RAISE EXCEPTION 'this draft is closed';
  END IF;
  IF (SELECT count(*) FROM public.event_draft_members WHERE draft_id = p_draft) >= 25 THEN
    RAISE EXCEPTION 'draft is full (25 collaborators max)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (blocker_id = p_user AND blocked_id = uid)
       OR (blocker_id = uid    AND blocked_id = p_user)
  ) THEN
    RAISE EXCEPTION 'cannot add this user';
  END IF;

  INSERT INTO public.event_draft_members (draft_id, user_id, role, added_by)
  VALUES (p_draft, p_user, 'editor', uid)
  ON CONFLICT DO NOTHING;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Set a field (feature 42) / claim a field (feature 43). Field names are
--    allowlisted; attribution is stamped from auth.uid() server-side. Any
--    change to the draft voids all launch confirmations — nobody launches a
--    version other members didn't see.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.draft_set_field(p_draft uuid, p_field text, p_value text)
RETURNS public.event_drafts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid   uuid := auth.uid();
  d     public.event_drafts;
  clean text := NULLIF(btrim(COALESCE(p_value,'')), '');
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  IF NOT public.is_draft_member(p_draft) THEN RAISE EXCEPTION 'not a member of this draft'; END IF;
  IF p_field NOT IN ('title','description','category','venue_name','location',
                     'event_date','event_time','cover_url','price','capacity','min_age') THEN
    RAISE EXCEPTION 'unknown draft field: %', p_field;
  END IF;

  SELECT * INTO d FROM public.event_drafts WHERE id = p_draft FOR UPDATE;
  IF d.status <> 'draft' THEN RAISE EXCEPTION 'this draft is closed'; END IF;

  -- Respect an active claim by someone else (feature 43).
  IF (d.field_meta -> p_field ->> 'claimed_by') IS NOT NULL
     AND (d.field_meta -> p_field ->> 'claimed_by')::uuid <> uid
     AND (d.field_meta -> p_field ->> 'claimed_at')::timestamptz > now() - interval '15 minutes' THEN
    RAISE EXCEPTION 'this field is being handled by someone else right now';
  END IF;

  -- Typed casts raise cleanly on bad input; CHECK constraints cap lengths.
  EXECUTE format(
    'UPDATE public.event_drafts SET %I = $1%s, updated_at = now(),
       field_meta = field_meta || jsonb_build_object($2::text,
         jsonb_build_object(''by'', $3::uuid, ''at'', now()))
     WHERE id = $4',
    p_field,
    CASE p_field WHEN 'event_date' THEN '::date'
                 WHEN 'capacity'   THEN '::integer'
                 WHEN 'min_age'    THEN '::integer'
                 ELSE '' END)
  USING clean, p_field, uid, p_draft;

  -- New content voids prior confirmations.
  DELETE FROM public.event_draft_confirms WHERE draft_id = p_draft;

  SELECT * INTO d FROM public.event_drafts WHERE id = p_draft;
  RETURN d;
END;
$$;

CREATE OR REPLACE FUNCTION public.draft_claim_field(p_draft uuid, p_field text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  IF NOT public.is_draft_member(p_draft) THEN RAISE EXCEPTION 'not a member of this draft'; END IF;
  IF p_field NOT IN ('title','description','category','venue_name','location',
                     'event_date','event_time','cover_url','price','capacity','min_age') THEN
    RAISE EXCEPTION 'unknown draft field: %', p_field;
  END IF;

  UPDATE public.event_drafts
  SET field_meta = field_meta || jsonb_build_object(p_field,
        COALESCE(field_meta -> p_field, '{}'::jsonb)
        || jsonb_build_object('claimed_by', uid, 'claimed_at', now())),
      updated_at = now()
  WHERE id = p_draft AND status = 'draft';
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Confirm launch (feature 47, arm step). One row per member, own session
--    only. Voided automatically by any later edit (section 5).
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.draft_confirm_launch(p_draft uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  IF NOT public.is_draft_member(p_draft) THEN RAISE EXCEPTION 'not a member of this draft'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.event_drafts WHERE id = p_draft AND status = 'draft') THEN
    RAISE EXCEPTION 'this draft is closed';
  END IF;

  INSERT INTO public.event_draft_confirms (draft_id, user_id)
  VALUES (p_draft, uid) ON CONFLICT DO NOTHING;

  RETURN (SELECT count(*) FROM public.event_draft_confirms WHERE draft_id = p_draft);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Launch (feature 47/48). Readiness checklist enforced server-side;
--    confirmations counted from rows; promotes to public.events and grants
--    co_host to every other member. Idempotent: relaunching returns the
--    already-launched event.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.draft_launch(p_draft uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid          uuid := auth.uid();
  d            public.event_drafts;
  member_count integer;
  needed       integer;
  confirms     integer;
  ev_id        uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  IF NOT public.is_draft_member(p_draft) THEN RAISE EXCEPTION 'not a member of this draft'; END IF;

  SELECT * INTO d FROM public.event_drafts WHERE id = p_draft FOR UPDATE;
  IF d.status = 'launched' THEN RETURN d.launched_event_id; END IF;
  IF d.status <> 'draft' THEN RAISE EXCEPTION 'this draft is closed'; END IF;

  -- Readiness checklist (feature 46) — the server is the checklist.
  IF d.title IS NULL      THEN RAISE EXCEPTION 'missing: title'; END IF;
  IF d.event_date IS NULL THEN RAISE EXCEPTION 'missing: date'; END IF;
  IF d.event_date < current_date THEN RAISE EXCEPTION 'date is in the past'; END IF;
  IF d.location IS NULL AND d.venue_name IS NULL THEN RAISE EXCEPTION 'missing: location'; END IF;

  SELECT count(*) INTO member_count FROM public.event_draft_members WHERE draft_id = p_draft;
  needed := LEAST(2, member_count);
  SELECT count(*) INTO confirms FROM public.event_draft_confirms WHERE draft_id = p_draft;
  IF confirms < needed THEN
    RAISE EXCEPTION 'launch needs % confirmation(s), has %', needed, confirms;
  END IF;

  INSERT INTO public.events
    (author_id, title, description, category, venue_name, location,
     event_date, event_time, date_time, cover_url, price, capacity,
     min_age, age_restriction, is_published)
  VALUES
    (d.created_by, d.title, d.description, d.category, d.venue_name, d.location,
     d.event_date, d.event_time,
     (d.event_date::text || ' ' || COALESCE(NULLIF(d.event_time,''), '00:00'))::timestamptz,
     d.cover_url, d.price, d.capacity,
     d.min_age, d.min_age, true)
  RETURNING id INTO ev_id;

  -- Everyone who built it gets a seat at the table (feature 48).
  INSERT INTO public.event_roles (event_id, user_id, role, granted_by)
  SELECT ev_id, m.user_id, 'co_host', d.created_by
  FROM public.event_draft_members m
  WHERE m.draft_id = p_draft AND m.user_id <> d.created_by
  ON CONFLICT DO NOTHING;

  UPDATE public.event_drafts
  SET status = 'launched', launched_event_id = ev_id, updated_at = now()
  WHERE id = p_draft;

  RETURN ev_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Shelve (feature 49) — owner only, reversible back to draft by owner.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.draft_set_status(p_draft uuid, p_status text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  IF p_status NOT IN ('draft','shelved') THEN RAISE EXCEPTION 'invalid status'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.event_draft_members
    WHERE draft_id = p_draft AND user_id = uid AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'only the draft owner can do that';
  END IF;

  UPDATE public.event_drafts
  SET status = p_status, updated_at = now()
  WHERE id = p_draft AND status <> 'launched';  -- launched is forever
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 9. Grants. RPC-only surface: authenticated may execute, may not write rows.
-- ─────────────────────────────────────────────────────────────────────────
REVOKE ALL ON public.event_drafts, public.event_draft_members, public.event_draft_confirms
  FROM public, anon;
GRANT SELECT ON public.event_drafts, public.event_draft_members, public.event_draft_confirms
  TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.event_drafts, public.event_draft_members, public.event_draft_confirms
  FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.draft_create(uuid,text)            FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.draft_add_member(uuid,uuid)        FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.draft_set_field(uuid,text,text)    FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.draft_claim_field(uuid,text)       FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.draft_confirm_launch(uuid)         FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.draft_launch(uuid)                 FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.draft_set_status(uuid,text)        FROM public, anon;
GRANT EXECUTE ON FUNCTION public.draft_create(uuid,text)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.draft_add_member(uuid,uuid)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.draft_set_field(uuid,text,text)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.draft_claim_field(uuid,text)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.draft_confirm_launch(uuid)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.draft_launch(uuid)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.draft_set_status(uuid,text)         TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 10. "Run it back" (features 50/70): fork a past event into a fresh
--     pre-filled draft. Only someone who actually ran the event (author or
--     co_host) may fork it — you can't clone someone else's event. The date
--     is deliberately NOT copied (a rerun needs a new date, and launch
--     rejects past dates anyway). Copied fields are attributed to the forker.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.draft_fork_event(p_event uuid, p_crew_id uuid DEFAULT NULL)
RETURNS public.event_drafts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  ev  public.events;
  d   public.event_drafts;
  stamp jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;

  SELECT * INTO ev FROM public.events
  WHERE id = p_event
    AND (author_id = uid OR EXISTS (
      SELECT 1 FROM public.event_roles r
      WHERE r.event_id = p_event AND r.user_id = uid AND r.role = 'co_host'
    ));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'you can only run back an event you hosted';
  END IF;

  IF (SELECT count(*) FROM public.event_drafts
      WHERE created_by = uid AND status = 'draft') >= 10 THEN
    RAISE EXCEPTION 'Too many open drafts — launch or shelve one first.';
  END IF;

  IF p_crew_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.crews c
    WHERE c.id = p_crew_id
      AND (c.owner_id = uid OR EXISTS (
        SELECT 1 FROM public.crew_members m
        WHERE m.crew_id = c.id AND m.user_id = uid
      ))
  ) THEN
    RAISE EXCEPTION 'not a member of this crew';
  END IF;

  stamp := jsonb_build_object('by', uid, 'at', now());

  INSERT INTO public.event_drafts
    (created_by, crew_id, title, description, category, venue_name, location,
     event_time, cover_url, price, capacity, min_age, field_meta)
  VALUES
    (uid, p_crew_id,
     left(ev.title, 200), left(ev.description, 4000), left(ev.category, 60),
     left(ev.venue_name, 200), left(ev.location, 300),
     left(ev.event_time, 20), left(COALESCE(ev.cover_url, ev.image_url), 2048),
     left(ev.price, 100),
     CASE WHEN ev.capacity BETWEEN 1 AND 1000000 THEN ev.capacity END,
     CASE WHEN COALESCE(ev.min_age, ev.age_restriction) BETWEEN 0 AND 99
          THEN COALESCE(ev.min_age, ev.age_restriction) END,
     (SELECT COALESCE(jsonb_object_agg(f, stamp), '{}'::jsonb)
      FROM unnest(ARRAY['title','description','category','venue_name','location',
                        'event_time','cover_url','price','capacity','min_age']) f))
  RETURNING * INTO d;

  INSERT INTO public.event_draft_members (draft_id, user_id, role, added_by)
  VALUES (d.id, uid, 'owner', uid);

  RETURN d;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.draft_fork_event(uuid,uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.draft_fork_event(uuid,uuid) TO authenticated;


-- Realtime for live co-editing (feature 42): the client subscribes to
-- postgres_changes on event_drafts; RLS gates who receives what.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_drafts;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
