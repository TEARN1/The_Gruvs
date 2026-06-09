/**
 * feed-stress.js — k6 backend stress test for The Gruvs / Supabase.
 * ------------------------------------------------------------------------
 * PHASE 2: high-concurrency reads on event listings + concurrent real-time
 * chat writes. Validates p95 latency and error rate under spike load.
 *
 * Install k6:  https://k6.io/docs/get-started/installation/
 * Run (reads only):
 *   URL=https://xxx.supabase.co ANON=eyJ... k6 run load/feed-stress.js
 * Run (incl. chat writes — needs a logged-in test user's JWT + recipient):
 *   URL=... ANON=... JWT=<access_token> RECIPIENT=<uuid> SENDER=<uuid> k6 run load/feed-stress.js
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const URL = __ENV.URL;
const ANON = __ENV.ANON;
const JWT = __ENV.JWT;             // optional: enables the chat-write scenario
const RECIPIENT = __ENV.RECIPIENT;
const SENDER = __ENV.SENDER;

const feedErrors = new Rate('feed_errors');
const writeErrors = new Rate('write_errors');
const feedLatency = new Trend('feed_latency_ms');

export const options = {
  scenarios: {
    // Thousands of concurrent feed readers, ramped to a spike.
    feed_reads: {
      executor: 'ramping-vus',
      exec: 'readFeed',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 200 },
        { duration: '1m',  target: 1000 },  // spike
        { duration: '30s', target: 1000 },
        { duration: '20s', target: 0 },
      ],
    },
    // Rapid concurrent chat writes (message spamming), only if JWT provided.
    chat_writes: {
      executor: 'constant-arrival-rate',
      exec: 'spamChat',
      rate: JWT ? 50 : 0,          // 50 msgs/sec
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 50,
      maxVUs: 200,
    },
  },
  thresholds: {
    feed_latency_ms: ['p(95)<800'],   // p95 under 800ms
    feed_errors:     ['rate<0.01'],   // <1% read errors
    write_errors:    ['rate<0.02'],
    http_req_failed: ['rate<0.02'],
  },
};

const h = (token) => ({ apikey: ANON, Authorization: `Bearer ${token || ANON}`, 'Content-Type': 'application/json' });

export function readFeed() {
  group('feed read', () => {
    const today = new Date().toISOString().split('T')[0];
    const res = http.get(
      `${URL}/rest/v1/events?select=id,title,event_date,vibe_count,category&event_date=gte.${today}&order=vibe_count.desc&limit=20`,
      { headers: h() });
    feedLatency.add(res.timings.duration);
    const okRead = check(res, { 'feed 200': r => r.status === 200, 'feed has body': r => r.body && r.body.length > 1 });
    feedErrors.add(!okRead);
  });
  sleep(Math.random() * 1.5);
}

export function spamChat() {
  if (!JWT || !RECIPIENT || !SENDER) return;
  const res = http.post(`${URL}/rest/v1/messages`,
    JSON.stringify({ sender_id: SENDER, recipient_id: RECIPIENT, body: `load ${Date.now()}` }),
    { headers: { ...h(JWT), Prefer: 'return=minimal' } });
  writeErrors.add(!check(res, { 'msg write 2xx': r => r.status >= 200 && r.status < 300 }));
}