/**
 * claudeService.js — Gruvs AI Brain v2 (Ultra)
 *
 * Upgrades over v1:
 *   - Extended thinking (deep reasoning scratchpad, 8 000-token budget)
 *   - Agentic multi-turn tool loop (up to 6 database calls per response)
 *   - 8 live Supabase query tools (events, vibers, trending, crew, echoes...)
 *   - Deep context builder (8 parallel fetches before every major call)
 *   - Self-critique loop for bio generation
 *   - Multi-layer moderation (Haiku fast-path → Sonnet deep review)
 *   - Feedback propagation to ai_user_memory in real time
 *   - Temporal + location intelligence injected into every call
 *   - Rate limit raised to 50 calls / user / hour
 */

import { supabase } from './supabase';
import { HyperReasoning } from './hyperReasoning';

const AI_BACKEND_RAW = process.env.EXPO_PUBLIC_AI_BACKEND || 'claude';
const AI_BACKEND = String(AI_BACKEND_RAW).trim().toLowerCase();
const AI_ENABLED = AI_BACKEND !== 'none';
const AI_LOCAL_URL = process.env.EXPO_PUBLIC_AI_LOCAL_URL || '';
const AI_LOCAL_MODEL = process.env.EXPO_PUBLIC_AI_LOCAL_MODEL || 'gpt-4o-mini';

const MODEL_HAIKU = 'claude-haiku-4-5-20251001';
const MODEL_SONNET = 'claude-sonnet-4-6';

export const AIFeature = {
  ASSISTANT: 'assistant',
  PROFILE_BUILDER: 'profile_builder',
  EVENT_CREATOR: 'event_creator',
  VIBE_COACH: 'vibe_coach',
  MODERATION: 'moderation',
  NOTIFICATION: 'notification',
  ADMIN: 'admin',
  ARCHITECT: 'architect',
  SELF_HEALING: 'self_healing',
  ROYAL_REVENUE: 'revenue_agent',
};

// Extended thinking budget (tokens).
const THINKING_BUDGET_COACH = 16000;
const THINKING_BUDGET_CHAT = 32000;
// THINKING_BUDGET_ARCHITECT reserved for future deep-reasoning calls

const CORE_REASONING_PROMPT = `When you answer, follow the most advanced reasoning process available:
• If the request needs facts, plan the tool calls first and use the results to inform the final response.
• For multi-step problems, write a short plan before the answer and then deliver a concise, actionable result.
• Always confirm details from data sources instead of guessing.
• When you generate recommendations, explain why they fit the user, not just what to do.
• Preserve a helpful, South African voice with confidence and cultural awareness.
`;

const NO_HALLUCINATION_PROMPT = `Never invent or guess facts.
• Use only verified data from the tools, the database, or the user.
• If you do not have enough information, say "I don't have enough verified data to answer that" or offer a safer alternative.
• Do not fabricate event names, dates, prices, locations, user details, or attendance numbers.
`;

const MAX_AGENT_TURNS = 6;

function _isComplexConversation(messages) {
  if (!messages || !messages.length) return false;
  const textLength = messages.reduce((sum, message) => {
    const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
    return sum + content.length;
  }, 0);
  return messages.length > 5 || textLength > 1200 || messages.some(m => Array.isArray(m.content) || typeof m.content !== 'string');
}

function _normalizeToolResult(result) {
  if (result === null || result === undefined) return 'No data was returned from the tool.';
  if (typeof result !== 'string') return typeof result === 'object' ? JSON.stringify(result) : String(result);
  return result;
}

// Strip markdown code fences Claude sometimes wraps JSON in
function _parseJSON(text) {
  if (!text) return {};
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  return JSON.parse(stripped);
}

async function _verifyFinalAnswer({ systemBlocks, question, toolResults, draftAnswer }) {
  try {
    const verifyPrompt = `You have a draft response and the raw data returned by tools. Check the answer for accuracy and remove any statement not directly supported by the tool data or user query. If any part cannot be verified, replace it with: I don't have enough verified data to answer that part.

QUESTION:
${question}

TOOL DATA:
${toolResults}

DRAFT ANSWER:
${draftAnswer}

Return only the corrected answer, and do not add any new information.`;

    const verifyMsg = [{ role: 'user', content: verifyPrompt }];
    const verifyResponse = await createMessage({ model: MODEL_SONNET, max_tokens: 1024, system: systemBlocks, messages: verifyMsg });
    return verifyResponse.content.filter(b => b.type === 'text').map(b => b.text).join('') || draftAnswer;
  } catch (e) {
    return draftAnswer;
  }
}

// ── Timeout helper ────────────────────────────────────────────────────────────
function withTimeout(promise, ms, label = 'operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);
}

const TOOL_TIMEOUT_MS = 8000;   // 8 s per individual tool call
const GATEWAY_TIMEOUT_MS = 30000; // 30 s for gateway round-trip

// ── Rate limiter ─────────────────────────────────────────────────────────────
const _callLog = {};
const RATE_LIMIT = 50;         // calls per hour per signed-in user
const RATE_WINDOW = 3600000;  // 1 hour

function _checkRate(userId) {
  if (!userId) return { ok: true };
  const now = Date.now();
  if (!_callLog[userId]) _callLog[userId] = [];
  _callLog[userId] = _callLog[userId].filter(t => now - t < RATE_WINDOW);
  if (_callLog[userId].length >= RATE_LIMIT) {
    const oldestCall = _callLog[userId][0];
    const resetsInMs = RATE_WINDOW - (now - oldestCall);
    const resetsInMins = Math.ceil(resetsInMs / 60000);
    return { ok: false, resetsInMins, used: _callLog[userId].length, limit: RATE_LIMIT };
  }
  _callLog[userId].push(now);
  return { ok: true, remaining: RATE_LIMIT - _callLog[userId].length };
}

// ── Anthropic client (Secure Gateway Bridge) ─────────────────────────────────
// Note: We no longer initialize the Anthropic SDK on the client side.
// All calls are proxied through a secure Supabase Edge Function to protect the key.

async function createMessage(params) {
  if (!AI_ENABLED) {
    return {
      id: null,
      usage: null,
      stop_reason: 'disabled',
      content: [{ type: 'text', text: 'AI is disabled. Set EXPO_PUBLIC_AI_BACKEND to "claude" or "local" to enable AI.' }],
    };
  }

  if (AI_BACKEND === 'local') {
    return _createMessageLocal(params);
  }

  return _createMessageGateway(params);
}

async function _createMessageGateway(params) {
  let lastError;
  const delays = [0, 1200, 3000]; // 3 attempts: immediate, 1.2s, 3s
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await new Promise(r => setTimeout(r, delays[attempt]));
    try {
      const { data, error } = await withTimeout(
        supabase.functions.invoke('ai-gateway', { body: params }),
        GATEWAY_TIMEOUT_MS,
        'AI gateway'
      );
      if (error) {
        // 4xx means bad input — bail immediately, no retry
        const status = error.context?.status || error.status;
        if (status >= 400 && status < 500) throw error;
        lastError = error;
        continue;
      }
      return data;
    } catch (e) {
      lastError = e;
      const status = e?.context?.status || e?.status;
      if (status >= 400 && status < 500) {
        console.error('[claudeService] Gateway 4xx — not retrying:', e.message);
        throw e;
      }
      console.error(`[claudeService] Gateway attempt ${attempt + 1} failed:`, e.message);
    }
  }
  throw lastError;
}

function _buildLocalMessages(params) {
  const systemBlocks = Array.isArray(params.system) ? params.system : [];
  const systemMessages = systemBlocks
    .filter(block => block.type === 'text' && block.text)
    .map(block => ({ role: 'system', content: block.text }));

  const userMessages = Array.isArray(params.messages)
    ? params.messages.map(m => ({ role: m.role, content: m.content }))
    : [];

  return [...systemMessages, ...userMessages];
}

async function _createMessageLocal(params) {
  if (!AI_LOCAL_URL) {
    return {
      id: null,
      usage: null,
      stop_reason: 'missing_config',
      content: [{ type: 'text', text: 'Local AI endpoint is not configured. Set EXPO_PUBLIC_AI_LOCAL_URL.' }],
    };
  }

  const localPayload = {
    model: params.model || AI_LOCAL_MODEL,
    messages: _buildLocalMessages(params),
    max_tokens: params.max_tokens || 1024,
    temperature: params.temperature ?? 0.2,
    stream: false,
  };

  try {
    const response = await fetch(AI_LOCAL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(localPayload),
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        id: null,
        usage: null,
        stop_reason: 'local_error',
        content: [{ type: 'text', text: `Local AI error (${response.status}): ${body}` }],
      };
    }

    const json = await response.json();
    const content = [];
    const choice = (json.choices || [])[0] || {};

    if (choice.message?.content) {
      content.push({ type: 'text', text: choice.message.content });
    } else if (choice.text) {
      content.push({ type: 'text', text: choice.text });
    }

    if (choice.tool && choice.tool.name && choice.tool.arguments) {
      try {
        content.push({ type: 'tool_use', name: choice.tool.name, input: JSON.parse(choice.tool.arguments) });
      } catch {
        // ignore invalid tool metadata from the local backend
      }
    }

    return {
      id: json.id || null,
      usage: json.usage || null,
      stop_reason: choice.finish_reason || null,
      content,
    };
  } catch (e) {
    return {
      id: null,
      usage: null,
      stop_reason: 'local_exception',
      content: [{ type: 'text', text: `Local AI request failed: ${e.message}` }],
    };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//  SYSTEM PROMPTS
// ═════════════════════════════════════════════════════════════════════════════

const APP_SYSTEM_PROMPT = `You are GRUVS AI — the superintelligent operating brain of The Gruvs, South Africa's most electric social event discovery platform.

You are not just a chatbot. You are a living intelligence that knows this platform inside out — the events, the Vibers, the trends, the social dynamics, the SA nightlife scene. You think fast, you know the culture deeply, and you genuinely care about every Viber's experience.

━━━ WHO YOU ARE ━━━
You speak like a sharp, culturally fluent South African — you know Cape Town's club scene, Joburg's energy, Durban's flavour, Pretoria's vibe. You're warm but never fake, real but never harsh. You use local slang naturally when it fits: "lekker", "sharp", "jol", "choon", "hectic", "eish" — but you don't force it. You have opinions. You recommend with conviction. You don't hedge everything with "it depends" — you pick the best option and tell them why.

━━━ THE PLATFORM ━━━
• Events = "Gruvs". Attendees = "Vibers". Likes = "Vibes". Comments = "Echoes". RSVPs = "Going".
• Vibe Score measures a Viber's social presence — earned through engagement, hosting, attendance, follows.
• Gruvs is about real connection, not clout farming.
• SA context matters: load shedding affects outdoor events, there are cultural differences across Cape Town / Joburg / Durban / Pretoria, adult events (18+/21+) are mainstream, alcohol references are normal.

━━━ YOUR TOOLS (USE THEM — NEVER GUESS) ━━━
You have live access to the database via tools. These are the rules:
• Asked about events? → Call search_events or get_trending. Never invent event names.
• Asked about people? → Call find_vibers. Never fabricate usernames.
• Asked what user has coming up? → Call check_my_upcoming.
• Asked what their crew is doing? → Call get_social_activity.
• Want more detail on an event? → Call get_event_details.
• Want to know what people are saying? → Call search_echoes.
• Asked about score / engagement? → Call get_vibe_breakdown.
• Chain tools when it gives a better answer. E.g.: search events → get echoes → give recommendation.
• NEVER say "I cannot access real-time data" — you have tools. Use them every time you need real data.

━━━ RESPONSE RULES ━━━
• Be specific. Give names, dates, prices — not vague descriptions.
• Under 3 paragraphs unless the user explicitly wants more.
• End with a concrete question or call-to-action to keep the conversation alive.
• Structure responses cleanly — line breaks, short lists, no walls of text.
• If a user asks for "tonight" and there's nothing in the DB, say so honestly and suggest alternatives.
• Always respect privacy — don't share personal details of other Vibers beyond what they've made public.

━━━ EMOTIONAL INTELLIGENCE ━━━
• Read the mood. If someone seems excited about an event, match their energy.
• If they're frustrated (couldn't get tickets, missed an event), acknowledge it before pivoting.
• For personal questions (social anxiety, meeting new people), be warm and genuine — not clinical.
• Never be dismissive about someone's interests, even if they're niche.`;

const ADMIN_SYSTEM_PROMPT = `You are the admin AI for The Gruvs platform, operating under direct command of the platform owner (TEARN).

You have elevated access and can execute tools that modify platform state. Your role:
• Analyse platform health, user growth, engagement, churn
• Take administrative actions: feature events, send notifications, moderate users, publish announcements
• Give honest, data-backed assessments — never sugarcoat metrics
• Always confirm before destructive actions (mass bans, platform-wide notifications)
• Think like a growth hacker + community manager hybrid

When the owner asks a question, use tools to get real numbers first, then interpret them. Don't state metrics without pulling the actual data.`;

const SELF_HEALING_SYSTEM_PROMPT = `You are the self-healing operations assistant for The Gruvs platform.
Your job is to assess the system, identify real issues, and recommend safe corrective actions.

Rules:
• Do not take action without explicit owner approval.
• Use only verified data from tools or the database.
• If you cannot verify a problem, say it clearly and suggest monitoring instead.
• Summarise health checkpoints and propose the top 3 next actions.
`;

const ARCHITECT_SYSTEM_PROMPT = `You are the AUTONOMOUS ARCHITECT for The Gruvs.
Your mission is to build a RUTHLESSLY OPTIMIZED platform.
You don't just write code; you verify every byte.

TRIPLE-CHECK PROTOCOL IS MANDATORY:
1. SECURITY: Zero trust. Mask PII. Secure storage only.
2. LOGIC: Fulfill the CEO's vision perfectly. No missing edge cases.
3. PERFORMANCE: 60fps UI. Minimal database calls. Cleanest React hooks.

You are 400 developers in one brain. Execute.`;

// ═════════════════════════════════════════════════════════════════════════════
//  TEMPORAL + LOCATION INTELLIGENCE
// ═════════════════════════════════════════════════════════════════════════════

function buildTemporalContext() {
  // SA is UTC+2 (SAST)
  const now = new Date();
  const saNow = new Date(now.getTime() + 2 * 3600000);
  const hour = saNow.getUTCHours();
  const dow = saNow.getUTCDay(); // 0=Sun, 6=Sat
  const today = saNow.toISOString().split('T')[0];

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const timeOfDay = hour < 6 ? 'late night / early morning'
    : hour < 12 ? 'morning'
      : hour < 17 ? 'afternoon'
        : hour < 21 ? 'evening'
          : 'night';

  // Days until weekend
  const daysToFri = (5 - dow + 7) % 7;
  const daysToSat = (6 - dow + 7) % 7;
  const isWeekend = dow === 0 || dow === 5 || dow === 6;

  const satDate = new Date(Date.now() + daysToSat * 86400000).toISOString().split('T')[0];
  const sunDate = new Date(Date.now() + (daysToSat + 1) * 86400000).toISOString().split('T')[0];
  const tomDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  return `TEMPORAL CONTEXT (SA Time):
• Current time: ${dayNames[dow]} ${timeOfDay} (${hour}:00 SAST)
• Today: ${today} | Tomorrow: ${tomDate}
• This weekend: ${satDate} (Sat) & ${sunDate} (Sun)
• ${isWeekend ? '🎉 It is the weekend — nightlife is peaking' : `📅 ${daysToFri === 0 ? 'It is Friday — pre-weekend energy' : `${daysToFri} day(s) until Friday`}`}`;
}

// ═════════════════════════════════════════════════════════════════════════════
//  DEEP CONTEXT BUILDER
// ═════════════════════════════════════════════════════════════════════════════

async function buildDeepContext(userId) {
  if (!userId) return buildTemporalContext();

  try {
    const today = new Date().toISOString().split('T')[0];
    const week30 = new Date(Date.now() - 30 * 86400000).toISOString();

    const results = await Promise.allSettled([
      supabase.from('profiles')
        .select('display_name, username, city, vibe_score, vibe_equity, interests, followers_count, following_count, events_posted, current_streak, social_integrity_score')
        .eq('id', userId).single(),
      supabase.from('ai_user_memory')
        .select('summary, preferences, behaviour')
        .eq('user_id', userId).single(),
      supabase.from('event_rsvps')
        .select('status, events(title, category, city)')
        .eq('user_id', userId)
        .gte('created_at', week30)
        .limit(15),
      supabase.from('event_vibes')
        .select('events(title, category)')
        .eq('user_id', userId)
        .gte('created_at', week30)
        .limit(20),
      supabase.from('saved_events')
        .select('events(title, category)')
        .eq('user_id', userId)
        .limit(10),
      supabase.from('follows')
        .select('profiles!following_id(username, interests, city)')
        .eq('follower_id', userId)
        .limit(20),
      supabase.from('ai_interactions')
        .select('feature, input, output')
        .eq('user_id', userId)
        .eq('feedback', 1)
        .order('created_at', { ascending: false })
        .limit(3),
      supabase.from('events')
        .select('title, category, event_date, city, trending_score')
        .eq('is_cancelled', false)
        .gte('event_date', today)
        .order('trending_score', { ascending: false })
        .limit(8),
    ]);
    const [profileRes, memoryRes, rsvpsRes, vibesRes, savedRes, followingRes, interactionsRes, nearbyRes] = results;
    const profile = profileRes.status === 'fulfilled' ? profileRes.value.data : null;
    const memory = memoryRes.status === 'fulfilled' ? memoryRes.value.data : null;
    const rsvps = rsvpsRes.status === 'fulfilled' ? rsvpsRes.value.data : null;
    const vibes = vibesRes.status === 'fulfilled' ? vibesRes.value.data : null;
    const savedEvents = savedRes.status === 'fulfilled' ? savedRes.value.data : null;
    const following = followingRes.status === 'fulfilled' ? followingRes.value.data : null;
    const topInteractions = interactionsRes.status === 'fulfilled' ? interactionsRes.value.data : null;
    const nearbyEvents = nearbyRes.status === 'fulfilled' ? nearbyRes.value.data : null;

    const lines = [];

    // Profile
    if (profile) {
      const isSovereign = (profile.vibe_equity || 0) >= 1000;
      lines.push(`USER PROFILE: ${profile.display_name || profile.username} | TIER: ${isSovereign ? 'SOVEREIGN' : 'VIBER'}`);
      lines.push(`Integrity: ${profile.social_integrity_score}/100 | Vibe Score: ${profile.vibe_score} | Equity: ${profile.vibe_equity}`);
      lines.push(`Interests: ${(profile.interests || []).join(', ') || 'not set'} | Followers: ${profile.followers_count || 0} | Events Posted: ${profile.events_posted || 0}`);
    }


    // AI memory
    if (memory?.summary) {
      lines.push(`\nLEARNED PREFERENCES: ${memory.summary}`);
      if (memory.behaviour) {
        const b = memory.behaviour;
        lines.push(`Engagement: ${b.engagement_level || '?'} | Churn Risk: ${b.churn_risk || '?'} | Avg RSVP Rate: ${b.avg_rsvp_rate || 0}`);
      }
    }

    // Recent RSVPs
    const rsvpList = (rsvps || []).filter(r => r.events);
    if (rsvpList.length) {
      const going = rsvpList.filter(r => r.status === 'going').map(r => r.events.title);
      lines.push(`\nRECENT RSVPs (going): ${going.slice(0, 5).join(', ') || 'none'}`);
    }

    // Vibes given
    const vibeCategories = [...new Set((vibes || []).filter(v => v.events?.category).map(v => v.events.category))];
    if (vibeCategories.length) {
      lines.push(`Categories they vibe to: ${vibeCategories.slice(0, 5).join(', ')}`);
    }

    // Saved events
    const savedCategories = [...new Set((savedEvents || []).filter(s => s.events?.category).map(s => s.events.category))];
    if (savedCategories.length) {
      lines.push(`Saved event categories: ${savedCategories.slice(0, 5).join(', ')}`);
    }

    // Who they follow
    const followedCities = [...new Set((following || []).filter(f => f.profiles?.city).map(f => f.profiles.city))];
    const followedInterests = [...new Set((following || []).flatMap(f => f.profiles?.interests || []))].slice(0, 6);
    if (following?.length) {
      lines.push(`\nSOCIAL GRAPH: Follows ${following.length} Vibers | Their crews are spread across: ${followedCities.slice(0, 3).join(', ')} | Shared interests in crew: ${followedInterests.join(', ')}`);
    }

    // What AI responses they liked
    if (topInteractions?.length) {
      const liked = topInteractions.map(i => i.feature).join(', ');
      lines.push(`\nAI HISTORY: Previously enjoyed help with: ${liked}`);
    }

    // Nearby trending events
    if (nearbyEvents?.length) {
      lines.push(`\nTRENDING IN ${profile?.city?.toUpperCase() || 'THEIR CITY'}:`);
      nearbyEvents.slice(0, 5).forEach(e => {
        lines.push(`  • ${e.title} (${e.category}, ${e.event_date})`);
      });
    }

    // Temporal context (always last)
    lines.push('\n' + buildTemporalContext());

    return lines.join('\n');
  } catch {
    return buildTemporalContext();
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//  INTERACTION LOGGER
// ═════════════════════════════════════════════════════════════════════════════

async function _logInteraction({ userId, feature, input, output, model, tokensUsed }) {
  try {
    const { data } = await supabase.from('ai_interactions').insert({
      user_id: userId || null,
      feature,
      input: input ? String(input).slice(0, 2000) : null,
      output: output ? String(output).slice(0, 5000) : null,
      model,
      tokens_used: tokensUsed || null,
    }).select('id').single();
    return data?.id || null;
  } catch { return null; }
}

// ═════════════════════════════════════════════════════════════════════════════
//  CORE CALL WRAPPERS
// ═════════════════════════════════════════════════════════════════════════════

async function _call({ messages, feature, userId, model = MODEL_HAIKU, systemExtra = '', tools = null, maxTokens = 1024 }) {
  if (!AI_ENABLED) return { text: null, id: null, error: 'AI disabled' };
  const rate = _checkRate(userId);
  if (!rate.ok) return { text: null, id: null, error: `Rate limit reached (${rate.used}/${rate.limit} calls). Resets in ${rate.resetsInMins} min.` };

  const systemBlocks = [
    { type: 'text', text: APP_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: CORE_REASONING_PROMPT, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: NO_HALLUCINATION_PROMPT, cache_control: { type: 'ephemeral' } },
  ];
  if (systemExtra) systemBlocks.push({ type: 'text', text: systemExtra });

  try {
    const params = { model, max_tokens: maxTokens, system: systemBlocks, messages };
    if (tools && AI_BACKEND !== 'local') params.tools = tools;
    const response = await createMessage(params);

    const text = response.content.find(b => b.type === 'text')?.text || '';
    const toolUse = response.content.find(b => b.type === 'tool_use');
    const tokens = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

    _logInteraction({ userId, feature, input: messages.at(-1)?.content, output: text, model, tokensUsed: tokens });

    return { text, toolUse, id: response.id, stopReason: response.stop_reason, content: response.content, usage: response.usage };
  } catch (e) {
    console.warn('[claudeService] API error:', e?.message);
    return { text: null, id: null, error: e?.message || 'AI unavailable' };
  }
}

// Extended thinking — for deep reasoning tasks (no tool_use in same call)
async function _callWithThinking({ messages, feature, userId, systemExtra = '', thinkingBudget = 8000 }) {
  if (!AI_ENABLED) return { text: null, id: null, error: 'AI disabled' };
  const rate = _checkRate(userId);
  if (!rate.ok) return { text: null, id: null, error: `Rate limit reached (${rate.used}/${rate.limit} calls). Resets in ${rate.resetsInMins} min.` };

  const systemBlocks = [
    { type: 'text', text: APP_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: CORE_REASONING_PROMPT, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: NO_HALLUCINATION_PROMPT, cache_control: { type: 'ephemeral' } },
  ];
  if (systemExtra) systemBlocks.push({ type: 'text', text: systemExtra });

  try {
    const response = await createMessage({
      model: MODEL_SONNET,
      max_tokens: thinkingBudget + 4096,
      thinking: { type: 'enabled', budget_tokens: thinkingBudget },
      system: systemBlocks,
      messages,
    });

    // Extract only text blocks — thinking blocks are internal
    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const tokens = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

    _logInteraction({ userId, feature, input: messages.at(-1)?.content, output: text, model: MODEL_SONNET, tokensUsed: tokens });

    return { text, id: response.id, usage: response.usage };
  } catch (e) {
    // Fall back to standard call if thinking fails (quota/region issue)
    console.warn('[claudeService] Extended thinking unavailable, falling back:', e?.message);
    return _call({ messages, feature, userId, model: MODEL_SONNET, systemExtra, maxTokens: 2048 });
  }
}

// Agentic multi-turn loop — Claude calls tools until it has enough data to answer
async function _agenticLoop({ messages, feature, userId, systemExtra = '', tools, maxTurns = MAX_AGENT_TURNS }) {
  if (AI_BACKEND === 'local') {
    return _callWithThinking({ messages, feature, userId, systemExtra, thinkingBudget: THINKING_BUDGET_CHAT });
  }

  if (!AI_ENABLED) return { text: null, id: null, error: 'AI disabled' };
  const rate = _checkRate(userId);
  if (!rate.ok) return { text: null, id: null, error: `Rate limit reached (${rate.used}/${rate.limit} calls). Resets in ${rate.resetsInMins} min.` };

  const systemBlocks = [
    { type: 'text', text: APP_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: CORE_REASONING_PROMPT, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: NO_HALLUCINATION_PROMPT, cache_control: { type: 'ephemeral' } },
  ];
  if (systemExtra) systemBlocks.push({ type: 'text', text: systemExtra });

  let history = [...messages];
  let turns = 0;
  let finalText = '';
  let firstId = null;
  let hadToolUse = false;
  let allToolResults = '';

  try {
    while (turns < maxTurns) {
      const response = await createMessage({
        model: MODEL_SONNET,
        max_tokens: 4096,
        system: systemBlocks,
        messages: history,
        tools,
      });

      if (!firstId) firstId = response.id;

      const hasToolUse = response.content.some(b => b.type === 'tool_use');
      if (hasToolUse) hadToolUse = true;

      if (response.stop_reason === 'end_turn' || !hasToolUse) {
        finalText = response.content.find(b => b.type === 'text')?.text || '';
        break;
      }

      // Execute all tool calls in this turn (with per-tool timeout)
      const toolResults = [];
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          let toolText;
          try {
            const result = await withTimeout(
              _executeAssistantTool(block.name, block.input, userId),
              TOOL_TIMEOUT_MS,
              `tool:${block.name}`
            );
            toolText = _normalizeToolResult(result);
          } catch (toolErr) {
            toolText = `Tool error: ${toolErr.message}`;
          }
          allToolResults += `TOOL ${block.name}: ${toolText}\n`;
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: toolText });
        }
      }

      // Add assistant turn + tool results to history
      history.push({ role: 'assistant', content: response.content });
      history.push({ role: 'user', content: toolResults });
      turns++;
    }

    if (!finalText) {
      // Max turns hit — get final answer without tools
      const final = await createMessage({
        model: MODEL_SONNET,
        max_tokens: 1024,
        system: systemBlocks,
        messages: history,
      });
      finalText = final.content.find(b => b.type === 'text')?.text || '';
    }

    if (hadToolUse) {
      const question = messages.at(-1)?.content || '';
      finalText = await _verifyFinalAnswer({ systemBlocks, question, toolResults: allToolResults, draftAnswer: finalText });
    }

    _logInteraction({ userId, feature, input: messages.at(-1)?.content, output: finalText, model: MODEL_SONNET });

    return { text: finalText, id: firstId };
  } catch (e) {
    console.warn('[claudeService] Agentic loop error:', e?.message);
    // Fall back to non-agentic call
    return _call({ messages, feature, userId, model: MODEL_SONNET, systemExtra, maxTokens: 1024 });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//  ASSISTANT TOOLS — 8 live Supabase queries Claude can call
// ═════════════════════════════════════════════════════════════════════════════

const ASSISTANT_TOOLS = [
  {
    name: 'search_events',
    description: 'Search for real events in the database. Use this EVERY TIME the user asks about events, what is happening, or what to attend. Never guess event names — always call this tool.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search text (event name, vibe, artist, venue — optional)' },
        city: { type: 'string', description: 'City to search in (optional)' },
        category: { type: 'string', description: 'Category: music, party, nightlife, food, art, sport, festival, workshop (optional)' },
        date: { type: 'string', description: '"today", "tomorrow", "this_weekend", or YYYY-MM-DD (optional)' },
        free_only: { type: 'boolean', description: 'Only return free events' },
        limit: { type: 'number', description: 'Max results (default 6, max 12)' },
      },
    },
  },
  {
    name: 'get_event_details',
    description: 'Get full details about a specific event — host, description, tickets, age restriction, exact location. Use when a user asks for more info about a specific event.',
    input_schema: {
      type: 'object',
      properties: {
        event_id: { type: 'string', description: 'Event UUID from a previous search_events result' },
        title: { type: 'string', description: 'Event title to search for if no ID is known' },
      },
    },
  },
  {
    name: 'find_vibers',
    description: 'Find real Vibers (users) to follow based on interests, city, or engagement. Use when the user asks who to follow, who else is into X, or who is active in their area.',
    input_schema: {
      type: 'object',
      properties: {
        interests: { type: 'array', items: { type: 'string' }, description: 'Filter by shared interests' },
        city: { type: 'string', description: 'Filter by city' },
        min_score: { type: 'number', description: 'Minimum Vibe Score filter' },
        limit: { type: 'number', description: 'Max results (default 5)' },
      },
    },
  },
  {
    name: 'get_trending',
    description: 'Get what is currently trending on The Gruvs — top events by vibe count, top Vibers by score, hot categories. Use when asked about trending, most popular, or what everyone is talking about.',
    input_schema: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'Filter trending by city (optional)' },
        category: { type: 'string', description: 'Filter by category (optional)' },
      },
    },
  },
  {
    name: 'check_my_upcoming',
    description: "Get the events the signed-in user has RSVPed to that are coming up. Use when they ask about their plans, schedule, upcoming events, or what they are going to.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_social_activity',
    description: "See what events the people the user follows are attending. Use when they ask what their crew or friends are up to, or where the squad is going.",
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (default 8)' },
      },
    },
  },
  {
    name: 'get_vibe_breakdown',
    description: "Get a detailed breakdown of the user's Vibe Score, engagement stats, and AI-learned behaviour profile. Use when they ask about their score, how to improve, or their engagement stats.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'search_echoes',
    description: 'Get what Vibers are saying (echo comments) about a specific event. Use when the user wants to know the vibe, reviews, or community reaction to an event.',
    input_schema: {
      type: 'object',
      properties: {
        event_id: { type: 'string', description: 'Event UUID' },
        event_title: { type: 'string', description: 'Event title to find echoes for' },
        limit: { type: 'number', description: 'Max echoes (default 8)' },
      },
    },
  },
];

async function _executeAssistantTool(name, input, userId) {
  try {
    const today = new Date().toISOString().split('T')[0];

    switch (name) {

      case 'search_events': {
        let q = supabase.from('events')
          .select('id, title, city, category, event_date, event_time, price_min, going, vibe_count, address, age_restriction')
          .eq('is_cancelled', false)
          .gte('event_date', today)
          .order('trending_score', { ascending: false })
          .limit(Math.min(input.limit || 6, 12));

        if (input.query) q = q.or(`title.ilike.%${input.query}%,description.ilike.%${input.query}%`);
        if (input.city) q = q.ilike('city', `%${input.city}%`);
        if (input.category) q = q.or(`category.ilike.%${input.category}%,categories.cs.{${input.category}}`);

        if (input.date === 'today') {
          q = q.eq('event_date', today);
        } else if (input.date === 'tomorrow') {
          q = q.eq('event_date', new Date(Date.now() + 86400000).toISOString().split('T')[0]);
        } else if (input.date === 'this_weekend') {
          const dow = new Date().getDay();
          const dSat = (6 - dow + 7) % 7 || 7;
          const sat = new Date(Date.now() + dSat * 86400000).toISOString().split('T')[0];
          const sun = new Date(Date.now() + (dSat + 1) * 86400000).toISOString().split('T')[0];
          q = q.gte('event_date', sat).lte('event_date', sun);
        } else if (input.date && input.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          q = q.eq('event_date', input.date);
        }

        if (input.free_only) q = q.or('price_min.is.null,price_min.eq.0');

        const { data } = await q;
        if (!data?.length) return 'No events found matching those criteria. Try broadening the search.';
        return data.map(e =>
          `📍 ${e.title} | ${e.city} | ${e.category} | ${e.event_date}${e.event_time ? ' @ ' + e.event_time : ''} | ${e.price_min ? 'R' + e.price_min : 'Free'} | ${e.going || 0} going | ${e.vibe_count || 0} vibes${e.age_restriction ? ' | ' + e.age_restriction + '+' : ''} | ID: ${e.id}`
        ).join('\n');
      }

      case 'get_event_details': {
        let q = supabase.from('events')
          .select('*, profiles!author_id(display_name, username, vibe_score, social_integrity_score)');
        if (input.event_id) q = q.eq('id', input.event_id);
        else if (input.title) q = q.ilike('title', `%${input.title}%`);
        const { data } = await q.limit(1).maybeSingle();
        if (!data) return 'Event not found. Try searching with search_events first.';
        const host = data.profiles;
        return `EVENT DETAILS: ${data.title}
Host: ${host?.display_name || host?.username || 'Unknown'} (Score: ${host?.vibe_score || 0}, Integrity: ${host?.social_integrity_score || 0}/100)
Date: ${data.event_date}${data.event_time ? ' @ ' + data.event_time : ''} | Ends: ${data.end_time || 'TBA'}
Venue: ${data.venue_name || data.address || 'TBA'} | City: ${data.city || 'TBA'}
Category: ${data.category} | Price: ${data.price_min != null ? 'R' + data.price_min + (data.price_max ? '–R' + data.price_max : '') : 'Free'}
Age: ${data.age_restriction ? data.age_restriction + '+' : 'All ages'} | Capacity: ${data.capacity || 'Unlimited'}
Going: ${data.going || 0} | Vibes: ${data.vibe_count || 0} | Echoes: ${data.echo_count || 0}
Description: ${data.description || 'No description provided'}
${data.ticket_url ? 'Tickets: ' + data.ticket_url : 'No ticket link'}
${data.is_featured ? '⭐ FEATURED EVENT' : ''}`;
      }

      case 'find_vibers': {
        let q = supabase.from('profiles')
          .select('display_name, username, city, vibe_score, social_integrity_score, interests, followers_count, events_posted')
          .eq('is_discoverable', true)
          .eq('is_online', true) // Prioritize online users for real-time connection
          .eq('identity_mode', 'public') // Advanced Privacy: Never let AI suggest Ghosts
          .order('social_integrity_score', { ascending: false }) // Order by Integrity first
          .limit(input.limit || 5);
        if (userId) q = q.neq('id', userId);
        if (input.city) q = q.ilike('city', `%${input.city}%`);
        if (input.min_score) q = q.gte('vibe_score', input.min_score);
        if (input.interests?.length) {
          q = q.overlaps('interests', input.interests);
        }
        const { data } = await q;
        if (!data?.length) return 'No Vibers found matching those criteria.';
        return data.map(v =>
          `👤 @${v.username} | ${v.city || 'SA'} | Score: ${v.vibe_score} | Integrity: ${v.social_integrity_score}/100 | Interests: ${(v.interests || []).slice(0, 3).join(', ')}`
        ).join('\n');
      }

      case 'get_trending': {
        const [{ data: events }, { data: vibers }, { data: cats }] = await Promise.all([
          supabase.from('events')
            .select('title, city, category, vibe_count, going, trending_score, event_date')
            .eq('is_cancelled', false)
            .gte('event_date', today)
            .order('trending_score', { ascending: false })
            .limit(6),
          supabase.from('profiles')
            .select('display_name, username, vibe_score, city')
            .order('vibe_score', { ascending: false })
            .limit(5),
          supabase.from('events')
            .select('category')
            .eq('is_cancelled', false)
            .gte('event_date', today)
            .limit(100),
        ]);

        // Count category frequency
        const catCount = {};
        (cats || []).forEach(e => { if (e.category) catCount[e.category] = (catCount[e.category] || 0) + 1; });
        const topCats = Object.entries(catCount).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c]) => c);

        return `🔥 TOP TRENDING EVENTS:
${(events || []).map((e, i) => `${i + 1}. ${e.title} (${e.city}) — ${e.vibe_count || 0} vibes, ${e.going || 0} going, ${e.event_date}`).join('\n')}

⚡ TOP VIBERS:
${(vibers || []).map((v, i) => `${i + 1}. @${v.username} (${v.city || 'SA'}) — ${v.vibe_score || 0} score`).join('\n')}

📂 HOTTEST CATEGORIES: ${topCats.join(', ')}`;
      }

      case 'check_my_upcoming': {
        if (!userId) return 'User is not signed in.';
        const { data } = await supabase.from('event_rsvps')
          .select('status, events(id, title, city, event_date, event_time, address, category)')
          .eq('user_id', userId)
          .in('status', ['going', 'interested'])
          .limit(10);
        const valid = (data || []).filter(r => r.events && r.events.event_date >= today);
        if (!valid.length) return 'No upcoming RSVPs found. Browse events and tap Going!';
        return `YOUR UPCOMING PLANS:\n${valid.map(r => `${r.status === 'going' ? '✅' : '👀'} ${r.events.title} | ${r.events.city} | ${r.events.event_date}${r.events.event_time ? ' @ ' + r.events.event_time : ''} | ${r.events.category}`).join('\n')}`;
      }

      case 'get_social_activity': {
        if (!userId) return 'User is not signed in.';
        const { data: following } = await supabase.from('follows')
          .select('following_id')
          .eq('follower_id', userId)
          .limit(100);
        if (!following?.length) return 'You are not following anyone yet. Follow some Vibers to see their activity!';
        const ids = following.map(f => f.following_id);
        const { data: rsvps } = await supabase.from('event_rsvps')
          .select('user_id, status, profiles(username, display_name), events(title, city, event_date, category)')
          .in('user_id', ids)
          .eq('status', 'going')
          .limit((input.limit || 10) * 3);
        const valid = (rsvps || []).filter(r => r.events && r.profiles && r.events.event_date >= today).slice(0, input.limit || 10);
        if (!valid.length) return 'Nobody in your crew has RSVPed to upcoming events yet.';
        return `YOUR CREW IS GOING TO:\n${valid.map(r => `🎉 @${r.profiles.username || r.profiles.display_name} → ${r.events.title} (${r.events.city}, ${r.events.event_date})`).join('\n')}`;
      }

      case 'get_vibe_breakdown': {
        if (!userId) return 'User is not signed in.';
        const [{ data: p }, { data: mem }, { data: rsvpCount }, { data: vibeCount }] = await Promise.all([
          supabase.from('profiles').select('vibe_score, followers_count, following_count, events_posted, social_integrity_score, current_streak, city').eq('id', userId).single(),
          supabase.from('ai_user_memory').select('behaviour, preferences').eq('user_id', userId).single(),
          supabase.from('event_rsvps').select('id', { count: 'exact', head: true }).eq('user_id', userId),
          supabase.from('event_vibes').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        ]);
        return `VIBE SCORE BREAKDOWN:
Total Score: ${p?.vibe_score || 0}
Followers: ${p?.followers_count || 0} | Following: ${p?.following_count || 0}
Events Posted: ${p?.events_posted || 0}
Total RSVPs ever: ${rsvpCount?.count || 0} | Total Vibes given: ${vibeCount?.count || 0}
Current Streak: ${p?.current_streak || 0} days
Social Integrity: ${p?.social_integrity_score || 0}/100
Engagement Level: ${mem?.behaviour?.engagement_level || 'not assessed'}
Churn Risk: ${mem?.behaviour?.churn_risk || 'not assessed'}
Preferred Categories: ${JSON.stringify(mem?.preferences?.categories || [])}
Time Preference: ${mem?.preferences?.time_preference || 'unknown'}
Price Sensitivity: ${mem?.preferences?.price_sensitivity || 'unknown'}`;
      }

      case 'search_echoes': {
        let q = supabase.from('echoes').select('body, created_at, profiles(username, display_name), event_id');
        if (input.event_id) q = q.eq('event_id', input.event_id);
        else if (input.event_title) {
          const { data: ev } = await supabase.from('events').select('id').ilike('title', `%${input.event_title}%`).limit(1).single();
          if (ev?.id) q = q.eq('event_id', ev.id);
        }
        const { data } = await q.order('created_at', { ascending: false }).limit(input.limit || 8);
        if (!data?.length) return 'No echoes found for this event. Be the first to drop one!';
        return `WHAT VIBERS ARE SAYING:\n${data.map(e => `💬 @${e.profiles?.username || 'Viber'}: "${e.body}"`).join('\n')}`;
      }

      default:
        return `Tool "${name}" is not implemented.`;
    }
  } catch (e) {
    return `Tool error: ${e.message}`;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//  PUBLIC API
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Agentic chat — can chain up to 6 live database queries before answering.
 * Extended thinking enabled for conversations > 3 turns.
 */
export async function chat(messages, { feature = AIFeature.ASSISTANT, userId, systemExtra = '' } = {}) {
  const context = await buildDeepContext(userId);
  const enrichedExtra = [
    systemExtra,
    context,
    feature === AIFeature.ARCHITECT ? ARCHITECT_SYSTEM_PROMPT : ''
  ].filter(Boolean).join('\n\n');

  const isComplex = _isComplexConversation(messages);
  const isLocalBackend = AI_BACKEND === 'local';
  const useThinking = isLocalBackend || isComplex || feature === AIFeature.VIBE_COACH || feature === AIFeature.PROFILE_BUILDER || feature === AIFeature.EVENT_CREATOR;
  const useAgentic = !isLocalBackend && (feature === AIFeature.ASSISTANT || feature === AIFeature.ADMIN || feature === AIFeature.ROYAL_REVENUE || feature === AIFeature.NOTIFICATION);

  if (feature === AIFeature.ARCHITECT) {
    // 40x Logic: Use the Recursive RM-OS Engine
    const CEOInstruction = messages.at(-1)?.content || '';
    return HyperReasoning.initiateDeepThought(enrichedExtra + '\n\n' + CEOInstruction);
  }

  if (useAgentic && !messages.some(m => Array.isArray(m.content))) {
    return _agenticLoop({
      messages,
      feature,
      userId,
      systemExtra: enrichedExtra,
      tools: ASSISTANT_TOOLS,
      maxTurns: MAX_AGENT_TURNS,
    });
  }

  return _callWithThinking({
    messages,
    feature,
    userId,
    systemExtra: enrichedExtra,
    thinkingBudget: useThinking ? THINKING_BUDGET_CHAT : 4096,
  });
}

/**
 * Revenue Agent v1.0 — Autonomous Monetization Logic.
 * Identifies high-vibe users and generates personalized "Royal Pass" pitches.
 */
export async function generateRevenueHook({ userId, profile, activity }) {
  const prompt = `[REVENUE AGENT]
  USER: @${profile.username}
  VIBE SCORE: ${profile.vibe_score}
  RECENT ACTIVITY: ${JSON.stringify(activity)}

  TASK:
  1. Analyze if this user is a "Power User" (Vibe Score > 200).
  2. If they are, generate a personalized "Royal Pass" subscription offer.
  3. The offer must feel like an exclusive invite to a secret society, not a sales pitch.
  4. Mention specific benefits they'd care about (e.g., "Skip the line at ${activity.top_city} Gruvs").

  Return JSON: {
    "is_eligible": boolean,
    "offer_title": "Elite Invite Copy",
    "offer_body": "Personalized Pitch",
    "price_point": "e.g. R99/mo",
    "conversion_logic": "Why this will work"
  }`;

  return _call({
    messages: [{ role: 'user', content: prompt }],
    feature: AIFeature.ROYAL_REVENUE,
    userId,
    model: MODEL_SONNET
  });
}

/**
 * Generate bios with self-critique loop.
 * Step 1: Haiku generates 5 candidates.
 * Step 2: Sonnet reviews all 5 and picks the best 3, polishes them.
 */
export async function generateBio({ interests = [], career = '', location = '', vibeScore = 0, userId } = {}) {
  const context = await buildDeepContext(userId);

  // Step 1: Generate candidates
  const genPrompt = `Generate 5 distinct, authentic bio options for a Gruvs Viber.

USER DATA:
- Interests: ${interests.join(', ') || 'not specified'}
- Career: ${career || 'not specified'}
- Location: ${location || 'South Africa'}
- Vibe Score: ${vibeScore}

Write bios that feel real — like something this person would actually say, not corporate copy.
SA slang welcome if it fits the interests/vibe.
Vary the lengths: short punchy, medium personality, long full story.

${context}

Return ONLY a JSON object:
{
  "candidates": [
    "Bio option 1",
    "Bio option 2",
    "Bio option 3",
    "Bio option 4",
    "Bio option 5"
  ]
}`;

  const gen = await _call({
    messages: [{ role: 'user', content: genPrompt }],
    feature: AIFeature.PROFILE_BUILDER,
    userId,
    model: MODEL_HAIKU,
    maxTokens: 800,
  });

  let candidates = [];
  try { candidates = _parseJSON(gen.text).candidates || []; } catch { }
  if (!candidates.length) return { bios: [], id: gen.id, error: 'Generation failed' };

  // Step 2: Critique + pick best 3 with Sonnet
  const critiquePrompt = `You are reviewing bio options for a Gruvs Viber. Critique these 5 candidates and select the 3 best, lightly polishing each for maximum impact. Consider: authenticity, memorability, personality, SA cultural fit.

CANDIDATES:
${candidates.map((b, i) => `${i + 1}. "${b}"`).join('\n')}

USER CONTEXT: interests=[${interests.join(', ')}], career=${career}, location=${location}

Return ONLY a JSON object:
{
  "bios": [
    "Best bio (most punchy, under 80 chars)",
    "Second bio (personality-forward, 80-150 chars)",
    "Third bio (full story, 150-220 chars)"
  ],
  "reasoning": "One sentence on what made these the strongest choices"
}`;

  const critique = await _callWithThinking({
    messages: [{ role: 'user', content: critiquePrompt }],
    feature: AIFeature.PROFILE_BUILDER,
    userId,
    thinkingBudget: 3000,
  });

  try {
    const parsed = _parseJSON(critique.text);
    return { bios: parsed.bios || [], reasoning: parsed.reasoning || '', id: critique.id };
  } catch {
    return { bios: candidates.slice(0, 3), id: gen.id };
  }
}

/**
 * Parse rough description into structured event fields.
 * Trend-aware — knows what categories are hot right now.
 */
export async function fillEvent({ roughDescription = '', city = '', userId } = {}) {
  // Pull trending categories for smart suggestions
  let trendingCats = '';
  try {
    const { data } = await supabase.from('events')
      .select('category')
      .eq('is_cancelled', false)
      .gte('event_date', new Date().toISOString().split('T')[0])
      .limit(50);
    const counts = {};
    (data || []).forEach(e => { if (e.category) counts[e.category] = (counts[e.category] || 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c);
    trendingCats = sorted.join(', ');
  } catch { }

  const prompt = `Parse this rough event description into structured fields for a South African event platform.

DESCRIPTION: "${roughDescription}"
CITY HINT: "${city || 'not specified'}"
TRENDING CATEGORIES RIGHT NOW: ${trendingCats || 'party, music, nightlife, art, food'}
TIME NOW: ${buildTemporalContext()}

Extract every detail you can infer. Be specific with the title — make it compelling and marketable.
For city: normalise to proper South African city names (Johannesburg, Cape Town, Durban, Pretoria, etc.)
For category: pick the most fitting from the trending list if it applies, otherwise choose the most accurate.

Return ONLY a JSON object:
{
  "title":           "Event title (max 60 chars, compelling — not generic)",
  "description":     "Full event description (max 300 chars, exciting but factual, SA vibe)",
  "venue_name":      "Venue name if mentioned, else null",
  "address":         "Address if mentioned, else null",
  "city":            "City (proper SA city name)",
  "category":        "Best matching category",
  "event_time":      "HH:MM in 24h format if mentioned, else null",
  "price_min":       "Number or null",
  "price_max":       "Number or null",
  "age_restriction": "0 or 16 or 18 or 21 — infer from context if not stated",
  "tags":            ["tag1", "tag2", "tag3", "tag4"]
}`;

  const result = await _call({
    messages: [{ role: 'user', content: prompt }],
    feature: AIFeature.EVENT_CREATOR,
    userId,
    model: MODEL_HAIKU,
    maxTokens: 600,
  });

  try {
    return { ..._parseJSON(result.text), id: result.id };
  } catch {
    return { id: result.id, error: 'Could not parse event data' };
  }
}

/**
 * Vibe coach with extended thinking + 30-day activity history.
 * The most intelligence-intensive call in the app.
 */
export async function vibeCoach({ profile = {}, recentActivity = {}, userId } = {}) {
  const context = await buildDeepContext(userId);

  // Pull 30-day detailed history
  let historyBlock = '';
  if (userId) {
    try {
      const month30 = new Date(Date.now() - 30 * 86400000).toISOString();
      const [{ data: rsvps }, { data: vibes }, { data: echoes }, { data: checkins }, { data: peers }] = await Promise.all([
        supabase.from('event_rsvps').select('status, created_at').eq('user_id', userId).gte('created_at', month30),
        supabase.from('event_vibes').select('id').eq('user_id', userId).gte('created_at', month30),
        supabase.from('echoes').select('id').eq('user_id', userId).gte('created_at', month30),
        supabase.from('live_checkins').select('id').eq('user_id', userId).gte('created_at', month30),
        // Compare to similar-score Vibers
        supabase.from('profiles')
          .select('vibe_score, followers_count')
          .gte('vibe_score', (profile.vibe_score || 0) - 50)
          .lte('vibe_score', (profile.vibe_score || 0) + 100)
          .limit(20),
      ]);
      const peerAvgFollowers = peers?.length
        ? Math.round(peers.reduce((s, p) => s + (p.followers_count || 0), 0) / peers.length)
        : 0;
      historyBlock = `
30-DAY DETAILED ACTIVITY:
• RSVPs total: ${rsvps?.length || 0} (going: ${rsvps?.filter(r => r.status === 'going').length || 0})
• Vibes given: ${vibes?.length || 0}
• Echoes written: ${echoes?.length || 0}
• Check-ins: ${checkins?.length || 0}

PEER BENCHMARK (similar Vibe Score range):
• Average followers in peer group: ${peerAvgFollowers}
• This user's followers: ${profile.followers_count || 0} (${(profile.followers_count || 0) >= peerAvgFollowers ? 'above' : 'below'} peer average)`;
    } catch { }
  }

  const prompt = `You are an elite growth coach for The Gruvs platform. Analyse this Viber's full profile and activity, identify exactly what's holding them back and what's working, and give them a hyper-personalised coaching plan.

VIBER PROFILE:
- Vibe Score: ${profile.vibe_score || 0}
- Followers: ${profile.followers_count || 0} | Following: ${profile.following_count || 0}
- Events Posted: ${profile.events_posted || 0}
- Current Streak: ${profile.current_streak || 0} days
- Social Integrity: ${profile.social_integrity_score || 0}/100
- Interests: ${(profile.interests || []).join(', ') || 'not set'}

RECENT 7-DAY ACTIVITY:
- RSVPs: ${recentActivity.rsvps || 0}
- Vibes given: ${recentActivity.vibes || 0}
- Echoes written: ${recentActivity.echoes || 0}
- Events attended (check-ins): ${recentActivity.checkins || 0}
${historyBlock}

${context}

COACHING REQUIREMENTS:
1. Be specific — reference their actual numbers, not generic advice
2. Identify the single biggest lever they can pull right now
3. Give time-sensitive tips based on the current day/time
4. Reference what's trending on the platform to give relevant advice
5. Be warm but honest — if their numbers are low, say it kindly but clearly

Return ONLY a JSON object:
{
  "score_analysis": "2-sentence diagnosis of where their score stands and why",
  "biggest_lever":  "The single most impactful action they should take TODAY (be specific)",
  "tips": [
    "Tip 1 — reference their actual data",
    "Tip 2 — reference their actual data",
    "Tip 3 — time-sensitive based on current day/weekend proximity"
  ],
  "next_milestone": "Specific next target (e.g. 'Hit 400 Vibe Score by attending 2 events this weekend')",
  "peer_insight":   "One sentence comparing them to similar Vibers (encouraging but honest)"
}`;

  const result = await _callWithThinking({
    messages: [{ role: 'user', content: prompt }],
    feature: AIFeature.VIBE_COACH,
    userId,
    thinkingBudget: THINKING_BUDGET_COACH,
  });

  try {
    return { ..._parseJSON(result.text), id: result.id };
  } catch {
    return { tips: [], insight: '', next_milestone: '', id: result.id, error: 'Could not parse coaching response' };
  }
}

/**
 * Multi-layer content moderation.
 * Haiku does a fast first pass. If verdict is borderline ('flagged'), Sonnet does
 * a deep review with full context reasoning before final verdict.
 */
export async function moderateContent({ text = '', type = 'event' } = {}) {
  const fastPrompt = `Moderate this ${type} content for a South African event platform.

CONTENT: "${text.slice(0, 1000)}"

SA CONTEXT: Party/nightlife/adult event language, alcohol references, club culture, slang — all NORMAL.
Flag or remove ONLY: hate speech, slurs, explicit sexual content, violence threats, scams, spam, personal contact details in event descriptions.

Return ONLY valid JSON:
{"verdict":"approved"|"flagged"|"removed","confidence":0.0-1.0,"reason":"one sentence","borderline":true|false}`;

  const fast = await _call({
    messages: [{ role: 'user', content: fastPrompt }],
    feature: AIFeature.MODERATION,
    userId: null,
    model: MODEL_HAIKU,
    maxTokens: 150,
  });

  let fastResult = { verdict: 'approved', confidence: 1.0, borderline: false };
  try { fastResult = _parseJSON(fast.text); } catch { }

  // If borderline or low confidence, escalate to Sonnet with deeper analysis
  if (fastResult.borderline || (fastResult.confidence || 1) < 0.75) {
    const deepPrompt = `You are a senior content moderator for The Gruvs, a South African social event platform. A piece of content has been flagged as borderline by the first moderation pass. Perform a thorough analysis.

CONTENT TYPE: ${type}
CONTENT: "${text.slice(0, 1500)}"
FAST PASS RESULT: ${fastResult.verdict} (confidence: ${fastResult.confidence}, reason: ${fastResult.reason})

SOUTH AFRICAN CONTEXT:
• This is a nightlife/events platform — adult themes are normal and expected
• "18+ event", "alcohol served", "after-party", "explicit music" = NORMAL
• Genuine hate speech is rare but must be caught
• Scam red flags: external payment links, "whatsapp only", too-good prices

Analyse carefully considering SA cultural context. Give a definitive final verdict.

Return ONLY valid JSON:
{
  "verdict": "approved"|"flagged"|"removed",
  "reason": "Specific explanation referencing the actual content",
  "escalate_to_human": true|false
}`;

    const deep = await _callWithThinking({
      messages: [{ role: 'user', content: deepPrompt }],
      feature: AIFeature.MODERATION,
      userId: null,
      thinkingBudget: 3000,
    });

    try {
      const deepResult = _parseJSON(deep.text);
      return { verdict: deepResult.verdict || fastResult.verdict, reason: deepResult.reason || fastResult.reason, escalateToHuman: deepResult.escalate_to_human || false, id: deep.id };
    } catch { }
  }

  return {
    verdict: fastResult.verdict || 'approved',
    reason: fastResult.reason || '',
    id: fast.id,
  };
}

/**
 * Smart re-engagement notification — personalized with full memory context.
 */
export async function smartNotification({ userName = 'Viber', topEvent = null, userId, city = '' } = {}) {
  let memSummary = '';
  let recentInterests = '';
  if (userId) {
    try {
      const [{ data: mem }, { data: recentVibes }] = await Promise.all([
        supabase.from('ai_user_memory').select('summary, preferences').eq('user_id', userId).single(),
        supabase.from('event_vibes').select('events(category)').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
      ]);
      memSummary = mem?.summary || '';
      recentInterests = [...new Set((recentVibes || []).filter(v => v.events?.category).map(v => v.events.category))].join(', ');
    } catch { }
  }

  const temporal = buildTemporalContext();

  const prompt = `Write a hyper-personalised push notification to re-engage a Gruvs Viber who hasn't opened the app in 24+ hours.

USER: ${userName}
${topEvent ? `Top recommended event: "${topEvent.title}" on ${topEvent.event_date} in ${topEvent.city || city}` : `City: ${city || 'South Africa'}`}
LEARNED PREFERENCES: ${memSummary || 'general nightlife fan'}
RECENTLY VIBED: ${recentInterests || 'various categories'}
${temporal}

Rules:
• Make it feel personal, not mass-broadcast
• Create FOMO based on what's actually happening
• Match energy to time of day (morning = anticipatory, evening = urgent, weekend = electric)
• Under 50 chars for title, under 100 for body

Return ONLY valid JSON:
{"title":"title with emoji","body":"action-oriented body text"}`;

  const result = await _call({
    messages: [{ role: 'user', content: prompt }],
    feature: AIFeature.NOTIFICATION,
    userId: null,
    model: MODEL_HAIKU,
    maxTokens: 200,
  });

  try {
    const parsed = _parseJSON(result.text);
    return {
      title: parsed.title || '🔥 Your Gruvs are waiting!',
      body: parsed.body || 'Something hot is happening near you tonight.',
      id: result.id,
    };
  } catch {
    return { title: '🔥 Your Gruvs are waiting!', body: 'Something hot is happening near you tonight.', id: result.id };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//  ADMIN CHAT
// ═════════════════════════════════════════════════════════════════════════════

export async function adminChat(messages, { userId, systemExtra = '' } = {}) {
  const ADMIN_TOOLS = [
    {
      name: 'query_stats',
      description: 'Run analytics queries. Always use this before stating any platform metric.',
      input_schema: {
        type: 'object',
        properties: {
          metric: { type: 'string', description: 'users_today, new_signups, active_users, top_events, churn_risk, event_count, revenue_estimate, engagement_rate' },
          period: { type: 'string', description: 'today, week, month, all_time' },
          city: { type: 'string', description: 'Filter by city (optional)' },
        },
        required: ['metric'],
      },
    },
    {
      name: 'send_notification',
      description: 'Send push notification to a user segment. Confirm count before sending.',
      input_schema: {
        type: 'object',
        properties: {
          segment: { type: 'string', description: 'all, city:CityName, inactive_24h, inactive_7d, top_vibers, new_signups_7d' },
          title: { type: 'string' },
          body: { type: 'string' },
          dry_run: { type: 'boolean', description: 'If true, return count without sending' },
        },
        required: ['segment', 'title', 'body'],
      },
    },
    {
      name: 'feature_event',
      description: 'Feature or unfeature an event. Search for event first if no ID.',
      input_schema: {
        type: 'object',
        properties: {
          event_id: { type: 'string' },
          title: { type: 'string', description: 'Search for event by title if no ID' },
          featured: { type: 'boolean' },
        },
        required: ['featured'],
      },
    },
    {
      name: 'moderate_user',
      description: 'Flag, suspend, or unsuspend a user. Requires username.',
      input_schema: {
        type: 'object',
        properties: {
          username: { type: 'string' },
          action: { type: 'string', description: 'flag, suspend, unsuspend' },
          reason: { type: 'string' },
        },
        required: ['username', 'action'],
      },
    },
    {
      name: 'generate_announcement',
      description: 'Draft and publish an app update announcement to the Upgrades section.',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          type: { type: 'string', description: 'feature, fix, improvement, security' },
          version: { type: 'string' },
        },
        required: ['title', 'description', 'type'],
      },
    },
    {
      name: 'search_events',
      description: 'Search events — useful for finding event IDs to feature or moderate.',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          city: { type: 'string' },
          category: { type: 'string' },
          limit: { type: 'number' },
        },
      },
    },
    {
      name: 'find_vibers',
      description: 'Find users — useful before moderating or targeting segments.',
      input_schema: {
        type: 'object',
        properties: {
          city: { type: 'string' },
          min_score: { type: 'number' },
          limit: { type: 'number' },
        },
      },
    },
    {
      name: 'platform_health_check',
      description: 'Run a platform health audit: verify DB connectivity, event freshness, user activity, churn risk and notification queue status.',
      input_schema: {
        type: 'object',
        properties: {
          include_details: { type: 'boolean', description: 'If true, include a detailed summary of each health area.' },
        },
      },
    },
  ];

  const systemBlocks = [
    { type: 'text', text: ADMIN_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: CORE_REASONING_PROMPT, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: NO_HALLUCINATION_PROMPT, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: buildTemporalContext() },
  ];
  if (systemExtra) systemBlocks.push({ type: 'text', text: systemExtra });

  let history = [...messages];
  const MAX_TURNS = 5;
  let turns = 0;
  let finalText = '';
  let finalId = null;
  let finalToolUse = null;

  try {
    while (turns < MAX_TURNS) {
      const response = await createMessage({
        model: MODEL_SONNET,
        max_tokens: 3000,
        system: systemBlocks,
        messages: history,
        tools: ADMIN_TOOLS,
      });

      if (!finalId) finalId = response.id;
      const hasToolUse = response.content.some(b => b.type === 'tool_use');

      if (response.stop_reason === 'end_turn' || !hasToolUse) {
        finalText = response.content.find(b => b.type === 'text')?.text || '';
        finalToolUse = response.content.find(b => b.type === 'tool_use');
        break;
      }

      // If tool_use and no further loop (caller will handle) — return it
      finalToolUse = response.content.find(b => b.type === 'tool_use');
      if (finalToolUse && turns === 0 && response.stop_reason === 'tool_use') {
        // Return to caller for execution (AdminAIScreen.executeTool pattern)
        return { text: '', toolUse: finalToolUse, id: finalId };
      }

      // Execute tool internally and continue (with per-tool timeout)
      const toolResults = [];
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          let result;
          try {
            result = await withTimeout(
              _executeAdminTool(block.name, block.input),
              TOOL_TIMEOUT_MS,
              `admin-tool:${block.name}`
            );
          } catch (toolErr) {
            result = `Tool error: ${toolErr.message}`;
          }
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
        }
      }

      history.push({ role: 'assistant', content: response.content });
      history.push({ role: 'user', content: toolResults });
      turns++;
    }

    _logInteraction({ userId, feature: AIFeature.ADMIN, input: messages.at(-1)?.content, output: finalText, model: MODEL_SONNET });
    return { text: finalText, toolUse: finalToolUse, id: finalId };
  } catch (e) {
    return { text: null, id: null, error: e?.message };
  }
}

export async function runHealthCheck({ userId } = {}) {
  return adminChat([
    {
      role: 'user',
      content: 'Run a full platform health audit using platform_health_check. Summarise any issues and recommend the top 3 next actions for the owner.',
    }
  ], {
    userId,
    systemExtra: SELF_HEALING_SYSTEM_PROMPT,
  });
}

async function _executeAdminTool(name, input) {
  try {
    const today = new Date().toISOString().split('T')[0];
    switch (name) {
      case 'query_stats': {
        const period = input.period || 'today';
        const since = period === 'all_time' ? '2020-01-01T00:00:00Z'
          : period === 'month' ? new Date(Date.now() - 30 * 86400000).toISOString()
            : period === 'week' ? new Date(Date.now() - 7 * 86400000).toISOString()
              : new Date(Date.now() - 86400000).toISOString();

        const metric = input.metric;
        if (metric === 'users_today' || metric === 'new_signups') {
          const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', since);
          return `New signups (${period}): ${count || 0}`;
        }
        if (metric === 'active_users') {
          const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('last_seen', since);
          return `Active users (${period}): ${count || 0}`;
        }
        if (metric === 'event_count') {
          const { count } = await supabase.from('events').select('id', { count: 'exact', head: true }).gte('created_at', since);
          return `Events created (${period}): ${count || 0}`;
        }
        if (metric === 'top_events') {
          const { data } = await supabase.from('events').select('title, vibe_count, going, city, is_featured').order('trending_score', { ascending: false }).limit(8);
          return `Top events:\n${(data || []).map((e, i) => `${i + 1}. ${e.title} (${e.city}) — ${e.vibe_count || 0} vibes, ${e.going || 0} going${e.is_featured ? ' ⭐' : ''}`).join('\n')}`;
        }
        if (metric === 'churn_risk') {
          const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();
          const { data } = await supabase.from('profiles').select('username, last_seen, vibe_score, city').lt('last_seen', cutoff).order('last_seen', { ascending: true }).limit(10);
          return `Churn-risk users (inactive 7+ days):\n${(data || []).map(u => `- @${u.username} (${u.city || 'SA'}) last seen: ${u.last_seen?.split('T')[0]}, score: ${u.vibe_score || 0}`).join('\n')}`;
        }
        if (metric === 'engagement_rate') {
          const [{ count: total }, { count: active }] = await Promise.all([
            supabase.from('profiles').select('id', { count: 'exact', head: true }),
            supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('last_seen', since),
          ]);
          const rate = total ? Math.round(((active || 0) / total) * 100) : 0;
          return `Engagement rate (${period}): ${rate}% (${active || 0} active out of ${total || 0} total users)`;
        }
        return 'Unknown metric.';
      }
      case 'send_notification': {
        const { segment, title, body, dry_run } = input;
        let q = supabase.from('profiles').select('id', { count: 'exact' }).not('push_token', 'is', null);
        if (segment?.startsWith('city:')) q = q.ilike('city', `%${segment.replace('city:', '')}%`);
        if (segment === 'inactive_24h') q = q.lt('last_seen', new Date(Date.now() - 86400000).toISOString());
        if (segment === 'inactive_7d') q = q.lt('last_seen', new Date(Date.now() - 7 * 86400000).toISOString());
        if (segment === 'top_vibers') q = q.gte('vibe_score', 200);
        if (segment === 'new_signups_7d') q = q.gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString());
        const { data: users, count } = await q.limit(1000);
        if (dry_run) return `DRY RUN: Would send to ${count || 0} users in segment "${segment}".`;
        if (users?.length) {
          const rows = users.map(u => ({ recipient_id: u.id, type: 'admin_broadcast', title, body, data: { segment } }));
          await supabase.from('notifications').insert(rows);
        }
        return `Notification sent to ${users?.length || 0} users (segment: ${segment}).`;
      }
      case 'feature_event': {
        let eventId = input.event_id;
        if (!eventId && input.title) {
          const { data } = await supabase.from('events').select('id, title').ilike('title', `%${input.title}%`).limit(1).single();
          eventId = data?.id;
          if (!eventId) return `Event not found matching "${input.title}".`;
        }
        const { data } = await supabase.from('events').update({ is_featured: input.featured }).eq('id', eventId).select('title').single();
        return `Event "${data?.title || eventId}" is now ${input.featured ? 'FEATURED ⭐' : 'unfeatured'}.`;
      }
      case 'moderate_user': {
        const { data: u } = await supabase.from('profiles').select('id, display_name').eq('username', input.username).single();
        if (!u) return `User @${input.username} not found.`;
        if (input.action === 'flag') {
          await supabase.from('reports').insert({ target_type: 'profile', target_id: u.id, reporter_id: u.id, reason: input.reason || 'Admin flagged', status: 'pending' });
          return `User @${input.username} flagged for review.`;
        }
        if (input.action === 'suspend') {
          await supabase.from('profiles').update({ is_discoverable: false, is_online: false }).eq('id', u.id);
          return `User @${input.username} suspended (hidden from discovery).`;
        }
        if (input.action === 'unsuspend') {
          await supabase.from('profiles').update({ is_discoverable: true }).eq('id', u.id);
          return `User @${input.username} reinstated.`;
        }
        return `Unknown action: ${input.action}`;
      }
      case 'generate_announcement': {
        const { data } = await supabase.from('app_updates').insert({
          title: input.title,
          description: input.description,
          type: input.type,
          version: input.version || `v${today}`,
          released_at: new Date().toISOString(),
        }).select().single();
        return `Announcement published! ID: ${data?.id}. Title: "${input.title}". Live in Upgrades section now.`;
      }
      case 'platform_health_check': {
        const [profileCount, active24h, eventCount, upcomingEventCount, featuredCount, churnCount, unreadNotifications] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('last_seen', new Date(Date.now() - 24 * 86400000).toISOString()),
          supabase.from('events').select('id', { count: 'exact', head: true }),
          supabase.from('events').select('id', { count: 'exact', head: true }).gte('event_date', today),
          supabase.from('events').select('id', { count: 'exact', head: true }).eq('is_featured', true),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).lt('last_seen', new Date(Date.now() - 7 * 86400000).toISOString()),
          supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('read', false),
        ]);

        return `PLATFORM HEALTH AUDIT:
• Total users: ${profileCount?.count || 0}
• Active in last 24h: ${active24h?.count || 0}
• Total events: ${eventCount?.count || 0}
• Upcoming events: ${upcomingEventCount?.count || 0}
• Featured events: ${featuredCount?.count || 0}
• Churn-risk users (inactive 7+ days): ${churnCount?.count || 0}
• Unread notifications pending: ${unreadNotifications?.count || 0}

Interpret these results and recommend the top 3 actions the owner should take if any of these areas look unhealthy.`;
      }
      // Delegate to assistant tools for shared queries
      case 'search_events': return _executeAssistantTool('search_events', input, null);
      case 'find_vibers': return _executeAssistantTool('find_vibers', input, null);
      default: return `Admin tool "${name}" not implemented.`;
    }
  } catch (e) {
    return `Admin tool error: ${e.message}`;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//  FEEDBACK + MEMORY PROPAGATION
// ═════════════════════════════════════════════════════════════════════════════

export async function submitFeedback(interactionId, thumbs) {
  try {
    await supabase.from('ai_interactions')
      .update({ feedback: thumbs })
      .eq('id', interactionId);
  } catch { }
}

/**
 * Call after thumbs up/down to propagate signal into user memory.
 * If user liked (thumbs=1), boost the features/categories in that response.
 * If user disliked (thumbs=-1), note it so daily agent can down-weight.
 */
export async function propagateFeedback(interactionId, thumbs, userId) {
  if (!userId || !interactionId) return;
  try {
    // Mark the interaction
    await supabase.from('ai_interactions').update({ feedback: thumbs }).eq('id', interactionId);

    // Fetch the interaction to understand what was in the response
    const { data: interaction } = await supabase.from('ai_interactions')
      .select('feature, output, input')
      .eq('id', interactionId).single();
    if (!interaction) return;

    // Get existing memory
    const { data: mem } = await supabase.from('ai_user_memory')
      .select('preferences, behaviour, summary')
      .eq('user_id', userId).maybeSingle();

    const prefs = mem?.preferences || {};
    const behaviour = mem?.behaviour || {};

    // Record feedback signal for the daily agent to act on
    const signal = {
      feature: interaction.feature,
      sentiment: thumbs > 0 ? 'positive' : 'negative',
      timestamp: new Date().toISOString(),
    };

    const feedbackHistory = behaviour.feedback_signals || [];
    feedbackHistory.push(signal);
    // Keep last 20 signals
    if (feedbackHistory.length > 20) feedbackHistory.splice(0, feedbackHistory.length - 20);

    await supabase.from('ai_user_memory').upsert({
      user_id: userId,
      preferences: prefs,
      behaviour: { ...behaviour, feedback_signals: feedbackHistory },
      updated_at: new Date().toISOString(),
    });
  } catch { }
}

// ═════════════════════════════════════════════════════════════════════════════
//  PERSONAL EVENT PLANNER — deep profile × calendar × AI narrative
// ═════════════════════════════════════════════════════════════════════════════

/**
 * planPersonalCalendar
 *
 * Generates an AI-narrated personal event plan for a user.
 * Combines the 12-signal deep profile with a live calendar query,
 * then uses Claude to write a personalised, culturally-fluent plan
 * with FOMO hooks for each recommended event.
 *
 * @param {string} userId
 * @param {'week'|'month'|'year'} timeframe
 * @returns {{ plan: string, events: object[], id: string }}
 */
export async function planPersonalCalendar({ userId, timeframe = 'week' } = {}) {
  if (!userId) return { plan: '', events: [], error: 'Not signed in' };

  // Lazy-import to avoid circular dep at module load time
  const { generatePersonalCalendar, computeUserDeepProfile } =
    await import('./personalizationEngine');

  // Ensure deep profile is fresh (non-blocking update)
  computeUserDeepProfile(userId).catch(() => {});

  // Fetch the calendar and the user's deep profile in parallel
  const [calendarEvents, profileRes] = await Promise.allSettled([
    generatePersonalCalendar(userId, timeframe),
    supabase.from('user_deep_profile').select('*').eq('user_id', userId).single(),
  ]);

  const events    = calendarEvents.status === 'fulfilled' ? calendarEvents.value : [];
  const deepProf  = profileRes.status === 'fulfilled' ? profileRes.value.data : null;

  if (!events.length) {
    return {
      plan: "No events found matching your vibe right now. Browse the feed and start RSVPing — the more you engage, the better your plan gets.",
      events: [],
    };
  }

  // Build a compact event list for the prompt
  const eventLines = events.slice(0, 20).map((e, i) =>
    `${i + 1}. ${e.title} | ${e.occurrence_date || e.event_date} | ${e.city || 'SA'} | ${e.category} | ${e.price_min ? 'R' + e.price_min : 'Free'} | ${e._reason || ''} | ${e._source === 'my_rsvp' ? '✅ You RSVPed' : ''}`
  ).join('\n');

  // Build profile summary
  const topCats = deepProf
    ? Object.entries(deepProf.category_vector || {})
        .sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => k).join(', ')
    : 'varied';

  const profileSummary = deepProf ? `
DEEP PROFILE INSIGHTS:
• Top categories: ${topCats}
• Preferred time: ${(deepProf.hour_buckets || []).reduce((best, v, i, arr) => v > arr[best] ? i : best, 0)}:00 SAST
• Busiest day: ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][(deepProf.day_buckets || []).reduce((best, v, i, arr) => v > arr[best] ? i : best, 0)]}
• Usual radius: ${Math.round(deepProf.avg_distance_km || 15)} km
• Price comfort: up to R${deepProf.price_ceiling || 200}
• Style: ${deepProf.social_mode || 'mixed'} crowd
• Cohorts: ${(deepProf.cohort_tags || []).join(', ') || 'general'}
• RSVP follow-through: ${Math.round((deepProf.completion_rate || 0.5) * 100)}%
` : '';

  const timeLabel = timeframe === 'year' ? 'this year' : timeframe === 'month' ? 'this month' : 'this week';

  const prompt = `You are GRUVS AI building a hyper-personalised event plan for a Viber.

${profileSummary}
${buildTemporalContext()}

EVENTS MATCHED TO THIS VIBER (${timeLabel}):
${eventLines}

TASK:
Write a punchy, culturally-fluent event plan that feels like a personal concierge.
• Open with ONE sentence that reads their energy based on the profile.
• Group events by DAY (e.g. "Friday 6 Jun") if multiple on the same day.
• For each event, one line with: event name, why it's perfect for THIS person (reference their actual data — don't be generic), any logistics worth knowing (price, time).
• Use SA voice — warm, direct, with occasional lekker/jol/choon if it fits.
• End with: "Your next move:" — the single highest-priority RSVP they should lock in right now, with one sentence of conviction.
• Under 300 words total.

Return ONLY the plain text plan — no JSON, no headers, no markdown lists.`;

  const result = await _callWithThinking({
    messages: [{ role: 'user', content: prompt }],
    feature: AIFeature.ASSISTANT,
    userId,
    thinkingBudget: 8000,
  });

  const tokens = (result.usage?.input_tokens || 0) + (result.usage?.output_tokens || 0);
  _logInteraction({ userId, feature: 'personal_planner', input: `${timeframe} calendar`, output: result.text, model: MODEL_SONNET, tokensUsed: tokens });

  return { plan: result.text || '', events: events.slice(0, 20), id: result.id };
}

/**
 * analyseRecurringEventAudience
 *
 * After a recurring event is routed, the host can ask who it was sent to
 * and why — this gives them an AI-narrated breakdown of the audience.
 */
export async function analyseRecurringEventAudience({ eventId, eventTitle, userId } = {}) {
  if (!eventId) return { analysis: '', error: 'No event ID' };

  const { data: routes } = await supabase
    .from('event_traffic_routes')
    .select('route_score, cat_score, temporal_score, location_score, route_reason, user_deep_profile!user_id(preferred_cities, cohort_tags)')
    .eq('event_id', eventId)
    .order('route_score', { ascending: false })
    .limit(200);

  if (!routes?.length) return { analysis: 'No audience data yet. Traffic routing will kick in once users build their profiles.', routes: [] };

  // Aggregate cohort distribution
  const cohortCounts = {};
  const cityCounts   = {};
  routes.forEach(r => {
    (r.user_deep_profile?.cohort_tags || []).forEach(t => { cohortCounts[t] = (cohortCounts[t] || 0) + 1; });
    (r.user_deep_profile?.preferred_cities || []).slice(0,1).forEach(c => { cityCounts[c] = (cityCounts[c] || 0) + 1; });
  });

  const topCohorts = Object.entries(cohortCounts).sort((a,b) => b[1]-a[1]).slice(0,5).map(([t,c]) => `${t} (${c})`).join(', ');
  const topCities  = Object.entries(cityCounts).sort((a,b) => b[1]-a[1]).slice(0,4).map(([c,n]) => `${c}: ${n}`).join(', ');
  const avgScore   = routes.reduce((s,r) => s + r.route_score, 0) / routes.length;

  const prompt = `You are GRUVS AI analysing the audience that was routed to a recurring event.

EVENT: "${eventTitle}"
AUDIENCE SIZE: ${routes.length} Vibers targeted
AVERAGE MATCH SCORE: ${(avgScore * 100).toFixed(0)}%
TOP COHORTS: ${topCohorts || 'mixed'}
TOP CITIES: ${topCities || 'SA-wide'}

Routing breakdown (sample reasons):
${routes.slice(0, 5).map(r => `• ${r.route_reason}`).join('\n')}

Write a 3-sentence host briefing:
1. Who was matched and why they're the right crowd.
2. What the ${(avgScore * 100).toFixed(0)}% average match means for conversion potential.
3. One action the host can take to attract even more of this audience.

SA voice. Direct. No fluff.`;

  const result = await _call({
    messages: [{ role: 'user', content: prompt }],
    feature: AIFeature.ASSISTANT,
    userId,
    model: MODEL_SONNET,
    maxTokens: 300,
  });

  return { analysis: result.text || '', routes: routes.slice(0, 10), audienceSize: routes.length, avgMatchScore: avgScore };
}

export default {
  chat, generateBio, fillEvent, vibeCoach, moderateContent,
  smartNotification, adminChat, submitFeedback, propagateFeedback,
  planPersonalCalendar, analyseRecurringEventAudience, AIFeature,
};
