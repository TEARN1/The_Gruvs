/**
 * claudeService.js — Central AI wrapper for The Gruvs
 *
 * All Claude API calls go through here. Handles:
 *   - Model routing (Haiku for quick tasks, Sonnet for complex)
 *   - Prompt caching (system prompt cached on every call)
 *   - Interaction logging to ai_interactions table
 *   - Rate limiting (20 calls / user / hour)
 *   - Graceful fallback when AI is disabled or quota hit
 */

import Anthropic from '@anthropic-ai/sdk';
import { supabase } from './supabase';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const AI_ENABLED = process.env.EXPO_PUBLIC_AI_ENABLED === 'true';

const MODEL_HAIKU  = 'claude-haiku-4-5-20251001';
const MODEL_SONNET = 'claude-sonnet-4-6';

export const AIFeature = {
  ASSISTANT:       'assistant',
  PROFILE_BUILDER: 'profile_builder',
  EVENT_CREATOR:   'event_creator',
  VIBE_COACH:      'vibe_coach',
  MODERATION:      'moderation',
  NOTIFICATION:    'notification',
  ADMIN:           'admin',
};

// ── Rate limiter (client-side, per session) ──────────────────────────────────
const _callLog = {};
const RATE_LIMIT = 20; // calls per hour per user
const RATE_WINDOW = 3600000; // 1 hour in ms

function _checkRate(userId) {
  if (!userId) return true;
  const now = Date.now();
  if (!_callLog[userId]) _callLog[userId] = [];
  _callLog[userId] = _callLog[userId].filter(t => now - t < RATE_WINDOW);
  if (_callLog[userId].length >= RATE_LIMIT) return false;
  _callLog[userId].push(now);
  return true;
}

// ── Anthropic client ─────────────────────────────────────────────────────────
let _client = null;
function getClient() {
  if (!_client && ANTHROPIC_API_KEY && ANTHROPIC_API_KEY !== 'your-anthropic-api-key-here') {
    _client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  }
  return _client;
}

// ── App-level system prompt (cached) ─────────────────────────────────────────
const APP_SYSTEM_PROMPT = `You are Gruvs AI — the intelligent assistant powering The Gruvs, South Africa's premier social event discovery platform.

THE GRUVS is a vibrant community where people ("Vibers") discover events ("Gruvs"), connect with each other, share experiences, and grow their social presence through a "Vibe Score" system.

YOUR TONE:
- Energetic, warm, and culturally South African (use local references naturally)
- Concise and action-oriented — Vibers want quick, useful answers
- Never robotic or corporate — you're a trusted friend who knows the scene
- Use emojis sparingly for emphasis, never excessively

YOUR CAPABILITIES:
- Help Vibers find events that match their vibe, location, and interests
- Recommend who to follow based on shared interests
- Help create compelling event listings from rough descriptions
- Coach Vibers on growing their Vibe Score and following
- Write authentic profile bios that capture personality
- Moderate content to keep the community safe and real

IMPORTANT RULES:
- Never make up events, users, or data — only reference what's provided to you
- Always be helpful even when you can't fulfil a request exactly
- Keep responses under 3 paragraphs unless the user asks for more detail
- For event/user suggestions, return structured data so the app can render cards`;

// ── Log interaction to Supabase ──────────────────────────────────────────────
async function _logInteraction({ userId, feature, input, output, model, tokensUsed }) {
  try {
    await supabase.from('ai_interactions').insert({
      user_id:     userId || null,
      feature,
      input:       input  ? String(input).slice(0, 2000)  : null,
      output:      output ? String(output).slice(0, 4000) : null,
      model,
      tokens_used: tokensUsed || null,
    });
  } catch {}
}

// ── Submit feedback on an interaction ────────────────────────────────────────
export async function submitFeedback(interactionId, thumbs) {
  try {
    await supabase.from('ai_interactions')
      .update({ feedback: thumbs }) // 1 = thumbs up, -1 = thumbs down
      .eq('id', interactionId);
  } catch {}
}

// ── Core call wrapper ─────────────────────────────────────────────────────────
async function _call({ messages, feature, userId, model = MODEL_HAIKU, systemExtra = '', tools = null }) {
  if (!AI_ENABLED) return { text: null, id: null, error: 'AI disabled' };

  const client = getClient();
  if (!client) return { text: null, id: null, error: 'No API key configured' };

  if (!_checkRate(userId)) return { text: null, id: null, error: 'Rate limit reached — try again later.' };

  const systemBlocks = [
    // Cached static block — counts toward prompt cache savings
    { type: 'text', text: APP_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
  ];
  if (systemExtra) {
    systemBlocks.push({ type: 'text', text: systemExtra });
  }

  try {
    const params = {
      model,
      max_tokens: 1024,
      system: systemBlocks,
      messages,
    };
    if (tools) params.tools = tools;

    const response = await client.messages.create(params);

    const text       = response.content.find(b => b.type === 'text')?.text || '';
    const toolUse    = response.content.find(b => b.type === 'tool_use');
    const tokensUsed = response.usage?.input_tokens + response.usage?.output_tokens;

    // Log async — don't await to keep UX fast
    _logInteraction({ userId, feature, input: messages.at(-1)?.content, output: text, model, tokensUsed });

    return { text, toolUse, id: response.id, usage: response.usage };
  } catch (e) {
    console.warn('Claude API error:', e?.message);
    return { text: null, id: null, error: e?.message || 'AI unavailable' };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//  Public API
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Open-ended chat — used by the AI Assistant modal.
 * Returns { text, id, error }
 */
export async function chat(messages, { feature = AIFeature.ASSISTANT, userId, systemExtra = '' } = {}) {
  return _call({ messages, feature, userId, model: MODEL_SONNET, systemExtra });
}

/**
 * Generate 3 bio options from user profile data.
 * Returns { bios: string[], id, error }
 */
export async function generateBio({ interests = [], career = '', location = '', vibeScore = 0, userId } = {}) {
  const prompt = `Generate 3 distinct bio options for a Gruvs Viber profile.

USER DATA:
- Interests: ${interests.join(', ') || 'not specified'}
- Career: ${career || 'not specified'}
- Location: ${location || 'South Africa'}
- Vibe Score: ${vibeScore}

Return ONLY a JSON object in this exact format:
{
  "bios": [
    "Short bio (max 60 chars) — punchy and memorable",
    "Medium bio (max 120 chars) — personality + what they're about",
    "Long bio (max 200 chars) — full story with vibe and what they're looking for"
  ]
}`;

  const result = await _call({
    messages: [{ role: 'user', content: prompt }],
    feature: AIFeature.PROFILE_BUILDER,
    userId,
    model: MODEL_HAIKU,
  });

  try {
    const parsed = JSON.parse(result.text || '{}');
    return { bios: parsed.bios || [], id: result.id, error: result.error };
  } catch {
    return { bios: [], id: result.id, error: 'Could not parse bio options' };
  }
}

/**
 * Parse a rough event description into structured event fields.
 * Returns { event: {...}, id, error }
 */
export async function fillEvent({ roughDescription = '', city = '', userId } = {}) {
  const prompt = `Parse this rough event description into structured fields for a South African event platform.

DESCRIPTION: "${roughDescription}"
CITY HINT: "${city || 'not specified'}"

Return ONLY a JSON object:
{
  "title": "Event title (max 60 chars, compelling)",
  "description": "Full description (max 300 chars, exciting but factual)",
  "venue_name": "Venue name if mentioned, else null",
  "city": "City name",
  "category": "One of: music, party, nightlife, food, art, sport, fitness, wellness, tech, business, family, comedy, film, festival, market, workshop",
  "event_time": "HH:MM (24h format) if mentioned, else null",
  "price_min": number or null,
  "price_max": number or null,
  "age_restriction": 0 or 16 or 18 or 21,
  "tags": ["tag1", "tag2", "tag3"]
}`;

  const result = await _call({
    messages: [{ role: 'user', content: prompt }],
    feature: AIFeature.EVENT_CREATOR,
    userId,
    model: MODEL_HAIKU,
  });

  try {
    const parsed = JSON.parse(result.text || '{}');
    return { event: parsed, id: result.id, error: result.error };
  } catch {
    return { event: {}, id: result.id, error: 'Could not parse event data' };
  }
}

/**
 * Generate personalised vibe coaching tips.
 * Returns { tips: string[], insight: string, id, error }
 */
export async function vibeCoach({ profile = {}, recentActivity = {}, userId } = {}) {
  const prompt = `You are a vibe growth coach for The Gruvs. Give this Viber personalised, actionable tips.

PROFILE:
- Vibe Score: ${profile.vibe_score || 0}
- Followers: ${profile.followers_count || 0}
- Following: ${profile.following_count || 0}
- Events Posted: ${profile.events_posted || 0}
- Current Streak: ${profile.current_streak || 0} days
- Social Integrity Score: ${profile.social_integrity_score || 0}
- Interests: ${(profile.interests || []).join(', ') || 'not set'}

RECENT 7-DAY ACTIVITY:
- RSVPs given: ${recentActivity.rsvps || 0}
- Vibes given: ${recentActivity.vibes || 0}
- Echoes written: ${recentActivity.echoes || 0}
- Events attended: ${recentActivity.checkins || 0}

Return ONLY a JSON object:
{
  "insight": "One sentence explaining their current vibe status (warm, encouraging)",
  "tips": [
    "Specific action tip 1 — reference their actual data",
    "Specific action tip 2 — reference their actual data",
    "Specific action tip 3 — reference their actual data"
  ],
  "next_milestone": "What they're working towards (e.g. 'Elite Viber at 500 score')"
}`;

  const result = await _call({
    messages: [{ role: 'user', content: prompt }],
    feature: AIFeature.VIBE_COACH,
    userId,
    model: MODEL_SONNET,
  });

  try {
    const parsed = JSON.parse(result.text || '{}');
    return { ...parsed, id: result.id, error: result.error };
  } catch {
    return { tips: [], insight: '', next_milestone: '', id: result.id, error: 'Could not parse coaching tips' };
  }
}

/**
 * Moderate a piece of content.
 * Returns { verdict: 'approved'|'flagged'|'removed', reason: string, id, error }
 */
export async function moderateContent({ text = '', type = 'event', userId } = {}) {
  const prompt = `Moderate this ${type} content for The Gruvs, a South African social event platform.

CONTENT: "${text}"

Rules — flag or remove if content contains:
- Hate speech, racism, discrimination, slurs
- Explicit sexual content (not suggestive, but explicit)
- Violence threats or incitement
- Spam, fake promotions, scams
- Personal contact details in event descriptions (phone/email/address)

South African context: Party content, adult events (18+/21+), alcohol references, club/nightlife language is all NORMAL and fine.

Return ONLY a JSON object:
{
  "verdict": "approved" | "flagged" | "removed",
  "reason": "One sentence explaining the decision (or 'Content is appropriate' for approved)"
}`;

  const result = await _call({
    messages: [{ role: 'user', content: prompt }],
    feature: AIFeature.MODERATION,
    userId,
    model: MODEL_HAIKU,
  });

  try {
    const parsed = JSON.parse(result.text || '{}');
    return { verdict: parsed.verdict || 'approved', reason: parsed.reason || '', id: result.id, error: result.error };
  } catch {
    return { verdict: 'approved', reason: '', id: result.id, error: 'Moderation parse error' };
  }
}

/**
 * Generate a smart re-engagement notification for a user.
 * Returns { title: string, body: string, id, error }
 */
export async function smartNotification({ userName = 'Viber', topEvent = null, userId } = {}) {
  const eventHint = topEvent
    ? `Top recommended event: "${topEvent.title}" on ${topEvent.event_date} in ${topEvent.city}`
    : 'No specific event — general re-engagement';

  const prompt = `Write a short, punchy re-engagement push notification for a Gruvs Viber who hasn't opened the app in 24+ hours.

USER: ${userName}
${eventHint}

The notification should feel personal and exciting — make them want to open the app NOW.

Return ONLY a JSON object:
{
  "title": "Notification title (max 50 chars, with emoji)",
  "body": "Notification body (max 100 chars, action-oriented)"
}`;

  const result = await _call({
    messages: [{ role: 'user', content: prompt }],
    feature: AIFeature.NOTIFICATION,
    userId,
    model: MODEL_HAIKU,
  });

  try {
    const parsed = JSON.parse(result.text || '{}');
    return { title: parsed.title || 'Your Gruvs are waiting 🔥', body: parsed.body || 'See what\'s happening near you tonight.', id: result.id };
  } catch {
    return { title: 'Your Gruvs are waiting 🔥', body: 'See what\'s happening near you tonight.', id: result.id };
  }
}

/**
 * Admin tool-use call — owner can issue commands via natural language.
 * Returns { text, toolUse, id, error }
 */
export async function adminChat(messages, { userId, systemExtra = '' } = {}) {
  const adminTools = [
    {
      name: 'query_stats',
      description: 'Query app statistics from the database (user counts, event counts, engagement metrics)',
      input_schema: {
        type: 'object',
        properties: {
          metric: { type: 'string', description: 'What to query: users_today, active_users, top_events, churn_risk, new_signups' },
          period: { type: 'string', description: 'Time period: today, week, month' },
        },
        required: ['metric'],
      },
    },
    {
      name: 'send_notification',
      description: 'Send a push notification to a segment of users',
      input_schema: {
        type: 'object',
        properties: {
          segment: { type: 'string', description: 'Who to notify: all, city:CityName, inactive_24h, top_vibers' },
          title:   { type: 'string', description: 'Notification title' },
          body:    { type: 'string', description: 'Notification body' },
        },
        required: ['segment', 'title', 'body'],
      },
    },
    {
      name: 'feature_event',
      description: 'Mark an event as featured so it appears at the top of the feed',
      input_schema: {
        type: 'object',
        properties: {
          event_id: { type: 'string', description: 'UUID of the event to feature' },
          featured:  { type: 'boolean', description: 'true to feature, false to unfeature' },
        },
        required: ['event_id', 'featured'],
      },
    },
    {
      name: 'moderate_user',
      description: 'Flag or suspend a user account for review',
      input_schema: {
        type: 'object',
        properties: {
          username: { type: 'string', description: 'Username to moderate' },
          action:   { type: 'string', description: 'flag or suspend' },
          reason:   { type: 'string', description: 'Reason for moderation action' },
        },
        required: ['username', 'action'],
      },
    },
    {
      name: 'generate_announcement',
      description: 'Draft and publish an app update announcement to the Upgrades section',
      input_schema: {
        type: 'object',
        properties: {
          title:       { type: 'string', description: 'Announcement title' },
          description: { type: 'string', description: 'Full announcement text' },
          type:        { type: 'string', description: 'feature, fix, improvement, or security' },
          version:     { type: 'string', description: 'Version string like v1.2.3' },
        },
        required: ['title', 'description', 'type'],
      },
    },
  ];

  return _call({
    messages,
    feature: AIFeature.ADMIN,
    userId,
    model: MODEL_SONNET,
    systemExtra: `You are the admin AI for The Gruvs. You have access to tools to manage the platform. The owner is asking you for help. Use tools when you need real data — don't make up numbers. Always confirm before taking destructive actions (suspending users, mass notifications).\n\n${systemExtra}`,
    tools: adminTools,
  });
}

export default { chat, generateBio, fillEvent, vibeCoach, moderateContent, smartNotification, adminChat, submitFeedback, AIFeature };
