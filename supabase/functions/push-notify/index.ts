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
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')              || '';
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Web Push (VAPID) — closed-tab browser push for thegruvs.com / the PWA.
// Public key mirrors src/constants/webPush.js; private key is a function secret.
const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY')  || 'BFcGNc-yn3m7MgqI1y2e4uAfywbTL3pnkP6CtPTOBz247ddaL2MVZqUe_zBoybkaiiCeRa8uifTnc2zZfJ1VLZU';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT')     || 'mailto:asemahlenkwali@gmail.com';
if (VAPID_PRIVATE) {
  try { webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE); } catch (e) {
    console.error('[push-notify] bad VAPID config:', e);
  }
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

/**
 * Deliver Web Push to every browser subscription the recipient has.
 * Best-effort: dead endpoints (404/410) are pruned; failures never block Expo.
 */
async function sendWebPush(notif: NotificationRow): Promise<number> {
  if (!VAPID_PRIVATE) return 0; // secret not set yet — web push disabled
  const { data: subs } = await supabase
    .from('web_push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', notif.recipient_id)
    .limit(10);
  if (!subs?.length) return 0;

  const payload = JSON.stringify({
    title: notif.title,
    body: notif.body || '',
    data: {
      type: notif.type,
      notificationId: notif.id,
      eventId: notif.event_id || undefined,
      actorId: notif.actor_id || undefined,
      ...(notif.data || {}),
    },
  });

  let delivered = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
        { TTL: 3600 },
      );
      delivered++;
    } catch (err: unknown) {
      const code = (err as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) {
        // Browser revoked / uninstalled — prune the dead subscription.
        await supabase.from('web_push_subscriptions').delete().eq('endpoint', s.endpoint);
      } else {
        console.warn('[push-notify] web push failed:', code, (err as Error)?.message);
      }
    }
  }));
  return delivered;
}

// Expo push priority by notification type
const PRIORITY: Record<string, 'high' | 'normal' | 'default'> = {
  call:        'high', // a call rings out in ~35s — this has to land immediately
  beacon:      'high', // "I'm out — pull up" is only useful RIGHT NOW
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

  // Only the DB webhook (which holds the service_role key) may trigger pushes.
  // Without this, anyone reaching the URL could push arbitrary notifications to
  // any user. Deploy with `--no-verify-jwt` so this header check is the gate.
  const authHeader = req.headers.get('Authorization');
  if (!SERVICE_KEY || authHeader !== `Bearer ${SERVICE_KEY}`) {
    return new Response('Unauthorized', { status: 401 });
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

  // Web Push first — a web-only user has NO Expo token, so this must run
  // regardless of the Expo path below. Never throws.
  const webDelivered = await sendWebPush(notif).catch(() => 0);

  // Look up recipient's push token (native / Expo path)
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('push_token')
    .eq('id', notif.recipient_id)
    .maybeSingle();

  if (error || !profile?.push_token) {
    // No Expo token — web push (if any) already delivered above.
    return new Response(JSON.stringify({ ok: true, web: webDelivered, expo: false }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
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
