/**
 * Responsive HTML Email Template for The Gruvs Weekly 2-Week Event Digest
 *
 * Sent every Monday morning.
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
  const clean = url.trim();
  if (/^https?:\/\/images\.weserv\.nl/i.test(clean)) return clean;
  return `https://images.weserv.nl/?url=${encodeURIComponent(clean.replace(/^https?:\/\//, ''))}&w=600&h=300&fit=cover&q=75&output=jpg`;
}

export function renderWeeklyDigestHtml({
  user = {},
  events = [],
  appUrl = 'https://thegruvs.com',
  playStoreUrl = 'https://play.google.com/store/apps/details?id=com.thegruvs_tearn',
  feedbackEmail = 'support@thegruvs.com',
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
    const eventUrl = `${appUrl}/?event=${encodeURIComponent(event.id)}`;
    
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

            <!-- Interactive 1-Click Reactions Row -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed rgba(255,255,255,0.08);">
              <tr>
                <td style="padding-bottom: 6px;">
                  <span style="font-size: 10px; font-weight: 800; color: #64748b; letter-spacing: 0.8px; text-transform: uppercase;">
                    ⚡ Tap to React in App:
                  </span>
                </td>
              </tr>
              <tr>
                <td>
                  <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                    <tr>
                      <td style="padding: 2px; width: 25%;">
                        <a href="${appUrl}/?event=${encodeURIComponent(event.id)}&react=fire" target="_blank" style="display: block; text-align: center; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 8px; padding: 7px 4px; text-decoration: none; color: #ffffff; font-size: 11px; font-weight: 700;">
                          🔥 Fire
                        </a>
                      </td>
                      <td style="padding: 2px; width: 25%;">
                        <a href="${appUrl}/?event=${encodeURIComponent(event.id)}&react=heart" target="_blank" style="display: block; text-align: center; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 8px; padding: 7px 4px; text-decoration: none; color: #ffffff; font-size: 11px; font-weight: 700;">
                          ❤️ Love
                        </a>
                      </td>
                      <td style="padding: 2px; width: 25%;">
                        <a href="${appUrl}/?event=${encodeURIComponent(event.id)}&react=hype" target="_blank" style="display: block; text-align: center; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 8px; padding: 7px 4px; text-decoration: none; color: #ffffff; font-size: 11px; font-weight: 700;">
                          🙌 Hyped
                        </a>
                      </td>
                      <td style="padding: 2px; width: 25%;">
                        <a href="${appUrl}/?event=${encodeURIComponent(event.id)}&react=star" target="_blank" style="display: block; text-align: center; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 8px; padding: 7px 4px; text-decoration: none; color: #ffffff; font-size: 11px; font-weight: 700;">
                          ⭐ Star
                        </a>
                      </td>
                    </tr>
                  </table>
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
  <title>Your Monday Gruvs Radar · Next 2 Weeks</title>
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
    ${hasEvents ? `⚡ Monday Radar: ${events.length} events coming up in the next 14 days, starting with ${closestEvent?.title || 'top gruvs'} near you.` : 'Stay locked into the hottest upcoming gruvs near you.'}
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
                <div style="font-size: 26px; font-weight: 900; letter-spacing: 2px; color: #00f2fe; text-transform: uppercase;">
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
                      ⚡ Monday Vibe Radar · 14-Day Horizon
                    </span>
                    <h1 style="margin: 14px 0 8px 0; color: #ffffff; font-size: 22px; font-weight: 900; line-height: 1.3;">
                      Start the week locked in, ${name}.
                    </h1>
                    <p style="margin: 0; color: #94a3b8; font-size: 14px; line-height: 1.6;">
                      Here are the top upcoming events and gatherings across Gauteng for the next two weeks, prioritized closest to your area so you never get bored. Tap any event to lock in your RSVP or drop a reaction.
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
            <td align="center" style="padding: 10px 0 28px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="background: linear-gradient(135deg, #00f2fe 0%, #00b4d8 100%); border-radius: 14px; box-shadow: 0 4px 16px rgba(0, 242, 254, 0.25);">
                    <a href="${appUrl}" target="_blank" style="display: inline-block; color: #070a0d; font-size: 13px; font-weight: 900; letter-spacing: 0.5px; padding: 14px 28px; text-decoration: none; text-transform: uppercase;">
                      Explore Live Map & Drop Feed &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Google Play App Update, Stability Warning & Feedback Card -->
          <tr>
            <td style="background: linear-gradient(180deg, #10161d 0%, #0c1015 100%); border-radius: 20px; border: 1px solid rgba(52, 211, 153, 0.25); padding: 26px 22px; margin-bottom: 28px;">
              
              <!-- Section Pill -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 12px;">
                <tr>
                  <td>
                    <span style="display: inline-block; background-color: rgba(52, 211, 153, 0.12); color: #34d399; font-size: 11px; font-weight: 800; letter-spacing: 1px; padding: 4px 10px; border-radius: 8px; text-transform: uppercase; border: 1px solid rgba(52, 211, 153, 0.3);">
                      📲 Android App · Google Play Store
                    </span>
                  </td>
                </tr>
              </table>

              <h2 style="margin: 0 0 8px 0; color: #ffffff; font-size: 20px; font-weight: 900; line-height: 1.3;">
                The Gruvs is live on Google Play
              </h2>
              <p style="margin: 0 0 18px 0; color: #94a3b8; font-size: 13px; line-height: 1.6;">
                Get fast push notifications when your favorite DJs and venues drop tickets, discover radar events around your neighborhood, and access offline event passes right from your pocket.
              </p>

              <!-- Google Play Download Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
                <tr>
                  <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.25);">
                    <a href="${playStoreUrl}" target="_blank" style="display: inline-block; color: #ffffff; font-size: 13px; font-weight: 800; letter-spacing: 0.5px; padding: 12px 22px; text-decoration: none;">
                      ▶️ Download / Update on Google Play &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Transparent Warning & Stability Notice Box -->
              <div style="background-color: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 12px; padding: 16px; margin-bottom: 18px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align: top; width: 28px;">
                      <span style="font-size: 20px; line-height: 1;">⚠️</span>
                    </td>
                    <td style="vertical-align: top; padding-left: 8px;">
                      <strong style="color: #fbbf24; font-size: 13px; display: block; margin-bottom: 4px;">
                        An Honest Note on Stability & Recent Crashes
                      </strong>
                      <p style="margin: 0; color: #cbd5e1; font-size: 12px; line-height: 1.6;">
                        Over the past few months, we know some of you experienced frustrating app crashes or freezes on certain Android devices. We sincerely apologize for that. Our engineering team has rolled out a series of core graphics and memory caching overhauls to address this.
                        <br/><br/>
                        <strong>Please note:</strong> Because Android encompasses thousands of device models, you might still experience occasional hiccups or unexpected crashes as this release stabilizes.
                      </p>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Feedback Request Box -->
              <div style="background-color: rgba(0, 242, 254, 0.06); border: 1px solid rgba(0, 242, 254, 0.2); border-radius: 12px; padding: 16px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align: top; width: 28px;">
                      <span style="font-size: 20px; line-height: 1;">💬</span>
                    </td>
                    <td style="vertical-align: top; padding-left: 8px;">
                      <strong style="color: #00f2fe; font-size: 13px; display: block; margin-bottom: 4px;">
                        We Need Your Feedback to Make It Bulletproof
                      </strong>
                      <p style="margin: 0 0 12px 0; color: #94a3b8; font-size: 12px; line-height: 1.6;">
                        If the app crashes, freezes, or if something feels off on your device, please don't hesitate to reach out! Tell us your phone model and what happened. Every report goes straight to our dev desk so we can squash bugs immediately.
                      </p>
                      <a href="mailto:${feedbackEmail}?subject=The%20Gruvs%20Android%20Feedback%20%26%20Crash%20Report&body=Hi%20Gruvs%20Team%2C%0A%0AMy%20Phone%20Model%3A%20%0AAndroid%20Version%3A%20%0AWhat%20happened%20(crash%20or%20feedback)%3A%20%0A%0A" style="display: inline-block; background-color: rgba(0, 242, 254, 0.15); color: #00f2fe; border: 1px solid rgba(0, 242, 254, 0.4); border-radius: 8px; font-size: 12px; font-weight: 700; padding: 8px 16px; text-decoration: none;">
                        ✉️ Send Feedback / Report a Crash
                      </a>
                    </td>
                  </tr>
                </table>
              </div>

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
                <a href="${playStoreUrl}" target="_blank" style="color: #34d399; text-decoration: none; margin: 0 8px;">Google Play</a> •
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
