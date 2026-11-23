/**
 * Responsive HTML Email Template for Excellency Academy
 *
 * Sent every Wednesday.
 * Covers: Audio engineering masterclasses, live DJ dubplate craft, festival economics,
 * and Vibe Point scholarship discounts.
 */

export function renderExcellencyDigestHtml({
  user = {},
  courses = [],
  appUrl = 'https://thegruvs.com',
  excellencyUrl = 'https://excellencyacs.com',
  unsubscribeUrl = 'https://thegruvs.com/unsubscribe',
}) {
  const name = user.display_name || user.username || 'Scholar';

  const coursesHtml = (courses || []).slice(0, 3).map((c) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #12181f; border-radius: 14px; border: 1px solid rgba(59, 130, 246, 0.25); margin-bottom: 16px; overflow: hidden;">
      <tr>
        <td style="padding: 18px 20px;">
          <span style="background-color: rgba(59, 130, 246, 0.15); color: #60a5fa; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 6px; text-transform: uppercase;">
            ${c.badge || 'MASTERCLASS'}
          </span>
          <h4 style="margin: 8px 0 4px 0; color: #ffffff; font-size: 16px; font-weight: 800;">${c.title}</h4>
          <p style="margin: 0 0 12px 0; color: #94a3b8; font-size: 12px;">👨‍🏫 ${c.instructor || 'Residency Mentor'} · ⏱️ ${c.duration || '2-4 Weeks'}</p>
          
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 10px;">
            <tr>
              <td align="left">
                <span style="color: #10b981; font-size: 11px; font-weight: 700;">🎁 ${c.discount || 'Scholarship Eligible'}</span>
              </td>
              <td align="right">
                <a href="${appUrl}/#excellency" target="_blank" style="background: #3b82f6; color: #ffffff; font-size: 11px; font-weight: 800; padding: 7px 14px; border-radius: 8px; text-decoration: none; text-transform: uppercase;">
                  View Syllabus &rarr;
                </a>
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
  <title>Excellency Academy · Master The Craft</title>
</head>
<body style="margin:0; padding:0; background-color:#070a0d; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#ffffff;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#070a0d; padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="580" cellpadding="0" cellspacing="0" style="max-width:580px; width:100%;">
          
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 16px 0 24px 0;">
              <div style="font-size: 24px; font-weight: 900; letter-spacing: 2px; color: #3b82f6; text-transform: uppercase;">EXCELLENCY ACADEMY</div>
              <div style="font-size: 11px; letter-spacing: 2px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-top: 4px;">POWERED BY THE GRUVS DATA PLATFORM</div>
            </td>
          </tr>

          <!-- Hero Greeting -->
          <tr>
            <td style="background-color: #0f141a; border-radius: 18px; border: 1px solid rgba(59, 130, 246, 0.3); padding: 24px 20px; margin-bottom: 24px;">
              <span style="background-color: rgba(59, 130, 246, 0.15); color: #60a5fa; font-size: 10px; font-weight: 800; letter-spacing: 1px; padding: 4px 10px; border-radius: 8px; text-transform: uppercase;">
                🏛️ Mid-Week Craft & Production Drop
              </span>
              <h1 style="margin: 12px 0 8px 0; color: #ffffff; font-size: 20px; font-weight: 900;">
                Don't just be in the crowd, ${name}. Build the sound.
              </h1>
              <p style="margin: 0; color: #94a3b8; font-size: 13px; line-height: 1.6;">
                Turn your passion for Amapiano, Afro-Tech, and live festivals into professional sound engineering, DJ mastery, and event architecture skills.
              </p>
            </td>
          </tr>

          <tr><td height="20" style="height: 20px;"></td></tr>

          <!-- Masterclasses List -->
          <tr>
            <td>
              <h3 style="margin: 0 0 12px 0; color: #ffffff; font-size: 16px; font-weight: 800;">
                🎛️ Featured Masterclasses This Week
              </h3>
              ${coursesHtml}
            </td>
          </tr>

          <!-- Vibe Point Scholarship Card -->
          <tr>
            <td style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.02) 100%); border-radius: 16px; border: 1px solid rgba(16, 185, 129, 0.3); padding: 20px; margin-bottom: 24px;">
              <span style="background-color: rgba(16, 185, 129, 0.2); color: #10b981; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 6px; text-transform: uppercase;">
                🎟️ Vibe Point Scholarship
              </span>
              <h4 style="margin: 10px 0 6px 0; color: #ffffff; font-size: 16px; font-weight: 800;">
                Redeem Your Gruvs Check-in Points for 20% to 100% Tuition Off
              </h4>
              <p style="margin: 0 0 14px 0; color: #cbd5e1; font-size: 12px; line-height: 1.6;">
                Attending events on The Gruvs earns you Vibe Points. Use your points to fund your audio engineering or stage lighting certifications.
              </p>
              <a href="${appUrl}/#excellency" target="_blank" style="display: inline-block; background: #10b981; color: #070a0d; font-size: 11px; font-weight: 800; padding: 9px 18px; border-radius: 8px; text-decoration: none; text-transform: uppercase;">
                Check Scholarship Status &rarr;
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 24px 16px; color: #64748b; font-size: 11px; line-height: 1.6;">
              <p style="margin: 0 0 8px 0;">
                <a href="${appUrl}" target="_blank" style="color: #3b82f6; text-decoration: none; margin: 0 8px;">The Gruvs</a> •
                <a href="${excellencyUrl}" target="_blank" style="color: #3b82f6; text-decoration: none; margin: 0 8px;">Excellency Academy</a> •
                <a href="${unsubscribeUrl}" target="_blank" style="color: #64748b; text-decoration: underline; margin: 0 8px;">Unsubscribe</a>
              </p>
              <p style="margin: 0;">&copy; ${new Date().getFullYear()} Excellency Academy · Johannesburg, South Africa</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
