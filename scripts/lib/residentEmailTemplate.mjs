/**
 * Responsive HTML Email Template for The Resident Crew
 *
 * Sent every Thursday.
 * Covers: Verified event crash pads (from R150), safe lifts / carpools (from R35),
 * host cottage monetization, and Guardian Shield night safety.
 */

export function renderResidentDigestHtml({
  user = {},
  stays = [],
  lifts = [],
  appUrl = 'https://thegruvs.com',
  residentUrl = 'https://theresidentcrew.com',
  unsubscribeUrl = 'https://thegruvs.com/unsubscribe',
}) {
  const name = user.display_name || user.username || 'Resident';

  const staysCardsHtml = (stays || []).slice(0, 3).map((s) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #12181f; border-radius: 14px; border: 1px solid rgba(34, 197, 94, 0.25); margin-bottom: 16px; overflow: hidden;">
      <tr>
        <td style="padding: 16px 18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <span style="background-color: rgba(34, 197, 94, 0.15); color: #22c55e; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 6px; text-transform: uppercase;">
                  🛡️ ${s.verified_anchor || 'Verified Crash Pad'}
                </span>
                <h4 style="margin: 8px 0 4px 0; color: #ffffff; font-size: 16px; font-weight: 800;">${s.title}</h4>
                <p style="margin: 0 0 10px 0; color: #94a3b8; font-size: 12px;">📍 ${s.location} · ⚡ ${s.power_backup || 'Solar'}</p>
              </td>
            </tr>
            <tr>
              <td style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 10px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="left">
                      <strong style="color: #22c55e; font-size: 15px;">R${s.price} / night</strong>
                    </td>
                    <td align="right">
                      <a href="${appUrl}/#resident" target="_blank" style="background: #22c55e; color: #070a0d; font-size: 11px; font-weight: 800; padding: 7px 14px; border-radius: 8px; text-decoration: none; text-transform: uppercase;">
                        View Pad &rarr;
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
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>The Resident · Weekend Lock-In</title>
</head>
<body style="margin:0; padding:0; background-color:#070a0d; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#ffffff;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#070a0d; padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="580" cellpadding="0" cellspacing="0" style="max-width:580px; width:100%;">
          
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 16px 0 24px 0;">
              <div style="font-size: 24px; font-weight: 900; letter-spacing: 2px; color: #22c55e; text-transform: uppercase;">THE RESIDENT CREW</div>
              <div style="font-size: 11px; letter-spacing: 2px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-top: 4px;">POWERED BY THE GRUVS DATA PLATFORM</div>
            </td>
          </tr>

          <!-- Hero Greeting -->
          <tr>
            <td style="background-color: #0f141a; border-radius: 18px; border: 1px solid rgba(34, 197, 94, 0.3); padding: 24px 20px; margin-bottom: 24px;">
              <span style="background-color: rgba(34, 197, 94, 0.15); color: #22c55e; font-size: 10px; font-weight: 800; letter-spacing: 1px; padding: 4px 10px; border-radius: 8px; text-transform: uppercase;">
                🛡️ Weekend Night-Ops & Stays
              </span>
              <h1 style="margin: 12px 0 8px 0; color: #ffffff; font-size: 20px; font-weight: 900;">
                Party hard. Sleep safe. Never get stranded, ${name}.
              </h1>
              <p style="margin: 0; color: #94a3b8; font-size: 13px; line-height: 1.6;">
                Don't risk driving exhausted or paying 3x late-night surge fares at 02:00 AM. Here are verified event crash pads, vetted carpools, and emergency night safety shields for this weekend.
              </p>
            </td>
          </tr>

          <tr><td height="20" style="height: 20px;"></td></tr>

          <!-- Crash Pads List -->
          <tr>
            <td>
              <h3 style="margin: 0 0 12px 0; color: #ffffff; font-size: 16px; font-weight: 800;">
                🛌 Verified Crash Pads Near This Weekend's Events
              </h3>
              ${staysCardsHtml}
            </td>
          </tr>

          <!-- Carpool Captains Section -->
          <tr>
            <td style="background-color: #0f151c; border-radius: 16px; border: 1px solid rgba(0, 242, 254, 0.2); padding: 20px; margin-bottom: 20px;">
              <span style="background-color: rgba(0, 242, 254, 0.12); color: #00f2fe; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 6px; text-transform: uppercase;">
                🚗 Community Carpool Corridors
              </span>
              <h4 style="margin: 10px 0 6px 0; color: #ffffff; font-size: 16px; font-weight: 800;">
                Ride with Vetted Carpool Captains (From R35/Seat)
              </h4>
              <p style="margin: 0 0 14px 0; color: #94a3b8; font-size: 12px; line-height: 1.6;">
                Pre-book your seat in verified driver corridors—including designated Female-Friendly Carpools led by vetted captains like Capt. Naledi.
              </p>
              <a href="${appUrl}/#resident" target="_blank" style="display: inline-block; background: #00f2fe; color: #070a0d; font-size: 11px; font-weight: 800; padding: 9px 18px; border-radius: 8px; text-decoration: none; text-transform: uppercase;">
                Find a Lift or Shuttle &rarr;
              </a>
            </td>
          </tr>

          <!-- Host Monetization Callout -->
          <tr>
            <td style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(245, 158, 11, 0.02) 100%); border-radius: 16px; border: 1px solid rgba(245, 158, 11, 0.3); padding: 20px; margin-bottom: 24px;">
              <span style="background-color: rgba(245, 158, 11, 0.2); color: #fbbf24; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 6px; text-transform: uppercase;">
                💰 Host Opportunity
              </span>
              <h4 style="margin: 10px 0 6px 0; color: #ffffff; font-size: 16px; font-weight: 800;">
                Have a Spare Room or Cottage? Earn R500–R1,500 This Weekend
              </h4>
              <p style="margin: 0 0 14px 0; color: #cbd5e1; font-size: 12px; line-height: 1.6;">
                Thousands of attendees need a safe bed near Gauteng venues. Get verified with your Dual-ID, list your space, and earn guaranteed festival host income.
              </p>
              <a href="${appUrl}/#resident" target="_blank" style="display: inline-block; background: #fbbf24; color: #070a0d; font-size: 11px; font-weight: 800; padding: 9px 18px; border-radius: 8px; text-decoration: none; text-transform: uppercase;">
                List Your Space in 2 Mins &rarr;
              </a>
            </td>
          </tr>

          <!-- Guardian Shield Reminder -->
          <tr>
            <td style="background-color: rgba(239, 68, 68, 0.06); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 14px; padding: 18px; margin-bottom: 24px;">
              <strong style="color: #f87171; font-size: 13px; display: block; margin-bottom: 4px;">
                🛡️ Guardian Shield Night Safety (Free for all users)
              </strong>
              <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.5;">
                Arm the 25-minute safe travel countdown timer before leaving any event. If not confirmed upon arrival, your family and CPF emergency relays are pinged with your live GPS location.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 24px 16px; color: #64748b; font-size: 11px; line-height: 1.6;">
              <p style="margin: 0 0 8px 0;">
                <a href="${appUrl}" target="_blank" style="color: #22c55e; text-decoration: none; margin: 0 8px;">The Gruvs</a> •
                <a href="${residentUrl}" target="_blank" style="color: #22c55e; text-decoration: none; margin: 0 8px;">The Resident Crew</a> •
                <a href="${unsubscribeUrl}" target="_blank" style="color: #64748b; text-decoration: underline; margin: 0 8px;">Unsubscribe</a>
              </p>
              <p style="margin: 0;">&copy; ${new Date().getFullYear()} The Resident Crew · Johannesburg, South Africa</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
