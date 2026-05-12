// ─────────────────────────────────────────────────────────────────────────────
//  LOCATION HIERARCHY
//  Levels: Neighbourhood → City/Town → Municipality → Province → Country →
//          Subregion → Continent → Planet
// ─────────────────────────────────────────────────────────────────────────────

export const LOCATION_LEVELS = [
  'neighbourhood', 'city', 'municipality', 'province', 'country', 'continent', 'planet',
];

export const LOCATION_HIERARCHY = [
  // ── PLANET ──────────────────────────────────────────────────────────────────
  {
    label: 'Earth', level: 'planet',
    children: [
      // ── AFRICA ────────────────────────────────────────────────────────────
      {
        label: 'Africa', level: 'continent',
        children: [
          // ── SOUTHERN AFRICA ───────────────────────────────────────────────
          {
            label: 'South Africa', level: 'country', code: 'ZA',
            children: [
              // GAUTENG
              {
                label: 'Gauteng', level: 'province',
                children: [
                  {
                    label: 'City of Johannesburg', level: 'municipality',
                    children: [
                      // Inner City / South
                      { label: 'Johannesburg CBD', level: 'city' },
                      { label: 'Newtown', level: 'neighbourhood' },
                      { label: 'Braamfontein', level: 'neighbourhood' },
                      { label: 'Maboneng', level: 'neighbourhood' },
                      { label: 'Jeppestown', level: 'neighbourhood' },
                      { label: 'Doornfontein', level: 'neighbourhood' },
                      { label: 'Hillbrow', level: 'neighbourhood' },
                      { label: 'Berea', level: 'neighbourhood' },
                      { label: 'Yeoville', level: 'neighbourhood' },
                      { label: 'Troyeville', level: 'neighbourhood' },
                      // North
                      { label: 'Sandton', level: 'city' },
                      { label: 'Rosebank', level: 'neighbourhood' },
                      { label: 'Melrose', level: 'neighbourhood' },
                      { label: 'Illovo', level: 'neighbourhood' },
                      { label: 'Hyde Park', level: 'neighbourhood' },
                      { label: 'Fourways', level: 'neighbourhood' },
                      { label: 'Lonehill', level: 'neighbourhood' },
                      { label: 'Sunninghill', level: 'neighbourhood' },
                      { label: 'Rivonia', level: 'neighbourhood' },
                      { label: 'Morningside', level: 'neighbourhood' },
                      { label: 'Parktown', level: 'neighbourhood' },
                      { label: 'Greenside', level: 'neighbourhood' },
                      { label: 'Parkhurst', level: 'neighbourhood' },
                      { label: 'Craighall', level: 'neighbourhood' },
                      { label: 'Northcliff', level: 'neighbourhood' },
                      { label: 'Randburg', level: 'city' },
                      { label: 'Roodepoort', level: 'city' },
                      { label: 'Florida', level: 'neighbourhood' },
                      { label: 'Honeydew', level: 'neighbourhood' },
                      // South / Soweto
                      { label: 'Soweto', level: 'city' },
                      { label: 'Meadowlands', level: 'neighbourhood' },
                      { label: 'Dobsonville', level: 'neighbourhood' },
                      { label: 'Orlando', level: 'neighbourhood' },
                      { label: 'Diepkloof', level: 'neighbourhood' },
                      { label: 'Naledi', level: 'neighbourhood' },
                      { label: 'Protea Glen', level: 'neighbourhood' },
                      { label: 'Eldorado Park', level: 'neighbourhood' },
                      { label: 'Lenasia', level: 'neighbourhood' },
                      { label: 'Johannesburg South', level: 'city' },
                      { label: 'Booysens', level: 'neighbourhood' },
                      { label: 'Turffontein', level: 'neighbourhood' },
                      { label: 'Rosettenville', level: 'neighbourhood' },
                      { label: 'Ennerdale', level: 'neighbourhood' },
                      // East
                      { label: 'Eastrand', level: 'city' },
                      { label: 'Edenvale', level: 'neighbourhood' },
                      { label: 'Bedfordview', level: 'neighbourhood' },
                    ],
                  },
                  {
                    label: 'City of Tshwane (Pretoria)', level: 'municipality',
                    children: [
                      { label: 'Pretoria CBD', level: 'city' },
                      { label: 'Hatfield', level: 'neighbourhood' },
                      { label: 'Arcadia', level: 'neighbourhood' },
                      { label: 'Menlyn', level: 'neighbourhood' },
                      { label: 'Centurion', level: 'city' },
                      { label: 'Sunnyside', level: 'neighbourhood' },
                      { label: 'Pretoria North', level: 'neighbourhood' },
                      { label: 'Pretoria East', level: 'neighbourhood' },
                      { label: 'Pretoria West', level: 'neighbourhood' },
                      { label: 'Atteridgeville', level: 'neighbourhood' },
                      { label: 'Mamelodi', level: 'neighbourhood' },
                      { label: 'Silverton', level: 'neighbourhood' },
                      { label: 'Garsfontein', level: 'neighbourhood' },
                      { label: 'Montana', level: 'neighbourhood' },
                      { label: 'Moot', level: 'neighbourhood' },
                    ],
                  },
                  {
                    label: 'Ekurhuleni', level: 'municipality',
                    children: [
                      { label: 'Boksburg', level: 'city' },
                      { label: 'Benoni', level: 'city' },
                      { label: 'Germiston', level: 'city' },
                      { label: 'Kempton Park', level: 'city' },
                      { label: 'Alberton', level: 'city' },
                      { label: 'Springs', level: 'city' },
                      { label: 'Brakpan', level: 'city' },
                      { label: 'Tembisa', level: 'neighbourhood' },
                      { label: 'Daveyton', level: 'neighbourhood' },
                      { label: 'Duduza', level: 'neighbourhood' },
                      { label: 'Katlehong', level: 'neighbourhood' },
                      { label: 'Thokoza', level: 'neighbourhood' },
                      { label: 'Vosloorus', level: 'neighbourhood' },
                    ],
                  },
                  {
                    label: 'West Rand', level: 'municipality',
                    children: [
                      { label: 'Krugersdorp', level: 'city' },
                      { label: 'Randfontein', level: 'city' },
                      { label: 'Westonaria', level: 'city' },
                      { label: 'Carletonville', level: 'city' },
                    ],
                  },
                  {
                    label: 'Midrand', level: 'city',
                    children: [
                      { label: 'Ivory Park', level: 'neighbourhood' },
                      { label: 'Halfway House', level: 'neighbourhood' },
                      { label: 'Carlswald', level: 'neighbourhood' },
                      { label: 'Noordwyk', level: 'neighbourhood' },
                      { label: 'Vorna Valley', level: 'neighbourhood' },
                      { label: 'Waterfall City', level: 'neighbourhood' },
                      { label: 'Kyalami', level: 'neighbourhood' },
                      { label: 'Winnie Mandela (Winnie Mabhida)', level: 'neighbourhood' },
                      { label: 'Tembisa (Midrand side)', level: 'neighbourhood' },
                      { label: 'The Boulders', level: 'neighbourhood' },
                      { label: 'Sagewood', level: 'neighbourhood' },
                      { label: 'Jukskei Park', level: 'neighbourhood' },
                      { label: 'Campton Park', level: 'neighbourhood' },
                      { label: 'Olifantsfontein', level: 'neighbourhood' },
                    ],
                  },
                ],
              },
              // WESTERN CAPE
              {
                label: 'Western Cape', level: 'province',
                children: [
                  {
                    label: 'City of Cape Town', level: 'municipality',
                    children: [
                      { label: 'Cape Town CBD', level: 'city' },
                      { label: 'Waterfront', level: 'neighbourhood' },
                      { label: 'Gardens', level: 'neighbourhood' },
                      { label: 'Woodstock', level: 'neighbourhood' },
                      { label: 'Observatory', level: 'neighbourhood' },
                      { label: 'Salt River', level: 'neighbourhood' },
                      { label: 'Bellville', level: 'city' },
                      { label: 'Parow', level: 'neighbourhood' },
                      { label: 'Goodwood', level: 'neighbourhood' },
                      { label: 'Mitchells Plain', level: 'neighbourhood' },
                      { label: 'Khayelitsha', level: 'neighbourhood' },
                      { label: 'Gugulethu', level: 'neighbourhood' },
                      { label: 'Langa', level: 'neighbourhood' },
                      { label: 'Athlone', level: 'neighbourhood' },
                      { label: 'Atlantis', level: 'neighbourhood' },
                      { label: 'Hout Bay', level: 'neighbourhood' },
                      { label: 'Constantia', level: 'neighbourhood' },
                      { label: 'Camps Bay', level: 'neighbourhood' },
                      { label: 'Sea Point', level: 'neighbourhood' },
                      { label: 'Green Point', level: 'neighbourhood' },
                      { label: 'De Waterkant', level: 'neighbourhood' },
                      { label: 'Milnerton', level: 'neighbourhood' },
                      { label: 'Durbanville', level: 'city' },
                      { label: 'Somerset West', level: 'city' },
                      { label: 'Stellenbosch', level: 'city' },
                      { label: 'Paarl', level: 'city' },
                    ],
                  },
                ],
              },
              // KWA-ZULU NATAL
              {
                label: 'KwaZulu-Natal', level: 'province',
                children: [
                  {
                    label: 'eThekwini (Durban)', level: 'municipality',
                    children: [
                      { label: 'Durban CBD', level: 'city' },
                      { label: 'Berea (Durban)', level: 'neighbourhood' },
                      { label: 'Glenwood', level: 'neighbourhood' },
                      { label: 'Musgrave', level: 'neighbourhood' },
                      { label: 'Point', level: 'neighbourhood' },
                      { label: 'Pinetown', level: 'city' },
                      { label: 'Phoenix', level: 'neighbourhood' },
                      { label: 'KwaMashu', level: 'neighbourhood' },
                      { label: 'Umlazi', level: 'neighbourhood' },
                      { label: 'Chatsworth', level: 'neighbourhood' },
                      { label: 'Tongaat', level: 'city' },
                      { label: 'Amanzimtoti', level: 'city' },
                    ],
                  },
                  { label: 'Pietermaritzburg', level: 'city' },
                  { label: 'Richards Bay', level: 'city' },
                  { label: 'Newcastle', level: 'city' },
                  { label: 'Ladysmith', level: 'city' },
                ],
              },
              // EASTERN CAPE
              {
                label: 'Eastern Cape', level: 'province',
                children: [
                  { label: 'Gqeberha (Port Elizabeth)', level: 'city' },
                  { label: 'East London', level: 'city' },
                  { label: 'Mthatha', level: 'city' },
                  { label: 'Grahamstown (Makhanda)', level: 'city' },
                  { label: 'Queenstown', level: 'city' },
                  { label: 'King William\'s Town', level: 'city' },
                ],
              },
              // LIMPOPO
              {
                label: 'Limpopo', level: 'province',
                children: [
                  { label: 'Polokwane', level: 'city' },
                  { label: 'Tzaneen', level: 'city' },
                  { label: 'Phalaborwa', level: 'city' },
                  { label: 'Mokopane', level: 'city' },
                  { label: 'Louis Trichardt', level: 'city' },
                  { label: 'Bela-Bela (Warmbaths)', level: 'city' },
                  { label: 'Thulamela', level: 'municipality' },
                  { label: 'Seshego', level: 'neighbourhood' },
                ],
              },
              // MPUMALANGA
              {
                label: 'Mpumalanga', level: 'province',
                children: [
                  { label: 'Nelspruit (Mbombela)', level: 'city' },
                  { label: 'Witbank (eMalahleni)', level: 'city' },
                  { label: 'Middelburg', level: 'city' },
                  { label: 'Secunda', level: 'city' },
                  { label: 'Barberton', level: 'city' },
                  { label: 'Ermelo', level: 'city' },
                ],
              },
              // NORTH WEST
              {
                label: 'North West', level: 'province',
                children: [
                  { label: 'Mahikeng', level: 'city' },
                  { label: 'Rustenburg', level: 'city' },
                  { label: 'Klerksdorp', level: 'city' },
                  { label: 'Potchefstroom', level: 'city' },
                  { label: 'Brits', level: 'city' },
                ],
              },
              // FREE STATE
              {
                label: 'Free State', level: 'province',
                children: [
                  { label: 'Bloemfontein', level: 'city' },
                  { label: 'Welkom', level: 'city' },
                  { label: 'Kroonstad', level: 'city' },
                  { label: 'Sasolburg', level: 'city' },
                  { label: 'Phuthaditjhaba', level: 'city' },
                ],
              },
              // NORTHERN CAPE
              {
                label: 'Northern Cape', level: 'province',
                children: [
                  { label: 'Kimberley', level: 'city' },
                  { label: 'Upington', level: 'city' },
                  { label: 'Springbok', level: 'city' },
                  { label: 'De Aar', level: 'city' },
                ],
              },
            ],
          },
          // NEIGHBOURING COUNTRIES
          {
            label: 'Namibia', level: 'country', code: 'NA',
            children: [
              { label: 'Windhoek', level: 'city' },
              { label: 'Walvis Bay', level: 'city' },
              { label: 'Swakopmund', level: 'city' },
              { label: 'Oshakati', level: 'city' },
            ],
          },
          {
            label: 'Botswana', level: 'country', code: 'BW',
            children: [
              { label: 'Gaborone', level: 'city' },
              { label: 'Francistown', level: 'city' },
              { label: 'Maun', level: 'city' },
            ],
          },
          {
            label: 'Zimbabwe', level: 'country', code: 'ZW',
            children: [
              { label: 'Harare', level: 'city' },
              { label: 'Bulawayo', level: 'city' },
              { label: 'Mutare', level: 'city' },
            ],
          },
          {
            label: 'Mozambique', level: 'country', code: 'MZ',
            children: [
              { label: 'Maputo', level: 'city' },
              { label: 'Beira', level: 'city' },
              { label: 'Nampula', level: 'city' },
            ],
          },
          {
            label: 'Lesotho', level: 'country', code: 'LS',
            children: [{ label: 'Maseru', level: 'city' }],
          },
          {
            label: 'Eswatini (Swaziland)', level: 'country', code: 'SZ',
            children: [{ label: 'Mbabane', level: 'city' }, { label: 'Manzini', level: 'city' }],
          },
          {
            label: 'Zambia', level: 'country', code: 'ZM',
            children: [{ label: 'Lusaka', level: 'city' }, { label: 'Ndola', level: 'city' }],
          },
          {
            label: 'Kenya', level: 'country', code: 'KE',
            children: [{ label: 'Nairobi', level: 'city' }, { label: 'Mombasa', level: 'city' }],
          },
          {
            label: 'Nigeria', level: 'country', code: 'NG',
            children: [
              { label: 'Lagos', level: 'city' },
              { label: 'Abuja', level: 'city' },
              { label: 'Port Harcourt', level: 'city' },
              { label: 'Kano', level: 'city' },
            ],
          },
          {
            label: 'Ghana', level: 'country', code: 'GH',
            children: [{ label: 'Accra', level: 'city' }, { label: 'Kumasi', level: 'city' }],
          },
          {
            label: 'Tanzania', level: 'country', code: 'TZ',
            children: [{ label: 'Dar es Salaam', level: 'city' }, { label: 'Dodoma', level: 'city' }],
          },
          {
            label: 'Uganda', level: 'country', code: 'UG',
            children: [{ label: 'Kampala', level: 'city' }],
          },
          {
            label: 'Egypt', level: 'country', code: 'EG',
            children: [{ label: 'Cairo', level: 'city' }, { label: 'Alexandria', level: 'city' }],
          },
          {
            label: 'Ethiopia', level: 'country', code: 'ET',
            children: [{ label: 'Addis Ababa', level: 'city' }],
          },
          {
            label: 'Ivory Coast', level: 'country', code: 'CI',
            children: [{ label: 'Abidjan', level: 'city' }, { label: 'Yamoussoukro', level: 'city' }],
          },
          {
            label: 'Senegal', level: 'country', code: 'SN',
            children: [{ label: 'Dakar', level: 'city' }],
          },
        ],
      },
      // ── EUROPE ────────────────────────────────────────────────────────────────
      {
        label: 'Europe', level: 'continent',
        children: [
          { label: 'United Kingdom', level: 'country', code: 'GB', children: [{ label: 'London', level: 'city' }, { label: 'Birmingham', level: 'city' }, { label: 'Manchester', level: 'city' }] },
          { label: 'France', level: 'country', code: 'FR', children: [{ label: 'Paris', level: 'city' }, { label: 'Marseille', level: 'city' }] },
          { label: 'Germany', level: 'country', code: 'DE', children: [{ label: 'Berlin', level: 'city' }, { label: 'Frankfurt', level: 'city' }, { label: 'Munich', level: 'city' }] },
          { label: 'Portugal', level: 'country', code: 'PT', children: [{ label: 'Lisbon', level: 'city' }, { label: 'Porto', level: 'city' }] },
          { label: 'Netherlands', level: 'country', code: 'NL', children: [{ label: 'Amsterdam', level: 'city' }] },
          { label: 'Spain', level: 'country', code: 'ES', children: [{ label: 'Madrid', level: 'city' }, { label: 'Barcelona', level: 'city' }] },
        ],
      },
      // ── NORTH AMERICA ─────────────────────────────────────────────────────────
      {
        label: 'North America', level: 'continent',
        children: [
          { label: 'United States', level: 'country', code: 'US', children: [{ label: 'New York', level: 'city' }, { label: 'Los Angeles', level: 'city' }, { label: 'Atlanta', level: 'city' }, { label: 'Chicago', level: 'city' }, { label: 'Miami', level: 'city' }, { label: 'Houston', level: 'city' }] },
          { label: 'Canada', level: 'country', code: 'CA', children: [{ label: 'Toronto', level: 'city' }, { label: 'Vancouver', level: 'city' }, { label: 'Montreal', level: 'city' }] },
        ],
      },
      // ── ASIA ──────────────────────────────────────────────────────────────────
      {
        label: 'Asia', level: 'continent',
        children: [
          { label: 'United Arab Emirates', level: 'country', code: 'AE', children: [{ label: 'Dubai', level: 'city' }, { label: 'Abu Dhabi', level: 'city' }] },
          { label: 'China', level: 'country', code: 'CN', children: [{ label: 'Beijing', level: 'city' }, { label: 'Shanghai', level: 'city' }] },
          { label: 'India', level: 'country', code: 'IN', children: [{ label: 'Mumbai', level: 'city' }, { label: 'Delhi', level: 'city' }, { label: 'Bangalore', level: 'city' }] },
          { label: 'Japan', level: 'country', code: 'JP', children: [{ label: 'Tokyo', level: 'city' }, { label: 'Osaka', level: 'city' }] },
          { label: 'Singapore', level: 'country', code: 'SG', children: [{ label: 'Singapore City', level: 'city' }] },
        ],
      },
      // ── AUSTRALIA / OCEANIA ───────────────────────────────────────────────────
      {
        label: 'Oceania', level: 'continent',
        children: [
          { label: 'Australia', level: 'country', code: 'AU', children: [{ label: 'Sydney', level: 'city' }, { label: 'Melbourne', level: 'city' }, { label: 'Brisbane', level: 'city' }, { label: 'Perth', level: 'city' }] },
          { label: 'New Zealand', level: 'country', code: 'NZ', children: [{ label: 'Auckland', level: 'city' }, { label: 'Wellington', level: 'city' }] },
        ],
      },
      // ── SOUTH AMERICA ─────────────────────────────────────────────────────────
      {
        label: 'South America', level: 'continent',
        children: [
          { label: 'Brazil', level: 'country', code: 'BR', children: [{ label: 'São Paulo', level: 'city' }, { label: 'Rio de Janeiro', level: 'city' }] },
          { label: 'Colombia', level: 'country', code: 'CO', children: [{ label: 'Bogotá', level: 'city' }, { label: 'Medellín', level: 'city' }] },
        ],
      },
    ],
  },
  // ── OTHER PLANETS (for fun / future) ─────────────────────────────────────────
  { label: 'Mars', level: 'planet', children: [{ label: 'Elon\'s Colony', level: 'city' }] },
  { label: 'Moon', level: 'planet', children: [{ label: 'Lunar Base Alpha', level: 'city' }] },
];

// ── Flat list of all location labels (for search/autocomplete) ────────────────
const flattenLocations = (nodes, ancestors = []) => {
  const result = [];
  for (const node of nodes) {
    const path = [...ancestors, node.label];
    result.push({ label: node.label, level: node.level, path, display: path.join(' › ') });
    if (node.children?.length) {
      result.push(...flattenLocations(node.children, path));
    }
  }
  return result;
};

export const ALL_LOCATIONS = flattenLocations(LOCATION_HIERARCHY);

export const searchLocations = (query, limit = 20) => {
  if (!query?.trim()) return [];
  const q = query.toLowerCase().trim();
  return ALL_LOCATIONS
    .filter(l => l.label.toLowerCase().includes(q))
    .slice(0, limit);
};
