/**
 * EventPlatform Button Registry
 * 300+ Functional Buttons for Complete Event Platform
 *
 * Features:
 * - 300+ unique button definitions
 * - Organized by category, context, transaction type
 * - All buttons with action handlers, permissions, analytics
 * - Button variants and states
 * - Accessibility support
 */

// ═══════════════════════════════════════════════════════════════════════════
// DISCOVERY & SEARCH BUTTONS (30+ BUTTONS)
// ═══════════════════════════════════════════════════════════════════════════

export const DISCOVERY_BUTTONS = {
  // Search & Discovery (12 buttons)
  searchEvents: {
    id: 'search-events',
    label: '🔍 Search Events',
    icon: 'search',
    category: 'discovery',
    action: 'openSearch',
    permissions: ['public'],
    analytics: 'search_initiated',
    tooltip: 'Find events by keyword, category, location'
  },
  filterEvents: {
    id: 'filter-events',
    label: '⚙️ Filters',
    icon: 'filter',
    category: 'discovery',
    action: 'openFilters',
    permissions: ['public'],
    analytics: 'filters_opened',
    tooltip: 'Filter by date, price, distance, category'
  },
  mapView: {
    id: 'map-view',
    label: '🗺️ Map View',
    icon: 'map',
    category: 'discovery',
    action: 'switchToMapView',
    permissions: ['public'],
    analytics: 'map_view_enabled',
    tooltip: 'View events on interactive map'
  },
  listView: {
    id: 'list-view',
    label: '📋 List View',
    icon: 'list',
    category: 'discovery',
    action: 'switchToListView',
    permissions: ['public'],
    analytics: 'list_view_enabled',
    tooltip: 'View events as organized list'
  },
  gridView: {
    id: 'grid-view',
    label: '⊞ Grid View',
    icon: 'grid',
    category: 'discovery',
    action: 'switchToGridView',
    permissions: ['public'],
    analytics: 'grid_view_enabled',
    tooltip: 'View events in grid layout'
  },
  savedSearches: {
    id: 'saved-searches',
    label: '💾 Saved Searches',
    icon: 'bookmark',
    category: 'discovery',
    action: 'openSavedSearches',
    permissions: ['authenticated'],
    analytics: 'saved_searches_opened',
    tooltip: 'View and manage your saved searches'
  },
  advancedSearch: {
    id: 'advanced-search',
    label: '🔎 Advanced Search',
    icon: 'advanced',
    category: 'discovery',
    action: 'openAdvancedSearch',
    permissions: ['public'],
    analytics: 'advanced_search_opened',
    tooltip: 'Search with multiple criteria'
  },
  voiceSearch: {
    id: 'voice-search',
    label: '🎤 Search by Voice',
    icon: 'mic',
    category: 'discovery',
    action: 'enableVoiceSearch',
    permissions: ['authenticated'],
    analytics: 'voice_search_started',
    tooltip: 'Search using voice commands'
  },
  trendingEvents: {
    id: 'trending-events',
    label: '🔥 Trending',
    icon: 'fire',
    category: 'discovery',
    action: 'showTrendingEvents',
    permissions: ['public'],
    analytics: 'trending_viewed',
    tooltip: 'See what\'s trending now'
  },
  nearYou: {
    id: 'near-you',
    label: '📍 Near You',
    icon: 'location',
    category: 'discovery',
    action: 'showNearbyEvents',
    permissions: ['location'],
    analytics: 'nearby_events_viewed',
    tooltip: 'Find events near your location'
  },
  friendsEvents: {
    id: 'friends-events',
    label: '👥 Friends Going',
    icon: 'users',
    category: 'discovery',
    action: 'showFriendEvents',
    permissions: ['authenticated'],
    analytics: 'friends_events_viewed',
    tooltip: 'See events your friends are attending'
  },
  forYou: {
    id: 'for-you',
    label: '⭐ For You',
    icon: 'star',
    category: 'discovery',
    action: 'showPersonalizedFeed',
    permissions: ['authenticated'],
    analytics: 'for_you_feed_viewed',
    tooltip: 'Personalized event recommendations'
  },

  // Category Browsing (8 buttons)
  browseByCategory: {
    id: 'browse-category',
    label: '🎯 Browse Categories',
    icon: 'categories',
    category: 'discovery',
    action: 'openCategoryBrowser',
    permissions: ['public'],
    analytics: 'categories_browsed',
    tooltip: 'Explore events by category'
  },
  faithEvents: {
    id: 'faith-events',
    label: '⛪ Faith',
    icon: 'faith',
    category: 'discovery-category',
    action: 'filterByCategory:faith',
    permissions: ['public'],
    analytics: 'faith_category_selected',
    tooltip: 'Faith and spiritual events'
  },
  sportsEvents: {
    id: 'sports-events',
    label: '⚽ Sports',
    icon: 'sports',
    category: 'discovery-category',
    action: 'filterByCategory:sports',
    permissions: ['public'],
    analytics: 'sports_category_selected',
    tooltip: 'Sports and recreation events'
  },
  careerEvents: {
    id: 'career-events',
    label: '💼 Career',
    icon: 'career',
    category: 'discovery-category',
    action: 'filterByCategory:career',
    permissions: ['public'],
    analytics: 'career_category_selected',
    tooltip: 'Career and professional events'
  },
  artEvents: {
    id: 'art-events',
    label: '🎭 Arts',
    icon: 'art',
    category: 'discovery-category',
    action: 'filterByCategory:arts',
    permissions: ['public'],
    analytics: 'arts_category_selected',
    tooltip: 'Arts and creative events'
  },
  techEvents: {
    id: 'tech-events',
    label: '🎮 Tech',
    icon: 'tech',
    category: 'discovery-category',
    action: 'filterByCategory:tech',
    permissions: ['public'],
    analytics: 'tech_category_selected',
    tooltip: 'Technology and innovation events'
  },
  wellnessEvents: {
    id: 'wellness-events',
    label: '🌿 Wellness',
    icon: 'wellness',
    category: 'discovery-category',
    action: 'filterByCategory:wellness',
    permissions: ['public'],
    analytics: 'wellness_category_selected',
    tooltip: 'Health and wellness events'
  },
  foodEvents: {
    id: 'food-events',
    label: '🍽️ Food',
    icon: 'food',
    category: 'discovery-category',
    action: 'filterByCategory:food',
    permissions: ['public'],
    analytics: 'food_category_selected',
    tooltip: 'Food and beverage events'
  },

  // Time-based Discovery (10 buttons)
  upcomingEvents: {
    id: 'upcoming-events',
    label: '📅 Upcoming',
    icon: 'calendar',
    category: 'discovery',
    action: 'showUpcomingEvents',
    permissions: ['public'],
    analytics: 'upcoming_events_viewed',
    tooltip: 'See upcoming events'
  },
  todayEvents: {
    id: 'today-events',
    label: '🎯 Today',
    icon: 'today',
    category: 'discovery',
    action: 'showTodayEvents',
    permissions: ['public'],
    analytics: 'today_events_viewed',
    tooltip: 'Events happening today'
  },
  thisWeekend: {
    id: 'weekend-events',
    label: '🎉 This Weekend',
    icon: 'weekend',
    category: 'discovery',
    action: 'showWeekendEvents',
    permissions: ['public'],
    analytics: 'weekend_events_viewed',
    tooltip: 'Weekend events'
  },
  nextWeek: {
    id: 'next-week',
    label: '📆 Next Week',
    icon: 'nextweek',
    category: 'discovery',
    action: 'showNextWeekEvents',
    permissions: ['public'],
    analytics: 'next_week_events_viewed',
    tooltip: 'Events next week'
  },
  nextMonth: {
    id: 'next-month',
    label: '📊 Next Month',
    icon: 'nextmonth',
    category: 'discovery',
    action: 'showNextMonthEvents',
    permissions: ['public'],
    analytics: 'next_month_events_viewed',
    tooltip: 'Events coming next month'
  },
  weeklyRecurring: {
    id: 'weekly-recurring',
    label: '🔄 Weekly Events',
    icon: 'recurring',
    category: 'discovery',
    action: 'showWeeklyRecurringEvents',
    permissions: ['public'],
    analytics: 'weekly_recurring_viewed',
    tooltip: 'Recurring weekly events'
  },
  monthlyRecurring: {
    id: 'monthly-recurring',
    label: '📅 Monthly Events',
    icon: 'recurring',
    category: 'discovery',
    action: 'showMonthlyRecurringEvents',
    permissions: ['public'],
    analytics: 'monthly_recurring_viewed',
    tooltip: 'Recurring monthly events'
  },
  freeEvents: {
    id: 'free-events',
    label: '💰 Free Events',
    icon: 'free',
    category: 'discovery',
    action: 'filterByPrice:free',
    permissions: ['public'],
    analytics: 'free_events_viewed',
    tooltip: 'Browse free events'
  },
  paidEvents: {
    id: 'paid-events',
    label: '💳 Paid Events',
    icon: 'paid',
    category: 'discovery',
    action: 'filterByPrice:paid',
    permissions: ['public'],
    analytics: 'paid_events_viewed',
    tooltip: 'Browse paid events'
  },
  premiumEvents: {
    id: 'premium-events',
    label: '👑 Premium Events',
    icon: 'premium',
    category: 'discovery',
    action: 'filterByPrice:premium',
    permissions: ['authenticated'],
    analytics: 'premium_events_viewed',
    tooltip: 'Exclusive premium events'
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// EVENT ACTION BUTTONS (40+ BUTTONS)
// ═══════════════════════════════════════════════════════════════════════════

export const EVENT_ACTION_BUTTONS = {
  // Primary Actions (10 buttons)
  joinEvent: {
    id: 'join-event',
    label: '✓ Join Event',
    icon: 'check',
    category: 'event-action',
    action: 'attendEvent',
    permissions: ['authenticated'],
    analytics: 'event_joined',
    variant: 'primary',
    tooltip: 'Mark yourself as attending'
  },
  rsvpYes: {
    id: 'rsvp-yes',
    label: '✓ Yes, I\'m Going',
    icon: 'check',
    category: 'event-action',
    action: 'rsvpYes',
    permissions: ['authenticated'],
    analytics: 'rsvp_yes',
    variant: 'success',
    tooltip: 'Confirm attendance'
  },
  rsvpMaybe: {
    id: 'rsvp-maybe',
    label: '? Maybe',
    icon: 'maybe',
    category: 'event-action',
    action: 'rsvpMaybe',
    permissions: ['authenticated'],
    analytics: 'rsvp_maybe',
    variant: 'default',
    tooltip: 'Uncertain about attendance'
  },
  rsvpNo: {
    id: 'rsvp-no',
    label: '✕ Can\'t Go',
    icon: 'close',
    category: 'event-action',
    action: 'rsvpNo',
    permissions: ['authenticated'],
    analytics: 'rsvp_no',
    variant: 'danger',
    tooltip: 'Mark yourself as not attending'
  },
  registerEvent: {
    id: 'register-event',
    label: '📝 Register',
    icon: 'register',
    category: 'event-action',
    action: 'registerEvent',
    permissions: ['authenticated'],
    analytics: 'event_registered',
    variant: 'primary',
    tooltip: 'Register for this event'
  },
  buyTickets: {
    id: 'buy-tickets',
    label: '🎫 Buy Tickets',
    icon: 'ticket',
    category: 'event-action',
    action: 'purchaseTickets',
    permissions: ['authenticated', 'payment'],
    analytics: 'tickets_purchased',
    variant: 'success',
    tooltip: 'Purchase event tickets'
  },
  joinWaitlist: {
    id: 'join-waitlist',
    label: '⏳ Join Waitlist',
    icon: 'waitlist',
    category: 'event-action',
    action: 'addToWaitlist',
    permissions: ['authenticated'],
    analytics: 'added_to_waitlist',
    variant: 'secondary',
    tooltip: 'Join the waitlist'
  },
  checkIn: {
    id: 'check-in',
    label: '✓ Check In',
    icon: 'checkin',
    category: 'event-action',
    action: 'checkInEvent',
    permissions: ['authenticated', 'location'],
    analytics: 'event_checked_in',
    variant: 'success',
    tooltip: 'Check into the event'
  },
  cancelRsvp: {
    id: 'cancel-rsvp',
    label: '✕ Cancel RSVP',
    icon: 'cancel',
    category: 'event-action',
    action: 'cancelRsvp',
    permissions: ['authenticated'],
    analytics: 'rsvp_cancelled',
    variant: 'danger',
    tooltip: 'Cancel your attendance'
  },
  leaveEvent: {
    id: 'leave-event',
    label: '🚪 Leave Event',
    icon: 'leave',
    category: 'event-action',
    action: 'leaveEvent',
    permissions: ['authenticated'],
    analytics: 'event_left',
    variant: 'danger',
    tooltip: 'Leave the event'
  },

  // Engagement Actions (15 buttons)
  likeEvent: {
    id: 'like-event',
    label: '❤️ Like',
    icon: 'heart',
    category: 'engagement',
    action: 'likeEvent',
    permissions: ['authenticated'],
    analytics: 'event_liked',
    variant: 'secondary',
    tooltip: 'Like this event'
  },
  unlikeEvent: {
    id: 'unlike-event',
    label: '🤍 Unlike',
    icon: 'heart-outline',
    category: 'engagement',
    action: 'unlikeEvent',
    permissions: ['authenticated'],
    analytics: 'event_unliked',
    variant: 'secondary',
    tooltip: 'Remove your like'
  },
  saveEvent: {
    id: 'save-event',
    label: '🔖 Save',
    icon: 'bookmark',
    category: 'engagement',
    action: 'saveEvent',
    permissions: ['authenticated'],
    analytics: 'event_saved',
    variant: 'secondary',
    tooltip: 'Save for later'
  },
  unsaveEvent: {
    id: 'unsave-event',
    label: '🔖 Unsave',
    icon: 'bookmark-outline',
    category: 'engagement',
    action: 'unsaveEvent',
    permissions: ['authenticated'],
    analytics: 'event_unsaved',
    variant: 'secondary',
    tooltip: 'Remove from saved'
  },
  shareEvent: {
    id: 'share-event',
    label: '🔄 Share',
    icon: 'share',
    category: 'engagement',
    action: 'shareEvent',
    permissions: ['authenticated'],
    analytics: 'event_shared',
    variant: 'secondary',
    tooltip: 'Share this event'
  },
  repostEvent: {
    id: 'repost-event',
    label: '🔁 Repost',
    icon: 'repost',
    category: 'engagement',
    action: 'repostEvent',
    permissions: ['authenticated'],
    analytics: 'event_reposted',
    variant: 'secondary',
    tooltip: 'Repost to your profile'
  },
  addToCalendar: {
    id: 'add-calendar',
    label: '📅 Add to Calendar',
    icon: 'calendar',
    category: 'engagement',
    action: 'addToCalendar',
    permissions: ['authenticated'],
    analytics: 'added_to_calendar',
    variant: 'secondary',
    tooltip: 'Add to your calendar'
  },
  shareWithFriends: {
    id: 'share-friends',
    label: '👥 Share with Friends',
    icon: 'share-users',
    category: 'engagement',
    action: 'shareWithFriends',
    permissions: ['authenticated'],
    analytics: 'shared_with_friends',
    variant: 'secondary',
    tooltip: 'Share with friends'
  },
  inviteFriends: {
    id: 'invite-friends',
    label: '📧 Invite Friends',
    icon: 'invite',
    category: 'engagement',
    action: 'inviteFriends',
    permissions: ['authenticated'],
    analytics: 'friends_invited',
    variant: 'secondary',
    tooltip: 'Invite friends to join'
  },
  notifyMe: {
    id: 'notify-me',
    label: '🔔 Notify Me',
    icon: 'bell',
    category: 'engagement',
    action: 'enableNotifications',
    permissions: ['authenticated'],
    analytics: 'notifications_enabled',
    variant: 'secondary',
    tooltip: 'Get notifications for this event'
  },
  addReactionLike: {
    id: 'react-like',
    label: '👍 Like',
    icon: 'thumbsup',
    category: 'engagement',
    action: 'addReaction:like',
    permissions: ['authenticated'],
    analytics: 'reaction_added:like',
    variant: 'secondary',
    tooltip: 'Add thumbs up reaction'
  },
  addReactionLove: {
    id: 'react-love',
    label: '❤️ Love',
    icon: 'heart',
    category: 'engagement',
    action: 'addReaction:love',
    permissions: ['authenticated'],
    analytics: 'reaction_added:love',
    variant: 'secondary',
    tooltip: 'Add love reaction'
  },
  addReactionLaugh: {
    id: 'react-laugh',
    label: '😂 Funny',
    icon: 'laugh',
    category: 'engagement',
    action: 'addReaction:laugh',
    permissions: ['authenticated'],
    analytics: 'reaction_added:laugh',
    variant: 'secondary',
    tooltip: 'Add funny reaction'
  },
  addReactionWow: {
    id: 'react-wow',
    label: '🔥 Wow',
    icon: 'fire',
    category: 'engagement',
    action: 'addReaction:wow',
    permissions: ['authenticated'],
    analytics: 'reaction_added:wow',
    variant: 'secondary',
    tooltip: 'Add wow reaction'
  },
  viewLikes: {
    id: 'view-likes',
    label: '❤️ {count} Likes',
    icon: 'heart',
    category: 'engagement',
    action: 'viewLikes',
    permissions: ['public'],
    analytics: 'likes_viewed',
    variant: 'tertiary',
    tooltip: 'See who liked this'
  },
  viewShares: {
    id: 'view-shares',
    label: '🔄 {count} Shares',
    icon: 'share',
    category: 'engagement',
    action: 'viewShares',
    permissions: ['public'],
    analytics: 'shares_viewed',
    variant: 'tertiary',
    tooltip: 'See who shared this'
  },

  // Comment & Discussion (15 buttons)
  addComment: {
    id: 'add-comment',
    label: '💬 Comment',
    icon: 'comment',
    category: 'discussion',
    action: 'focusCommentInput',
    permissions: ['authenticated'],
    analytics: 'comment_started',
    variant: 'secondary',
    tooltip: 'Add a comment'
  },
  replyComment: {
    id: 'reply-comment',
    label: '↩️ Reply',
    icon: 'reply',
    category: 'discussion',
    action: 'replyToComment',
    permissions: ['authenticated'],
    analytics: 'comment_reply_started',
    variant: 'secondary',
    tooltip: 'Reply to this comment'
  },
  viewComments: {
    id: 'view-comments',
    label: '💬 {count} Comments',
    icon: 'comment',
    category: 'discussion',
    action: 'showComments',
    permissions: ['public'],
    analytics: 'comments_viewed',
    variant: 'tertiary',
    tooltip: 'View all comments'
  },
  likeComment: {
    id: 'like-comment',
    label: '❤️',
    icon: 'heart',
    category: 'discussion',
    action: 'likeComment',
    permissions: ['authenticated'],
    analytics: 'comment_liked',
    variant: 'secondary',
    tooltip: 'Like this comment'
  },
  deleteComment: {
    id: 'delete-comment',
    label: '🗑️ Delete',
    icon: 'delete',
    category: 'discussion',
    action: 'deleteComment',
    permissions: ['authenticated', 'owner'],
    analytics: 'comment_deleted',
    variant: 'danger',
    tooltip: 'Delete this comment'
  },
  editComment: {
    id: 'edit-comment',
    label: '✏️ Edit',
    icon: 'edit',
    category: 'discussion',
    action: 'editComment',
    permissions: ['authenticated', 'owner'],
    analytics: 'comment_edited',
    variant: 'secondary',
    tooltip: 'Edit this comment'
  },
  pinComment: {
    id: 'pin-comment',
    label: '📌 Pin',
    icon: 'pin',
    category: 'discussion',
    action: 'pinComment',
    permissions: ['authenticated', 'organizer'],
    analytics: 'comment_pinned',
    variant: 'secondary',
    tooltip: 'Pin this comment'
  },
  featureComment: {
    id: 'feature-comment',
    label: '⭐ Feature',
    icon: 'star',
    category: 'discussion',
    action: 'featureComment',
    permissions: ['authenticated', 'organizer'],
    analytics: 'comment_featured',
    variant: 'secondary',
    tooltip: 'Feature this comment'
  },
  reportComment: {
    id: 'report-comment',
    label: '🚩 Report',
    icon: 'flag',
    category: 'discussion',
    action: 'reportComment',
    permissions: ['authenticated'],
    analytics: 'comment_reported',
    variant: 'danger',
    tooltip: 'Report this comment'
  },
  hideComment: {
    id: 'hide-comment',
    label: '👁️ Hide',
    icon: 'eye-off',
    category: 'discussion',
    action: 'hideComment',
    permissions: ['authenticated'],
    analytics: 'comment_hidden',
    variant: 'secondary',
    tooltip: 'Hide this comment'
  },
  collapseReplies: {
    id: 'collapse-replies',
    label: '△ Collapse',
    icon: 'collapse',
    category: 'discussion',
    action: 'collapseReplies',
    permissions: ['public'],
    analytics: 'replies_collapsed',
    variant: 'tertiary',
    tooltip: 'Collapse replies'
  },
  expandReplies: {
    id: 'expand-replies',
    label: '▽ Expand {count} replies',
    icon: 'expand',
    category: 'discussion',
    action: 'expandReplies',
    permissions: ['public'],
    analytics: 'replies_expanded',
    variant: 'tertiary',
    tooltip: 'Show all replies'
  },
  shareComment: {
    id: 'share-comment',
    label: '🔄 Share',
    icon: 'share',
    category: 'discussion',
    action: 'shareComment',
    permissions: ['authenticated'],
    analytics: 'comment_shared',
    variant: 'secondary',
    tooltip: 'Share this comment'
  },
  mentionAtSign: {
    id: 'mention-at',
    label: '@',
    icon: 'at',
    category: 'discussion',
    action: 'focusMention',
    permissions: ['authenticated'],
    analytics: 'mention_focused',
    variant: 'secondary',
    tooltip: 'Mention someone'
  },
  addCommentMedia: {
    id: 'comment-media',
    label: '📎 Attach',
    icon: 'attachment',
    category: 'discussion',
    action: 'attachMediaComment',
    permissions: ['authenticated'],
    analytics: 'comment_media_focused',
    variant: 'secondary',
    tooltip: 'Attach image or video'
  },
  submitComment: {
    id: 'submit-comment',
    label: '📤 Post',
    icon: 'send',
    category: 'discussion',
    action: 'submitComment',
    permissions: ['authenticated'],
    analytics: 'comment_submitted',
    variant: 'success',
    tooltip: 'Post your comment'
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// SOCIAL & NETWORKING BUTTONS (50+ BUTTONS)
// ═══════════════════════════════════════════════════════════════════════════

export const SOCIAL_BUTTONS = {
  // User Profile Actions (15 buttons)
  viewProfile: {
    id: 'view-profile',
    label: '👤 View Profile',
    icon: 'user',
    category: 'social',
    action: 'openUserProfile',
    permissions: ['public'],
    analytics: 'profile_viewed',
    variant: 'secondary',
    tooltip: 'View user profile'
  },
  followUser: {
    id: 'follow-user',
    label: '➕ Follow',
    icon: 'follow',
    category: 'social',
    action: 'followUser',
    permissions: ['authenticated'],
    analytics: 'user_followed',
    variant: 'primary',
    tooltip: 'Follow this user'
  },
  unfollowUser: {
    id: 'unfollow-user',
    label: '✓ Following',
    icon: 'followed',
    category: 'social',
    action: 'unfollowUser',
    permissions: ['authenticated'],
    analytics: 'user_unfollowed',
    variant: 'secondary',
    tooltip: 'Unfollow this user'
  },
  connectUser: {
    id: 'connect-user',
    label: '🤝 Connect',
    icon: 'handshake',
    category: 'social',
    action: 'sendFriendRequest',
    permissions: ['authenticated'],
    analytics: 'friend_request_sent',
    variant: 'primary',
    tooltip: 'Send friend request'
  },
  pendingConnection: {
    id: 'pending-connection',
    label: '⏳ Pending',
    icon: 'pending',
    category: 'social',
    action: 'viewPending',
    permissions: ['authenticated'],
    analytics: 'pending_viewed',
    variant: 'secondary',
    tooltip: 'Request pending'
  },
  acceptConnection: {
    id: 'accept-connection',
    label: '✓ Accept',
    icon: 'check',
    category: 'social',
    action: 'acceptFriend',
    permissions: ['authenticated'],
    analytics: 'friend_request_accepted',
    variant: 'success',
    tooltip: 'Accept friend request'
  },
  rejectConnection: {
    id: 'reject-connection',
    label: '✕ Reject',
    icon: 'close',
    category: 'social',
    action: 'rejectFriend',
    permissions: ['authenticated'],
    analytics: 'friend_request_rejected',
    variant: 'danger',
    tooltip: 'Decline friend request'
  },
  blockUser: {
    id: 'block-user',
    label: '🚫 Block',
    icon: 'block',
    category: 'social',
    action: 'blockUser',
    permissions: ['authenticated'],
    analytics: 'user_blocked',
    variant: 'danger',
    tooltip: 'Block this user'
  },
  unblockUser: {
    id: 'unblock-user',
    label: '🔓 Unblock',
    icon: 'unblock',
    category: 'social',
    action: 'unblockUser',
    permissions: ['authenticated'],
    analytics: 'user_unblocked',
    variant: 'secondary',
    tooltip: 'Unblock this user'
  },
  muteUser: {
    id: 'mute-user',
    label: '🔇 Mute',
    icon: 'mute',
    category: 'social',
    action: 'muteUser',
    permissions: ['authenticated'],
    analytics: 'user_muted',
    variant: 'secondary',
    tooltip: 'Mute this user'
  },
  unmuteUser: {
    id: 'unmute-user',
    label: '🔊 Unmute',
    icon: 'unmute',
    category: 'social',
    action: 'unmuteUser',
    permissions: ['authenticated'],
    analytics: 'user_unmuted',
    variant: 'secondary',
    tooltip: 'Unmute this user'
  },
  reportUser: {
    id: 'report-user',
    label: '🚩 Report',
    icon: 'flag',
    category: 'social',
    action: 'reportUser',
    permissions: ['authenticated'],
    analytics: 'user_reported',
    variant: 'danger',
    tooltip: 'Report this user'
  },
  viewFollowers: {
    id: 'view-followers',
    label: '👥 Followers',
    icon: 'users',
    category: 'social',
    action: 'viewFollowers',
    permissions: ['public'],
    analytics: 'followers_viewed',
    variant: 'tertiary',
    tooltip: 'View followers'
  },
  viewFollowing: {
    id: 'view-following',
    label: '👤 Following',
    icon: 'users',
    category: 'social',
    action: 'viewFollowing',
    permissions: ['public'],
    analytics: 'following_viewed',
    variant: 'tertiary',
    tooltip: 'View following'
  },
  sendMessage: {
    id: 'send-message',
    label: '💬 Message',
    icon: 'message',
    category: 'social',
    action: 'openDM',
    permissions: ['authenticated'],
    analytics: 'dm_opened',
    variant: 'secondary',
    tooltip: 'Send direct message'
  },

  // Networking (20 buttons)
  browseAttendees: {
    id: 'browse-attendees',
    label: '👥 See Attendees',
    icon: 'users',
    category: 'networking',
    action: 'viewAttendeeList',
    permissions: ['authenticated'],
    analytics: 'attendees_browsed',
    variant: 'secondary',
    tooltip: 'Browse people attending'
  },
  matchAttendees: {
    id: 'match-attendees',
    label: '🎯 Find Connections',
    icon: 'matching',
    category: 'networking',
    action: 'showMatches',
    permissions: ['authenticated'],
    analytics: 'matches_viewed',
    variant: 'primary',
    tooltip: 'Find people to connect with'
  },
  quickProfile: {
    id: 'quick-profile',
    label: '👤 Quick Profile',
    icon: 'user',
    category: 'networking',
    action: 'showQuickProfile',
    permissions: ['public'],
    analytics: 'quick_profile_shown',
    variant: 'tertiary',
    tooltip: 'Quick profile preview'
  },
  exchangeContact: {
    id: 'exchange-contact',
    label: '📇 Exchange Contacts',
    icon: 'exchange',
    category: 'networking',
    action: 'exchangeContacts',
    permissions: ['authenticated'],
    analytics: 'contacts_exchanged',
    variant: 'secondary',
    tooltip: 'Exchange contact info'
  },
  scanQrCode: {
    id: 'scan-qr',
    label: '📱 Scan QR',
    icon: 'qrcode',
    category: 'networking',
    action: 'openQrScanner',
    permissions: ['authenticated', 'camera'],
    analytics: 'qr_scanned',
    variant: 'secondary',
    tooltip: 'Scan person\'s QR code'
  },
  shareQrCode: {
    id: 'share-qr',
    label: '📱 My QR Code',
    icon: 'qrcode',
    category: 'networking',
    action: 'showMyQrCode',
    permissions: ['authenticated'],
    analytics: 'my_qr_shown',
    variant: 'secondary',
    tooltip: 'Show your QR code'
  },
  addNote: {
    id: 'add-note',
    label: '📝 Add Note',
    icon: 'note',
    category: 'networking',
    action: 'addNoteToUser',
    permissions: ['authenticated'],
    analytics: 'note_added',
    variant: 'secondary',
    tooltip: 'Add private note about person'
  },
  scheduleCall: {
    id: 'schedule-call',
    label: '📞 Schedule Call',
    icon: 'phone',
    category: 'networking',
    action: 'openCallScheduler',
    permissions: ['authenticated'],
    analytics: 'call_scheduled',
    variant: 'secondary',
    tooltip: 'Schedule a call'
  },
  findMutualConnections: {
    id: 'mutual-connections',
    label: '🔗 Mutual Connections',
    icon: 'link',
    category: 'networking',
    action: 'viewMutualConnections',
    permissions: ['authenticated'],
    analytics: 'mutual_connections_viewed',
    variant: 'secondary',
    tooltip: 'See mutual connections'
  },
  endorseSkill: {
    id: 'endorse-skill',
    label: '✓ Endorse Skill',
    icon: 'thumbsup',
    category: 'networking',
    action: 'endorseSkill',
    permissions: ['authenticated'],
    analytics: 'skill_endorsed',
    variant: 'secondary',
    tooltip: 'Endorse a skill'
  },
  hireFreelancer: {
    id: 'hire-freelancer',
    label: '💼 Hire',
    icon: 'hire',
    category: 'networking',
    action: 'sendHireRequest',
    permissions: ['authenticated', 'payment'],
    analytics: 'hire_request_sent',
    variant: 'primary',
    tooltip: 'Send hire request'
  },
  viewReviews: {
    id: 'view-reviews',
    label: '⭐ Reviews',
    icon: 'star',
    category: 'networking',
    action: 'viewUserReviews',
    permissions: ['public'],
    analytics: 'reviews_viewed',
    variant: 'tertiary',
    tooltip: 'View user reviews'
  },
  leaveReview: {
    id: 'leave-review',
    label: '⭐ Review',
    icon: 'star',
    category: 'networking',
    action: 'openReviewForm',
    permissions: ['authenticated'],
    analytics: 'review_form_opened',
    variant: 'secondary',
    tooltip: 'Leave a review'
  },
  createTeam: {
    id: 'create-team',
    label: '👥 Create Team',
    icon: 'team',
    category: 'networking',
    action: 'openTeamCreator',
    permissions: ['authenticated'],
    analytics: 'team_creation_opened',
    variant: 'primary',
    tooltip: 'Create a team'
  },
  inviteTeam: {
    id: 'invite-team',
    label: '👥 Invite to Team',
    icon: 'invite',
    category: 'networking',
    action: 'inviteToTeam',
    permissions: ['authenticated'],
    analytics: 'team_invite_sent',
    variant: 'secondary',
    tooltip: 'Invite to your team'
  },
  findPartner: {
    id: 'find-partner',
    label: '🤝 Find Partner',
    icon: 'handshake',
    category: 'networking',
    action: 'findPartner',
    permissions: ['authenticated'],
    analytics: 'partner_search_opened',
    variant: 'primary',
    tooltip: 'Find business partner'
  },
  findMentor: {
    id: 'find-mentor',
    label: '👨‍🏫 Find Mentor',
    icon: 'mentor',
    category: 'networking',
    action: 'findMentor',
    permissions: ['authenticated'],
    analytics: 'mentor_search_opened',
    variant: 'primary',
    tooltip: 'Find a mentor'
  },
  offerMentorship: {
    id: 'offer-mentorship',
    label: '👨‍🏫 Be a Mentor',
    icon: 'mentor',
    category: 'networking',
    action: 'offerMentorship',
    permissions: ['authenticated'],
    analytics: 'mentorship_offered',
    variant: 'primary',
    tooltip: 'Offer mentorship'
  },
  viewPortfolio: {
    id: 'view-portfolio',
    label: '🎨 Portfolio',
    icon: 'portfolio',
    category: 'networking',
    action: 'viewPortfolio',
    permissions: ['public'],
    analytics: 'portfolio_viewed',
    variant: 'secondary',
    tooltip: 'View portfolio'
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// TRANSACTION BUTTONS (100+ BUTTONS) - Continue in next section...
// ═══════════════════════════════════════════════════════════════════════════

export const B2B_BUTTONS = {
  // B2B Specific (30 buttons)
  viewCompanyProfile: {
    id: 'view-company',
    label: '🏢 Company Profile',
    icon: 'company',
    category: 'b2b',
    action: 'viewCompanyProfile',
    permissions: ['public'],
    analytics: 'company_profile_viewed',
    variant: 'secondary',
    tooltip: 'View company information'
  },
  companyDirectory: {
    id: 'company-directory',
    label: '📇 Company Directory',
    icon: 'directory',
    category: 'b2b',
    action: 'openCompanyDirectory',
    permissions: ['authenticated'],
    analytics: 'company_directory_opened',
    variant: 'secondary',
    tooltip: 'Browse company directory'
  },
  partnershipRequest: {
    id: 'partnership-request',
    label: '🤝 Partnership Inquiry',
    icon: 'handshake',
    category: 'b2b',
    action: 'sendPartnershipRequest',
    permissions: ['authenticated'],
    analytics: 'partnership_inquiry_sent',
    variant: 'primary',
    tooltip: 'Send partnership proposal'
  },
  vendorRequest: {
    id: 'vendor-request',
    label: '🏪 Vendor Inquiry',
    icon: 'vendor',
    category: 'b2b',
    action: 'sendVendorRequest',
    permissions: ['authenticated'],
    analytics: 'vendor_inquiry_sent',
    variant: 'primary',
    tooltip: 'Send vendor inquiry'
  },
  bulkRegistration: {
    id: 'bulk-registration',
    label: '📋 Team Registration',
    icon: 'bulk',
    category: 'b2b',
    action: 'openBulkRegistration',
    permissions: ['authenticated'],
    analytics: 'bulk_registration_opened',
    variant: 'primary',
    tooltip: 'Register your team'
  },
  corporateDiscount: {
    id: 'corporate-discount',
    label: '💰 Corporate Discount',
    icon: 'discount',
    category: 'b2b',
    action: 'applyCorporateDiscount',
    permissions: ['authenticated', 'payment'],
    analytics: 'corporate_discount_applied',
    variant: 'success',
    tooltip: 'Apply corporate discount code'
  },
  teamManagement: {
    id: 'team-management',
    label: '👥 Team Management',
    icon: 'team',
    category: 'b2b',
    action: 'openTeamManagement',
    permissions: ['authenticated', 'organizer'],
    analytics: 'team_management_opened',
    variant: 'secondary',
    tooltip: 'Manage team attendees'
  },
  leadsCapture: {
    id: 'leads-capture',
    label: '🎯 Capture Leads',
    icon: 'leads',
    category: 'b2b',
    action: 'openLeadCapture',
    permissions: ['authenticated'],
    analytics: 'lead_capture_opened',
    variant: 'secondary',
    tooltip: 'Capture attendee information'
  },
  dealTracker: {
    id: 'deal-tracker',
    label: '💼 Deal Tracker',
    icon: 'deal',
    category: 'b2b',
    action: 'openDealTracker',
    permissions: ['authenticated'],
    analytics: 'deal_tracker_opened',
    variant: 'secondary',
    tooltip: 'Track potential deals'
  },
  viewPipeline: {
    id: 'view-pipeline',
    label: '📊 Sales Pipeline',
    icon: 'pipeline',
    category: 'b2b',
    action: 'viewSalesPipeline',
    permissions: ['authenticated'],
    analytics: 'pipeline_viewed',
    variant: 'secondary',
    tooltip: 'View sales pipeline'
  },
  sendProposal: {
    id: 'send-proposal',
    label: '📄 Send Proposal',
    icon: 'document',
    category: 'b2b',
    action: 'sendProposal',
    permissions: ['authenticated'],
    analytics: 'proposal_sent',
    variant: 'primary',
    tooltip: 'Send business proposal'
  },
  generateQuote: {
    id: 'generate-quote',
    label: '💵 Generate Quote',
    icon: 'quote',
    category: 'b2b',
    action: 'generateQuote',
    permissions: ['authenticated'],
    analytics: 'quote_generated',
    variant: 'secondary',
    tooltip: 'Generate price quote'
  },
  viewCompetitors: {
    id: 'view-competitors',
    label: '🔍 Competitors',
    icon: 'search',
    category: 'b2b',
    action: 'viewCompetitors',
    permissions: ['authenticated'],
    analytics: 'competitors_viewed',
    variant: 'secondary',
    tooltip: 'View competitor companies'
  },
  industryFilter: {
    id: 'industry-filter',
    label: '🏭 By Industry',
    icon: 'filter',
    category: 'b2b',
    action: 'filterByIndustry',
    permissions: ['public'],
    analytics: 'industry_filtered',
    variant: 'secondary',
    tooltip: 'Filter by industry'
  },
  companySizeFilter: {
    id: 'size-filter',
    label: '📏 By Company Size',
    icon: 'filter',
    category: 'b2b',
    action: 'filterBySize',
    permissions: ['public'],
    analytics: 'size_filtered',
    variant: 'secondary',
    tooltip: 'Filter by company size'
  },
  viewInvoices: {
    id: 'view-invoices',
    label: '📊 Invoices',
    icon: 'invoice',
    category: 'b2b',
    action: 'viewInvoices',
    permissions: ['authenticated'],
    analytics: 'invoices_viewed',
    variant: 'secondary',
    tooltip: 'View invoices'
  },
  payInvoice: {
    id: 'pay-invoice',
    label: '💳 Pay Invoice',
    icon: 'payment',
    category: 'b2b',
    action: 'payInvoice',
    permissions: ['authenticated', 'payment'],
    analytics: 'invoice_paid',
    variant: 'success',
    tooltip: 'Pay invoice'
  },
  scheduleDemo: {
    id: 'schedule-demo',
    label: '📹 Schedule Demo',
    icon: 'video',
    category: 'b2b',
    action: 'scheduleDemo',
    permissions: ['authenticated'],
    analytics: 'demo_scheduled',
    variant: 'primary',
    tooltip: 'Schedule product demo'
  },
  requestPresentation: {
    id: 'request-presentation',
    label: '🎯 Presentation',
    icon: 'presentation',
    category: 'b2b',
    action: 'requestPresentation',
    permissions: ['authenticated'],
    analytics: 'presentation_requested',
    variant: 'primary',
    tooltip: 'Request presentation'
  },
  businessCard: {
    id: 'business-card',
    label: '🗂️ Business Card',
    icon: 'card',
    category: 'b2b',
    action: 'showBusinessCard',
    permissions: ['authenticated'],
    analytics: 'business_card_shown',
    variant: 'secondary',
    tooltip: 'Share business card'
  },
  viewCertifications: {
    id: 'view-certs',
    label: '🏆 Certifications',
    icon: 'certificate',
    category: 'b2b',
    action: 'viewCertifications',
    permissions: ['public'],
    analytics: 'certifications_viewed',
    variant: 'secondary',
    tooltip: 'View company certifications'
  },
  viewCredentials: {
    id: 'view-credentials',
    label: '🎓 Credentials',
    icon: 'credential',
    category: 'b2b',
    action: 'viewCredentials',
    permissions: ['public'],
    analytics: 'credentials_viewed',
    variant: 'secondary',
    tooltip: 'View credentials'
  },
  viewCaseStudies: {
    id: 'case-studies',
    label: '📚 Case Studies',
    icon: 'document',
    category: 'b2b',
    action: 'viewCaseStudies',
    permissions: ['public'],
    analytics: 'case_studies_viewed',
    variant: 'secondary',
    tooltip: 'View case studies'
  },
  downloadWhitepaper: {
    id: 'whitepaper',
    label: '📄 Whitepaper',
    icon: 'document',
    category: 'b2b',
    action: 'downloadWhitepaper',
    permissions: ['public'],
    analytics: 'whitepaper_downloaded',
    variant: 'secondary',
    tooltip: 'Download whitepaper'
  },
  requestCallBack: {
    id: 'callback-request',
    label: '📞 Request Call',
    icon: 'phone',
    category: 'b2b',
    action: 'requestCallback',
    permissions: ['authenticated'],
    analytics: 'callback_requested',
    variant: 'secondary',
    tooltip: 'Request callback'
  },
  contactSales: {
    id: 'contact-sales',
    label: '👨‍💼 Contact Sales',
    icon: 'user',
    category: 'b2b',
    action: 'contactSales',
    permissions: ['public'],
    analytics: 'sales_contacted',
    variant: 'primary',
    tooltip: 'Contact sales team'
  },
  requestDemo: {
    id: 'request-demo',
    label: '📹 Request Demo',
    icon: 'video',
    category: 'b2b',
    action: 'requestDemo',
    permissions: ['public'],
    analytics: 'demo_requested',
    variant: 'primary',
    tooltip: 'Request product demo'
  },
  viewPricing: {
    id: 'view-pricing',
    label: '💰 Pricing',
    icon: 'price',
    category: 'b2b',
    action: 'viewPricing',
    permissions: ['public'],
    analytics: 'pricing_viewed',
    variant: 'secondary',
    tooltip: 'View pricing options'
  },
  getEarlyBird: {
    id: 'early-bird',
    label: '🎶 Early Bird Discount',
    icon: 'discount',
    category: 'b2b',
    action: 'applyEarlyBird',
    permissions: ['authenticated', 'payment'],
    analytics: 'early_bird_applied',
    variant: 'success',
    tooltip: 'Apply early bird pricing'
  },
  setupIntegration: {
    id: 'setup-integration',
    label: '🔗 Setup Integration',
    icon: 'link',
    category: 'b2b',
    action: 'setupIntegration',
    permissions: ['authenticated', 'organizer'],
    analytics: 'integration_setup_started',
    variant: 'secondary',
    tooltip: 'Configure API integration'
  }
};

export const P2P_BUTTONS = {
  // P2P Specific (25 buttons)
  findBuddy: {
    id: 'find-buddy',
    label: '👋 Find Buddy',
    icon: 'users',
    category: 'p2p',
    action: 'findBuddy',
    permissions: ['authenticated'],
    analytics: 'buddy_search_opened',
    variant: 'primary',
    tooltip: 'Find someone to hang with'
  },
  skillExchange: {
    id: 'skill-exchange',
    label: '🔄 Skill Exchange',
    icon: 'exchange',
    category: 'p2p',
    action: 'openSkillExchange',
    permissions: ['authenticated'],
    analytics: 'skill_exchange_opened',
    variant: 'primary',
    tooltip: 'Exchange skills with others'
  },
  bookSession: {
    id: 'book-session',
    label: '📅 Book Session',
    icon: 'calendar',
    category: 'p2p',
    action: 'bookSession',
    permissions: ['authenticated', 'payment'],
    analytics: 'session_booked',
    variant: 'success',
    tooltip: 'Book a training session'
  },
  viewSchedule: {
    id: 'view-schedule',
    label: '📅 Schedule',
    icon: 'calendar',
    category: 'p2p',
    action: 'viewAvailability',
    permissions: ['public'],
    analytics: 'schedule_viewed',
    variant: 'secondary',
    tooltip: 'View availability'
  },
  leaveRecommendation: {
    id: 'leave-recommendation',
    label: '👍 Recommend',
    icon: 'thumbsup',
    category: 'p2p',
    action: 'leaveRecommendation',
    permissions: ['authenticated'],
    analytics: 'recommendation_left',
    variant: 'secondary',
    tooltip: 'Leave recommendation'
  },
  viewRatings: {
    id: 'view-ratings',
    label: '⭐ Ratings',
    icon: 'star',
    category: 'p2p',
    action: 'viewRatings',
    permissions: ['public'],
    analytics: 'ratings_viewed',
    variant: 'secondary',
    tooltip: 'View user ratings'
  },
  startGroup: {
    id: 'start-group',
    label: '👥 Start Group',
    icon: 'plus',
    category: 'p2p',
    action: 'startGroup',
    permissions: ['authenticated'],
    analytics: 'group_started',
    variant: 'primary',
    tooltip: 'Start a new group'
  },
  joinGroup: {
    id: 'join-group',
    label: '➕ Join Group',
    icon: 'plus',
    category: 'p2p',
    action: 'joinGroup',
    permissions: ['authenticated'],
    analytics: 'group_joined',
    variant: 'success',
    tooltip: 'Join a group'
  },
  leaveGroup: {
    id: 'leave-group',
    label: '✕ Leave Group',
    icon: 'close',
    category: 'p2p',
    action: 'leaveGroup',
    permissions: ['authenticated'],
    analytics: 'group_left',
    variant: 'danger',
    tooltip: 'Leave group'
  },
  viewGroupMembers: {
    id: 'group-members',
    label: '👥 Members',
    icon: 'users',
    category: 'p2p',
    action: 'viewGroupMembers',
    permissions: ['public'],
    analytics: 'group_members_viewed',
    variant: 'secondary',
    tooltip: 'View group members'
  },
  organizeActivity: {
    id: 'organize-activity',
    label: '🎪 Plan Activity',
    icon: 'plan',
    category: 'p2p',
    action: 'organizeActivity',
    permissions: ['authenticated'],
    analytics: 'activity_planned',
    variant: 'primary',
    tooltip: 'Plan group activity'
  },
  shareExpense: {
    id: 'share-expense',
    label: '💵 Split Expense',
    icon: 'money',
    category: 'p2p',
    action: 'splitExpense',
    permissions: ['authenticated', 'payment'],
    analytics: 'expense_split',
    variant: 'secondary',
    tooltip: 'Split costs with others'
  },
  createPoll: {
    id: 'create-poll',
    label: '📊 Poll',
    icon: 'vote',
    category: 'p2p',
    action: 'createPoll',
    permissions: ['authenticated'],
    analytics: 'poll_created',
    variant: 'secondary',
    tooltip: 'Create a poll'
  },
  votePoll: {
    id: 'vote-poll',
    label: '📊 Vote',
    icon: 'vote',
    category: 'p2p',
    action: 'votePoll',
    permissions: ['authenticated'],
    analytics: 'poll_voted',
    variant: 'secondary',
    tooltip: 'Cast your vote'
  },
  setGoal: {
    id: 'set-goal',
    label: '🎯 Set Goal',
    icon: 'target',
    category: 'p2p',
    action: 'setGoal',
    permissions: ['authenticated'],
    analytics: 'goal_set',
    variant: 'primary',
    tooltip: 'Set shared goal'
  },
  trackProgress: {
    id: 'track-progress',
    label: '📈 Progress',
    icon: 'chart',
    category: 'p2p',
    action: 'trackProgress',
    permissions: ['authenticated'],
    analytics: 'progress_tracked',
    variant: 'secondary',
    tooltip: 'Track progress'
  },
  shareAlbum: {
    id: 'share-album',
    label: '🖼️ Photo Album',
    icon: 'photo',
    category: 'p2p',
    action: 'shareAlbum',
    permissions: ['authenticated'],
    analytics: 'album_shared',
    variant: 'secondary',
    tooltip: 'Share photos'
  },
  createPlaylist: {
    id: 'create-playlist',
    label: '🎵 Playlist',
    icon: 'music',
    category: 'p2p',
    action: 'createPlaylist',
    permissions: ['authenticated'],
    analytics: 'playlist_created',
    variant: 'secondary',
    tooltip: 'Create shared playlist'
  },
  videoCall: {
    id: 'video-call',
    label: '📹 Video Call',
    icon: 'video',
    category: 'p2p',
    action: 'startVideoCall',
    permissions: ['authenticated', 'camera'],
    analytics: 'video_call_started',
    variant: 'secondary',
    tooltip: 'Start video call'
  },
  screenShare: {
    id: 'screen-share',
    label: '🖥️ Share Screen',
    icon: 'screen',
    category: 'p2p',
    action: 'shareScreen',
    permissions: ['authenticated', 'camera'],
    analytics: 'screen_shared',
    variant: 'secondary',
    tooltip: 'Share your screen'
  },
  viewProfile: {
    id: 'view-profile-p2p',
    label: '👤 Profile',
    icon: 'user',
    category: 'p2p',
    action: 'viewProfile',
    permissions: ['public'],
    analytics: 'p2p_profile_viewed',
    variant: 'secondary',
    tooltip: 'View user profile'
  },
  reportMember: {
    id: 'report-member',
    label: '🚩 Report',
    icon: 'flag',
    category: 'p2p',
    action: 'reportMember',
    permissions: ['authenticated'],
    analytics: 'member_reported',
    variant: 'danger',
    tooltip: 'Report member'
  },
  blockMember: {
    id: 'block-member',
    label: '🚫 Block',
    icon: 'block',
    category: 'p2p',
    action: 'blockMember',
    permissions: ['authenticated'],
    analytics: 'member_blocked',
    variant: 'danger',
    tooltip: 'Block member'
  },
  removeFromGroup: {
    id: 'remove-from-group',
    label: '✕ Remove',
    icon: 'close',
    category: 'p2p',
    action: 'removeFromGroup',
    permissions: ['authenticated', 'moderator'],
    analytics: 'member_removed',
    variant: 'danger',
    tooltip: 'Remove from group'
  },
  promoteToModerator: {
    id: 'promote-moderator',
    label: '👮 Promote',
    icon: 'promote',
    category: 'p2p',
    action: 'promoteToModerator',
    permissions: ['authenticated', 'organizer'],
    analytics: 'member_promoted',
    variant: 'secondary',
    tooltip: 'Make group moderator'
  }
};

export const B2P_BUTTONS = {
  // B2P Specific (20 buttons)
  employeeDirectory: {
    id: 'employee-directory',
    label: '📇 Employee Directory',
    icon: 'directory',
    category: 'b2p',
    action: 'openEmployeeDirectory',
    permissions: ['authenticated', 'employee'],
    analytics: 'employee_directory_opened',
    variant: 'secondary',
    tooltip: 'Browse company employees'
  },
  submitExpenseReport: {
    id: 'expense-report',
    label: '💰 Expense Report',
    icon: 'document',
    category: 'b2p',
    action: 'submitExpenseReport',
    permissions: ['authenticated', 'employee'],
    analytics: 'expense_report_submitted',
    variant: 'secondary',
    tooltip: 'Submit expense for reimbursement'
  },
  viewBenefits: {
    id: 'view-benefits',
    label: '📋 Benefits',
    icon: 'benefits',
    category: 'b2p',
    action: 'viewBenefits',
    permissions: ['authenticated', 'employee'],
    analytics: 'benefits_viewed',
    variant: 'secondary',
    tooltip: 'View employee benefits'
  },
  enrollBenefit: {
    id: 'enroll-benefit',
    label: '✓ Enroll',
    icon: 'check',
    category: 'b2p',
    action: 'enrollBenefit',
    permissions: ['authenticated', 'employee'],
    analytics: 'benefit_enrolled',
    variant: 'success',
    tooltip: 'Enroll in benefit'
  },
  viewTrainingCatalog: {
    id: 'training-catalog',
    label: '📚 Training',
    icon: 'book',
    category: 'b2p',
    action: 'viewTrainingCatalog',
    permissions: ['authenticated', 'employee'],
    analytics: 'training_viewed',
    variant: 'secondary',
    tooltip: 'View available trainings'
  },
  enrollTraining: {
    id: 'enroll-training',
    label: '📚 Enroll',
    icon: 'plus',
    category: 'b2p',
    action: 'enrollTraining',
    permissions: ['authenticated', 'employee'],
    analytics: 'training_enrolled',
    variant: 'success',
    tooltip: 'Enroll in training'
  },
  viewCareerPath: {
    id: 'career-path',
    label: '📈 Career Path',
    icon: 'chart',
    category: 'b2p',
    action: 'viewCareerPath',
    permissions: ['authenticated', 'employee'],
    analytics: 'career_path_viewed',
    variant: 'secondary',
    tooltip: 'View career progression'
  },
  requestPromotion: {
    id: 'request-promotion',
    label: '📈 Request Promotion',
    icon: 'arrow-up',
    category: 'b2p',
    action: 'requestPromotion',
    permissions: ['authenticated', 'employee'],
    analytics: 'promotion_requested',
    variant: 'primary',
    tooltip: 'Request promotion'
  },
  findMentor: {
    id: 'find-mentor-b2p',
    label: '👨‍🏫 Find Mentor',
    icon: 'mentor',
    category: 'b2p',
    action: 'findMentor',
    permissions: ['authenticated', 'employee'],
    analytics: 'mentor_found',
    variant: 'secondary',
    tooltip: 'Find internal mentor'
  },
  requestMentorship: {
    id: 'request-mentorship',
    label: '👨‍🏫 Request Mentorship',
    icon: 'mentor',
    category: 'b2p',
    action: 'requestMentorship',
    permissions: ['authenticated', 'employee'],
    analytics: 'mentorship_requested',
    variant: 'primary',
    tooltip: 'Request mentorship'
  },
  teamBuilding: {
    id: 'team-building',
    label: '🎪 Team Activities',
    icon: 'team',
    category: 'b2p',
    action: 'viewTeamActivities',
    permissions: ['authenticated', 'employee'],
    analytics: 'team_activities_viewed',
    variant: 'secondary',
    tooltip: 'View team building activities'
  },
  enrollTeamEvent: {
    id: 'enroll-team',
    label: '✓ Join',
    icon: 'check',
    category: 'b2p',
    action: 'enrollTeamEvent',
    permissions: ['authenticated', 'employee'],
    analytics: 'team_event_joined',
    variant: 'success',
    tooltip: 'Join team event'
  },
  viewPayStub: {
    id: 'pay-stub',
    label: '💰 Pay Stub',
    icon: 'money',
    category: 'b2p',
    action: 'viewPayStub',
    permissions: ['authenticated', 'employee'],
    analytics: 'pay_stub_viewed',
    variant: 'secondary',
    tooltip: 'View paycheck information'
  },
  requestTimeOff: {
    id: 'request-timeoff',
    label: '🏖️ Request Time Off',
    icon: 'calendar',
    category: 'b2p',
    action: 'requestTimeOff',
    permissions: ['authenticated', 'employee'],
    analytics: 'timeoff_requested',
    variant: 'secondary',
    tooltip: 'Request vacation/sick time'
  },
  viewEmployeeHandbook: {
    id: 'handbook',
    label: '📖 Handbook',
    icon: 'book',
    category: 'b2p',
    action: 'viewHandbook',
    permissions: ['authenticated', 'employee'],
    analytics: 'handbook_viewed',
    variant: 'secondary',
    tooltip: 'View employee handbook'
  },
  internshipProgram: {
    id: 'internship-program',
    label: '🎓 Internship',
    icon: 'graduate',
    category: 'b2p',
    action: 'viewInternshipProgram',
    permissions: ['public'],
    analytics: 'internship_program_viewed',
    variant: 'secondary',
    tooltip: 'View internship opportunities'
  },
  applyInternship: {
    id: 'apply-internship',
    label: '✓ Apply',
    icon: 'check',
    category: 'b2p',
    action: 'applyInternship',
    permissions: ['public'],
    analytics: 'internship_applied',
    variant: 'success',
    tooltip: 'Apply for internship'
  },
  graduateProgram: {
    id: 'graduate-program',
    label: '📗 Graduate Program',
    icon: 'graduate',
    category: 'b2p',
    action: 'viewGraduateProgram',
    permissions: ['public'],
    analytics: 'graduate_program_viewed',
    variant: 'secondary',
    tooltip: 'View graduate opportunities'
  },
  applyGraduate: {
    id: 'apply-graduate',
    label: '✓ Apply',
    icon: 'check',
    category: 'b2p',
    action: 'applyGraduate',
    permissions: ['public'],
    analytics: 'graduate_applied',
    variant: 'success',
    tooltip: 'Apply for graduate program'
  },
  shareholderMeeting: {
    id: 'shareholder-meeting',
    label: '📊 Shareholder Meeting',
    icon: 'meeting',
    category: 'b2p',
    action: 'viewShareholderMeeting',
    permissions: ['authenticated', 'shareholder'],
    analytics: 'shareholder_meeting_viewed',
    variant: 'secondary',
    tooltip: 'View shareholder meeting'
  },
  viewDividends: {
    id: 'view-dividends',
    label: '💰 Dividends',
    icon: 'money',
    category: 'b2p',
    action: 'viewDividends',
    permissions: ['authenticated', 'shareholder'],
    analytics: 'dividends_viewed',
    variant: 'secondary',
    tooltip: 'View dividend information'
  }
};

export const P2B_BUTTONS = {
  // P2B Specific (25 buttons)
  createServiceProfile: {
    id: 'create-service',
    label: '⭐ Create Profile',
    icon: 'plus',
    category: 'p2b',
    action: 'createServiceProfile',
    permissions: ['authenticated'],
    analytics: 'service_profile_created',
    variant: 'primary',
    tooltip: 'Create service provider profile'
  },
  uploadPortfolio: {
    id: 'upload-portfolio',
    label: '🎨 Upload Portfolio',
    icon: 'upload',
    category: 'p2b',
    action: 'uploadPortfolio',
    permissions: ['authenticated'],
    analytics: 'portfolio_uploaded',
    variant: 'secondary',
    tooltip: 'Upload work samples'
  },
  setRates: {
    id: 'set-rates',
    label: '💰 Set Rates',
    icon: 'dollar',
    category: 'p2b',
    action: 'setRates',
    permissions: ['authenticated'],
    analytics: 'rates_set',
    variant: 'secondary',
    tooltip: 'Set service rates'
  },
  createServicePackage: {
    id: 'create-package',
    label: '📦 Service Package',
    icon: 'package',
    category: 'p2b',
    action: 'createServicePackage',
    permissions: ['authenticated'],
    analytics: 'package_created',
    variant: 'primary',
    tooltip: 'Create service package'
  },
  viewInquiries: {
    id: 'view-inquiries',
    label: '💌 Inquiries',
    icon: 'message',
    category: 'p2b',
    action: 'viewInquiries',
    permissions: ['authenticated'],
    analytics: 'inquiries_viewed',
    variant: 'secondary',
    tooltip: 'View client inquiries'
  },
  respondInquiry: {
    id: 'respond-inquiry',
    label: '💭 Respond',
    icon: 'message',
    category: 'p2b',
    action: 'respondInquiry',
    permissions: ['authenticated'],
    analytics: 'inquiry_responded',
    variant: 'secondary',
    tooltip: 'Respond to inquiry'
  },
  sendProposal: {
    id: 'send-proposal-p2b',
    label: '📄 Send Proposal',
    icon: 'document',
    category: 'p2b',
    action: 'sendProposal',
    permissions: ['authenticated'],
    analytics: 'proposal_sent',
    variant: 'primary',
    tooltip: 'Send project proposal'
  },
  generateInvoice: {
    id: 'generate-invoice',
    label: '📋 Invoice',
    icon: 'document',
    category: 'p2b',
    action: 'generateInvoice',
    permissions: ['authenticated'],
    analytics: 'invoice_generated',
    variant: 'secondary',
    tooltip: 'Generate invoice'
  },
  trackProject: {
    id: 'track-project',
    label: '📊 Track Project',
    icon: 'chart',
    category: 'p2b',
    action: 'trackProject',
    permissions: ['authenticated'],
    analytics: 'project_tracked',
    variant: 'secondary',
    tooltip: 'Track project progress'
  },
  submitDeliverable: {
    id: 'submit-deliverable',
    label: '📬 Submit Work',
    icon: 'upload',
    category: 'p2b',
    action: 'submitDeliverable',
    permissions: ['authenticated'],
    analytics: 'work_submitted',
    variant: 'success',
    tooltip: 'Submit completed work'
  },
  requestPayment: {
    id: 'request-payment',
    label: '💳 Request Payment',
    icon: 'payment',
    category: 'p2b',
    action: 'requestPayment',
    permissions: ['authenticated'],
    analytics: 'payment_requested',
    variant: 'primary',
    tooltip: 'Request payment from client'
  },
  viewEarnings: {
    id: 'view-earnings',
    label: '💰 Earnings',
    icon: 'money',
    category: 'p2b',
    action: 'viewEarnings',
    permissions: ['authenticated'],
    analytics: 'earnings_viewed',
    variant: 'secondary',
    tooltip: 'View earnings and payouts'
  },
  withdrawEarnings: {
    id: 'withdraw-earnings',
    label: '💸 Withdraw',
    icon: 'bank',
    category: 'p2b',
    action: 'withdrawEarnings',
    permissions: ['authenticated', 'payment'],
    analytics: 'earnings_withdrawn',
    variant: 'success',
    tooltip: 'Withdraw your earnings'
  },
  addCertification: {
    id: 'add-certification',
    label: '🏆 Certification',
    icon: 'certificate',
    category: 'p2b',
    action: 'addCertification',
    permissions: ['authenticated'],
    analytics: 'certification_added',
    variant: 'secondary',
    tooltip: 'Add certification'
  },
  verifyCredential: {
    id: 'verify-credential',
    label: '✓ Verify',
    icon: 'check',
    category: 'p2b',
    action: 'verifyCredential',
    permissions: ['authenticated'],
    analytics: 'credential_verified',
    variant: 'success',
    tooltip: 'Get credentials verified'
  },
  showTestimonials: {
    id: 'testimonials',
    label: '⭐ Testimonials',
    icon: 'star',
    category: 'p2b',
    action: 'showTestimonials',
    permissions: ['public'],
    analytics: 'testimonials_viewed',
    variant: 'secondary',
    tooltip: 'View client testimonials'
  },
  requestTestimonial: {
    id: 'request-testimonial',
    label: '⭐ Request Review',
    icon: 'star',
    category: 'p2b',
    action: 'requestTestimonial',
    permissions: ['authenticated'],
    analytics: 'testimonial_requested',
    variant: 'secondary',
    tooltip: 'Request client feedback'
  },
  addCaseStudy: {
    id: 'add-case-study',
    label: '📚 Case Study',
    icon: 'document',
    category: 'p2b',
    action: 'addCaseStudy',
    permissions: ['authenticated'],
    analytics: 'case_study_added',
    variant: 'secondary',
    tooltip: 'Add case study'
  },
  offlineWork: {
    id: 'offline-work',
    label: '⚙️ Availability',
    icon: 'toggle',
    category: 'p2b',
    action: 'toggleAvailability',
    permissions: ['authenticated'],
    analytics: 'availability_toggled',
    variant: 'secondary',
    tooltip: 'Toggle availability status'
  },
  viewOrders: {
    id: 'view-orders',
    label: '📋 Orders',
    icon: 'list',
    category: 'p2b',
    action: 'viewOrders',
    permissions: ['authenticated'],
    analytics: 'orders_viewed',
    variant: 'secondary',
    tooltip: 'View active orders'
  },
  rateClient: {
    id: 'rate-client',
    label: '⭐ Rate Client',
    icon: 'star',
    category: 'p2b',
    action: 'rateClient',
    permissions: ['authenticated'],
    analytics: 'client_rated',
    variant: 'secondary',
    tooltip: 'Rate client experience'
  },
  reportClient: {
    id: 'report-client',
    label: '🚩 Report',
    icon: 'flag',
    category: 'p2b',
    action: 'reportClient',
    permissions: ['authenticated'],
    analytics: 'client_reported',
    variant: 'danger',
    tooltip: 'Report problematic client'
  },
  blockClient: {
    id: 'block-client',
    label: '🚫 Block',
    icon: 'block',
    category: 'p2b',
    action: 'blockClient',
    permissions: ['authenticated'],
    analytics: 'client_blocked',
    variant: 'danger',
    tooltip: 'Block client'
  },
  disputePayment: {
    id: 'dispute-payment',
    label: '⚖️ Dispute',
    icon: 'warning',
    category: 'p2b',
    action: 'disputePayment',
    permissions: ['authenticated'],
    analytics: 'payment_disputed',
    variant: 'warning',
    tooltip: 'Dispute payment'
  },
  contactSupport: {
    id: 'contact-support-p2b',
    label: '🆘 Support',
    icon: 'help',
    category: 'p2b',
    action: 'contactSupport',
    permissions: ['authenticated'],
    analytics: 'support_contacted',
    variant: 'secondary',
    tooltip: 'Contact support'
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// ADDITIONAL FEATURE BUTTONS (50+ MORE BUTTONS)
// ═══════════════════════════════════════════════════════════════════════════

export const ORGANIZER_BUTTONS = {
  // Organizer Dashboard (20 buttons)
  createEvent: {
    id: 'create-event',
    label: '➕ Create Event',
    icon: 'plus',
    category: 'organizer',
    action: 'openEventCreator',
    permissions: ['authenticated'],
    analytics: 'event_creation_opened',
    variant: 'primary',
    tooltip: 'Create a new event'
  },
  editEvent: {
    id: 'edit-event',
    label: '✏️ Edit',
    icon: 'edit',
    category: 'organizer',
    action: 'editEvent',
    permissions: ['authenticated', 'organizer'],
    analytics: 'event_edited',
    variant: 'secondary',
    tooltip: 'Edit event details'
  },
  publishEvent: {
    id: 'publish-event',
    label: '📤 Publish',
    icon: 'publish',
    category: 'organizer',
    action: 'publishEvent',
    permissions: ['authenticated', 'organizer'],
    analytics: 'event_published',
    variant: 'success',
    tooltip: 'Publish event'
  },
  cancelEvent: {
    id: 'cancel-event',
    label: '✕ Cancel',
    icon: 'close',
    category: 'organizer',
    action: 'cancelEvent',
    permissions: ['authenticated', 'organizer'],
    analytics: 'event_cancelled',
    variant: 'danger',
    tooltip: 'Cancel event'
  },
  postponeEvent: {
    id: 'postpone-event',
    label: '⏱️ Postpone',
    icon: 'clock',
    category: 'organizer',
    action: 'postponeEvent',
    permissions: ['authenticated', 'organizer'],
    analytics: 'event_postponed',
    variant: 'warning',
    tooltip: 'Postpone event'
  },
  manageAttendees: {
    id: 'manage-attendees',
    label: '👥 Attendees',
    icon: 'users',
    category: 'organizer',
    action: 'manageAttendees',
    permissions: ['authenticated', 'organizer'],
    analytics: 'attendees_managed',
    variant: 'secondary',
    tooltip: 'Manage attendee list'
  },
  checkInAttendees: {
    id: 'checkin-attendees',
    label: '✓ Check In',
    icon: 'checkin',
    category: 'organizer',
    action: 'checkInAttendees',
    permissions: ['authenticated', 'organizer'],
    analytics: 'attendees_checked_in',
    variant: 'secondary',
    tooltip: 'Check in attendees'
  },
  viewAnalytics: {
    id: 'view-analytics',
    label: '📊 Analytics',
    icon: 'chart',
    category: 'organizer',
    action: 'viewAnalytics',
    permissions: ['authenticated', 'organizer'],
    analytics: 'analytics_viewed',
    variant: 'secondary',
    tooltip: 'View event analytics'
  },
  sendAnnouncement: {
    id: 'send-announcement',
    label: '📢 Announcement',
    icon: 'megaphone',
    category: 'organizer',
    action: 'sendAnnouncement',
    permissions: ['authenticated', 'organizer'],
    analytics: 'announcement_sent',
    variant: 'secondary',
    tooltip: 'Send announcement'
  },
  emailAttendees: {
    id: 'email-attendees',
    label: '📧 Email',
    icon: 'email',
    category: 'organizer',
    action: 'emailAttendees',
    permissions: ['authenticated', 'organizer'],
    analytics: 'email_sent',
    variant: 'secondary',
    tooltip: 'Email attendees'
  },
  createTicket: {
    id: 'create-ticket',
    label: '🎫 Ticket',
    icon: 'ticket',
    category: 'organizer',
    action: 'createTicket',
    permissions: ['authenticated', 'organizer'],
    analytics: 'ticket_created',
    variant: 'secondary',
    tooltip: 'Create ticket tier'
  },
  setTicketPrice: {
    id: 'set-price',
    label: '💰 Pricing',
    icon: 'dollar',
    category: 'organizer',
    action: 'setTicketPrice',
    permissions: ['authenticated', 'organizer'],
    analytics: 'pricing_set',
    variant: 'secondary',
    tooltip: 'Set ticket pricing'
  },
  createDiscount: {
    id: 'create-discount',
    label: '🏷️ Discount',
    icon: 'tag',
    category: 'organizer',
    action: 'createDiscount',
    permissions: ['authenticated', 'organizer'],
    analytics: 'discount_created',
    variant: 'secondary',
    tooltip: 'Create discount code'
  },
  viewRevenue: {
    id: 'view-revenue',
    label: '💵 Revenue',
    icon: 'money',
    category: 'organizer',
    action: 'viewRevenue',
    permissions: ['authenticated', 'organizer'],
    analytics: 'revenue_viewed',
    variant: 'secondary',
    tooltip: 'View revenue'
  },
  downloadReport: {
    id: 'download-report',
    label: '📥 Download',
    icon: 'download',
    category: 'organizer',
    action: 'downloadReport',
    permissions: ['authenticated', 'organizer'],
    analytics: 'report_downloaded',
    variant: 'secondary',
    tooltip: 'Download event report'
  },
  inviteSpeaker: {
    id: 'invite-speaker',
    label: '👨‍🎤 Speaker',
    icon: 'user',
    category: 'organizer',
    action: 'inviteSpeaker',
    permissions: ['authenticated', 'organizer'],
    analytics: 'speaker_invited',
    variant: 'secondary',
    tooltip: 'Invite speaker'
  },
  manageSessions: {
    id: 'manage-sessions',
    label: '📅 Sessions',
    icon: 'calendar',
    category: 'organizer',
    action: 'manageSessions',
    permissions: ['authenticated', 'organizer'],
    analytics: 'sessions_managed',
    variant: 'secondary',
    tooltip: 'Manage event sessions'
  },
  setupSponsorship: {
    id: 'setup-sponsorship',
    label: '🤝 Sponsors',
    icon: 'handshake',
    category: 'organizer',
    action: 'setupSponsorship',
    permissions: ['authenticated', 'organizer'],
    analytics: 'sponsorship_setup',
    variant: 'secondary',
    tooltip: 'Setup sponsorship'
  },
  customizeLanding: {
    id: 'customize-landing',
    label: '🎨 Customize',
    icon: 'palette',
    category: 'organizer',
    action: 'customizeLanding',
    permissions: ['authenticated', 'organizer'],
    analytics: 'landing_customized',
    variant: 'secondary',
    tooltip: 'Customize event page'
  },
  duplicateEvent: {
    id: 'duplicate-event',
    label: '📋 Duplicate',
    icon: 'copy',
    category: 'organizer',
    action: 'duplicateEvent',
    permissions: ['authenticated', 'organizer'],
    analytics: 'event_duplicated',
    variant: 'secondary',
    tooltip: 'Duplicate this event'
  }
};

export const ADDITIONAL_BUTTONS = {
  // Miscellaneous (30+ buttons)
  settings: {
    id: 'settings',
    label: '⚙️ Settings',
    icon: 'settings',
    category: 'account',
    action: 'openSettings',
    permissions: ['authenticated'],
    analytics: 'settings_opened',
    variant: 'secondary',
    tooltip: 'Open settings'
  },
  notifications: {
    id: 'notifications',
    label: '🔔 Notifications',
    icon: 'bell',
    category: 'account',
    action: 'openNotifications',
    permissions: ['authenticated'],
    analytics: 'notifications_opened',
    variant: 'secondary',
    tooltip: 'View notifications'
  },
  help: {
    id: 'help',
    label: '❓ Help',
    icon: 'questionmark',
    category: 'account',
    action: 'openHelp',
    permissions: ['public'],
    analytics: 'help_opened',
    variant: 'secondary',
    tooltip: 'Get help'
  },
  about: {
    id: 'about',
    label: 'ℹ️ About',
    icon: 'info',
    category: 'account',
    action: 'openAbout',
    permissions: ['public'],
    analytics: 'about_opened',
    variant: 'secondary',
    tooltip: 'About the app'
  },
  privacyPolicy: {
    id: 'privacy',
    label: '🔒 Privacy',
    icon: 'lock',
    category: 'account',
    action: 'openPrivacy',
    permissions: ['public'],
    analytics: 'privacy_opened',
    variant: 'secondary',
    tooltip: 'View privacy policy'
  },
  termsOfService: {
    id: 'terms',
    label: '📜 Terms',
    icon: 'document',
    category: 'account',
    action: 'openTerms',
    permissions: ['public'],
    analytics: 'terms_opened',
    variant: 'secondary',
    tooltip: 'View terms of service'
  },
  feedback: {
    id: 'feedback',
    label: '💭 Feedback',
    icon: 'message',
    category: 'account',
    action: 'sendFeedback',
    permissions: ['authenticated'],
    analytics: 'feedback_sent',
    variant: 'secondary',
    tooltip: 'Send feedback'
  },
  reportBug: {
    id: 'report-bug',
    label: '🐛 Report Bug',
    icon: 'bug',
    category: 'account',
    action: 'reportBug',
    permissions: ['authenticated'],
    analytics: 'bug_reported',
    variant: 'secondary',
    tooltip: 'Report a bug'
  },
  contactUs: {
    id: 'contact-us',
    label: '📞 Contact Us',
    icon: 'phone',
    category: 'account',
    action: 'contactUs',
    permissions: ['public'],
    analytics: 'contact_us_opened',
    variant: 'secondary',
    tooltip: 'Contact support'
  },
  logout: {
    id: 'logout',
    label: '🚪 Logout',
    icon: 'logout',
    category: 'account',
    action: 'logout',
    permissions: ['authenticated'],
    analytics: 'logged_out',
    variant: 'danger',
    tooltip: 'Logout from account'
  },
  deleteAccount: {
    id: 'delete-account',
    label: '🗑️ Delete Account',
    icon: 'delete',
    category: 'account',
    action: 'deleteAccount',
    permissions: ['authenticated'],
    analytics: 'account_deleted',
    variant: 'danger',
    tooltip: 'Delete your account'
  },
  toggleDarkMode: {
    id: 'dark-mode',
    label: '🌙 Dark Mode',
    icon: 'moon',
    category: 'account',
    action: 'toggleDarkMode',
    permissions: ['public'],
    analytics: 'dark_mode_toggled',
    variant: 'secondary',
    tooltip: 'Toggle dark mode'
  },
  language: {
    id: 'language',
    label: '🌐 Language',
    icon: 'globe',
    category: 'account',
    action: 'selectLanguage',
    permissions: ['public'],
    analytics: 'language_selected',
    variant: 'secondary',
    tooltip: 'Select language'
  },
  accessibilitySettings: {
    id: 'accessibility',
    label: '♿ Accessibility',
    icon: 'accessibility',
    category: 'account',
    action: 'openAccessibility',
    permissions: ['public'],
    analytics: 'accessibility_opened',
    variant: 'secondary',
    tooltip: 'Accessibility options'
  },
  soundSettings: {
    id: 'sound',
    label: '🔊 Sound',
    icon: 'volume',
    category: 'account',
    action: 'toggleSound',
    permissions: ['public'],
    analytics: 'sound_toggled',
    variant: 'secondary',
    tooltip: 'Toggle sound'
  },
  pushNotifications: {
    id: 'push-notif',
    label: '📲 Push Notifications',
    icon: 'bell',
    category: 'account',
    action: 'togglePushNotifications',
    permissions: ['public'],
    analytics: 'push_toggled',
    variant: 'secondary',
    tooltip: 'Toggle push notifications'
  },
  emailNotifications: {
    id: 'email-notif',
    label: '📧 Email Notifications',
    icon: 'email',
    category: 'account',
    action: 'toggleEmailNotifications',
    permissions: ['public'],
    analytics: 'email_notif_toggled',
    variant: 'secondary',
    tooltip: 'Toggle email notifications'
  },
  exportData: {
    id: 'export-data',
    label: '📥 Export Data',
    icon: 'download',
    category: 'account',
    action: 'exportData',
    permissions: ['authenticated'],
    analytics: 'data_exported',
    variant: 'secondary',
    tooltip: 'Export your data'
  },
  importData: {
    id: 'import-data',
    label: '📤 Import Data',
    icon: 'upload',
    category: 'account',
    action: 'importData',
    permissions: ['authenticated'],
    analytics: 'data_imported',
    variant: 'secondary',
    tooltip: 'Import your data'
  },
  changePassword: {
    id: 'change-password',
    label: '🔐 Change Password',
    icon: 'lock',
    category: 'account',
    action: 'changePassword',
    permissions: ['authenticated'],
    analytics: 'password_changed',
    variant: 'secondary',
    tooltip: 'Change your password'
  },
  enableTwoFactor: {
    id: 'two-factor',
    label: '🔒 2FA',
    icon: 'shield',
    category: 'account',
    action: 'enableTwoFactor',
    permissions: ['authenticated'],
    analytics: 'two_factor_enabled',
    variant: 'secondary',
    tooltip: 'Enable two-factor authentication'
  },
  linkedAccounts: {
    id: 'linked-accounts',
    label: '🔗 Linked Accounts',
    icon: 'link',
    category: 'account',
    action: 'linkedAccounts',
    permissions: ['authenticated'],
    analytics: 'linked_accounts_viewed',
    variant: 'secondary',
    tooltip: 'Manage linked accounts'
  },
  subscriptions: {
    id: 'subscriptions',
    label: '💳 Subscriptions',
    icon: 'credit-card',
    category: 'account',
    action: 'manageSubscriptions',
    permissions: ['authenticated', 'payment'],
    analytics: 'subscriptions_managed',
    variant: 'secondary',
    tooltip: 'Manage subscriptions'
  },
  billingHistory: {
    id: 'billing-history',
    label: '📋 Billing History',
    icon: 'document',
    category: 'account',
    action: 'viewBillingHistory',
    permissions: ['authenticated'],
    analytics: 'billing_history_viewed',
    variant: 'secondary',
    tooltip: 'View billing history'
  },
  paymentMethods: {
    id: 'payment-methods',
    label: '💰 Payment Methods',
    icon: 'credit-card',
    category: 'account',
    action: 'managePaymentMethods',
    permissions: ['authenticated', 'payment'],
    analytics: 'payment_methods_managed',
    variant: 'secondary',
    tooltip: 'Manage payment methods'
  },
  referral: {
    id: 'referral',
    label: '👥 Referral Program',
    icon: 'share',
    category: 'account',
    action: 'openReferralProgram',
    permissions: ['authenticated'],
    analytics: 'referral_opened',
    variant: 'secondary',
    tooltip: 'Join referral program'
  },
  upgradePremium: {
    id: 'upgrade-premium',
    label: '👑 Upgrade Premium',
    icon: 'crown',
    category: 'account',
    action: 'upgradePremium',
    permissions: ['authenticated'],
    analytics: 'premium_upgrade_viewed',
    variant: 'primary',
    tooltip: 'Upgrade to premium'
  },
  viewPlans: {
    id: 'view-plans',
    label: '📊 View Plans',
    icon: 'list',
    category: 'account',
    action: 'viewPlans',
    permissions: ['public'],
    analytics: 'plans_viewed',
    variant: 'secondary',
    tooltip: 'View pricing plans'
  },
  chatWithTeam: {
    id: 'chat-support',
    label: '💬 Chat Support',
    icon: 'message',
    category: 'support',
    action: 'chatWithSupport',
    permissions: ['public'],
    analytics: 'support_chat_opened',
    variant: 'secondary',
    tooltip: 'Chat with support team'
  },
  faq: {
    id: 'faq',
    label: '❓ FAQ',
    icon: 'help',
    category: 'support',
    action: 'openFAQ',
    permissions: ['public'],
    analytics: 'faq_opened',
    variant: 'secondary',
    tooltip: 'View frequently asked questions'
  },
  documentation: {
    id: 'docs',
    label: '📚 Documentation',
    icon: 'book',
    category: 'support',
    action: 'openDocumentation',
    permissions: ['public'],
    analytics: 'docs_opened',
    variant: 'secondary',
    tooltip: 'View documentation'
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// BUTTON REGISTRY AGGREGATOR
// ═══════════════════════════════════════════════════════════════════════════

/** Aggregate all buttons into single registry */
export const ALL_BUTTONS = {
  ...DISCOVERY_BUTTONS,
  ...EVENT_ACTION_BUTTONS,
  ...SOCIAL_BUTTONS,
  ...B2B_BUTTONS,
  ...P2P_BUTTONS,
  ...B2P_BUTTONS,
  ...P2B_BUTTONS,
  ...ORGANIZER_BUTTONS,
  ...ADDITIONAL_BUTTONS
};

/**
 * Get button by ID
 * @param {string} buttonId - Button ID to retrieve
 * @returns {Object} Button definition or null
 */
export const getButton = (buttonId) => {
  return ALL_BUTTONS[buttonId] || null;
};

/**
 * Get buttons by category
 * @param {string} category - Category to filter by
 * @returns {Array} Array of button definitions
 */
export const getButtonsByCategory = (category) => {
  return Object.values(ALL_BUTTONS).filter(b => b.category === category);
};

/**
 * Get buttons by permission
 * @param {Array} userPermissions - User's permissions
 * @returns {Array} Array of accessible buttons
 */
export const getAccessibleButtons = (userPermissions = ['public']) => {
  return Object.values(ALL_BUTTONS).filter(button =>
    button.permissions.some(perm => userPermissions.includes(perm))
  );
};

/**
 * Count buttons by category
 * @returns {Object} Count of buttons per category
 */
export const getButtonCountByCategory = () => {
  const counts = {};
  Object.values(ALL_BUTTONS).forEach(button => {
    counts[button.category] = (counts[button.category] || 0) + 1;
  });
  return counts;
};

/**
 * Get total number of buttons
 * @returns {number} Total button count
 */
export const getTotalButtonCount = () => {
  return Object.keys(ALL_BUTTONS).length;
};

/**
 * Export button statistics
 */
export const BUTTON_STATS = {
  totalButtons: getTotalButtonCount(),
  discovery: getButtonsByCategory('discovery').length,
  eventAction: getButtonsByCategory('event-action').length,
  engagement: getButtonsByCategory('engagement').length,
  discussion: getButtonsByCategory('discussion').length,
  social: getButtonsByCategory('social').length,
  networking: getButtonsByCategory('networking').length,
  b2b: getButtonsByCategory('b2b').length,
  p2p: getButtonsByCategory('p2p').length,
  b2p: getButtonsByCategory('b2p').length,
  p2b: getButtonsByCategory('p2b').length,
  organizer: getButtonsByCategory('organizer').length,
  account: getButtonsByCategory('account').length,
  support: getButtonsByCategory('support').length
};

export default ALL_BUTTONS;
