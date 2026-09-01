-- ─────────────────────────────────────────────────────────────────────────────
-- beacon_intent.sql — what someone means when they go live, not just that they are.
--
-- The "I'm here" beacon (PresenceManager.activateBeacon/dropBeacon) has always
-- been a bare on/off flag: is_beacon_active + an expiry. It says WHERE and
-- WHEN, never WHY — so a viber deciding whether to walk over has no idea if
-- someone's open to meeting people, out with their crew, or just there for
-- the music. This adds that one signal.
--
-- Deliberately informational only, not an access-control gate — no RLS/scope
-- enforcement here. is_beacon_active is read raw in 10+ client call sites
-- across the app; restricting WHO can see a beacon by intent/scope would need
-- either RLS column-masking (not really possible per-column in Postgres) or
-- migrating every one of those reads to a server-computed view — a much
-- larger, separate change. This column is purely a label.
--
-- Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS beacon_intent TEXT;

DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_beacon_intent_check
    CHECK (beacon_intent IS NULL OR beacon_intent IN ('open', 'crew', 'music'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
