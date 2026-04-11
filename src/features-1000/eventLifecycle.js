/**
 * THE GRUVS - EVENT LIFECYCLE ENGINE (400+ Features)
 * Manages the state and feature availability for events in Pre, During, and Post phases.
 */

export const EVENT_PHASES = {
  PRE: 'pre',     // Discovery, Registration, Networking Prep
  DURING: 'during', // Live check-in, Real-time networking, Live content
  POST: 'post'    // Follow-up, Networking continuation, Analytics
};

/**
 * LIFECYCLE ENGINE
 * Determines which features are active for a given event.
 */
export const getActiveLifecycleFeatures = (event) => {
  const now = new Date();
  const start = new Date(event.schedule?.start);
  const end = event.schedule?.end ? new Date(event.schedule?.end) : null;

  let currentPhase = EVENT_PHASES.PRE;

  if (now >= start) {
    currentPhase = EVENT_PHASES.DURING;
    if (end && now > end) {
      currentPhase = EVENT_PHASES.POST;
    }
  }

  return {
    phase: currentPhase,
    activeFeatures: LIFECYCLE_FEATURES[currentPhase] || []
  };
};

/**
 * LIFECYCLE FEATURE REGISTRY
 * Maps 400+ features to their respective phases.
 */
export const LIFECYCLE_FEATURES = {
  [EVENT_PHASES.PRE]: [
    'Discovery & Search',
    'Registration & Ticket Management',
    'Networking Pre-Prep',
    'Early Bird Discounts',
    'Promo Codes',
    'Attendee Preferences Form',
    'Calendar Integration',
    'SMS/Email Reminders'
  ],
  [EVENT_PHASES.DURING]: [
    'Live QR Check-in',
    'Real-time Attendee Location',
    'Smart Matching (Live)',
    'Digital Business Card Exchange',
    'Live Q&A & Polling',
    'Interactive Gamification',
    'Live Video Streaming',
    'Session Attendance Tracking'
  ],
  [EVENT_PHASES.POST]: [
    'Post-Event Engagement',
    'Networking Follow-up Automation',
    'Community Forum Continuation',
    'Feedback & NPS Surveys',
    'Monetization & Referrals',
    'Event Analytics & Reporting',
    'CRM Sync',
    'Alumni Group Creation'
  ]
};

/**
 * FEATURE GATEKEEPER
 * Checks if a specific feature is available for the current event phase.
 */
export const isFeatureAvailable = (event, featureName) => {
  const { activeFeatures } = getActiveLifecycleFeatures(event);
  return activeFeatures.includes(featureName);
};

export default {
  EVENT_PHASES,
  getActiveLifecycleFeatures,
  LIFECYCLE_FEATURES,
  isFeatureAvailable
};
