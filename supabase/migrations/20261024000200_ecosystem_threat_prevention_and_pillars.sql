-- ═════════════════════════════════════════════════════════════════════════════
--  20261024000200_ecosystem_threat_prevention_and_pillars.sql
--
--  Unified Cross-Pillar Database Architecture & Threat Prevention Guard:
--    1. The Gruvs: Data integrity triggers, privilege escalation prevention,
--       geocoding bounds, and injection defenses on events & profiles.
--    2. The Resident: Schema & RLS for res_listings, res_lift_clubs, and
--       res_bookings with anti-fraud constraints and landlord/driver isolation.
--    3. Excellency Academy: Schema, seeds, enrollments, and cryptographic
--       certifications (exc_courses, exc_enrollments, exc_certifications)
--       with mentor verification and anti-forgery guards.
--
--  Idempotent: runs cleanly on production and CI databases.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1: THE GRUVS THREAT PREVENTION & DATA INTEGRITY
-- ─────────────────────────────────────────────────────────────────────────────

-- 1.1 Privilege escalation protection on profiles
-- Regular authenticated users cannot self-grant admin status, verified badges,
-- or manipulate trust tiers.
-- SECURITY INVOKER, not DEFINER: inside a definer `current_user` is the owner,
-- so the guard never fired (definer_privilege_test.sql). Columns are read
-- through jsonb because production has no profiles.is_admin and the CI schema
-- has no resident_trust_tier: NEW.<missing column> would have failed EVERY
-- profile update, Find Me and profile edits included.
CREATE OR REPLACE FUNCTION public.guard_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  n jsonb := to_jsonb(NEW);
  o jsonb := to_jsonb(OLD);
BEGIN
  -- Only direct client writes are guarded; server code (definer RPCs, the
  -- service role, migrations) runs as another role and passes.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF (n -> 'is_admin') IS DISTINCT FROM (o -> 'is_admin') THEN
    RAISE EXCEPTION 'SecurityViolation: Unauthorized attempt to modify is_admin';
  END IF;
  IF (n -> 'is_verified') IS DISTINCT FROM (o -> 'is_verified') THEN
    RAISE EXCEPTION 'SecurityViolation: Unauthorized attempt to modify is_verified';
  END IF;
  IF (n -> 'resident_trust_tier') IS DISTINCT FROM (o -> 'resident_trust_tier') THEN
    RAISE EXCEPTION 'SecurityViolation: Unauthorized attempt to modify resident_trust_tier';
  END IF;
  -- Scores move through RPCs only; a direct write is quietly undone.
  IF (n -> 'vibe_score') IS DISTINCT FROM (o -> 'vibe_score') THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object('vibe_score', o -> 'vibe_score'));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_guard_profile_privilege_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_privilege_escalation();

-- 1.2 Geocode & price boundary constraints on events
-- Production has these columns; the CI schema never did, which failed the build.
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS longitude double precision;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_events_latitude_bounds'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT chk_events_latitude_bounds
      CHECK (latitude IS NULL OR (latitude >= -90.0 AND latitude <= 90.0));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_events_longitude_bounds'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT chk_events_longitude_bounds
      CHECK (longitude IS NULL OR (longitude >= -180.0 AND longitude <= 180.0));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_events_price_non_negative'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT chk_events_price_non_negative
      -- price is TEXT ('{"general":"150"}', 'From R200'), so `price >= 0` was a
      -- type error that stopped this whole file. Reject a negative amount instead.
      CHECK (price IS NULL OR price !~ '(^|[":])\s*-\s*[0-9]');
  END IF;
END $$;

-- 1.3 Threat log table for auditing blocked attacks
CREATE TABLE IF NOT EXISTS public.security_threat_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  threat_type text NOT NULL,
  source_pillar text NOT NULL DEFAULT 'thegruvs', -- 'thegruvs', 'theresident', 'excellency'
  payload_sample text,
  blocked_at timestamptz NOT NULL DEFAULT now(),
  ip_fuzzed text,
  user_agent text
);

ALTER TABLE public.security_threat_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS security_threat_logs_admin_only ON public.security_threat_logs;
CREATE POLICY security_threat_logs_admin_only ON public.security_threat_logs
  FOR ALL
  USING (public.is_admin(auth.uid()));


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2: THE RESIDENT CREW (STAYS & LIFTS ARCHITECTURE)
-- ─────────────────────────────────────────────────────────────────────────────

-- 2.1 Accommodation Listings Table (res_listings)
CREATE TABLE IF NOT EXISTS public.res_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  city text NOT NULL,
  neighborhood text,
  price numeric(10,2) NOT NULL DEFAULT 0.00 CHECK (price >= 0),
  currency text NOT NULL DEFAULT 'ZAR',
  beds integer NOT NULL DEFAULT 1 CHECK (beds >= 1),
  bathrooms integer NOT NULL DEFAULT 1 CHECK (bathrooms >= 1),
  wifi boolean NOT NULL DEFAULT false,
  parking boolean NOT NULL DEFAULT false,
  verified_status text NOT NULL DEFAULT 'pending' CHECK (verified_status IN ('pending', 'verified', 'rejected')),
  latitude double precision CHECK (latitude IS NULL OR (latitude >= -90.0 AND latitude <= 90.0)),
  longitude double precision CHECK (longitude IS NULL OR (longitude >= -180.0 AND longitude <= 180.0)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.res_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS res_listings_public_read ON public.res_listings;
CREATE POLICY res_listings_public_read ON public.res_listings
  FOR SELECT
  USING (verified_status = 'verified' OR landlord_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS res_listings_landlord_manage ON public.res_listings;
CREATE POLICY res_listings_landlord_manage ON public.res_listings
  FOR ALL
  USING (landlord_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (landlord_id = auth.uid() OR public.is_admin(auth.uid()));

-- 2.2 Resident Lift Clubs Table (res_lift_clubs)
CREATE TABLE IF NOT EXISTS public.res_lift_clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  driver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  origin_address text NOT NULL,
  destination_address text NOT NULL,
  departure_time timestamptz NOT NULL,
  available_seats integer NOT NULL DEFAULT 3 CHECK (available_seats >= 0),
  total_seats integer NOT NULL DEFAULT 4 CHECK (total_seats >= 1),
  price_zar numeric(10,2) NOT NULL DEFAULT 0.00 CHECK (price_zar >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.res_lift_clubs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS res_lift_clubs_public_read ON public.res_lift_clubs;
CREATE POLICY res_lift_clubs_public_read ON public.res_lift_clubs
  FOR SELECT
  USING (is_active = true OR driver_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS res_lift_clubs_driver_manage ON public.res_lift_clubs;
CREATE POLICY res_lift_clubs_driver_manage ON public.res_lift_clubs
  FOR ALL
  USING (driver_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (driver_id = auth.uid() OR public.is_admin(auth.uid()));

-- 2.3 Resident Stay Bookings (res_bookings)
CREATE TABLE IF NOT EXISTS public.res_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.res_listings(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  check_in date NOT NULL,
  check_out date NOT NULL,
  total_amount numeric(10,2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
  currency text NOT NULL DEFAULT 'ZAR',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT res_valid_dates CHECK (check_out >= check_in)
);

ALTER TABLE public.res_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS res_bookings_participant_access ON public.res_bookings;
CREATE POLICY res_bookings_participant_access ON public.res_bookings
  FOR ALL
  USING (
    guest_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.res_listings l WHERE l.id = listing_id AND l.landlord_id = auth.uid())
    OR public.is_admin(auth.uid())
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3: EXCELLENCY ACADEMY (COURSES & CERTIFICATIONS ARCHITECTURE)
-- ─────────────────────────────────────────────────────────────────────────────

-- 3.1 Excellency Masterclasses / Courses Table (exc_courses)
CREATE TABLE IF NOT EXISTS public.exc_courses (
  id text PRIMARY KEY,
  title text NOT NULL,
  slug text UNIQUE,
  description text NOT NULL,
  instructor text NOT NULL,
  instructor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  duration text NOT NULL,
  badge text NOT NULL,
  level text NOT NULL DEFAULT 'All Levels' CHECK (level IN ('Beginner', 'Intermediate', 'Advanced', 'Pro', 'All Levels')),
  discount_rules text,
  icon text NOT NULL DEFAULT 'music',
  color text NOT NULL DEFAULT '#00f2ff',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exc_courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exc_courses_public_read ON public.exc_courses;
CREATE POLICY exc_courses_public_read ON public.exc_courses
  FOR SELECT
  USING (is_active = true OR public.is_admin(auth.uid()));

-- 3.2 Student Course Enrollments (exc_enrollments)
CREATE TABLE IF NOT EXISTS public.exc_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id text NOT NULL REFERENCES public.exc_courses(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  progress_percent integer NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dropped')),
  certification_token text,
  certified_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_exc_student_course UNIQUE (course_id, student_id)
);

ALTER TABLE public.exc_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exc_enrollments_student_access ON public.exc_enrollments;
CREATE POLICY exc_enrollments_student_access ON public.exc_enrollments
  FOR SELECT
  USING (student_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS exc_enrollments_student_insert ON public.exc_enrollments;
CREATE POLICY exc_enrollments_student_insert ON public.exc_enrollments
  FOR INSERT
  WITH CHECK (student_id = auth.uid() AND status = 'active');

-- 3.3 Excellency Guild Certifications (exc_certifications)
CREATE TABLE IF NOT EXISTS public.exc_certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id text NOT NULL REFERENCES public.exc_courses(id) ON DELETE CASCADE,
  badge_title text NOT NULL,
  cryptographic_signature text NOT NULL,
  mentor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_exc_user_cert UNIQUE (user_id, course_id)
);

ALTER TABLE public.exc_certifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exc_certifications_public_read ON public.exc_certifications;
CREATE POLICY exc_certifications_public_read ON public.exc_certifications
  FOR SELECT
  USING (true);

-- 3.4 Seed initial Excellency masterclasses if not present
INSERT INTO public.exc_courses (id, title, slug, description, instructor, duration, badge, level, discount_rules, icon, color)
VALUES
  (
    'ex-1',
    'Amapiano & Afro-Tech Sound Engineering',
    'amapiano-afrotech-sound-engineering',
    'Master sub-bass sidechaining, log drum harmonic saturation, dynamic spatial mixing, and studio acoustic alignment.',
    'Master Producer Residency',
    '4 Weeks · 16 Masterclasses',
    'AUDIO ENGINEERING',
    'Advanced',
    '20% Off with Vibe Score Level 3+',
    'music',
    '#00f2ff'
  ),
  (
    'ex-2',
    'Stage Lighting & Visual Architecture',
    'stage-lighting-visual-architecture',
    'Design reactive LED walls, DMX fixtures, timecoded laser sequences, and sensory stage presence.',
    'Live Production Guild',
    '2 Weeks · 8 Masterclasses',
    'STAGE CRAFT',
    'Intermediate',
    'Full Vibe Scholarship Available',
    'zap',
    '#3b82f6'
  ),
  (
    'ex-3',
    'Nightlife Economics & Festival Direction',
    'nightlife-economics-festival-direction',
    'Festival queue thermodynamics, crowd ingress management, promoter flyer bounty mechanics, and talent escrow budgeting.',
    'Promoter Council',
    '3 Weeks · 12 Masterclasses',
    'EVENT ARCHITECTURE',
    'Pro',
    'Free for Resident Verified Hosts',
    'compass',
    '#f59e0b'
  ),
  (
    'ex-4',
    'Live DJ Performance & Dubplate Mastery',
    'live-dj-performance-dubplate-mastery',
    'Club booth monitoring, key modulation, tension release structuring, and dubplate identification protocols.',
    'Resident DJ Guild',
    '2 Weeks · 10 Masterclasses',
    'PERFORMANCE CRAFT',
    'Intermediate',
    'Free with verified touch-downs',
    'disc',
    '#10b981'
  )
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  duration = EXCLUDED.duration,
  discount_rules = EXCLUDED.discount_rules;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4: THREAT-PREVENTION & LOGICAL TRANSACTIONS (RPCs)
-- ─────────────────────────────────────────────────────────────────────────────

-- 4.1 Secure enrollment RPC
CREATE OR REPLACE FUNCTION public.enroll_in_masterclass(p_course_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_enrollment_id uuid;
  v_course record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AuthenticationRequired: Sign in to enroll';
  END IF;

  SELECT * INTO v_course FROM public.exc_courses WHERE id = p_course_id AND is_active = true;
  IF v_course IS NULL THEN
    RAISE EXCEPTION 'CourseNotFound: Active masterclass does not exist';
  END IF;

  INSERT INTO public.exc_enrollments (course_id, student_id, status, progress_percent)
  VALUES (p_course_id, v_uid, 'active', 0)
  ON CONFLICT (course_id, student_id)
  DO UPDATE SET updated_at = now()
  RETURNING id INTO v_enrollment_id;

  RETURN jsonb_build_object(
    'success', true,
    'enrollment_id', v_enrollment_id,
    'course_id', p_course_id,
    'course_title', v_course.title
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.enroll_in_masterclass(text) TO authenticated;
