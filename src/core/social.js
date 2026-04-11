// ─── Social Features Module ───────────────────────────────────────────────────
// Seed data for social feed, stories, notifications, and profiles

export const SEED_STORIES = [
  { id: 's0', userId: 'me', name: 'Your Story', avatar: null, isOwn: true, viewed: false },
  { id: 's1', userId: 'u2', name: 'Vibe Ctrl', avatar: null, viewed: false, ring: '#ff4da6' },
  { id: 's2', userId: 'u3', name: 'Siya M', avatar: null, viewed: false, ring: '#a855f7' },
  { id: 's3', userId: 'u4', name: 'Thabo K', avatar: null, viewed: true, ring: '#3b82f6' },
  { id: 's4', userId: 'u5', name: 'Lena R', avatar: null, viewed: false, ring: '#10b981' },
  { id: 's5', userId: 'u6', name: 'Jay D', avatar: null, viewed: true, ring: '#f59e0b' },
  { id: 's6', userId: 'u7', name: 'Nandi B', avatar: null, viewed: false, ring: '#ef4444' },
];

export const SEED_NOTIFICATIONS = [
  { id: 'n1', type: 'like', actor: 'Siya M', text: 'liked your event', time: '2m', read: false, icon: 'heart' },
  { id: 'n2', type: 'comment', actor: 'Thabo K', text: 'commented on Joburg Jazz Night', time: '5m', read: false, icon: 'chatbubble' },
  { id: 'n3', type: 'follow', actor: 'Vibe Central', text: 'started following you', time: '12m', read: false, icon: 'person-add' },
  { id: 'n4', type: 'rsvp', actor: 'Lena R', text: 'is going to your event', time: '1h', read: true, icon: 'calendar' },
  { id: 'n5', type: 'regruve', actor: 'Jay D', text: 'Re-Gruved your post', time: '2h', read: true, icon: 'repeat' },
  { id: 'n6', type: 'mention', actor: 'Nandi B', text: 'mentioned you in a comment', time: '3h', read: true, icon: 'at' },
];

export const SEED_PROFILES = {
  u2: { name: 'Vibe Ctrl', handle: '@vibectrl', bio: 'Creating moments 🔥  JHB based.', followers: 1420, following: 312, events: 14, verified: true },
  u3: { name: 'Siya M', handle: '@siyam', bio: 'Living every moment', followers: 843, following: 201, events: 7, verified: false },
  u4: { name: 'Thabo K', handle: '@thabok', bio: 'Sports and culture', followers: 2301, following: 89, events: 22, verified: true },
};

export const REACTIONS = [
  { id: 'fire', icon: 'flame', color: '#ff4500', label: 'Fire' },
  { id: 'heart', icon: 'heart', color: '#ff4da6', label: 'Love' },
  { id: 'wow',  icon: 'star',  color: '#FFD700', label: 'Wow' },
  { id: 'hype', icon: 'musical-notes', color: '#a855f7', label: 'Hype' },
  { id: 'clap', icon: 'thumbs-up', color: '#10b981', label: 'Respect' },
];

// Parse hashtags and @mentions from text
export function parseText(text) {
  if (!text) return [{ type: 'text', value: text }];
  const tokens = [];
  const regex = /(#\w+|@\w+)/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) tokens.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    tokens.push({ type: match[0][0] === '#' ? 'hashtag' : 'mention', value: match[0] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) tokens.push({ type: 'text', value: text.slice(lastIndex) });
  return tokens;
}

// Format relative time
export function timeAgo(dateStr) {
  if (!dateStr) return 'now';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// Convert RSVP map to count by status
export function rsvpCounts(rsvps = {}) {
  const counts = { going: 0, interested: 0, not_going: 0, waitlist: 0 };
  Object.values(rsvps).forEach(v => { if (counts[v] !== undefined) counts[v]++; });
  return counts;
}
