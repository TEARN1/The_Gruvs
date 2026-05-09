import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

let AsyncStorage = null;
try { AsyncStorage = require('@react-native-async-storage/async-storage').default; } catch {}

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
        body: 'Move through The Gruvs using the 5 tabs:\n\n• The Drop — Your live personalised Gruv feed\n• Scout — Full city catalogue and search\n• Lineup — Your stashed Gruvs schedule\n• Pings — Alerts and reminders\n• Vibe Card — Your identity, settings, and Biz Hub',
        tip: 'Long press on Pings to mark all as read quickly.',
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
];

export const TUTORIAL_CATEGORIES = [
  'Tune In',
  'The Drop & Gruvs',
  'Scout & Discover',
  'Vibe Card & Identity',
  'Biz Hub & Missions',
  'Lineup & Pings',
];

// ── Context ───────────────────────────────────────────────────────────────────
const TutorialContext = createContext(null);

export const TutorialProvider = ({ children }) => {
  const [completed, setCompleted]     = useState([]);
  const [activeTutorial, setActive]   = useState(null);
  const [hasLaunched, setHasLaunched] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (!AsyncStorage) return;
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          setCompleted(parsed.completed || []);
          setHasLaunched(parsed.hasLaunched || false);
        }
      } catch {}
    })();
  }, []);

  const persist = useCallback(async (completedList, launched) => {
    try {
      if (AsyncStorage) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ completed: completedList, hasLaunched: launched }));
    } catch {}
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
    try { if (AsyncStorage) await AsyncStorage.removeItem(STORAGE_KEY); } catch {}
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
