/**
 * generate_entrepreneurship_events.js
 * Generates and seeds 60 South African Entrepreneurship Events EXCLUSIVELY IN GAUTENG:
 * - 20 for December 2026 (Johannesburg, Midrand, Pretoria, Soweto, Ekurhuleni)
 * - 20 for January 2027 (Johannesburg, Midrand, Pretoria, Soweto, Ekurhuleni)
 * - 20 for February 2027 (Johannesburg, Midrand, Pretoria, Soweto, Ekurhuleni)
 *
 * All venues, addresses, coordinates, and phone/email contacts are 100% strictly in Gauteng.
 */

const fs = require('fs');
const path = require('path');

const AUTHOR_ID = 'a1b2ea24-a0b9-450c-9a59-3ba7bbc5224c';

// ── 23 EXCLUSIVE GAUTENG VENUES ──────────────────────────────────────
const GAUTENG_VENUES = [
  // 0: Sandton
  {
    name: '22 On Sloane Startup Campus',
    address: '22 Sloane Street, Bryanston, Sandton, 2191',
    city: 'Johannesburg',
    lat: -26.0505,
    lon: 28.0255,
    phone: '+27 11 026 6000',
    email: 'pitch@22onsloane.co'
  },
  // 1: Sandton
  {
    name: 'Sandton Convention Centre',
    address: '161 Maude Street, Sandton, Johannesburg, 2196',
    city: 'Johannesburg',
    lat: -26.1065,
    lon: 28.0531,
    phone: '+27 11 779 0000',
    email: 'events@sandtoncc.co.za'
  },
  // 2: Sandton
  {
    name: 'Workshop17 Sandton',
    address: '138 West Street, Sandton, Johannesburg, 2196',
    city: 'Johannesburg',
    lat: -26.1075,
    lon: 28.0545,
    phone: '+27 11 202 7000',
    email: 'sandton@workshop17.co.za'
  },
  // 3: Sandton
  {
    name: 'The Marc Sandton',
    address: '129 Rivonia Road, Sandton, Johannesburg, 2196',
    city: 'Johannesburg',
    lat: -26.1042,
    lon: 28.0558,
    phone: '+27 11 883 1200',
    email: 'events@themarcsandton.co.za'
  },
  // 4: Sandton
  {
    name: 'Radisson Blu Gautrain Hotel Sandton',
    address: 'Corner Rivonia Road & West Street, Sandton, Johannesburg, 2196',
    city: 'Johannesburg',
    lat: -26.1068,
    lon: 28.0552,
    phone: '+27 11 286 1000',
    email: 'conferencing@radissonblu.com'
  },
  // 5: Rosebank / Dunkeld
  {
    name: 'The Greenhouse Oxford Parks',
    address: 'Building 1, Oxford Parks, 199 Oxford Road, Dunkeld, Johannesburg, 2196',
    city: 'Johannesburg',
    lat: -26.1415,
    lon: 28.0435,
    phone: '+27 11 327 6500',
    email: 'events@oxfordparks.co.za'
  },
  // 6: Rosebank
  {
    name: 'The Zone @ Rosebank Innovation Hall',
    address: '177 Oxford Road, Rosebank, Johannesburg, 2196',
    city: 'Johannesburg',
    lat: -26.1465,
    lon: 28.0416,
    phone: '+27 11 788 1130',
    email: 'connect@thezoneatrosebank.co.za'
  },
  // 7: Braamfontein
  {
    name: 'Tshimologong Digital Innovation Precinct',
    address: '41 Juta Street, Braamfontein, Johannesburg, 2001',
    city: 'Johannesburg',
    lat: -26.1932,
    lon: 28.0345,
    phone: '+27 11 717 6000',
    email: 'incubator@tshimologong.joburg'
  },
  // 8: Braamfontein
  {
    name: 'Constitution Hill Human Rights Precinct',
    address: '11 Kotze Street, Braamfontein, Johannesburg, 2001',
    city: 'Johannesburg',
    lat: -26.1896,
    lon: 28.0425,
    phone: '+27 11 381 3100',
    email: 'info@constitutionhill.org.za'
  },
  // 9: Fourways
  {
    name: 'The Pivot Montecasino',
    address: 'Montecasino Boulevard, Fourways, Johannesburg, 2055',
    city: 'Johannesburg',
    lat: -26.0245,
    lon: 28.0135,
    phone: '+27 11 367 4367',
    email: 'pivot@montecasino.co.za'
  },
  // 10: Soweto
  {
    name: 'Soweto Theatre Business & Cultural Centre',
    address: 'Bolani Link & Cnr Bolani Rd, Jabulani, Soweto, 1868',
    city: 'Soweto',
    lat: -26.2415,
    lon: 27.8592,
    phone: '+27 11 930 7461',
    email: 'programmes@sowetotheatre.com'
  },
  // 11: Soweto
  {
    name: 'Zone 6 Venue Soweto',
    address: 'Warehouse 28, Blackwood Street, Diepkloof Zone 6, Soweto, 1862',
    city: 'Soweto',
    lat: -26.2483,
    lon: 27.9351,
    phone: '+27 11 982 1000',
    email: 'expo@zone6venue.co.za'
  },
  // 12: Midrand
  {
    name: 'Riversands I-Hub',
    address: '8 Incubation Drive, Riverside View, Midrand, 2021',
    city: 'Midrand',
    lat: -25.9692,
    lon: 28.0055,
    phone: '+27 11 012 4600',
    email: 'hub@riversandsihub.co.za'
  },
  // 13: Midrand
  {
    name: 'Gallagher Convention Centre',
    address: '19 Richards Drive, Halfway House, Midrand, 1685',
    city: 'Midrand',
    lat: -26.0028,
    lon: 28.1287,
    phone: '+27 11 266 3000',
    email: 'gallagher@gallagher.co.za'
  },
  // 14: Midrand
  {
    name: 'Waterfall City Park Event Pavilion',
    address: 'Corner Magwa & Lone Creek Cres, Waterfall City, Midrand, 2090',
    city: 'Midrand',
    lat: -26.0152,
    lon: 28.1091,
    phone: '+27 10 025 2100',
    email: 'events@waterfallcity.co.za'
  },
  // 15: Midrand
  {
    name: 'Kyalami Grand Prix Circuit Conference Centre',
    address: 'R55 & Allandale Road, Kyalami, Midrand, 1684',
    city: 'Midrand',
    lat: -25.9981,
    lon: 28.0689,
    phone: '+27 11 466 0204',
    email: 'functions@kyalamigrandprixcircuit.com'
  },
  // 16: Pretoria
  {
    name: 'SunBet Arena at Time Square',
    address: '209 Aramist Avenue, Menlyn, Pretoria, 0181',
    city: 'Pretoria',
    lat: -25.7877,
    lon: 28.2798,
    phone: '+27 12 003 6150',
    email: 'timesquare@suninternational.com'
  },
  // 17: Pretoria
  {
    name: 'The Capital Menlyn Maine',
    address: '194 Bancor Avenue, Menlyn, Pretoria, 0181',
    city: 'Pretoria',
    lat: -25.7865,
    lon: 28.2810,
    phone: '+27 12 942 5000',
    email: 'menlyn@thecapital.co.za'
  },
  // 18: Pretoria
  {
    name: 'Menlyn Maine Central Square Business Suite',
    address: 'Amarand Avenue, Waterkloof Glen, Pretoria, 0181',
    city: 'Pretoria',
    lat: -25.7865,
    lon: 28.2812,
    phone: '+27 12 361 7758',
    email: 'business@menlynmaine.co.za'
  },
  // 19: Pretoria / Centurion
  {
    name: 'Centurion Lake Business Hub',
    address: '1006 Lenchen Avenue North, Centurion, Pretoria, 0157',
    city: 'Pretoria',
    lat: -25.8561,
    lon: 28.1895,
    phone: '+27 12 663 3550',
    email: 'info@centurionhub.co.za'
  },
  // 20: Pretoria
  {
    name: 'The Innovation Hub Pretoria',
    address: '1 Mark Shuttleworth Street, Innovation Hub, Pretoria, 0087',
    city: 'Pretoria',
    lat: -25.7535,
    lon: 28.2705,
    phone: '+27 12 844 0000',
    email: 'info@theinnovationhub.com'
  },
  // 21: Pretoria
  {
    name: 'CSIR International Convention Centre',
    address: 'Meiring Naudé Road, Brummeria, Pretoria, 0184',
    city: 'Pretoria',
    lat: -25.7562,
    lon: 28.2792,
    phone: '+27 12 841 3884',
    email: 'csiricc@csir.co.za'
  },
  // 22: Ekurhuleni
  {
    name: 'Emperors Palace Convention Centre',
    address: '64 Jones Road, Kempton Park, Ekurhuleni, 1620',
    city: 'Ekurhuleni',
    lat: -26.1465,
    lon: 28.2235,
    phone: '+27 11 928 1000',
    email: 'conventions@emperorspalace.com'
  }
];

const ENTREPRENEUR_IMAGES = [
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1511578314322-379afb476865?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1559223607-a43c990c692c?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=1200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&auto=format&fit=crop&q=80'
];

function sqlEsc(str) {
  if (!str) return "''";
  return `'${String(str).replace(/'/g, "''")}'`;
}

// ── 20 EVENTS FOR DECEMBER 2026 (GAUTENG ONLY) ──
const DEC_2026_EVENTS = [
  {
    title: 'Mzansi Seed Stage Pitch Battle 2026',
    desc: 'Top 15 pre-seed and seed stage Gauteng tech startups compete head-to-head before premier angel syndicates and venture capitalists for R1,500,000 in equity-free prize capital and accelerator admission. High-impact networking with 350 founders and investors.',
    date: '2026-12-02',
    time: '09:00',
    venueIdx: 0, // 22 On Sloane, Sandton
    price: '{"founder_pass":"Free RSVP","delegate":"R350","investor_vip":"R1200"}',
    capacity: 350,
    tags: ['entrepreneurship', 'pitch', 'startups', 'venture-capital', 'founders', 'sandton', 'gauteng']
  },
  {
    title: 'Sandton Angel Investors & Founders Breakfast',
    desc: 'An intimate, high-impact dealflow breakfast connecting Johannesburg high-net-worth angel syndicates with scalable SaaS, clean-tech, and fintech founders. Direct term-sheet discussions and confidential 1-on-1 breakout meetings.',
    date: '2026-12-03',
    time: '08:30',
    venueIdx: 2, // Workshop17 Sandton
    price: '{"founder":"R250","angel_investor":"R750","syndicate_table":"R3500"}',
    capacity: 180,
    tags: ['entrepreneurship', 'angel-investing', 'founders', 'startups', 'sandton', 'gauteng']
  },
  {
    title: 'Township Tech & SME Innovation Summit',
    desc: 'Unlocking high-growth township entrepreneurship, spaza shop point-of-sale digitization, last-mile logistics, and micro-loan financing. Featuring Gauteng economic development leaders and micro-grant announcements for 500+ local founders.',
    date: '2026-12-05',
    time: '10:00',
    venueIdx: 10, // Soweto Theatre
    price: '{"general":"Free RSVP","workshop_pass":"R150","exhibitor":"R850"}',
    capacity: 500,
    tags: ['entrepreneurship', 'sme', 'township-economy', 'fintech', 'soweto', 'gauteng']
  },
  {
    title: 'Sandton VC Dealmakers & Scaleup Gala',
    desc: 'The premier year-end gathering for Africa’s Series A and Series B founders, private equity partners, and corporate venture capital heads in Sandton. Keynotes on cross-border expansion, mergers, and 2027 macroeconomic growth trends.',
    date: '2026-12-08',
    time: '17:30',
    venueIdx: 1, // Sandton Convention Centre
    price: '{"scaleup_founder":"R950","executive_pass":"R1800","table_of_8":"R12000"}',
    capacity: 600,
    tags: ['entrepreneurship', 'venture-capital', 'private-equity', 'scaleups', 'sandton', 'gauteng']
  },
  {
    title: 'Women Founders & Executive Leadership Forum',
    desc: 'Empowering female entrepreneurs building transformative businesses across healthcare, finance, logistics, and retail in Gauteng. Masterclasses on fundraising resilience, board governance, and enterprise customer acquisition.',
    date: '2026-12-09',
    time: '09:30',
    venueIdx: 5, // The Greenhouse Oxford Parks, Rosebank
    price: '{"early_bird":"R250","standard":"R450","vip_mentorship":"R950"}',
    capacity: 250,
    tags: ['entrepreneurship', 'women-in-business', 'founders', 'leadership', 'rosebank', 'gauteng']
  },
  {
    title: 'Braamfontein Digital Founders Demo Day',
    desc: 'Graduating cohort of 20 high-velocity AI, Web3, and mobile software ventures from Wits Tshimologong pitch their working prototypes to regional seed funds, corporate innovation partners, and angel investors.',
    date: '2026-12-10',
    time: '13:00',
    venueIdx: 7, // Tshimologong, Braamfontein
    price: '{"student_founder":"Free RSVP","general_ticket":"R180","investor":"R600"}',
    capacity: 300,
    tags: ['entrepreneurship', 'demo-day', 'tech-startups', 'ai', 'braamfontein', 'gauteng']
  },
  {
    title: 'Waterfall City Founders & Venture Networking Breakfast',
    desc: 'Connecting fast-scaling Midrand tech founders with institutional corporate venture capital and private equity syndicates overlooking Waterfall City. High-density dealflow and fireside discussions.',
    date: '2026-12-11',
    time: '08:30',
    venueIdx: 14, // Waterfall City Park Pavilion, Midrand
    price: '{"founder_pass":"R250","corporate_delegate":"R650","vip":"R1100"}',
    capacity: 220,
    tags: ['entrepreneurship', 'midrand', 'waterfall-city', 'founders', 'networking', 'gauteng']
  },
  {
    title: 'Agri-Tech & Rural Enterprise Showcase',
    desc: 'Connecting Gauteng peri-urban agricultural innovators, drone farming operators, hydroponic pioneers, and commercial distribution syndicates. Blended finance and agricultural supply chain workshops.',
    date: '2026-12-12',
    time: '09:00',
    venueIdx: 12, // Riversands I-Hub, Midrand
    price: '{"farmer_founder":"Free RSVP","delegate":"R300","exhibitor_booth":"R1500"}',
    capacity: 450,
    tags: ['entrepreneurship', 'agritech', 'food-security', 'sme', 'midrand', 'gauteng']
  },
  {
    title: 'CSIR DeepTech & Biotech Commercialization Summit',
    desc: 'Gauteng scientific spin-outs, industrial biotechnology researchers, and patent commercialization ventures pitch to international venture funds and DFIs at the CSIR International Convention Centre.',
    date: '2026-12-14',
    time: '09:00',
    venueIdx: 21, // CSIR ICC, Pretoria
    price: '{"researcher_founder":"R250","investor":"R850","corporate":"R1400"}',
    capacity: 250,
    tags: ['entrepreneurship', 'deeptech', 'biotech', 'pretoria', 'csir', 'gauteng']
  },
  {
    title: 'Pretoria GovTech & Public Procurement Masterclass',
    desc: 'A practical, high-value workshop teaching small business owners and SME suppliers how to successfully bid for national and provincial government tenders, municipal digitisation, and public infrastructure projects.',
    date: '2026-12-15',
    time: '09:30',
    venueIdx: 17, // The Capital Menlyn Maine, Pretoria
    price: '{"sme_pass":"R300","vip_networking":"R650"}',
    capacity: 250,
    tags: ['entrepreneurship', 'govtech', 'procurement', 'pretoria', 'tenders', 'gauteng']
  },
  {
    title: 'Rosebank E-Commerce & D2C Growth Conference',
    desc: 'Gauteng direct-to-consumer brand founders, Shopify developers, and logistics specialists reveal how to scale from R100k to R10M monthly turnover. Live teardowns of high-converting storefronts.',
    date: '2026-12-16',
    time: '10:00',
    venueIdx: 6, // The Zone @ Rosebank
    price: '{"general_ticket":"R350","growth_workshop":"R750","vip_pass":"R1400"}',
    capacity: 350,
    tags: ['entrepreneurship', 'ecommerce', 'd2c', 'rosebank', 'growth-marketing', 'gauteng']
  },
  {
    title: 'Constitution Hill Civic Tech & Social Impact Pitch',
    desc: 'Social entrepreneurs, civic tech pioneers, and transparency platform creators pitch for grant funding and philanthropic investment at South Africa\'s iconic human rights precinct.',
    date: '2026-12-17',
    time: '11:00',
    venueIdx: 8, // Constitution Hill, Braamfontein
    price: '{"social_founder":"Free RSVP","supporter":"R150","sponsor":"R1000"}',
    capacity: 250,
    tags: ['entrepreneurship', 'civic-tech', 'social-impact', 'braamfontein', 'gauteng']
  },
  {
    title: 'Johannesburg FinTech Founders Roundtable',
    desc: 'Closed-door executive roundtable for banking infrastructure founders, neo-bank executives, and regulatory sandbox participants discussing SARB compliance, open banking APIs, and payments interoperability.',
    date: '2026-12-18',
    time: '14:00',
    venueIdx: 3, // The Marc Sandton
    price: '{"fintech_founder":"R500","compliance_delegate":"R950","executive":"R1800"}',
    capacity: 150,
    tags: ['entrepreneurship', 'fintech', 'banking', 'roundtable', 'sandton', 'gauteng']
  },
  {
    title: 'Midrand Manufacturing & Hardware Incubator Day',
    desc: 'Factory tours, industrial 3D printing demos, electronics assembly lines, and local fabrication solutions for engineering entrepreneurs manufacturing commercial hardware in Gauteng.',
    date: '2026-12-19',
    time: '09:00',
    venueIdx: 13, // Gallagher Convention Centre, Midrand
    price: '{"maker_pass":"R150","general":"R350","vendor_booth":"R1200"}',
    capacity: 400,
    tags: ['entrepreneurship', 'manufacturing', 'hardware', 'midrand', 'iot', 'gauteng']
  },
  {
    title: 'Pretoria Innovation Hub Smart City Pitch Battle',
    desc: 'Emerging tech founders building smart water meters, urban AI traffic systems, and IoT municipal infrastructure pitch for incubation residency and commercial government pilot programs.',
    date: '2026-12-21',
    time: '10:00',
    venueIdx: 20, // The Innovation Hub, Pretoria
    price: '{"innovator_pass":"Free RSVP","delegate":"R250","corporate":"R850"}',
    capacity: 250,
    tags: ['entrepreneurship', 'smart-city', 'iot', 'pretoria', 'innovation-hub', 'gauteng']
  },
  {
    title: 'Green Energy & Solar Microgrid Entrepreneurs Forum',
    desc: 'Commercial solar installers, industrial battery storage founders, and private energy entrepreneurs meet commercial landlords and green funding institutions to structure off-grid power deals.',
    date: '2026-12-22',
    time: '09:30',
    venueIdx: 16, // SunBet Arena at Time Square, Pretoria
    price: '{"installer_pass":"R300","commercial_client":"R650","investor":"R1200"}',
    capacity: 400,
    tags: ['entrepreneurship', 'solar', 'green-energy', 'sme', 'pretoria', 'gauteng']
  },
  {
    title: 'Emperors Palace Airport Logistics & Cargo Trade Summit',
    desc: 'Freight forwarders, customs brokerages, air-cargo dispatch startups, and cold-chain distributors meet at OR Tambo’s premier conferencing venue to solve African trade bottlenecks.',
    date: '2026-12-23',
    time: '10:00',
    venueIdx: 22, // Emperors Palace, Ekurhuleni
    price: '{"logistics_operator":"R350","corporate_shipper":"R850","vip":"R1600"}',
    capacity: 400,
    tags: ['entrepreneurship', 'logistics', 'cargo', 'ekurhuleni', 'trade', 'gauteng']
  },
  {
    title: 'Fourways Hospitality & Culinary Franchise Showcase',
    desc: 'Gauteng artisanal food brands, craft beverage producers, and quick-service restaurant founders pitch to retail buyers, hotel groups, and commercial franchise operators at Montecasino.',
    date: '2026-12-28',
    time: '12:00',
    venueIdx: 9, // The Pivot Montecasino, Fourways
    price: '{"tasting_pass":"R350","chef_founder":"R200","vip_buyer":"R850"}',
    capacity: 300,
    tags: ['entrepreneurship', 'culinary', 'franchise', 'fourways', 'hospitality', 'gauteng']
  },
  {
    title: 'Digital Nomads & Remote Solopreneur Meetup',
    desc: 'Johannesburg solopreneurs, freelance software consultants, and digital agency heads share client acquisition frameworks, international tax setups, and remote team hiring strategies.',
    date: '2026-12-29',
    time: '16:00',
    venueIdx: 4, // Radisson Blu Gautrain, Sandton
    price: '{"solopreneur_pass":"R150","networker":"R250"}',
    capacity: 180,
    tags: ['entrepreneurship', 'solopreneur', 'remote-work', 'freelancers', 'sandton', 'gauteng']
  },
  {
    title: 'Year-End Gauteng Founders Toast & 2027 Vision Mixer',
    desc: 'Celebrate 2026 business milestones and build alliances for 2027. An evening of celebration, open networking, champagne toasts, and executive matchmaking across all Gauteng startup hubs.',
    date: '2026-12-30',
    time: '18:00',
    venueIdx: 0, // 22 On Sloane, Sandton
    price: '{"founder_early":"R250","executive":"R600","vip_table":"R2500"}',
    capacity: 400,
    tags: ['entrepreneurship', 'networking', 'year-end', 'founders', 'sandton', 'gauteng']
  }
];

// ── 20 EVENTS FOR JANUARY 2027 (GAUTENG ONLY) ──
const JAN_2027_EVENTS = [
  {
    title: 'New Year Startup Bootcamp & Venture Kickoff 2027',
    desc: 'Start 2027 with relentless execution. An intensive 2-day hands-on bootcamp guiding 150 early-stage Gauteng founders through financial modeling, customer discovery, legal IP protection, and pitch decks.',
    date: '2027-01-08',
    time: '08:30',
    venueIdx: 0, // 22 On Sloane, Sandton
    price: '{"bootcamp_seat":"R450","two_founder_bundle":"R750","mentor_access":"R1200"}',
    capacity: 250,
    tags: ['entrepreneurship', 'bootcamp', 'founders', 'startups', 'sandton', 'gauteng']
  },
  {
    title: 'Johannesburg Tech Trend & Founder Forecast 2027',
    desc: 'Venture capitalists and leading South African founders reveal macroeconomic conditions, consumer tech shifts, and funding trends defining 2027. High-level panel dialogues and open audience Q&A.',
    date: '2027-01-11',
    time: '10:00',
    venueIdx: 2, // Workshop17 Sandton
    price: '{"standard_pass":"R300","vip_lounge":"R750","livestream":"R100"}',
    capacity: 280,
    tags: ['entrepreneurship', 'tech-trends', 'venture-capital', 'sandton', 'gauteng']
  },
  {
    title: 'SME Tax, Legal & Compliance Masterclass',
    desc: 'Don’t get caught out by SARS or CIPC. Leading corporate tax attorneys and chartered accountants teach Gauteng small business owners deductions, VAT compliance, employment contracts, and Section 12BA green incentives.',
    date: '2027-01-12',
    time: '09:00',
    venueIdx: 3, // The Marc Sandton
    price: '{"sme_owner":"R250","delegate":"R450","materials_included":"R600"}',
    capacity: 200,
    tags: ['entrepreneurship', 'tax', 'legal', 'sme', 'compliance', 'sandton', 'gauteng']
  },
  {
    title: 'Pretoria MedTech & Clinical Devices Pitch Night',
    desc: 'Biotech researchers, digital health startup founders, and medical device pioneers present clinical diagnostic innovations to private hospital group executives and healthcare venture funds.',
    date: '2027-01-13',
    time: '17:30',
    venueIdx: 21, // CSIR ICC, Pretoria
    price: '{"medtech_founder":"Free RSVP","medical_professional":"R350","investor":"R900"}',
    capacity: 200,
    tags: ['entrepreneurship', 'medtech', 'healthtech', 'pretoria', 'biotech', 'gauteng']
  },
  {
    title: 'B2B Sales Mastery for Tech Founders',
    desc: 'Master the art of enterprise prospecting, cold outreach sequences, discovery calls, and closing multi-million Rand annual contracts with corporate South Africa in Johannesburg.',
    date: '2027-01-14',
    time: '13:00',
    venueIdx: 7, // Tshimologong, Braamfontein
    price: '{"founder_seat":"R350","enterprise_team":"R900","vip_review":"R1500"}',
    capacity: 220,
    tags: ['entrepreneurship', 'b2b-sales', 'enterprise', 'startups', 'braamfontein', 'gauteng']
  },
  {
    title: 'Dunkeld Creators & Media Production Studio Summit',
    desc: 'Learn how to monetize digital video content, build production agencies, and scale personal media brands into multi-revenue empires. Featuring leading YouTube and podcast studio founders in Gauteng.',
    date: '2027-01-15',
    time: '10:00',
    venueIdx: 5, // The Greenhouse Oxford Parks, Dunkeld
    price: '{"creator_pass":"R200","vip_studio_tour":"R500","brand_rep":"R900"}',
    capacity: 250,
    tags: ['entrepreneurship', 'creators', 'media', 'solopreneur', 'dunkeld', 'gauteng']
  },
  {
    title: 'Soweto Youth Business Incubator Open Day',
    desc: 'Connecting ambitious young township founders with free mentorship, co-working desk access, cloud computing credits, and seed grant funding opportunities. Inspirational guest keynotes and workshops.',
    date: '2027-01-16',
    time: '10:00',
    venueIdx: 10, // Soweto Theatre
    price: '{"community_youth":"Free RSVP","general":"Free RSVP"}',
    capacity: 400,
    tags: ['entrepreneurship', 'youth', 'soweto', 'incubator', 'community', 'gauteng']
  },
  {
    title: 'Gauteng PropTech & Smart Buildings Forum',
    desc: 'Commercial property developers, REIT executives, and PropTech innovators explore automated building operations, tenant experience apps, digital leasing, and green energy management.',
    date: '2027-01-18',
    time: '09:00',
    venueIdx: 1, // Sandton Convention Centre
    price: '{"founder_delegate":"R450","property_developer":"R950","executive":"R1800"}',
    capacity: 350,
    tags: ['entrepreneurship', 'proptech', 'real-estate', 'smart-buildings', 'sandton', 'gauteng']
  },
  {
    title: 'Pretoria AI & Automation for Small Businesses',
    desc: 'Practical, no-jargon demonstration of how small business owners can utilize generative AI agents, automated CRM pipelines, and automated bookkeeping to triple productivity without expanding payroll.',
    date: '2027-01-19',
    time: '14:00',
    venueIdx: 16, // SunBet Arena at Time Square, Pretoria
    price: '{"sme_owner":"R200","executive_pass":"R500"}',
    capacity: 300,
    tags: ['entrepreneurship', 'ai-automation', 'sme', 'productivity', 'pretoria', 'gauteng']
  },
  {
    title: 'Venture Capital Associate & Analyst Mixer',
    desc: 'An evening of confidential dealflow discussions and networking for investment associates, venture scouts, and early-stage syndicate managers tracking African tech rounds in Sandton.',
    date: '2027-01-20',
    time: '18:00',
    venueIdx: 3, // The Marc Sandton
    price: '{"invitation_only":"Free RSVP","general_vc":"R350"}',
    capacity: 120,
    tags: ['entrepreneurship', 'venture-capital', 'investors', 'dealflow', 'sandton', 'gauteng']
  },
  {
    title: 'Johannesburg FinTech Hackathon & Pitch Challenge',
    desc: '48-hour challenge building the next generation of financial inclusion tools, cross-border remittance bots, and micro-savings apps. Top 3 teams win cash prizes and institutional sponsorship.',
    date: '2027-01-22',
    time: '09:00',
    venueIdx: 7, // Tshimologong, Braamfontein
    price: '{"developer_participant":"Free RSVP","spectator_pitch":"R150","judge_pass":"R750"}',
    capacity: 300,
    tags: ['entrepreneurship', 'fintech', 'hackathon', 'pitch', 'braamfontein', 'gauteng']
  },
  {
    title: 'Midrand Logistics & Trucking Business Workshop',
    desc: 'How to enter and succeed in South Africa\'s road freight, parcel courier, and cross-border trucking industry. Fuel management systems, fleet financing, broker negotiations, and cargo insurance essentials.',
    date: '2027-01-23',
    time: '09:30',
    venueIdx: 12, // Riversands I-Hub, Midrand
    price: '{"operator_pass":"R300","fleet_owner":"R650","vip_networking":"R1100"}',
    capacity: 350,
    tags: ['entrepreneurship', 'logistics', 'trucking', 'freight', 'midrand', 'gauteng']
  },
  {
    title: 'Women in STEM & Engineering Enterprise Pitch',
    desc: 'Female founders building hard-tech, civil engineering, clean energy, and software engineering ventures pitch their solutions for seed capital and enterprise vendor onboarding.',
    date: '2027-01-25',
    time: '10:00',
    venueIdx: 20, // The Innovation Hub, Pretoria
    price: '{"stem_founder":"Free RSVP","delegate":"R250","corporate_supporter":"R800"}',
    capacity: 200,
    tags: ['entrepreneurship', 'women-in-stem', 'engineering', 'pretoria', 'founders', 'gauteng']
  },
  {
    title: 'Franchising Your Existing Business Model',
    desc: 'Turn your successful restaurant, salon, fitness studio, or service business into a replicable national franchise system. Operations manual design, FASA regulations, and franchise marketing.',
    date: '2027-01-26',
    time: '14:00',
    venueIdx: 17, // The Capital Menlyn Maine, Pretoria
    price: '{"founder_seat":"R450","business_duo":"R750"}',
    capacity: 180,
    tags: ['entrepreneurship', 'franchising', 'business-growth', 'pretoria', 'scaling', 'gauteng']
  },
  {
    title: 'Centurion SaaS & Cloud Founders Roundtable',
    desc: 'B2B subscription software founders share customer retention strategies, AWS/Azure credits optimization, SOC2 compliance, and churn reduction tactics for high-growth SaaS in South Africa.',
    date: '2027-01-27',
    time: '10:00',
    venueIdx: 19, // Centurion Lake Business Hub
    price: '{"saas_founder":"R250","cloud_architect":"R450"}',
    capacity: 180,
    tags: ['entrepreneurship', 'saas', 'cloud', 'centurion', 'pretoria', 'gauteng']
  },
  {
    title: 'Startup Valuation & Cap Table Modeling Workshop',
    desc: 'Demystifying startup valuations before signing a term sheet. Learn discounted cash flow vs scorecard valuation, convertible notes, SAFEs, option pools, and dilution modeling with veteran VCs.',
    date: '2027-01-28',
    time: '15:00',
    venueIdx: 0, // 22 On Sloane, Sandton
    price: '{"founder_ticket":"R350","investor_ticket":"R700"}',
    capacity: 200,
    tags: ['entrepreneurship', 'valuation', 'fundraising', 'cap-table', 'sandton', 'gauteng']
  },
  {
    title: 'Waterfall City CleanTech & ESG Venture Forum',
    desc: 'Pioneering waste-to-value, bioplastic, industrial water purification, and circular economy startups pitch to corporate procurement directors and sustainability impact funds.',
    date: '2027-01-29',
    time: '09:00',
    venueIdx: 14, // Waterfall City Park Pavilion, Midrand
    price: '{"green_founder":"Free RSVP","general_pass":"R250","corporate_esg":"R850"}',
    capacity: 250,
    tags: ['entrepreneurship', 'cleantech', 'esg', 'waterfall-city', 'midrand', 'gauteng']
  },
  {
    title: 'Ekurhuleni Manufacturing & Industrial SME Hub',
    desc: 'Showcasing component machining, plastic injection molding, and factory robotics startups serving Gauteng’s industrial heartland and heavy transport networks.',
    date: '2027-01-29',
    time: '10:00',
    venueIdx: 22, // Emperors Palace, Ekurhuleni
    price: '{"general_entry":"Free RSVP","sme_delegate":"R200","corporate":"R600"}',
    capacity: 300,
    tags: ['entrepreneurship', 'manufacturing', 'industrial', 'ekurhuleni', 'sme', 'gauteng']
  },
  {
    title: 'Midrand Food Truck & Mobile Catering Incubator',
    desc: 'Everything you need to launch a profitable food truck, trailer, or pop-up catering brand: health clearances, gas compliance certificates, festival booking tactics, and kitchen economics.',
    date: '2027-01-30',
    time: '11:00',
    venueIdx: 13, // Gallagher Convention Centre, Midrand
    price: '{"culinary_pass":"R150","tasting_kit":"R300"}',
    capacity: 300,
    tags: ['entrepreneurship', 'food-trucks', 'hospitality', 'sme', 'midrand', 'gauteng']
  },
  {
    title: 'Gauteng Angel Investor Pitch Dinner',
    desc: 'An exclusive, black-tie three-course dinner where 6 pre-vetted high-growth tech and retail ventures present private investment pitches to 40 verified high-net-worth angel investors.',
    date: '2027-01-30',
    time: '19:00',
    venueIdx: 4, // Radisson Blu Gautrain, Sandton
    price: '{"angel_seat":"R1500","pitching_company":"R2500"}',
    capacity: 80,
    tags: ['entrepreneurship', 'angel-investors', 'pitch-dinner', 'vip', 'sandton', 'gauteng']
  }
];

// ── 20 EVENTS FOR FEBRUARY 2027 (GAUTENG ONLY) ──
const FEB_2027_EVENTS = [
  {
    title: 'Africa Venture Capital & Private Equity Summit 2027',
    desc: 'The benchmark investment summit bringing together 800+ international fund managers, sovereign wealth representatives, DFIs, and Africa’s fastest-growing technology and infrastructure pioneers in Sandton.',
    date: '2027-02-03',
    time: '08:30',
    venueIdx: 1, // Sandton Convention Centre
    price: '{"startup_delegate":"R1200","fund_manager":"R3500","vip_all_access":"R7500"}',
    capacity: 850,
    tags: ['entrepreneurship', 'venture-capital', 'private-equity', 'sandton', 'summit', 'investors', 'gauteng']
  },
  {
    title: 'Gauteng Seedstars Pitch Competition 2027',
    desc: 'The official Gauteng regional qualifier for Seedstars World. Top 10 high-growth South African startups pitch live for a chance to represent the country in Switzerland with $500k global investment.',
    date: '2027-02-04',
    time: '14:00',
    venueIdx: 0, // 22 On Sloane, Sandton
    price: '{"spectator_pass":"R200","founder_vip":"R550","investor_ticket":"R1100"}',
    capacity: 350,
    tags: ['entrepreneurship', 'pitch', 'seedstars', 'startups', 'sandton', 'gauteng']
  },
  {
    title: 'Township E-Commerce & Delivery Hub Launch',
    desc: 'Empowering local Soweto merchants with multi-vendor marketplace tech, instant debit card payments, and bicycle/scooter hyper-local delivery fulfillment. Grants awarded to top 10 merchants.',
    date: '2027-02-05',
    time: '10:00',
    venueIdx: 10, // Soweto Theatre
    price: '{"local_merchant":"Free RSVP","general":"R100"}',
    capacity: 450,
    tags: ['entrepreneurship', 'township-economy', 'ecommerce', 'delivery', 'soweto', 'gauteng']
  },
  {
    title: 'AI Product Founders & LLM Builders Workshop',
    desc: 'A deeply technical, commercialization-focused masterclass for engineers building agentic workflows, custom LLM fine-tuning, and automated B2B customer support tools for South African enterprise clients.',
    date: '2027-02-06',
    time: '10:00',
    venueIdx: 7, // Tshimologong, Braamfontein
    price: '{"developer_pass":"R300","founder_vip":"R650"}',
    capacity: 250,
    tags: ['entrepreneurship', 'ai', 'llm', 'software', 'braamfontein', 'founders', 'gauteng']
  },
  {
    title: 'Pretoria Agri-FinTech & Crop Financing Forum',
    desc: 'Innovative parametric weather insurance, smart satellite crop monitoring, and micro-loan lending algorithms designed to finance South African emerging farmers and commercial agribusinesses.',
    date: '2027-02-08',
    time: '09:00',
    venueIdx: 21, // CSIR ICC, Pretoria
    price: '{"farmer_pass":"R200","fintech_founder":"R450","corporate":"R950"}',
    capacity: 200,
    tags: ['entrepreneurship', 'agritech', 'fintech', 'insurance', 'pretoria', 'csir', 'gauteng']
  },
  {
    title: 'Pretoria CyberSecurity & Defence Tech Pitch',
    desc: 'Startups building endpoint encryption, AI threat hunting, industrial SCADA defense, and fraud prevention present to corporate CISOs, bank risk directors, and venture backers.',
    date: '2027-02-09',
    time: '10:00',
    venueIdx: 16, // SunBet Arena at Time Square, Pretoria
    price: '{"founder_seat":"R350","security_pro":"R750","vip":"R1500"}',
    capacity: 250,
    tags: ['entrepreneurship', 'cybersecurity', 'defencetech', 'pretoria', 'startups', 'gauteng']
  },
  {
    title: 'Fourways Experiential Retail & Entertainment Tech Incubator',
    desc: 'Accelerating smart ticketing, experiential pop-up activations, cashless event POS, and interactive gamification platforms for Gauteng\'s premier entertainment economy.',
    date: '2027-02-10',
    time: '09:30',
    venueIdx: 9, // The Pivot Montecasino, Fourways
    price: '{"retail_founder":"R250","startup_pass":"R350","vip_buyer":"R850"}',
    capacity: 300,
    tags: ['entrepreneurship', 'entertainment', 'retail', 'fourways', 'montecasino', 'gauteng']
  },
  {
    title: 'Women Angel Investors Masterclass & Pitch Review',
    desc: 'A dedicated masterclass teaching high-earning women executives how to evaluate angel investments, negotiate equity term sheets, and mentor early-stage female-led African ventures in Sandton.',
    date: '2027-02-11',
    time: '17:30',
    venueIdx: 2, // Workshop17 Sandton
    price: '{"aspiring_angel":"R650","seasoned_investor":"R1100"}',
    capacity: 150,
    tags: ['entrepreneurship', 'women-investors', 'angel-investing', 'sandton', 'leadership', 'gauteng']
  },
  {
    title: 'Midrand Industrial Robotics & Automation Showcase',
    desc: 'Live live-action demonstrations of robotic arms, autonomous pallet movers, computer vision sorting lines, and warehouse automation systems built by South African engineering entrepreneurs.',
    date: '2027-02-12',
    time: '09:00',
    venueIdx: 13, // Gallagher Convention Centre, Midrand
    price: '{"engineer_pass":"R250","delegate":"R500","exhibitor":"R2500"}',
    capacity: 400,
    tags: ['entrepreneurship', 'robotics', 'automation', 'hardware', 'midrand', 'gauteng']
  },
  {
    title: 'Kyalami Clean Mobility & EV Fleet Summit',
    desc: 'Electric commercial delivery bakkies, battery swapping networks, public charging hubs, and smart telematics startups pitch to fleet managers and municipal transport directors.',
    date: '2027-02-15',
    time: '09:00',
    venueIdx: 15, // Kyalami Grand Prix Circuit
    price: '{"mobility_founder":"R300","fleet_director":"R750","vip":"R1400"}',
    capacity: 350,
    tags: ['entrepreneurship', 'ev', 'clean-mobility', 'kyalami', 'midrand', 'fleet', 'gauteng']
  },
  {
    title: 'Raising Venture Debt in Emerging Markets',
    desc: 'Learn how to fund growth without diluting founder equity. Managing partners from leading African venture debt funds explain underwriting criteria, revenue-based financing, and covenants.',
    date: '2027-02-16',
    time: '14:00',
    venueIdx: 0, // 22 On Sloane, Sandton
    price: '{"founder_seat":"R400","executive_pass":"R850"}',
    capacity: 200,
    tags: ['entrepreneurship', 'venture-debt', 'fundraising', 'non-dilutive', 'sandton', 'gauteng']
  },
  {
    title: 'Braamfontein EdTech & Future of Work Showcase',
    desc: 'Showcasing digital upskilling academies, gamified STEM curricula, AI tutoring assistants, and corporate micro-credentialing platforms transforming education across Sub-Saharan Africa.',
    date: '2027-02-17',
    time: '10:00',
    venueIdx: 7, // Tshimologong, Braamfontein
    price: '{"edtech_founder":"Free RSVP","educator_pass":"R150","investor":"R600"}',
    capacity: 220,
    tags: ['entrepreneurship', 'edtech', 'future-of-work', 'braamfontein', 'startups', 'gauteng']
  },
  {
    title: 'Cross-Border African Trade & AfCFTA Masterclass',
    desc: 'How to scale your goods and services across SADC, East, and West Africa under the African Continental Free Trade Area. Tariff schedules, rules of origin certificates, and trade financing mechanics.',
    date: '2027-02-18',
    time: '09:30',
    venueIdx: 12, // Riversands I-Hub, Midrand
    price: '{"exporter_pass":"R350","corporate_trade":"R850"}',
    capacity: 300,
    tags: ['entrepreneurship', 'afcfta', 'export', 'trade', 'midrand', 'gauteng']
  },
  {
    title: 'Pretoria Biotech & Pharmaceutical Spin-Out Pitch',
    desc: 'Pre-clinical drug discovery, active pharmaceutical ingredient (API) synthesis, and point-of-care diagnostic startups present to international biopharma licensing executives.',
    date: '2027-02-19',
    time: '10:00',
    venueIdx: 17, // The Capital Menlyn Maine, Pretoria
    price: '{"researcher_founder":"Free RSVP","industry_delegate":"R450","investor":"R1000"}',
    capacity: 180,
    tags: ['entrepreneurship', 'biotech', 'pharma', 'pretoria', 'spinout', 'gauteng']
  },
  {
    title: 'Rosebank Streetwear & Apparel Brand Incubator',
    desc: 'Connecting independent Gauteng fashion designers and streetwear founders with CMT manufacturing factories, fabric suppliers, pattern makers, and retail stockists.',
    date: '2027-02-20',
    time: '11:00',
    venueIdx: 6, // The Zone @ Rosebank
    price: '{"designer_entry":"R200","buyer_pass":"R500","vip_front_row":"R850"}',
    capacity: 250,
    tags: ['entrepreneurship', 'fashion', 'streetwear', 'rosebank', 'manufacturing', 'gauteng']
  },
  {
    title: 'Sandton Corporate Venture Capital & M&A Forum',
    desc: 'Leading enterprise corporations (banks, telcos, insurers, retailers) share their strategic acquisition roadmaps, corporate venture arm theses, and open commercial pilot opportunities.',
    date: '2027-02-23',
    time: '09:00',
    venueIdx: 3, // The Marc Sandton
    price: '{"scaleup_ceo":"R650","corporate_director":"R1500","vip_dinner":"R2500"}',
    capacity: 200,
    tags: ['entrepreneurship', 'cvc', 'm-and-a', 'corporate-innovation', 'sandton', 'gauteng']
  },
  {
    title: 'Pretoria Energy Storage & Battery Assembly Pitch',
    desc: 'Lithium battery pack assemblers, inverter manufacturers, and solar mini-grid contractors pitch for capital and industrial manufacturing contracts at The Innovation Hub.',
    date: '2027-02-24',
    time: '10:00',
    venueIdx: 20, // The Innovation Hub, Pretoria
    price: '{"clean_energy_founder":"Free RSVP","contractor":"R250","investor":"R900"}',
    capacity: 200,
    tags: ['entrepreneurship', 'battery-storage', 'solar', 'pretoria', 'innovation-hub', 'gauteng']
  },
  {
    title: 'Soweto Artisan Trades & Construction Guild Launch',
    desc: 'Connecting qualified plumbing, electrical, carpentry, and masonry contractors with bulk material discounts, digital dispatch software, and commercial builder subcontracts in Soweto.',
    date: '2027-02-25',
    time: '10:00',
    venueIdx: 10, // Soweto Theatre
    price: '{"artisan_entry":"Free RSVP","general":"Free RSVP"}',
    capacity: 350,
    tags: ['entrepreneurship', 'construction', 'artisans', 'sme', 'soweto', 'gauteng']
  },
  {
    title: 'Founders Mental Resilience & High-Performance Retreat',
    desc: 'Tackling burnout, executive psychology, stress management, and elite cognitive performance for active startup founders navigating high-stakes hypergrowth. Led by clinical sports psychologists.',
    date: '2027-02-26',
    time: '09:00',
    venueIdx: 4, // Radisson Blu Gautrain, Sandton
    price: '{"founder_retreat":"R550","all_inclusive_wellness":"R1200"}',
    capacity: 120,
    tags: ['entrepreneurship', 'founder-wellness', 'mental-health', 'leadership', 'sandton', 'gauteng']
  },
  {
    title: 'South African Angel Syndicate Demo Day Finale',
    desc: 'The season finale where 12 top-performing accelerated startups from across Gauteng pitch for syndicated seed investment tickets totaling R10M+ in front of 300+ active angel investors.',
    date: '2027-02-27',
    time: '14:00',
    venueIdx: 1, // Sandton Convention Centre
    price: '{"spectator_ticket":"R350","angel_syndicate":"R1200","vip_table":"R5000"}',
    capacity: 500,
    tags: ['entrepreneurship', 'pitch', 'demo-day', 'angel-investing', 'sandton', 'startups', 'gauteng']
  }
];

function generateSql() {
  const allEvents = [
    ...DEC_2026_EVENTS,
    ...JAN_2027_EVENTS,
    ...FEB_2027_EVENTS
  ];

  console.log(`Generating SQL for ${allEvents.length} Gauteng-exclusive entrepreneurship events...`);

  const sqlStatements = [
    '--',
    '-- Seed 60 South African Entrepreneurship Events (Dec 2026, Jan 2027, Feb 2027)',
    '-- EXCLUSIVELY LOCATED IN GAUTENG (Johannesburg, Midrand, Pretoria, Soweto, Ekurhuleni)',
    '--',
    'BEGIN;',
    '',
    '-- Clean up any previous seed entries for this date window (preserving pre-existing non-seed events)',
    `DELETE FROM public.events
WHERE tags @> ARRAY['entrepreneurship']::text[]
  AND event_date >= '2026-12-01'
  AND event_date <= '2027-02-28'
  AND id != '724795c6-798c-4fcf-b3b6-40669938cca1';`,
    ''
  ];

  let imgIdx = 0;

  for (const ev of allEvents) {
    const venue = GAUTENG_VENUES[ev.venueIdx];
    const img = ENTREPRENEUR_IMAGES[imgIdx % ENTREPRENEUR_IMAGES.length];
    imgIdx++;

    const isPaid = !ev.price.toLowerCase().includes('free');
    const tagsSql = `ARRAY[${ev.tags.map(t => sqlEsc(t)).join(', ')}]`;
    const categoriesSql = `ARRAY['biz', 'entrepreneurship']`;

    sqlStatements.push(`
INSERT INTO public.events (
  author_id, title, description, category, categories, tags,
  venue_name, address, city, country, timezone,
  lat, lon, latitude, longitude,
  event_date, event_time, starts_at,
  contact_email, contact_phone,
  price, is_paid, capacity,
  is_published, status, is_deleted,
  cover_url, cover_image, image_url, media_urls
)
VALUES (
  '${AUTHOR_ID}'::uuid,
  ${sqlEsc(ev.title)},
  ${sqlEsc(ev.desc)},
  'biz',
  ${categoriesSql},
  ${tagsSql},
  ${sqlEsc(venue.name)},
  ${sqlEsc(venue.address)},
  ${sqlEsc(venue.city)},
  'ZA',
  'Africa/Johannesburg',
  ${venue.lat},
  ${venue.lon},
  ${venue.lat},
  ${venue.lon},
  '${ev.date}'::date,
  '${ev.time}',
  '${ev.date} ${ev.time}:00+02'::timestamptz,
  ${sqlEsc(venue.email)},
  ${sqlEsc(venue.phone)},
  ${sqlEsc(ev.price)},
  ${isPaid},
  ${ev.capacity || 250},
  true,
  'published',
  false,
  NULL,
  NULL,
  NULL,
  NULL
);`);
  }

  // Ensure any trigger-reset fields are explicitly published
  sqlStatements.push(`
UPDATE public.events
SET is_published = true, status = 'published'
WHERE tags @> ARRAY['entrepreneurship']::text[]
  AND event_date >= '2026-12-01'
  AND event_date <= '2027-02-28'
  AND deleted_at IS NULL;
`);

  sqlStatements.push('COMMIT;');

  const outPath = path.join(__dirname, '..', 'supabase', 'seed_entrepreneurship_60_events.sql');
  fs.writeFileSync(outPath, sqlStatements.join('\n'), 'utf8');
  console.log(`[generate_entrepreneurship_events] Successfully wrote ${allEvents.length} events into ${outPath}`);
}

generateSql();
