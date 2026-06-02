import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

let AsyncStorage = null;
try { AsyncStorage = require('@react-native-async-storage/async-storage').default; } catch { }

const STORAGE_KEY = '@gruvs_tutorials_done_v1';

// ── Tutorial Definitions (full Gruvs language) ────────────────────────────────
export const TUTORIALS = [
  // ── Tune In ─────────────────────────────────────────────────────────────────
  {
    id: 'welcome',
    title: "Welcome to The Gruvs",
    category: 'Tune In',
    icon: 'zap',
    color: '#00f2ff',
    duration: '2 min',
    steps: [
      {
        icon: 'zap',
        title: "You've Landed in The Gruvs",
        body: "South Africa's home for nightlife, Gruvs, and culture. Discover concerts, club nights, food festivals, and community experiences dropping near you — all in real time.",
        tip: 'Pull down anywhere on The Drop to refresh and see the latest Gruvs hitting your city.',
        visual: 'welcome',
      },
      {
        icon: 'map-pin',
        title: 'Your City, Your Drop',
        body: "The Gruvs knows where you are and surfaces what matters. Gruvs are sorted by how close they are, how Blazing they are, and how well they match your taste — so the hottest stuff always hits first.",
        tip: 'Allow location so The Gruvs can find Gruvs dropping near you.',
        visual: 'city',
      },
      {
        icon: 'layout',
        title: 'Your Command Center',
        body: 'Move through The Gruvs using the 7 tabs:\n\n• The Drop — Live personalised Gruv feed\n• Reels — Short-form video from Vibers & events\n• Scout — Full city catalogue and search\n• Lineup — Schedule + Crew (toggle at top)\n• Linked Up — Your direct message threads\n• Pings — Alerts and reminders\n• Vibe Card — Your identity, settings, and Biz Hub',
        tip: 'Lineup and Crew are now together — switch between them with the toggle at the top of the Lineup tab.',
        visual: 'tabs',
      },
    ],
  },

  // ── The Drop & Gruvs ────────────────────────────────────────────────────────
  {
    id: 'the_drop',
    title: 'Reading The Drop',
    category: 'The Drop & Gruvs',
    icon: 'home',
    color: '#00f2ff',
    duration: '3 min',
    steps: [
      {
        icon: 'home',
        title: 'The Drop — Your Live Feed',
        body: 'The Drop shows Gruvs near you, Blazing in your city, and curated for your taste. Cards are ranked by how close they are, Vibe count, and how well they match your history.',
        tip: 'Tap a Gruv card image to open the full detail page with passes, map, and community Echoes.',
        visual: 'feed',
      },
      {
        icon: 'tag',
        title: 'Gruv Stats Explained',
        body: 'Each card shows key numbers:\n\n• 🔥 Vibes — Vibers who RSVPed or showed interest\n• 💬 Echoes — Hype posts and community talk\n• ✓ Touch Downs — Confirmed Vibers on the day\n• ⭐ Rating — Post-Gruv score from Vibers',
        tip: 'Gruvs with more Vibes get pushed higher in other Vibers\' Drops automatically.',
        visual: 'stats',
      },
      {
        icon: 'filter',
        title: 'Drop Filters',
        body: 'Use the filter chips at the top to narrow down:\n\n• Category (Music, Food, Sport, Art, Business...)\n• Time (Tonight / This Week / Weekend)\n• Free Gruvs only\n• Nearby (sorted by distance from your location)',
        tip: 'Your active filter combo is remembered between sessions.',
        visual: 'filters',
      },
      {
        icon: 'trending-up',
        title: 'Blazing Gruvs',
        body: 'The Blazing section highlights Gruvs gaining the fastest momentum — the most Vibes, Echoes, and Touch Downs in the last 24 hours across your whole city.',
        tip: 'Blazing Gruvs often sell their Passes within hours. Stash them as soon as you see them.',
        visual: 'trending',
      },
    ],
  },
  {
    id: 'vibe_save',
    title: 'Vibing & Stashing',
    category: 'The Drop & Gruvs',
    icon: 'heart',
    color: '#ef4444',
    duration: '2 min',
    steps: [
      {
        icon: 'heart',
        title: 'Vibe a Gruv',
        body: "Tapping the Vibe button tells the organiser you're feeling it and pushes the Gruv higher in other Vibers' Drops. It's your interest signal — no commitment, just energy.",
        tip: 'Tap again to pull back your Vibe. Your Vibe history lives on your Vibe Card.',
        visual: 'vibe',
      },
      {
        icon: 'bookmark',
        title: 'Stash for Later',
        body: 'Stashing a Gruv adds it to your Lineup tab and schedules an automatic Ping 24 hours before it starts — so you never forget what you were planning to hit.',
        tip: 'Stashed Gruvs sync to your Lineup even when you\'re offline.',
        visual: 'save',
      },
      {
        icon: 'share-2',
        title: 'Drop It to Your People',
        body: 'Tap the Drop button to send any Gruv via WhatsApp, Instagram, Twitter, or a copied link. Drops are tracked — organisers see which platform drives the most Vibers in.',
        tip: 'Dropping a Gruv through the app earns you +2 Vibe Score per Vibe who clicks through.',
        visual: 'share',
      },
    ],
  },
  {
    id: 'echoes',
    title: 'Echoes & Reactions',
    category: 'The Drop & Gruvs',
    icon: 'message-circle',
    color: '#8b5cf6',
    duration: '2 min',
    steps: [
      {
        icon: 'message-circle',
        title: 'What Are Echoes?',
        body: "Echoes are the community voice of a Gruv. They're hype posts, questions, live updates, and energy from Vibers who are going or are already there. The vibe check thread.",
        tip: 'The most-liked Echoes float to the top. Post early for maximum reach.',
        visual: 'echoes',
      },
      {
        icon: 'zap',
        title: 'Reactions',
        body: 'React to Gruvs and Echoes:\n\n🔥 Fire — This is lit\n❤️ Love — Showing love\n⚡ Hype — Pure energy\n😮 Shocked — Can\'t believe it\n\nReactions are instant and push the Gruv up the Blazing charts.',
        tip: "Change your reaction any time — tap a different emoji and it switches.",
        visual: 'reactions',
      },
      {
        icon: 'send',
        title: 'Dropping an Echo',
        body: 'Open any Gruv detail page and tap the Echo input at the bottom. Your Echo shows your Vibe Card name, timestamp, and an optional location tag. Max 280 characters.',
        tip: "Tag @handles in your Echo to notify Vibers — great for pulling friends into a Gruv.",
        visual: 'write_echo',
      },
    ],
  },
  {
    id: 'checkin',
    title: 'Touching Down',
    category: 'The Drop & Gruvs',
    icon: 'check-circle',
    color: '#10b981',
    duration: '2 min',
    steps: [
      {
        icon: 'check-circle',
        title: 'Touch Down When You Arrive',
        body: "When you land at a Gruv, tap Touch Down on the Gruv page. This confirms you're there, puts you on the live Viber map, and unlocks post-Gruv features like ratings and photo access.",
        tip: 'You must be within 2km of the Spot — this keeps Touch Downs real.',
        visual: 'checkin',
      },
      {
        icon: 'map',
        title: 'Live Viber Map',
        body: "After Touching Down, see other Vibers who landed at the same Gruv. Your exact location is fuzzy for privacy — only your general area shows to other Touch Downs at the same Spot.",
        tip: 'The live map only shows Vibers who Touched Down at the same Gruv as you.',
        visual: 'live_map',
      },
      {
        icon: 'award',
        title: 'Touch Down Rewards',
        body: 'Every Touch Down adds +10 to your Vibe Score. Land at 10+ Gruvs in a month to earn the "Regular" Seal. Consistent attendance at top-rated Gruvs unlocks Royal status.',
        tip: 'Vibe Score is visible on your Vibe Card — it\'s your credibility number in the community.',
        visual: 'rewards',
      },
    ],
  },

  // ── Scout & Discover ────────────────────────────────────────────────────────
  {
    id: 'explore',
    title: 'Scout Page',
    category: 'Scout & Discover',
    icon: 'compass',
    color: '#f59e0b',
    duration: '3 min',
    steps: [
      {
        icon: 'compass',
        title: 'Scout — Find Everything',
        body: "Scout is your city's full Gruv catalogue — not personalised like The Drop, but complete. Search by name, Spot, DJ, category, date, or location. Every Gruv. No filter.",
        tip: 'Scout also shows Royal Routes — group travel to Gruvs.',
        visual: 'explore',
      },
      {
        icon: 'search',
        title: 'Smart Search',
        body: 'The search bar finds Gruvs by:\n\n• Gruv name or organiser\n• Spot name or area\n• DJ or artist name\n• Category or tag\n\nResults update instantly with fuzzy matching — typos handled.',
        tip: 'Search "ampaino" and still find Amapiano Gruvs — the engine covers you.',
        visual: 'search',
      },
      {
        icon: 'sliders',
        title: 'Powerful Filters',
        body: 'Stack multiple filters:\n\n• Date range (custom start/end)\n• Pass price (R0 to R2000+)\n• Spot type (indoor/outdoor)\n• Gruv category\n• Distance from your location',
        tip: 'Combine filters to find exactly what you need — free outdoor jazz this weekend.',
        visual: 'filters',
      },
    ],
  },
  {
    id: 'royal_routes',
    title: 'Royal Routes',
    category: 'Scout & Discover',
    icon: 'navigation',
    color: '#8b5cf6',
    duration: '2 min',
    steps: [
      {
        icon: 'navigation',
        title: 'What Are Royal Routes?',
        body: 'Royal Routes are community travel groups heading to the same Gruv. Instead of sorting transport alone, you squad up with Vibers going the same direction and split the cost.',
        tip: 'Routes are free to join — only the actual transport cost gets split.',
        visual: 'routes',
      },
      {
        icon: 'users',
        title: 'Locking Into a Route',
        body: 'Browse Royal Routes in the Scout tab. Each Route shows:\n\n• Pickup area and departure time\n• Squad size and spots left\n• Estimated cost per Vibe\n• Route captain\'s Vibe Card\n\nTap LOCK IN to claim your spot.',
        tip: "You'll get a Ping 1 hour before departure with the exact meetup Spot.",
        visual: 'join_route',
      },
      {
        icon: 'plus-circle',
        title: 'Running a Route',
        body: "Driving to a Gruv? Start a Route. Set your pickup area, Gruv destination, departure time, and how many seats you've got. The Gruvs fills your remaining spots with vetted Vibers.",
        tip: 'Route captains earn Royal Seals on their Vibe Card and stack extra Vibe Score.',
        visual: 'create_route',
      },
    ],
  },

  // ── Vibe Card & Identity ─────────────────────────────────────────────────────
  {
    id: 'profile',
    title: 'Your Vibe Card',
    category: 'Vibe Card & Identity',
    icon: 'user',
    color: '#06b6d4',
    duration: '3 min',
    steps: [
      {
        icon: 'user',
        title: 'Your Vibe Card',
        body: "Your Vibe Card is your identity on The Gruvs. It shows your avatar, cover, bio, Vibe Score, earned Seals, and your full Gruv history — Vibes, Stashes, Touch Downs, and Echoes.",
        tip: 'A complete Vibe Card (photo + bio + Spot) gets 3× more visits than a blank one.',
        visual: 'profile',
      },
      {
        icon: 'edit-2',
        title: 'Editing Your Vibe Card',
        body: 'Tap Edit to update:\n\n• Profile and cover photo (tap to upload)\n• Display name and @handle\n• Bio (up to 160 characters)\n• Location Spot and website link\n• Interests (used to tune your Drop)',
        tip: 'Your @handle can only change once every 30 days — lock in a good one.',
        visual: 'edit_profile',
      },
      {
        icon: 'star',
        title: 'Vibe Score & Seals',
        body: 'Vibe Score grows with every move:\n\n• +10 per Touch Down\n• +5 per Echo dropped\n• +2 per Drop that gets clicked\n• +1 per Vibe or Stash\n• +15 per Gruv rating submitted\n\nScore unlocks Royal status and Seals.',
        tip: 'Your Vibe Score is public — higher = more credibility in The Gruvs community.',
        visual: 'score',
      },
    ],
  },
  {
    id: 'identity_modes',
    title: 'Identity Modes',
    category: 'Vibe Card & Identity',
    icon: 'shield',
    color: '#8b5cf6',
    duration: '2 min',
    steps: [
      {
        icon: 'shield',
        title: 'Viper vs Celebrity Mode',
        body: 'The Gruvs has two identity modes. Viper is your public Vibe — visible, social, stacking. Celebrity is your private mode — anonymous, ad-free, untraceable. Switch instantly from your Vibe Card.',
        tip: 'Switching modes never deletes your content — it just changes your visibility.',
        visual: 'modes',
      },
      {
        icon: 'eye',
        title: 'Viper Mode (Default)',
        body: "Your Vibe Card is public, Echoes show your name, and you appear in community searches. Full access to Lock Ins, Locked-In lists, and all social moves. Best for building your presence.",
        tip: 'Viper mode is required to stack Locked-Ins and earn certain Seals.',
        visual: 'viper',
      },
      {
        icon: 'eye-off',
        title: 'Celebrity Mode',
        body: "Your Vibe Card is hidden from search. Echoes appear as 'Anonymous Vibe'. No Missions show in your Drop. You still Scout and interact — Vibers just can't clock you.",
        tip: 'In Celebrity Mode you still stack Vibe Score — it accumulates privately.',
        visual: 'celebrity',
      },
    ],
  },

  // ── Biz Hub & Missions ───────────────────────────────────────────────────────
  {
    id: 'business_intro',
    title: 'Biz Hub',
    category: 'Biz Hub & Missions',
    icon: 'briefcase',
    color: '#f59e0b',
    duration: '4 min',
    steps: [
      {
        icon: 'briefcase',
        title: 'The Gruvs Biz Hub',
        body: "Biz Hub is built for Gruv organisers, Spots, brands, and vendors. Build your storefront, run targeted Missions, track Intel in real time, and connect with The Network — all in one place.",
        tip: "Access Biz Hub from within your 'Vibe Card' tab.",
        visual: 'biz',
      },
      {
        icon: 'layout',
        title: 'Store Builder',
        body: 'Build a professional storefront without touching code. Stack blocks:\n\n• Hero banner and tagline\n• Services and Pass pricing cards\n• Photo gallery and videos\n• Countdown timer to your next Gruv\n• Testimonials and FAQs\n• Social links and contact form',
        tip: 'Published stores go live at thegruvs.app/store/your-slug',
        visual: 'store',
      },
      {
        icon: 'dollar-sign',
        title: 'Stacks & War Chest',
        body: 'The Stacks tab tracks:\n\n• Total Stacks attributed to Missions\n• War Chest spend vs budget remaining\n• Per-Mission ROI\n• Connect partner revenue share\n• Budget burn rate with colour alerts',
        tip: 'Set a daily cap on Missions to keep your War Chest protected.',
        visual: 'finance',
      },
      {
        icon: 'globe',
        title: 'The Network',
        body: 'Plug into The Gruvs wider network:\n\n• Backing Marketplace (sponsors)\n• API Connects (Stripe, Yoco, Eventbrite...)\n• Co-Gruv revenue sharing\n• Affiliate and promoter programme\n• Creative network (photographers, DJs, designers)',
        tip: 'Royal and Enterprise Vibers get priority placement in the Backing Marketplace.',
        visual: 'ecosystem',
      },
    ],
  },
  {
    id: 'campaigns',
    title: 'Running Missions',
    category: 'Biz Hub & Missions',
    icon: 'target',
    color: '#ef4444',
    duration: '4 min',
    steps: [
      {
        icon: 'target',
        title: 'What Is a Mission?',
        body: "A Mission is how your business reaches the right Vibers on The Gruvs. Set a type (awareness, conversion, Gruv promo, retargeting), write your creative, set your War Chest, and define The Crowd who sees it.",
        tip: 'Start with a template — 6 pre-built Mission types cover most use cases from day one.',
        visual: 'campaign',
      },
      {
        icon: 'file-text',
        title: 'Mission Templates',
        body: '6 ready-made templates:\n\n• Nightlife Gruv Promo\n• Food Festival\n• Vendor / Brand Awareness\n• Transport Provider\n• Post-Gruv Recap\n• VIP Retargeting\n\nEach pre-fills all 4 builder steps for you.',
        tip: 'Templates are starting points — every field is fully editable after applying.',
        visual: 'templates',
      },
      {
        icon: 'users',
        title: 'The Crowd Targeting',
        body: '3,000+ targeting signals across 8 categories:\n\n• Demographics (surname, age, language)\n• Lifestyle (church type, car brand, sport)\n• Behaviour (RSVP history, spend level)\n• Geographic (city, suburb, radius)\n• Professional, Interests, Time-based, Purchase Intent',
        tip: "Narrow The Crowd = higher relevance. Wide Crowd = more Eyes. Start wide, then tighten.",
        visual: 'targeting',
      },
      {
        icon: 'clock',
        title: 'Gruv Phase Targeting',
        body: 'Hit Vibers at the perfect moment:\n\n• PRE-GRUV: Transport, outfits, accommodation\n• IN THE GRUV: Food, drinks, merch, Royale upgrades\n• POST-GRUV: Photos, reviews, next Gruv Passes\n\nSelect phases in Step 4 of the Mission builder.',
        tip: 'A transport Mission should always target PRE-GRUV and POST-GRUV phases.',
        visual: 'phases',
      },
    ],
  },
  {
    id: 'biz_promotions',
    title: 'Promotions & Discounts',
    category: 'Biz Hub & Missions',
    icon: 'gift',
    color: '#10b981',
    duration: '3 min',
    steps: [
      {
        icon: 'percent',
        title: 'Creating Offers',
        body: "Inside the Mission Builder, select the 'Promotion' type. You can choose from various offer types: percentage discounts (e.g., 15% off), fixed amount discounts (e.g., R50 off), Buy One Get One (BOGO) deals, or free item vouchers (e.g., 'First Drink Free').",
        tip: 'Experiment with different offer types to see what resonates best with your target audience.',
        visual: 'promo_create',
      },
      {
        icon: 'qr-code',
        title: 'Voucher Codes & Redemption',
        body: "For in-person redemptions, generate unique QR codes or alphanumeric voucher codes. Vibers can 'Stash' these vouchers in their Lineup and present them at your venue. Redemption is confirmed via a 'Touch Down' or a quick scan by your staff.",
        tip: 'Integrating voucher redemption with Touch Downs ensures accurate tracking and prevents fraud.',
        visual: 'voucher_redeem',
      },
      {
        icon: 'trending-up',
        title: 'Vibe-Gated Discounts',
        body: 'Reward loyal Vibers by setting Vibe Score requirements for exclusive discounts. Offer deeper discounts to high-score Vibers to attract the elite crowd to your Spot and encourage community engagement.',
        tip: 'This builds loyalty and encourages Vibers to keep engaging with the app to unlock your best deals.',
        visual: 'vibe_gate',
      },
      {
        icon: 'check-square',
        title: 'Tracking Redemptions',
        body: 'Monitor your Stacks tab to see exactly how many promotions were stashed and how many were redeemed via Touch Down in real-time.',
        tip: 'Track voucher claims, redemption rates, and average discount value to calculate the precise ROI for each promotion.',
        visual: 'promo_stats',
      },
    ],
  },
  {
    id: 'movement_os',
    title: 'Movement & Crossings',
    category: 'Scout & Discover',
    icon: 'map',
    color: '#FFD700',
    duration: '2 min',
    steps: [
      {
        icon: 'navigation',
        title: 'Your Digital Footprint',
        body: "Every time you Touch Down at a Gruv, you leave a trail. This builds your unique Footprint, visible on your Path Map.",
        tip: 'Check your Path Map on your Vibe Card to see where the kingdom takes you.',
        visual: 'footprint_view',
      },
      {
        icon: 'git-commit',
        title: 'Crossing Paths',
        body: "When your path overlaps with another Viber's, a 'Crossing' is born. These gold dots on your map represent shared energy and moments.",
        tip: "Tap a gold intersection on your map to see who you've been vibing with lately.",
        visual: 'crossing_dots',
      },
      {
        icon: 'zap',
        title: 'Sparking a Connection',
        body: "Found someone you cross paths with often? That's a high-vibe match. Send them a 'Spark' or follow them to keep the rhythm going.",
        tip: 'Frequent crossings often unlock exclusive co-Gruv invites.',
        visual: 'spark_action',
      },
      {
        icon: 'award',
        title: 'Pathfinder Status',
        body: "Regularly traversing specific routes or visiting certain types of Gruvs can earn you 'Pathfinder' badges. These badges are displayed on your Vibe Card and can unlock special perks.",
        tip: 'Look out for businesses offering rewards to Pathfinders on their frequently used routes.',
        visual: 'pathfinder_badge',
      },
      {
        icon: 'ghost',
        title: 'Ghost Trace',
        body: "In Ghost Mode, your path crossings leave an anonymous 'Trace' at intersections. Other Vibers (especially other Ghosts) might discover your anonymous Echoes or Sparks.",
        tip: 'Ghost Trace allows for mysterious connections without revealing your identity.',
        visual: 'ghost_trace',
      },
    ],
  },
  {
    id: 'contextual_ads',
    title: 'Contextual Missions',
    category: 'Biz Hub & Missions',
    icon: 'zap',
    color: '#00f2ff',
    duration: '2 min',
    steps: [
      {
        icon: 'zap',
        title: 'Missions That Know the Moment',
        body: "Contextual Missions appear inside Gruv detail pages and adapt to the Gruv phase automatically. If you open a Gruv dropping tonight, you'll see transport and outfit options — not random noise.",
        tip: "Dismiss any Mission tile by tapping the × in the top-right corner.",
        visual: 'contextual',
      },
      {
        icon: 'clock',
        title: 'Three Phases, Three Contexts',
        body: '• BEFORE THE GRUV: Transport, outfits, accommodation, pre-Gruvs\n• IN THE GRUV: Food, drinks, photo booth, merch, Royale upgrades\n• POST GRUV: Your shots, reviews, next Gruv Passes, community groups',
        tip: "The phase flips automatically based on the Gruv's date and time — no manual control needed.",
        visual: 'ad_phases',
      },
      {
        icon: 'eye-off',
        title: 'Mission-Free in Celebrity Mode',
        body: "Switch to Celebrity Mode from your Vibe Card to browse The Gruvs completely Mission-free. All contextual Missions and promoted campaigns are hidden while you're in Celebrity Mode.",
        tip: 'Celebrity Mode is free for all Vibers — no subscription required.',
        visual: 'adfree',
      },
    ],
  },

  // ── Lineup & Pings ───────────────────────────────────────────────────────────
  {
    id: 'calendar',
    title: 'Lineup',
    category: 'Lineup & Pings',
    icon: 'calendar',
    color: '#10b981',
    duration: '2 min',
    steps: [
      {
        icon: 'calendar',
        title: 'Your Lineup',
        body: "The Lineup tab shows all Gruvs you've Stashed, Vibed, or Touched Down at — in a clean monthly view. Tap any highlighted date to see your Gruvs for that day.",
        tip: 'Gruvs appear in your Lineup the moment you Stash or Vibe them — no extra steps.',
        visual: 'calendar',
      },
      {
        icon: 'alert-circle',
        title: 'Clashes & Pings',
        body: "When two Stashed Gruvs overlap in time, the Lineup highlights them in amber. You'll also get automatic Pings:\n\n• 24 hours before your Stashed Gruvs\n• 1 hour before they start\n• When a Stashed Gruv is almost sold out",
        tip: "You can Stash overlapping Gruvs — The Gruvs tracks both without forcing a choice.",
        visual: 'conflicts',
      },
      {
        icon: 'share-2',
        title: 'Dropping Your Lineup',
        body: 'Tap the Drop icon on any Lineup day to send your schedule to your people. They see which Gruvs you\'ll be at — great for locking in group nights out.',
        tip: "In Celebrity Mode, your Lineup is private and can't be Dropped to others.",
        visual: 'share_cal',
      },
    ],
  },
  {
    id: 'notifications',
    title: 'Pings Guide',
    category: 'Lineup & Pings',
    icon: 'bell',
    color: '#f59e0b',
    duration: '2 min',
    steps: [
      {
        icon: 'bell',
        title: 'Your Pings Centre',
        body: "The Pings tab collects everything — Gruv reminders, Lock In activity, Echo replies, Vibers who Locked Into you, Mission updates, and announcements from The Gruvs.",
        tip: 'The red badge number clears automatically when you open the Pings tab.',
        visual: 'alerts',
      },
      {
        icon: 'calendar',
        title: 'Automatic Pings',
        body: "You'll automatically get Pinged for:\n\n• Gruvs you Stashed or Vibed (24h + 1h before)\n• Stashed Gruvs going sold out on Passes\n• Organisers you Locked Into dropping new Gruvs\n• Royal Route departures (1 hour ahead)",
        tip: "Enable device push notifications so Pings reach you even when the app is closed.",
        visual: 'reminders',
      },
      {
        icon: 'settings',
        title: 'Ping Control',
        body: 'Fine-tune what hits you in Vibe Card → Settings:\n\n• Gruv reminders (on/off per Gruv)\n• Lock In activity\n• Echo replies and @mentions\n• Biz Hub alerts (if you run a Biz)\n• Announcements from The Gruvs',
        tip: "You can mute a specific Gruv's Pings without affecting all other alerts.",
        visual: 'notif_settings',
      },
    ],
  },

  // ── Reels ────────────────────────────────────────────────────────────────────
  {
    id: 'reels_intro',
    title: 'Reels — Short-Form Video',
    category: 'Reels',
    icon: 'film',
    color: '#ec4899',
    duration: '3 min',
    steps: [
      {
        icon: 'film',
        title: 'What Are Reels?',
        body: 'Reels are short vertical videos posted by Vibers and organisers — highlights from Gruvs, DJ sets, behind-the-scenes, food drops, and culture moments. Swipe up to skip to the next Reel.',
        tip: 'Double-tap anywhere on a Reel to instantly drop a ❤️ like.',
        visual: 'reels_feed',
      },
      {
        icon: 'sliders',
        title: 'For You vs Following',
        body: 'Switch between two feeds at the top of Reels:\n\n• For You — Algorithm-curated mix of trending and personalised Reels from across The Gruvs\n• Following — Only Reels from Vibers you follow\n\nTap the tab at the top to switch.',
        tip: '"Following" is the cleanest signal — use it when you only want content from Vibers you know.',
        visual: 'reels_tabs',
      },
      {
        icon: 'zap',
        title: 'Reel Controls',
        body: 'Action bar on the right side:\n\n• ❤️ Like — or double-tap the screen\n• 💬 Comment — drop a quick thought\n• 📤 Share — send via WhatsApp, copy link\n• 🔖 Save — bookmark to watch again later\n• 👁 Views — how many Vibers have watched\n• 🔊 Mute — tap to toggle audio on/off\n• Speed — 0.5× · 1× · 1.5× playback speed',
        tip: 'Tap the creator\'s avatar at the top of the action bar to open their Vibe Card.',
        visual: 'reels_actions',
      },
      {
        icon: 'video',
        title: 'Posting a Reel',
        body: 'Tap the camera icon on your Vibe Card gallery tab to post a Reel. Upload a video up to 60 seconds. Add a caption, hashtags, and optionally link it to a specific Gruv. Linked Reels appear inside the Gruv detail page too.',
        tip: 'Reels linked to trending Gruvs get surfaced in the For You feed more aggressively.',
        visual: 'post_reel',
      },
    ],
  },

  // ── Crew ─────────────────────────────────────────────────────────────────────
  {
    id: 'crew_intro',
    title: 'Crew — Your Squad',
    category: 'Lineup & Pings',
    icon: 'users',
    color: '#7c3aed',
    duration: '2 min',
    steps: [
      {
        icon: 'users',
        title: 'What Is Crew?',
        body: "Crew is your inner circle on The Gruvs — the Vibers you roll with to Gruvs. The Crew feed shows what your squad is Vibing, Stashing, and Touching Down at, so you can co-ordinate nights out without any back-and-forth.",
        tip: 'Crew is now inside the Lineup tab — tap the Crew toggle at the top to switch.',
        visual: 'crew_feed',
      },
      {
        icon: 'user-plus',
        title: 'Building Your Crew',
        body: "Follow Vibers to add them to your Crew view. Your Crew feed pulls from everyone you follow. The more you follow, the richer the signal — you'll always know which Gruvs your people are planning to hit.",
        tip: 'Start by following Vibers you recognise from events you\'ve attended — they\'re the most relevant crew signal.',
        visual: 'follow_crew',
      },
      {
        icon: 'calendar',
        title: 'Crew + Lineup Together',
        body: "The Lineup tab now combines your personal schedule (Lineup mode) with your social scene (Crew mode) under one roof. Switch between them with the toggle at the top — no extra tab needed.",
        tip: 'Check Crew before you Stash a Gruv — if your squad is already Vibing it, you should be there too.',
        visual: 'crew_lineup',
      },
    ],
  },

  // ── Linked Up (DMs) ──────────────────────────────────────────────────────────
  {
    id: 'linked_up',
    title: 'Linked Up — Direct Messages',
    category: 'Social & Connections',
    icon: 'message-circle',
    color: '#06b6d4',
    duration: '2 min',
    steps: [
      {
        icon: 'message-circle',
        title: 'Linked Up — Your Inbox',
        body: 'Linked Up is your direct message tab. One-on-one chats with any Viber. Use it to co-ordinate transport, plan group nights, ask questions to organisers, or just keep the conversation going after a Gruv.',
        tip: 'Message requests from Vibers you don\'t follow go into a separate request queue — check the bell badge at the top.',
        visual: 'linked_up',
      },
      {
        icon: 'user-plus',
        title: 'Starting a Conversation',
        body: 'Tap any Viber\'s avatar or username across the app (The Drop, Reels, Scout, profiles) to open their Vibe Card. From there, hit the message icon to open a new chat. The chat opens immediately — no follow required.',
        tip: 'First messages to Vibers you don\'t follow are sent as requests — they\'re visible but need acceptance to reply.',
        visual: 'start_dm',
      },
      {
        icon: 'search',
        title: 'Finding Conversations',
        body: 'The search bar at the top of Linked Up filters your existing conversations by username in real time. Unread threads show a blue dot — bold preview text means you haven\'t opened it yet.',
        tip: 'Linked Up refreshes automatically — new messages appear without pulling to refresh.',
        visual: 'dm_inbox',
      },
    ],
  },

  // ── Journey ───────────────────────────────────────────────────────────────────
  {
    id: 'journey',
    title: 'Build Your Journey',
    category: 'Scout & Discover',
    icon: 'map-pin',
    color: '#8b5cf6',
    duration: '2 min',
    steps: [
      {
        icon: 'map-pin',
        title: 'What Is a Journey?',
        body: 'A Journey is your personal collection of Gruvs you plan to hit — pinned to a live map. Add any Gruv from The Drop by tapping the "Journey" pin icon on the event card. Your pins save automatically and survive app restarts.',
        tip: 'You can add as many Gruvs to your Journey as you like — no cap.',
        visual: 'journey_intro',
      },
      {
        icon: 'navigation',
        title: 'View Your Journey Map',
        body: "Tap the map FAB button (bottom-right of The Drop) whenever you have pinned events. The Journey Map shows all your pinned Gruvs as interactive pins. Tap any pin to see the event card and open the detail page.",
        tip: 'The map auto-calculates the optimal travel order between your pinned Gruvs to save time.',
        visual: 'journey_map',
      },
      {
        icon: 'trash-2',
        title: 'Managing Your Journey',
        body: "Tap the Journey icon on any already-pinned event to remove it. Your Journey syncs across sessions so you never lose your picks. Use the Journey to plan a full evening — club-hop with a proper route.",
        tip: 'Journey pins are private — only visible to you.',
        visual: 'journey_manage',
      },
    ],
  },

  // ── Event Management (Organiser) ──────────────────────────────────────────────
  {
    id: 'event_management',
    title: 'Manage Your Event',
    category: 'Biz Hub & Missions',
    icon: 'settings',
    color: '#00f2ff',
    duration: '4 min',
    steps: [
      {
        icon: 'settings',
        title: 'The ⚙️ Manage Tab',
        body: "If you're the organiser or co-host of a Gruv, the Gruv detail page shows a ⚙️ Manage tab. This is your live event control panel — add your lineup, build your schedule, manage vendors, and post host-only updates.",
        tip: 'Only the event creator and co-hosts can see the Manage tab.',
        visual: 'mgmt_tab',
      },
      {
        icon: 'mic',
        title: 'Lineup Builder',
        body: 'Add every act, speaker, DJ, or panelist to your lineup. For each person you can set:\n\n• Role (Headliner, Support, MC, DJ, Speaker...)\n• Set time (start + end)\n• Stage or room\n• Social handle and bio\n\nLineup is visible to all attendees on the Gruv page.',
        tip: 'Add lineup early — it increases RSVPs by showing attendees who is performing.',
        visual: 'lineup_builder',
      },
      {
        icon: 'calendar',
        title: 'Session Schedule',
        body: 'For conferences, workshops, and multi-session events, build a full programme:\n\n• Title, speaker, type (talk / panel / workshop / Q&A)\n• Start and end times, room or stage\n• Description visible to attendees\n\nSessions appear in the Gruv detail page automatically.',
        tip: "Use session types to help attendees plan their day — 'keynote' vs 'breakout' tells them a lot.",
        visual: 'session_builder',
      },
      {
        icon: 'shopping-bag',
        title: 'Vendor Map',
        body: 'For food markets, festivals, and expos — add every stall or vendor:\n\n• Vendor name and category\n• Stall number (shows on the map)\n• Contact number and description\n• Confirmed / Pending status\n\nAttendees can browse vendors inside the Gruv page before arriving.',
        tip: 'Confirmed vendors show a green badge. Use Pending for vendors you\'re still finalising.',
        visual: 'vendor_map',
      },
      {
        icon: 'broadcast',
        title: 'Live Updates',
        body: 'Post real-time updates to all attendees directly from the Manage tab:\n\n• "Doors opening now"\n• "Main act going on in 10 min"\n• "Stage 2 is delayed — grab a drink"\n\nUpdates appear instantly on the Gruv page with a 🔴 Live marker.',
        tip: 'Use Live Updates on the night to keep attendees informed and reduce door congestion.',
        visual: 'live_updates',
      },
    ],
  },

  // ── AI & Smart Features ───────────────────────────────────────────────────────
  {
    id: 'ai_drop',
    title: 'AI-Powered Drop',
    category: 'The Drop & Gruvs',
    icon: 'cpu',
    color: '#8b5cf6',
    duration: '2 min',
    steps: [
      {
        icon: 'cpu',
        title: 'Your Drop Is Personalised',
        body: 'The Drop learns from everything you do — Vibes, Stashes, Touch Downs, Echoes, search queries, and even how long you pause on a card. The longer you use The Gruvs, the sharper the recommendations get.',
        tip: 'Vibing and Stashing events explicitly trains the algorithm the fastest.',
        visual: 'ai_feed',
      },
      {
        icon: 'star',
        title: '"AI Pick for You" Badge',
        body: 'When the engine has high confidence a Gruv matches your taste and history, it adds the ✦ AI Pick badge to the card. These are not random — they\'re scored against your actual activity pattern.',
        tip: 'AI Picks improve the more you interact. First-time users see popular Gruvs until there\'s enough signal.',
        visual: 'ai_pick',
      },
      {
        icon: 'trending-up',
        title: 'Trending & Blazing',
        body: 'The Blazing section combines real-time Vibe count velocity, Echo volume, and Touch Down rate. Trending Reels are similarly ranked by watch time and engagement in the last 2 hours — not just total views.',
        tip: 'Blazing rankings update every 5 minutes — refresh The Drop to catch what\'s heating up.',
        visual: 'ai_trending',
      },
    ],
  },
];

export const TUTORIAL_CATEGORIES = [
  'Tune In',
  'The Drop & Gruvs',
  'Scout & Discover',
  'Reels',
  'Lineup & Pings',
  'Social & Connections',
  'Vibe Card & Identity',
  'Biz Hub & Missions',
  'Event Management',
];

// ── Context ───────────────────────────────────────────────────────────────────
const TutorialContext = createContext(null);

export const TutorialProvider = ({ children }) => {
  const [completed, setCompleted] = useState([]);
  const [activeTutorial, setActive] = useState(null);
  const [hasLaunched, setHasLaunched] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const isE2E = typeof window !== 'undefined' && window.navigator.webdriver;
        if (isE2E) {
          setCompleted(['welcome']);
          setHasLaunched(true);
          return;
        }
        if (!AsyncStorage) return;
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          setCompleted(parsed.completed || []);
          setHasLaunched(parsed.hasLaunched || false);
        }
      } catch { }
    })();
  }, []);

  const persist = useCallback(async (completedList, launched) => {
    try {
      if (AsyncStorage) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ completed: completedList, hasLaunched: launched }));
    } catch { }
  }, []);

  const openTutorial = useCallback((id, startStep = 0) => {
    const tutorial = TUTORIALS.find(t => t.id === id);
    if (tutorial) setActive({ tutorial, startStep });
  }, []);

  const closeTutorial = useCallback(() => setActive(null), []);

  const markCompleted = useCallback((id) => {
    setCompleted(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      persist(next, true);
      return next;
    });
    setHasLaunched(true);
  }, [persist]);

  const markLaunched = useCallback(() => {
    setHasLaunched(true);
    persist(completed, true);
  }, [completed, persist]);

  const resetAll = useCallback(async () => {
    setCompleted([]);
    setHasLaunched(false);
    try { if (AsyncStorage) await AsyncStorage.removeItem(STORAGE_KEY); } catch { }
  }, []);

  const isCompleted = useCallback((id) => completed.includes(id), [completed]);

  return (
    <TutorialContext.Provider value={{
      tutorials: TUTORIALS,
      completed,
      activeTutorial,
      hasLaunched,
      openTutorial,
      closeTutorial,
      markCompleted,
      markLaunched,
      resetAll,
      isCompleted,
    }}>
      {children}
    </TutorialContext.Provider>
  );
};

export const useTutorial = () => {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error('useTutorial must be inside TutorialProvider');
  return ctx;
};
