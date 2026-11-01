export const GENDERS = {
  MALE: 'male',
  FEMALE: 'female',
  NON_BINARY: 'non_binary',
};

const BASE_GLASS = {
  borderRadius: 18,
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.15)',
  backgroundColor: 'rgba(255, 255, 255, 0.07)',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.45,
  shadowRadius: 12,
  elevation: 8,
};

const BASE_GLASS_LIGHT = {
  ...BASE_GLASS,
  borderColor: 'rgba(0,0,0,0.10)',
  backgroundColor: 'rgba(255,255,255,0.55)',
  shadowOpacity: 0.15,
};

export const THEMES = {
  // ─────────────────────────────────────────────────────────────────
  //  MALE  — 4 dark, 4 light
  // ─────────────────────────────────────────────────────────────────
  male: [
    // ── DARK ──────────────────────────────────────────────────────
    {
      id: 'royal_obsidian',
      name: 'Royal Obsidian',
      background: '#0d1112',
      surface: '#172023',
      primary: '#00f2ff',
      accent: '#d1d8d9',
      text: '#ffffff',
      textMuted: 'rgba(255,255,255,0.72)',
      glowColor: '#00f2ff',
      ...BASE_GLASS,
    },
    {
      id: 'steel_navy',
      name: 'Steel Navy',
      background: '#0a1628',
      surface: '#132845',
      primary: '#4a90d9',
      accent: '#c8dcff',
      text: '#ffffff',
      textMuted: 'rgba(220,235,255,0.74)',
      glowColor: '#4a90d9',
      ...BASE_GLASS,
      borderColor: 'rgba(74,144,217,0.30)',
      backgroundColor: 'rgba(74,144,217,0.12)',
    },
    {
      id: 'royal_gold',
      name: 'Royal Gold',
      background: '#120f02',
      surface: '#221c05',
      primary: '#f5c518',
      accent: '#e6be3b',
      text: '#ffffff',
      textMuted: 'rgba(255,240,160,0.75)',
      glowColor: '#f5c518',
      ...BASE_GLASS,
      borderColor: 'rgba(245,197,24,0.30)',
      backgroundColor: 'rgba(245,197,24,0.10)',
    },
    {
      // Dark 4 — smouldering embers of a warehouse rave
      id: 'inferno_rave',
      name: 'Inferno Rave',
      background: '#120701',
      surface: '#240f04',
      primary: '#ff5722',
      accent: '#ff9800',
      text: '#ffffff',
      textMuted: 'rgba(255,210,180,0.76)',
      glowColor: '#ff5722',
      ...BASE_GLASS,
      borderColor: 'rgba(255,87,34,0.32)',
      backgroundColor: 'rgba(255,87,34,0.12)',
    },

    // ── LIGHT ─────────────────────────────────────────────────────
    {
      // Crisp coastal morning — sky reflections on still water
      id: 'arctic_drift',
      name: 'Arctic Drift',
      background: '#f0f8ff',
      surface: '#dceeff',
      primary: '#0077b6',
      accent: '#023e8a',
      text: '#011f3f',
      textMuted: 'rgba(1,31,63,0.72)',
      glowColor: '#0077b6',
      ...BASE_GLASS_LIGHT,
      borderColor: 'rgba(0,119,182,0.22)',
      backgroundColor: 'rgba(0,119,182,0.08)',
    },
    {
      // Polished concrete + brushed chrome — luxury apartment lobby
      id: 'chrome_loft',
      name: 'Chrome Loft',
      background: '#f4f4f5',
      surface: '#e4e4e7',
      primary: '#18181b',
      accent: '#71717a',
      text: '#09090b',
      textMuted: 'rgba(9,9,11,0.70)',
      glowColor: '#18181b',
      ...BASE_GLASS_LIGHT,
      borderColor: 'rgba(24,24,27,0.18)',
      backgroundColor: 'rgba(24,24,27,0.06)',
    },
    {
      // Late-afternoon savanna — warm amber light, ochre earth
      id: 'savanna_dusk',
      name: 'Savanna Dusk',
      background: '#fdf6e3',
      surface: '#f5e8c8',
      primary: '#b5541c',
      accent: '#8b3a0f',
      text: '#3b1f0a',
      textMuted: 'rgba(59,31,10,0.72)',
      glowColor: '#b5541c',
      ...BASE_GLASS_LIGHT,
      borderColor: 'rgba(181,84,28,0.22)',
      backgroundColor: 'rgba(181,84,28,0.08)',
    },
    {
      // Pure white boxing gym meets sports editorial
      id: 'white_noise',
      name: 'White Noise',
      background: '#ffffff',
      surface: '#f1f5f9',
      primary: '#0f172a',
      accent: '#64748b',
      text: '#0f172a',
      textMuted: 'rgba(15,23,42,0.70)',
      glowColor: '#0f172a',
      ...BASE_GLASS_LIGHT,
      borderColor: 'rgba(15,23,42,0.15)',
      backgroundColor: 'rgba(15,23,42,0.05)',
    },
  ],

  // ─────────────────────────────────────────────────────────────────
  //  FEMALE  — 4 dark, 4 light
  // ─────────────────────────────────────────────────────────────────
  female: [
    // ── DARK ──────────────────────────────────────────────────────
    {
      id: 'rose_noir',
      name: 'Rose Noir',
      background: '#1a0d10',
      surface: '#2a121a',
      primary: '#ff6b9d',
      accent: '#ff8fb3',
      text: '#ffffff',
      textMuted: 'rgba(255,200,225,0.74)',
      glowColor: '#ff6b9d',
      ...BASE_GLASS,
      borderColor: 'rgba(255,107,157,0.30)',
      backgroundColor: 'rgba(255,107,157,0.12)',
    },
    {
      id: 'amethyst_crown',
      name: 'Amethyst Crown',
      background: '#120820',
      surface: '#24123b',
      primary: '#9b59b6',
      accent: '#e2beff',
      text: '#ffffff',
      textMuted: 'rgba(225,190,245,0.74)',
      glowColor: '#9b59b6',
      ...BASE_GLASS,
      borderColor: 'rgba(155,89,182,0.30)',
      backgroundColor: 'rgba(155,89,182,0.12)',
    },
    {
      // Bioluminescent deep sea — teal-black, alien calm
      id: 'abyss_bloom',
      name: 'Abyss Bloom',
      background: '#00080f',
      surface: '#051b2e',
      primary: '#00e5c8',
      accent: '#33f0d8',
      text: '#e0fffc',
      textMuted: 'rgba(160,245,235,0.76)',
      glowColor: '#00e5c8',
      ...BASE_GLASS,
      borderColor: 'rgba(0,229,200,0.30)',
      backgroundColor: 'rgba(0,229,200,0.12)',
    },
    {
      // Velvet darkness — deep maroon + champagne gold, awards night
      id: 'velvet_noir',
      name: 'Velvet Noir',
      background: '#0e0005',
      surface: '#290516',
      primary: '#e8c97a',
      accent: '#edd48a',
      text: '#fdf0d5',
      textMuted: 'rgba(245,225,175,0.75)',
      glowColor: '#e8c97a',
      ...BASE_GLASS,
      borderColor: 'rgba(232,201,122,0.30)',
      backgroundColor: 'rgba(232,201,122,0.12)',
    },

    // ── LIGHT ─────────────────────────────────────────────────────
    {
      // Fresh peony garden — white petals, blush centres
      id: 'peony_mist',
      name: 'Peony Mist',
      background: '#fff5f8',
      surface: '#ffe4ee',
      primary: '#d6336c',
      accent: '#9c1a3d',
      text: '#2d0d1a',
      textMuted: 'rgba(45,13,26,0.70)',
      glowColor: '#d6336c',
      ...BASE_GLASS_LIGHT,
      borderColor: 'rgba(214,51,108,0.22)',
      backgroundColor: 'rgba(214,51,108,0.08)',
    },
    {
      // Warm caramel latte in a ceramic cup — cafe core
      id: 'latte_haze',
      name: 'Latte Haze',
      background: '#fdf8f1',
      surface: '#f5e9d8',
      primary: '#a0522d',
      accent: '#6b3217',
      text: '#2c1503',
      textMuted: 'rgba(44,21,3,0.70)',
      glowColor: '#a0522d',
      ...BASE_GLASS_LIGHT,
      borderColor: 'rgba(160,82,45,0.22)',
      backgroundColor: 'rgba(160,82,45,0.08)',
    },
    {
      // Midday lavender field, sun-bleached and soft
      id: 'lavender_haze',
      name: 'Lavender Haze',
      background: '#f8f5ff',
      surface: '#eee6ff',
      primary: '#7c3aed',
      accent: '#5b21b6',
      text: '#1e0850',
      textMuted: 'rgba(30,8,80,0.70)',
      glowColor: '#7c3aed',
      ...BASE_GLASS_LIGHT,
      borderColor: 'rgba(124,58,237,0.22)',
      backgroundColor: 'rgba(124,58,237,0.08)',
    },
    {
      // Pearl Blush — original light theme kept
      id: 'pearl_blush',
      name: 'Pearl Blush',
      background: '#fff0f5',
      surface: '#ffe0ec',
      primary: '#c9607a',
      accent: '#8b2a44',
      text: '#1a0a10',
      textMuted: 'rgba(139,42,68,0.72)',
      glowColor: '#c9607a',
      ...BASE_GLASS_LIGHT,
      borderColor: 'rgba(201,96,122,0.25)',
      backgroundColor: 'rgba(201,96,122,0.08)',
    },
  ],

  // ─────────────────────────────────────────────────────────────────
  //  NON-BINARY  — 4 dark, 4 light
  // ─────────────────────────────────────────────────────────────────
  non_binary: [
    // ── DARK ──────────────────────────────────────────────────────
    {
      id: 'cosmic_void',
      name: 'Cosmic Void',
      background: '#0f0a1e',
      surface: '#211342',
      primary: '#7c3aed',
      accent: '#c4b5fd',
      text: '#ffffff',
      textMuted: 'rgba(210,190,255,0.76)',
      glowColor: '#7c3aed',
      ...BASE_GLASS,
      borderColor: 'rgba(124,58,237,0.30)',
      backgroundColor: 'rgba(124,58,237,0.12)',
    },
    {
      id: 'solar_eclipse',
      name: 'Solar Eclipse',
      background: '#0f0800',
      surface: '#261602',
      primary: '#f97316',
      accent: '#fcd34d',
      text: '#ffffff',
      textMuted: 'rgba(255,200,140,0.76)',
      glowColor: '#f97316',
      ...BASE_GLASS,
      borderColor: 'rgba(249,115,22,0.30)',
      backgroundColor: 'rgba(249,115,22,0.12)',
    },
    {
      // Aurora borealis over frozen tundra — shifting greens & magentas
      id: 'aurora_veil',
      name: 'Aurora Veil',
      background: '#020b0e',
      surface: '#081d24',
      primary: '#00ff9f',
      accent: '#47ffb8',
      text: '#e0fff8',
      textMuted: 'rgba(180,255,230,0.76)',
      glowColor: '#00ff9f',
      ...BASE_GLASS,
      borderColor: 'rgba(0,255,159,0.30)',
      backgroundColor: 'rgba(0,255,159,0.10)',
    },
    {
      // Y2K vaporwave — magenta grid, chrome sans-serif, neon horizon
      id: 'vaporwave',
      name: 'Vaporwave',
      background: '#0d0019',
      surface: '#240048',
      primary: '#ff2d78',
      accent: '#38e1ff',
      text: '#ffffff',
      textMuted: 'rgba(255,180,220,0.76)',
      glowColor: '#ff2d78',
      ...BASE_GLASS,
      borderColor: 'rgba(255,45,120,0.30)',
      backgroundColor: 'rgba(255,45,120,0.12)',
    },

    // ── LIGHT ─────────────────────────────────────────────────────
    {
      // Overcast Japanese street — concrete, matcha green, quiet energy
      id: 'wabi_sabi',
      name: 'Wabi Sabi',
      background: '#f7f5f0',
      surface: '#eeead8',
      primary: '#3a6b35',
      accent: '#1f4028',
      text: '#1a1a0f',
      textMuted: 'rgba(26,26,15,0.70)',
      glowColor: '#3a6b35',
      ...BASE_GLASS_LIGHT,
      borderColor: 'rgba(58,107,53,0.22)',
      backgroundColor: 'rgba(58,107,53,0.08)',
    },
    {
      // Desert mirage — sand white, terracotta, bleached bone
      id: 'kalahari',
      name: 'Kalahari',
      background: '#fdf9f0',
      surface: '#f5ead4',
      primary: '#c2410c',
      accent: '#78350f',
      text: '#292109',
      textMuted: 'rgba(41,33,9,0.70)',
      glowColor: '#c2410c',
      ...BASE_GLASS_LIGHT,
      borderColor: 'rgba(194,65,12,0.22)',
      backgroundColor: 'rgba(194,65,12,0.08)',
    },
    {
      // Electric pastel — playground of a graphic designer at 2 am
      id: 'candy_grid',
      name: 'Candy Grid',
      background: '#fafafa',
      surface: '#f0f4ff',
      primary: '#8b5cf6',
      accent: '#ec4899',
      text: '#0f0a1e',
      textMuted: 'rgba(15,10,30,0.70)',
      glowColor: '#8b5cf6',
      ...BASE_GLASS_LIGHT,
      borderColor: 'rgba(139,92,246,0.22)',
      backgroundColor: 'rgba(139,92,246,0.08)',
    },
    {
      // Cloud editorial — stark white, single accent of cyan ink
      id: 'editorial_cloud',
      name: 'Editorial Cloud',
      background: '#ffffff',
      surface: '#f0fdff',
      primary: '#0891b2',
      accent: '#0e7490',
      text: '#0c1a1f',
      textMuted: 'rgba(12,26,31,0.70)',
      glowColor: '#0891b2',
      ...BASE_GLASS_LIGHT,
      borderColor: 'rgba(8,145,178,0.20)',
      backgroundColor: 'rgba(8,145,178,0.06)',
    },
  ],
};

// Find a theme's { gender, index } by its stable id — used to restore the
// exact aura a user picked, across devices (app ⇆ website) via their profile.
export const findThemeById = (id) => {
  if (!id) return null;
  for (const g of Object.keys(THEMES)) {
    const idx = THEMES[g].findIndex((t) => t.id === id);
    if (idx !== -1) return { gender: g, index: idx, theme: THEMES[g][idx] };
  }
  return null;
};
