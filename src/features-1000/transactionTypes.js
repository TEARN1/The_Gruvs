/**
 * TRANSACTION TYPE FEATURES (200+ Features)
 * Complete support for B2B, P2P, B2P, P2B interactions
 *
 * B2B (Business to Business): 50 features
 * P2P (Person to Person): 50 features
 * B2P (Business to Person): 50 features
 * P2B (Person to Business): 50 features
 */

// ═══════════════════════════════════════════════════════════════════════════
// B2B (BUSINESS TO BUSINESS) - 50 FEATURES
// ═══════════════════════════════════════════════════════════════════════════

export const B2B_FEATURES = {
  name: 'B2B (Business to Business)',
  count: 50,
  icon: '🏢',
  color: '#3b82f6',

  profiles: {
    name: 'Company Profiles & Discovery',
    count: 12,
    features: [
      'Company profile page creation',
      'Company directory browsing',
      'Company verification system',
      'Industry classification',
      'Company size selection',
      'Employee count tracking',
      'Annual revenue display',
      'Company logo and branding',
      'Company description',
      'Company website integration',
      'Social media links',
      'Office location display'
    ]
  },

  matching: {
    name: 'B2B Matching & Networking',
    count: 10,
    features: [
      'B2B-specific matching algorithm',
      'Partnership opportunity finder',
      'Vendor discovery platform',
      'Supplier matching',
      'Customer prospect identification',
      'Match quality scoring',
      'Similar company discovery',
      'Competitor identification',
      'Decision maker identification',
      'Budget holder identification'
    ]
  },

  sales: {
    name: 'Sales & Business Operations',
    count: 15,
    features: [
      'Lead capture system',
      'Lead scoring algorithm',
      'Lead segmentation',
      'Sales pipeline management',
      'Deal tracking system',
      'Deal value estimation',
      'Sales cycle tracking',
      'Territory management',
      'Quota tracking',
      'Account expansion opportunities',
      'Upsell identification',
      'Cross-sell opportunities',
      'CRM sync capability',
      'Contact form integration',
      'Inquiry management system'
    ]
  },

  commerce: {
    name: 'B2B Commerce',
    count: 13,
    features: [
      'Proposal generation system',
      'Quote generation tool',
      'Invoice creation',
      'Payment processing',
      'Net-30/60/90 payment terms',
      'Invoice tracking',
      'Payment reminders',
      'Bulk registration discounts',
      'Corporate packages',
      'Volume-based pricing',
      'Contract templates',
      'SLA management',
      'Service agreements'
    ]
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// P2P (PERSON TO PERSON) - 50 FEATURES
// ═══════════════════════════════════════════════════════════════════════════

export const P2P_FEATURES = {
  name: 'P2P (Person to Person)',
  count: 50,
  icon: '👥',
  color: '#f59e0b',

  profiles: {
    name: 'Individual Profiles & Branding',
    count: 12,
    features: [
      'Personal profile optimization',
      'Personal brand building',
      'Portfolio showcase',
      'Skills endorsement system',
      'Recommendation system',
      'Peer-to-peer learning',
      'Skill exchange marketplace',
      'Mentorship marketplace',
      'Coaching booking system',
      'Availability calendar',
      'Time zone handling',
      'Virtual meetup creation'
    ]
  },

  groups: {
    name: 'Groups & Collaboration',
    count: 12,
    features: [
      'Find buddy system',
      'Group creation',
      'Member invitation',
      'Leave group option',
      'Member management',
      'Group member list',
      'Group roles assignment',
      'Co-host features',
      'Task assignment',
      'Notification settings',
      'Privacy controls',
      'Group dissolution'
    ]
  },

  sharing: {
    name: 'Content & Resource Sharing',
    count: 12,
    features: [
      'Photo album sharing',
      'Video sharing',
      'Playlist creation',
      'Document sharing',
      'Resource library',
      'Link sharing',
      'Calendar sharing',
      'Event planning collaboration',
      'Note sharing',
      'File storage',
      'Version control',
      'Expiring links'
    ]
  },

  engagement: {
    name: 'Personal Engagement & Interaction',
    count: 14,
    features: [
      'One-on-one messaging',
      'Group chat',
      'Video calls',
      'Screen sharing',
      'Voice messaging',
      'Message encryption',
      'Message reactions',
      'Typing indicators',
      'Read receipts',
      'Message search',
      'Archive conversations',
      'Pin important messages',
      'Reputation ratings',
      'Review system'
    ]
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// B2P (BUSINESS TO PERSON) - 50 FEATURES
// ═══════════════════════════════════════════════════════════════════════════

export const B2P_FEATURES = {
  name: 'B2P (Business to Person/Employees)',
  count: 50,
  icon: '💼',
  color: '#10b981',

  employee: {
    name: 'Employee Management & Benefits',
    count: 15,
    features: [
      'Employee directory access',
      'Company discount codes',
      'Bulk team registration',
      'Manager approval workflows',
      'Employee expense tracking',
      'Reimbursement management',
      'Team coordination',
      'Team building events',
      'Executive education programs',
      'Professional development tracking',
      'Skill development paths',
      'Career progression tracking',
      'Internal talent marketplace',
      'Internal mentorship programs',
      'Internal job board'
    ]
  },

  training: {
    name: 'Training & Development',
    count: 12,
    features: [
      'Training catalog access',
      'Course enrollment system',
      'Learning objectives tracking',
      'Training hours tracking',
      'Certification tracking',
      'Competency frameworks',
      'Skills assessment',
      'Progress tracking',
      'Completion certificates',
      'Learning paths',
      'Continuing education credits',
      'Course recommendations'
    ]
  },

  culture: {
    name: 'Company Culture & Events',
    count: 13,
    features: [
      'Cross-team networking events',
      'Department-specific events',
      'Company culture activities',
      'Onboarding events',
      'Annual conference planning',
      'Town hall meetings',
      'Department offsites',
      'Employee recognition programs',
      'Achievement badges',
      'Internal leaderboards',
      'Team challenges',
      'Department competitions',
      'Social events'
    ]
  },

  management: {
    name: 'Management & Administration',
    count: 10,
    features: [
      'HR analytics dashboards',
      'Engagement analytics',
      'Diversity metrics tracking',
      'Inclusion metrics',
      'Participation incentives',
      'Employee recognition system',
      'Performance tracking',
      'Event attendance tracking',
      'Budget allocation',
      'Event compliance tracking'
    ]
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// P2B (PERSON TO BUSINESS/VENDORS) - 50 FEATURES
// ═══════════════════════════════════════════════════════════════════════════

export const P2B_FEATURES = {
  name: 'P2B (Person to Business/Vendors)',
  count: 50,
  icon: '🆙',
  color: '#a855f7',

  vendor: {
    name: 'Vendor Profile & Services',
    count: 15,
    features: [
      'Service provider profile creation',
      'Service provider directory listing',
      'Portfolio management',
      'Work samples showcase',
      'Certification display',
      'Credentials verification',
      'Insurance display',
      'License verification',
      'Rate card creation',
      'Service package creation',
      'Pricing transparency',
      'Booking system',
      'Availability calendar',
      'Calendar integration',
      'Time zone handling'
    ]
  },

  business: {
    name: 'Business Operations',
    count: 15,
    features: [
      'Quote generation',
      'Invoice generation',
      'Payment processing',
      'Tax ID verification',
      'Contract templates',
      'Statement of work',
      'Service level agreements',
      'Proposal submission',
      'RFP response platform',
      'Bid management',
      'Contract management',
      'Milestone tracking',
      'Deliverable tracking',
      'Project management',
      'Time tracking'
    ]
  },

  reputation: {
    name: 'Reputation & Trust Building',
    count: 12,
    features: [
      'Rating system',
      'Review collection',
      'Testimonial management',
      'Video testimonials',
      'Before/after galleries',
      'Case study creation',
      'Work portfolio display',
      'Client roster display',
      'Background check option',
      'Verification badges',
      'Expert directory listing',
      'Featured provider promotion'
    ]
  },

  client: {
    name: 'Client Relationship Management',
    count: 8,
    features: [
      'Repeat client management',
      'Client communication',
      'Feedback collection',
      'Client relationship tracking',
      'Referral tracking',
      'Client history',
      'Dispute resolution',
      'Support ticket system'
    ]
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// TRANSACTION TYPE STATISTICS
// ═══════════════════════════════════════════════════════════════════════════

export const TRANSACTION_TYPE_STATS = {
  totalFeatures: 200,
  b2bFeatures: B2B_FEATURES.count,
  p2pFeatures: P2P_FEATURES.count,
  b2pFeatures: B2P_FEATURES.count,
  p2bFeatures: P2B_FEATURES.count,

  breakdown: {
    b2b: {
      profiles: B2B_FEATURES.profiles.count,
      matching: B2B_FEATURES.matching.count,
      sales: B2B_FEATURES.sales.count,
      commerce: B2B_FEATURES.commerce.count
    },
    p2p: {
      profiles: P2P_FEATURES.profiles.count,
      groups: P2P_FEATURES.groups.count,
      sharing: P2P_FEATURES.sharing.count,
      engagement: P2P_FEATURES.engagement.count
    },
    b2p: {
      employee: B2P_FEATURES.employee.count,
      training: B2P_FEATURES.training.count,
      culture: B2P_FEATURES.culture.count,
      management: B2P_FEATURES.management.count
    },
    p2b: {
      vendor: P2B_FEATURES.vendor.count,
      business: P2B_FEATURES.business.count,
      reputation: P2B_FEATURES.reputation.count,
      client: P2B_FEATURES.client.count
    }
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get all transaction type features
 */
export const getAllTransactionFeatures = () => {
  return {
    b2b: B2B_FEATURES,
    p2p: P2P_FEATURES,
    b2p: B2P_FEATURES,
    p2b: P2B_FEATURES
  };
};

/**
 * Get features by transaction type
 */
export const getFeaturesByTransactionType = (type) => {
  const types = {
    b2b: B2B_FEATURES,
    p2p: P2P_FEATURES,
    b2p: B2P_FEATURES,
    p2b: P2B_FEATURES
  };
  return types[type.toLowerCase()] || null;
};

/**
 * Get specific category within transaction type
 */
export const getTransactionCategory = (type, category) => {
  const features = getFeaturesByTransactionType(type);
  return features ? features[category] : null;
};

/**
 * Search transaction features
 */
export const searchTransactionFeatures = (query) => {
  const results = [];
  const allTypes = getAllTransactionFeatures();

  Object.entries(allTypes).forEach(([type, typeFeatures]) => {
    Object.entries(typeFeatures).forEach(([category, categoryData]) => {
      if (typeof categoryData === 'object' && categoryData.features) {
        categoryData.features.forEach(feature => {
          if (feature.toLowerCase().includes(query.toLowerCase())) {
            results.push({ type, category, feature });
          }
        });
      }
    });
  });

  return results;
};

/**
 * Get transaction type by name
 */
export const getTransactionTypeByName = (name) => {
  const mapping = {
    'business to business': 'b2b',
    'person to person': 'p2p',
    'business to person': 'b2p',
    'person to business': 'p2b'
  };
  return mapping[name.toLowerCase()] || null;
};

export default {
  B2B_FEATURES,
  P2P_FEATURES,
  B2P_FEATURES,
  P2B_FEATURES,
  TRANSACTION_TYPE_STATS,
  getAllTransactionFeatures,
  getFeaturesByTransactionType,
  getTransactionCategory,
  searchTransactionFeatures,
  getTransactionTypeByName
};
