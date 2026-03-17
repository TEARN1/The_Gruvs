// EXTENDED USER MODEL WITH 50+ NEW FIELDS
export const createUserProfile = (user) => ({
  // Basic Info
  id: user.id || `user_${Date.now()}`,
  username: user.username,
  email: user.email,
  gender: user.gender,
  name: user.name,

  // Profile Details (NEW)
  bio: user.bio || '',
  avatar: user.avatar || null,
  banner: user.banner || null,
  pronouns: user.pronouns || '',
  location: user.location || '',
  website: user.website || '',
  phone: user.phone || null,
  birthDate: user.birthDate || null,

  // Verification & Status (NEW)
  verified: false,
  verificationBadge: false,
  accountStatus: 'active', // active, suspended, deactivated
  joinedDate: new Date().toISOString(),
  lastActive: new Date().toISOString(),

  // Social Stats (NEW)
  followers: [],
  following: [],
  blocked: [],
  mutedUsers: [],
  mutedCategories: [],

  // Event Stats (NEW)
  eventsCreated: 0,
  eventsAttended: 0,
  eventsSaved: [],
  eventsInterested: [],

  // Gamification (NEW)
  points: 0,
  level: 1,
  badges: [],
  achievements: [],
  streak: 0,
  reputation: 100,

  // Privacy Settings (NEW)
  privacy: 'public', // public, private, friends_only
  showEmail: false,
  showPhone: false,
  allowMessages: true,
  allowComments: true,

  // Interests & Preferences (EXPANDED)
  interests: user.interests || [],
  tags: [],
  preferences: {
    notifications: {
      email: true,
      push: true,
      sms: false,
      eventReminders: true
    },
    content: {
      language: 'en',
      adsPreference: true,
      analyticsTracking: true
    }
  },

  // Activity Data (NEW)
  viewedEvents: [],
  searchHistory: [],
  recentlyViewed: [],
  activityLog: [],

  // Premium Features (NEW)
  isPremium: false,
  premiumExpiryDate: null,
  subscriptionTier: 'free', // free, basic, pro, enterprise

  // Analytics (NEW)
  profileViews: 0,
  profileVisitors: [],

  // Metadata
  updatedAt: new Date().toISOString(),
  profileCompleteness: 25 // percentage
});

// SOCIAL INTERACTION MODEL
export const createSocialInteraction = () => ({
  followers: [],           // Users following this user
  following: [],          // Users this user follows
  friendRequests: [],     // Pending friend requests
  friends: [],            // Confirmed friends
  blocked: [],            // Users blocked by this user
  blockedBy: [],          // Users who blocked this user
  mutedUsers: [],         // Users whose content is muted
  mutedCategories: [],    // Content categories muted
  favoriteOrganizers: []  // Organizers followed
});

// ENGAGEMENT MODEL (EXPANDED)
export const createEngagementMetrics = () => ({
  // Basic Engagement
  likes: [],
  likeCount: 0,
  rsvps: {},
  rsvpCount: 0,
  comments: [],
  commentCount: 0,

  // NEW: Reactions
  reactions: {
    '👍': [],
    '❤️': [],
    '😂': [],
    '🔥': [],
    '🎉': []
  },
  reactionCount: 0,

  // NEW: Saves/Bookmarks
  savedBy: [],
  saveCount: 0,

  // NEW: Shares
  sharedBy: [],
  shareCount: 0,

  // NEW: Views & Analytics
  views: 0,
  uniqueViews: [],
  clicks: 0,
  shares: [],

  // NEW: Trending Data
  trendingScore: 0,
  heatIndex: 0,
  hotnessRating: 'cold', // cold, warm, hot, viral

  // Timeline
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lastEngagementAt: null
});

// COMMENT MODEL (EXPANDED)
export const createComment = (data) => ({
  id: `comment_${Date.now()}`,
  authorId: data.authorId,
  authorName: data.authorName,
  authorAvatar: data.authorAvatar || null,
  eventId: data.eventId,
  text: data.text,

  // NEW: Media in comments
  media: data.media || null, // image, video, emoji

  // NEW: Comment engagement
  likes: [],
  likeCount: 0,
  replies: [],
  replyCount: 0,

  // NEW: Comment features
  edited: false,
  editedAt: null,
  isPinned: false,
  isFeatured: false,
  mentions: data.mentions || [], // @mentions
  hashtags: data.hashtags || [], // #tags

  // Metadata
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

// NOTIFICATION MODEL (NEW)
export const createNotification = (data) => ({
  id: `notif_${Date.now()}`,
  recipientId: data.recipientId,
  senderId: data.senderId,
  type: data.type, // 'like', 'comment', 'follow', 'rsvp', 'share', 'mention'
  actionId: data.actionId, // ID of the action
  actionType: data.actionType, // 'event', 'comment', 'user'
  title: data.title,
  message: data.message,
  icon: data.icon || '🔔',
  read: false,
  readAt: null,
  actionUrl: data.actionUrl || null,
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
});

// MESSAGE MODEL (NEW)
export const createMessage = (data) => ({
  id: `msg_${Date.now()}`,
  conversationId: data.conversationId,
  senderId: data.senderId,
  senderName: data.senderName,
  senderAvatar: data.senderAvatar || null,
  recipientId: data.recipientId,
  text: data.text,

  // Media
  media: data.media || null, // image, video, audio

  // Message features
  edited: false,
  editedAt: null,
  reactions: {},
  readBy: [],
  readAt: null,

  // Threading
  replyTo: null,
  relatedMessages: [],

  // Metadata
  createdAt: new Date().toISOString(),
  deletedAt: null,
  encrypted: false
});

// CONVERSATION MODEL (NEW)
export const createConversation = (participants) => ({
  id: `conv_${Date.now()}`,
  participants: participants, // array of user IDs
  participantDetails: [], // array of user objects
  lastMessage: null,
  lastMessageAt: null,
  messageCount: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  archived: false,
  muted: false,
  pinned: false
});

// SEARCH MODEL (NEW)
export const createSearchResult = (data) => ({
  id: data.id,
  type: data.type, // 'event', 'user', 'tag', 'category'
  title: data.title,
  description: data.description || '',
  icon: data.icon,
  thumbnail: data.thumbnail || null,
  relevanceScore: data.relevanceScore || 0,
  tags: data.tags || [],
  createdAt: data.createdAt,
  metadata: data.metadata || {}
});

// ACHIEVEMENT MODEL (NEW)
export const createAchievement = (data) => ({
  id: data.id,
  name: data.name,
  description: data.description,
  icon: data.icon,
  requirement: data.requirement, // what user needs to do
  points: data.points || 10,
  rarity: data.rarity, // common, uncommon, rare, epic, legendary
  unlockedAt: null,
  unlocked: false
});

// GROUP/COMMUNITY MODEL (NEW)
export const createGroup = (data) => ({
  id: `group_${Date.now()}`,
  name: data.name,
  description: data.description,
  owner: data.ownerId,
  members: [data.ownerId],
  memberCount: 1,
  avatar: data.avatar || null,
  banner: data.banner || null,
  privacy: data.privacy || 'public', // public, private, invite_only
  category: data.category || 'general',
  tags: data.tags || [],
  rules: data.rules || [],

  // Group Activity
  posts: [],
  events: [],
  discussions: [],
  postCount: 0,
  eventCount: 0,

  // Moderation
  moderators: [data.ownerId],
  bannedMembers: [],
  reportedContent: [],

  // Analytics
  joinRequests: [],
  viewCount: 0,
  joinedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

// SAVED SEARCH MODEL (NEW)
export const createSavedSearch = (data) => ({
  id: `search_${Date.now()}`,
  userId: data.userId,
  name: data.name,
  query: data.query,
  filters: data.filters,
  alerts: data.alerts || false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

// ACTIVITY LOG MODEL (NEW)
export const createActivityLog = (data) => ({
  id: `log_${Date.now()}`,
  userId: data.userId,
  action: data.action, // 'created_event', 'attended_event', 'liked', 'commented', 'followed'
  targetType: data.targetType, // 'event', 'user', 'comment'
  targetId: data.targetId,
  metadata: data.metadata || {},
  timestamp: new Date().toISOString()
});
