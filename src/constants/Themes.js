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

// Core brand palette
const BRAND_TEAL    = '#00f2ff';
const BRAND_STEEL   = '#b8c1c2';
const BRAND_OBSIDIAN= '#0d1112';
const BRAND_PEARL   = '#f0f4f5';

// Extended palette
const ROYAL_GOLD    = '#f5c518';
const STEEL_BLUE    = '#4a90d9';
const NAVY          = '#0a1628';
const ROSE_PINK     = '#ff6b9d';
const DUSTY_ROSE    = '#c9607a';
const DARK_ROSE     = '#1a0d10';
const AMETHYST      = '#9b59b6';
const SOFT_PURPLE   = '#d4a8e8';
const DEEP_PURPLE   = '#120820';
const COSMIC_VIOLET = '#7c3aed';
const SOLAR_ORANGE  = '#f97316';
const MIDNIGHT      = '#0f0a1e';
const SOLAR_AMBER   = '#fbbf24';
const FOREST_DARK   = '#0a1a0f';

export const THEMES = {
  [GENDERS.MALE]: [
    {
      id: 'royal_obsidian',
      name: 'Royal Obsidian',
      background: BRAND_OBSIDIAN,
      surface: '#131a1c',
      primary: BRAND_TEAL,
      accent: BRAND_STEEL,
      text: '#ffffff',
      textMuted: 'rgba(255,255,255,0.55)',
      glowColor: BRAND_TEAL,
      ...BASE_GLASS,
    },
    {
      id: 'steel_navy',
      name: 'Steel Navy',
      background: NAVY,
      surface: '#0d1f38',
      primary: STEEL_BLUE,
      accent: BRAND_STEEL,
      text: '#ffffff',
      textMuted: 'rgba(200,220,255,0.55)',
      glowColor: STEEL_BLUE,
      ...BASE_GLASS,
      borderColor: 'rgba(74,144,217,0.25)',
      backgroundColor: 'rgba(74,144,217,0.08)',
    },
    {
      id: 'royal_gold',
      name: 'Royal Gold',
      background: '#100d00',
      surface: '#1a1500',
      primary: ROYAL_GOLD,
      accent: '#c9a227',
      text: '#ffffff',
      textMuted: 'rgba(255,230,100,0.55)',
      glowColor: ROYAL_GOLD,
      ...BASE_GLASS,
      borderColor: 'rgba(245,197,24,0.2)',
      backgroundColor: 'rgba(245,197,24,0.06)',
    },
    {
      id: 'royal_pearl',
      name: 'Royal Pearl',
      background: BRAND_PEARL,
      surface: '#e4e8e9',
      primary: '#0099aa',
      accent: '#2c3e50',
      text: '#0d1112',
      textMuted: 'rgba(13,17,18,0.55)',
      glowColor: '#0099aa',
      ...BASE_GLASS,
      borderColor: 'rgba(0,153,170,0.25)',
      backgroundColor: 'rgba(0,153,170,0.08)',
    },
  ],
  [GENDERS.FEMALE]: [
    {
      id: 'royal_obsidian',
      name: 'Royal Obsidian',
      background: BRAND_OBSIDIAN,
      surface: '#131a1c',
      primary: BRAND_TEAL,
      accent: BRAND_STEEL,
      text: '#ffffff',
      textMuted: 'rgba(255,255,255,0.55)',
      glowColor: BRAND_TEAL,
      ...BASE_GLASS,
    },
    {
      id: 'rose_noir',
      name: 'Rose Noir',
      background: DARK_ROSE,
      surface: '#240d14',
      primary: ROSE_PINK,
      accent: DUSTY_ROSE,
      text: '#ffffff',
      textMuted: 'rgba(255,180,210,0.55)',
      glowColor: ROSE_PINK,
      ...BASE_GLASS,
      borderColor: 'rgba(255,107,157,0.2)',
      backgroundColor: 'rgba(255,107,157,0.07)',
    },
    {
      id: 'amethyst_crown',
      name: 'Amethyst Crown',
      background: DEEP_PURPLE,
      surface: '#1c0d2e',
      primary: AMETHYST,
      accent: SOFT_PURPLE,
      text: '#ffffff',
      textMuted: 'rgba(212,168,232,0.55)',
      glowColor: AMETHYST,
      ...BASE_GLASS,
      borderColor: 'rgba(155,89,182,0.25)',
      backgroundColor: 'rgba(155,89,182,0.08)',
    },
    {
      id: 'pearl_blush',
      name: 'Pearl Blush',
      background: '#fff0f5',
      surface: '#ffe0ec',
      primary: DUSTY_ROSE,
      accent: '#8b2a44',
      text: '#1a0a10',
      textMuted: 'rgba(139,42,68,0.6)',
      glowColor: DUSTY_ROSE,
      ...BASE_GLASS,
      borderColor: 'rgba(201,96,122,0.25)',
      backgroundColor: 'rgba(201,96,122,0.08)',
    },
  ],
  [GENDERS.NON_BINARY]: [
    {
      id: 'royal_obsidian',
      name: 'Royal Obsidian',
      background: BRAND_OBSIDIAN,
      surface: '#131a1c',
      primary: BRAND_TEAL,
      accent: BRAND_STEEL,
      text: '#ffffff',
      textMuted: 'rgba(255,255,255,0.55)',
      glowColor: BRAND_TEAL,
      ...BASE_GLASS,
    },
    {
      id: 'cosmic_void',
      name: 'Cosmic Void',
      background: MIDNIGHT,
      surface: '#170d30',
      primary: COSMIC_VIOLET,
      accent: '#a78bfa',
      text: '#ffffff',
      textMuted: 'rgba(167,139,250,0.55)',
      glowColor: COSMIC_VIOLET,
      ...BASE_GLASS,
      borderColor: 'rgba(124,58,237,0.25)',
      backgroundColor: 'rgba(124,58,237,0.08)',
    },
    {
      id: 'solar_eclipse',
      name: 'Solar Eclipse',
      background: '#0f0800',
      surface: '#1a1000',
      primary: SOLAR_ORANGE,
      accent: SOLAR_AMBER,
      text: '#ffffff',
      textMuted: 'rgba(249,115,22,0.65)',
      glowColor: SOLAR_ORANGE,
      ...BASE_GLASS,
      borderColor: 'rgba(249,115,22,0.22)',
      backgroundColor: 'rgba(249,115,22,0.07)',
    },
    {
      id: 'forest_emerald',
      name: 'Forest Emerald',
      background: FOREST_DARK,
      surface: '#0f2416',
      primary: '#10b981',
      accent: '#6ee7b7',
      text: '#ffffff',
      textMuted: 'rgba(110,231,183,0.55)',
      glowColor: '#10b981',
      ...BASE_GLASS,
      borderColor: 'rgba(16,185,129,0.22)',
      backgroundColor: 'rgba(16,185,129,0.07)',
    },
  ],
};
