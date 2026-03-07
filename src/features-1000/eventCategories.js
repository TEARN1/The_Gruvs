/**
 * EXPANDED EVENT CATEGORIES (100+)
 * Complete categorization for all event types
 *
 * Previous: 11 categories with ~40 subcategories
 * New: 13 major categories with 185+ subcategories
 * Total unique categories: 185+
 */

// ═══════════════════════════════════════════════════════════════════════════
// MAJOR CATEGORY GROUPS
// ═══════════════════════════════════════════════════════════════════════════

export const EXPANDED_CATEGORIES = {
  // PROFESSIONAL & CORPORATE (15 CATEGORIES)
  corporate: {
    icon: '💼',
    name: 'Professional & Corporate',
    color: '#3b82f6',
    subcategories: [
      { id: 'annual-conf', name: 'Annual Conferences', emoji: '🎤' },
      { id: 'board-meetings', name: 'Board Meetings', emoji: '👥' },
      { id: 'c-level-forums', name: 'C-Level Forums', emoji: '💎' },
      { id: 'corp-training', name: 'Corporate Training', emoji: '📚' },
      { id: 'dept-meetings', name: 'Department Meetings', emoji: '📋' },
      { id: 'qa-sessions', name: 'Q&A Sessions', emoji: '❓' },
      { id: 'shareholder-meetings', name: 'Shareholder Meetings', emoji: '📊' },
      { id: 'strategic-planning', name: 'Strategic Planning', emoji: '🎯' },
      { id: 'town-halls', name: 'Town Halls', emoji: '🏛️' },
      { id: 'quarterly-reviews', name: 'Quarterly Reviews', emoji: '📈' },
      { id: 'exec-briefings', name: 'Executive Briefings', emoji: '👔' },
      { id: 'webinar-series', name: 'Webinar Series', emoji: '🖥️' },
      { id: 'cert-programs', name: 'Certification Programs', emoji: '🏆' },
      { id: 'roundtables', name: 'Professional Roundtables', emoji: '🔵' },
      { id: 'industry-summits', name: 'Industry Summits', emoji: '🏔️' }
    ]
  },

  // EDUCATION & LEARNING (25 CATEGORIES)
  education: {
    icon: '🎓',
    name: 'Education & Learning',
    color: '#06b6d4',
    subcategories: [
      { id: 'academic-conf', name: 'Academic Conferences', emoji: '🎓' },
      { id: 'alumni-networks', name: 'Alumni Networks', emoji: '🎯' },
      { id: 'bootcamps', name: 'Bootcamps', emoji: '💻' },
      { id: 'cert-exams', name: 'Certification Exams', emoji: '📝' },
      { id: 'continuing-ed', name: 'Continuing Education', emoji: '📖' },
      { id: 'curriculum-forums', name: 'Curriculum Forums', emoji: '📚' },
      { id: 'debate-comp', name: 'Debate Competitions', emoji: '🗣️' },
      { id: 'edu-hackathons', name: 'Educational Hackathons', emoji: '💡' },
      { id: 'faculty-meetings', name: 'Faculty Meetings', emoji: '👨‍🏫' },
      { id: 'field-trips', name: 'Field Trips', emoji: '🚌' },
      { id: 'grad-programs', name: 'Graduate Programs', emoji: '🎓' },
      { id: 'guest-lectures', name: 'Guest Lectures', emoji: '🎤' },
      { id: 'internship-fairs', name: 'Internship Fairs', emoji: '📋' },
      { id: 'language-exchange', name: 'Language Exchanges', emoji: '🌐' },
      { id: 'learning-communities', name: 'Learning Communities', emoji: '👥' },
      { id: 'mentorship-prog', name: 'Mentorship Programs', emoji: '👨‍🏫' },
      { id: 'online-courses', name: 'Online Courses', emoji: '💻' },
      { id: 'parent-teacher', name: 'Parent-Teacher Events', emoji: '👨‍👩‍👧' },
      { id: 'science-fairs', name: 'Science Fairs', emoji: '🔬' },
      { id: 'study-groups', name: 'Study Groups', emoji: '📚' },
      { id: 'teaching-workshops', name: 'Teaching Workshops', emoji: '🏫' },
      { id: 'testing-centers', name: 'Testing Centers', emoji: '✏️' },
      { id: 'university-open-days', name: 'University Open Days', emoji: '🏫' },
      { id: 'webinars', name: 'Webinars', emoji: '🖥️' },
      { id: 'workshop-series', name: 'Workshop Series', emoji: '🛠️' }
    ]
  },

  // HEALTH & WELLNESS (24 CATEGORIES)
  wellness: {
    icon: '🌿',
    name: 'Health & Wellness',
    color: '#34d399',
    subcategories: [
      { id: 'acupuncture', name: 'Acupuncture Clinics', emoji: '🧘' },
      { id: 'fitness-classes', name: 'Fitness Classes', emoji: '💪' },
      { id: 'health-screenings', name: 'Health Screenings', emoji: '🏥' },
      { id: 'mental-health', name: 'Mental Health Support', emoji: '🧠' },
      { id: 'meditation', name: 'Meditation Groups', emoji: '🧘‍♀️' },
      { id: 'nutrition-seminar', name: 'Nutrition Seminars', emoji: '🥗' },
      { id: 'therapy-sessions', name: 'Therapy Sessions', emoji: '💬' },
      { id: 'wellness-retreats', name: 'Wellness Retreats', emoji: '🏞️' },
      { id: 'yoga-classes', name: 'Yoga Classes', emoji: '🧘' },
      { id: 'sleep-clinics', name: 'Sleep Clinics', emoji: '😴' },
      { id: 'stress-mgmt', name: 'Stress Management', emoji: '☮️' },
      { id: 'smoking-cessation', name: 'Smoking Cessation', emoji: '🚭' },
      { id: 'recovery-groups', name: 'Recovery Groups', emoji: '♻️' },
      { id: 'chronic-disease', name: 'Chronic Disease Support', emoji: '⚕️' },
      { id: 'physical-therapy', name: 'Physical Therapy', emoji: '🏋️' },
      { id: 'occupational-therapy', name: 'Occupational Therapy', emoji: '🎯' },
      { id: 'preventive-health', name: 'Preventive Health', emoji: '🛡️' },
      { id: 'holistic-healing', name: 'Holistic Healing', emoji: '🌸' },
      { id: 'energy-work', name: 'Energy Work', emoji: '⚡' },
      { id: 'breathing-exercises', name: 'Breathing Exercises', emoji: '💨' },
      { id: 'dance-therapy', name: 'Dance Therapy', emoji: '💃' },
      { id: 'art-therapy', name: 'Art Therapy', emoji: '🎨' },
      { id: 'nutrition-planning', name: 'Nutrition Planning', emoji: '🥘' },
      { id: 'fitness-challenges', name: 'Fitness Challenges', emoji: '🏅' }
    ]
  },

  // ENTERTAINMENT & MEDIA (15 CATEGORIES)
  entertainment: {
    icon: '🎭',
    name: 'Entertainment & Media',
    color: '#ec4899',
    subcategories: [
      { id: 'comedy-shows', name: 'Comedy Shows', emoji: '😂' },
      { id: 'concerts', name: 'Concerts', emoji: '🎵' },
      { id: 'film-festivals', name: 'Film Festivals', emoji: '🎬' },
      { id: 'film-screenings', name: 'Film Screenings', emoji: '🎥' },
      { id: 'gaming-tournaments', name: 'Gaming Tournaments', emoji: '🎮' },
      { id: 'movie-premieres', name: 'Movie Premieres', emoji: '🎬' },
      { id: 'music-festivals', name: 'Music Festivals', emoji: '🎵' },
      { id: 'podcast-recordings', name: 'Podcast Recordings', emoji: '🎙️' },
      { id: 'stand-up-comedy', name: 'Stand-up Comedy', emoji: '🎤' },
      { id: 'theater-productions', name: 'Theater Productions', emoji: '🎭' },
      { id: 'tv-show-recordings', name: 'TV Show Recordings', emoji: '📺' },
      { id: 'comedy-mics', name: 'Comedy Open Mics', emoji: '🎤' },
      { id: 'magic-shows', name: 'Magic Shows', emoji: '🎩' },
      { id: 'variety-shows', name: 'Variety Shows', emoji: '🎪' },
      { id: 'talent-shows', name: 'Talent Shows', emoji: '⭐' }
    ]
  },

  // FOOD & BEVERAGE (15 CATEGORIES)
  food: {
    icon: '🍽️',
    name: 'Food & Beverage',
    color: '#ef4444',
    subcategories: [
      { id: 'baking-classes', name: 'Baking Classes', emoji: '🍰' },
      { id: 'beer-tastings', name: 'Beer Tastings', emoji: '🍺' },
      { id: 'cooking-classes', name: 'Cooking Classes', emoji: '👨‍🍳' },
      { id: 'cooking-comp', name: 'Cooking Competitions', emoji: '🏆' },
      { id: 'culinary-tours', name: 'Culinary Tours', emoji: '🗺️' },
      { id: 'farm-to-table', name: 'Farm-to-Table Events', emoji: '🌾' },
      { id: 'food-festivals', name: 'Food Festivals', emoji: '🎉' },
      { id: 'food-truck-rallies', name: 'Food Truck Rallies', emoji: '🚚' },
      { id: 'meal-prep', name: 'Meal Prep Workshops', emoji: '📦' },
      { id: 'picnics', name: 'Picnics', emoji: '🧺' },
      { id: 'potluck-dinners', name: 'Potluck Dinners', emoji: '🍲' },
      { id: 'restaurant-tastings', name: 'Restaurant Tastings', emoji: '🍽️' },
      { id: 'seafood-boils', name: 'Seafood Boils', emoji: '🦞' },
      { id: 'tasting-menus', name: 'Tasting Menus', emoji: '🥘' },
      { id: 'wine-tastings', name: 'Wine Tastings', emoji: '🍷' }
    ]
  },

  // SPORTS & RECREATION (36 CATEGORIES)
  sports: {
    icon: '⚽',
    name: 'Sports & Recreation',
    color: '#10b981',
    subcategories: [
      { id: 'baseball', name: 'Baseball Games', emoji: '⚾' },
      { id: 'basketball', name: 'Basketball Games', emoji: '🏀' },
      { id: 'boxing', name: 'Boxing Matches', emoji: '🥊' },
      { id: 'cycling-tours', name: 'Cycling Tours', emoji: '🚴' },
      { id: 'dance-comp', name: 'Dance Competitions', emoji: '💃' },
      { id: 'dodgeball', name: 'Dodgeball Tournaments', emoji: '🔴' },
      { id: 'extreme-sports', name: 'Extreme Sports', emoji: '⛸️' },
      { id: 'fantasy-sports', name: 'Fantasy Sports Leagues', emoji: '🎯' },
      { id: 'figure-skating', name: 'Figure Skating', emoji: '⛸️' },
      { id: 'football', name: 'Football Games', emoji: '🏈' },
      { id: 'golf-tournaments', name: 'Golf Tournaments', emoji: '⛳' },
      { id: 'gymnastics', name: 'Gymnastics Competitions', emoji: '🤸' },
      { id: 'hockey', name: 'Hockey Games', emoji: '🏒' },
      { id: 'horseback-riding', name: 'Horseback Riding', emoji: '🐴' },
      { id: 'ice-skating', name: 'Ice Skating', emoji: '⛸️' },
      { id: 'intramural', name: 'Intramural Sports', emoji: '⚽' },
      { id: 'kayaking', name: 'Kayaking', emoji: '🛶' },
      { id: 'martial-arts', name: 'Martial Arts', emoji: '🥋' },
      { id: 'mini-golf', name: 'Mini Golf', emoji: '⛳' },
      { id: 'obstacle-courses', name: 'Obstacle Courses', emoji: '🏃' },
      { id: 'rock-climbing', name: 'Rock Climbing', emoji: '🧗' },
      { id: 'roller-skating', name: 'Roller Skating', emoji: '🛼' },
      { id: 'rugby', name: 'Rugby Games', emoji: '🏉' },
      { id: 'running-clubs', name: 'Running Clubs', emoji: '🏃' },
      { id: 'sailing', name: 'Sailing', emoji: '⛵' },
      { id: 'scuba-diving', name: 'Scuba Diving', emoji: '🤿' },
      { id: 'skateboarding', name: 'Skateboarding', emoji: '🛹' },
      { id: 'soccer', name: 'Soccer Games', emoji: '⚽' },
      { id: 'softball', name: 'Softball Games', emoji: '🥎' },
      { id: 'surfing', name: 'Surfing', emoji: '🏄' },
      { id: 'swimming', name: 'Swimming', emoji: '🏊' },
      { id: 'tennis', name: 'Tennis Tournaments', emoji: '🎾' },
      { id: 'track-field', name: 'Track & Field', emoji: '🏃' },
      { id: 'trail-running', name: 'Trail Running', emoji: '🏃' },
      { id: 'volleyball', name: 'Volleyball Tournaments', emoji: '🏐' },
      { id: 'water-sports', name: 'Water Sports', emoji: '🌊' },
      { id: 'wrestling', name: 'Wrestling', emoji: '🤼' }
    ]
  },

  // SOCIAL & NETWORKING (18 CATEGORIES)
  social: {
    icon: '👥',
    name: 'Social & Networking',
    color: '#f59e0b',
    subcategories: [
      { id: 'blind-dates', name: 'Blind Date Events', emoji: '💕' },
      { id: 'business-breakfast', name: 'Business Breakfasts', emoji: '🥐' },
      { id: 'business-lunch', name: 'Business Lunches', emoji: '🍽️' },
      { id: 'cocktail-hours', name: 'Cocktail Hours', emoji: '🍸' },
      { id: 'coffee-meetups', name: 'Coffee Meetups', emoji: '☕' },
      { id: 'dinner-parties', name: 'Dinner Parties', emoji: '🍴' },
      { id: 'first-friday', name: 'First Friday Socials', emoji: '🎉' },
      { id: 'flash-mobs', name: 'Flash Mobs', emoji: '💃' },
      { id: 'game-nights', name: 'Game Nights', emoji: '🎲' },
      { id: 'golf-outings', name: 'Golf Outings', emoji: '⛳' },
      { id: 'group-dining', name: 'Group Dining', emoji: '👥' },
      { id: 'happy-hours', name: 'Happy Hours', emoji: '🍻' },
      { id: 'karaoke', name: 'Karaoke Nights', emoji: '🎤' },
      { id: 'mixers', name: 'Mixers', emoji: '👥' },
      { id: 'networking-breakfast', name: 'Networking Breakfasts', emoji: '🥐' },
      { id: 'networking-dinner', name: 'Networking Dinners', emoji: '🍽️' },
      { id: 'office-happy-hour', name: 'Office Happy Hours', emoji: '🍹' },
      { id: 'paint-sip', name: 'Paint & Sip', emoji: '🎨' }
    ]
  },

  // COMMUNITY & IMPACT (20 CATEGORIES)
  community: {
    icon: '🌍',
    name: 'Community & Impact',
    color: '#64748b',
    subcategories: [
      { id: 'charity-auctions', name: 'Charity Auctions', emoji: '🔨' },
      { id: 'charity-drives', name: 'Charity Drives', emoji: '🎁' },
      { id: 'charity-fundraisers', name: 'Charity Fundraisers', emoji: '💰' },
      { id: 'community-cleanup', name: 'Community Cleanups', emoji: '🧹' },
      { id: 'community-gardens', name: 'Community Gardens', emoji: '🌱' },
      { id: 'community-meetings', name: 'Community Meetings', emoji: '👥' },
      { id: 'disaster-relief', name: 'Disaster Relief', emoji: '🆘' },
      { id: 'donation-drives', name: 'Donation Drives', emoji: '📦' },
      { id: 'environmental', name: 'Environmental Events', emoji: '♻️' },
      { id: 'fundraising-galas', name: 'Fundraising Galas', emoji: '🎭' },
      { id: 'habitat-for-humanity', name: 'Habitat for Humanity', emoji: '🏠' },
      { id: 'homeless-outreach', name: 'Homeless Outreach', emoji: '🤝' },
      { id: 'neighborhood-assoc', name: 'Neighborhood Associations', emoji: '🏘️' },
      { id: 'park-cleanup', name: 'Park Cleanups', emoji: '🌳' },
      { id: 'protest-marches', name: 'Protest Marches', emoji: '✊' },
      { id: 'recycling-events', name: 'Recycling Events', emoji: '♻️' },
      { id: 'relay-for-life', name: 'Relay for Life', emoji: '🏃' },
      { id: 'scholarship-fundraisers', name: 'Scholarship Fundraisers', emoji: '🎓' },
      { id: 'soup-kitchens', name: 'Soup Kitchens', emoji: '🍲' },
      { id: 'volunteering', name: 'Volunteer Opportunities', emoji: '🤲' }
    ]
  },

  // ARTS & CREATIVITY (25 CATEGORIES)
  arts: {
    icon: '🎨',
    name: 'Arts & Creativity',
    color: '#a855f7',
    subcategories: [
      { id: 'art-competitions', name: 'Art Competitions', emoji: '🏆' },
      { id: 'art-galleries', name: 'Art Galleries', emoji: '🖼️' },
      { id: 'art-installations', name: 'Art Installations', emoji: '🎨' },
      { id: 'art-workshops', name: 'Art Workshops', emoji: '🛠️' },
      { id: 'artist-markets', name: 'Artist Markets', emoji: '🎪' },
      { id: 'craft-fairs', name: 'Craft Fairs', emoji: '🧵' },
      { id: 'craft-workshops', name: 'Craft Workshops', emoji: '🧶' },
      { id: 'creative-writing', name: 'Creative Writing', emoji: '✍️' },
      { id: 'dance-performances', name: 'Dance Performances', emoji: '💃' },
      { id: 'drawing-classes', name: 'Drawing Classes', emoji: '✏️' },
      { id: 'film-production', name: 'Film Production', emoji: '🎬' },
      { id: 'graphic-design', name: 'Graphic Design Workshops', emoji: '🖌️' },
      { id: 'illustration', name: 'Illustration Classes', emoji: '🎨' },
      { id: 'jewelry-making', name: 'Jewelry Making', emoji: '💎' },
      { id: 'knitting-circles', name: 'Knitting Circles', emoji: '🧶' },
      { id: 'music-jam-sessions', name: 'Music Jam Sessions', emoji: '🎸' },
      { id: 'open-mics', name: 'Open Mics', emoji: '🎤' },
      { id: 'painting-classes', name: 'Painting Classes', emoji: '🎨' },
      { id: 'photography-exhibitions', name: 'Photography Exhibitions', emoji: '📸' },
      { id: 'photography-walks', name: 'Photography Walks', emoji: '📷' },
      { id: 'printmaking', name: 'Printmaking', emoji: '🖨️' },
      { id: 'sculpture-classes', name: 'Sculpture Classes', emoji: '🗿' },
      { id: 'spoken-word', name: 'Spoken Word', emoji: '🎤' },
      { id: 'theater-workshops', name: 'Theater Workshops', emoji: '🎭' },
      { id: 'woodworking', name: 'Woodworking', emoji: '🪵' }
    ]
  },

  // TECHNOLOGY & INNOVATION (23 CATEGORIES)
  technology: {
    icon: '🎮',
    name: 'Technology & Innovation',
    color: '#06b6d4',
    subcategories: [
      { id: 'ai-conferences', name: 'AI Conferences', emoji: '🤖' },
      { id: 'app-launches', name: 'App Launch Events', emoji: '📱' },
      { id: 'blockchain', name: 'Blockchain Summits', emoji: '⛓️' },
      { id: 'cloud-infrastructure', name: 'Cloud Infrastructure', emoji: '☁️' },
      { id: 'code-bootcamps', name: 'Code Bootcamps', emoji: '💻' },
      { id: 'cybersecurity', name: 'Cybersecurity Summits', emoji: '🔐' },
      { id: 'data-science', name: 'Data Science Meetups', emoji: '📊' },
      { id: 'dev-conferences', name: 'Developer Conferences', emoji: '👨‍💻' },
      { id: 'devops', name: 'DevOps Summits', emoji: '⚙️' },
      { id: 'digital-transformation', name: 'Digital Transformation', emoji: '🔄' },
      { id: 'ecommerce', name: 'E-Commerce Summits', emoji: '🛒' },
      { id: 'fintech', name: 'Fintech Summits', emoji: '💳' },
      { id: 'game-dev', name: 'Game Development', emoji: '🎮' },
      { id: 'hardware-hackathons', name: 'Hardware Hackathons', emoji: '🔧' },
      { id: 'innovation-summits', name: 'Innovation Summits', emoji: '💡' },
      { id: 'iot', name: 'IoT Conferences', emoji: '📡' },
      { id: 'mobile-apps', name: 'Mobile App Summits', emoji: '📱' },
      { id: 'robotics', name: 'Robotics Competitions', emoji: '🤖' },
      { id: 'saas', name: 'SaaS Summits', emoji: '☁️' },
      { id: 'software-eng', name: 'Software Engineering', emoji: '👨‍💻' },
      { id: 'startup-pitches', name: 'Startup Pitch Events', emoji: '🚀' },
      { id: 'tech-talks', name: 'Tech Talks', emoji: '💬' },
      { id: 'vr', name: 'Virtual Reality', emoji: '🥽' }
    ]
  },

  // TRAVEL & ADVENTURE (19 CATEGORIES)
  travel: {
    icon: '✈️',
    name: 'Travel & Adventure',
    color: '#8b5cf6',
    subcategories: [
      { id: 'backpacking', name: 'Backpacking Trips', emoji: '🎒' },
      { id: 'beach-getaways', name: 'Beach Getaways', emoji: '🏖️' },
      { id: 'bike-tours', name: 'Bike Tours', emoji: '🚴' },
      { id: 'camping', name: 'Camping Trips', emoji: '⛺' },
      { id: 'cave-exploration', name: 'Cave Exploration', emoji: '🕳️' },
      { id: 'cruise-meetups', name: 'Cruise Meetups', emoji: '⛴️' },
      { id: 'desert-adventures', name: 'Desert Adventures', emoji: '🏜️' },
      { id: 'diving-expeditions', name: 'Diving Expeditions', emoji: '🤿' },
      { id: 'glacier-hikes', name: 'Glacier Hikes', emoji: '⛏️' },
      { id: 'group-travel', name: 'Group Travel', emoji: '✈️' },
      { id: 'hiking-expeditions', name: 'Hiking Expeditions', emoji: '🥾' },
      { id: 'hot-air-balloon', name: 'Hot Air Balloon Rides', emoji: '🎈' },
      { id: 'international-travel', name: 'International Travel', emoji: '🌍' },
      { id: 'island-getaways', name: 'Island Getaways', emoji: '🏝️' },
      { id: 'mountain-climbing', name: 'Mountain Climbing', emoji: '⛰️' },
      { id: 'paragliding', name: 'Paragliding', emoji: '🪂' },
      { id: 'safari-tours', name: 'Safari Tours', emoji: '🦁' },
      { id: 'skydiving', name: 'Skydiving', emoji: '🪂' },
      { id: 'weekend-getaways', name: 'Weekend Getaways', emoji: '🏨' }
    ]
  },

  // SPIRITUAL & FAITH (18 CATEGORIES)
  spiritual: {
    icon: '⛪',
    name: 'Spiritual & Faith',
    color: '#8b5cf6',
    subcategories: [
      { id: 'baptisms', name: 'Baptisms', emoji: '✝️' },
      { id: 'bible-studies', name: 'Bible Studies', emoji: '📖' },
      { id: 'blessing-ceremonies', name: 'Blessing Ceremonies', emoji: '🙏' },
      { id: 'church-services', name: 'Church Services', emoji: '⛪' },
      { id: 'clergy-meetings', name: 'Clergy Meetings', emoji: '👨‍⌨️' },
      { id: 'confirmation', name: 'Confirmation Ceremonies', emoji: '✝️' },
      { id: 'faith-conferences', name: 'Faith Conferences', emoji: '🙏' },
      { id: 'faith-healing', name: 'Faith Healing', emoji: '✨' },
      { id: 'funerals', name: 'Funerals', emoji: '🕯️' },
      { id: 'interfaith', name: 'Interfaith Dialogues', emoji: '🤝' },
      { id: 'meditation-retreats', name: 'Meditation Retreats', emoji: '🧘' },
      { id: 'mosque', name: 'Mosque Gatherings', emoji: '🕌' },
      { id: 'prayer-meetings', name: 'Prayer Meetings', emoji: '🙏' },
      { id: 'retreats', name: 'Retreats', emoji: '✡️' },
      { id: 'revival', name: 'Revival Meetings', emoji: '🔥' },
      { id: 'spiritual-workshops', name: 'Spiritual Workshops', emoji: '🌟' },
      { id: 'temple', name: 'Temple Ceremonies', emoji: '🛕' },
      { id: 'weddings', name: 'Wedding Ceremonies', emoji: '💍' }
    ]
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// EVENT TYPE/FORMAT (20 FORMATS)
// ═══════════════════════════════════════════════════════════════════════════

export const EVENT_FORMATS = [
  { id: 'in-person', name: 'In-Person Event', emoji: '📍', icon: 'location' },
  { id: 'virtual', name: 'Virtual/Online Event', emoji: '🖥️', icon: 'video' },
  { id: 'hybrid', name: 'Hybrid Event', emoji: '🔗', icon: 'link' },
  { id: 'outdoor', name: 'Outdoor Event', emoji: '🏕️', icon: 'outdoor' },
  { id: 'indoor', name: 'Indoor Event', emoji: '🏢', icon: 'indoor' },
  { id: 'single-session', name: 'Single Session', emoji: '⏱️', icon: 'clock' },
  { id: 'multi-session', name: 'Multi-Session', emoji: '📅', icon: 'calendar' },
  { id: 'recurring', name: 'Recurring Event', emoji: '🔄', icon: 'refresh' },
  { id: 'one-time', name: 'One-Time Event', emoji: '✓', icon: 'check' },
  { id: 'invite-only', name: 'Invite-Only Event', emoji: '🔒', icon: 'lock' },
  { id: 'public', name: 'Public Event', emoji: '👁️', icon: 'eye' },
  { id: 'private', name: 'Private Event', emoji: '🔐', icon: 'shield' },
  { id: 'corporate', name: 'Corporate Event', emoji: '💼', icon: 'briefcase' },
  { id: 'casual', name: 'Casual Event', emoji: '😊', icon: 'smile' },
  { id: 'formal', name: 'Formal Event', emoji: '🎩', icon: 'hat' },
  { id: 'international', name: 'International Event', emoji: '🌍', icon: 'globe' },
  { id: 'large-scale', name: 'Large-Scale (1000+ people)', emoji: '📍', icon: 'people' },
  { id: 'medium-scale', name: 'Medium (100-1000 people)', emoji: '👥', icon: 'users' },
  { id: 'small-scale', name: 'Small/Intimate (<100 people)', emoji: '👫', icon: 'couple' },
  { id: 'multi-day', name: 'Multi-Day Event', emoji: '📆', icon: 'calendar' }
];

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get all categories with subcategories
 */
export const getAllCategories = () => {
  return EXPANDED_CATEGORIES;
};

/**
 * Get total count of categories
 */
export const getTotalCategoryCount = () => {
  let total = 0;
  Object.values(EXPANDED_CATEGORIES).forEach(group => {
    total += group.subcategories.length;
  });
  return total;
};

/**
 * Get category by ID
 */
export const getCategoryById = (categoryId) => {
  for (const groupKey in EXPANDED_CATEGORIES) {
    const group = EXPANDED_CATEGORIES[groupKey];
    const found = group.subcategories.find(cat => cat.id === categoryId);
    if (found) {
      return { ...found, groupKey, groupName: group.name };
    }
  }
  return null;
};

/**
 * Search categories
 */
export const searchCategories = (query) => {
  const results = [];
  const lowerQuery = query.toLowerCase();

  Object.entries(EXPANDED_CATEGORIES).forEach(([key, group]) => {
    group.subcategories.forEach(cat => {
      if (cat.name.toLowerCase().includes(lowerQuery) ||
          cat.id.toLowerCase().includes(lowerQuery)) {
        results.push({ ...cat, groupKey: key, groupName: group.name });
      }
    });
  });

  return results;
};

/**
 * Get categories by group
 */
export const getCategoriesByGroup = (groupKey) => {
  return EXPANDED_CATEGORIES[groupKey]?.subcategories || [];
};

export const CATEGORY_STATS = {
  totalMajorGroups: Object.keys(EXPANDED_CATEGORIES).length,
  totalSubcategories: getTotalCategoryCount(),
  eventFormats: EVENT_FORMATS.length,
  breakdown: {
    corporate: EXPANDED_CATEGORIES.corporate.subcategories.length,
    education: EXPANDED_CATEGORIES.education.subcategories.length,
    wellness: EXPANDED_CATEGORIES.wellness.subcategories.length,
    entertainment: EXPANDED_CATEGORIES.entertainment.subcategories.length,
    food: EXPANDED_CATEGORIES.food.subcategories.length,
    sports: EXPANDED_CATEGORIES.sports.subcategories.length,
    social: EXPANDED_CATEGORIES.social.subcategories.length,
    community: EXPANDED_CATEGORIES.community.subcategories.length,
    arts: EXPANDED_CATEGORIES.arts.subcategories.length,
    technology: EXPANDED_CATEGORIES.technology.subcategories.length,
    travel: EXPANDED_CATEGORIES.travel.subcategories.length,
    spiritual: EXPANDED_CATEGORIES.spiritual.subcategories.length
  }
};

export default {
  EXPANDED_CATEGORIES,
  EVENT_FORMATS,
  CATEGORY_STATS,
  getAllCategories,
  getTotalCategoryCount,
  getCategoryById,
  searchCategories,
  getCategoriesByGroup
};
