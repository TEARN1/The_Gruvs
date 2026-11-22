#!/usr/bin/env node
/**
 * scripts/send-weekly-digest.mjs
 *
 * Dispatches weekly 2-week upcoming event email digests to all users,
 * personalized and ranked closest-first to each user's home area/location.
 *
 * Usage:
 *   node scripts/send-weekly-digest.mjs --preview
 *   node scripts/send-weekly-digest.mjs --dry-run
 *   node scripts/send-weekly-digest.mjs --test-email you@example.com
 *   node scripts/send-weekly-digest.mjs --send
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderWeeklyDigestHtml } from './lib/emailTemplate.mjs';
import { rankEventsForUser } from './lib/digestEngine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// ── Load .env ───────────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...vals] = trimmed.split('=');
    if (key && vals.length > 0) {
      const val = vals.join('=').trim().replace(/^["']|["']$/g, '');
      if (!process.env[key.trim()]) process.env[key.trim()] = val;
    }
  }
}
loadEnv();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://feevvddvrjmfbhffccbf.supabase.co';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const APP_URL = process.env.EXPO_PUBLIC_APP_URL || 'https://thegruvs.com';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'The Gruvs <vibes@thegruvs.com>';

// ── Parse CLI Args ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isPreview = args.includes('--preview');
const isSend = args.includes('--send');
const testEmailIdx = args.indexOf('--test-email');
const testEmail = testEmailIdx > -1 ? args[testEmailIdx + 1] : null;

// ── Fetch 14-day upcoming events ────────────────────────────────────────────
async function fetchUpcomingEvents() {
  const today = new Date();
  const twoWeeksLater = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
  const todayStr = today.toISOString().split('T')[0];
  const maxStr = twoWeeksLater.toISOString().split('T')[0];

  const queryUrl = `${SUPABASE_URL}/rest/v1/events?select=id,title,venue_name,location,address,city,event_date,event_time,lat,lon,latitude,longitude,image_url,cover_url,media_urls,category,price,slug&and=(event_date.gte.${todayStr},event_date.lte.${maxStr})&deleted_at=is.null&order=event_date.asc`;

  const res = await fetch(queryUrl, {
    headers: {
      apikey: SERVICE_KEY || ANON_KEY,
      Authorization: `Bearer ${SERVICE_KEY || ANON_KEY}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch events: ${res.status} ${await res.text()}`);
  }

  const events = await res.json();
  return events || [];
}

// ── Fetch eligible users ────────────────────────────────────────────────────
async function fetchEligibleUsers() {
  // If SERVICE_KEY is present, call RPC or profiles table with service_role privileges
  if (SERVICE_KEY) {
    const rpcUrl = `${SUPABASE_URL}/rest/v1/rpc/get_weekly_digest_recipients`;
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_limit: 2000 }),
    });

    if (res.ok) {
      const users = await res.json();
      if (Array.isArray(users) && users.length > 0) return users;
    }
  }

  // Fallback / mock sample users for testing and dry-run preview across major regions
  return [
    {
      id: 'mock-user-sandton',
      email: testEmail || 'sandton.viber@example.com',
      display_name: 'Lerato',
      username: 'lerato_vibe',
      home_area: 'Sandton, Johannesburg',
      home_base_lat: -26.107768,
      home_base_lon: 28.055023,
      unsubscribe_token: '11111111-2222-3333-4444-555555555555',
    },
    {
      id: 'mock-user-pretoria',
      email: testEmail || 'tumi.pta@example.com',
      display_name: 'Tumi',
      username: 'tumi_pta',
      home_area: 'Pretoria East',
      home_base_lat: -25.784166,
      home_base_lon: 28.275555,
      unsubscribe_token: '22222222-3333-4444-5555-666666666666',
    },
    {
      id: 'mock-user-centurion',
      email: testEmail || 'sipho.centurion@example.com',
      display_name: 'Sipho',
      username: 'sipho_c',
      home_area: 'Centurion',
      home_base_lat: -25.836389,
      home_base_lon: 28.180278,
      unsubscribe_token: '33333333-4444-5555-6666-777777777777',
    },
  ];
}

// ── Email Sending Provider ──────────────────────────────────────────────────
async function sendEmail({ to, subject, html }) {
  if (RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to,
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Resend API Error: ${res.status} ${err}`);
    }
    return { ok: true, provider: 'resend' };
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
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`SendGrid API Error: ${res.status} ${err}`);
    }
    return { ok: true, provider: 'sendgrid' };
  }

  // Fallback when no provider API key configured
  return { ok: true, provider: 'mock_console' };
}

// ── Main Controller ─────────────────────────────────────────────────────────
async function run() {
  console.log('🚀 [The Gruvs] Starting 2-Week Upcoming Events Digest Engine...\n');

  // 1. Fetch live events
  const events = await fetchUpcomingEvents();
  console.log(`📅 Loaded ${events.length} events happening between now and the next 14 days.`);

  if (events.length === 0) {
    console.log('⚠️ No upcoming events found in the 14-day window. Aborting digest.');
    return;
  }

  // 2. Fetch recipients
  const users = await fetchEligibleUsers();
  console.log(`👥 Target recipients: ${users.length} users.\n`);

  // Ensure output directory for preview
  const previewDir = path.join(ROOT, 'dist', 'email-previews');
  fs.mkdirSync(previewDir, { recursive: true });

  let sentCount = 0;
  const successfulUserIds = [];

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const personalizedEvents = rankEventsForUser(user, events, { maxEvents: 6 });
    const closest = personalizedEvents[0];
    const subject = closest
      ? `⚡ Monday Radar: ${closest.title} + ${personalizedEvents.length - 1} upcoming gruvs near you`
      : "⚡ Don't get bored: Your Monday 2-week Gruvs radar";

    const unsubscribeUrl = `${APP_URL}/unsubscribe?token=${user.unsubscribe_token || user.id}`;
    const html = renderWeeklyDigestHtml({
      user,
      events: personalizedEvents,
      appUrl: APP_URL,
      playStoreUrl: 'https://play.google.com/store/apps/details?id=com.thegruvs_tearn',
      feedbackEmail: 'support@thegruvs.com',
      unsubscribeUrl,
    });

    // Save preview HTML
    if (isPreview || isDryRun || i === 0) {
      const safeName = (user.username || user.display_name || `user-${i + 1}`).replace(/[^a-z0-9_-]/gi, '_');
      const previewFile = path.join(previewDir, `digest-${safeName}.html`);
      fs.writeFileSync(previewFile, html, 'utf8');
      console.log(`📄 Saved preview HTML for ${user.display_name || user.username} (${user.home_area || 'No area'}):`);
      console.log(`   file://${previewFile.replace(/\\/g, '/')}`);
    }

    console.log(`\n──────────────────────────────────────────────────`);
    console.log(`👤 User #${i + 1}: ${user.display_name || user.username} <${user.email}>`);
    console.log(`📍 Location: ${user.home_area || 'General'} [${user.home_base_lat || 'none'}, ${user.home_base_lon || 'none'}]`);
    console.log(`🎯 Top 3 Recommended Events (Closest First):`);
    personalizedEvents.slice(0, 3).forEach((e, idx) => {
      const dist = e.distance_km != null ? `${e.distance_km} km away` : 'City wide';
      console.log(`   ${idx + 1}. [${dist}] ${e.title} @ ${e.venue_name || e.location} (${e.event_date})`);
    });

    if (isDryRun || isPreview) {
      continue;
    }

    if (testEmail) {
      console.log(`\n✉️ Sending test email to ${testEmail}...`);
      try {
        const result = await sendEmail({ to: testEmail, subject, html });
        console.log(`✅ Test email sent successfully via ${result.provider}!`);
      } catch (err) {
        console.error(`❌ Test email failed:`, err.message);
      }
      break; // Only send 1 email in test mode
    }

    if (isSend) {
      try {
        const result = await sendEmail({ to: user.email, subject, html });
        sentCount++;
        successfulUserIds.push(user.id);
        if (result.provider === 'mock_console') {
          console.log(`ℹ️ [Mock Send] Logged email to ${user.email} (Set RESEND_API_KEY to send real emails).`);
        } else {
          console.log(`✅ Dispatched email to ${user.email} via ${result.provider}.`);
        }
      } catch (err) {
        console.error(`❌ Failed to send to ${user.email}:`, err.message);
      }

      // Small delay between sends to respect provider rate limits
      await new Promise(r => setTimeout(r, 200));
    }
  }

  // Record delivery in database if live send and service role key is present
  if (isSend && successfulUserIds.length > 0 && SERVICE_KEY) {
    try {
      const stampUrl = `${SUPABASE_URL}/rest/v1/rpc/record_digest_sent`;
      await fetch(stampUrl, {
        method: 'POST',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_user_ids: successfulUserIds }),
      });
      console.log(`\n📝 Stamped last_digest_sent_at for ${successfulUserIds.length} users.`);
    } catch (err) {
      console.error('Failed to stamp delivery timestamp:', err);
    }
  }

  console.log(`\n🎉 [The Gruvs] Digest run complete!`);
  if (!isSend && !testEmail) {
    console.log(`💡 To dispatch live emails, run: node scripts/send-weekly-digest.mjs --send`);
    console.log(`💡 To send a test email to yourself: node scripts/send-weekly-digest.mjs --test-email your-email@domain.com`);
  }
}

run().catch((err) => {
  console.error('Fatal digest error:', err);
  process.exit(1);
});
