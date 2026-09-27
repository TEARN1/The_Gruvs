/**
 * scripts/monitor-errors.js
 *
 * Lightweight monitoring script to run via cron (e.g. every 10 mins).
 * Queries Supabase 'security_logs' table for the last 10 minutes.
 * If error/crash events spike above 5% of total activities, it fires
 * a diagnostic summary payload to the team communication channel (Discord/Slack Webhook).
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const https = require('https');

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase URL or credentials.');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

function sendWebhookAlert(webhookUrl, messageObj) {
  return new Promise((resolve, reject) => {
    if (!webhookUrl) {
      console.warn('⚠️ Webhook URL not set. Alert printed to console:');
      console.log(JSON.stringify(messageObj, null, 2));
      return resolve();
    }

    const payload = JSON.stringify(messageObj);
    const parsedUrl = new URL(webhookUrl);
    
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        resolve();
      } else {
        reject(new Error(`Webhook returned status code ${res.statusCode}`));
      }
    });

    req.on('error', (e) => reject(e));
    req.write(payload);
    req.end();
  });
}

(async () => {
  console.log('📡 Fetching security logs for the last 10 minutes...');
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  // 1. Fetch total activity count in last 10 mins
  const { count: totalEvents, error: countErr } = await sb
    .from('security_logs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', tenMinutesAgo.toISOString());

  if (countErr) {
    console.error('❌ Failed to count events from Supabase:', countErr.message);
    process.exit(1);
  }

  // 2. Fetch error logs in last 10 mins
  const { data: errorLogs, error: logErr } = await sb
    .from('security_logs')
    .select('id, event_type, metadata, created_at')
    .in('event_type', ['API_ERROR', 'UI_CRASH', 'AUTH_FAILURE'])
    .gte('created_at', tenMinutesAgo.toISOString());

  if (logErr) {
    console.error('❌ Failed to fetch error logs:', logErr.message);
    process.exit(1);
  }

  const errorCount = errorLogs?.length || 0;
  const errorRate = totalEvents > 0 ? (errorCount / totalEvents) * 100 : 0;

  console.log(`📊 Total Events: ${totalEvents} | Error Events: ${errorCount} | Error Rate: ${errorRate.toFixed(2)}%`);

  // 3. Alert if error rate exceeds 5% threshold AND there is actual event volume
  if (errorRate > 5.0 && totalEvents >= 10) {
    console.log('🚨 Error threshold exceeded! Sending webhook alert...');
    
    const sampleErrors = errorLogs.slice(0, 3).map(e => ({
      time: e.created_at,
      type: e.event_type,
      message: e.metadata?.message || e.metadata?.error || 'Unknown error'
    }));

    const alertMessage = {
      username: 'The Gruvs Monitoring Bot',
      avatar_url: 'https://thegruvs.com/logo.png',
      embeds: [
        {
          title: '🔥 CRITICAL EXCEPTION RATE SPIKE DETECTED',
          color: 15158332, // Red
          description: `The application error rate is currently **${errorRate.toFixed(1)}%** in the last 10 minutes.`,
          fields: [
            { name: 'Total Events', value: `${totalEvents}`, inline: true },
            { name: 'Total Errors', value: `${errorCount}`, inline: true },
            { name: 'Time Window', value: 'Last 10 minutes', inline: true },
            {
              name: 'Sample Diagnostic Stack Traces',
              value: sampleErrors.length > 0 
                ? sampleErrors.map(se => `\`${se.time.split('T')[1].substring(0, 8)}\` [${se.type}] ${se.message.slice(0, 100)}...`).join('\n')
                : 'No stack details recorded.'
            }
          ],
          timestamp: new Date().toISOString()
        }
      ]
    };

    try {
      await sendWebhookAlert(WEBHOOK_URL, alertMessage);
      console.log('✅ Alert dispatched.');
    } catch (err) {
      console.error('❌ Failed to send webhook:', err.message);
    }
  } else {
    console.log('✅ API and UI states are healthy (under 5% error limit). No alert needed.');
  }
})();
