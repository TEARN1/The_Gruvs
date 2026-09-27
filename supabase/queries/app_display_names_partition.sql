-- ============================================================================
-- SQL Snippet: app_display_names_partition.sql
-- Separates display names across the 3 apps while retaining single auth.users
-- ============================================================================

-- 1. Table for app-scoped identities
CREATE TABLE IF NOT EXISTS public.app_user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    app_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    bio TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    CONSTRAINT uq_user_app_profile UNIQUE (user_id, app_id),
    -- Update these identifiers to match your 3 app names (e.g. the_gruvs, resident, app_three)
    CONSTRAINT chk_app_id_format CHECK (app_id IN ('the_gruvs', 'resident', 'app_three'))
);

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS idx_app_user_profiles_user_app 
    ON public.app_user_profiles (user_id, app_id);

CREATE INDEX IF NOT EXISTS idx_app_user_profiles_app_name 
    ON public.app_user_profiles (app_id, display_name);

-- 3. Row-Level Security
ALTER TABLE public.app_user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_user_profiles: public read" ON public.app_user_profiles;
CREATE POLICY "app_user_profiles: public read"
    ON public.app_user_profiles FOR SELECT
    TO authenticated, anon
    USING (true);

DROP POLICY IF EXISTS "app_user_profiles: owner insert" ON public.app_user_profiles;
CREATE POLICY "app_user_profiles: owner insert"
    ON public.app_user_profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "app_user_profiles: owner update" ON public.app_user_profiles;
CREATE POLICY "app_user_profiles: owner update"
    ON public.app_user_profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "app_user_profiles: owner delete" ON public.app_user_profiles;
CREATE POLICY "app_user_profiles: owner delete"
    ON public.app_user_profiles FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 4. Helper Function: Read profile with automatic fallback to base profiles.username
CREATE OR REPLACE FUNCTION public.get_app_profile(p_user_id UUID, p_app_id TEXT)
RETURNS TABLE (
    user_id UUID,
    app_id TEXT,
    display_name TEXT,
    avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id AS user_id,
        p_app_id AS app_id,
        COALESCE(aup.display_name, p.username, 'Viber') AS display_name,
        p.avatar_url
    FROM public.profiles p
    LEFT JOIN public.app_user_profiles aup 
        ON aup.user_id = p.id AND aup.app_id = p_app_id
    WHERE p.id = p_user_id;
END;
$$;

-- 5. RPC to update or insert the display name for the current active app
CREATE OR REPLACE FUNCTION public.upsert_app_profile(p_app_id TEXT, p_display_name TEXT, p_bio TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    INSERT INTO public.app_user_profiles (user_id, app_id, display_name, bio, updated_at)
    VALUES (auth.uid(), p_app_id, TRIM(p_display_name), p_bio, timezone('utc'::text, now()))
    ON CONFLICT (user_id, app_id)
    DO UPDATE SET
        display_name = EXCLUDED.display_name,
        bio = COALESCE(EXCLUDED.bio, app_user_profiles.bio),
        updated_at = timezone('utc'::text, now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_app_profile(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_app_profile(TEXT, TEXT, TEXT) TO authenticated;

-- 6. Initial Seed: Populate each app with existing usernames so no user has a blank name
INSERT INTO public.app_user_profiles (user_id, app_id, display_name)
SELECT id, 'the_gruvs', COALESCE(username, 'Viber') FROM public.profiles
ON CONFLICT (user_id, app_id) DO NOTHING;

INSERT INTO public.app_user_profiles (user_id, app_id, display_name)
SELECT id, 'resident', COALESCE(username, 'Viber') FROM public.profiles
ON CONFLICT (user_id, app_id) DO NOTHING;

INSERT INTO public.app_user_profiles (user_id, app_id, display_name)
SELECT id, 'app_three', COALESCE(username, 'Viber') FROM public.profiles
ON CONFLICT (user_id, app_id) DO NOTHING;
