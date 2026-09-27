-- ═══════════════════════════════════════════════════════════════════════════
-- schema_drift_columns.sql — add the columns the client has always written to.
--
-- Found by the 2026-07-19 drift sweep (`node scripts/schema-drift.js`): the
-- client writes 14 columns that do not exist on the live database. Every one
-- of these writes is wrapped in a catch or a resilient() fallback, so nothing
-- ever surfaced an error — the features just silently did nothing.
--
-- These are the ones where the COLUMN is right and the database is behind.
-- Where the client was simply wrong instead, it was fixed client-side
-- (see event_updates.body, event_crowd_votes.vote, event_moment_views.user_id,
-- and the waitlist / route "leave" paths which now DELETE their row).
--
-- Idempotent. Add to DEPLOY_SQL_RUNBOOK.md Part 1.
-- ═══════════════════════════════════════════════════════════════════════════

-- The equity engine writes vibe_equity and last_mint_at in ONE update. With
-- last_mint_at missing the whole statement failed, and the isMissingColumn()
-- guard turned that into a silent `persisted: false` — so vibe_equity minting
-- has never actually persisted. This one column revives the equity ledger.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_mint_at timestamptz;

-- Deletion fallback in SettingsScreen.confirmDelete. The primary path (the
-- delete-account edge function) works and is what normally runs; this is the
-- "edge function unreachable" safety net, which silently wrote nothing while
-- telling the user their account was deactivated.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at            timestamptz;

-- Denormalised live score card written by sportsEngine (a JS object).
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS match_card jsonb;

-- Night-planner route steps: the ETA for each stop.
ALTER TABLE public.route_steps
  ADD COLUMN IF NOT EXISTS arrival_time timestamptz;

-- Business partnership requests carried a type that had nowhere to land, so
-- requestPartnership() always returned false.
ALTER TABLE public.business_partnerships
  ADD COLUMN IF NOT EXISTS partnership_type text;

ALTER TABLE public.service_nodes
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
