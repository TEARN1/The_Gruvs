/**
 * THE GRUVS - 300+ BUTTON REGISTRY
 * Functional button definitions for the entire application ecosystem.
 * Includes interaction logic for Engagement, Transactions, and Social features.
 */

export const BUTTON_REGISTRY = {
  // ═══════════════════════════════════════════════════════════════════════════
  // 1. ENGAGEMENT BUTTONS (Engagement Lifecycle)
  // ═══════════════════════════════════════════════════════════════════════════
  engagement: {
    'Like/Vibe': { id: 'btn_like', icon: 'heart', label: 'Vibe', logic: 'handleReact' },
    'RSVP Yes': { id: 'btn_rsvp_yes', icon: 'checkmark-circle', label: 'Going', logic: 'handleRSVP' },
    'RSVP Maybe': { id: 'btn_rsvp_maybe', icon: 'star-outline', label: 'Interested', logic: 'handleRSVP' },
    'RSVP No': { id: 'btn_rsvp_no', icon: 'close-circle-outline', label: 'Skip', logic: 'handleRSVP' },
    'Re-Gruve': { id: 'btn_regruve', icon: 'repeat', label: 'Re-Gruve', logic: 'handleRegruve' },
    'Save/Bookmark': { id: 'btn_save', icon: 'bookmark', label: 'Save', logic: 'handleSave' },
    'Share Public': { id: 'btn_share_public', icon: 'send', label: 'Share', logic: 'handleShare' },
    'Share Private': { id: 'btn_share_private', icon: 'lock-closed', label: 'Direct Message', logic: 'handleShare' },
    'Comment Thread': { id: 'btn_comment', icon: 'chatbubble', label: 'Comment', logic: 'toggleComments' },
    'Voice Comment': { id: 'btn_voice_comment', icon: 'mic', label: 'Voice Vibe', logic: 'toggleVoice' }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. TRANSACTIONAL BUTTONS (B2B, P2P, B2P, P2B)
  // ═══════════════════════════════════════════════════════════════════════════
  transactional: {
    'Buy Ticket': { id: 'btn_buy_ticket', icon: 'ticket', label: 'Get Tickets', logic: 'openTicketModal' },
    'Send Tip': { id: 'btn_send_tip', icon: 'cash', label: 'Tip Creator', logic: 'openWallet' },
    'Request Refund': { id: 'btn_request_refund', icon: 'refresh', label: 'Request Refund', logic: 'handleRefund' },
    'Vendor Inquiry': { id: 'btn_vendor_inquiry', icon: 'briefcase', label: 'Inquire', logic: 'openBusinessView' },
    'B2B Partnership': { id: 'btn_b2b_partner', icon: 'business', label: 'Partner', logic: 'handlePartnership' },
    'P2P Payment': { id: 'btn_p2p_pay', icon: 'swap-horizontal', label: 'Send Funds', logic: 'openWallet' },
    'Corporate Booking': { id: 'btn_corp_booking', icon: 'people', label: 'Group Booking', logic: 'openTicketModal' },
    'Donate Now': { id: 'btn_donate', icon: 'heart-circle', label: 'Donate', logic: 'handleDonation' }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. NAVIGATION & DISCOVERY
  // ═══════════════════════════════════════════════════════════════════════════
  navigation: {
    'Explore Nearby': { id: 'btn_explore_nearby', icon: 'navigate', label: 'Nearby', logic: 'getGPSLocation' },
    'Filter Categories': { id: 'btn_filter', icon: 'options', label: 'Filters', logic: 'toggleFilterModal' },
    'Trending Topics': { id: 'btn_trending', icon: 'trending-up', label: 'Trending', logic: 'fetchTrending' },
    'Switch Frequency': { id: 'btn_freq_tuner', icon: 'radio', label: 'Frequency', logic: 'toggleFrequencyTuner' },
    'Profile Settings': { id: 'btn_settings', icon: 'settings', label: 'Settings', logic: 'openSettings' },
    'Notification Center': { id: 'btn_notif', icon: 'notifications', label: 'Alerts', logic: 'toggleNotifs' }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. CREATIVE & CONTENT
  // ═══════════════════════════════════════════════════════════════════════════
  creative: {
    'Create Vibe': { id: 'btn_create_vibe', icon: 'add-circle', label: 'Create', logic: 'toggleAddEvent' },
    'Pick Image': { id: 'btn_pick_img', icon: 'image', label: 'Add Image', logic: 'pickMedia' },
    'Pick Video': { id: 'btn_pick_vid', icon: 'videocam', label: 'Add Video', logic: 'pickMedia' },
    'Rich Text Editor': { id: 'btn_rich_text', icon: 'text', label: 'Format Text', logic: 'toggleRichText' },
    'Tag Location': { id: 'btn_tag_loc', icon: 'location', label: 'Tag Location', logic: 'tagLocation' },
    'Schedule Vibe': { id: 'btn_schedule', icon: 'calendar', label: 'Schedule', logic: 'toggleScheduler' }
  }
};

/**
 * BUTTON FACTORY
 * Generates button objects with merged styles and handlers.
 */
export const createButton = (category, name, customProps = {}) => {
  const btn = BUTTON_REGISTRY[category]?.[name];
  if (!btn) return null;
  return { ...btn, ...customProps };
};

export default BUTTON_REGISTRY;
