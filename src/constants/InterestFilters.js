// ─────────────────────────────────────────────────────────────────────────────
//  INTEREST & DEMOGRAPHIC FILTERS — 500+ options across 20+ categories
//  Used for: event targeting, vibe matching, profile interests
// ─────────────────────────────────────────────────────────────────────────────

export const FILTER_CATEGORIES = [
  {
    key: 'music',
    label: 'Music',
    icon: '🎵',
    filters: [
      'Amapiano', 'Afrobeats', 'Hip-Hop', 'Kwaito', 'Gqom', 'House Music',
      'Deep House', 'Afro House', 'Tech House', 'Techno', 'Drum & Bass',
      'Jungle', 'R&B', 'Soul', 'Neo-Soul', 'Jazz', 'Afro-Jazz', 'Blues',
      'Gospel', 'Maskandi', 'Isicathamiya', 'Mbube', 'Traditional African',
      'Reggae', 'Dancehall', 'Reggaeton', 'Soca', 'Calypso', 'Bongo Flava',
      'Afropop', 'Highlife', 'Fuji', 'Jùjú', 'Afrorock', 'Punk', 'Metal',
      'Rock', 'Alternative', 'Indie', 'Pop', 'K-Pop', 'J-Pop', 'Classical',
      'Opera', 'Electronic', 'Ambient', 'Lo-fi', 'Trap', 'Drill', 'Rap',
      'Old School Hip-Hop', 'Conscious Hip-Hop', 'Spoken Word', 'Poetry Slam',
      'Country', 'Folk', 'Bluegrass', 'Latin', 'Salsa', 'Bachata', 'Merengue',
    ],
  },
  {
    key: 'lifestyle',
    label: 'Lifestyle',
    icon: '✨',
    filters: [
      'Nightlife', 'Day Parties', 'Braai Culture', 'Road Trips', 'Car Meets',
      'Sneaker Culture', 'Streetwear', 'High Fashion', 'Vintage Fashion',
      'Thrift Shopping', 'DIY / Crafting', 'Home Decor', 'Interior Design',
      'Gardening', 'Farming / Agriculture', 'Homesteading', 'Zero Waste Living',
      'Vegan Lifestyle', 'Vegetarian', 'Organic Living', 'Minimalism',
      'Digital Nomad', 'Van Life', 'Glamping', 'Camping', 'Hiking',
      'Beach Life', 'Mountain Life', 'City Life', 'Suburban Living',
      'Township Life', 'Rural Living', 'Farm Life',
      'Entrepreneurship', 'Side Hustle', 'Investing', 'Crypto', 'NFTs',
      'Forex Trading', 'Stocks', 'Real Estate Investment', 'Passive Income',
      'Volunteering', 'Community Building', 'Activism', 'Social Justice',
    ],
  },
  {
    key: 'food_drink',
    label: 'Food & Drink',
    icon: '🍽️',
    filters: [
      'Braai / BBQ', 'Shisanyama', 'Kota', 'Pap & Vleis', 'Chakalaka',
      'Boerewors', 'Biltong & Droëwors', 'Mogodu', 'Smiley', 'Marogo',
      'Umngqusho', 'Bunny Chow', 'Gatsby', 'Peri-Peri', 'Kotas',
      'Street Food', 'Fine Dining', 'Sushi', 'Ramen', 'Pizza',
      'Burgers', 'Wings', 'Seafood', 'Vegan Food', 'Vegetarian Food',
      'Halaal Food', 'Kosher Food', 'Nigerian Cuisine', 'Ghanaian Cuisine',
      'Ethiopian Cuisine', 'Mozambican Cuisine', 'Indian Cuisine', 'Chinese Food',
      'Japanese Food', 'Italian Food', 'Mexican Food',
      'Coffee Culture', 'Tea', 'Craft Beer', 'Wine', 'Whiskey', 'Cocktails',
      'Mocktails', 'Soft Drinks', 'Energy Drinks', 'Smoothies', 'Juice',
      'Baking', 'Cooking', 'Food Blogging', 'Food Photography',
    ],
  },
  {
    key: 'sports_fitness',
    label: 'Sports & Fitness',
    icon: '⚽',
    filters: [
      'Soccer / Football', 'Rugby', 'Cricket', 'Basketball', 'Netball',
      'Volleyball', 'Tennis', 'Squash', 'Badminton', 'Table Tennis',
      'Boxing', 'MMA / UFC', 'Wrestling', 'Judo', 'Karate', 'Taekwondo',
      'Kickboxing', 'Muay Thai', 'Brazilian Jiu-Jitsu', 'Gymnastics',
      'Swimming', 'Water Polo', 'Surfing', 'Kitesurfing', 'Wakeboarding',
      'Golf', 'Athletics / Track & Field', 'Marathon Running', 'Trail Running',
      'Cycling', 'Mountain Biking', 'BMX', 'Skateboarding', 'Rollerblading',
      'Rock Climbing', 'Indoor Climbing', 'Parkour / Freerunning',
      'CrossFit', 'Gym / Weight Training', 'Calisthenics', 'Yoga', 'Pilates',
      'Zumba', 'Aerobics', 'Dance Fitness', 'Spin Class', 'Boot Camp',
      'Esports / Gaming Tournaments', 'Chess', 'Darts', 'Snooker / Pool',
    ],
  },
  {
    key: 'arts_culture',
    label: 'Arts & Culture',
    icon: '🎨',
    filters: [
      'Visual Art', 'Painting', 'Sculpture', 'Photography', 'Street Art / Graffiti',
      'Digital Art', 'Illustration', 'Animation', 'Graphic Design', 'UI/UX Design',
      'Interior Design', 'Architecture', 'Fashion Design', 'Jewellery Making',
      'Textile Art', 'Pottery / Ceramics', 'Woodworking', 'Leatherwork',
      'Theatre / Drama', 'Stand-Up Comedy', 'Improv Comedy', 'Spoken Word',
      'Poetry', 'Creative Writing', 'Screenwriting', 'Storytelling',
      'Film & Cinema', 'Documentary Film', 'Short Films', 'Music Videos',
      'Dance', 'Ballet', 'Contemporary Dance', 'Hip-Hop Dance', 'Amapiano Dance',
      'Gumboot Dance', 'Pantsula', 'Traditional Dance', 'Salsa Dancing', 'Ballroom',
      'African Heritage', 'Zulu Culture', 'Xhosa Culture', 'Sotho Culture',
      'Ndebele Culture', 'Venda Culture', 'Tsonga Culture', 'Tswana Culture',
      'Pedi Culture', 'Swazi Culture', 'Nigerian Culture', 'Ghanaian Culture',
      'History', 'Museums & Galleries', 'Heritage Sites',
    ],
  },
  {
    key: 'tech_digital',
    label: 'Tech & Digital',
    icon: '💻',
    filters: [
      'Software Development', 'Web Development', 'Mobile App Development',
      'Artificial Intelligence', 'Machine Learning', 'Data Science', 'Data Analytics',
      'Cybersecurity', 'Blockchain / Web3', 'Cryptocurrency', 'NFTs',
      'Cloud Computing', 'DevOps', 'Game Development', 'AR / VR',
      'Robotics', 'IoT (Internet of Things)', 'Hardware / Electronics',
      'Open Source', 'Linux', 'Python', 'JavaScript', 'React Native',
      'Startups', 'Tech Entrepreneurship', 'Product Management', 'UX Research',
      'Digital Marketing', 'SEO / SEM', 'Content Creation', 'Podcasting',
      'YouTube / Video', 'Streaming', 'Social Media', 'Influencer Marketing',
      'Gaming', 'PC Gaming', 'Console Gaming', 'Mobile Gaming', 'Retro Gaming',
      'VR Gaming', 'Esports',
    ],
  },
  {
    key: 'vehicles',
    label: 'Vehicles & Cars',
    icon: '🚗',
    filters: [
      'BMW', 'Mercedes-Benz', 'Audi', 'Volkswagen', 'Toyota', 'Honda',
      'Ford', 'Chevrolet', 'Nissan', 'Hyundai', 'Kia', 'Mazda',
      'Lexus', 'Porsche', 'Ferrari', 'Lamborghini', 'Bentley', 'Rolls-Royce',
      'Range Rover / Land Rover', 'Jeep', 'American Muscle Cars',
      'Japanese Imports (JDM)', 'German Cars', 'Italian Supercars',
      'Electric Vehicles (EV)', 'Hybrid Cars', 'Vintage / Classic Cars',
      'Lowriders', 'Modified Cars', 'Street Racing', 'Track Days',
      'Motorcycles', 'Harley-Davidson', 'Sports Bikes', 'Dirt Bikes',
      'Bakkies / Trucks', 'Luxury SUVs', 'Off-Road Vehicles',
      'Mini Buses / Taxis', 'Car Audio / Sound Systems', 'Rim / Wheel Culture',
    ],
  },
  {
    key: 'fashion_style',
    label: 'Fashion & Style',
    icon: '👗',
    filters: [
      'Streetwear', 'Sneakerhead', 'High Fashion / Luxury', 'Thrift / Vintage',
      'Boho / Hippie', 'Smart Casual', 'Business Formal', 'Athleisure',
      'Afrocentric / African Print', 'Traditional Attire', 'Dashiki',
      'Ankara Print', 'Shweshwe', 'Zulu Beadwork', 'Ndebele Print',
      'Urban Fashion', 'Hip-Hop Fashion', 'Rave / Festival Wear', 'Cosplay',
      'Sustainability / Eco Fashion', 'Unisex / Gender-Neutral Fashion',
      'Plus-Size Fashion', 'Jordan Brand', 'Nike', 'Adidas', 'Puma', 'New Balance',
      'Balenciaga', 'Gucci', 'Louis Vuitton', 'Versace', 'Off-White',
      'Local SA Brands', 'Emerge Brands', 'Sneakers Under R1000',
    ],
  },
  {
    key: 'demographics',
    label: 'Demographics',
    icon: '👥',
    filters: [
      // Age ranges
      'Under 18', '18-24', '25-30', '31-35', '36-40', '41-50', '50+',
      // Gender expression
      'Men', 'Women', 'Non-Binary', 'Gender Fluid', 'Transgender', 'All Genders',
      // Relationship status
      'Single', 'In a Relationship', 'Married', 'Divorced / Separated', 'Widowed', 'Open Relationship',
      // Parental status
      'Parent', 'No Children', 'Single Parent', 'Expecting',
      // Education
      'Still Schooling', 'Matric', 'Diploma', 'Degree Holder', 'Honours / Masters', 'PhD',
      // Employment
      'Employed', 'Self-Employed / Business Owner', 'Freelancer', 'Student', 'Looking for Work', 'Retired',
      // Income range (broad)
      'Entry Income (Under R5K)', 'Mid Income (R5K–R20K)', 'Upper Mid (R20K–R50K)', 'High Income (R50K+)',
    ],
  },
  {
    key: 'physical',
    label: 'Physical Attributes',
    icon: '🧬',
    filters: [
      // Body type
      'Slim / Lean', 'Athletic / Toned', 'Average Build', 'Curvy / Full-figured', 'Muscular', 'Plus Size', 'Petite',
      // Height
      'Short (Under 160cm)', 'Average Height (160-175cm)', 'Tall (175-190cm)', 'Very Tall (190cm+)',
      // Hair type
      'Natural Hair', 'Loc\'s / Dreadlocks', 'Braids', 'Cornrows', 'Afro', 'Relaxed Hair',
      'Short Hair', 'Long Hair', 'Bald / Shaved', 'Fade Haircut', 'Twisted', 'Coloured Hair',
      // Skin tone (broad)
      'Light Skin', 'Medium / Brown Skin', 'Dark Skin', 'Melanin Rich', 'Fair Skin',
      // Facial features
      'Beard / Facial Hair', 'Clean Shaven', 'Moustache',
      // Eye colour
      'Brown Eyes', 'Black Eyes', 'Hazel Eyes', 'Green Eyes', 'Blue Eyes', 'Grey Eyes',
      // Tattoos & piercings
      'Has Tattoos', 'No Tattoos', 'Has Piercings', 'Multiple Piercings',
      // Blood type (as requested)
      'Blood Type A+', 'Blood Type A-', 'Blood Type B+', 'Blood Type B-',
      'Blood Type O+', 'Blood Type O-', 'Blood Type AB+', 'Blood Type AB-',
    ],
  },
  {
    key: 'housing',
    label: 'Housing & Property',
    icon: '🏠',
    filters: [
      'Owns a House', 'Renting', 'Staying with Family', 'In a Commune / Shared House',
      'Student Accommodation', 'RDP / Government Housing', 'Townhouse', 'Apartment / Flat',
      'Luxury Property', 'Tiled Home', 'Furnished Home', 'Rural Home', 'Farm Property',
      'Has a Yard / Garden', 'Has a Pool', 'Has a Home Studio', 'Has a Home Gym',
      'Planning to Buy Property', 'Real Estate Investor', 'Airbnb Host',
    ],
  },
  {
    key: 'religion_spirituality',
    label: 'Religion & Spirituality',
    icon: '🙏',
    filters: [
      'Christian', 'Catholic', 'Protestant', 'Pentecostal', 'Charismatic',
      'Seventh-Day Adventist', 'Zionist Christian Church (ZCC)', 'Apostolic',
      'Anglican', 'Methodist', 'Lutheran', 'Baptist', 'Evangelical',
      'Muslim', 'Islamic Faith', 'Hindu', 'Jewish', 'Buddhist', 'Sikh',
      'Traditional African Religion', 'Sangoma / Inyanga', 'Animism',
      'Rastafari', 'Agnostic', 'Atheist', 'Spiritual but not Religious',
      'Explores Multiple Faiths',
    ],
  },
  {
    key: 'relationships_social',
    label: 'Social & Relationship Style',
    icon: '❤️',
    filters: [
      'Extrovert', 'Introvert', 'Ambivert', 'Social Butterfly', 'Homebody',
      'Party Person', 'Casual Dater', 'Serious Relationship Seeker', 'Friends First',
      'Networking First', 'Business Connections', 'Creative Collaborations',
      'Mentoring / Being Mentored', 'Community Leader', 'Content Collaborator',
      'Fitness Partner', 'Travel Buddy', 'Study Partner', 'Accountability Partner',
    ],
  },
  {
    key: 'entertainment',
    label: 'Entertainment',
    icon: '🎬',
    filters: [
      'Movies', 'Anime', 'K-Drama', 'Netflix Series', 'Reality TV', 'Telenovelas',
      'Sports TV', 'News / Current Affairs', 'Documentaries', 'True Crime',
      'Comedy Shows', 'Drama Series', 'Sci-Fi / Fantasy', 'Horror', 'Thriller',
      'Animation / Cartoons', 'YouTube Content', 'TikTok Culture', 'Instagram Live',
      'Podcasts', 'Audiobooks', 'Books / Reading', 'Comics / Manga', 'Fan Fiction',
      'Theatre / Stage Plays', 'Musical Theatre', 'Stand-Up Comedy',
    ],
  },
  {
    key: 'travel',
    label: 'Travel',
    icon: '✈️',
    filters: [
      'Local SA Travel', 'Cross-Border (Southern Africa)', 'Pan-African Travel',
      'Dubai / Middle East', 'Europe Travel', 'USA / North America', 'Asia Travel',
      'Caribbean Travel', 'Cruise Ships', 'Budget Travel / Backpacking',
      'Luxury Travel', 'Business Travel', 'Road Trips', 'Camping & Nature',
      'Beach Holidays', 'Mountain / Hiking Holidays', 'City Breaks',
      'Heritage Travel', 'Food Tourism', 'Music Festival Travel',
    ],
  },
  {
    key: 'language',
    label: 'Language',
    icon: '🗣️',
    filters: [
      'isiZulu', 'isiXhosa', 'Sesotho', 'Setswana', 'Sepedi (Northern Sotho)',
      'Tshivenda', 'Xitsonga', 'siSwati', 'isiNdebele', 'Afrikaans',
      'English', 'Shona', 'Ndebele (Zimbabwe)', 'Chewa', 'Swahili',
      'Yoruba', 'Igbo', 'Hausa', 'French', 'Portuguese', 'Arabic',
      'Hindi', 'Urdu', 'Mandarin', 'Spanish',
      'Multilingual (3+ languages)', 'Sign Language',
    ],
  },
  {
    key: 'politics_values',
    label: 'Values & Mindset',
    icon: '⚖️',
    filters: [
      'Pan-Africanism', 'Black Consciousness', 'Ubuntu Philosophy',
      'Feminism / Gender Equality', 'LGBTQ+ Ally', 'LGBTQ+ Community',
      'Social Entrepreneurship', 'Environmentalism', 'Climate Activism',
      'Youth Development', 'Community Upliftment', 'Education Advocacy',
      'Economic Empowerment', 'Decolonisation', 'Mental Health Awareness',
      'Anti-Racism', 'Human Rights', 'Politics & Governance', 'Civic Engagement',
      'Free Markets', 'Socialism / Economic Justice',
    ],
  },
  {
    key: 'hobbies',
    label: 'Hobbies & Interests',
    icon: '🎲',
    filters: [
      'Photography', 'Videography', 'Drone Flying', 'Fishing', 'Hunting',
      'Bird Watching', 'Stargazing / Astronomy', 'Astronomy',
      'Collecting (Sneakers, Watches, Art)', 'Lego / Collectibles',
      'Board Games', 'Card Games', 'Chess', 'Puzzles',
      'Cooking / Baking', 'Bartending', 'Coffee Brewing', 'Meal Prep',
      'Gardening', 'Plant Care / Botany', 'Aquariums / Fish Keeping',
      'Pet Ownership', 'Dog Training', 'Cat Person', 'Horse Riding',
      'Knitting / Crochet', 'Embroidery', 'Sewing', 'Macramé',
      'Calligraphy / Lettering', 'Journalling', 'Bullet Journalling',
      'Reading', 'Writing', 'Blogging', 'Podcasting',
      'Volunteering', 'Charity Work', 'Youth Work / Mentoring',
    ],
  },
  {
    key: 'health_wellness',
    label: 'Health & Wellness',
    icon: '🧘',
    filters: [
      'Gym Lifestyle', 'Outdoor Fitness', 'Running', 'Cycling', 'Swimming',
      'Yoga', 'Meditation', 'Mindfulness', 'Breathwork', 'Cold Therapy',
      'Plant-Based Eating', 'Intermittent Fasting', 'Keto Diet', 'Paleo Diet',
      'Mental Health Focus', 'Therapy / Counselling', 'Life Coaching',
      'Sobriety / Sober Curious', 'Addiction Recovery',
      'Alternative Medicine', 'Traditional Healing', 'Acupuncture', 'Homeopathy',
      'Skincare', 'Natural Hair Care', 'Body Positivity', 'Self-Care',
      'Sleep Optimisation', 'Biohacking', 'Supplements & Nutrition',
    ],
  },
  {
    key: 'professional',
    label: 'Career & Industry',
    icon: '💼',
    filters: [
      'Healthcare / Medical', 'Nursing', 'Teaching / Education', 'Social Work',
      'Law / Legal', 'Accounting / Finance', 'Banking', 'Insurance',
      'Engineering', 'Mining / Resources', 'Construction', 'Architecture',
      'IT / Software', 'Telecommunications', 'Media & Journalism', 'Marketing',
      'PR / Communications', 'Hospitality / Tourism', 'Retail / Sales',
      'Real Estate', 'Agricultural / Farming', 'Manufacturing',
      'Transport / Logistics', 'Security Industry', 'Government / Public Service',
      'Non-Profit / NGO', 'Arts / Creative Industries', 'Sports Industry',
      'Entrepreneurship', 'Freelance / Gig Work', 'Student',
    ],
  },
];

// ── Flat list of all filter labels ───────────────────────────────────────────
export const ALL_FILTERS = FILTER_CATEGORIES.flatMap(cat =>
  cat.filters.map(f => ({ label: f, category: cat.key, categoryLabel: cat.label, icon: cat.icon }))
);

// ── Search across all filters ─────────────────────────────────────────────────
export const searchFilters = (query, limit = 30) => {
  if (!query?.trim()) return [];
  const q = query.toLowerCase().trim();
  return ALL_FILTERS.filter(f => f.label.toLowerCase().includes(q)).slice(0, limit);
};

export const FILTER_COUNT = ALL_FILTERS.length;
