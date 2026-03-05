// ─── Themes ───────────────────────────────────────────────────────────────────
export const THEMES = {
    day: { bg: '#f0f2f5', card: '#fff', text: '#111', sub: '#666', border: '#e2e8f0', nav: '#fff', acc: '#ff4da6', inp: '#e8ecf0', it: '#111', glow: 'rgba(255,77,166,0.3)' },
    male: { bg: '#020210', card: '#0d0d28', text: '#fff', sub: '#94a3b8', border: '#3b82f6', nav: '#070718', acc: '#3b82f6', inp: '#141430', it: '#fff', glow: 'rgba(59,130,246,0.4)' },
    female: { bg: '#0e0007', card: '#1a0010', text: '#fff', sub: '#f9a8d4', border: '#ff4da6', nav: '#110009', acc: '#ff4da6', inp: '#200015', it: '#fff', glow: 'rgba(255,77,166,0.4)' },
    other: { bg: '#05001a', card: '#0e0830', text: '#fff', sub: '#c4b5fd', border: '#8b5cf6', nav: '#080020', acc: '#8b5cf6', inp: '#120a35', it: '#fff', glow: 'rgba(139,92,246,0.4)' },
    prefer_not: { bg: '#111', card: '#1e1e1e', text: '#eee', sub: '#888', border: '#444', nav: '#181818', acc: '#888', inp: '#2a2a2a', it: '#eee', glow: 'rgba(150,150,150,0.3)' },
};
export const getTheme = (g) => THEMES[g] || THEMES.day;

// ─── Genders ──────────────────────────────────────────────────────────────────
export const GENDERS = [
    { value: 'male', label: 'Male', icon: '♂', accent: '#3b82f6' },
    { value: 'female', label: 'Female', icon: '♀', accent: '#ff4da6' },
    { value: 'other', label: 'Other', icon: '⚧', accent: '#8b5cf6' },
    { value: 'prefer_not', label: 'Prefer Not', icon: '◎', accent: '#888' },
];

// ─── Network Types ────────────────────────────────────────────────────────────
export const NETWORKS = [
    { id: 'public', label: 'Public', icon: '◉', desc: 'Everyone can see' },
    { id: 'friends', label: 'Friends', icon: '◈', desc: 'Invite only' },
    { id: 'local', label: 'Local', icon: '◎', desc: 'Near me (<20km)' },
    { id: 'professional', label: 'Professional', icon: '⬡', desc: 'Career network' },
    { id: 'anonymous', label: 'Anonymous', icon: '⎔', desc: 'Identity hidden' },
];

// ─── Event Category Groups ────────────────────────────────────────────────────
export const CATEGORY_GROUPS = {
    '⛪ Faith': ['Church', 'Mosque', 'Temple', 'Synagogue', 'Bible Study', 'Youth Ministry', 'Prayer Group', 'Revival'],
    '⚽ Sports': ['Football', 'Basketball', 'Soccer', 'Running', 'Cycling', 'Yoga', 'Gym', 'Swimming', 'Tennis', 'Martial Arts', 'Golf', 'Cricket', 'Rugby', 'Volleyball', 'Boxing'],
    '💼 Career': ['Job Fair', 'Networking', 'Workshop', 'Hackathon', 'Startup Pitch', 'Mentorship', 'Conference', 'Panel Talk', 'Interview Prep', 'Coding Bootcamp'],
    '🎉 Social': ['Party', 'Mixer', 'Happy Hour', 'Game Night', 'Movie Night', 'Dinner', 'Karaoke', 'Speed Dating', 'Singles Event', 'Reunion'],
    '🎓 Education': ['Lecture', 'Study Group', 'Tutoring', 'Language Exchange', 'Science Fair', 'Book Club', 'Debate', 'Research Talk'],
    '🎭 Arts': ['Music Concert', 'Art Show', 'Dance', 'Theater', 'Film Screening', 'Poetry', 'Open Mic', 'Photography Walk', 'Gallery Opening'],
    '🌿 Wellness': ['Meditation', 'Mental Health', 'Support Group', 'Nutrition Talk', 'Therapy Session', 'Breathwork', 'Journaling Circle'],
    '🌍 Community': ['Volunteer', 'Charity Drive', 'Clean-Up', 'Fundraiser', 'Town Hall', 'Awareness Walk', 'Food Drive', 'Protest March'],
    '🎮 Tech': ['Hackathon', 'AI Meetup', 'Dev Talk', 'Product Launch', 'Tech Demo', 'Robotics', 'Gaming Tournament'],
    '🍽️ Food': ['Food Festival', 'Wine Tasting', 'Cook-Off', 'Pop-Up Restaurant', 'Bake Sale', 'Street Food Tour'],
};
export const ALL_CATEGORIES = ['All', ...Object.values(CATEGORY_GROUPS).flat()];
export const GROUP_KEYS = Object.keys(CATEGORY_GROUPS);

// ─── Interest Tags (for feed personalization) ─────────────────────────────────
export const INTERESTS = [
    { id: 'church', label: 'Faith', icon: '⛪', color: '#8b5cf6' },
    { id: 'sports', label: 'Sports', icon: '⚽', color: '#10b981' },
    { id: 'career', label: 'Career', icon: '💼', color: '#3b82f6' },
    { id: 'social', label: 'Social', icon: '🎉', color: '#f59e0b' },
    { id: 'education', label: 'Education', icon: '🎓', color: '#06b6d4' },
    { id: 'arts', label: 'Arts', icon: '🎭', color: '#ec4899' },
    { id: 'wellness', label: 'Wellness', icon: '🌿', color: '#34d399' },
    { id: 'community', label: 'Community', icon: '🌍', color: '#64748b' },
    { id: 'tech', label: 'Tech', icon: '🎮', color: '#a855f7' },
    { id: 'food', label: 'Food', icon: '🍽️', color: '#ef4444' },
];

// ─── Report Reasons ────────────────────────────────────────────────────────────
export const REPORT_REASONS = ['Spam', 'Offensive language', 'Harassment', 'False information', 'Adult content', 'Copyright violation', 'Other'];

// ─── Search Tags / Autocomplete hints ────────────────────────────────────────
export const SEARCH_TAGS = [
    'church', 'networking', 'party', 'yoga', 'hackathon', 'concert', 'volunteering',
    'dating', 'bootcamp', 'marathon', 'art show', 'game night', 'job fair', 'open mic',
    'meditation', 'food festival', 'clean-up', 'mentorship', 'cinema', 'study group',
];
