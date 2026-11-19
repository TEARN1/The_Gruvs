/**
 * Responsive HTML Email Template for The Gruvs Weekly 2-Week Event Digest
 *
 * Designed to render beautifully across Apple Mail, Gmail (Web, iOS, Android),
 * Outlook, and modern mobile clients with full dark mode support.
 */

const CATEGORY_COLORS = {
  music: '#00f2fe',
  nightlife: '#a855f7',
  'food & markets': '#f59e0b',
  food: '#f59e0b',
  culture: '#ec4899',
  'sport & fitness': '#10b981',
  sports: '#10b981',
  community: '#3b82f6',
  networking: '#06b6d4',
  default: '#00f2fe',
};

function formatEventDate(dateStr, timeStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + (timeStr ? `T${timeStr}` : 'T00:00:00'));
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    const datePart = d.toLocaleDateString('en-ZA', options);
    return timeStr ? `${datePart} · ${timeStr.slice(0, 5)}` : datePart;
  } catch {
    return dateStr;
  }
}

function optimizeImageUrl(url) {
  if (!url) return 'https://thegruvs.com/assets/events/pixel.jpg';
  // Use weserv proxy for fast, lightweight WebP/JPEG delivery in email clients
  const clean = url.trim();
  if (/^https?:\/\/images\.weserv\.nl/i.test(clean)) return clean;
  return `https://images.weserv.nl/?url=${encodeURIComponent(clean.replace(/^https?:\/\//, ''))}&w=600&h=300&fit=cover&q=75&output=jpg`;
}

export function renderWeeklyDigestHtml({
  user = {},
  events = [],
  appUrl = 'https://thegruvs.com',
  unsubscribeUrl = 'https://thegruvs.com/unsubscribe',
}) {
  const name = user.display_name || user.username || 'Gruver';
  const hasEvents = events && events.length > 0;
  const closestEvent = hasEvents ? events[0] : null;

  const eventCardsHtml = events.map((event, idx) => {
    const cat = (event.category || 'music').toLowerCase();
    const catColor = CATEGORY_COLORS[cat] || CATEGORY_COLORS.default;
    const catLabel = (event.category || 'Event').toUpperCase();
    const dateFormatted = formatEventDate(event.event_date, event.event_time);
    const imgUrl = optimizeImageUrl(event.image_url || event.cover_url || (event.media_urls && event.media_urls[0]));
    const eventUrl = `${appUrl}/events/${event.slug || event.id}`;
    
    // Distance badge text
    let distanceBadge = '';
    if (typeof event.distance_km === 'number' && Number.isFinite(event.distance_km)) {
      if (event.distance_km < 1) {
        distanceBadge = `<span style="background: rgba(0, 242, 254, 0.15); color: #00f2fe; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; border: 1px solid rgba(0, 242, 254, 0.3);">📍 Under 1 km away</span>`;
      } else {
        distanceBadge = `<span style="background: rgba(0, 242, 254, 0.15); color: #00f2fe; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; border: 1px solid rgba(0, 242, 254, 0.3);">📍 ${event.distance_km.toFixed(1)} km from your area</span>`;
      }
    } else if (event.suburb || event.city) {
      distanceBadge = `<span style="background: rgba(255, 255, 255, 0.08); color: #94a3b8; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 600;">📍 ${[event.suburb, event.city].filter(Boolean).join(', ')}</span>`;
    }

    const priceText = event.price ? (typeof event.price === 'number' ? `R${event.price}` : event.price) : 'Free RSVP';

    return `
      <!-- Event Card ${idx + 1} -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #12181f; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.08); margin-bottom: 24px; overflow: hidden;">
        <tr>
          <td>
            <!-- Event Image -->
            <a href="${eventUrl}" target="_blank" style="text-decoration: none; display: block;">
              <img src="${imgUrl}" alt="${event.title || 'Event'}" width="100%" style="width: 100%; max-height: 220px; object-fit: cover; display: block; border-top-left-radius: 16px; border-top-right-radius: 16px; background-color: #0d1114;" />
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 22px;">
            <!-- Category and Distance Pill -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 12px;">
              <tr>
                <td align="left">
                  <span style="display: inline-block; background-color: ${catColor}22; color: ${catColor}; font-size: 10px; font-weight: 800; letter-spacing: 0.8px; padding: 3px 9px; border-radius: 6px; border: 1px solid ${catColor}55;">
                    ${catLabel}
                  </span>
                </td>
                <td align="right">
                  ${distanceBadge}
                </td>
              </tr>
            </table>

            <!-- Title -->
            <h3 style="margin: 0 0 8px 0; color: #ffffff; font-size: 18px; font-weight: 800; line-height: 1.3;">
              <a href="${eventUrl}" target="_blank" style="color: #ffffff; text-decoration: none;">
                ${event.title || 'Upcoming Event'}
              </a>
            </h3>

            <!-- Date & Venue Details -->
            <p style="margin: 0 0 16px 0; color: #94a3b8; font-size: 13px; line-height: 1.5;">
              🗓️ <strong style="color: #e2e8f0;">${dateFormatted}</strong>
              <br/>
              🏛️ ${event.venue_name || event.location || 'Johannesburg'}
            </p>

            <!-- Bottom CTA Row -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 14px;">
              <tr>
                <td align="left" style="vertical-align: middle;">
                  <span style="font-size: 14px; font-weight: 800; color: #10b981;">
                    ${priceText}
                  </span>
                </td>
                <td align="right" style="vertical-align: middle;">
                  <a href="${eventUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #00f2fe 0%, #00b4d8 100%); color: #0a0e12; font-size: 12px; font-weight: 800; letter-spacing: 0.5px; padding: 9px 18px; border-radius: 10px; text-decoration: none; text-transform: uppercase;">
                    Lock It In &rarr;
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Your 2-Week Gruvs Radar</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; background-color: #070a0d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    @media only screen and (max-width: 600px) {
      .container-table { width: 100% !important; }
      .mobile-pad { padding-left: 16px !important; padding-right: 16px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #070a0d; color: #ffffff;">
  <!-- Preview Text -->
  <div style="display: none; font-size: 1px; color: #070a0d; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${hasEvents ? `🔥 ${events.length} events coming up in the next 14 days, starting with ${closestEvent?.title || 'top gruvs'} near you.` : 'Stay locked into the hottest upcoming gruvs near you.'}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #070a0d;">
    <tr>
      <td align="center" style="padding: 24px 12px;">
        <!-- Main Container (600px max) -->
        <table role="presentation" class="container-table" width="580" cellpadding="0" cellspacing="0" style="max-width: 580px; width: 100%;">
          
          <!-- Logo & Header -->
          <tr>
            <td align="center" style="padding: 16px 0 28px 0;">
              <a href="${appUrl}" target="_blank" style="text-decoration: none;">
                <div style="font-size: 24px; font-weight: 900; letter-spacing: 2px; color: #00f2fe; text-transform: uppercase;">
                  THE GRUVS
                </div>
                <div style="font-size: 11px; letter-spacing: 3px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-top: 4px;">
                  LIVE WHERE THE VIBE LIVES
                </div>
              </a>
            </td>
          </tr>

          <!-- Hero Greeting Capsule -->
          <tr>
            <td style="background-color: #0f141a; border-radius: 20px; border: 1px solid rgba(0, 242, 254, 0.25); padding: 28px 24px; margin-bottom: 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="background-color: rgba(0, 242, 254, 0.12); color: #00f2fe; font-size: 11px; font-weight: 800; letter-spacing: 1px; padding: 4px 10px; border-radius: 8px; text-transform: uppercase;">
                      ⚡ 2-Week Vibe Radar
                    </span>
                    <h1 style="margin: 14px 0 8px 0; color: #ffffff; font-size: 22px; font-weight: 900; line-height: 1.3;">
                      Don't get bored, ${name}. Here's what's on near you.
                    </h1>
                    <p style="margin: 0; color: #94a3b8; font-size: 14px; line-height: 1.6;">
                      We analyzed your area and pulled the top gruvs, concerts, and night markets coming up over the next 14 days so your plans are always locked in.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Spacing -->
          <tr><td height="24" style="height: 24px;"></td></tr>

          <!-- Event Cards List -->
          <tr>
            <td>
              ${hasEvents ? eventCardsHtml : `
                <div style="background-color: #12181f; border-radius: 16px; padding: 32px 20px; text-align: center; color: #94a3b8;">
                  <p style="margin: 0 0 12px 0; font-size: 16px; font-weight: 700; color: #fff;">New events are dropping daily!</p>
                  <p style="margin: 0; font-size: 13px;">Check the live map to explore spontaneous popups and trending spots near you.</p>
                </div>
              `}
            </td>
          </tr>

          <!-- Big Feed CTA -->
          <tr>
            <td align="center" style="padding: 16px 0 32px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="background: linear-gradient(135deg, #00f2fe 0%, #00b4d8 100%); border-radius: 14px;">
                    <a href="${appUrl}" target="_blank" style="display: inline-block; color: #070a0d; font-size: 14px; font-weight: 900; letter-spacing: 0.5px; padding: 14px 28px; text-decoration: none; text-transform: uppercase;">
                      Explore Live Map & Drop Feed &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 24px;"></td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 8px 16px 36px 16px; color: #64748b; font-size: 12px; line-height: 1.6;">
              <p style="margin: 0 0 10px 0;">
                You are receiving this personalized weekly digest because you joined <strong style="color: #94a3b8;">The Gruvs</strong>.
              </p>
              <p style="margin: 0 0 14px 0;">
                <a href="${appUrl}" target="_blank" style="color: #00f2fe; text-decoration: none; margin: 0 8px;">The Drop</a> •
                <a href="${appUrl}/#map" target="_blank" style="color: #00f2fe; text-decoration: none; margin: 0 8px;">Live Map</a> •
                <a href="${unsubscribeUrl}" target="_blank" style="color: #64748b; text-decoration: underline; margin: 0 8px;">Unsubscribe</a>
              </p>
              <p style="margin: 0; font-size: 11px; color: #475569;">
                &copy; ${new Date().getFullYear()} The Gruvs • Johannesburg, South Africa
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
