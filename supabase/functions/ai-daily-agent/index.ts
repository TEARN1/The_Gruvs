/**
 * ai-daily-agent — Supabase Edge Function (Deno)
 *
 * Runs daily at 04:00 UTC (06:00 SAST) via pg_cron.
 * Performs:
 *   1. Update ai_user_memory for every active user
 *   2. Refresh ai_recommendations_cache per user
 *   3. Send smart re-engagement notifications to inactive users
 *   4. Process ai_moderation_queue
 *   5. Learn from interaction feedback
 *
 * Deploy: supabase functions deploy ai-daily-agent
 * Schedule: See supabase/schedule_ai_agent.sql
 */

import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js';

const ANTHROPIC_KEY  = Deno.env.get('ANTHROPIC_API_KEY')  || '';
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')        || '';
const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const MODEL_HAIKU  = 'claude-haiku-4-5-20251001';
const MODEL_SONNET = 'claude-sonnet-4-6';

const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });
const supabase  = createClient(SUPABASE_URL, SERVICE_KEY);

// ── Helpers ──────────────────────────────────────────────────────────────────
async function askClaude(prompt: string, model = MODEL_HAIKU): Promise<string> {
  const res = await anthropic.messages.create({
    model,
    max_tokens: 512,
    system: [
      { type: 'text', text: 'You are the AI brain of The Gruvs — a South African social event platform. Return ONLY valid JSON when asked. Be concise.', cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: prompt }],
  });
  return (res.content[0] as { text: string }).text || '';
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ── Step 1: Update user memory ───────────────────────────────────────────────
async function updateUserMemory(userId: string, profile: Record<string, unknown>) {
  // Pull last 30 RSVPs, vibes, saves
  const [{ data: rsvps }, { data: vibes }, { data: saves }] = await Promise.all([
    supabase.from('event_rsvps').select('event_id, status').eq('user_id', userId).order('created_at', { ascending: false }).limit(30),
    supabase.from('event_vibes').select('event_id').eq('user_id', userId).order('created_at', { ascending: false }).limit(30),
    supabase.from('saved_events').select('event_id').eq('user_id', userId).order('created_at', { ascending: false }).limit(30),
  ]);

  const prompt = `Summarise this Viber's preferences from their activity for use in future recommendations.

PROFILE: interests=[${(profile.interests as string[] || []).join(', ')}], city=${profile.city}, vibe_score=${profile.vibe_score}
RECENT RSVPs: ${rsvps?.length || 0} events (status breakdown: going=${rsvps?.filter(r => r.status === 'going').length || 0})
VIBES GIVEN: ${vibes?.length || 0}
SAVED EVENTS: ${saves?.length || 0}

Return JSON:
{
  "summary": "2-sentence plain English summary of this user's event preferences and engagement style",
  "preferences": { "categories": ["top 3 categories they likely enjoy"], "time_preference": "daytime|evening|night|mixed", "price_sensitivity": "free|budget|any" },
  "behaviour": { "avg_rsvp_rate": 0.0, "engagement_level": "low|medium|high", "churn_risk": "low|medium|high" }
}`;

  const raw = await askClaude(prompt);
  try {
    const parsed = JSON.parse(raw);
    await supabase.from('ai_user_memory').upsert({
      user_id:     userId,
      summary:     parsed.summary || '',
      preferences: parsed.preferences || {},
      behaviour:   parsed.behaviour || {},
      updated_at:  new Date().toISOString(),
    });
  } catch { /* skip malformed */ }
}

// ── Step 2: Refresh recommendations ──────────────────────────────────────────
async function refreshRecommendations(userId: string, memory: Record<string, unknown>) {
  // Pull top 50 upcoming events
  const { data: events } = await supabase
    .from('events')
    .select('id, title, city, category, event_date, trending_score, price_min')
    .gte('event_date', new Date().toISOString().split('T')[0])
    .eq('is_cancelled', false)
    .order('trending_score', { ascending: false })
    .limit(50);

  if (!events?.length) return;

  const summary = (memory as { summary?: string }).summary || 'No preference data yet.';
  const prefs   = JSON.stringify((memory as { preferences?: unknown }).preferences || {});

  const prompt = `Pick the 10 best events for this user from the list below.

USER PREFERENCES: ${summary}
PREFERENCE DETAILS: ${prefs}

EVENTS (id|title|city|category|date|trending_score|price_min):
${events.map(e => `${e.id}|${e.title}|${e.city}|${e.category}|${e.event_date}|${e.trending_score}|${e.price_min ?? 'free'}`).join('\n')}

Return JSON:
{
  "event_ids": ["uuid1", "uuid2", ...up to 10],
  "reasoning": "One sentence explaining the selection logic"
}`;

  const raw = await askClaude(prompt);
  try {
    const parsed = JSON.parse(raw);
    await supabase.from('ai_recommendations_cache').upsert({
      user_id:      userId,
      event_ids:    parsed.event_ids || [],
      reasoning:    parsed.reasoning || '',
      generated_at: new Date().toISOString(),
    });
  } catch {}
}

// ── Step 3: Smart re-engagement notifications ─────────────────────────────────
async function sendReengagementNotifications() {
  const cutoff = new Date(Date.now() - 24 * 3600000).toISOString();
  const { data: inactive } = await supabase
    .from('profiles')
    .select('id, display_name, username, city')
    .lt('last_seen', cutoff)
    .eq('is_online', false)
    .limit(200);

  if (!inactive?.length) return;

  for (const user of inactive) {
    // Get their top recommended event
    const { data: cache } = await supabase
      .from('ai_recommendations_cache')
      .select('event_ids')
      .eq('user_id', user.id)
      .single();

    let topEvent = null;
    if (cache?.event_ids?.[0]) {
      const { data: ev } = await supabase.from('events').select('title, city, event_date').eq('id', cache.event_ids[0]).single();
      topEvent = ev;
    }

    const prompt = `Write a short push notification to re-engage ${user.display_name || user.username || 'a Viber'}.
${topEvent ? `Top recommended event: "${topEvent.title}" on ${topEvent.event_date} in ${topEvent.city}` : 'No specific event.'}
Return JSON: {"title": "max 50 chars with emoji", "body": "max 100 chars, action-oriented"}`;

    const raw = await askClaude(prompt);
    try {
      const { title, body } = JSON.parse(raw);
      await supabase.from('notifications').insert({
        recipient_id: user.id,
        type:         'ai_digest',
        title:        title || '🔥 Your Gruvs are waiting!',
        body:         body  || 'See what\'s happening near you tonight.',
        data:         { ai_generated: true },
      });
    } catch {}

    await sleep(200); // avoid rate limits
  }
}

// ── Step 4: Process moderation queue ─────────────────────────────────────────
async function processModeration() {
  const { data: pending } = await supabase
    .from('ai_moderation_queue')
    .select('*')
    .eq('status', 'pending')
    .limit(50);

  if (!pending?.length) return;

  for (const item of pending) {
    const prompt = `Moderate this ${item.content_type} content for a South African social event platform.
CONTENT: "${item.content_text}"
Rules: Flag/remove hate speech, slurs, explicit sexual content, violence threats, scams.
Normal: Party content, nightlife, alcohol references, adult event language (18+/21+) is fine.
Return JSON: {"verdict": "approved"|"flagged"|"removed", "reason": "one sentence"}`;

    const raw = await askClaude(prompt);
    try {
      const { verdict, reason } = JSON.parse(raw);
      await supabase.from('ai_moderation_queue').update({
        status:      verdict === 'approved' ? 'approved' : verdict,
        ai_verdict:  verdict,
        ai_reason:   reason,
        reviewed_at: new Date().toISOString(),
      }).eq('id', item.id);

      if (verdict === 'removed' && item.content_type === 'event') {
        await supabase.from('events').update({ is_cancelled: true }).eq('id', item.content_id);
      }
    } catch {}

    await sleep(300);
  }
}

// ── Step 5: Learn from feedback ───────────────────────────────────────────────
async function learnFromFeedback() {
  const since = new Date(Date.now() - 24 * 3600000).toISOString();
  const { data: feedback } = await supabase
    .from('ai_interactions')
    .select('feature, feedback, output')
    .not('feedback', 'is', null)
    .gte('created_at', since);

  if (!feedback?.length) return;

  const thumbsUp   = feedback.filter(f => f.feedback === 1).length;
  const thumbsDown = feedback.filter(f => f.feedback === -1).length;
  const total      = feedback.length;

  // Store aggregate learning stats (could be used to tune prompts over time)
  await supabase.from('ai_moderation_queue').insert({
    content_type: 'system_log',
    content_id:   '00000000-0000-0000-0000-000000000000',
    content_text: `Daily feedback: ${thumbsUp}/${total} positive, ${thumbsDown}/${total} negative`,
    status:       'approved',
    ai_verdict:   'system',
    ai_reason:    `Satisfaction rate: ${total > 0 ? Math.round((thumbsUp / total) * 100) : 0}%`,
  }).select();
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.includes(SERVICE_KEY.slice(0, 10))) {
    return new Response('Unauthorized', { status: 401 });
  }

  console.log('[ai-daily-agent] Starting daily run...');

  try {
    // Get all active users (active in past 7 days), process in batches of 50
    const { data: users } = await supabase
      .from('profiles')
      .select('id, display_name, username, city, vibe_score, interests')
      .gte('last_seen', new Date(Date.now() - 7 * 86400000).toISOString())
      .limit(500);

    if (users?.length) {
      const batches = [];
      for (let i = 0; i < users.length; i += 50) batches.push(users.slice(i, i + 50));

      for (const batch of batches) {
        await Promise.all(batch.map(async (user) => {
          try {
            await updateUserMemory(user.id, user);
            const { data: mem } = await supabase.from('ai_user_memory').select('*').eq('user_id', user.id).single();
            await refreshRecommendations(user.id, mem || {});
          } catch (e) {
            console.warn(`[ai-daily-agent] Failed for user ${user.id}:`, e);
          }
        }));
        await sleep(1000); // 1s between batches
      }
    }

    await sendReengagementNotifications();
    await processModeration();
    await learnFromFeedback();

    console.log('[ai-daily-agent] Complete.');
    return new Response(JSON.stringify({ ok: true, users: users?.length || 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[ai-daily-agent] Fatal error:', e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
