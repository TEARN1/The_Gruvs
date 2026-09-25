/**
 * Generator script to create the Global Events Catalog and SQL Seeder
 * Covering 29 high-priority categories across 6 months (Sept/Oct 2026 - Feb 2027)
 * ~725 rich, realistic global events across London, NYC, Tokyo, Berlin, Paris, Lagos, Cape Town, etc.
 */

const fs = require('fs');
const path = require('path');

const CATEGORIES = [
  { key: 'rave', label: 'Warehouse Rave', group: 'Nightlife', tag: ['techno', 'rave', 'electronic', 'underground'], basePrice: 28, venues: [
    { name: 'Printworks Redux / Drumsheds', city: 'London', address: '6 Glover Dr, London N18 3HF' },
    { name: 'The Brooklyn Mirage / Avant Gardner', city: 'New York', address: '140 Stewart Ave, Brooklyn, NY 11237' },
    { name: 'Kraftwerk Berlin', city: 'Berlin', address: 'Köpenicker Str. 70, 10179 Berlin' },
    { name: 'Womb Tokyo', city: 'Tokyo', address: '2-16 Maruyamacho, Shibuya, Tokyo' },
    { name: 'Gashouder', city: 'Amsterdam', address: 'Klönneplein 1, 1014 DD Amsterdam' },
    { name: 'The Old Biscuit Mill Warehouse', city: 'Cape Town', address: '375 Albert Rd, Woodstock, Cape Town' },
    { name: 'D-Edge Club & Warehouse', city: 'São Paulo', address: 'Av. Olavo Bilac, 987 - Barra Funda, São Paulo' },
  ], titles: [
    'Sub-Frequency: Deep Industrial Techno Marathon',
    'Warehouse Protocol: 12-Hour Audio Experience',
    'Modular Horizons: Live Hardware Techno & Visuals',
    'Obsidian Pulse: Heavy Bass & Berlin Minimal Night',
    'Darkroom Sessions: European Underground Showcase'
  ], images: [
    'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1545128485-c400e7702796?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop'
  ]},

  { key: 'amapiano', label: 'Amapiano & Afrobeats', group: 'Music', tag: ['amapiano', 'afrobeats', 'bacardi', 'afrohouse'], basePrice: 25, venues: [
    { name: 'Hard Rock Beachfront / Landmark Beach', city: 'Lagos', address: 'Water Corporation Dr, Oniru, Victoria Island, Lagos' },
    { name: 'Koko Camden', city: 'London', address: '1A Camden High St, London NW1 7JE' },
    { name: 'Zone 6 Venue', city: 'Johannesburg', address: 'Blackchain Shopping Centre, Diepkloof Zone 6, Soweto' },
    { name: 'Alchemist Bar & Grounds', city: 'Nairobi', address: 'Parklands Rd, Nairobi, Kenya' },
    { name: 'Elsewhere Rooftop & Main Hall', city: 'New York', address: '599 Johnson Ave, Brooklyn, NY 11237' },
    { name: 'Cabaret Sauvage', city: 'Paris', address: '59 Bd Macdonald, 75019 Paris' },
    { name: 'The Grand Africa Cafe & Beach', city: 'Cape Town', address: '1 Haul Rd, V&A Waterfront, Cape Town' },
  ], titles: [
    'Piano To The World: Private School Amapiano & Log Drum Odyssey',
    'Afro-Vibration: Afrobeats, Highlife & Tropical Rhythm Night',
    'Soweto To Shoreditch: The Amapiano Sundowner Sessions',
    'Lagos Night Shift: Neo-Afrobeats & Live Percussion',
    'Bacardi & Basslines: Open-Air Amapiano Carnival'
  ], images: [
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?q=80&w=1200&auto=format&fit=crop'
  ]},

  { key: 'rooftop', label: 'Rooftop Sundowner', group: 'Nightlife', tag: ['rooftop', 'sunset', 'cocktails', 'deep-house'], basePrice: 20, venues: [
    { name: 'Skylight Tobacco Dock', city: 'London', address: 'Pennington St Car Park, London E1W 2SF' },
    { name: '230 Fifth Rooftop', city: 'New York', address: '230 5th Ave, New York, NY 10001' },
    { name: 'Klunkerkranich', city: 'Berlin', address: 'Karl-Marx-Str. 66, 12043 Berlin' },
    { name: 'The Silo Rooftop', city: 'Cape Town', address: 'Silo Square, V&A Waterfront, Cape Town' },
    { name: 'CE LA VI Rooftop', city: 'Tokyo', address: '1-2-3 Dogenzaka, Shibuya, Tokyo' },
    { name: 'Le Perchoir Menilmontant', city: 'Paris', address: '14 Rue Crespin du Gast, 75011 Paris' },
    { name: 'Level 43 Skyterrace', city: 'Dubai', address: 'Four Points by Sheraton, Sheikh Zayed Rd, Dubai' }
  ], titles: [
    'Golden Hour Skyline: Deep House & Sunset Spritz',
    'Cloud Nine: Panorama Sundowner & Afro-House Grooves',
    'Skyline Echoes: Ambient Melodic House & Mezcal Tasting',
    'Sunset Sessions: High-Rise Electronic Lounge & Chill',
    'Twilight Over The City: Champagne & Organic Beats'
  ], images: [
    'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1200&auto=format&fit=crop'
  ]},

  { key: 'hiphop', label: 'Hip-Hop & R&B', group: 'Music', tag: ['hiphop', 'rnb', '90s', 'trap'], basePrice: 22, venues: [
    { name: 'SOBs (Sounds of Brazil)', city: 'New York', address: '204 Varick St, New York, NY 10014' },
    { name: 'Jazz Cafe Camden', city: 'London', address: '5 Parkway, London NW1 7PG' },
    { name: 'New Morning', city: 'Paris', address: '7-9 Rue des Petites Écuries, 75010 Paris' },
    { name: 'Harlem Nightclub', city: 'Tokyo', address: '2-4 Maruyamacho, Shibuya, Tokyo' },
    { name: 'The Roxy Club', city: 'Los Angeles', address: '9009 Sunset Blvd, West Hollywood, CA 90069' },
    { name: 'Untitled Basement', city: 'Johannesburg', address: '7 Reserve St, Braamfontein, Johannesburg' },
    { name: 'Afro-Urban Lounge', city: 'Lagos', address: 'Adetokunbo Ademola St, Victoria Island, Lagos' }
  ], titles: [
    'Slow Jams & 90s Throwbacks: Ultimate R&B Anthem Night',
    'Golden Era Revival: Classic Boom Bap & Underground Lyricism',
    'Midnight Melodies: Contemporary Neo-Soul & Trapsoul',
    'Turn Up The Bass: 808 Trap & Hype Night',
    'The Vinyl Cipher: Live Freestyle & Turntablism Battle'
  ], images: [
    'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1520523839898-5071282543e1?q=80&w=1200&auto=format&fit=crop'
  ]},

  { key: 'liveband', label: 'Live Band & Soul', group: 'Music', tag: ['livemusic', 'jazz', 'soul', 'indie'], basePrice: 25, venues: [
    { name: 'Ronnie Scott\'s Jazz Club', city: 'London', address: '47 Frith St, London W1D 4HT' },
    { name: 'Blue Note Jazz Club', city: 'New York', address: '131 W 3rd St, New York, NY 10012' },
    { name: 'Duc des Lombards', city: 'Paris', address: '42 Rue des Lombards, 75001 Paris' },
    { name: 'Cotton Club Tokyo', city: 'Tokyo', address: 'Tokyo Building 2F, 2-7-3 Marunouchi, Chiyoda, Tokyo' },
    { name: 'A-Trane Jazz Club', city: 'Berlin', address: 'Bleibtreustraße 1, 10623 Berlin' },
    { name: 'The Piano Bar', city: 'Cape Town', address: '47 Napier St, De Waterkant, Cape Town' },
    { name: 'Terra Kulture Concert Hall', city: 'Lagos', address: 'Plot 1376 Tiamiyu Savage St, Victoria Island, Lagos' }
  ], titles: [
    'Nu-Jazz Explorations: Brass, Funk & Cosmic Improvisation',
    'Unplugged Sessions: Acoustic Soul & Intimate Singer-Songwriters',
    'Afro-Jazz & Brass Collective Live In Concert',
    'Smoky Night Club: Vintage Blues & Motown Classics',
    'Indie Rock Spectrum: Rising Bands & Raw Stage Energy'
  ], images: [
    'https://images.unsplash.com/photo-1511192336575-5a79af67a629?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1525994886773-080587e161c2?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1442504028989-ab58b5f29a4a?q=80&w=1200&auto=format&fit=crop'
  ]},

  { key: 'festival_music', label: 'Music Festival', group: 'Music', tag: ['festival', 'stages', 'openair', 'headliners'], basePrice: 65, venues: [
    { name: 'Victoria Park Grounds', city: 'London', address: 'Grove Rd, London E3 5TB' },
    { name: 'Randall\'s Island Park', city: 'New York', address: '20 Randalls Island Park, New York, NY 10035' },
    { name: 'Tempelhof Feld', city: 'Berlin', address: 'Tempelhofer Damm, 12101 Berlin' },
    { name: 'Yoyogi Park Outdoor Stage', city: 'Tokyo', address: '2-1 Yoyogikamizonocho, Shibuya, Tokyo' },
    { name: 'Parc de la Villette Open Arena', city: 'Paris', address: '211 Av. Jean Jaurès, 75019 Paris' },
    { name: 'Kirstenbosch Botanical Gardens', city: 'Cape Town', address: 'Rhodes Dr, Newlands, Cape Town' },
    { name: 'Eko Atlantic City Arena', city: 'Lagos', address: 'Ahmadu Bello Way, Victoria Island, Lagos' }
  ], titles: [
    'Global Fusion Fest: 3 Stages of International Sound',
    'Equinox Open Air: 2-Day Art, Sound & Culinary Gathering',
    'City Horizons Music Festival: Electronic, Indie & World Beats',
    'Solaris Festival: Daylight Grooves & Midnight Revelry',
    'Resonance Gathering: Immersive Audio-Visual Experience'
  ], images: [
    'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1506157786151-b8491531f063?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=1200&auto=format&fit=crop'
  ]},

  { key: 'streetfood', label: 'Night Food Market', group: 'Food & Drink', tag: ['streetfood', 'market', 'hawker', 'foodie'], basePrice: 0, venues: [
    { name: 'Seven Dials Market', city: 'London', address: '35 Earlham St, London WC2H 9LD' },
    { name: 'Smorgasburg Williamsburg', city: 'New York', address: '90 Kent Ave, Brooklyn, NY 11249' },
    { name: 'Street Food Thursday / Markthalle Neun', city: 'Berlin', address: 'Eisenbahnstraße 42/43, 10997 Berlin' },
    { name: 'Tsukiji Outer Market Night Courtyard', city: 'Tokyo', address: '4 Chome Tsukiji, Chuo City, Tokyo' },
    { name: 'Ground Culture Market', city: 'Paris', address: '12 Rue de la Roquette, 75011 Paris' },
    { name: 'Mojo Market Sea Point', city: 'Cape Town', address: '30 Regent Rd, Sea Point, Cape Town' },
    { name: 'Muri Okunola Park Food Fair', city: 'Lagos', address: 'Ahmadu Bello Way, Victoria Island, Lagos' }
  ], titles: [
    'Midnight Hawker Festival: 30+ Global Street Chefs',
    'Bao, Tacos & Smoke: Street Food Social & Live DJs',
    'Artisan Night Feast: Craft Bites & Cider Garden',
    'Street Kitchen Carnival: Afro-Caribbean & Latin Flavors',
    'Night Market & Neon Beats: Dumplings to Churros'
  ], images: [
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1540420773420-3366772f4999?q=80&w=1200&auto=format&fit=crop'
  ]},

  { key: 'foodfestival', label: 'Chef Supper Club', group: 'Food & Drink', tag: ['chef', 'supperclub', 'finedining', 'tastingmenu'], basePrice: 55, venues: [
    { name: 'Carousel London', city: 'London', address: '19-23 Charlotte St, London W1T 1RL' },
    { name: 'Mission Chinese Food Pop-up Space', city: 'New York', address: '171 E Broadway, New York, NY 10002' },
    { name: 'Nobelhart & Schmutzig Atelier', city: 'Berlin', address: 'Friedrichstraße 218, 10969 Berlin' },
    { name: 'Secret Garden Greenhouse', city: 'Paris', address: '28 Rue de la Paix, 75002 Paris' },
    { name: 'Pot Luck Club Private Deck', city: 'Cape Town', address: '375 Albert Rd, Woodstock, Cape Town' },
    { name: 'Nok by Alara Courtyard', city: 'Lagos', address: '12a Akin Olugbade St, Victoria Island, Lagos' },
    { name: 'Omakase Lab Shibuya', city: 'Tokyo', address: '1-18-8 Jinnan, Shibuya, Tokyo' }
  ], titles: [
    'Six-Course Omakase & Natural Wine Pairing',
    'Fire & Wood: Argentine Asado Secret Supper',
    'Modern African Gastronomy: 7-Course Culinary Journey',
    'Foraged Flavours: Seasonal Forest-to-Table Tasting',
    'The Chef\'s Table: Intimate Michelin-Trained Showcase'
  ], images: [
    'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1541544741938-0af808871cc0?q=80&w=1200&auto=format&fit=crop'
  ]},

  { key: 'wine_tasting', label: 'Craft Wine & Brew Tasting', group: 'Food & Drink', tag: ['wine', 'craftbeer', 'cocktails', 'sommelier'], basePrice: 35, venues: [
    { name: 'Berry Bros. & Rudd Cellars', city: 'London', address: '3 St James\'s St, London SW1A 1EG' },
    { name: 'Ruffian Wine Bar', city: 'New York', address: '125 E 7th St, New York, NY 10009' },
    { name: 'BRLO Brwhouse', city: 'Berlin', address: 'Schöneberger Str. 16, 10963 Berlin' },
    { name: 'Groot Constantia Wine Estate', city: 'Cape Town', address: 'Groot Constantia Rd, Constantia, Cape Town' },
    { name: 'Le Caveau de la Huchette', city: 'Paris', address: '5 Rue de la Huchette, 75005 Paris' },
    { name: 'Spring Valley Brewery', city: 'Tokyo', address: '13-1 Daikanyamacho, Shibuya, Tokyo' },
    { name: 'The Craft Beer Taproom', city: 'Amsterdam', address: 'Prins Hendrikkade 194, 1011 TD Amsterdam' }
  ], titles: [
    'Natural Wine Discovery: Low-Intervention European Gems',
    'Craft Hop Masterclass: Double IPAs & Barrel-Aged Stouts',
    'Artisanal Mezcal & Tequila Agave Flight Tasting',
    'Old World vs New World: Blind Wine Tasting Challenge',
    'Botanical Gin & Speakeasy Cocktail Laboratory'
  ], images: [
    'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1516594798947-e65505dbb29d?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1470337458703-46ad1756a187?q=80&w=1200&auto=format&fit=crop'
  ]},

  { key: 'brunch', label: 'Bottomless Brunch', group: 'Food & Drink', tag: ['brunch', 'bottomless', 'mimosas', 'dayparty'], basePrice: 40, venues: [
    { name: 'Darcie & May Green', city: 'London', address: 'Grand Union Canal, Sheldon Square, London W2 6DS' },
    { name: 'Sunday in Brooklyn', city: 'New York', address: '348 Wythe Ave, Brooklyn, NY 11249' },
    { name: 'Benedict Breakfast Club', city: 'Berlin', address: 'Uhlandstraße 49, 10719 Berlin' },
    { name: 'Mulberry & Prince Kitchen', city: 'Cape Town', address: '12 Pepper St, Cape Town City Centre' },
    { name: 'Two Doors Bistro', city: 'Paris', address: '14 Rue de Charonne, 75011 Paris' },
    { name: 'Bills Omotesando', city: 'Tokyo', address: 'Tokyu Plaza 7F, 4-30-3 Jingumae, Shibuya, Tokyo' },
    { name: 'Danfo Bistro Rooftop', city: 'Lagos', address: '2 Alexander Rd, Ikoyi, Lagos' }
  ], titles: [
    'The Hip-Hop Bottomless Brunch: 90 Mins Unlimited Spritz',
    'Pancakes & Prosecco: Vibrant Weekend Brunch Party',
    'Amapiano Day Feast: African Flavors & Sparkling Sangria',
    'Euphoria Brunch Club: Live Saxophone & Avocado Tartines',
    'Disco & Eggs Benedict: Midday Grooves & Flowing Cocktails'
  ], images: [
    'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1525351484163-7529414344d8?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1484723091739-30a097e8f929?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?q=80&w=1200&auto=format&fit=crop'
  ]},

  { key: 'esports', label: 'Esports & Gaming', group: 'Gaming', tag: ['esports', 'gaming', 'tournament', 'lan'], basePrice: 15, venues: [
    { name: 'Red Bull Gaming Sphere', city: 'London', address: 'Whitby St, London E1 6JT' },
    { name: 'BrookLAN Esports Arena', city: 'New York', address: '339 Troutman St, Brooklyn, NY 11237' },
    { name: 'LVL Global Gaming Venue', city: 'Berlin', address: 'Schützenstraße 73, 10117 Berlin' },
    { name: 'eSports Arena Akihabara', city: 'Tokyo', address: '1-16-1 Soto-Kanda, Chiyoda, Tokyo' },
    { name: 'ATK Arena Esports Centre', city: 'Cape Town', address: '91 Main Rd, Claremont, Cape Town' },
    { name: 'Esports Stadium Seoul', city: 'Seoul', address: 'Sangam-dong, Mapo-gu, Seoul' },
    { name: 'Arkham Gaming Lounge', city: 'Lagos', address: 'Lekki Phase 1, Lagos, Nigeria' }
  ], titles: [
    'Smash Ultimate & Tekken 8 Fight Night Showdown',
    'Valorant 5v5 Community Cup: Live Caster Finals',
    'FC 25 Champions Trophy: FIFA Street & PS5 Knockout',
    'Retro Arcade Throwdown: Street Fighter & Mario Kart',
    'Counter-Strike 2 LAN Derby & Afterparty'
  ], images: [
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1200&auto=format&fit=crop'
  ]},

  { key: 'streetstyle', label: 'Sneakers & Streetwear', group: 'Fashion & Beauty', tag: ['streetwear', 'sneakers', 'fashion', 'kicks'], basePrice: 10, venues: [
    { name: 'Dover Street Market Atrium', city: 'London', address: '18-22 Haymarket, London SW1Y 4DG' },
    { name: 'Kith SoHo Exhibition Hall', city: 'New York', address: '337 Lafayette St, New York, NY 10012' },
    { name: 'Voo Store Courtyard', city: 'Berlin', address: 'Oranienstraße 24, 10999 Berlin' },
    { name: 'Harajuku Cat Street Pavilion', city: 'Tokyo', address: '5-10 Jingumae, Shibuya, Tokyo' },
    { name: 'Sneaker District Amsterdam', city: 'Amsterdam', address: 'Rozengracht 21, 1016 LR Amsterdam' },
    { name: 'Shelflife Flagship Courtyard', city: 'Cape Town', address: '167 Longmarket St, Cape Town' },
    { name: 'Street Souk Fashion Hub', city: 'Lagos', address: 'Victoria Island Fashion District, Lagos' }
  ], titles: [
    'Sneaker Con Pop-Up: Rare Grails, Buy/Sell/Trade Meet',
    'Underground Streetwear Fair: 25 Independent Designers',
    'Vintage Denim & Archival Workwear Exhibition',
    'Kick-Check Live: Sneaker Authentication & Custom Workshop',
    'Tokyo Streetstyle Market: Japanese High-Fashion & Thrift'
  ], images: [
    'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1549298916-b41d501d3772?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1509631179647-0177331693ae?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1200&auto=format&fit=crop'
  ]},

  { key: 'anime', label: 'Anime & Comic Con', group: 'Gaming', tag: ['anime', 'manga', 'cosplay', 'comiccon'], basePrice: 20, venues: [
    { name: 'ExCeL London Convention Centre', city: 'London', address: 'Royal Victoria Dock, 1 Western Gateway, London E16 1XL' },
    { name: 'Javits Center Halls', city: 'New York', address: '429 11th Ave, New York, NY 10001' },
    { name: 'Messe Berlin Pavilion', city: 'Berlin', address: 'Messedamm 22, 14055 Berlin' },
    { name: 'Tokyo Big Sight Exhibition Centre', city: 'Tokyo', address: '3-11-1 Ariake, Koto City, Tokyo' },
    { name: 'Paris Expo Porte de Versailles', city: 'Paris', address: '1 Pl. de la Porte de Versailles, 75015 Paris' },
    { name: 'Cape Town International Convention Centre', city: 'Cape Town', address: 'Convention Square, 1 Lower Long St, Cape Town' },
    { name: 'COEX Convention & Exhibition Center', city: 'Seoul', address: '513 Yeongdong-daero, Gangnam-gu, Seoul' }
  ], titles: [
    'Neo Tokyo Anime Expo & Cosplay Championship',
    'Otaku Night Market: Manga Artists, Doujinshi & J-Rock',
    'Chibi Comic Gathering: Indie Creators & Voice Actor Panel',
    'Cyberpunk & Sci-Fi Universe: Cosplay Walk & VR Demos',
    'Shonen Beats: Anime OST Orchestra & Anime Trivia'
  ], images: [
    'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?q=80&w=1200&auto=format&fit=crop'
  ]},

  { key: 'flea_market', label: 'Vinyl & Vintage Flea', group: 'Markets', tag: ['vintage', 'vinyl', 'flea', 'antiques'], basePrice: 0, venues: [
    { name: 'Brick Lane Upmarket', city: 'London', address: '91 Brick Ln, London E1 6QL' },
    { name: 'Brooklyn Flea DUMBO', city: 'New York', address: '80 Pearl St, Brooklyn, NY 11201' },
    { name: 'Mauerpark Flohmarkt', city: 'Berlin', address: 'Bernauer Str. 63-64, 13355 Berlin' },
    { name: 'Shimokitazawa Vintage Alley', city: 'Tokyo', address: '2-24-2 Kitazawa, Setagaya City, Tokyo' },
    { name: 'Marché aux Puces de Saint-Ouen', city: 'Paris', address: 'Rue des Rosiers, 93400 Saint-Ouen-sur-Seine' },
    { name: 'Milnerton Flea Market', city: 'Cape Town', address: 'Marine Dr, Paarden Eiland, Cape Town' },
    { name: 'Waterlooplein Flea Market', city: 'Amsterdam', address: 'Waterlooplein 2, 1011 NZ Amsterdam' }
  ], titles: [
    'Crate Diggers Vinyl Fair: 10,000+ LPs & Cassettes',
    'Mid-Century Vintage & Retro Curiosities Market',
    'Artisanal Flea & Antique Watch Collectors Meet',
    'Bohemian Flea: Rare Books, Polaroids & Handmade Jewelry',
    'Sunday Flea Groove: DJ Sets, Coffee & Vintage Thrift'
  ], images: [
    'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1472851294608-062f824d29cc?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1447069387593-a5de0862481e?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?q=80&w=1200&auto=format&fit=crop'
  ]},

  { key: 'running', label: 'Sunset Run Club', group: 'Fitness & Wellness', tag: ['running', '5k', 'fitness', 'runclub'], basePrice: 0, venues: [
    { name: 'Battersea Park Track & Thames Path', city: 'London', address: 'Battersea Park, London SW11 4NJ' },
    { name: 'Central Park Reservoir Loop', city: 'New York', address: 'Central Park West & 85th St, New York, NY 10024' },
    { name: 'Tiergarten Central Avenue', city: 'Berlin', address: 'Straße des 17. Juni, 10557 Berlin' },
    { name: 'Sea Point Promenade Pavilion', city: 'Cape Town', address: 'Beach Rd, Sea Point, Cape Town' },
    { name: 'Seine Riverbanks Promenade', city: 'Paris', address: 'Voie Georges Pompidou, 75004 Paris' },
    { name: 'Imperial Palace Outer Loop', city: 'Tokyo', address: '1-1 Chiyoda, Chiyoda City, Tokyo' },
    { name: 'Lekki-Ikoyi Bridge Path', city: 'Lagos', address: 'Lekki-Ikoyi Link Bridge, Lekki, Lagos' }
  ], titles: [
    'Sunset 5K Social Run & Post-Run Cold Brews',
    'Midnight City Runners: 8K Glow Run & DJ Finish',
    'Weekend 10K Bridge & River Tempo Session',
    'Sunrise Shakeout: Easy Pace Jog & Pastries Meet',
    'Trail & Coastal Run: 7K Scenic Group Dash'
  ], images: [
    'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1486218119243-13883505764c?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1502680390469-be75c86b636f?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?q=80&w=1200&auto=format&fit=crop'
  ]},

  { key: 'yoga', label: 'Rooftop Yoga & Sound', group: 'Fitness & Wellness', tag: ['yoga', 'soundbath', 'meditation', 'flow'], basePrice: 20, venues: [
    { name: 'Sky Garden Observation Deck', city: 'London', address: '1 Sky Garden Walk, London EC3M 8AF' },
    { name: 'The William Vale Rooftop', city: 'New York', address: '111 N 12th St, Brooklyn, NY 11249' },
    { name: 'Soho House Berlin Studio', city: 'Berlin', address: 'Torstraße 1, 10119 Berlin' },
    { name: 'Clifton 4th Beach Pavilion', city: 'Cape Town', address: 'Victoria Rd, Clifton, Cape Town' },
    { name: 'Rooftop at Peninsula Paris', city: 'Paris', address: '19 Av. Kléber, 75116 Paris' },
    { name: 'Meiji Jingu Shrines Garden Deck', city: 'Tokyo', address: '1-1 Yoyogikamizonocho, Shibuya, Tokyo' },
    { name: 'Tarkwa Bay Beachfront Shala', city: 'Lagos', address: 'Tarkwa Bay Island, Lagos' }
  ], titles: [
    'Golden Hour Vinyasa Flow & Tibetan Singing Bowl Bath',
    'Sunrise Rooftop Yoga & Mindful Herbal Tea Circle',
    'Deep Yin Yoga with Live Cello & Ambient Soundscape',
    'Full Moon Awakening: Kundalini Flow & Sound Meditation',
    'Chakra Aligning Flow & Breath Integration Workshop'
  ], images: [
    'https://images.unsplash.com/photo-1506126613408-eca07ce68773?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1518611012118-696072aa579a?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1599447421416-3414500d18a5?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1575052814086-f385e2e2ad1b?q=80&w=1200&auto=format&fit=crop'
  ]},

  { key: 'crossfit', label: 'Cross-Training & Bootcamp', group: 'Fitness & Wellness', tag: ['bootcamp', 'crossfit', 'hiit', 'training'], basePrice: 15, venues: [
    { name: 'Ministry of Sound Fitness / Ministry Does Fitness', city: 'London', address: '103 Gaunt St, London SE1 6DP' },
    { name: 'Tone House NYC', city: 'New York', address: '32 E 31st St, New York, NY 10016' },
    { name: 'CrossFit Mitte', city: 'Berlin', address: 'Heidestraße 48, 10557 Berlin' },
    { name: 'Roark Gyms Yard', city: 'Cape Town', address: '93 Bree St, Cape Town City Centre' },
    { name: 'La Montgolfière Club', city: 'Paris', address: '40 Rue Yves Toudic, 75010 Paris' },
    { name: 'CrossFit Daikanyama', city: 'Tokyo', address: '24-7 Sarugakucho, Shibuya, Tokyo' },
    { name: 'Bodyline Fitness Beach Courtyard', city: 'Lagos', address: 'Bankole Oki Rd, Ikoyi, Lagos' }
  ], titles: [
    'Urban Turf Wars: Team Cross-Training Challenge',
    'High-Octane HIIT Bootcamp & Protein Smoothie Bar',
    'Barbell & Kettlebell Strength Masterclass',
    'Sweat Society: 60-Minute Non-Stop Functional Circuit',
    'The Gauntlet: Community Fitness Battle & BBQ'
  ], images: [
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1518611012118-696072aa579a?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1574680096145-d05b474e2155?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=1200&auto=format&fit=crop'
  ]},

  { key: 'breathwork', label: 'Ice Bath & Breathwork', group: 'Fitness & Wellness', tag: ['icebath', 'breathwork', 'wimhof', 'recovery'], basePrice: 30, venues: [
    { name: 'Othership London', city: 'London', address: '124 Bermondsey St, London SE1 3TX' },
    { name: 'Bathhouse Williamsburg', city: 'New York', address: '103 N 10th St, Brooklyn, NY 11249' },
    { name: 'Vabali Spa Garden', city: 'Berlin', address: 'Seydlitzstraße 6, 10557 Berlin' },
    { name: 'Cape Town Cold Plunge Collective', city: 'Cape Town', address: 'Camps Bay Tidal Pool, Cape Town' },
    { name: 'Les Bains du Marais', city: 'Paris', address: '14 Rue Saint-Fiacre, 75002 Paris' },
    { name: 'Thermae Yu Wellness Club', city: 'Tokyo', address: '1-1-2 Kabukicho, Shinjuku, Tokyo' },
    { name: 'Lekki Coastal Wellness Shala', city: 'Lagos', address: 'Okun Ajah Beach Rd, Lekki, Lagos' }
  ], titles: [
    'Primal Reset: Wim Hof Breathwork & Sub-Zero Ice Plunge',
    'Nervous System Reset: Holotropic Breathing & Cold Therapy',
    'Sauna & Cold Immersion: Scandinavian Recovery Ritual',
    'Breathe, Release, Restore: Guided Breathwork Journey',
    'Fire & Ice Social: Woodfire Sauna & Cold Tank Challenge'
  ], images: [
    'https://images.unsplash.com/photo-1515377905703-c4788e51af15?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1518611012118-696072aa579a?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1506126613408-eca07ce68773?q=80&w=1200&auto=format&fit=crop'
  ]},

  { key: 'dating', label: 'Speed Dating & Singles', group: 'Social', tag: ['dating', 'singles', 'cocktails', 'social'], basePrice: 20, venues: [
    { name: 'Flight Club Shoreditch', city: 'London', address: '2A Worship St, London EC2A 2AH' },
    { name: 'Spin Ping Pong Social Club', city: 'New York', address: '48 E 23rd St, New York, NY 10010' },
    { name: 'Bar Tausend', city: 'Berlin', address: 'Schiffbauerdamm 11, 10117 Berlin' },
    { name: 'The Gin Bar Secret Courtyard', city: 'Cape Town', address: '64A Wale St, Cape Town City Centre' },
    { name: 'Le Comptoir Général', city: 'Paris', address: '84 Quai de Jemmapes, 75010 Paris' },
    { name: 'Two Rooms Grill & Bar', city: 'Tokyo', address: '3-11-7 Kita-Aoyama, Minato City, Tokyo' },
    { name: 'R.S.V.P Lounge Ikoyi', city: 'Lagos', address: '9 Eletu Ogabi St, Victoria Island, Lagos' }
  ], titles: [
    'No-Awkwardness Speed Dating: 3-Minute Mini Dates & Drinks',
    'Singles Lock & Key Social: High-Energy Mixer Night',
    'Twenty-Somethings & Thirties: Rooftop Singles & Cocktails',
    'Board Games & Banter: Casual Singles Meetup',
    'Deep Connections: Interactive Questions & Wine Pairing'
  ], images: [
    'https://images.unsplash.com/photo-1511632765486-a01980e01a18?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1528605248644-14dd04022da1?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1543007630-9710e4a00a20?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop'
  ]},

  { key: 'startup', label: 'Tech Founders & Pitch', group: 'Business', tag: ['startup', 'tech', 'pitch', 'vc', 'ai'], basePrice: 0, venues: [
    { name: 'Google for Startups Campus', city: 'London', address: '4-5 Bonhill St, London EC2A 4BX' },
    { name: 'Betaworks Studios', city: 'New York', address: '29 Little W 12th St, New York, NY 10014' },
    { name: 'Factory Berlin Mitte', city: 'Berlin', address: 'Rheinsberger Str. 76/77, 10115 Berlin' },
    { name: 'Station F Tech Campus', city: 'Paris', address: '55 Bd Vincent Auriol, 75013 Paris' },
    { name: 'Workshop17 Watershed', city: 'Cape Town', address: '17 Dock Rd, V&A Waterfront, Cape Town' },
    { name: 'Venture Café Tokyo', city: 'Tokyo', address: 'Toranomon Hills Mori Tower, Minato City, Tokyo' },
    { name: 'Co-Creation Hub (CcHUB)', city: 'Lagos', address: '294 Herbert Macaulay Way, Yaba, Lagos' }
  ], titles: [
    'Founder Pitch Night: 8 Startups, 5 Top VCs, Live Feedback',
    'AI Builder Jam: LLMs, Agents & Next-Gen Product Demo',
    'Tech & Beer Mixer: Developers, PMs & Seed Investors',
    'Web3 & FinTech Roundtable: Scaling Global Payments',
    'Bootstrapped to $1M ARR: Founder Fireside & AMA'
  ], images: [
    'https://images.unsplash.com/photo-1515187029135-18ee286d815b?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1531482615713-2afd69097998?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1559136555-9303baea8ebd?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?q=80&w=1200&auto=format&fit=crop'
  ]},

  { key: 'comedy', label: 'Stand-Up Comedy', group: 'Arts & Culture', tag: ['comedy', 'standup', 'openmic', 'laughs'], basePrice: 18, venues: [
    { name: 'Top Secret Comedy Club', city: 'London', address: '170 Drury Ln, London WC2B 5PD' },
    { name: 'Comedy Cellar', city: 'New York', address: '117 MacDougal St, New York, NY 10012' },
    { name: 'Cosmic Comedy Club Berlin', city: 'Berlin', address: 'Rosa-Luxemburg-Straße 41, 10178 Berlin' },
    { name: 'Cape Town Comedy Club', city: 'Cape Town', address: 'The Pumphouse, 6 Dock Rd, V&A Waterfront' },
    { name: 'Paname Art Cafe Comedy Club', city: 'Paris', address: '14 Rue de la Fontaine au Roi, 75011 Paris' },
    { name: 'Tokyo Comedy Bar', city: 'Tokyo', address: '1-5-9 Dogenzaka, Shibuya, Tokyo' },
    { name: 'Muson Centre Comedy Stage', city: 'Lagos', address: '8/9 Marina, Onikan, Lagos Island' }
  ], titles: [
    'Late Night Stand-Up: 5 Netflix & TV Headliners',
    'Raw & Uncensored: Underground Comedy Showcase',
    'Punchline Roulette: Improv, Crowd Work & Stand-Up',
    'Sunday Roast: Savage Jokes & Guest Host Roast Battle',
    'International Comedy Open Mic: English Stand-Up Special'
  ], images: [
    'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1525994886773-080587e161c2?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop'
  ]},

  { key: 'trivia_night', label: 'Pub Quiz & Trivia', group: 'Social', tag: ['trivia', 'pubquiz', 'beer', 'quiz'], basePrice: 5, venues: [
    { name: 'The Old Queen\'s Head', city: 'London', address: '44 Essex Rd, London N1 8LN' },
    { name: 'The Grafton NYC', city: 'New York', address: '126 1st Ave, New York, NY 10009' },
    { name: 'The Castle Pub Berlin', city: 'Berlin', address: 'Invalidenstraße 129, 10115 Berlin' },
    { name: 'Foresters Arms Restaurant & Pub', city: 'Cape Town', address: '52 Newlands Ave, Newlands, Cape Town' },
    { name: 'The Highlander Scottish Pub', city: 'Paris', address: '8 Rue de Nevers, 75006 Paris' },
    { name: 'The Hobgoblin Shibuya', city: 'Tokyo', address: '1-3-11 Dogenzaka, Shibuya, Tokyo' },
    { name: 'Bottles Bar & Grill', city: 'Lagos', address: '8 Imam Augusto Cl, Victoria Island, Lagos' }
  ], titles: [
    'The Ultimate Pop Culture & Movie Trivia Championship',
    'Music Buffs Trivia: Name That Tune & Album Art',
    'Geek Culture Quiz: Marvel, Sci-Fi & Video Games',
    'General Knowledge Brawl: Cash Prize & Free Beer Rounds',
    'The 90s & 2000s Nostalgia Quiz Night'
  ], images: [
    'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1528605248644-14dd04022da1?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1543007630-9710e4a00a20?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop'
  ]},

  { key: 'football', label: '5v5 Soccer & Hoops', group: 'Sport', tag: ['football', 'soccer', 'futsal', 'hoops', 'basketball'], basePrice: 8, venues: [
    { name: 'Powerleague Shoreditch Pitch', city: 'London', address: 'Braithwaite St, London E1 6GJ' },
    { name: 'Pier 5 Brooklyn Bridge Park', city: 'New York', address: 'Pier 5, Brooklyn, NY 11201' },
    { name: 'Poststadion Futsal Court', city: 'Berlin', address: 'Lehrter Str. 59, 10557 Berlin' },
    { name: 'Fives Futbol Century City', city: 'Cape Town', address: 'Century City, Cape Town' },
    { name: 'UrbanSoccer Porte d\'Ivry', city: 'Paris', address: '1 Av. Pierre de Coubertin, 75013 Paris' },
    { name: 'Adidas Futsal Park Shibuya', city: 'Tokyo', address: 'Tokyu Department Store Roof, Shibuya, Tokyo' },
    { name: 'Upbeat Recreation Centre Futsal Arena', city: 'Lagos', address: '11 Admiralty Rd, Lekki Phase 1, Lagos' }
  ], titles: [
    'Friday Night 5v5 Futsal Derby & Golden Goal Clash',
    'Streetball 3v3 Tournament: Half-Court Hoops & Hip-Hop',
    'Sunday Morning Pick-Up Soccer: All Skill Levels Welcome',
    'Champions League Night Futsal League & Trophy',
    'King of the Court: Quick-Fire Knockout 5-a-side'
  ], images: [
    'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1519766304817-4f37bda74a29?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1526676037777-05a232554f77?q=80&w=1200&auto=format&fit=crop'
  ]},

  { key: 'f1', label: 'Grand Prix & Sports Screenings', group: 'Sport', tag: ['f1', 'grandprix', 'racing', 'livematch'], basePrice: 10, venues: [
    { name: 'Belushi\'s London Bridge Big Screen', city: 'London', address: '161-165 Borough High St, London SE1 1HR' },
    { name: 'The Football Factory at Legends', city: 'New York', address: '6 W 33rd St, New York, NY 10001' },
    { name: 'Belushi\'s Berlin Sports Bar', city: 'Berlin', address: 'Rosa-Luxemburg-Straße 41, 10178 Berlin' },
    { name: 'Oblivion Bar & Rooftop', city: 'Cape Town', address: '22 Chichester Rd, Claremont, Cape Town' },
    { name: 'The Moose Sports Bar', city: 'Paris', address: '16 Rue des Quatre Vents, 75006 Paris' },
    { name: 'Legends Sports Bar Roppongi', city: 'Tokyo', address: '3-16-33 Roppongi, Minato City, Tokyo' },
    { name: 'Bature Brewery Sports Deck', city: 'Lagos', address: '256 Etim Inyang Cres, Victoria Island, Lagos' }
  ], titles: [
    'Formula 1 Grand Prix Live Screening & Sim Racing',
    'Champions League Final Mega-Screen Watch Party',
    'El Clásico Watch Party: Big Screens, Tapas & Cerveza',
    'Super Bowl Championship Live & Wings Feast',
    'Rugby Championship: Big Screen Stadium Atmosphere'
  ], images: [
    'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1526676037777-05a232554f77?q=80&w=1200&auto=format&fit=crop'
  ]},

  { key: 'padel', label: 'Padel & Pickleball', group: 'Sport', tag: ['padel', 'pickleball', 'racket', 'socialsport'], basePrice: 18, venues: [
    { name: 'Stratford Padel Club', city: 'London', address: '22 Market St, London E15 2ES' },
    { name: 'CityPickle Hudson Yards', city: 'New York', address: '11th Ave & W 33rd St, New York, NY 10001' },
    { name: 'Padel Club Berlin International', city: 'Berlin', address: 'Friedrich-Krause-Ufer 24, 13353 Berlin' },
    { name: 'Virgin Active Padel Club V&A', city: 'Cape Town', address: 'V&A Waterfront, Cape Town' },
    { name: 'Casa Padel Paris', city: 'Paris', address: '103 Rue Charles Michels, 93200 Saint-Denis' },
    { name: 'Tokyo Padel Club Shinagawa', city: 'Tokyo', address: '2-1-24 Minato City, Tokyo' },
    { name: 'The Padel Court Lekki', city: 'Lagos', address: 'Admiralty Way, Lekki Phase 1, Lagos' }
  ], titles: [
    'Friday Night Social Padel: Mexicano Format & Beers',
    'Pickleball Social Club: Doubles Tournament & Music',
    'Padel Masters: Intermediate & Advanced King of the Court',
    'Beginner Padel Bootcamp: Coaching, Drills & Mini-Games',
    'Sunset Rackets: Mixed Doubles & Lounge Session'
  ], images: [
    'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1530549387789-4c1017266635?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1519766304817-4f37bda74a29?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1526676037777-05a232554f77?q=80&w=1200&auto=format&fit=crop'
  ]},

  { key: 'boxing', label: 'Boxing & MMA Meets', group: 'Sport', tag: ['boxing', 'mma', 'ufc', 'fightnight'], basePrice: 20, venues: [
    { name: 'York Hall Leisure Centre', city: 'London', address: '5 Old Ford Rd, London E2 9PJ' },
    { name: 'Gleason\'s Gym DUMBO', city: 'New York', address: '130 Water St, Brooklyn, NY 11201' },
    { name: 'Ringside Gym Berlin', city: 'Berlin', address: 'Koppenstraße 8, 10243 Berlin' },
    { name: 'The Armoury Boxing Club', city: 'Cape Town', address: 'Buchanan Square, 160 Sir Lowry Rd, Woodstock' },
    { name: 'Apollo Sporting Club Paris', city: 'Paris', address: '3 Rue Théodore Deck, 75015 Paris' },
    { name: 'Korakuen Hall Tokyo', city: 'Tokyo', address: '1-3-61 Koraku, Bunkyo City, Tokyo' },
    { name: 'Eko Hotels Arena MMA Cage', city: 'Lagos', address: 'Plot 1415 Adetokunbo Ademola St, Lagos' }
  ], titles: [
    'UFC Title Fight Main Card Live Watch Experience',
    'Amateur Boxing Showcase: Live Bouts & Ring Atmosphere',
    'Muay Thai & Kickboxing Exhibition Night',
    'Championship Heavyweight Boxing Viewing Party',
    'Boxing Technique Workshop & Sparring Masterclass'
  ], images: [
    'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1517438322307-e67111335449?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=1200&auto=format&fit=crop'
  ]},

  { key: 'cinema', label: 'Outdoor & Rooftop Cinema', group: 'Arts & Culture', tag: ['cinema', 'film', 'movie', 'outdoor'], basePrice: 16, venues: [
    { name: 'Rooftop Film Club Peckham', city: 'London', address: '133 Rye Ln, London SE15 4ST' },
    { name: 'Skyline Drive-In Greenpoint', city: 'New York', address: '1 Oak St, Brooklyn, NY 11222' },
    { name: 'Freiluftkino Kreuzberg', city: 'Berlin', address: 'Mariannenplatz 2, 10997 Berlin' },
    { name: 'The Galileo Open Air Cinema Kirstenbosch', city: 'Cape Town', address: 'Rhodes Dr, Newlands, Cape Town' },
    { name: 'Cinéma en Plein Air La Villette', city: 'Paris', address: 'Parc de la Villette, 75019 Paris' },
    { name: 'Shinagawa Open Theater', city: 'Tokyo', address: '1-2-70 Konan, Minato City, Tokyo' },
    { name: 'Alliance Française Outdoor Amphitheatre', city: 'Lagos', address: '9 Osborne Rd, Ikoyi, Lagos' }
  ], titles: [
    'Rooftop Cinema Club: Cult Classic Under The Stars & Cocktails',
    'Indie Cinema & Director Q&A: International Shorts',
    'Retro 80s Sci-Fi Night: Headphone Cinema with Popcorn',
    'Moonlit Romance: Classic French & Italian Cinema',
    'Anime Film Festival Open-Air: Studio Ghibli Special'
  ], images: [
    'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1478720568477-152d9b164e26?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=1200&auto=format&fit=crop'
  ]},

  { key: 'gallery', label: 'Contemporary Art & Late Nights', group: 'Arts & Culture', tag: ['art', 'gallery', 'exhibition', 'vernissage'], basePrice: 0, venues: [
    { name: 'Tate Modern Turbine Hall', city: 'London', address: 'Bankside, London SE1 9TG' },
    { name: 'MoMA PS1 Courtyard', city: 'New York', address: '22-25 Jackson Ave, Queens, NY 11101' },
    { name: 'König Galerie Nave', city: 'Berlin', address: 'Alexandrinenstraße 118-121, 10969 Berlin' },
    { name: 'Zeitz MOCAA Atrium', city: 'Cape Town', address: 'Silo District, V&A Waterfront, Cape Town' },
    { name: 'Palais de Tokyo Late Opening', city: 'Paris', address: '13 Av. du Président Wilson, 75116 Paris' },
    { name: 'Mori Art Museum Sky Deck', city: 'Tokyo', address: '6-10-1 Roppongi, Minato City, Tokyo' },
    { name: 'Rele Gallery Victoria Island', city: 'Lagos', address: '32D Thompson Ave, Ikoyi, Lagos' }
  ], titles: [
    'Art After Dark: Late Night Exhibition, Wine & Live DJs',
    'Vernissage: Contemporary Sculpture & Immersive Light',
    'Digital Canvas: Generative AI & Interactive Projection Art',
    'Emerging Voices: International Photography & Print Fair',
    'Sculpture & Sound: Acoustic Performance in the Gallery'
  ], images: [
    'https://images.unsplash.com/photo-1518998053901-5348d3961a04?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1536924940846-227afb31e2a5?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1561214115-f2f134cc4912?q=80&w=1200&auto=format&fit=crop'
  ]},

  { key: 'poetry', label: 'Poetry Slam & Spoken Word', group: 'Arts & Culture', tag: ['poetry', 'spokenword', 'openmic', 'literature'], basePrice: 12, venues: [
    { name: 'The Poetry Cafe Covent Garden', city: 'London', address: '22 Betterton St, London WC2H 9BX' },
    { name: 'Nuyorican Poets Cafe', city: 'New York', address: '236 E 3rd St, New York, NY 10009' },
    { name: 'Prachtwerk Berlin Acoustic Stage', city: 'Berlin', address: 'Ganghoferstraße 2, 12043 Berlin' },
    { name: 'Alexander Bar & Theatre', city: 'Cape Town', address: '76 Strand St, Cape Town City Centre' },
    { name: 'Shakespeare and Company Courtyard', city: 'Paris', address: '37 Rue de la Bûcherie, 75005 Paris' },
    { name: 'Good Heavens British Bar Poetry Night', city: 'Tokyo', address: '5-32-5 Daizawa, Setagaya City, Tokyo' },
    { name: 'Bogobiri House Lounge', city: 'Lagos', address: '9 Maitama Sule St, Ikoyi, Lagos' }
  ], titles: [
    'The Grand Slam: Spoken Word & Live Double Bass',
    'Words on Fire: Raw Verse & Open Mic Poetry Night',
    'Voices of the Diaspora: Soulful Poetry & Acoustic Guitars',
    'Midnight Ink: Storytelling, Monologues & Jazz Chords',
    'Heart & Rhythm: Slam Poetry Showdown & Cash Prize'
  ], images: [
    'https://images.unsplash.com/photo-1455390582262-044cdead277a?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1471107340929-a87cd0f5b5f3?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1525994886773-080587e161c2?q=80&w=1200&auto=format&fit=crop'
  ]}
];

// Months configuration: 6 months (Sept 2026 to Feb 2027)
const MONTHS = [
  { year: 2026, month: 9,  name: 'Sep 2026', daysInMonth: 30, startDay: 25 },
  { year: 2026, month: 10, name: 'Oct 2026', daysInMonth: 31, startDay: 2 },
  { year: 2026, month: 11, name: 'Nov 2026', daysInMonth: 30, startDay: 3 },
  { year: 2026, month: 12, name: 'Dec 2026', daysInMonth: 31, startDay: 4 },
  { year: 2027, month: 1,  name: 'Jan 2027', daysInMonth: 31, startDay: 5 },
  { year: 2027, month: 2,  name: 'Feb 2027', daysInMonth: 28, startDay: 3 }
];

const CITY_COORDS = {
  'London': { lat: 51.5074, lon: -0.1278, currency: 'GBP', sym: '£', rate: 0.8 },
  'New York': { lat: 40.7128, lon: -74.0060, currency: 'USD', sym: '$', rate: 1.0 },
  'Berlin': { lat: 52.5200, lon: 13.4050, currency: 'EUR', sym: '€', rate: 0.92 },
  'Tokyo': { lat: 35.6762, lon: 139.6503, currency: 'JPY', sym: '¥', rate: 155 },
  'Paris': { lat: 48.8566, lon: 2.3522, currency: 'EUR', sym: '€', rate: 0.92 },
  'Cape Town': { lat: -33.9249, lon: 18.4241, currency: 'ZAR', sym: 'R', rate: 18 },
  'Lagos': { lat: 6.5244, lon: 3.3792, currency: 'NGN', sym: '₦', rate: 1500 },
  'Johannesburg': { lat: -26.2041, lon: 28.0473, currency: 'ZAR', sym: 'R', rate: 18 },
  'Amsterdam': { lat: 52.3676, lon: 4.9041, currency: 'EUR', sym: '€', rate: 0.92 },
  'São Paulo': { lat: -23.5505, lon: -46.6333, currency: 'BRL', sym: 'R$', rate: 5.5 },
  'Seoul': { lat: 37.5665, lon: 126.9780, currency: 'KRW', sym: '₩', rate: 1380 },
  'Dubai': { lat: 25.2048, lon: 55.2708, currency: 'AED', sym: 'AED', rate: 3.67 },
  'Los Angeles': { lat: 34.0522, lon: -118.2437, currency: 'USD', sym: '$', rate: 1.0 }
};

const TIMES = ['18:00', '19:00', '19:30', '20:00', '21:00', '14:00', '15:30', '17:00'];

const allEvents = [];

let eventCounter = 1;

for (const cat of CATEGORIES) {
  for (const m of MONTHS) {
    for (let slot = 0; slot < 5; slot++) {
      // Calculate realistic day of the month spread out
      const dayOffset = Math.min(m.daysInMonth, m.startDay + slot * 5 + (eventCounter % 3));
      const dayStr = String(dayOffset).padStart(2, '0');
      const monthStr = String(m.month).padStart(2, '0');
      const eventDate = `${m.year}-${monthStr}-${dayStr}`;
      
      const venueObj = cat.venues[(slot + m.month) % cat.venues.length];
      const cityData = CITY_COORDS[venueObj.city] || { lat: 51.5074, lon: -0.1278, currency: 'USD', sym: '$', rate: 1.0 };
      
      const titleTemplate = cat.titles[slot % cat.titles.length];
      const title = `${titleTemplate} (${venueObj.city})`;
      const eventTime = TIMES[(slot * 2 + m.month) % TIMES.length];
      const imageUrl = cat.images[slot % cat.images.length];

      // Localized price calculation
      let priceAmount = 0;
      let priceStr = 'Free Entry';
      let rsvpTiers = [];

      if (cat.basePrice > 0) {
        // Adjust price to local currency
        const localUnits = Math.round(cat.basePrice * cityData.rate);
        // Round to pleasing numbers
        let cleanUnits = localUnits;
        if (cleanUnits > 500) cleanUnits = Math.round(cleanUnits / 500) * 500;
        else if (cleanUnits > 50) cleanUnits = Math.round(cleanUnits / 10) * 10;
        else cleanUnits = Math.round(cleanUnits / 5) * 5;

        priceAmount = cleanUnits;
        priceStr = `${cityData.sym}${cleanUnits}`;

        const vipUnits = Math.round(cleanUnits * 2.2);
        rsvpTiers = [
          { name: 'General Admission', price: cleanUnits, currency: cityData.currency, capacity: 250 },
          { name: 'VIP Access & Express Entry', price: vipUnits, currency: cityData.currency, capacity: 50 }
        ];
      } else {
        rsvpTiers = [
          { name: 'RSVP Guestlist', price: 0, currency: cityData.currency, capacity: 300 }
        ];
      }

      const id = `global_${cat.key}_${m.year}_${m.month}_${slot + 1}`;
      
      const eventObj = {
        id,
        title,
        description: `Join us for ${titleTemplate} at ${venueObj.name} in ${venueObj.city}. Experience world-class production, curated music, incredible energy, and community vibes. Full lineup and drink specials announced on arrival.`,
        category: cat.key,
        event_date: eventDate,
        event_time: eventTime,
        venue_name: venueObj.name,
        address: venueObj.address,
        city: venueObj.city,
        lat: cityData.lat,
        lon: cityData.lon,
        cover_url: imageUrl,
        media_urls: [imageUrl],
        price: priceStr,
        price_amount: priceAmount,
        currency: cityData.currency,
        rsvp_tiers: rsvpTiers,
        tags: [...cat.tag, venueObj.city.toLowerCase().replace(/\s+/g, '')],
        author_id: '00000000-0000-0000-0000-000000000001',
        author: {
          id: '00000000-0000-0000-0000-000000000001',
          username: `${cat.key}_global`,
          avatar_url: imageUrl,
          is_verified: true,
          vibe_score: 95
        },
        profiles: {
          id: '00000000-0000-0000-0000-000000000001',
          username: `${cat.key}_global`,
          avatar_url: imageUrl,
          is_verified: true,
          vibe_score: 95
        },
        vibe_count: 45 + ((slot * 17 + m.month * 11) % 180),
        rsvp_count: 30 + ((slot * 13 + m.month * 7) % 150),
        capacity: 350,
        age_min: cat.key === 'rave' || cat.key === 'wine_tasting' ? 21 : 18,
        status: 'published',
        is_verified: true,
        is_featured: (slot === 0 && (m.month === 10 || m.month === 12)),
        created_at: new Date(Date.now() - (eventCounter * 3600000)).toISOString()
      };

      allEvents.push(eventObj);
      eventCounter++;
    }
  }
}

console.log(`Generated ${allEvents.length} events across ${CATEGORIES.length} categories and ${MONTHS.length} months.`);

// Write out JS Catalog
const jsContent = `/**
 * The Gruvs — Global Events Catalog
 * Curated real-world events across 29 prioritized cultural categories
 * Covering Sept 2026 through Feb 2027 worldwide (London, NYC, Tokyo, Berlin, Paris, Lagos, Cape Town, etc.)
 * Generated for seamless offline resilience and rich global discovery.
 */

export const GLOBAL_EVENTS_CATALOG = ${JSON.stringify(allEvents, null, 2)};
`;

fs.writeFileSync(path.join(__dirname, '..', 'src', 'constants', 'globalEventsCatalog.js'), jsContent, 'utf8');
console.log('Successfully wrote src/constants/globalEventsCatalog.js');

// Write out Supabase SQL Seeder
const sqlStatements = [
  '-- Supabase Seeder: Global Events Catalog (Sept 2026 - Feb 2027)',
  '-- Generated for The Gruvs App',
  ''
];

allEvents.forEach(e => {
  const esc = (str) => String(str || '').replace(/'/g, "''");
  const mediaJson = JSON.stringify(e.media_urls).replace(/'/g, "''");
  const tagsJson = JSON.stringify(e.tags).replace(/'/g, "''");
  const rsvpJson = JSON.stringify(e.rsvp_tiers).replace(/'/g, "''");

  const sql = `INSERT INTO public.events (
    id, title, description, category, event_date, event_time, venue_name,
    lat, lon, cover_url, media_urls, price, rsvp_tiers, tags,
    vibe_count, rsvp_count, capacity, age_min, is_verified, created_at
  ) VALUES (
    '${e.id}', '${esc(e.title)}', '${esc(e.description)}', '${e.category}', '${e.event_date}', '${e.event_time}', '${esc(e.venue_name)}',
    ${e.lat}, ${e.lon}, '${e.cover_url}', '${mediaJson}', '${esc(e.price)}', '${rsvpJson}', '${tagsJson}',
    ${e.vibe_count}, ${e.rsvp_count}, ${e.capacity}, ${e.age_min}, true, '${e.created_at}'
  ) ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    event_date = EXCLUDED.event_date,
    cover_url = EXCLUDED.cover_url,
    venue_name = EXCLUDED.venue_name;`;
  sqlStatements.push(sql);
});

fs.writeFileSync(path.join(__dirname, '..', 'supabase', 'seed_global_events.sql'), sqlStatements.join('\n'), 'utf8');
console.log('Successfully wrote supabase/seed_global_events.sql');
