-- ═══════════════════════════════════════════════════════════════════════════
--  admin_grants.sql — make specific accounts admin, safely and auditably.
--
--  RUN definer_rpc_hardening.sql FIRST. Until it is applied, `role` is
--  self-assignable by any signed-in account, so granting admin is pointless —
--  everyone already can. Section 3 of APP_DB_CONTRACT_CHECK.sql tells you.
--
--  Verified: the fixed guard trigger does NOT block you. It pins `role` only
--  when current_user is 'authenticated' or 'anon'. The SQL editor runs as
--  postgres, so grants from here work while self-promotion stays blocked.
--  Both directions tested on a local Postgres.
--
--  Structure:
--    PART 1  DISCOVER  — read-only. Lists accounts and their login provider so
--                        you can identify the Google user.
--    PART 2  HARDEN    — constrains `role` so a typo cannot silently grant
--                        nothing.
--    PART 3  GRANT     — one list to edit. Idempotent and logged.
--    PART 4  VERIFY    — who is admin now.
--
--  PART 1 and 4 are read-only. Run PART 1 on its own first if you like.
-- ═══════════════════════════════════════════════════════════════════════════


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PART 1 — DISCOVER.  Read-only. Who exists, and how do they sign in?      ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

\echo ''
\echo '═══ Accounts by login provider (find your Google user here) ═══'

SELECT
  u.email,
  COALESCE(
    (SELECT string_agg(DISTINCT i.provider, ', ' ORDER BY i.provider)
       FROM auth.identities i WHERE i.user_id = u.id),
    u.raw_app_meta_data->>'provider',
    'email'
  )                                                    AS login_provider,
  p.username,
  COALESCE(p.role, '(none)')                           AS current_role,
  u.email_confirmed_at IS NOT NULL                     AS email_confirmed,
  u.last_sign_in_at::date                              AS last_sign_in,
  u.created_at::date                                   AS joined
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
ORDER BY
  -- Google accounts first, then most recently active.
  (COALESCE((SELECT 1 FROM auth.identities i
              WHERE i.user_id = u.id AND i.provider = 'google' LIMIT 1), 0)) DESC,
  u.last_sign_in_at DESC NULLS LAST
LIMIT 100;

\echo ''
\echo '═══ Google accounts only ═══'

SELECT u.email, p.username, COALESCE(p.role,'(none)') AS current_role,
       u.last_sign_in_at::date AS last_sign_in
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
 WHERE EXISTS (SELECT 1 FROM auth.identities i
                WHERE i.user_id = u.id AND i.provider = 'google')
 ORDER BY u.last_sign_in_at DESC NULLS LAST;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PART 2 — HARDEN.  Stop a typo from silently granting nothing.            ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
--
-- is_admin() tests `role = 'admin'` exactly. So 'Admin', ' admin' or 'adminn'
-- all store fine and grant nothing, with no error — you would believe the grant
-- worked. `role` is bare TEXT DEFAULT 'user' today, with no constraint at all.

\echo ''
\echo '═══ Any role values that would silently fail? ═══'

SELECT COALESCE(role,'(null)') AS unexpected_role_value, count(*) AS accounts
  FROM public.profiles
 WHERE role IS NOT NULL
   AND role NOT IN ('user','admin','moderator','organizer','business')
 GROUP BY role
 ORDER BY count(*) DESC;

-- Added NOT VALID on purpose: it enforces every future INSERT and UPDATE while
-- leaving existing rows alone, so it cannot fail to install because of a value
-- already in the table. Clean up anything the query above listed, then run
--   ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_role_allowed;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'profiles_role_allowed'
       AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_allowed
      CHECK (role IS NULL OR role IN ('user','admin','moderator','organizer','business'))
      NOT VALID;
    RAISE NOTICE 'added CHECK profiles_role_allowed (NOT VALID — guards new writes)';
  ELSE
    RAISE NOTICE 'CHECK profiles_role_allowed already present';
  END IF;
END $$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PART 3 — GRANT.  Edit the email list, then run.                          ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
--
--  ▼▼▼ THE ONLY LINE YOU NEED TO EDIT ▼▼▼
--  Put the Google account's email in place of the placeholder. Case does not
--  matter. Add or remove entries freely — the block is idempotent.

DO $$
DECLARE
  admin_emails text[] := ARRAY[
    'asemahlenkwali@gmail.com',
    'REPLACE_WITH_THE_GOOGLE_ACCOUNT_EMAIL'   -- ← from PART 1's Google list
  ];
  e         text;
  uid       uuid;
  had_role  text;
  granted   int := 0;
  skipped   int := 0;
BEGIN
  FOREACH e IN ARRAY admin_emails LOOP
    -- Never act on the placeholder.
    IF e = 'REPLACE_WITH_THE_GOOGLE_ACCOUNT_EMAIL' THEN
      RAISE WARNING 'placeholder still in the list — edit it or remove the line';
      skipped := skipped + 1;
      CONTINUE;
    END IF;

    SELECT u.id INTO uid FROM auth.users u WHERE lower(u.email) = lower(trim(e));

    IF uid IS NULL THEN
      RAISE WARNING 'no account for % — they must sign up (or sign in with Google) at least once first', e;
      skipped := skipped + 1;
      CONTINUE;
    END IF;

    -- A profiles row may not exist yet if the user never finished onboarding.
    SELECT role INTO had_role FROM public.profiles WHERE id = uid;
    IF NOT FOUND THEN
      INSERT INTO public.profiles (id, role) VALUES (uid, 'admin')
      ON CONFLICT (id) DO UPDATE SET role = 'admin';
      RAISE NOTICE 'created profile + granted admin: %', e;
    ELSIF had_role = 'admin' THEN
      RAISE NOTICE 'already admin, nothing to do: %', e;
      CONTINUE;
    ELSE
      UPDATE public.profiles SET role = 'admin' WHERE id = uid;
      RAISE NOTICE 'granted admin (was %): %', COALESCE(had_role,'null'), e;
    END IF;

    granted := granted + 1;

    -- Audit trail. Admin is the highest privilege in the app; a grant should
    -- never be invisible after the fact.
    IF to_regclass('public.security_logs') IS NOT NULL THEN
      INSERT INTO public.security_logs (user_id, event_type, action, resource_type, reason)
      VALUES (uid, 'ADMIN_GRANTED', 'role=admin', 'profiles',
              format('granted via admin_grants.sql; previous role=%s', COALESCE(had_role,'none')));
    END IF;
  END LOOP;

  RAISE NOTICE '── % granted, % skipped ──', granted, skipped;
END $$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PART 4 — VERIFY.  Read-only.                                             ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

\echo ''
\echo '═══ Admins now ═══'

SELECT u.email, p.username, p.role,
       COALESCE((SELECT string_agg(DISTINCT i.provider, ', ')
                   FROM auth.identities i WHERE i.user_id = u.id), 'email') AS provider
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
 WHERE p.role = 'admin'
 ORDER BY u.email;

\echo ''
\echo '═══ Anyone ELSE holding privilege you did not grant ═══'
\echo '(if definer_rpc_hardening.sql was applied late, check this carefully)'

SELECT u.email, p.username, p.role, p.is_verified, p.wallet_balance
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
 WHERE p.role IS NOT NULL AND p.role <> 'user'
    OR p.is_verified = true
    OR COALESCE(p.wallet_balance, 0) > 0
 ORDER BY (p.role = 'admin') DESC, p.wallet_balance DESC NULLS LAST
 LIMIT 50;
