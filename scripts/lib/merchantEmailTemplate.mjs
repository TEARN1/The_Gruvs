/**
 * Responsive HTML Email Template for The Gruvs Merchant & Vendor Intelligence
 *
 * Sent every Tuesday at 10:00 SAST.
 * Targets: Food vendors, kota stalls, pop-up bars, sound & stage providers, and event promoters.
 * Features:
 * - Weekend crowd foot-traffic forecast & heatmap
 * - 1-tap pop-up vendor permit bookings
 * - Live map search trends & keyword spikes
 * - Merchant Boost & sponsored pin placements
 * - Fast payout & settlement metrics
 */

export function renderMerchantDigestHtml({
  user = {},
  forecastData = {},
  appUrl = 'https://thegruvs.com',
  merchantUrl = 'https://thegruvs.com/business',
  unsubscribeUrl = 'https://thegruvs.com/unsubscribe',
}) {
  const name = user.display_name || user.username || 'Partner';
  const totalCrowd = forecastData.totalCrowd || '14,500+';
  const peakDate = forecastData.peakDate || 'Saturday & Sunday';
  const topCorridors = forecastData.corridors || [
    { area: 'Turffontein / South JHB', crowd: '8,500+ Attendees', note: 'Betway Summer Cup 2026' },
    { area: 'Old Park Station / Newtown', crowd: '3,800+ Attendees', note: 'Piano People Live' },
    { area: 'Rosebank & Parkview', crowd: '2,200+ Attendees', note: 'Food & Cultural Markets' },
  ];

  const searchTrends = forecastData.trends || [
    { term: 'Kota & Street Food near Turffontein', change: '+340% search surge' },
    { term: 'VIP Table & Mobile Cocktails', change: '+210% search surge' },
    { term: 'Safe Overnight Parking Braam', change: '+185% search surge' },
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>The Gruvs · Merchant & Vendor Intelligence</title>
</head>
<body style="margin:0; padding:0; background-color:#090b0e; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#ffffff; -webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#090b0e; padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background-color:#11151c; border:1px solid #1e2638; border-radius:18px; overflow:hidden;">
          
          <!-- Top Accent Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #FF6B00 0%, #D85A00 100%); padding: 28px 24px;">
              <span style="display:inline-block; background:rgba(0,0,0,0.3); color:#ffffff; font-size:10px; font-weight:800; letter-spacing:1.5px; padding:4px 10px; border-radius:20px; text-transform:uppercase; margin-bottom:10px;">
                TUESDAY 10:00 SAST · BUSINESS & VENDOR INTEL
              </span>
              <h1 style="margin:0; color:#ffffff; font-size:22px; font-weight:900; letter-spacing:-0.5px;">
                Weekend Crowd Forecast: ${totalCrowd} Projected Attendees
              </h1>
              <p style="margin:8px 0 0 0; color:rgba(255,255,255,0.9); font-size:13px; line-height:1.5;">
                Turn Gauteng nightlife and festival foot-traffic into direct revenue for your food stall, mobile bar, or event service.
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding:24px 20px;">
              
              <!-- Greeting & Summary -->
              <p style="margin:0 0 18px 0; color:#94a3b8; font-size:14px; line-height:1.6;">
                Sawubona <strong style="color:#ffffff;">${name}</strong>, here is your operational briefing for the upcoming weekend (<strong style="color:#FF6B00;">${peakDate}</strong>).
              </p>

              <!-- Stat Grid -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td width="32%" style="background-color:#161c26; border:1px solid #232c3d; border-radius:12px; padding:14px 12px; text-align:center;">
                    <div style="font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase;">Projected Crowd</div>
                    <div style="font-size:18px; font-weight:900; color:#FF6B00; margin-top:4px;">${totalCrowd}</div>
                  </td>
                  <td width="2%"></td>
                  <td width="32%" style="background-color:#161c26; border:1px solid #232c3d; border-radius:12px; padding:14px 12px; text-align:center;">
                    <div style="font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase;">Active Corridors</div>
                    <div style="font-size:18px; font-weight:900; color:#38bdf8; margin-top:4px;">3 Hotspots</div>
                  </td>
                  <td width="2%"></td>
                  <td width="32%" style="background-color:#161c26; border:1px solid #232c3d; border-radius:12px; padding:14px 12px; text-align:center;">
                    <div style="font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase;">Avg Stall Spend</div>
                    <div style="font-size:18px; font-weight:900; color:#4ade80; margin-top:4px;">R180–R320</div>
                  </td>
                </tr>
              </table>

              <!-- High-Footfall Zones -->
              <h3 style="margin:0 0 12px 0; color:#ffffff; font-size:15px; font-weight:800; letter-spacing:0.5px;">
                📍 Top Gauteng Foot-Traffic Clusters This Weekend
              </h3>
              ${topCorridors.map((c) => `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#151a24; border:1px solid #202838; border-radius:12px; margin-bottom:10px;">
                  <tr>
                    <td style="padding:14px 16px;">
                      <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                          <strong style="color:#ffffff; font-size:14px;">${c.area}</strong>
                          <div style="color:#94a3b8; font-size:12px; margin-top:2px;">🎯 ${c.note}</div>
                        </div>
                        <div style="text-align:right;">
                          <span style="background-color:rgba(255,107,0,0.15); color:#FF6B00; font-size:11px; font-weight:800; padding:4px 8px; border-radius:6px; border:1px solid rgba(255,107,0,0.3);">
                            ${c.crowd}
                          </span>
                        </div>
                      </div>
                    </td>
                  </tr>
                </table>
              `).join('')}

              <div style="height:14px;"></div>

              <!-- Search Trends -->
              <div style="background-color:#141922; border:1px solid #242d3e; border-radius:14px; padding:18px 16px; margin-bottom:24px;">
                <h4 style="margin:0 0 10px 0; color:#38bdf8; font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:1px;">
                  🔍 What Gruvers Are Searching For Right Now:
                </h4>
                ${searchTrends.map((t) => `
                  <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.05); font-size:12px;">
                    <span style="color:#e2e8f0;">${t.term}</span>
                    <span style="color:#4ade80; font-weight:700;">${t.change}</span>
                  </div>
                `).join('')}
              </div>

              <!-- Merchant Action Box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, rgba(255,107,0,0.12) 0%, rgba(255,107,0,0.03) 100%); border:1px solid rgba(255,107,0,0.35); border-radius:14px; margin-bottom:20px;">
                <tr>
                  <td style="padding:20px 18px;">
                    <span style="background-color:#FF6B00; color:#ffffff; font-size:10px; font-weight:800; padding:3px 8px; border-radius:6px; text-transform:uppercase;">
                      COMMERCIAL OPPORTUNITY
                    </span>
                    <h3 style="margin:10px 0 6px 0; color:#ffffff; font-size:16px; font-weight:800;">
                      Lock in Your Weekend Pop-Up Permit or Food Stall Slot
                    </h3>
                    <p style="margin:0 0 16px 0; color:#94a3b8; font-size:13px; line-height:1.5;">
                      Official pop-up vendor permits are open for Turffontein & Newtown events. Connect directly with promoters or boost your permanent spot on the Gruvs Live Map.
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <a href="${merchantUrl}/permits" target="_blank" style="display:inline-block; background-color:#FF6B00; color:#ffffff; font-size:12px; font-weight:800; padding:10px 20px; border-radius:8px; text-decoration:none; text-transform:uppercase;">
                            Apply for Pop-Up Permit &rarr;
                          </a>
                        </td>
                        <td width="10"></td>
                        <td>
                          <a href="${merchantUrl}/boost" target="_blank" style="display:inline-block; background-color:#1e2638; color:#ffffff; font-size:12px; font-weight:800; padding:10px 18px; border-radius:8px; text-decoration:none; border:1px solid #334155;">
                            Boost Venue Pin (3km Radius)
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#0c0e13; border-top:1px solid #1a202c; padding:20px 24px; text-align:center;">
              <p style="margin:0 0 6px 0; color:#64748b; font-size:11px;">
                Sent to verified Gruvs Merchant & Vendor Partners across Gauteng.
              </p>
              <p style="margin:0; font-size:11px; color:#475569;">
                <a href="${merchantUrl}" style="color:#94a3b8; text-decoration:none;">Merchant Portal</a> · 
                <a href="${appUrl}/payouts" style="color:#94a3b8; text-decoration:none;">Instant Payouts</a> · 
                <a href="${unsubscribeUrl}" style="color:#64748b; text-decoration:none;">Unsubscribe</a>
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
