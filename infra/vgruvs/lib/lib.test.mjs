// node --test infra/vgruvs/lib/lib.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, writeFileSync, utimesSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { gzipSync } from 'node:zlib';
import {
  analyze, collect, judgeCanary, judgeDeploy, metricScore, parseSince, percentile, routeOf, summarize, vitalsOf, incidentReport
} from './insights.mjs';
import { loadJobs, matches, nextRun, parseSchedule } from './cron.mjs';
import { kindOf, payload, readConf } from './notify.mjs';
import { analysisFrom, buildRequest } from './ai.mjs';
import { readFileSync } from 'node:fs';

const run = promisify(execFile);
const T0 = Date.parse('2026-10-06T10:00:00Z');
const at = (min) => new Date(T0 + min * 60_000).toISOString();
const rec = (o) => ({ t: at(0), ip: '1.2.3.4', h: 'a.com', m: 'GET', u: '/', s: 200, b: 100, rt: 0.01, up: '-', c: '-', ref: '-', ua: 'Mozilla/5.0 Chrome/120', ...o, time: Date.parse(o.t ?? at(0)) });

test('reads time windows the way people write them', () => {
  assert.equal(parseSince('24h', T0), T0 - 864e5);
  assert.equal(parseSince('30m', T0), T0 - 18e5);
  assert.equal(parseSince('7d', T0), T0 - 7 * 864e5);
  assert.equal(parseSince('1760000000'), 1760000000000);
  assert.equal(parseSince('2026-10-06T10:00:00Z'), T0);
  assert.throws(() => parseSince('yesterday-ish'));
});

test('percentiles and route grouping', () => {
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50), 5);
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95), 10);
  assert.equal(percentile([], 50), null);
  assert.equal(routeOf('/verify/EA-2026-00001'), '/verify/:id');
  assert.equal(routeOf('/learn/admin-ea/introduction-to-formulas'), '/learn/admin-ea/introduction-to-formulas');
  assert.equal(routeOf('/users/42/posts'), '/users/:id/posts');
});

test('summarizes traffic: statuses, speed, cache, upstreams, the shield', () => {
  const records = [
    rec({ s: 200, rt: 0.010, c: 'HIT', up: '127.0.0.1:3200' }),
    rec({ s: 200, rt: 0.020, c: 'MISS', up: '127.0.0.1:3200' }),
    rec({ s: 500, rt: 0.300, u: '/api/x', c: 'MISS', up: '127.0.0.1:3201' }),
    rec({ s: 404, u: '/nope' }),
    rec({ s: 429 }),
    rec({ s: 444, u: '/wp-login.php' })
  ];
  const s = summarize(records, { since: T0, until: T0 + 3600_000 });
  assert.equal(s.requests, 5);
  assert.deepEqual(s.statuses, { '2xx': 2, '3xx': 0, '4xx': 2, '5xx': 1 });
  assert.equal(s.errorRate, 20);
  assert.equal(s.cacheHitRate, 33.33);
  assert.equal(s.shield.refused, 1);
  assert.equal(s.shield.limited, 1);
  assert.equal(s.upstreams['127.0.0.1:3201'].e5, 1);
  assert.deepEqual(s.errors[0], { path: '/api/x', status: 500, n: 1 });
  assert.equal(s.notFound[0].path, '/nope');
  assert.equal(s.latency.p95, 300);
});

test('counts visitors without cookies: a daily hash, bots and assets left out', () => {
  const records = [
    rec({ u: '/', ref: 'https://google.com/search' }),
    rec({ u: '/about' }),
    rec({ u: '/', ip: '5.6.7.8', ua: 'Mozilla/5.0 (iPhone) Mobile Safari' }),
    rec({ u: '/assets/app-abc123.js' }),
    rec({ u: '/', ua: 'Googlebot/2.1' }),
    rec({ u: '/', t: '2026-10-07T10:00:00Z' })
  ];
  const a = analyze(records);
  assert.equal(a.pageviews, 4);
  assert.equal(a.visitors, 3); // two people on day one, one (the same person) on day two
  assert.equal(a.botRequests, 1);
  assert.deepEqual(a.referrers, [{ host: 'google.com', n: 1 }]);
  assert.equal(a.devices.mobile, 1);
});

test('Core Web Vitals: p75 per metric, ratings, a score, per host', () => {
  const lines = [];
  for (let i = 0; i < 8; i++) lines.push({ h: 'a.com', q: `p=%2F&d=m&LCP=${1000 + i * 200}&CLS=0.0${i}&INP=${100 + i * 20}&FCP=900&TTFB=200`, time: T0 });
  lines.push({ h: 'other.com', q: 'p=%2F&d=d&LCP=99999', time: T0 });
  const v = vitalsOf(lines, ['a.com']);
  assert.equal(v.views, 8);
  assert.equal(v.metrics.LCP.p75, 2000);
  assert.equal(v.metrics.LCP.rating, 'good');
  assert.equal(v.metrics.INP.p75, 200);
  assert.equal(v.metrics.CLS.rating, 'good');
  assert.ok(v.score >= 85 && v.score <= 100, `score ${v.score}`);
  assert.ok(metricScore('LCP', 4000) === 50 && metricScore('LCP', 2500) === 90);
});

test('a canary with many more errors than the old release is judged bad', () => {
  const recs = [];
  for (let i = 0; i < 40; i++) recs.push(rec({ up: '127.0.0.1:3200', s: 200 }));
  for (let i = 0; i < 30; i++) recs.push(rec({ up: '127.0.0.1:3201', s: i % 3 === 0 ? 500 : 200 }));
  const bad = judgeCanary(recs, { canary: '127.0.0.1:3201', stable: '127.0.0.1:3200' });
  assert.equal(bad.verdict, 'bad');
  assert.match(bad.reason, /33\.3% of 30 requests failed/);
  const quiet = judgeCanary(recs.slice(0, 45), { canary: '127.0.0.1:3201', stable: '127.0.0.1:3200' });
  assert.equal(quiet.verdict, 'ok');
  assert.match(quiet.reason, /not enough/);
  const slow = [];
  for (let i = 0; i < 30; i++) slow.push(rec({ up: '127.0.0.1:3200', rt: 0.05 }), rec({ up: '127.0.0.1:3201', rt: 2.5 }));
  assert.equal(judgeCanary(slow, { canary: '127.0.0.1:3201', stable: '127.0.0.1:3200' }).verdict, 'bad');
});

test('the autopilot compares a deploy with the hour before it', () => {
  const before = Array.from({ length: 50 }, () => rec({ s: 200 }));
  const after = Array.from({ length: 30 }, (_, i) => rec({ s: i < 10 ? 502 : 200 }));
  assert.equal(judgeDeploy(after, before).verdict, 'bad');
  assert.equal(judgeDeploy(after.slice(10), before).verdict, 'ok');
  // Already failing as much before the deploy: not this deploy's fault.
  const noisy = Array.from({ length: 50 }, (_, i) => rec({ s: i % 3 === 0 ? 500 : 200 }));
  assert.equal(judgeDeploy(after, noisy).verdict, 'ok');
});

test('an incident report names the failing routes', () => {
  const md = incidentReport({ app: 'excellency', release: 'r9', reason: 'errors jumped', since: T0, records: [rec({ s: 500, u: '/api/verify-attempt' }), rec({})] });
  assert.match(md, /# Incident: excellency/);
  assert.match(md, /`\/api\/verify-attempt` \| 500 \| 1/);
});

test('reads the current log and rotated ones, gzipped too, within the window', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vgruvs-logs-'));
  const line = (t, s) => JSON.stringify({ t, ip: '1.1.1.1', u: '/', s, rt: 0.001 });
  writeFileSync(join(dir, 'app.log'), `${line(at(30), 200)}\nnot json\n`);
  writeFileSync(join(dir, 'app.log.1'), `${line(at(-30), 500)}\n`);
  writeFileSync(join(dir, 'app.log.2.gz'), gzipSync(`${line(at(-24 * 60), 200)}\n`));
  utimesSync(join(dir, 'app.log.2.gz'), new Date(T0 - 23 * 3600e3), new Date(T0 - 23 * 3600e3));
  const all = await collect(join(dir, 'app.log'), { since: T0 - 25 * 3600e3 });
  assert.equal(all.length, 3);
  const recent = await collect(join(dir, 'app.log'), { since: T0 - 3600e3 });
  assert.deepEqual(recent.map((r) => r.s).sort(), [200, 500]);
});

test('cron schedules: steps, ranges, names, and the day-of-month/day-of-week rule', () => {
  const d = (s) => new Date(s);
  assert.ok(matches('*/15 * * * *', d('2026-10-06T10:45:00Z')));
  assert.ok(!matches('*/15 * * * *', d('2026-10-06T10:46:00Z')));
  assert.ok(matches('0 9-17 * * mon-fri', d('2026-10-06T12:00:00Z'))); // a Tuesday
  assert.ok(!matches('0 9-17 * * mon-fri', d('2026-10-04T12:00:00Z'))); // a Sunday
  assert.ok(matches('0 0 1 * 0', d('2026-10-04T00:00:00Z'))); // Sunday, though not the 1st
  assert.ok(matches('30 4 * jan,oct *', d('2026-10-06T04:30:00Z')));
  assert.ok(matches('0 0 * * 7', d('2026-10-04T00:00:00Z'))); // 7 is Sunday too
  assert.throws(() => parseSchedule('* * * *'), /five fields/);
  assert.throws(() => parseSchedule('61 * * * *'), /out of range/);
  assert.equal(nextRun('0 5 * * *', d('2026-10-06T10:00:00Z')).toISOString(), '2026-10-07T05:00:00.000Z');
});

test('cron jobs come from vercel.json and the conf', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vgruvs-cron-'));
  writeFileSync(join(dir, 'vercel.json'), JSON.stringify({ crons: [{ path: '/api/daily', schedule: '0 5 * * *' }] }));
  const jobs = loadJobs({ vercelJson: join(dir, 'vercel.json'), extra: '*/5 * * * * /api/tick; 0 3 * * 1 /api/weekly' });
  assert.deepEqual(jobs.map((j) => j.path), ['/api/daily', '/api/tick', '/api/weekly']);
  assert.throws(() => loadJobs({ extra: '* * * * * api/no-slash' }), /must start with/);
});

test('notifications fit Discord, Slack, ntfy and plain webhooks', () => {
  assert.equal(kindOf('https://discord.com/api/webhooks/1/abc'), 'discord');
  assert.equal(kindOf('https://hooks.slack.com/services/T/B/x'), 'slack');
  assert.equal(kindOf('https://ntfy.sh/my-topic'), 'ntfy');
  assert.equal(kindOf('https://example.com/hook'), 'json');
  const e = { type: 'auto_rollback', app: 'excellency', msg: 'r9 rolled back', host: 'droplet' };
  assert.match(JSON.parse(payload('discord', e).body).content, /excellency: auto rollback\nr9 rolled back/);
  assert.match(JSON.parse(payload('slack', e).body).text, /r9 rolled back/);
  assert.equal(payload('ntfy', e).headers.Priority, 'high');
  assert.equal(JSON.parse(payload('json', e).body).source, 'vgruvs');
});

test('notify.mjs posts the event and respects NOTIFY_EVENTS', async () => {
  const got = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      got.push(JSON.parse(body));
      res.end('ok');
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const etc = mkdtempSync(join(tmpdir(), 'vgruvs-etc-'));
  writeFileSync(join(etc, 'notify.conf'), `NOTIFY_URL="http://127.0.0.1:${server.address().port}/hook"\nNOTIFY_EVENTS="deploy auto_rollback"\n`);
  assert.equal(readConf(join(etc, 'notify.conf')).NOTIFY_URL.startsWith('http://127.0.0.1:'), true);
  const script = new URL('./notify.mjs', import.meta.url).pathname;
  await run(process.execPath, [script, '--etc', etc, '--type', 'deploy', '--app', 'thegruvs', '--msg', 'r1 is live']);
  await run(process.execPath, [script, '--etc', etc, '--type', 'preview', '--app', 'thegruvs', '--msg', 'not wanted']);
  server.close();
  assert.equal(got.length, 1);
  assert.equal(got[0].type, 'deploy');
  assert.equal(got[0].msg, 'r1 is live');
});

test('AI analysis: the request, refusals, and a full run against a stand-in API', async () => {
  const { headers, body } = buildRequest({ model: 'claude-opus-5-5', effort: 'high', report: '# Incident' });
  assert.equal(headers['anthropic-version'], '2023-06-01');
  assert.equal(headers['anthropic-beta'], 'server-side-fallback-2026-07-01');
  assert.equal(body.fallbacks, 'default');
  assert.deepEqual(body.output_config, { effort: 'high' });
  assert.equal(body.thinking, undefined);
  assert.equal(buildRequest({ model: 'claude-haiku-4-5', effort: 'high', report: 'x' }).body.fallbacks, undefined);
  assert.deepEqual(analysisFrom({ stop_reason: 'refusal', stop_details: { category: 'cyber' }, content: [] }), { ok: false, text: 'The model declined to analyse this report (cyber).' });
  assert.equal(analysisFrom({ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: 'Root cause: X' }] }).text, 'Root cause: X');

  let seen;
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      seen = { headers: req.headers, body: JSON.parse(raw) };
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ model: 'claude-opus-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: 'The new release broke /api/x.' }] }));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const etc = mkdtempSync(join(tmpdir(), 'vgruvs-ai-'));
  writeFileSync(join(etc, 'ai.env'), 'ANTHROPIC_API_KEY=sk-test-123\n');
  const report = join(etc, 'incident.md');
  writeFileSync(report, '# Incident: demo\n');
  await run(process.execPath, [new URL('./ai.mjs', import.meta.url).pathname, '--etc', etc, '--incident', report], {
    env: { ...process.env, VGRUVS_AI_URL: `http://127.0.0.1:${server.address().port}/v1/messages` }
  });
  server.close();
  assert.equal(seen.headers['x-api-key'], 'sk-test-123');
  assert.equal(seen.body.messages[0].content, '# Incident: demo\n');
  const out = readFileSync(report, 'utf8');
  assert.match(out, /## AI analysis/);
  assert.match(out, /The new release broke \/api\/x\./);
  assert.doesNotMatch(out, /sk-test-123/);
});
