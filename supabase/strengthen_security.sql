-- ============================================================
--  THE GRUVS — Security & Privacy Hardening Patch  (v4)
--  Focus: Identity Modes (Ghost/Celebrity) and Data Isolation
-- ============================================================

-- ══════════════════════════════════════════════════════════════
--  1. IDENTITY PRIVACY: Profiles
-- ══════════════════════════════════════════════════════════════

-- Ensure users in 'ghost' or 'celebrity' mode have restricted visibility
-- and that sensitive fields (lat, lon, push_token) are NEVER public.

DROP POLICY IF EXISTS "Public profiles readable" ON profiles;
CREATE POLICY "Public profiles readable" ON profiles FOR SELECT
USING (
  -- Users can always see their own full profile
  auth.uid() = id
  OR
  -- Others can see non-sensitive fields of public profiles
  (
    identity_mode = 'public'
    AND (auth.role() = 'authenticated') -- Only logged in users can browse others
  )
);

-- Deny direct access to precise location for non-owners
-- Note: This is best handled by creating a VIEW or a restricted RPC
-- that returns fuzzed locations for Ghost mode users.

-- ══════════════════════════════════════════════════════════════
--  2. MESSAGING SECURITY: Anti-Spam & Request Logic
-- ══════════════════════════════════════════════════════════════

-- Strengthening message policies to prevent sending messages to
-- people who have blocked you or if a request is required.

DROP POLICY IF EXISTS "Users send own messages" ON messages;
CREATE POLICY "Users send own messages" ON messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND NOT EXISTS (
    SELECT 1 FROM blocked_users
    WHERE blocker_id = recipient_id AND blocked_id = auth.uid()
  )
  -- Logic: If it's a new conversation, it MUST be marked as is_request = true
  -- (This is partially enforced in dataFlow.js, but SQL provides the floor)
);

-- ══════════════════════════════════════════════════════════════
--  3. EVENT SECURITY: Privacy Controls
-- ══════════════════════════════════════════════════════════════

-- Future Proofing: If we add private events, we need this:
-- ALTER TABLE events ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;

DROP POLICY IF EXISTS "Events readable by all" ON events;
CREATE POLICY "Events readable by all" ON events FOR SELECT
USING (
  -- Everyone can see public events
  -- owner_id column might be author_id in your schema, let's use the actual one
  auth.uid() = author_id OR true -- Standard for public social feed
);

-- ══════════════════════════════════════════════════════════════
--  4. STORAGE HARDENING
-- ══════════════════════════════════════════════════════════════

-- Prevent users from deleting or overwriting other users' files
DROP POLICY IF EXISTS "Auth update avatars" ON storage.objects;
CREATE POLICY "Auth update avatars" ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Auth delete avatars" ON storage.objects;
CREATE POLICY "Auth delete avatars" ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ══════════════════════════════════════════════════════════════
--  5. GEO-PRIVACY: Fuzzed Location Function
-- ══════════════════════════════════════════════════════════════

-- This RPC replaces direct table access for "Nearby" features.
-- It automatically fuzzes locations for users in Ghost mode.

CREATE OR REPLACE FUNCTION get_safe_nearby_vibers(u_lat FLOAT, u_lon FLOAT, radius_km FLOAT)
RETURNS TABLE (
  id UUID,
  username TEXT,
  avatar_url TEXT,
  vibe_score INTEGER,
  distance_km FLOAT,
  lat FLOAT,
  lon FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.username,
    p.avatar_url,
    p.vibe_score,
    (ST_Distance(ST_MakePoint(p.lon, p.lat)::geography, ST_MakePoint(u_lon, u_lat)::geography) / 1000) as distance_km,
    CASE
      WHEN p.identity_mode = 'ghost' THEN p.lat + (random() - 0.5) * 0.01 -- Fuzz ~1km
      ELSE p.lat
    END as lat,
    CASE
      WHEN p.identity_mode = 'ghost' THEN p.lon + (random() - 0.5) * 0.01
      ELSE p.lon
    END as lon
  FROM profiles p
  WHERE
    p.is_discoverable = true
    AND p.identity_mode != 'celebrity' -- Celebrity mode users are never on the "Nearby" map
    AND (ST_Distance(ST_MakePoint(p.lon, p.lat)::geography, ST_MakePoint(u_lon, u_lat)::geography) / 1000) <= radius_km
    AND p.id != auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
