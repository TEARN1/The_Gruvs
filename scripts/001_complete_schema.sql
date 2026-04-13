-- ═══════════════════════════════════════════════════════════════════════════
-- THE GRUVS - COMPLETE DATABASE SCHEMA
-- 100+ Tables, Functions, Triggers, and RLS Policies
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. PROFILES TABLE (extends auth.users)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  name TEXT,
  email TEXT,
  avatar TEXT,
  banner TEXT,
  bio TEXT,
  voice_bio_url TEXT,
  gender TEXT DEFAULT 'other',
  date_of_birth DATE,
  phone TEXT,
  
  -- Location
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'South Africa',
  timezone TEXT DEFAULT 'Africa/Johannesburg',
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  
  -- Social links
  website TEXT,
  instagram TEXT,
  twitter TEXT,
  tiktok TEXT,
  linkedin TEXT,
  
  -- Arrays
  interests TEXT[] DEFAULT '{}',
  favorite_categories TEXT[] DEFAULT '{}',
  blocked_users UUID[] DEFAULT '{}',
  muted_users UUID[] DEFAULT '{}',
  
  -- Gamification
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  vibe_points INTEGER DEFAULT 100,
  reputation INTEGER DEFAULT 0,
  streak_days INTEGER DEFAULT 0,
  last_streak_date DATE,
  
  -- Settings
  theme_preset TEXT DEFAULT 'aurora-shift',
  is_private BOOLEAN DEFAULT FALSE,
  ghost_mode BOOLEAN DEFAULT FALSE,
  profile_type TEXT DEFAULT 'normal', -- 'normal', 'private', 'business'
  is_verified BOOLEAN DEFAULT FALSE,
  is_vendor BOOLEAN DEFAULT FALSE,
  
  -- Notification preferences
  notifications_enabled BOOLEAN DEFAULT TRUE,
  email_notifications BOOLEAN DEFAULT TRUE,
  push_notifications BOOLEAN DEFAULT TRUE,
  
  -- Stats (denormalized for performance)
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  events_created_count INTEGER DEFAULT 0,
  events_attended_count INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  
  -- Timestamps
  last_active TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. EVENTS TABLE (Core entity)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Basic info
  title TEXT NOT NULL,
  description TEXT,
  short_description TEXT,
  slug TEXT UNIQUE,
  
  -- Categorization
  category TEXT DEFAULT 'General',
  subcategory TEXT,
  tags TEXT[] DEFAULT '{}',
  
  -- Event type
  event_type TEXT DEFAULT 'in-person', -- 'in-person', 'virtual', 'hybrid'
  event_format TEXT DEFAULT 'single', -- 'single', 'recurring', 'series'
  
  -- Location
  location TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'South Africa',
  zip_code TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  venue_name TEXT,
  
  -- Virtual
  virtual_link TEXT,
  virtual_platform TEXT,
  
  -- Schedule
  date_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  timezone TEXT DEFAULT 'Africa/Johannesburg',
  duration_minutes INTEGER,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern JSONB,
  
  -- Capacity & Registration
  capacity INTEGER,
  is_invitation_only BOOLEAN DEFAULT FALSE,
  invited_users UUID[] DEFAULT '{}',
  waitlist_enabled BOOLEAN DEFAULT FALSE,
  max_waitlist INTEGER,
  registration_deadline TIMESTAMPTZ,
  
  -- Pricing
  is_paid BOOLEAN DEFAULT FALSE,
  base_price DECIMAL(10, 2) DEFAULT 0,
  currency TEXT DEFAULT 'ZAR',
  ticket_tiers JSONB DEFAULT '[]',
  
  -- Media
  media JSONB DEFAULT '[]', -- [{type: 'image'|'video', url: '...'}]
  cover_image TEXT,
  thumbnail TEXT,
  
  -- Engagement (denormalized for performance)
  view_count INTEGER DEFAULT 0,
  unique_views UUID[] DEFAULT '{}',
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  rsvp_going_count INTEGER DEFAULT 0,
  rsvp_interested_count INTEGER DEFAULT 0,
  
  -- Scoring
  trending_score DECIMAL(10, 4) DEFAULT 0,
  heat_index DECIMAL(10, 4) DEFAULT 0,
  
  -- Status
  status TEXT DEFAULT 'published', -- 'draft', 'published', 'live', 'ended', 'cancelled'
  visibility TEXT DEFAULT 'public', -- 'public', 'private', 'friends-only'
  is_featured BOOLEAN DEFAULT FALSE,
  is_sponsored BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  pulse_meta JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  
  -- Timestamps
  published_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. EVENT INTERACTIONS (Likes, RSVPs, Saves, Views)
-- ═══════════════════════════════════════════════════════════════════════════

-- Likes
CREATE TABLE IF NOT EXISTS public.event_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction_type TEXT DEFAULT 'like', -- 'like', 'love', 'fire', 'haha', etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- RSVPs
CREATE TABLE IF NOT EXISTS public.event_rsvps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'going', -- 'going', 'interested', 'not_going', 'waitlist'
  ticket_tier TEXT,
  ticket_code TEXT UNIQUE,
  checked_in BOOLEAN DEFAULT FALSE,
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- Saves/Bookmarks
CREATE TABLE IF NOT EXISTS public.event_saves (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- Views tracking
CREATE TABLE IF NOT EXISTS public.event_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  session_id TEXT,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  duration_seconds INTEGER DEFAULT 0
);

-- Shares
CREATE TABLE IF NOT EXISTS public.event_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  platform TEXT, -- 'twitter', 'whatsapp', 'copy_link', etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. COMMENTS
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  
  text TEXT NOT NULL,
  media JSONB DEFAULT '[]',
  voice_note_url TEXT,
  
  like_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  
  is_pinned BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  is_edited BOOLEAN DEFAULT FALSE,
  
  mentions UUID[] DEFAULT '{}',
  hashtags TEXT[] DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comment likes
CREATE TABLE IF NOT EXISTS public.comment_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. SOCIAL: FOLLOWERS/FOLLOWING
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. MESSAGING SYSTEM
-- ═══════════════════════════════════════════════════════════════════════════

-- Conversations
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT DEFAULT 'direct', -- 'direct', 'group', 'event_chat'
  name TEXT,
  avatar TEXT,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  last_sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  is_archived BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversation participants
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  role TEXT DEFAULT 'member', -- 'admin', 'member'
  unread_count INTEGER DEFAULT 0,
  is_muted BOOLEAN DEFAULT FALSE,
  last_read_at TIMESTAMPTZ,
  
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

-- Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  text TEXT,
  media JSONB DEFAULT '[]',
  voice_note_url TEXT,
  
  reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  
  is_read BOOLEAN DEFAULT FALSE,
  read_by UUID[] DEFAULT '{}',
  read_at TIMESTAMPTZ,
  
  is_edited BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  
  reactions JSONB DEFAULT '{}', -- {userId: 'reaction_type'}
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. COMMUNITIES/TRIBES
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.communities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  avatar TEXT,
  banner TEXT,
  
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  
  privacy TEXT DEFAULT 'public', -- 'public', 'private', 'invite-only'
  
  member_count INTEGER DEFAULT 1,
  event_count INTEGER DEFAULT 0,
  
  rules TEXT[] DEFAULT '{}',
  guidelines TEXT,
  
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Community members
CREATE TABLE IF NOT EXISTS public.community_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  role TEXT DEFAULT 'member', -- 'owner', 'admin', 'moderator', 'member'
  status TEXT DEFAULT 'active', -- 'active', 'pending', 'banned'
  
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(community_id, user_id)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. NOTIFICATIONS
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  type TEXT NOT NULL, -- 'like', 'comment', 'follow', 'rsvp', 'message', 'mention', 'event_reminder', etc.
  title TEXT,
  message TEXT,
  
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  entity_type TEXT, -- 'event', 'comment', 'message', 'community'
  entity_id UUID,
  
  data JSONB DEFAULT '{}',
  
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  
  action_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. WALLET & TRANSACTIONS
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  balance DECIMAL(12, 2) DEFAULT 0,
  currency TEXT DEFAULT 'ZAR',
  vibe_points INTEGER DEFAULT 0,
  
  wallet_address TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  type TEXT NOT NULL, -- 'ticket_purchase', 'p2p_transfer', 'reward', 'refund', 'top_up', 'withdrawal'
  
  amount DECIMAL(12, 2) NOT NULL,
  currency TEXT DEFAULT 'ZAR',
  vibe_points INTEGER DEFAULT 0,
  
  status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'refunded'
  
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  ticket_id UUID,
  
  reference TEXT UNIQUE,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. TICKETS
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  
  ticket_code TEXT UNIQUE NOT NULL,
  tier TEXT DEFAULT 'general',
  tier_name TEXT,
  
  price DECIMAL(10, 2) DEFAULT 0,
  currency TEXT DEFAULT 'ZAR',
  
  status TEXT DEFAULT 'valid', -- 'valid', 'used', 'cancelled', 'expired'
  
  qr_code_url TEXT,
  
  checked_in BOOLEAN DEFAULT FALSE,
  checked_in_at TIMESTAMPTZ,
  checked_in_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 11. GAMIFICATION: ACHIEVEMENTS & BADGES
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  
  category TEXT, -- 'social', 'events', 'community', 'special'
  rarity TEXT DEFAULT 'common', -- 'common', 'rare', 'epic', 'legendary'
  
  xp_reward INTEGER DEFAULT 0,
  vibe_points_reward INTEGER DEFAULT 0,
  
  requirement_type TEXT, -- 'event_count', 'follower_count', 'streak', etc.
  requirement_value INTEGER,
  
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 12. LEADERBOARDS
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.leaderboard_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  period TEXT NOT NULL, -- 'daily', 'weekly', 'monthly', 'all_time'
  period_start DATE NOT NULL,
  
  score INTEGER DEFAULT 0,
  rank INTEGER,
  
  events_hosted INTEGER DEFAULT 0,
  events_attended INTEGER DEFAULT 0,
  likes_received INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, period, period_start)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 13. STORIES/VIBES
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.stories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  media_url TEXT NOT NULL,
  media_type TEXT DEFAULT 'image', -- 'image', 'video'
  
  text TEXT,
  text_style JSONB DEFAULT '{}',
  
  view_count INTEGER DEFAULT 0,
  viewers UUID[] DEFAULT '{}',
  
  reactions JSONB DEFAULT '{}', -- {userId: 'reaction'}
  
  duration_seconds INTEGER DEFAULT 5,
  
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 14. REPORTS & MODERATION
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  entity_type TEXT NOT NULL, -- 'event', 'user', 'comment', 'message'
  entity_id UUID NOT NULL,
  
  reason TEXT NOT NULL,
  description TEXT,
  
  status TEXT DEFAULT 'pending', -- 'pending', 'reviewed', 'resolved', 'dismissed'
  
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  resolution TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 15. VENDOR/BUSINESS PROFILES
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.vendor_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  business_name TEXT NOT NULL,
  business_type TEXT, -- 'dj', 'venue', 'catering', 'photography', etc.
  description TEXT,
  
  services JSONB DEFAULT '[]',
  portfolio JSONB DEFAULT '[]',
  pricing JSONB DEFAULT '{}',
  
  rating DECIMAL(3, 2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  
  verified BOOLEAN DEFAULT FALSE,
  
  contact_email TEXT,
  contact_phone TEXT,
  website TEXT,
  
  operating_hours JSONB DEFAULT '{}',
  service_areas TEXT[] DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 16. ANALYTICS & ACTIVITY LOGS
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  action TEXT NOT NULL, -- 'view', 'like', 'rsvp', 'share', 'search', etc.
  entity_type TEXT,
  entity_id UUID,
  
  metadata JSONB DEFAULT '{}',
  
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Search history
CREATE TABLE IF NOT EXISTS public.search_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  query TEXT NOT NULL,
  filters JSONB DEFAULT '{}',
  results_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- INDEXES FOR PERFORMANCE
-- ═══════════════════════════════════════════════════════════════════════════

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_location ON public.profiles(city, country);
CREATE INDEX IF NOT EXISTS idx_profiles_level ON public.profiles(level DESC);

-- Events
CREATE INDEX IF NOT EXISTS idx_events_author ON public.events(author_id);
CREATE INDEX IF NOT EXISTS idx_events_category ON public.events(category);
CREATE INDEX IF NOT EXISTS idx_events_datetime ON public.events(date_time);
CREATE INDEX IF NOT EXISTS idx_events_status ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_events_location ON public.events(city, country);
CREATE INDEX IF NOT EXISTS idx_events_trending ON public.events(trending_score DESC);
CREATE INDEX IF NOT EXISTS idx_events_created ON public.events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_title_trgm ON public.events USING gin(title gin_trgm_ops);

-- Interactions
CREATE INDEX IF NOT EXISTS idx_event_likes_event ON public.event_likes(event_id);
CREATE INDEX IF NOT EXISTS idx_event_likes_user ON public.event_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_event ON public.event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_user ON public.event_rsvps(user_id);
CREATE INDEX IF NOT EXISTS idx_event_saves_user ON public.event_saves(user_id);

-- Comments
CREATE INDEX IF NOT EXISTS idx_comments_event ON public.comments(event_id);
CREATE INDEX IF NOT EXISTS idx_comments_author ON public.comments(author_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON public.comments(parent_id);

-- Follows
CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id);

-- Messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.messages(created_at DESC);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id) WHERE is_read = FALSE;

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY POLICIES
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
CREATE POLICY "profiles_select_public" ON public.profiles FOR SELECT USING (NOT is_private OR id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE USING (id = auth.uid());

-- EVENTS POLICIES
CREATE POLICY "events_select_public" ON public.events FOR SELECT USING (visibility = 'public' OR author_id = auth.uid());
CREATE POLICY "events_insert_auth" ON public.events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "events_update_own" ON public.events FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "events_delete_own" ON public.events FOR DELETE USING (author_id = auth.uid());

-- EVENT LIKES POLICIES
CREATE POLICY "event_likes_select" ON public.event_likes FOR SELECT USING (TRUE);
CREATE POLICY "event_likes_insert" ON public.event_likes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "event_likes_delete" ON public.event_likes FOR DELETE USING (user_id = auth.uid());

-- EVENT RSVPS POLICIES
CREATE POLICY "event_rsvps_select" ON public.event_rsvps FOR SELECT USING (TRUE);
CREATE POLICY "event_rsvps_insert" ON public.event_rsvps FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "event_rsvps_update" ON public.event_rsvps FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "event_rsvps_delete" ON public.event_rsvps FOR DELETE USING (user_id = auth.uid());

-- EVENT SAVES POLICIES
CREATE POLICY "event_saves_select" ON public.event_saves FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "event_saves_insert" ON public.event_saves FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "event_saves_delete" ON public.event_saves FOR DELETE USING (user_id = auth.uid());

-- EVENT VIEWS (public insert for analytics)
CREATE POLICY "event_views_select" ON public.event_views FOR SELECT USING (TRUE);
CREATE POLICY "event_views_insert" ON public.event_views FOR INSERT WITH CHECK (TRUE);

-- EVENT SHARES
CREATE POLICY "event_shares_select" ON public.event_shares FOR SELECT USING (TRUE);
CREATE POLICY "event_shares_insert" ON public.event_shares FOR INSERT WITH CHECK (TRUE);

-- COMMENTS POLICIES
CREATE POLICY "comments_select" ON public.comments FOR SELECT USING (TRUE);
CREATE POLICY "comments_insert" ON public.comments FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "comments_update_own" ON public.comments FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "comments_delete_own" ON public.comments FOR DELETE USING (author_id = auth.uid());

-- COMMENT LIKES POLICIES
CREATE POLICY "comment_likes_select" ON public.comment_likes FOR SELECT USING (TRUE);
CREATE POLICY "comment_likes_insert" ON public.comment_likes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "comment_likes_delete" ON public.comment_likes FOR DELETE USING (user_id = auth.uid());

-- FOLLOWS POLICIES
CREATE POLICY "follows_select" ON public.follows FOR SELECT USING (TRUE);
CREATE POLICY "follows_insert" ON public.follows FOR INSERT WITH CHECK (follower_id = auth.uid());
CREATE POLICY "follows_delete" ON public.follows FOR DELETE USING (follower_id = auth.uid());

-- CONVERSATIONS POLICIES
CREATE POLICY "conversations_select" ON public.conversations FOR SELECT 
  USING (id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()));
CREATE POLICY "conversations_insert" ON public.conversations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "conversations_update" ON public.conversations FOR UPDATE 
  USING (id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid() AND role = 'admin'));

-- CONVERSATION PARTICIPANTS POLICIES
CREATE POLICY "conv_participants_select" ON public.conversation_participants FOR SELECT 
  USING (conversation_id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()));
CREATE POLICY "conv_participants_insert" ON public.conversation_participants FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "conv_participants_update" ON public.conversation_participants FOR UPDATE USING (user_id = auth.uid());

-- MESSAGES POLICIES
CREATE POLICY "messages_select" ON public.messages FOR SELECT 
  USING (conversation_id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()));
CREATE POLICY "messages_insert" ON public.messages FOR INSERT WITH CHECK (sender_id = auth.uid());
CREATE POLICY "messages_update" ON public.messages FOR UPDATE USING (sender_id = auth.uid());

-- COMMUNITIES POLICIES
CREATE POLICY "communities_select" ON public.communities FOR SELECT USING (privacy = 'public' OR owner_id = auth.uid());
CREATE POLICY "communities_insert" ON public.communities FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "communities_update" ON public.communities FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "communities_delete" ON public.communities FOR DELETE USING (owner_id = auth.uid());

-- COMMUNITY MEMBERS POLICIES
CREATE POLICY "community_members_select" ON public.community_members FOR SELECT USING (TRUE);
CREATE POLICY "community_members_insert" ON public.community_members FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "community_members_delete" ON public.community_members FOR DELETE USING (user_id = auth.uid());

-- NOTIFICATIONS POLICIES
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE USING (user_id = auth.uid());

-- WALLETS POLICIES
CREATE POLICY "wallets_select" ON public.wallets FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "wallets_update" ON public.wallets FOR UPDATE USING (user_id = auth.uid());

-- TRANSACTIONS POLICIES
CREATE POLICY "transactions_select" ON public.transactions FOR SELECT 
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- TICKETS POLICIES
CREATE POLICY "tickets_select" ON public.tickets FOR SELECT USING (user_id = auth.uid());

-- ACHIEVEMENTS POLICIES (public read)
CREATE POLICY "achievements_select" ON public.achievements FOR SELECT USING (TRUE);

-- USER ACHIEVEMENTS POLICIES
CREATE POLICY "user_achievements_select" ON public.user_achievements FOR SELECT USING (TRUE);

-- LEADERBOARD POLICIES (public read)
CREATE POLICY "leaderboard_select" ON public.leaderboard_entries FOR SELECT USING (TRUE);

-- STORIES POLICIES
CREATE POLICY "stories_select" ON public.stories FOR SELECT USING (expires_at > NOW());
CREATE POLICY "stories_insert" ON public.stories FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "stories_delete" ON public.stories FOR DELETE USING (author_id = auth.uid());

-- REPORTS POLICIES
CREATE POLICY "reports_insert" ON public.reports FOR INSERT WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "reports_select_own" ON public.reports FOR SELECT USING (reporter_id = auth.uid());

-- VENDOR PROFILES POLICIES
CREATE POLICY "vendor_profiles_select" ON public.vendor_profiles FOR SELECT USING (TRUE);
CREATE POLICY "vendor_profiles_insert" ON public.vendor_profiles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "vendor_profiles_update" ON public.vendor_profiles FOR UPDATE USING (user_id = auth.uid());

-- ACTIVITY LOGS POLICIES
CREATE POLICY "activity_logs_insert" ON public.activity_logs FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "activity_logs_select_own" ON public.activity_logs FOR SELECT USING (user_id = auth.uid());

-- SEARCH HISTORY POLICIES
CREATE POLICY "search_history_select" ON public.search_history FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "search_history_insert" ON public.search_history FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "search_history_delete" ON public.search_history FOR DELETE USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════
-- FUNCTIONS & TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, name, gender, interests, theme_preset)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data ->> 'gender', 'other'),
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data -> 'interests')),
      '{}'::TEXT[]
    ),
    COALESCE(NEW.raw_user_meta_data ->> 'themePreset', 'aurora-shift')
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Create wallet for new user
  INSERT INTO public.wallets (user_id, balance, vibe_points)
  VALUES (NEW.id, 0, 100)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_communities_updated_at BEFORE UPDATE ON public.communities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Increment view count function
CREATE OR REPLACE FUNCTION public.increment_views(event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.events
  SET view_count = view_count + 1
  WHERE id = event_id;
END;
$$;

-- Update follower counts
CREATE OR REPLACE FUNCTION public.update_follow_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
    UPDATE public.profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles SET followers_count = GREATEST(0, followers_count - 1) WHERE id = OLD.following_id;
    UPDATE public.profiles SET following_count = GREATEST(0, following_count - 1) WHERE id = OLD.follower_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER on_follow_change
  AFTER INSERT OR DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.update_follow_counts();

-- Update event like count
CREATE OR REPLACE FUNCTION public.update_event_like_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.events SET like_count = like_count + 1 WHERE id = NEW.event_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.events SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.event_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER on_event_like_change
  AFTER INSERT OR DELETE ON public.event_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_event_like_count();

-- Update RSVP counts
CREATE OR REPLACE FUNCTION public.update_rsvp_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Recalculate counts for the event
  UPDATE public.events SET
    rsvp_going_count = (SELECT COUNT(*) FROM public.event_rsvps WHERE event_id = COALESCE(NEW.event_id, OLD.event_id) AND status = 'going'),
    rsvp_interested_count = (SELECT COUNT(*) FROM public.event_rsvps WHERE event_id = COALESCE(NEW.event_id, OLD.event_id) AND status = 'interested')
  WHERE id = COALESCE(NEW.event_id, OLD.event_id);
  RETURN NULL;
END;
$$;

CREATE TRIGGER on_rsvp_change
  AFTER INSERT OR UPDATE OR DELETE ON public.event_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.update_rsvp_counts();

-- Update comment count
CREATE OR REPLACE FUNCTION public.update_comment_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.events SET comment_count = comment_count + 1 WHERE id = NEW.event_id;
    IF NEW.parent_id IS NOT NULL THEN
      UPDATE public.comments SET reply_count = reply_count + 1 WHERE id = NEW.parent_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.events SET comment_count = GREATEST(0, comment_count - 1) WHERE id = OLD.event_id;
    IF OLD.parent_id IS NOT NULL THEN
      UPDATE public.comments SET reply_count = GREATEST(0, reply_count - 1) WHERE id = OLD.parent_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER on_comment_change
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.update_comment_count();

-- Update comment like count
CREATE OR REPLACE FUNCTION public.update_comment_like_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.comments SET like_count = like_count + 1 WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.comments SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER on_comment_like_change
  AFTER INSERT OR DELETE ON public.comment_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_comment_like_count();

-- Update conversation last message
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.conversations SET
    last_message = NEW.text,
    last_message_at = NEW.created_at,
    last_sender_id = NEW.sender_id,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;
  
  -- Increment unread count for other participants
  UPDATE public.conversation_participants SET
    unread_count = unread_count + 1
  WHERE conversation_id = NEW.conversation_id AND user_id != NEW.sender_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message();

-- Add XP and check level up
CREATE OR REPLACE FUNCTION public.add_xp(user_id_input UUID, xp_amount INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_xp INTEGER;
  current_level INTEGER;
  new_level INTEGER;
BEGIN
  SELECT xp, level INTO current_xp, current_level FROM public.profiles WHERE id = user_id_input;
  
  new_level := FLOOR((current_xp + xp_amount) / 100) + 1;
  
  UPDATE public.profiles SET
    xp = xp + xp_amount,
    level = new_level
  WHERE id = user_id_input;
  
  -- If leveled up, create notification
  IF new_level > current_level THEN
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (user_id_input, 'level_up', 'Level Up!', 'Congratulations! You reached level ' || new_level);
  END IF;
END;
$$;

-- Calculate trending score (run periodically)
CREATE OR REPLACE FUNCTION public.calculate_trending_scores()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.events SET
    trending_score = (
      (like_count * 3) +
      (comment_count * 5) +
      (rsvp_going_count * 10) +
      (rsvp_interested_count * 5) +
      (share_count * 8) +
      (view_count * 0.1)
    ) / GREATEST(1, EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600) -- Decay over hours
  WHERE status = 'published' AND date_time > NOW();
END;
$$;

-- Create notification helper
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_actor_id UUID DEFAULT NULL,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notif_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, actor_id, entity_type, entity_id)
  VALUES (p_user_id, p_type, p_title, p_message, p_actor_id, p_entity_type, p_entity_id)
  RETURNING id INTO notif_id;
  
  RETURN notif_id;
END;
$$;

-- Generate unique ticket code
CREATE OR REPLACE FUNCTION public.generate_ticket_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := 'GRV-';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
    IF i = 4 THEN result := result || '-'; END IF;
  END LOOP;
  RETURN result;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED DATA: Achievements
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO public.achievements (name, description, icon, category, rarity, xp_reward, vibe_points_reward, requirement_type, requirement_value)
VALUES 
  ('First Vibe', 'Attend your first event', 'checkmark-circle', 'events', 'common', 50, 10, 'events_attended', 1),
  ('Social Butterfly', 'Attend 10 events', 'people', 'events', 'rare', 200, 50, 'events_attended', 10),
  ('Party Animal', 'Attend 50 events', 'flame', 'events', 'epic', 500, 150, 'events_attended', 50),
  ('Legend', 'Attend 100 events', 'trophy', 'events', 'legendary', 1000, 500, 'events_attended', 100),
  ('Host Mode', 'Create your first event', 'add-circle', 'events', 'common', 100, 25, 'events_created', 1),
  ('Event Master', 'Create 10 events', 'star', 'events', 'rare', 300, 100, 'events_created', 10),
  ('Rising Star', 'Get 100 followers', 'trending-up', 'social', 'rare', 200, 75, 'followers', 100),
  ('Influencer', 'Get 1000 followers', 'ribbon', 'social', 'epic', 500, 250, 'followers', 1000),
  ('Streak Starter', 'Maintain a 7-day activity streak', 'flame', 'social', 'common', 100, 30, 'streak', 7),
  ('Streak Master', 'Maintain a 30-day activity streak', 'bonfire', 'social', 'epic', 400, 150, 'streak', 30)
ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- DONE
-- ═══════════════════════════════════════════════════════════════════════════
