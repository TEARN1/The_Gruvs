/**
 * Responsive HTML Email Template for The Resident Host & Driver Brief
 *
 * Sent every Thursday at 10:00 SAST.
 * Targets: Cottage hosts, student accommodation operators, and Carpool Captains (verified drivers).
 * Features:
 * - Weekend accommodation demand spikes near event venues
 * - Cottage yield forecasts (R500–R1,500/night)
 * - 02:00 AM nightlife ride corridors (R35–R65/seat)
 * - Host damage guarantee & verified guest screening
 * - 1-tap route registration & instant payouts
 */

export function renderResidentHostDriverDigestHtml({
  user = {},
  opsData = {},
  appUrl = 'https://thegruvs.com',
  residentUrl = 'https://theresidentcrew.com',
  unsubscribeUrl = 'https://thegruvs.com/unsubscribe',
}) {
  const name = user.display_name || user.username || 'Host / Captain';
  const weekendDates = opsData.weekendDates || 'Nov 27 – Nov 29';
  const expectedSurge = opsData.expectedSurge || '92% Occupancy Rate Projected';

  const corridors = opsData.corridors || [
    { from: 'Old Park Station (Piano People)', to: 'Soweto (Vilakazi / Diepkloof)', time: '01:30 – 04:00 AM', fare: 'R55–R65 / seat' },
    { from: 'Turffontein Racecourse (Summer Cup)', to: 'Rosebank / Sandton', time: '21:00 – 02:00 AM', fare: 'R45–R60 / seat' },
    { from: 'Braamfontein Hub', to: 'Midrand / Pretoria Corridor', time: '02:00 – 05:00 AM', fare: 'R70–R85 / seat' },
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>The Resident · Host & Driver Night-Ops Brief</title>
</head>
<body style="margin:0; padding:0; background-color:#080b0f; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#ffffff; -webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#080b0f; padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background-color:#0e131b; border:1px solid #1a2332; border-radius:18px; overflow:hidden;">
          
          <!-- Top Accent Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 28px 24px;">
              <span style="display:inline-block; background:rgba(0,0,0,0.3); color:#ffffff; font-size:10px; font-weight:800; letter-spacing:1.5px; padding:4px 10px; border-radius:20px; text-transform:uppercase; margin-bottom:10px;">
                THURSDAY 10:00 SAST · HOST & MOBILITY OPERATORS
              </span>
              <h1 style="margin:0; color:#ffffff; font-size:22px; font-weight:900; letter-spacing:-0.5px;">
                Night-Ops Yield: R500–R1,500/Night Stays & 02:00 AM Corridors
              </h1>
              <p style="margin:8px 0 0 0; color:rgba(255,255,255,0.92); font-size:13px; line-height:1.5;">
                Monetize your spare cottage, student room, or vehicle during peak weekend event demand without intermediary commission cuts.
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding:24px 20px;">
              
              <p style="margin:0 0 18px 0; color:#94a3b8; font-size:14px; line-height:1.6;">
                Greetings <strong style="color:#ffffff;">${name}</strong>. Here is your supply-side briefing for <strong style="color:#10b981;">${weekendDates}</strong> across Johannesburg event perimeters.
              </p>

              <!-- Stat Grid -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td width="32%" style="background-color:#131a26; border:1px solid #1f2b3e; border-radius:12px; padding:14px 12px; text-align:center;">
                    <div style="font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase;">Cottage Demand</div>
                    <div style="font-size:18px; font-weight:900; color:#10b981; margin-top:4px;">92% Surge</div>
                  </td>
                  <td width="2%"></td>
                  <td width="32%" style="background-color:#131a26; border:1px solid #1f2b3e; border-radius:12px; padding:14px 12px; text-align:center;">
                    <div style="font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase;">Carpool Return</div>
                    <div style="font-size:18px; font-weight:900; color:#38bdf8; margin-top:4px;">R240–R320/run</div>
                  </td>
                  <td width="2%"></td>
                  <td width="32%" style="background-color:#131a26; border:1px solid #1f2b3e; border-radius:12px; padding:14px 12px; text-align:center;">
                    <div style="font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase;">Host Protection</div>
                    <div style="font-size:18px; font-weight:900; color:#f59e0b; margin-top:4px;">R50,000 Cover</div>
                  </td>
                </tr>
              </table>

              <!-- Part 1: Cottage Host Opportunity -->
              <div style="background-color:#121822; border:1px solid #1d2737; border-radius:14px; padding:18px 16px; margin-bottom:20px;">
                <span style="background-color:rgba(16,185,129,0.15); color:#10b981; font-size:10px; font-weight:800; padding:3px 8px; border-radius:6px; text-transform:uppercase;">
                  🏠 COTTAGE & CRASH PAD HOSTS
                </span>
                <h3 style="margin:10px 0 6px 0; color:#ffffff; font-size:15px; font-weight:800;">
                  Lock-In Attendees Looking for Stays Within 5km of Venues
                </h3>
                <p style="margin:0 0 12px 0; color:#94a3b8; font-size:13px; line-height:1.5;">
                  Attendees want clean beds, secure parking, and lights on during load-shedding. Backyard cottages in Turffontein, Braamfontein, Marshalltown, and Parkview average <strong>R650 – R1,200/night</strong> this weekend.
                </p>
                <a href="${residentUrl}/host" target="_blank" style="display:inline-block; background-color:#10b981; color:#06140f; font-size:12px; font-weight:800; padding:9px 18px; border-radius:8px; text-decoration:none; text-transform:uppercase;">
                  List My Crash Pad in 2 Mins &rarr;
                </a>
              </div>

              <!-- Part 2: High Demand Carpool Corridors -->
              <h3 style="margin:20px 0 12px 0; color:#ffffff; font-size:15px; font-weight:800;">
                🚗 High-Demand 02:00 AM Carpool Return Corridors
              </h3>
              <p style="margin:0 0 12px 0; color:#94a3b8; font-size:13px;">
                Verified Carpool Captains fill empty seats for people heading back in the same direction:
              </p>

              ${corridors.map((c) => `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#131924; border:1px solid #1f283a; border-radius:12px; margin-bottom:10px;">
                  <tr>
                    <td style="padding:14px 16px;">
                      <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                          <strong style="color:#ffffff; font-size:13px;">${c.from} ➔ ${c.to}</strong>
                          <div style="color:#94a3b8; font-size:12px; margin-top:2px;">⏱️ Active Hours: ${c.time}</div>
                        </div>
                        <div style="text-align:right;">
                          <span style="background-color:rgba(56,189,248,0.15); color:#38bdf8; font-size:12px; font-weight:800; padding:4px 8px; border-radius:6px; border:1px solid rgba(56,189,248,0.3);">
                            ${c.fare}
                          </span>
                        </div>
                      </div>
                    </td>
                  </tr>
                </table>
              `).join('')}

              <div style="margin-top:14px; text-align:center;">
                <a href="${residentUrl}/captain" target="_blank" style="display:inline-block; background-color:#1e293b; color:#38bdf8; border:1px solid #38bdf8; font-size:12px; font-weight:800; padding:9px 20px; border-radius:8px; text-decoration:none; text-transform:uppercase;">
                  Register as Carpool Captain &rarr;
                </a>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#090d13; border-top:1px solid #161e2c; padding:20px 24px; text-align:center;">
              <p style="margin:0 0 6px 0; color:#64748b; font-size:11px;">
                The Resident Host & Mobility Network · Powered by The Gruvs Platform.
              </p>
              <p style="margin:0; font-size:11px; color:#475569;">
                <a href="${residentUrl}" style="color:#94a3b8; text-decoration:none;">Host Dashboard</a> · 
                <a href="${residentUrl}/shield" style="color:#94a3b8; text-decoration:none;">Guardian Shield Rules</a> · 
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
