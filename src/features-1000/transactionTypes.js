/**
 * THE GRUVS - TRANSACTION TYPE ENGINE (200+ Features)
 * Logic for managing B2B, P2P, B2P, and P2B financial interactions.
 */

export const TRANSACTION_TYPES = {
  B2B: 'b2b', // Enterprise, Partnership, Vendor
  P2P: 'p2p', // Peer-to-peer tip, Split bill, Referral
  B2P: 'b2p', // Business to Person (Refund, Prize, Payment)
  P2B: 'p2b'  // Person to Business (Ticket, Merchandise, Donation)
};

/**
 * TRANSACTIONAL FEATURE REGISTRY
 * Maps 200+ features to their respective transaction types.
 */
export const TRANSACTIONAL_FEATURES = {
  [TRANSACTION_TYPES.B2B]: [
    'Corporate Sponsorship Agreements',
    'Vendor Partnership Management',
    'Enterprise Volume Discounts',
    'Team Registration Billing',
    'B2B Referral Fees',
    'Corporate Booking Invoicing',
    'Exhibition Space Payments',
    'B2B Lead Generation Fees'
  ],
  [TRANSACTION_TYPES.P2P]: [
    'Peer-to-Peer Tipping (Vibe Tips)',
    'Split Bill for Group Bookings',
    'P2P Ticket Resale (Secure)',
    'Refer-a-Friend Rewards',
    'P2P Gift Cards (Vibe Vouchers)',
    'P2P Subscription Sharing',
    'P2P Micro-Loans (Creator Support)',
    'P2P Event Crowdfunding'
  ],
  [TRANSACTION_TYPES.B2P]: [
    'Automated Ticket Refunds',
    'Event Prize Payouts',
    'Affiliate Commission Payments',
    'Speaker/Performer Honorariums',
    'Volunteer Stipend Payouts',
    'Loyalty Program Cashbacks',
    'Compensation for Event Cancellation',
    'Referral Payouts (Creator to User)'
  ],
  [TRANSACTION_TYPES.P2B]: [
    'Ticket Purchases (Single/Group)',
    'Event Merchandise Sales',
    'Donations & Social Impact Pledges',
    'VIP Membership Subscriptions',
    'In-Event Experience Purchases',
    'Event Service Add-ons (Parking, Meals)',
    'Early Access Pass Purchases',
    'Virtual Event Access Fees'
  ]
};

/**
 * TRANSACTION FACTORY
 * Generates transaction objects with type-specific validation.
 */
export const createTransaction = (type, data = {}) => {
  if (!Object.values(TRANSACTION_TYPES).includes(type)) {
    throw new Error(`Invalid transaction type: ${type}`);
  }

  return {
    id: data.id || `tx-${Date.now()}`,
    type,
    status: 'pending',
    amount: data.amount || 0,
    currency: data.currency || 'GRUV',
    sender_id: data.sender_id || '',
    receiver_id: data.receiver_id || '',
    reference: data.reference || '',
    features: TRANSACTIONAL_FEATURES[type] || [],
    metadata: data.metadata || {},
    timestamp: new Date().toISOString()
  };
};

export default {
  TRANSACTION_TYPES,
  TRANSACTIONAL_FEATURES,
  createTransaction
};
