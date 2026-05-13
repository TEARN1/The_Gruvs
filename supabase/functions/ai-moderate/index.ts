/**
 * ai-moderate — Supabase Edge Function (Deno)
 *
 * Webhook called by Supabase Database Webhooks when:
 *   - events INSERT
 *   - echoes INSERT
 *   - profiles UPDATE (bio change)
 *
 * Queues content and runs instant moderation via Claude Haiku.
 *
 * Deploy: supabase functions deploy ai-moderate
 * Wire up: Supabase Dashboard → Database → Webhooks → New webhook
 *   Table: events, Event: INSERT, URL: https://{project}.supabase.co/functions/v1/ai-moderate
 *   Table: echoes, Event: INSERT, URL: same
 */

import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js';

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') || '';
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });
const supabase  = createClient(SUPABASE_URL, SERVICE_KEY);

const MODEL_HAIKU = 'claude-haiku-4-5-20251001';

async function moderate(text: string, type: string): Promise<{ verdict: string; reason: string }> {
  const res = await anthropic.messages.create({
    model:      MODEL_HAIKU,
    max_tokens: 200,
    system: [
      { type: 'text', text: 'You are a content moderator for The Gruvs, a South African social event platform. Return ONLY valid JSON.', cache_control: { type: 'ephemeral' } },
    ],
    messages: [{
      role: 'user',
      content: `Moderate this ${type} content. Normal: party/nightlife/alcohol/adult event language is fine.
Flag/remove: hate speech, slurs, explicit sexual content, violence threats, scams, spam.
CONTENT: "${text?.slice(0, 800)}"
Return: {"verdict":"approved"|"flagged"|"removed","reason":"one sentence"}`,
    }],
  });
  const raw = (res.content[0] as { text: string }).text || '{}';
  try { return JSON.parse(raw); }
  catch { return { verdict: 'approved', reason: 'Parse error — defaulting to approved' }; }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let payload: Record<string, unknown>;
  try { payload = await req.json(); }
  catch { return new Response('Invalid JSON', { status: 400 }); }

  const table  = (payload.table  as string) || '';
  const record = (payload.record as Record<string, unknown>) || {};

  let contentType = table === 'echoes' ? 'echo' : table === 'events' ? 'event' : 'profile';
  let contentText = '';
  let contentId   = String(record.id || '');
  let authorId    = String(record.user_id || record.author_id || '');

  if (table === 'events') {
    contentText = [record.title, record.description].filter(Boolean).join(' — ');
  } else if (table === 'echoes') {
    contentText = String(record.body || '');
  } else if (table === 'profiles') {
    contentText = [record.bio, record.career_description, record.looks_description].filter(Boolean).join(' | ');
    contentId   = String(record.id || '');
    authorId    = String(record.id || '');
  }

  if (!contentText.trim()) {
    return new Response(JSON.stringify({ ok: true, skipped: 'empty content' }), { status: 200 });
  }

  // Insert into queue
  const { data: queued } = await supabase.from('ai_moderation_queue').insert({
    content_type: contentType,
    content_id:   contentId,
    content_text: contentText,
    author_id:    authorId || null,
    status:       'pending',
  }).select().single();

  // Run moderation immediately
  const { verdict, reason } = await moderate(contentText, contentType);

  // Update queue record
  await supabase.from('ai_moderation_queue').update({
    status:      verdict === 'approved' ? 'approved' : verdict,
    ai_verdict:  verdict,
    ai_reason:   reason,
    reviewed_at: new Date().toISOString(),
  }).eq('id', queued?.id);

  // Take action
  if (verdict === 'removed') {
    if (table === 'events')  await supabase.from('events').update({ is_cancelled: true, is_featured: false }).eq('id', contentId);
    if (table === 'echoes')  await supabase.from('echoes').delete().eq('id', contentId);
  } else if (verdict === 'flagged') {
    if (table === 'events')  await supabase.from('events').update({ is_featured: false }).eq('id', contentId);
  }

  // Notify admin for flagged/removed content
  if (verdict !== 'approved') {
    await supabase.from('notifications').insert({
      recipient_id: authorId || null,
      type:         'ai_moderation',
      title:        verdict === 'removed' ? 'Content removed' : 'Content flagged for review',
      body:         reason,
      data:         { content_type: contentType, content_id: contentId, verdict },
    });
  }

  return new Response(JSON.stringify({ ok: true, verdict, reason }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
