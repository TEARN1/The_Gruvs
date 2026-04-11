/**
 * THE GRUVS - DATA MODELS (Version 1.0)
 * Core schemas for all application data, supporting 1100+ features.
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1. EVENT MODEL (Supports 400+ lifecycle features)
// ═══════════════════════════════════════════════════════════════════════════

export const EventModel = {
  create: (data = {}) => ({
    id: data.id || `ev-${Date.now()}`,
    type: data.type || 'public', // public, private, local, professional, anonymous
    category: data.category || 'Social',
    subCategory: data.subCategory || 'Party',
    title: data.title || '',
    description: data.description || '',
    location: {
      address: data.location?.address || '',
      coordinates: data.location?.coordinates || { lat: 0, lng: 0 },
      venue_name: data.location?.venue_name || '',
      is_virtual: !!data.location?.is_virtual
    },
    schedule: {
      start: data.schedule?.start || new Date().toISOString(),
      end: data.schedule?.end || null,
      timezone: data.schedule?.timezone || 'Africa/Johannesburg',
      is_recurring: !!data.schedule?.is_recurring
    },
    author: {
      id: data.author?.id || 'anon',
      name: data.author?.name || 'Vibe Creator',
      avatar: data.author?.avatar || null,
      is_verified: !!data.author?.is_verified
    },
    media: {
      images: data.media?.images || [],
      videos: data.media?.videos || [],
      live_streams: data.media?.live_streams || []
    },
    engagement_metrics: {
      likes: data.engagement_metrics?.likes || [],
      comments: data.engagement_metrics?.comments || [],
      shares: data.engagement_metrics?.shares || 0,
      rsvps: data.engagement_metrics?.rsvps || {} // userId: status (going, interested, etc)
    },
    ticketing: {
      is_paid: !!data.ticketing?.is_paid,
      tiers: data.ticketing?.tiers || [],
      total_capacity: data.ticketing?.total_capacity || null,
      scarcity: data.ticketing?.scarcity || { is_filling_fast: false, remaining: 0 }
    },
    // Lifecycle Features (A to Z)
    lifecycle: {
      phase: data.lifecycle?.phase || 'pre', // pre, during, post
      features: data.lifecycle?.features || []
    },
    pulse_meta: {
      color: data.pulse_meta?.color || '#ff4da6',
      status: data.pulse_meta?.status || 'Active',
      vibe_score: data.pulse_meta?.vibe_score || 0
    }
  })
};

// ═══════════════════════════════════════════════════════════════════════════
// 2. USER PROFILE MODEL
// ═══════════════════════════════════════════════════════════════════════════

export const ProfileModel = {
  create: (data = {}) => ({
    id: data.id || '',
    username: data.username || '',
    name: data.name || '',
    bio: data.bio || '',
    avatar: data.avatar || null,
    gender: data.gender || 'other',
    interests: data.interests || [],
    stats: {
      following: data.stats?.following || 0,
      followers: data.stats?.followers || 0,
      vibes_created: data.stats?.vibes_created || 0,
      score: data.stats?.score || 100
    },
    wallet: {
      balance: data.wallet?.balance || 0,
      currency: data.wallet?.currency || 'GRUV',
      address: data.wallet?.address || ''
    },
    preferences: {
      notifications: !!data.preferences?.notifications,
      privacy: data.preferences?.privacy || 'public',
      theme: data.preferences?.theme || 'dark'
    }
  })
};

// ═══════════════════════════════════════════════════════════════════════════
// 3. TRANSACTION MODEL (Supports B2B, P2P, B2P, P2B)
// ═══════════════════════════════════════════════════════════════════════════

export const TransactionModel = {
  create: (data = {}) => ({
    id: data.id || `tx-${Date.now()}`,
    type: data.type || 'p2p', // p2p, b2b, b2p, p2b
    status: data.status || 'pending',
    amount: data.amount || 0,
    currency: data.currency || 'USD',
    sender_id: data.sender_id || '',
    receiver_id: data.receiver_id || '',
    reference: data.reference || '',
    metadata: data.metadata || {},
    timestamp: new Date().toISOString()
  })
};

export default {
  EventModel,
  ProfileModel,
  TransactionModel
};
