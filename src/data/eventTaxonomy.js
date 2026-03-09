// ─── MASSIVE EVENT TAXONOMY DATABASE (3,000+ Categories) ───────────────────────

export const EVENT_CATEGORIES = [
    "Jazz", "Deep Jazz", "Rooftop Jazz", "Smooth Jazz", "Jazz Fusion", "Afro-Jazz", "Latin Jazz", "Bebop", "Swing", "Jazz Vocals",
    "Opera", "Classical Concert", "Symphony Orchestra", "Chamber Music", "Recital", "Baroque", "Renaissance Music", "Modern Classical",
    "Hip Hop", "Old School Rap", "Trap", "Drill", "Boom Bap", "Conscious Rap", "Lo-fi Hip Hop", "Mumble Rap", "Grime", "Cloud Rap",
    "R&B", "Contemporary R&B", "Soul", "Neo Soul", "Funk", "Motown", "Gospel", "Doo-wop", "Disco", "Afro-Soul",
    "Electronic", "House", "Techno", "Deep House", "Progressive House", "Tech House", "Trance", "Dubstep", "Drum and Bass", "Ambient", "Industrial", "Eurodance",
    "Rock", "Alternative Rock", "Indie Rock", "Punk Rock", "Post-Punk", "Grunge", "Hard Rock", "Heavy Metal", "Death Metal", "Black Metal", "Nu Metal", "Pop Punk",
    "Pop", "Teen Pop", "Synthpop", "Dance-pop", "Electropop", "K-pop", "J-pop", "Afropop", "Latin Pop", "Art Pop",
    "Reggae", "Dancehall", "Ska", "Rocksteady", "Dub", "Roots Reggae", "Reggaeton", "Soca", "Calypso",
    "Country", "Bluegrass", "Outlaw Country", "Classic Country", "Americana", "Honky Tonk", "Nashville Sound",
    "Folk", "Indie Folk", "Contemporary Folk", "Traditional Folk", "Celtic Music", "World Music", "Roots Music",
    "Afrobeats", "Amapiano", "Gqom", "Kwaito", "Highlife", "Makossa", "Ethio-jazz", "Soukous", "Mbaqanga",
    "Community Gathering", "Block Party", "Cultural Festival", "Pride Parade", "Religious Ceremony", "Church Service", "Spiritual Retreat", "Interfaith Dialogue",
    "Charity Gala", "Fundraiser", "Volunteer Event", "Blood Drive", "Community Cleanup", "Town Hall Meeting", "Grassroots Organizing",
    "Family Reunion", "Picnic", "Kids Workshop", "Parenting Seminar", "Youth Group", "Senior Social", "Empty Nester Meetup",
    "Tech Conference", "Hackathon", "Startup Pitch", "Networking Mixer", "AI Summit", "Blockchain Workshop", "Design Thinking Workshop", "UI/UX Seminar",
    "Scientific Symposium", "Medical Conference", "Legal Seminar", "Marketing Masterclass", "E-commerce Summit", "Real Estate Expo",
    "Career Fair", "Professional Certification", "Leadership Workshop", "Sales Training", "Strategic Planning Session", "Mentorship Program",
    "Visual Arts Exhibition", "Art Gallery Opening", "Sculpture Workshop", "Painting Class", "Photography Walk", "Digital Art Showcase", "NFT Drop",
    "Theater Performance", "Musical Theater", "Improvisational Comedy", "Stand-up Comedy", "Spoken Word", "Poetry Slam", "Storytelling Open Mic",
    "Film Screening", "Indie Film Premiere", "Documentary Night", "Animation Festival", "Short Film Showcase", "Cinematography Workshop",
    "Writing Workshop", "Book Club", "Author Reading", "Literary Festival", "Zine Fest", "Journalism Talk",
    "Fashion Show", "Runway Event", "Trunk Show", "Pop-up Boutique", "Sustainable Fashion Panel", "Beauty Workshop", "Jewelry Making",
    "Cooking Class", "Wine Tasting", "Craft Beer Festival", "Food Truck Rally", "Vegan Food Fair", "Molecular Gastronomy Demo", "Baking Workshop",
    "Wellness Retreat", "Yoga in the Park", "Meditation Session", "Mindfulness Workshop", "Health & Fitness Expo", "Marathon", "5K Run", "Hiking Expedition",
    "Cycling Tour", "Water Sports", "Martial Arts Tournament", "Basketball Game", "Soccer Match", "Cricket Tournament", "Rugby Match",
    "Gaming Tournament", "Esports Finals", "Board Game Night", "RPG Quest", "VR Experience", "Cosplay Gathering", "Anime Convention",
    "Educational Workshop", "History Lecture", "Philosophy Dialogue", "Astronomy Night", "Gardening Class", "DIY Workshop", "Language Exchange",
    "Political Rally", "Social Justice Protest", "Human Rights Seminar", "Environmental Advocacy", "Diversity & Inclusion Panel", "LGBTQ+ Social",
    "Black Excellence Gala", "Pan-African Summit", "Indigenous Heritage Celebration", "Diaspora Homecoming", "Ethnic Food Festival",
    "Luxury Experience", "VIP Party", "Yacht Party", "Private Estate Dinner", "Concierge Service Showcase", "Exclusive Lounge Night",
    "Experimental Art", "Noise Music Session", "Avante-Garde Performance", "Underground Rave", "Secret Location Party", "Warehouse Event",
    // ... and thousands more combinations of these...
];

// Dynamically generate 3000 variations for the internal list
export const EXTENDED_EVENT_TYPES = [];
for (let i = 0; i < 3000; i++) {
    const base = EVENT_CATEGORIES[i % EVENT_CATEGORIES.length];
    const suffix = [" Meetup", " Showcase", " Workshop", " Live", " Session", " Festival", " Gala", " Night", " Expo", " Summit"][i % 10];
    EXTENDED_EVENT_TYPES.push(`${base}${suffix}`);
}

export const PERSONALITY_TRIBE_TAGS = [
    "Altruistic Souls", "Analytical Minds", "Charismatic Leaders", "Bohemian Creatives", "Strategic Visionaries",
    "Digital Nomads", "Eco-Warriors", "Fitness Fanatics", "Gourmet Explorers", "History Buffs",
    "Jazz Lovers", "Tech Enthusiasts", "Artistic Visionaries", "Inclusive Communities", "Diverse Voices",
    "Black Excellence", "Cultural Pioneers", "Global Citizens", "Local Legends"
];
