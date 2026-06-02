-- ============================================================
--  THE GRUVS — 33: WRITING STYLE (aura signature font)
--
--  Stores each user's chosen Unicode "writing style" key (bold / cursive /
--  outline / …). Body text stays PLAIN in the DB — we only transform on display
--  using the author's style, so search and screen-readers are unaffected.
--
--  Safe + idempotent. Until this runs, the picker still works (it falls back to
--  device-local AsyncStorage), styles just won't follow the user across devices
--  or render on other people's screens.
-- ============================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS writing_style TEXT;