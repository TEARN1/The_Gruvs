/**
 * push-notify — Supabase Edge Function (Deno)
 *
 * Triggered by a DB webhook on every INSERT into the `notifications` table.
 * Looks up the recipient's push_token from `profiles`, then calls the Expo
 * Push API to deliver the notification to their device.
 *
 * This runs server-side so push delivery is guaranteed regardless of whether
 * the sender's client device is online.
 *
 * Deploy: supabase functions deploy push-notify
 * Wire:   Supabase Dashboard → Database → Webhooks → New webhook
 *           Table: notifications, Event: INSERT
 *           URL: https://{project}.supabase.co/functions/v1/push-notify
 *           HTTP Headers: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 */

import { createClient } from 'npm:@supabase/supabase-js';

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')              || '';
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Expo push priority by notification type
const PRIORITY: Record<string, 'high' | 'normal' | 'default'> = {
  message:     'high',
  echo:        'high',
  vibe:        'normal',
  rsvp:        'normal',
  follow:      'normal',
  event_day:   'high',
  royal:       'normal',
  check_in:    'high',
  profile_view:'default',
};

// Sound by type
const SOUND: Record<string, string | undefined> = {
  message:     'default',
  echo:        'default',
  event_day:   'default',
  check_in:    'default',
};

interface NotificationRow {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  actor_id: string | null;
  event_id: string | null;
  read: boolean;
  created_at: string;
}

interface WebhookPayload {
  type: 'INSERT';
  table: string;
  record: NotificationRow;
  schema: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  // Supabase webhooks hit with POST
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  const notif = payload?.record;
  if (!notif?.recipient_id) {
    return new Response('No recipient', { status: 200 });
  }

  // Look up recipient's push token
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('push_token')
    .eq('id', notif.recipient_id)
    .maybeSingle();

  if (error || !profile?.push_token) {
    // No token registered — in-app notification already written, nothing more to do
    return new Response('No push token', { status: 200 });
  }

  const token: string = profile.push_token;
  if (!token.startsWith('ExponentPushToken')) {
    return new Response('Invalid token format', { status: 200 });
  }

  const type = notif.type || 'vibe';
  const priority = PRIORITY[type] || 'default';
  const sound = SOUND[type] ?? 'default';

  const message = {
    to:         token,
    title:      notif.title,
    body:       notif.body || '',
    sound,
    priority,
    data: {
      type,
      notificationId: notif.id,
      eventId:        notif.event_id   || undefined,
      actorId:        notif.actor_id   || undefined,
      ...(notif.data || {}),
    },
    // Show quick-reply text input for message notifications
    categoryId: type === 'message' ? 'message_reply' : undefined,
    // Badge count — Expo handles incrementing on iOS
    badge: 1,
  };

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept:         'application/json',
        // Expo enhanced push receipts require this header
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(message),
    });

    const json = await res.json();

    // Log push receipt errors back to notifications table for diagnostics
    const ticket = json?.data;
    if (ticket?.status === 'error') {
      // Non-fatal — just mark in the notifications row
      await supabase
        .from('notifications')
        .update({ push_error: ticket.message ?? 'push_error' })
        .eq('id', notif.id);
    }

    return new Response(JSON.stringify({ ok: true, ticket }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[push-notify] Expo API error:', err);
    return new Response('Push delivery failed', { status: 500 });
  }
});
