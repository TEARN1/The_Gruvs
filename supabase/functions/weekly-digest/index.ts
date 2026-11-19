/**
 * weekly-digest — Supabase Edge Function (Deno)
 *
 * Dispatches personalized weekly 2-week upcoming event email digests to all users,
 * starting with events closest to each user's home area/coordinates.
 *
 * Invocation:
 *   POST https://<project>.supabase.co/functions/v1/weekly-digest
 *   Headers: Authorization: Bearer <CRON_SECRET | SUPABASE_SERVICE_ROLE_KEY>
 *
 * Wire to pg_cron:
 *   select cron.schedule(
 *     'weekly-email-digest',
 *     '0 7 * * 4', -- Every Thursday at 07:00 UTC (09:00 SAST)
 *     $$
 *     select net.http_post(
 *       url := 'https://feevvddvrjmfbhffccbf.supabase.co/functions/v1/weekly-digest',
 *       headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret'))
 *     );
 *     $$
 *   );
 */

import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const CRON_SECRET = Deno.env.get('CRON_SECRET') || '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY') || '';
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'The Gruvs <vibes@thegruvs.com>';
const APP_URL = Deno.env.get('APP_URL') || 'https://thegruvs.com';

const HAVERSINE_R = 6371;

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number | null {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(HAVERSINE_R * c * 10) / 10;
}

function rankEvents(user: any, events: any[]): any[] {
  const uLat = user.home_base_lat;
  const uLon = user.home_base_lon;
  const hasCoords = uLat != null && uLon != null;
  const area = (user.home_area || '').toLowerCase();

  const scored = events.map((e) => {
    const eLat = e.lat ?? e.latitude;
    const eLon = e.lon ?? e.longitude;
    const dist = hasCoords && eLat != null && eLon != null
      ? haversineDistanceKm(uLat, uLon, Number(eLat), Number(eLon))
      : null;

    let areaMatch = false;
    if (area && area.length >= 3) {
      const city = (e.city || '').toLowerCase();
      const loc = (e.location || '').toLowerCase();
      const ven = (e.venue_name || '').toLowerCase();
      areaMatch = city.includes(area) || loc.includes(area) || ven.includes(area);
    }

    return { ...e, distance_km: dist, _areaMatch: areaMatch };
  });

  scored.sort((a, b) => {
    if (a.distance_km != null && b.distance_km != null) {
      if (Math.abs(a.distance_km - b.distance_km) > 3) return a.distance_km - b.distance_km;
      return (a.event_date || '').localeCompare(b.event_date || '');
    }
    if (a.distance_km != null) return -1;
    if (b.distance_km != null) return 1;
    if (a._areaMatch && !b._areaMatch) return -1;
    if (!a._areaMatch && b._areaMatch) return 1;
    return (a.event_date || '').localeCompare(b.event_date || '');
  });

  return scored.slice(0, 6);
}

function renderHtml(user: any, events: any[]): string {
  const name = user.display_name || user.username || 'Gruver';
  const unsubscribeUrl = `${APP_URL}/unsubscribe?token=${user.unsubscribe_token || user.id}`;

  const cardsHtml = events.map((e) => {
    const cat = (e.category || 'music').toUpperCase();
    const distBadge = e.distance_km != null
      ? `<span style="background: rgba(0, 242, 254, 0.15); color: #00f2fe; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700;">📍 ${e.distance_km} km away</span>`
      : `<span style="background: rgba(255, 255, 255, 0.08); color: #94a3b8; padding: 3px 8px; border-radius: 6px; font-size: 11px;">📍 ${e.city || 'Johannesburg'}</span>`;
    const eventUrl = `${APP_URL}/events/${e.slug || e.id}`;
    const imgUrl = e.image_url || e.cover_url || (e.media_urls && e.media_urls[0]) || `${APP_URL}/assets/events/pixel.jpg`;

    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #12181f; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.08); margin-bottom: 24px; overflow: hidden;">
        <tr>
          <td>
            <a href="${eventUrl}" target="_blank" style="text-decoration: none;">
              <img src="${imgUrl}" alt="${e.title}" width="100%" style="width: 100%; max-height: 200px; object-fit: cover; display: block; background-color: #0d1114;" />
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding: 18px 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 10px;">
              <tr>
                <td align="left"><span style="background-color: rgba(0, 242, 254, 0.12); color: #00f2fe; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 6px;">${cat}</span></td>
                <td align="right">${distBadge}</td>
              </tr>
            </table>
            <h3 style="margin: 0 0 6px 0; color: #ffffff; font-size: 17px; font-weight: 800;">
              <a href="${eventUrl}" target="_blank" style="color: #ffffff; text-decoration: none;">${e.title}</a>
            </h3>
            <p style="margin: 0 0 14px 0; color: #94a3b8; font-size: 13px;">
              🗓️ ${e.event_date}${e.event_time ? ' · ' + e.event_time.slice(0, 5) : ''}<br/>
              🏛️ ${e.venue_name || e.location || 'Gauteng'}
            </p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px;">
              <tr>
                <td align="left"><span style="font-size: 14px; font-weight: 800; color: #10b981;">${e.price ? 'R' + e.price : 'Free RSVP'}</span></td>
                <td align="right">
                  <a href="${eventUrl}" target="_blank" style="display: inline-block; background: #00f2fe; color: #0a0e12; font-size: 12px; font-weight: 800; padding: 8px 16px; border-radius: 8px; text-decoration: none; text-transform: uppercase;">Lock It In &rarr;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #070a0d; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #070a0d; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="580" cellpadding="0" cellspacing="0" style="max-width: 580px; width: 100%;">
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <div style="font-size: 24px; font-weight: 900; letter-spacing: 2px; color: #00f2fe;">THE GRUVS</div>
              <div style="font-size: 11px; letter-spacing: 2px; color: #64748b; font-weight: 700; margin-top: 4px;">LIVE WHERE THE VIBE LIVES</div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #0f141a; border-radius: 18px; border: 1px solid rgba(0, 242, 254, 0.25); padding: 24px; margin-bottom: 24px;">
              <span style="background-color: rgba(0, 242, 254, 0.12); color: #00f2fe; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 8px;">⚡ 2-WEEK VIBE RADAR</span>
              <h1 style="margin: 12px 0 8px 0; color: #ffffff; font-size: 22px; font-weight: 900;">Don't get bored, ${name}. Here's what's near you.</h1>
              <p style="margin: 0; color: #94a3b8; font-size: 14px; line-height: 1.5;">Top gruvs and experiences happening over the next 14 days, starting with the ones closest to your area.</p>
            </td>
          </tr>
          <tr><td height="20"></td></tr>
          <tr><td>${cardsHtml}</td></tr>
          <tr>
            <td align="center" style="padding: 16px 0 28px 0;">
              <a href="${APP_URL}" target="_blank" style="display: inline-block; background: #00f2fe; color: #070a0d; font-size: 13px; font-weight: 900; padding: 12px 24px; border-radius: 10px; text-decoration: none; text-transform: uppercase;">Explore The Drop & Live Map &rarr;</a>
            </td>
          </tr>
          <tr>
            <td align="center" style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 20px; color: #64748b; font-size: 11px; line-height: 1.6;">
              <p>You received this because you're a member of The Gruvs. <a href="${unsubscribeUrl}" style="color: #64748b; text-decoration: underline;">Unsubscribe</a></p>
              <p>&copy; ${new Date().getFullYear()} The Gruvs &bull; Johannesburg, South Africa</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendEmail(to: string, subject: string, html: string) {
  if (RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
    });
    return res.ok;
  }
  if (SENDGRID_API_KEY) {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: EMAIL_FROM },
        subject,
        content: [{ type: 'text/html', value: html }],
      }),
    });
    return res.ok;
  }
  console.log(`[weekly-digest] (No email provider configured) Mock send to ${to}`);
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Authorization check
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const isAuthorized = (CRON_SECRET && token === CRON_SECRET) || (SERVICE_KEY && token === SERVICE_KEY);
  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // 1. Fetch 14-day upcoming events
  const today = new Date();
  const twoWeeksLater = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
  const todayStr = today.toISOString().split('T')[0];
  const maxStr = twoWeeksLater.toISOString().split('T')[0];

  const { data: events, error: evErr } = await supabase
    .from('events')
    .select('id, title, venue_name, location, address, city, event_date, event_time, lat, lon, latitude, longitude, image_url, cover_url, media_urls, category, price, slug')
    .gte('event_date', todayStr)
    .lte('event_date', maxStr)
    .is('deleted_at', null)
    .order('event_date', { ascending: true });

  if (evErr || !events || events.length === 0) {
    return new Response(JSON.stringify({ message: 'No upcoming events found', count: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Fetch recipients
  const { data: users, error: uErr } = await supabase.rpc('get_weekly_digest_recipients', { p_limit: 2000 });
  if (uErr || !users || users.length === 0) {
    return new Response(JSON.stringify({ message: 'No eligible recipients due', count: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let dispatched = 0;
  const deliveredIds: string[] = [];

  for (const user of users) {
    if (!user.email) continue;
    const userEvents = rankEvents(user, events);
    const closest = userEvents[0];
    const subject = closest
      ? `🔥 Weekend Horizon: ${closest.title} + ${userEvents.length - 1} gruvs near you`
      : "⚡ Don't get bored: Your 2-week Gruvs horizon";
    const html = renderHtml(user, userEvents);

    const ok = await sendEmail(user.email, subject, html);
    if (ok) {
      dispatched++;
      deliveredIds.push(user.id);
    }
  }

  // Stamp delivery
  if (deliveredIds.length > 0) {
    await supabase.rpc('record_digest_sent', { p_user_ids: deliveredIds });
  }

  return new Response(
    JSON.stringify({
      success: true,
      eventsFound: events.length,
      recipients: users.length,
      dispatched,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});
