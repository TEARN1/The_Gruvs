-- =========================================================================
-- THE GRUVS APP: COMPLETE SUPABASE SQL SCHEMA
-- =========================================================================
-- Copy this entire file and run it in the Supabase SQL Editor.
-- It will create all tables, relationships, Row Level Security (RLS) policies,
-- and necessary automation triggers to make your database "Super Ready".

-- 1. ENABLE EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- 2. TABLES
-- =========================================================================

-- WARNING: This will drop existing tables and views and all their data to give you a clean slate.
DO $$ 
DECLARE 
    target_name TEXT;
    obj_type TEXT;
    objects_to_drop TEXT[] := ARRAY[
        'activity_logs', 'saved_searches', 'user_achievements', 'achievements',
        'group_members', 'groups', 'message_status', 'messages',
        'conversation_participants', 'conversations', 'notifications', 
        'mutes', 'blocks', 'follows', 'comment_likes', 'comments', 
        'event_rsvps', 'event_saves', 'event_likes', 'events', 'profiles'
    ];
BEGIN
    FOR target_name IN SELECT unnest(objects_to_drop) LOOP
        -- Check if it is a table (r), view (v), or materialized view (m)
        SELECT
            CASE
                WHEN c.relkind = 'v' THEN 'VIEW'
                WHEN c.relkind = 'r' THEN 'TABLE'
                WHEN c.relkind = 'm' THEN 'MATERIALIZED VIEW'
            END INTO obj_type
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = target_name;

        IF obj_type IS NOT NULL THEN
            EXECUTE format('DROP %s IF EXISTS public.%I CASCADE;', obj_type, target_name);
        END IF;
    END LOOP;
END $$;

-- PROFILES (Maps directly to Supabase auth.users)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    name TEXT,
    gender TEXT,
    bio TEXT,
    avatar TEXT,
    banner TEXT,
    pronouns TEXT,
    location TEXT,
    website TEXT,
    phone TEXT,
    birth_date DATE,
    -- Verification & Status
    verified BOOLEAN DEFAULT FALSE,
    verification_badge BOOLEAN DEFAULT FALSE,
    account_status TEXT DEFAULT 'active',
    joined_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Gamification
    reputation INTEGER DEFAULT 100,
    points INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    streak INTEGER DEFAULT 0,
    -- Privacy & Premium
    privacy TEXT DEFAULT 'public',
    show_email BOOLEAN DEFAULT FALSE,
    show_phone BOOLEAN DEFAULT FALSE,
    allow_messages BOOLEAN DEFAULT TRUE,
    allow_comments BOOLEAN DEFAULT TRUE,
    is_premium BOOLEAN DEFAULT FALSE,
    subscription_tier TEXT DEFAULT 'free',
    premium_expiry_date TIMESTAMP WITH TIME ZONE,
    -- Arrays & JSON
    interests TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    preferences JSONB DEFAULT '{"notifications": {"email": true, "push": true, "sms": false, "eventReminders": true}, "content": {"language": "en", "adsPreference": true, "analyticsTracking": true}}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- EVENTS
CREATE TABLE public.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    location TEXT,
    latitude FLOAT8,
    longitude FLOAT8,
    date_time TIMESTAMP WITH TIME ZONE,
    is_paid BOOLEAN DEFAULT FALSE,
    media JSONB DEFAULT '[]'::jsonb, -- array of {type, url}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Engagement Metrics
    like_count INTEGER DEFAULT 0,
    rsvp_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    reaction_count INTEGER DEFAULT 0,
    save_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    trending_score NUMERIC DEFAULT 0
);

-- EVENT LIKES
CREATE TABLE public.event_likes (
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (event_id, user_id)
);

-- EVENT SAVES / BOOKMARKS
CREATE TABLE public.event_saves (
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (event_id, user_id)
);

-- EVENT RSVPS
CREATE TABLE public.event_rsvps (
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'going', -- going, interested, skip
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (event_id, user_id)
);

-- COMMENTS
CREATE TABLE public.comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
    author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    text TEXT NOT NULL,
    media JSONB,
    like_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMP WITH TIME ZONE,
    mentions TEXT[] DEFAULT '{}',
    hashtags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SOCIAL INTERACTIONS (Follows)
CREATE TABLE public.follows (
    follower_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    following_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id)
);

-- BLOCKED & MUTED
CREATE TABLE public.blocks (
    blocker_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    blocked_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE public.mutes (
    muter_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    muted_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (muter_id, muted_id)
);

-- NOTIFICATIONS
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    action_id TEXT,
    action_type TEXT,
    title TEXT,
    message TEXT,
    icon TEXT DEFAULT '🔔',
    read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    action_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days')
);

-- CHAT: CONVERSATIONS
CREATE TABLE public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    last_message TEXT,
    last_message_at TIMESTAMP WITH TIME ZONE,
    message_count INTEGER DEFAULT 0,
    archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CHAT: CONVERSATION PARTICIPANTS
CREATE TABLE public.conversation_participants (
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    muted BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (conversation_id, user_id)
);

-- CHAT: MESSAGES
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    text TEXT,
    media JSONB,
    edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMP WITH TIME ZONE,
    read_by UUID[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- COMMUNITIES / GROUPS
CREATE TABLE public.groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    member_count INTEGER DEFAULT 1,
    avatar TEXT,
    banner TEXT,
    privacy TEXT DEFAULT 'public',
    category TEXT DEFAULT 'general',
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.group_members (
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member', -- member, moderator, admin
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);

-- ACHIEVEMENTS & GAMIFICATION
CREATE TABLE public.achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    requirement TEXT,
    points INTEGER DEFAULT 10,
    rarity TEXT DEFAULT 'common'
);

CREATE TABLE public.user_achievements (
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    achievement_id UUID REFERENCES public.achievements(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, achievement_id)
);

-- SAVED SEARCHES AND ACTIVITY LOGS
CREATE TABLE public.saved_searches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    query TEXT,
    filters JSONB,
    alerts BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    metadata JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================================================
-- 3. TRIGGERS AND AUTOMATION
-- =========================================================================

-- Trigger function: Auto-create public.profiles entry when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, username)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || md5(NEW.id::text))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Bind the function to auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Trigger function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE public.set_current_timestamp_updated_at();
CREATE TRIGGER set_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE PROCEDURE public.set_current_timestamp_updated_at();
CREATE TRIGGER set_comments_updated_at BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE PROCEDURE public.set_current_timestamp_updated_at();
CREATE TRIGGER set_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE PROCEDURE public.set_current_timestamp_updated_at();
CREATE TRIGGER set_groups_updated_at BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE PROCEDURE public.set_current_timestamp_updated_at();

-- =========================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Simple RLS Policies

-- Profiles: everyone can view, only owner can update
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Events: everyone can view, authenticated users can insert, owner can update/delete
CREATE POLICY "Events are viewable by everyone." ON public.events FOR SELECT USING (true);
CREATE POLICY "Users can create events." ON public.events FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users can update own events." ON public.events FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Users can delete own events." ON public.events FOR DELETE USING (auth.uid() = author_id);

-- Event Activity (Likes, Saves, RSVPs)
CREATE POLICY "Public view event likes" ON public.event_likes FOR SELECT USING (true);
CREATE POLICY "Users manage own event likes" ON public.event_likes FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Public view event saves" ON public.event_saves FOR SELECT USING (true);
CREATE POLICY "Users manage own event saves" ON public.event_saves FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Public view event rsvps" ON public.event_rsvps FOR SELECT USING (true);
CREATE POLICY "Users manage own event rsvps" ON public.event_rsvps FOR ALL USING (auth.uid() = user_id);

-- Follows
CREATE POLICY "Public view follows" ON public.follows FOR SELECT USING (true);
CREATE POLICY "Users manage own following" ON public.follows FOR ALL USING (auth.uid() = follower_id);

-- Notifications
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (auth.uid() = recipient_id);
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = recipient_id);

-- Realtime: Optionally, enable Realtime on certain tables
alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.comments;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;

-- END OF SCHEMA

-- =========================================================================
-- 5. RPC FUNCTIONS FOR ATOMIC OPERATIONS
-- =========================================================================

-- Increment Views
CREATE OR REPLACE FUNCTION public.increment_views(event_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.events
  SET views = views + 1,
      trending_score = trending_score + 1
  WHERE id = event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function: Update event counters automatically
CREATE OR REPLACE FUNCTION public.sync_event_engagement()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF (TG_TABLE_NAME = 'event_likes') THEN
      UPDATE public.events SET like_count = like_count + 1, trending_score = trending_score + 5 WHERE id = NEW.event_id;
    ELSIF (TG_TABLE_NAME = 'event_rsvps') THEN
      UPDATE public.events SET rsvp_count = rsvp_count + 1, trending_score = trending_score + 10 WHERE id = NEW.event_id;
    END IF;
  ELSIF (TG_OP = 'DELETE') THEN
    IF (TG_TABLE_NAME = 'event_likes') THEN
      UPDATE public.events SET like_count = like_count - 1 WHERE id = OLD.event_id;
    ELSIF (TG_TABLE_NAME = 'event_rsvps') THEN
      UPDATE public.events SET rsvp_count = rsvp_count - 1 WHERE id = OLD.event_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER sync_likes_trigger AFTER INSERT OR DELETE ON public.event_likes FOR EACH ROW EXECUTE PROCEDURE public.sync_event_engagement();
CREATE TRIGGER sync_rsvps_trigger AFTER INSERT OR DELETE ON public.event_rsvps FOR EACH ROW EXECUTE PROCEDURE public.sync_event_engagement();
