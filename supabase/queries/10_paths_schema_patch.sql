-- ============================================================================
-- The Gruvs — Path Stars & Path Crossings Schema Patch (Migration #10)
-- ============================================================================

-- 1. Create path_stars table
CREATE TABLE IF NOT EXISTS public.path_stars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    to_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    path_id UUID REFERENCES public.paths(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.path_stars ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Allow authenticated read path_stars" ON public.path_stars;
DROP POLICY IF EXISTS "Allow users to insert path_stars"    ON public.path_stars;
DROP POLICY IF EXISTS "Allow users to delete path_stars"    ON public.path_stars;

-- Create secure policies
CREATE POLICY "Allow authenticated read path_stars" 
    ON public.path_stars FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Allow users to insert path_stars" 
    ON public.path_stars FOR INSERT 
    TO authenticated 
    WITH CHECK (auth.uid() = from_user_id OR auth.uid() = user_id);

CREATE POLICY "Allow users to delete path_stars" 
    ON public.path_stars FOR DELETE 
    TO authenticated 
    USING (auth.uid() = from_user_id OR auth.uid() = user_id);


-- 2. Create path_crossings table
CREATE TABLE IF NOT EXISTS public.path_crossings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    path_id_a UUID REFERENCES public.paths(id) ON DELETE CASCADE,
    path_id_b UUID REFERENCES public.paths(id) ON DELETE CASCADE,
    overlap_score FLOAT8,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.path_crossings ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Allow authenticated read path_crossings"   ON public.path_crossings;
DROP POLICY IF EXISTS "Allow authenticated insert path_crossings" ON public.path_crossings;

-- Create secure policies
CREATE POLICY "Allow authenticated read path_crossings" 
    ON public.path_crossings FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Allow authenticated insert path_crossings" 
    ON public.path_crossings FOR INSERT 
    TO authenticated 
    WITH CHECK (true);
