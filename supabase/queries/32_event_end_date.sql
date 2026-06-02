-- ============================================================
--  THE GRUVS — 32: EVENT END DATE (multi-day events)
--
--  Events can now span multiple days (tournaments, festivals, conferences).
--  end_date is the last day of the event; event_date stays the first day.
--  The per-day agenda lives in the existing events.schedule JSON (each slot
--  carries an optional `day` number), so no schema change is needed for that.
--
--  Safe + idempotent. Until this runs, event creation still works — the app
--  drops end_date via its insert fallback — it just can't persist the end day.
-- ============================================================

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS end_date DATE;

-- Optional: a date range is only valid when end_date is on/after the start.
-- (Left as a comment so existing rows are never rejected; uncomment to enforce.)
-- ALTER TABLE public.events
--   ADD CONSTRAINT events_end_after_start
--   CHECK (end_date IS NULL OR event_date IS NULL OR end_date >= event_date) NOT VALID;