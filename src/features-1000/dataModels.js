/**
 * COMPREHENSIVE DATA MODELS (100+ Fields)
 * Data structure for all 1000+ features
 *
 * Includes:
 * - Event model with 100+ fields
 * - User model with 90+ fields
 * - Transaction/Order model
 * - Analytics model
 * - All supporting models
 */

// ═══════════════════════════════════════════════════════════════════════════
// EVENT MODEL (100+ FIELDS)
// ═══════════════════════════════════════════════════════════════════════════

export const EventModel = {
  // Basic Information
  id: String,
  title: String,
  description: String,
  shortDescription: String,
  slug: String,

  // Organization
  organizerId: String,
  organizerName: String,
  organizerLogo: String,
  coOrganizers: [String],
  sponsorIds: [String],

  // Categorization
  category: String,
  subcategory: String,
  categoryGroup: String,
  tags: [String],
  interests: [String],

  // Event Type & Format
  eventType: String, // 'in-person', 'virtual', 'hybrid', etc.
  eventFormat: String, // 'single-session', 'multi-session', 'recurring', etc.
  eventSize: String, // 'small', 'medium', 'large'
  isRecurring: Boolean,
  recurrencePattern: String,

  // Date & Time
  startDateTime: Date,
  endDateTime: Date,
  timezone: String,
  duration: Number,
  durationUnit: String,

  // Location
  location: String,
  address: String,
  city: String,
  state: String,
  country: String,
  zipCode: String,
  latitude: Number,
  longitude: Number,
  nearbyDistance: Number,

  // Virtual/Hybrid Details
  virtualLink: String,
  virtualPlatform: String,
  roomNumber: String,
  floor: String,
  building: String,

  // Capacity & Registrations
  capacity: Number,
  currentAttendees: Number,
  registeredCount: Number,
  checkInCount: Number,
  waitlistCount: Number,
  maxWaitlistSize: Number,

  // Pricing & Tickets
  isFree: Boolean,
  basePrice: Number,
  currency: String,
  ticketTypes: [Object], // { name, price, quantity, sold }
  earlyBirdPrice: Number,
  earlyBirdDeadline: Date,
  groupDiscount: Number,
  studentDiscount: Boolean,
  discountCodes: [Object], // { code, percentage, expiryDate }

  // Media
  coverImage: String,
  coverImageUrl: String,
  thumbnail: String,
  images: [String],
  videos: [String],
  videoUrl: String,
  livestreamUrl: String,
  livestreamPlatform: String,
  recordingUrl: String,

  // Event Details
  agenda: [Object], // { time, title, description, speaker }
  speakers: [Object], // { id, name, bio, photo, email }
  sponsor: [Object], // { id, name, logo, tier }
  booth: [Object], // { id, number, company, contact }

  // Attendance & RSVP
  rsvpDeadline: Date,
  rsvpStatus: Object, // { userId: 'yes'|'no'|'maybe' }
  attendeeList: [Object], // { userId, name, status, checkInTime }

  // Accessibility
  isAccessible: Boolean,
  accessibilityFeatures: [String], // ['wheelchair-access', 'captions', 'asl-interpreter', etc.]
  dietaryOptions: [String],
  requirementsForm: String,
  parkingAvailable: Boolean,
  publicTransitInfo: String,

  // Rules & Guidelines
  ageRestriction: Number,
  dressCode: String,
  codeOfConduct: String,
  rules: [String],

  // Status & Visibility
  status: String, // 'draft', 'published', 'live', 'ended', 'cancelled', 'postponed'
  isPublic: Boolean,
  isPrivate: Boolean,
  visibility: String, // 'public', 'friends-only', 'invite-only'
  isDraft: Boolean,
  isCancelled: Boolean,
  cancellationReason: String,
  isCancellationConfirmed: Boolean,

  // Engagement Metrics
  views: Number,
  uniqueViews: [String], // userId array
  likes: Number,
  likedBy: [String], // userId array
  saves: Number,
  savedBy: [String], // userId array
  shares: Number,
  sharedBy: [String], // userId array
  commentCount: Number,
  rsvpCount: Object, // { yes: number, no: number, maybe: number }

  // Interactions
  comments: [Object], // { id, userId, text, timestamp, likes }
  reactions: [Object], // { userId, reactionType, timestamp }
  ratings: [Object], // { userId, rating, review, timestamp }
  averageRating: Number,

  // Analytics
  clickThroughRate: Number,
  conversionRate: Number,
  engagementRate: Number,
  trendingScore: Number,
  heatIndex: Number,

  // Social Proof
  attendeeAvatars: [String], // First 3-5 attendee avatars
  mutualFriendsAttending: [Object],
  friendsCount: Number,
  influencerCount: Number,

  // Additional Features
  hashtag: String,
  relatedEvents: [String], // eventId array
  eventSeries: String,
  parentEventId: String,

  // Networking
  networkingEnabled: Boolean,
  matchingEnabled: Boolean,
  attendeeDirectory: Boolean,
  qrCodeEnabled: Boolean,

  // Follow-up
  certificateEnabled: Boolean,
  feedbackFormEnabled: Boolean,
  surveyEnabled: Boolean,

  // Reminders
  remindersEnabled: Boolean,
  reminderTimes: [Number], // [ -86400000 ] = 24 hours before

  // Metadata
  createdAt: Date,
  updatedAt: Date,
  publishedAt: Date,
  startedAt: Date,
  endedAt: Date,

  // SEO
  seoTitle: String,
  seoDescription: String,
  seoKeywords: [String],

  // Notifications
  notificationsSent: Number,
  lastNotificationTime: Date
};

// ═══════════════════════════════════════════════════════════════════════════
// USER MODEL (90+ FIELDS)
// ═══════════════════════════════════════════════════════════════════════════

export const UserModel = {
  // Account
  id: String,
  email: String,
  username: String,
  password: String,

  // Profile
  firstName: String,
  lastName: String,
  fullName: String,
  avatar: String,
  banner: String,
  bio: String,
  pronouns: String,

  // Contact
  phone: String,
  dateOfBirth: Date,

  // Details
  gender: String,
  company: String,
  jobTitle: String,
  industry: String,
  experience: String,

  // Location
  location: String,
  city: String,
  state: String,
  country: String,
  timezone: String,

  // Links
  website: String,
  linkedin: String,
  twitter: String,
  instagram: String,
  portfolio: String,

  // Professional
  verifiedProfessional: Boolean,
  professionalBadge: Boolean,
  certifications: [String],
  credentials: [Object], // { name, issuer, date }

  // Social Stats
  followers: Number,
  following: Number,
  followerIds: [String],
  followingIds: [String],
  friends: Number,
  friendIds: [String],
  blockedUsers: [String],
  blockedByUsers: [String],
  mutedUsers: [String],
  mutedCategories: [String],

  // Event Stats
  eventsCreated: Number,
  eventsAttended: Number,
  eventsSaved: Number,
  eventsInterested: Number,
  createdEventIds: [String],
  attendedEventIds: [String],
  savedEventIds: [String],

  // Engagement
  totalLikes: Number,
  totalComments: Number,
  totalShares: Number,

  // Gamification
  points: Number,
  level: Number,
  badges: [Object], // { name, icon, timestamp }
  achievements: [Object], // { name, description, unlockedAt }
  streak: Number,
  totalXP: Number,
  reputation: Number,

  // Preferences
  preferences: {
    theme: String, // 'light', 'dark'
    language: String,
    notifications: {
      email: Boolean,
      push: Boolean,
      sms: Boolean
    },
    privacy: {
      showProfile: Boolean,
      showLocation: Boolean,
      allowMessages: Boolean,
      allowComments: Boolean
    }
  },

  // Activity
  lastActive: Date,
  lastLogin: Date,
  joinDate: Date,
  lastUpdatedProfile: Date,

  // Interests & Categories
  interests: [String],
  favoriteCategories: [String],
  eventPreferences: Object,

  // Search History
  searchHistory: [Object], // { query, timestamp }
  recentlyViewed: [Object], // { eventId, timestamp }
  savedSearches: [Object], // { query, filters, savedAt }

  // Notifications
  notificationPreferences: Object,
  unreadNotificationCount: Number,
  notifications: [Object],

  // Messages
  conversationIds: [String],
  messageSettings: Object,

  // Account Settings
  accountStatus: String, // 'active', 'suspended', 'inactive'
  isPremium: Boolean,
  premiumExpiryDate: Date,
  subscriptionTier: String,

  // Verification
  emailVerified: Boolean,
  phoneVerified: Boolean,
  idVerified: Boolean,
  backgroundCheckVerified: Boolean,
  verificationBadge: Boolean,

  // Moderation
  isBanned: Boolean,
  banReason: String,
  banExpiryDate: Date,
  warnings: Number,

  // Analytics
  profileViews: Number,
  profileVisitors: [String],

  // Business (for vendors/freelancers)
  isVendor: Boolean,
  vendorProfile: Object,
  vendorRating: Number,
  vendorReviews: Number,
  services: [Object],

  // Marketing
  emailSubscribed: Boolean,
  marketingPreference: Boolean,

  // Data Privacy
  dataExportRequested: Boolean,
  dataExportDate: Date,
  gdprConsent: Boolean,
  consentDate: Date,

  // Metadata
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date,

  // Device Info
  lastDevice: String,
  lastIpAddress: String,
  lastLocation: Object
};

// ═══════════════════════════════════════════════════════════════════════════
// TRANSACTION/ORDER MODEL
// ═══════════════════════════════════════════════════════════════════════════

export const TransactionModel = {
  // Transaction Details
  id: String,
  transactionId: String,
  orderId: String,

  // Parties
  buyerId: String,
  sellerId: String,

  // Event
  eventId: String,
  eventTitle: String,

  // Tickets
  ticketType: String,
  ticketCount: Number,
  ticketIds: [String],

  // Pricing
  unitPrice: Number,
  totalPrice: Number,
  discountAmount: Number,
  taxAmount: Number,
  finalPrice: Number,
  currency: String,

  // Payment
  paymentMethod: String,
  paymentStatus: String,
  paymentDate: Date,
  paymentGateway: String,
  transactionReference: String,

  // Status
  status: String, // 'pending', 'completed', 'refunded', 'cancelled'
  isRefunded: Boolean,
  refundAmount: Number,
  refundReason: String,
  refundDate: Date,

  // Metadata
  createdAt: Date,
  updatedAt: Date,
  expiryDate: Date
};

// ═══════════════════════════════════════════════════════════════════════════
// COMMENT MODEL
// ═══════════════════════════════════════════════════════════════════════════

export const CommentModel = {
  id: String,
  eventId: String,
  authorId: String,
  authorName: String,
  authorAvatar: String,

  text: String,
  images: [String],
  videos: [String],
  media: [Object],

  likes: Number,
  likedBy: [String],

  replies: [Object],
  replyCount: Number,

  reactions: [Object], // { userId, type }

  edited: Boolean,
  editedAt: Date,

  isPinned: Boolean,
  isFeatured: Boolean,

  mentions: [Object], // { userId, name }
  hashtags: [String],

  createdAt: Date,
  updatedAt: Date
};

// ═══════════════════════════════════════════════════════════════════════════
// ENGAGEMENT METRICS MODEL
// ═══════════════════════════════════════════════════════════════════════════

export const EngagementMetricsModel = {
  id: String,
  eventId: String,

  // View Metrics
  views: Number,
  uniqueViews: Number,
  pageViews: [Object], // { date, count }
  averageTimeOnPage: Number,

  // Click Metrics
  clicks: Number,
  clickThroughRate: Number,

  // Social Metrics
  likes: Number,
  likedBy: [String],
  saves: Number,
  savedBy: [String],
  shares: Number,
  sharedBy: [String],

  // Comment Metrics
  comments: Number,
  commentSentiment: String,

  // RSVP Metrics
  rsvpYes: Number,
  rsvpNo: Number,
  rsvpMaybe: Number,

  // Reaction Metrics
  reactions: Object, // { thumbsup: 5, heart: 10, etc. }

  // Conversion Metrics
  conversions: Number,
  conversionRate: Number,

  // Engagement Rate
  engagementRate: Number,

  // Trending Score
  trendingScore: Number,
  heatIndex: Number,
  hotnessRating: String, // 'cold', 'warm', 'hot', 'viral'

  // Growth
  growthRate: Number,

  // Time Series
  hourlyStats: Object,
  dailyStats: Object,
  weeklyStats: Object,

  // Sentiments
  sentimentAnalysis: Object,

  timestamps
  createdAt: Date,
  updatedAt: Date
};

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATION MODEL
// ═══════════════════════════════════════════════════════════════════════════

export const NotificationModel = {
  id: String,
  userId: String,

  type: String, // 'like', 'comment', 'follow', 'message', etc.
  title: String,
  message: String,

  relatedEntityType: String, // 'event', 'user', 'comment'
  relatedEntityId: String,

  sender: Object,

  isRead: Boolean,
  readAt: Date,

  actionUrl: String,
  deepLink: String,

  imageUrl: String,

  createdAt: Date,
  expiryDate: Date
};

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE MODEL
// ═══════════════════════════════════════════════════════════════════════════

export const MessageModel = {
  id: String,
  conversationId: String,

  senderId: String,
  senderName: String,
  senderAvatar: String,

  receiverId: String,

  text: String,
  attachments: [Object],

  isRead: Boolean,
  readAt: Date,

  edited: Boolean,
  editedAt: Date,

  reactions: [Object],

  createdAt: Date
};

// ═══════════════════════════════════════════════════════════════════════════
// CONVERSATION MODEL
// ═══════════════════════════════════════════════════════════════════════════

export const ConversationModel = {
  id: String,
  type: String, // 'one-to-one', 'group'

  participants: [String],
  participantDetails: [Object],

  lastMessage: Object,
  lastMessageTime: Date,

  unreadCount: Object, // { userId: count }

  isArchived: Boolean,
  isMuted: Boolean,

  createdAt: Date,
  updatedAt: Date
};

// ═══════════════════════════════════════════════════════════════════════════
// ANALYTICS MODEL
// ═══════════════════════════════════════════════════════════════════════════

export const AnalyticsModel = {
  id: String,
  eventId: String,
  organizerId: String,

  // Attendance Analytics
  registrationConversion: Number,
  checkInRate: Number,
  noShowRate: Number,

  // Revenue Analytics
  grossRevenue: Number,
  netRevenue: Number,
  discountsApplied: Number,
  refundsIssued: Number,

  // Demographic Analytics
  ageDistribution: Object,
  genderDistribution: Object,
  locationDistribution: Object,
  industryDistribution: Object,

  // Source Analytics
  trafficSources: Object,
  conversionBySource: Object,

  // Engagement Analytics
  averageEngagement: Number,
  topPerformingContent: [Object],

  // Networking Analytics
  connectionsFormed: Number,
  averageConnectionsPerAttendee: Number,

  // Feedback Analytics
  npsScore: Number,
  satisfactionScore: Number,
  feedbackSentiment: String,

  // Comparison
  benchmarkData: Object,
  previousEventComparison: Object,

  // Predictions
  predictedAttendance: Number,
  predictedRevenue: Number,

  // Time-based
  hourlyBreakdown: Object,
  dailyBreakdown: Object,
  weeklyBreakdown: Object,

  // Trends
  trendAnalysis: Object,
  forecastData: Object,

  // Report Data
  generatedReports: [Object],
  lastReportGenerated: Date
};

// ═══════════════════════════════════════════════════════════════════════════
// GROUP/COMMUNITY MODEL
// ═══════════════════════════════════════════════════════════════════════════

export const GroupModel = {
  id: String,
  name: String,
  description: String,

  ownerId: String,
  moderators: [String],
  members: [String],
  memberCount: Number,

  avatar: String,
  banner: String,

  category: String,
  tags: [String],

  privacy: String, // 'public', 'private', 'invite-only'

  rules: [String],
  guidelines: String,

  createdAt: Date,
  updatedAt: Date,

  isActive: Boolean
};

// ═══════════════════════════════════════════════════════════════════════════
// ACHIEVEMENT MODEL
// ═══════════════════════════════════════════════════════════════════════════

export const AchievementModel = {
  id: String,
  userId: String,

  achievementType: String,
  title: String,
  description: String,
  icon: String,

  unlockedAt: Date,

  rarity: String, // 'common', 'rare', 'legendary'
  points: Number
};

// ═══════════════════════════════════════════════════════════════════════════
// FEEDBACK MODEL
// ═══════════════════════════════════════════════════════════════════════════

export const FeedbackModel = {
  id: String,
  eventId: String,
  userId: String,

  rating: Number,
  npsScore: Number,
  satisfactionScore: Number,

  comments: String,

  categories: Object, // { venue: 4, speakers: 5, organization: 3 }

  sentiment: String,

  wouldAttendAgain: Boolean,
  wouldRecommend: Boolean,
  recommendationLikelihood: Number,

  improvements: [String],
  highlights: [String],

  submittedAt: Date
};

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT MODELS
// ═══════════════════════════════════════════════════════════════════════════

export const ALL_MODELS = {
  EventModel,
  UserModel,
  TransactionModel,
  CommentModel,
  EngagementMetricsModel,
  NotificationModel,
  MessageModel,
  ConversationModel,
  AnalyticsModel,
  GroupModel,
  AchievementModel,
  FeedbackModel
};

/**
 * Get model by name
 */
export const getModel = (modelName) => {
  return ALL_MODELS[`${modelName}Model`] || null;
};

/**
 * Get all field names for a model
 */
export const getModelFields = (modelName) => {
  const model = getModel(modelName);
  return model ? Object.keys(model) : [];
};

/**
 * Get field count for model
 */
export const getFieldCount = (modelName) => {
  return getModelFields(modelName).length;
};

/**
 * Model Statistics
 */
export const MODEL_STATS = {
  totalModels: Object.keys(ALL_MODELS).length,
  eventFields: getFieldCount('Event'),
  userFields: getFieldCount('User'),
  eventModelSize: '100+ fields',
  userModelSize: '90+ fields',
  totalDataTypes: 12
};

export default ALL_MODELS;
