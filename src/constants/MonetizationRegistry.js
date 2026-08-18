/**
 * MONETIZATION REGISTRY — single source of truth for all 255 revenue ways
 * (see REVENUE_PLAYBOOK.md). This "executes" the plan in code WITHOUT turning
 * anything on: every way is `enabled: false` behind a master kill-switch, so the
 * app behaves exactly as today until you (1) connect a payment rail and (2) flip
 * the flag for a specific way.
 *
 * WHY a registry instead of 255 commented-out code stubs:
 *   - 255 dead commented blocks = rot + violates the project's no-dead-code rule.
 *   - This is live, lintable config the monetization layer reads at runtime. Off
 *     by default, individually switchable, auditable in one place.
 *
 * RAILS (none are connected yet — keep MONETIZATION_LIVE = false):
 *   admob          — Google AdMob (programmatic ads). Google handles money.
 *   iap            — Apple/Google In-App Purchase (subs, boosts, digital goods).
 *                    NOTE: iOS/Android REQUIRE this for in-app digital goods.
 *                    PayPal is NOT valid here.
 *   affiliate      — partner pays you commission (Quicket, Bolt, Printful…).
 *   brand_invoice  — business/brand pays you directly off-platform (EFT/PayPal).
 *   payout_provider— you pay money OUT (users/creators). Needs a PSP + KYC. 💳
 *   voucher_xp     — non-cash reward (airtime/voucher/XP). Solo-safe.
 *   none           — pure feature, no money movement.
 *
 * `psp: true`  → needs a full payment processor + compliance → SCALE-STAGE, not now.
 * `userEarn: true` → a way USERS make money.
 */

// ── MASTER SWITCH ────────────────────────────────────────────────────────────
// Keep false until a payment rail is connected. While false, isWayEnabled()
// returns false for EVERYTHING regardless of per-way flags — nothing monetizes.
export const MONETIZATION_LIVE = false;

// Which rails are wired. Flip a rail to true only after it's actually connected.
export const RAILS_CONNECTED = {
  admob: false,
  iap: false,            // RevenueCat / react-native-purchases
  affiliate: false,
  // your invoicing (PayPal/EFT) for businesses & brands. Live as of the
  // business_invoice_requests table + BusinessDashboardScreen's "Request
  // Royal/Enterprise Invoice" action — manual fulfillment, no PSP.
  brand_invoice: true,
  payout_provider: false,
  voucher_xp: false,
};

export const MONETIZATION_CATEGORIES = {
  A: 'Native feed advertising',
  B: 'Reels & video advertising',
  C: 'Sponsorship & brand activations',
  D: 'Consumer subscriptions & premium',
  E: 'Business / B2B subscriptions & tools',
  F: 'Boosts, promotions & consumables',
  G: 'Commerce, affiliate & marketplace',
  H: 'Ways USERS make money',
  I: 'Data, intelligence & API',
  J: 'Licensing, expansion & offline',
  K: 'Gamification & engagement-funded',
};

// id matches REVENUE_PLAYBOOK.md numbering. enabled:false on every entry.
export const MONETIZATION_WAYS = [
  // ── A. Native feed advertising ──────────────────────────────────────────────
  { id: 1,  cat: 'A', name: 'Native event ad in feed', rail: 'admob', enabled: false },
  { id: 2,  cat: 'A', name: 'Sponsored category row', rail: 'brand_invoice', enabled: false },
  { id: 3,  cat: 'A', name: 'Promoted search result', rail: 'iap', enabled: false },
  { id: 4,  cat: 'A', name: 'Sponsored "Rising Now" rail', rail: 'brand_invoice', enabled: false },
  { id: 5,  cat: 'A', name: 'Sponsored HOT badge slot', rail: 'brand_invoice', enabled: false },
  { id: 6,  cat: 'A', name: 'Sponsored Birthdays strip', rail: 'brand_invoice', enabled: false },
  { id: 7,  cat: 'A', name: 'Sponsored For-You rec', rail: 'brand_invoice', enabled: false },
  { id: 8,  cat: 'A', name: 'Promoted host', rail: 'iap', enabled: false },
  { id: 9,  cat: 'A', name: 'Sponsored empty-state', rail: 'brand_invoice', enabled: false },
  { id: 10, cat: 'A', name: 'Sponsored weekend digest', rail: 'brand_invoice', enabled: false },
  { id: 11, cat: 'A', name: 'Sponsored map pin', rail: 'brand_invoice', enabled: false },
  { id: 12, cat: 'A', name: 'Map-area takeover', rail: 'brand_invoice', enabled: false },
  { id: 13, cat: 'A', name: 'Sponsored route/journey card', rail: 'brand_invoice', enabled: false },
  { id: 14, cat: 'A', name: 'Sponsored safe-ride-home', rail: 'brand_invoice', enabled: false },
  { id: 15, cat: 'A', name: 'Weather-triggered ad', rail: 'brand_invoice', enabled: false },
  { id: 16, cat: 'A', name: 'Load-shedding-triggered ad', rail: 'brand_invoice', enabled: false },
  { id: 17, cat: 'A', name: 'Sponsored Crowd Meter', rail: 'brand_invoice', enabled: false },
  { id: 18, cat: 'A', name: 'Sponsored trending tag', rail: 'brand_invoice', enabled: false },
  { id: 19, cat: 'A', name: 'Sponsored planner slot', rail: 'brand_invoice', enabled: false },
  { id: 20, cat: 'A', name: 'Programmatic AdMob fill', rail: 'admob', enabled: false },

  // ── B. Reels & video advertising ────────────────────────────────────────────
  { id: 21, cat: 'B', name: 'In-stream reel ad', rail: 'admob', enabled: false },
  { id: 22, cat: 'B', name: 'Sponsored reel', rail: 'brand_invoice', enabled: false },
  { id: 23, cat: 'B', name: 'Boost a creator reel', rail: 'brand_invoice', enabled: false },
  { id: 24, cat: 'B', name: 'Sponsored after-movie', rail: 'brand_invoice', enabled: false },
  { id: 25, cat: 'B', name: 'Sponsored reel audio', rail: 'brand_invoice', enabled: false },
  { id: 26, cat: 'B', name: 'Branded reel filter pack', rail: 'brand_invoice', enabled: false },
  { id: 27, cat: 'B', name: 'Reel-of-the-night award', rail: 'brand_invoice', enabled: false },
  { id: 28, cat: 'B', name: 'Pre-roll on highlight reels', rail: 'admob', enabled: false },
  { id: 29, cat: 'B', name: 'Sponsored reel challenge', rail: 'brand_invoice', enabled: false },
  { id: 30, cat: 'B', name: 'Shoppable reel tags', rail: 'affiliate', enabled: false },
  { id: 31, cat: 'B', name: 'Sponsored reel cover frame', rail: 'brand_invoice', enabled: false },
  { id: 32, cat: 'B', name: 'Brand reel template', rail: 'brand_invoice', enabled: false },
  { id: 33, cat: 'B', name: 'Sponsored trending sounds', rail: 'brand_invoice', enabled: false },
  { id: 34, cat: 'B', name: 'Sponsored creator spotlight', rail: 'brand_invoice', enabled: false },
  { id: 35, cat: 'B', name: 'Sponsored AR effect', rail: 'brand_invoice', enabled: false },

  // ── C. Sponsorship & brand activations ──────────────────────────────────────
  { id: 36, cat: 'C', name: 'Tournament/festival title sponsor', rail: 'brand_invoice', enabled: false },
  { id: 37, cat: 'C', name: 'Sponsored check-in unlock', rail: 'brand_invoice', enabled: false },
  { id: 38, cat: 'C', name: 'Sponsored RSVP reward', rail: 'brand_invoice', enabled: false },
  { id: 39, cat: 'C', name: 'Sponsored beacon', rail: 'brand_invoice', enabled: false },
  { id: 40, cat: 'C', name: 'Sponsored aura/theme pack', rail: 'brand_invoice', enabled: false },
  { id: 41, cat: 'C', name: 'Sponsored vibe-equity multiplier', rail: 'brand_invoice', enabled: false },
  { id: 42, cat: 'C', name: 'Sponsored leaderboard', rail: 'brand_invoice', enabled: false },
  { id: 43, cat: 'C', name: 'Sponsored streak rewards', rail: 'brand_invoice', enabled: false },
  { id: 44, cat: 'C', name: 'Sponsored badge/sticker', rail: 'brand_invoice', enabled: false },
  { id: 45, cat: 'C', name: 'Sponsored prediction game', rail: 'brand_invoice', enabled: false },
  { id: 46, cat: 'C', name: 'Sponsored MOTM/best-act award', rail: 'brand_invoice', enabled: false },
  { id: 47, cat: 'C', name: 'Branded poll', rail: 'brand_invoice', enabled: false },
  { id: 48, cat: 'C', name: 'Sponsored survey', rail: 'brand_invoice', enabled: false },
  { id: 49, cat: 'C', name: 'Sponsored playlist/now-playing', rail: 'brand_invoice', enabled: false },
  { id: 50, cat: 'C', name: 'Sponsored venue verified status', rail: 'brand_invoice', enabled: false },
  { id: 51, cat: 'C', name: 'Sponsored guest-list/VIP unlock', rail: 'brand_invoice', enabled: false },
  { id: 52, cat: 'C', name: 'Sponsored "first 50 in free"', rail: 'brand_invoice', enabled: false },
  { id: 53, cat: 'C', name: 'Geofenced brand offer', rail: 'brand_invoice', enabled: false },
  { id: 54, cat: 'C', name: 'Sponsored countdown', rail: 'brand_invoice', enabled: false },
  { id: 55, cat: 'C', name: 'Sponsored after-party suggestion', rail: 'brand_invoice', enabled: false },
  { id: 56, cat: 'C', name: 'Sponsored carpool', rail: 'brand_invoice', enabled: false },
  { id: 57, cat: 'C', name: 'Sponsored crew/group feature', rail: 'brand_invoice', enabled: false },
  { id: 58, cat: 'C', name: 'Seasonal takeover', rail: 'brand_invoice', enabled: false },
  { id: 59, cat: 'C', name: 'Sponsored city-launch', rail: 'brand_invoice', enabled: false },
  { id: 60, cat: 'C', name: 'Co-branded real-world activation', rail: 'brand_invoice', enabled: false },

  // ── D. Consumer subscriptions & premium ─────────────────────────────────────
  { id: 61, cat: 'D', name: 'Gruvs Pro monthly', rail: 'iap', enabled: false },
  { id: 62, cat: 'D', name: 'Gruvs Pro annual', rail: 'iap', enabled: false },
  { id: 63, cat: 'D', name: 'Lifetime Pro', rail: 'iap', enabled: false },
  { id: 64, cat: 'D', name: 'Plus mid-tier', rail: 'iap', enabled: false },
  { id: 65, cat: 'D', name: 'See who viewed you', rail: 'iap', enabled: false },
  { id: 66, cat: 'D', name: 'See who liked/saved you', rail: 'iap', enabled: false },
  { id: 67, cat: 'D', name: 'Advanced Scout filters', rail: 'iap', enabled: false },
  { id: 68, cat: 'D', name: 'Wider discovery radius', rail: 'iap', enabled: false },
  { id: 69, cat: 'D', name: 'Always-on beacon', rail: 'iap', enabled: false },
  { id: 70, cat: 'D', name: 'Unlimited bookmarks', rail: 'iap', enabled: false },
  { id: 71, cat: 'D', name: 'Month/year planner', rail: 'iap', enabled: false },
  { id: 72, cat: 'D', name: 'HD/long video + priority', rail: 'iap', enabled: false },
  { id: 73, cat: 'D', name: 'Premium aura packs', rail: 'iap', enabled: false },
  { id: 74, cat: 'D', name: 'Ad-free', rail: 'iap', enabled: false },
  { id: 75, cat: 'D', name: 'Early-access RSVP', rail: 'iap', enabled: false },
  { id: 76, cat: 'D', name: 'Profile gallery expansion', rail: 'iap', enabled: false },
  { id: 77, cat: 'D', name: 'Incognito/ghost browsing', rail: 'iap', enabled: false },
  { id: 78, cat: 'D', name: 'Priority support', rail: 'iap', enabled: false },
  { id: 79, cat: 'D', name: 'Pro-only events', rail: 'iap', enabled: false },
  { id: 80, cat: 'D', name: 'Super-RSVP', rail: 'iap', enabled: false },
  { id: 81, cat: 'D', name: 'Custom profile themes', rail: 'iap', enabled: false },
  { id: 82, cat: 'D', name: 'Read receipts / message anyone', rail: 'iap', enabled: false },
  { id: 83, cat: 'D', name: 'Travel mode', rail: 'iap', enabled: false },
  { id: 84, cat: 'D', name: 'Family/crew bundle', rail: 'iap', enabled: false },
  { id: 85, cat: 'D', name: 'Student tier', rail: 'iap', enabled: false },

  // ── E. Business / B2B subscriptions & tools ─────────────────────────────────
  { id: 86,  cat: 'E', name: 'Business Starter', rail: 'iap', enabled: false },
  { id: 87,  cat: 'E', name: 'Business Pro', rail: 'iap', enabled: false },
  { id: 88,  cat: 'E', name: 'Business Enterprise', rail: 'brand_invoice', enabled: false },
  { id: 89,  cat: 'E', name: 'Store builder', rail: 'iap', enabled: false },
  { id: 90,  cat: 'E', name: 'Audience analytics', rail: 'iap', enabled: false },
  { id: 91,  cat: 'E', name: 'Audience targeting', rail: 'iap', enabled: false },
  { id: 92,  cat: 'E', name: 'Drip surveys', rail: 'iap', enabled: false },
  { id: 93,  cat: 'E', name: 'Verified business badge', rail: 'iap', enabled: false },
  { id: 94,  cat: 'E', name: 'Unlimited events', rail: 'iap', enabled: false },
  { id: 95,  cat: 'E', name: 'Priority placement', rail: 'iap', enabled: false },
  { id: 96,  cat: 'E', name: 'Boosted events bundle', rail: 'iap', enabled: false },
  { id: 97,  cat: 'E', name: 'CRM-lite', rail: 'iap', enabled: false },
  { id: 98,  cat: 'E', name: 'Notification blasts', rail: 'iap', enabled: false },
  { id: 99,  cat: 'E', name: 'Category benchmarking', rail: 'iap', enabled: false },
  { id: 100, cat: 'E', name: 'A/B test posters', rail: 'iap', enabled: false },
  { id: 101, cat: 'E', name: 'Scheduled posting', rail: 'iap', enabled: false },
  { id: 102, cat: 'E', name: 'Multi-admin seats', rail: 'iap', enabled: false },
  { id: 103, cat: 'E', name: 'Business API access', rail: 'brand_invoice', enabled: false },
  { id: 104, cat: 'E', name: 'White-label mini-site', rail: 'brand_invoice', enabled: false },
  { id: 105, cat: 'E', name: 'Verified promoter tier', rail: 'iap', enabled: false },
  { id: 106, cat: 'E', name: 'Vendor tier', rail: 'iap', enabled: false },
  { id: 107, cat: 'E', name: 'Service-provider tier', rail: 'iap', enabled: false },
  { id: 108, cat: 'E', name: 'Talent/agency tier', rail: 'iap', enabled: false },
  { id: 109, cat: 'E', name: 'Club/team tier', rail: 'iap', enabled: false },
  { id: 110, cat: 'E', name: 'Sponsorship-matchmaking tier', rail: 'brand_invoice', enabled: false },
  { id: 111, cat: 'E', name: 'Lead-gen package', rail: 'brand_invoice', enabled: false },
  { id: 112, cat: 'E', name: 'Featured directory listing', rail: 'iap', enabled: false },
  { id: 113, cat: 'E', name: 'Onboarding/setup fee', rail: 'brand_invoice', enabled: false },
  { id: 114, cat: 'E', name: 'Partner certification', rail: 'brand_invoice', enabled: false },
  { id: 115, cat: 'E', name: 'Annual prepay discount', rail: 'brand_invoice', enabled: false },

  // ── F. Boosts, promotions & consumables ─────────────────────────────────────
  { id: 116, cat: 'F', name: 'Boost a listing', rail: 'iap', enabled: false },
  { id: 117, cat: 'F', name: 'Boost a reel', rail: 'iap', enabled: false },
  { id: 118, cat: 'F', name: 'Boost a profile', rail: 'iap', enabled: false },
  { id: 119, cat: 'F', name: 'City-wide boost', rail: 'iap', enabled: false },
  { id: 120, cat: 'F', name: 'Country-wide boost', rail: 'iap', enabled: false },
  { id: 121, cat: 'F', name: 'Super-RSVP consumable', rail: 'iap', enabled: false },
  { id: 122, cat: 'F', name: 'Super-Spark blast', rail: 'iap', enabled: false },
  { id: 123, cat: 'F', name: 'Spotlight pack (5 boosts)', rail: 'iap', enabled: false },
  { id: 124, cat: 'F', name: 'Priority-search day-pass', rail: 'iap', enabled: false },
  { id: 125, cat: 'F', name: 'Bump an old event', rail: 'iap', enabled: false },
  { id: 126, cat: 'F', name: 'Extra beacon hours', rail: 'iap', enabled: false },
  { id: 127, cat: 'F', name: 'Profile-frame/effect packs', rail: 'iap', enabled: false },
  { id: 128, cat: 'F', name: 'Gift a boost', rail: 'iap', enabled: false },
  { id: 129, cat: 'F', name: 'Fill-my-event blast', rail: 'iap', enabled: false },
  { id: 130, cat: 'F', name: 'Weekend mega-boost', rail: 'iap', enabled: false },
  { id: 131, cat: 'F', name: 'Auto-boost subscription', rail: 'iap', enabled: false },
  { id: 132, cat: 'F', name: 'Trending-guarantee placement', rail: 'iap', enabled: false },
  { id: 133, cat: 'F', name: 'Pin to category top', rail: 'iap', enabled: false },
  { id: 134, cat: 'F', name: 'Cross-city promotion', rail: 'iap', enabled: false },
  { id: 135, cat: 'F', name: 'Headliner map placement', rail: 'iap', enabled: false },

  // ── G. Commerce, affiliate & marketplace ────────────────────────────────────
  { id: 136, cat: 'G', name: 'Affiliate ticketing', rail: 'affiliate', enabled: false },
  { id: 137, cat: 'G', name: 'Affiliate music', rail: 'affiliate', enabled: false },
  { id: 138, cat: 'G', name: 'Affiliate ride-hailing', rail: 'affiliate', enabled: false },
  { id: 139, cat: 'G', name: 'Affiliate accommodation', rail: 'affiliate', enabled: false },
  { id: 140, cat: 'G', name: 'Affiliate food delivery', rail: 'affiliate', enabled: false },
  { id: 141, cat: 'G', name: 'Print-on-demand merch', rail: 'affiliate', enabled: false },
  { id: 142, cat: 'G', name: 'Poster/flyer template store', rail: 'iap', enabled: false },
  { id: 143, cat: 'G', name: 'Affiliate liquor/retail', rail: 'affiliate', enabled: false },
  { id: 144, cat: 'G', name: 'Affiliate fashion', rail: 'affiliate', enabled: false },
  { id: 145, cat: 'G', name: 'Featured product placement', rail: 'brand_invoice', enabled: false },
  { id: 146, cat: 'G', name: 'Sponsored vendor of week', rail: 'brand_invoice', enabled: false },
  { id: 147, cat: 'G', name: 'Feature-a-gig listing fee', rail: 'iap', enabled: false },
  { id: 148, cat: 'G', name: 'Marketplace commission', rail: 'payout_provider', enabled: false, psp: true },
  { id: 149, cat: 'G', name: 'In-app ticket sales', rail: 'payout_provider', enabled: false, psp: true },
  { id: 150, cat: 'G', name: 'In-app tipping/gifting', rail: 'payout_provider', enabled: false, psp: true },
  { id: 151, cat: 'G', name: 'Digital goods via IAP', rail: 'iap', enabled: false },
  { id: 152, cat: 'G', name: 'Bundle deals', rail: 'iap', enabled: false },
  { id: 153, cat: 'G', name: 'Gift cards / Pro gifting', rail: 'iap', enabled: false },
  { id: 154, cat: 'G', name: 'Affiliate event insurance', rail: 'affiliate', enabled: false },
  { id: 155, cat: 'G', name: 'Affiliate equipment hire', rail: 'affiliate', enabled: false },
  { id: 156, cat: 'G', name: 'Affiliate security directory', rail: 'affiliate', enabled: false },
  { id: 157, cat: 'G', name: 'Affiliate catering directory', rail: 'affiliate', enabled: false },
  { id: 158, cat: 'G', name: 'Affiliate photo/video directory', rail: 'affiliate', enabled: false },
  { id: 159, cat: 'G', name: 'Group-buy referral fee', rail: 'affiliate', enabled: false },
  { id: 160, cat: 'G', name: 'Branded sampling at events', rail: 'brand_invoice', enabled: false },

  // ── H. Ways USERS make money ────────────────────────────────────────────────
  { id: 161, cat: 'H', name: 'Refer-a-friend bounty', rail: 'voucher_xp', enabled: false, userEarn: true },
  { id: 162, cat: 'H', name: 'Refer-a-business commission', rail: 'brand_invoice', enabled: false, userEarn: true },
  { id: 163, cat: 'H', name: 'Ambassador/street-team', rail: 'brand_invoice', enabled: false, userEarn: true },
  { id: 164, cat: 'H', name: 'Content bounties (UGC)', rail: 'brand_invoice', enabled: false, userEarn: true },
  { id: 165, cat: 'H', name: 'Brand-deal marketplace fee', rail: 'brand_invoice', enabled: false, userEarn: true },
  { id: 166, cat: 'H', name: 'Get discovered → paid gig', rail: 'brand_invoice', enabled: false, userEarn: true },
  { id: 167, cat: 'H', name: 'DJ/artist booking leads', rail: 'brand_invoice', enabled: false, userEarn: true },
  { id: 168, cat: 'H', name: 'Host sells own tickets', rail: 'payout_provider', enabled: false, userEarn: true, psp: true },
  { id: 169, cat: 'H', name: 'Affiliate sub-codes', rail: 'voucher_xp', enabled: false, userEarn: true },
  { id: 170, cat: 'H', name: 'Promoter program (per RSVP)', rail: 'voucher_xp', enabled: false, userEarn: true },
  { id: 171, cat: 'H', name: 'Crowd-photographer marketplace', rail: 'payout_provider', enabled: false, userEarn: true, psp: true },
  { id: 172, cat: 'H', name: 'Sell poster designs', rail: 'payout_provider', enabled: false, userEarn: true, psp: true },
  { id: 173, cat: 'H', name: 'Sell aura/theme packs (rev-share)', rail: 'payout_provider', enabled: false, userEarn: true, psp: true },
  { id: 174, cat: 'H', name: 'Tip jar', rail: 'payout_provider', enabled: false, userEarn: true, psp: true },
  { id: 175, cat: 'H', name: 'Paid surveys (XP reward)', rail: 'voucher_xp', enabled: false, userEarn: true },
  { id: 176, cat: 'H', name: 'Local expert curator', rail: 'voucher_xp', enabled: false, userEarn: true },
  { id: 177, cat: 'H', name: 'Moderator/verifier gigs', rail: 'voucher_xp', enabled: false, userEarn: true },
  { id: 178, cat: 'H', name: 'Sell merch (POD shelf)', rail: 'affiliate', enabled: false, userEarn: true },
  { id: 179, cat: 'H', name: 'Gig marketplace work', rail: 'payout_provider', enabled: false, userEarn: true, psp: true },
  { id: 180, cat: 'H', name: 'Vendors sell stall spots', rail: 'payout_provider', enabled: false, userEarn: true, psp: true },
  { id: 181, cat: 'H', name: 'Agencies monetize rosters', rail: 'brand_invoice', enabled: false, userEarn: true },
  { id: 182, cat: 'H', name: 'Clubs monetize memberships', rail: 'payout_provider', enabled: false, userEarn: true, psp: true },
  { id: 183, cat: 'H', name: 'Win sponsored competitions', rail: 'voucher_xp', enabled: false, userEarn: true },
  { id: 184, cat: 'H', name: 'Loyalty cashback (voucher)', rail: 'voucher_xp', enabled: false, userEarn: true },
  { id: 185, cat: 'H', name: 'Bring-10-friends reward', rail: 'voucher_xp', enabled: false, userEarn: true },
  { id: 186, cat: 'H', name: 'Reel creator fund', rail: 'voucher_xp', enabled: false, userEarn: true },
  { id: 187, cat: 'H', name: 'Sell curated experiences', rail: 'payout_provider', enabled: false, userEarn: true, psp: true },
  { id: 188, cat: 'H', name: 'MC/host-for-hire directory', rail: 'brand_invoice', enabled: false, userEarn: true },
  { id: 189, cat: 'H', name: 'Sponsored challenge prizes', rail: 'voucher_xp', enabled: false, userEarn: true },
  { id: 190, cat: 'H', name: 'Affiliate own promo codes', rail: 'affiliate', enabled: false, userEarn: true },
  { id: 191, cat: 'H', name: 'Earn for attendance data', rail: 'voucher_xp', enabled: false, userEarn: true },
  { id: 192, cat: 'H', name: 'Host workshops/classes', rail: 'payout_provider', enabled: false, userEarn: true, psp: true },
  { id: 193, cat: 'H', name: 'Sell exclusive RSVPs', rail: 'payout_provider', enabled: false, userEarn: true, psp: true },
  { id: 194, cat: 'H', name: 'Mystery-guest program', rail: 'voucher_xp', enabled: false, userEarn: true },
  { id: 195, cat: 'H', name: 'City community manager', rail: 'brand_invoice', enabled: false, userEarn: true },
  { id: 196, cat: 'H', name: 'Scout finder’s fee', rail: 'brand_invoice', enabled: false, userEarn: true },
  { id: 197, cat: 'H', name: 'Sponsored beacon earnings', rail: 'brand_invoice', enabled: false, userEarn: true },
  { id: 198, cat: 'H', name: 'Resell boost credits', rail: 'payout_provider', enabled: false, userEarn: true, psp: true },
  { id: 199, cat: 'H', name: 'Profile ad rev-share', rail: 'payout_provider', enabled: false, userEarn: true, psp: true },
  { id: 200, cat: 'H', name: 'Creator fan subscriptions', rail: 'payout_provider', enabled: false, userEarn: true, psp: true },

  // ── I. Data, intelligence & API ─────────────────────────────────────────────
  { id: 201, cat: 'I', name: 'Nightlife-trends reports', rail: 'brand_invoice', enabled: false },
  { id: 202, cat: 'I', name: 'Best-night-to-host intel', rail: 'brand_invoice', enabled: false },
  { id: 203, cat: 'I', name: 'Footfall/heatmap insights', rail: 'brand_invoice', enabled: false },
  { id: 204, cat: 'I', name: 'Category demand reports', rail: 'brand_invoice', enabled: false },
  { id: 205, cat: 'I', name: 'Campaign performance dashboards', rail: 'brand_invoice', enabled: false },
  { id: 206, cat: 'I', name: 'Paid events-feed API', rail: 'brand_invoice', enabled: false },
  { id: 207, cat: 'I', name: 'Paid talent/scout API', rail: 'brand_invoice', enabled: false },
  { id: 208, cat: 'I', name: 'Trend-forecast subscription', rail: 'brand_invoice', enabled: false },
  { id: 209, cat: 'I', name: 'Audience-overlap insights', rail: 'brand_invoice', enabled: false },
  { id: 210, cat: 'I', name: 'Tourism-board partnerships', rail: 'brand_invoice', enabled: false },
  { id: 211, cat: 'I', name: 'Sponsored research report', rail: 'brand_invoice', enabled: false },
  { id: 212, cat: 'I', name: 'Venue-chain benchmarks', rail: 'brand_invoice', enabled: false },
  { id: 213, cat: 'I', name: 'Licensed "what\'s hot" widget', rail: 'brand_invoice', enabled: false },
  { id: 214, cat: 'I', name: 'Embeddable events widget', rail: 'brand_invoice', enabled: false },
  { id: 215, cat: 'I', name: 'Integration/webhook fees', rail: 'brand_invoice', enabled: false },

  // ── J. Licensing, expansion & offline ───────────────────────────────────────
  { id: 216, cat: 'J', name: 'White-label to a city', rail: 'brand_invoice', enabled: false },
  { id: 217, cat: 'J', name: 'White-label to a campus', rail: 'brand_invoice', enabled: false },
  { id: 218, cat: 'J', name: 'White-label to a festival', rail: 'brand_invoice', enabled: false },
  { id: 219, cat: 'J', name: 'City-partner franchise', rail: 'brand_invoice', enabled: false },
  { id: 220, cat: 'J', name: 'License sports/tournament engine', rail: 'brand_invoice', enabled: false },
  { id: 221, cat: 'J', name: 'License talent/scout engine', rail: 'brand_invoice', enabled: false },
  { id: 222, cat: 'J', name: 'Brand-funded city launches', rail: 'brand_invoice', enabled: false },
  { id: 223, cat: 'J', name: 'Tourism-board licensing', rail: 'brand_invoice', enabled: false },
  { id: 224, cat: 'J', name: 'Co-branded physical events', rail: 'brand_invoice', enabled: false },
  { id: 225, cat: 'J', name: 'Pop-up Gruvs Lounge', rail: 'brand_invoice', enabled: false },
  { id: 226, cat: 'J', name: 'Merch drops at events', rail: 'affiliate', enabled: false },
  { id: 227, cat: 'J', name: 'Branded check-in hardware', rail: 'brand_invoice', enabled: false },
  { id: 228, cat: 'J', name: 'Exclusive venue deals (rev-share)', rail: 'brand_invoice', enabled: false },
  { id: 229, cat: 'J', name: 'Powered-by-Gruvs signage', rail: 'brand_invoice', enabled: false },
  { id: 230, cat: 'J', name: 'Standalone organiser SaaS', rail: 'brand_invoice', enabled: false },
  { id: 231, cat: 'J', name: 'Ticketing-partner rev-share', rail: 'affiliate', enabled: false },
  { id: 232, cat: 'J', name: 'Sponsorship-agency split', rail: 'brand_invoice', enabled: false },
  { id: 233, cat: 'J', name: 'Media/press syndication', rail: 'brand_invoice', enabled: false },
  { id: 234, cat: 'J', name: 'Telco partnership', rail: 'brand_invoice', enabled: false },
  { id: 235, cat: 'J', name: 'Bank/fintech partnership', rail: 'brand_invoice', enabled: false },
  { id: 236, cat: 'J', name: 'Liquor on-trade partnerships', rail: 'brand_invoice', enabled: false },
  { id: 237, cat: 'J', name: 'Festival data + promo packages', rail: 'brand_invoice', enabled: false },
  { id: 238, cat: 'J', name: 'Campus ambassador networks', rail: 'brand_invoice', enabled: false },
  { id: 239, cat: 'J', name: 'Sponsored Gruvs Awards', rail: 'brand_invoice', enabled: false },
  { id: 240, cat: 'J', name: 'African-market expansion', rail: 'brand_invoice', enabled: false },

  // ── K. Gamification & engagement-funded ─────────────────────────────────────
  { id: 241, cat: 'K', name: 'Sponsored quests', rail: 'brand_invoice', enabled: false },
  { id: 242, cat: 'K', name: 'Sponsored streaks', rail: 'brand_invoice', enabled: false },
  { id: 243, cat: 'K', name: 'Sponsored Sovereign drops', rail: 'brand_invoice', enabled: false },
  { id: 244, cat: 'K', name: 'Brand leaderboards w/ prizes', rail: 'brand_invoice', enabled: false },
  { id: 245, cat: 'K', name: 'Sponsored collectible cards', rail: 'brand_invoice', enabled: false },
  { id: 246, cat: 'K', name: 'Premium collectible packs', rail: 'iap', enabled: false },
  { id: 247, cat: 'K', name: 'Sponsored fantasy leagues', rail: 'brand_invoice', enabled: false },
  { id: 248, cat: 'K', name: 'Sponsored seasonal events', rail: 'brand_invoice', enabled: false },
  { id: 249, cat: 'K', name: 'Sponsored check-in-to-win', rail: 'brand_invoice', enabled: false },
  { id: 250, cat: 'K', name: 'Partner-funded loyalty tiers', rail: 'brand_invoice', enabled: false },
  { id: 251, cat: 'K', name: 'Sponsored milestones', rail: 'brand_invoice', enabled: false },
  { id: 252, cat: 'K', name: 'Brand-funded referral contests', rail: 'brand_invoice', enabled: false },
  { id: 253, cat: 'K', name: 'Sponsored birthday spotlights', rail: 'brand_invoice', enabled: false },
  { id: 254, cat: 'K', name: 'Year-in-Gruvs wrapped', rail: 'iap', enabled: false },
  { id: 255, cat: 'K', name: 'Sponsored AR scavenger hunts', rail: 'brand_invoice', enabled: false },
];

// ── Gate helpers — the ONLY way the app should check a revenue feature ────────
// Returns true only if: master switch on AND that rail is connected AND the
// specific way is enabled. With everything false today, this is always false.
const _byId = Object.fromEntries(MONETIZATION_WAYS.map(w => [w.id, w]));

export function isWayEnabled(id) {
  if (!MONETIZATION_LIVE) return false;
  const w = _byId[id];
  if (!w || !w.enabled) return false;
  if (w.rail && RAILS_CONNECTED[w.rail] !== true) return false;
  return true;
}

export function enabledWays() {
  return MONETIZATION_WAYS.filter(w => isWayEnabled(w.id));
}

export function waysByCategory(cat) {
  return MONETIZATION_WAYS.filter(w => w.cat === cat);
}

// Sanity: registry should hold all 255.
export const MONETIZATION_WAY_COUNT = MONETIZATION_WAYS.length; // 255