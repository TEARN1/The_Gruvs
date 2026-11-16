#!/usr/bin/env node
// V-Gruvs insights: everything the platform knows about traffic comes from
// nginx's JSON access logs (one per app) and the Web Vitals beacon log.
// Nothing is stored beyond those logs, and no cookies are involved.
//
//   insights.mjs insights  --log <file> [--since 24h] [--json]   traffic, errors, speed, cache
//   insights.mjs analytics --log <file> [--since 7d]  [--json]   visitors, pages, referrers
//   insights.mjs vitals    --log <vitals file> --hosts "a.com b.com" [--since 7d] [--json]
//   insights.mjs canary    --log <file> --since <epoch> --canary <addr> --stable <addr> [--report]
//   insights.mjs autopilot --log <file> --since <epoch>
//   insights.mjs incident  --log <file> --since <epoch> --app <app> --release <id> --reason <text>
//   insights.mjs events    --events <file> [--app <app>] [-n 30]
//
// --log names the current file; rotated ones beside it (<file>.1, <file>.2.gz,
// ...) are read too when the window reaches back into them.

import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { createGunzip } from 'node:zlib';
import { pathToFileURL } from 'node:url';

// ── Time windows ────────────────────────────────────────────────────────────
/** "24h", "7d", "30m", epoch seconds or an ISO date -> epoch milliseconds. */
export function parseSince(value, now = Date.now()) {
  if (value === undefined || value === null || value === '') return now - 24 * 3600_000;
  const s = String(value).trim();
  const rel = /^(\d+(?:\.\d+)?)\s*(s|m|h|d|w)$/.exec(s);
  if (rel) return now - Number(rel[1]) * { s: 1e3, m: 6e4, h: 36e5, d: 864e5, w: 6048e5 }[rel[2]];
  if (/^\d{9,11}$/.test(s)) return Number(s) * 1000;
  if (/^\d{12,14}$/.test(s)) return Number(s);
  const t = Date.parse(s);
  if (Number.isNaN(t)) throw new Error(`cannot read the time "${s}" (try 24h, 7d or an ISO date)`);
  return t;
}

// ── Reading logs ────────────────────────────────────────────────────────────
/** The current log and its rotated siblings that may hold lines after `since`. */
export function logFiles(file, since = 0) {
  const dir = dirname(file);
  const base = basename(file);
  if (!existsSync(dir)) return [];
  const re = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\.\\d+)?(\\.gz)?$`);
  return readdirSync(dir)
    .filter((f) => re.test(f))
    .map((f) => join(dir, f))
    .filter((f) => {
      try {
        return statSync(f).mtimeMs >= since;
      } catch {
        return false;
      }
    });
}

/** Every parsed line from the files, oldest file first, within [since, until). */
export async function* readRecords(file, { since = 0, until = Infinity } = {}) {
  const files = logFiles(file, since).sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs);
  for (const f of files) {
    const input = f.endsWith('.gz') ? createReadStream(f).pipe(createGunzip()) : createReadStream(f);
    const lines = createInterface({ input, crlfDelay: Infinity });
    for await (const line of lines) {
      if (!line || line[0] !== '{') continue;
      let r;
      try {
        r = JSON.parse(line);
      } catch {
        continue;
      }
      const t = Date.parse(r.t);
      if (Number.isNaN(t) || t < since || t >= until) continue;
      r.time = t;
      yield r;
    }
  }
}

export async function collect(file, opts) {
  const out = [];
  for await (const r of readRecords(file, opts)) out.push(r);
  return out;
}

// ── Numbers ─────────────────────────────────────────────────────────────────
export function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[i];
}

const round = (n, d = 0) => (n === null || n === undefined ? null : Math.round(n * 10 ** d) / 10 ** d);
const pct = (part, whole) => (whole ? round((part / whole) * 100, 2) : 0);

/** Groups /verify/EA-2026-00001 with /verify/EA-2026-00002, assets with assets. */
export function routeOf(path) {
  return (
    String(path || '/')
      .split('/')
      .map((seg) => (/^\d+$/.test(seg) || (seg.length >= 6 && /\d/.test(seg) && /[A-Za-z0-9_-]{6,}/.test(seg)) ? ':id' : seg))
      .join('/') || '/'
  );
}

const upstreamOf = (r) => (r.up && r.up !== '-' ? String(r.up).split(',').pop().trim() : '');
const latencyMs = (r) => (typeof r.rt === 'number' ? r.rt * 1000 : Number(r.rt) * 1000);

// ── Traffic ─────────────────────────────────────────────────────────────────
export function summarize(records, { since, until = Date.now() } = {}) {
  const statuses = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };
  const cache = {};
  const paths = new Map();
  const errors = new Map();
  const notFound = new Map();
  const ups = new Map();
  const latencies = [];
  let bytes = 0;
  let refused = 0;
  let limited = 0;
  let requests = 0;
  const start = since ?? (records.length ? records[0].time : until);
  const span = Math.max(1, until - start);
  const bucketMs = span > 3 * 864e5 ? 864e5 : span > 6 * 36e5 ? 36e5 : 6e5;
  const buckets = new Map();

  for (const r of records) {
    const s = Number(r.s);
    if (s === 444) {
      refused++;
      continue;
    }
    requests++;
    if (s === 429) limited++;
    const cls = `${Math.floor(s / 100)}xx`;
    if (cls in statuses) statuses[cls]++;
    bytes += Number(r.b) || 0;
    const ms = latencyMs(r);
    if (Number.isFinite(ms)) latencies.push(ms);
    if (r.c && r.c !== '-') cache[r.c] = (cache[r.c] ?? 0) + 1;
    const route = routeOf(r.u);
    const p = paths.get(route) ?? { n: 0, lat: [] };
    p.n++;
    if (Number.isFinite(ms)) p.lat.push(ms);
    paths.set(route, p);
    if (s >= 500) errors.set(`${route} ${s}`, (errors.get(`${route} ${s}`) ?? 0) + 1);
    if (s === 404) notFound.set(route, (notFound.get(route) ?? 0) + 1);
    const up = upstreamOf(r);
    if (up) {
      const u = ups.get(up) ?? { n: 0, e5: 0, lat: [] };
      u.n++;
      if (s >= 500) u.e5++;
      if (Number.isFinite(ms)) u.lat.push(ms);
      ups.set(up, u);
    }
    const b = Math.floor((r.time - start) / bucketMs);
    const bk = buckets.get(b) ?? { n: 0, e5: 0 };
    bk.n++;
    if (s >= 500) bk.e5++;
    buckets.set(b, bk);
  }

  const cacheable = Object.values(cache).reduce((a, b) => a + b, 0);
  const hits = (cache.HIT ?? 0) + (cache.STALE ?? 0) + (cache.UPDATING ?? 0) + (cache.REVALIDATED ?? 0);
  const nBuckets = Math.max(1, Math.ceil(span / bucketMs));
  const series = Array.from({ length: Math.min(nBuckets, 400) }, (_, i) => ({
    t: new Date(start + i * bucketMs).toISOString(),
    n: buckets.get(i)?.n ?? 0,
    e5: buckets.get(i)?.e5 ?? 0
  }));

  return {
    window: { since: new Date(start).toISOString(), until: new Date(until).toISOString() },
    requests,
    perMinute: round(requests / (span / 6e4), 2),
    statuses,
    errorRate: pct(statuses['5xx'], requests),
    latency: { p50: round(percentile(latencies, 50)), p95: round(percentile(latencies, 95)), p99: round(percentile(latencies, 99)) },
    bytes,
    cache,
    cacheHitRate: cacheable ? pct(hits, cacheable) : null,
    topPaths: [...paths].sort((a, b) => b[1].n - a[1].n).slice(0, 10).map(([path, v]) => ({ path, n: v.n })),
    slowest: [...paths]
      .filter(([, v]) => v.lat.length >= 5)
      .map(([path, v]) => ({ path, p95: round(percentile(v.lat, 95)), n: v.n }))
      .sort((a, b) => b.p95 - a.p95)
      .slice(0, 5),
    errors: [...errors].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n]) => ({ path: k.slice(0, k.lastIndexOf(' ')), status: Number(k.slice(k.lastIndexOf(' ') + 1)), n })),
    notFound: [...notFound].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([path, n]) => ({ path, n })),
    upstreams: Object.fromEntries([...ups].map(([k, v]) => [k, { n: v.n, e5: v.e5, errorRate: pct(v.e5, v.n), p95: round(percentile(v.lat, 95)) }])),
    shield: { refused, limited },
    series
  };
}

// ── Visitors (Vercel-style: no cookies, a hash that resets every day) ───────
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|curl|wget|python|go-http|httpclient|headless|lighthouse|monitor|uptime/i;
const ASSET = /\.(js|mjs|css|map|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|eot|json|txt|xml|webmanifest|wasm|apk|mp4|mp3|gz|br)$/i;
const NOT_PAGE = /^\/(_vgruvs|api|_next|_expo|assets|\.well-known)(\/|$)/;

export function isPageView(r) {
  const s = Number(r.s);
  return (r.m === 'GET' || r.m === undefined) && (s === 200 || s === 304) && !ASSET.test(r.u || '') && !NOT_PAGE.test(r.u || '') && !BOT.test(r.ua || '');
}

export function deviceOf(ua = '') {
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) return 'tablet';
  if (/mobi|iphone|android/i.test(ua)) return 'mobile';
  return 'desktop';
}

export function browserOf(ua = '') {
  if (/edg\//i.test(ua)) return 'Edge';
  if (/opr\/|opera/i.test(ua)) return 'Opera';
  if (/samsungbrowser/i.test(ua)) return 'Samsung Internet';
  if (/chrome|crios/i.test(ua)) return 'Chrome';
  if (/firefox|fxios/i.test(ua)) return 'Firefox';
  if (/safari/i.test(ua)) return 'Safari';
  return 'Other';
}

export function analyze(records) {
  const days = new Map();
  const pages = new Map();
  const refs = new Map();
  const devices = {};
  const browsers = {};
  let pageviews = 0;
  let bots = 0;
  for (const r of records) {
    if (BOT.test(r.ua || '')) {
      bots++;
      continue;
    }
    if (!isPageView(r)) continue;
    pageviews++;
    const day = String(r.t).slice(0, 10);
    const id = createHash('sha256').update(`${day}|${r.ip}|${r.ua}`).digest('base64url').slice(0, 16);
    const set = days.get(day) ?? new Set();
    set.add(id);
    days.set(day, set);
    pages.set(r.u, (pages.get(r.u) ?? 0) + 1);
    try {
      if (r.ref && r.ref !== '-') {
        const host = new URL(r.ref).hostname.replace(/^www\./, '');
        if (host && host !== String(r.h || '').replace(/^www\./, '')) refs.set(host, (refs.get(host) ?? 0) + 1);
      }
    } catch {
      // not a URL
    }
    const d = deviceOf(r.ua);
    devices[d] = (devices[d] ?? 0) + 1;
    const b = browserOf(r.ua);
    browsers[b] = (browsers[b] ?? 0) + 1;
  }
  const perDay = [...days].sort().map(([day, set]) => ({ day, visitors: set.size }));
  return {
    visitors: perDay.reduce((a, d) => a + d.visitors, 0),
    pageviews,
    perDay,
    topPages: [...pages].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([path, n]) => ({ path, n })),
    referrers: [...refs].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([host, n]) => ({ host, n })),
    devices,
    browsers,
    botRequests: bots
  };
}

// ── Core Web Vitals ─────────────────────────────────────────────────────────
// Thresholds from web.dev: [good up to, poor above].
export const VITALS = {
  LCP: { good: 2500, poor: 4000, unit: 'ms', weight: 30 },
  INP: { good: 200, poor: 500, unit: 'ms', weight: 30 },
  CLS: { good: 0.1, poor: 0.25, unit: '', weight: 25 },
  FCP: { good: 1800, poor: 3000, unit: 'ms', weight: 15 },
  TTFB: { good: 800, poor: 1800, unit: 'ms', weight: 0 }
};

export function rate(metric, value) {
  const v = VITALS[metric];
  if (value === null || value === undefined) return null;
  return value <= v.good ? 'good' : value <= v.poor ? 'needs-improvement' : 'poor';
}

/** 100 at zero, 90 at the "good" line, 50 at the "poor" line, 0 at twice that. */
export function metricScore(metric, value) {
  const { good, poor } = VITALS[metric];
  if (value <= good) return 90 + 10 * (1 - value / good);
  if (value <= poor) return 50 + 40 * (1 - (value - good) / (poor - good));
  return Math.max(0, 50 * (1 - (value - poor) / poor));
}

export function vitalsOf(records, hosts = []) {
  const want = new Set(hosts.map((h) => h.toLowerCase()));
  const samples = {};
  const byPage = new Map();
  const byDevice = { mobile: {}, desktop: {} };
  let views = 0;
  for (const r of records) {
    if (want.size && !want.has(String(r.h || '').toLowerCase())) continue;
    const q = new URLSearchParams(r.q || '');
    views++;
    const page = (q.get('p') || '/').slice(0, 200);
    const device = q.get('d') === 'm' ? 'mobile' : 'desktop';
    for (const metric of Object.keys(VITALS)) {
      const raw = q.get(metric);
      if (raw === null) continue;
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0 || value > (metric === 'CLS' ? 10 : 120_000)) continue;
      (samples[metric] ??= []).push(value);
      (byDevice[device][metric] ??= []).push(value);
      if (metric === 'LCP') {
        const p = byPage.get(page) ?? [];
        p.push(value);
        byPage.set(page, p);
      }
    }
  }
  const metrics = {};
  let weighted = 0;
  let weights = 0;
  for (const [metric, values] of Object.entries(samples)) {
    const p75 = percentile(values, 75);
    metrics[metric] = { p75: metric === 'CLS' ? round(p75, 3) : round(p75), rating: rate(metric, p75), samples: values.length };
    if (VITALS[metric].weight) {
      weighted += metricScore(metric, p75) * VITALS[metric].weight;
      weights += VITALS[metric].weight;
    }
  }
  const devices = {};
  for (const [device, m] of Object.entries(byDevice)) {
    devices[device] = Object.fromEntries(Object.entries(m).map(([k, v]) => [k, k === 'CLS' ? round(percentile(v, 75), 3) : round(percentile(v, 75))]));
  }
  return {
    views,
    score: weights ? Math.round(weighted / weights) : null,
    metrics,
    devices,
    slowestPages: [...byPage]
      .filter(([, v]) => v.length >= 3)
      .map(([page, v]) => ({ page, lcp: round(percentile(v, 75)), samples: v.length }))
      .sort((a, b) => b.lcp - a.lcp)
      .slice(0, 5)
  };
}

// ── Judging a deploy ────────────────────────────────────────────────────────
function errorStats(records) {
  const n = records.filter((r) => Number(r.s) !== 444).length;
  const e5 = records.filter((r) => Number(r.s) >= 500).length;
  return { n, e5, rate: n ? e5 / n : 0, p95: percentile(records.map(latencyMs).filter(Number.isFinite), 95) };
}

/** A canary (new release) against the stable release, on the same window. */
export function judgeCanary(records, { canary, stable, maxErrorRate = 5, minRequests = 20 }) {
  const c = errorStats(records.filter((r) => upstreamOf(r) === canary));
  const s = errorStats(records.filter((r) => upstreamOf(r) === stable));
  const facts = { canary: c, stable: s };
  if (c.n < minRequests) return { verdict: 'ok', reason: `only ${c.n} requests reached the new release; not enough to judge`, ...facts };
  if (c.rate * 100 >= maxErrorRate && c.rate > 2 * s.rate + 0.01) {
    return { verdict: 'bad', reason: `${round(c.rate * 100, 1)}% of ${c.n} requests failed on the new release (old release: ${round(s.rate * 100, 1)}%)`, ...facts };
  }
  if (s.n >= minRequests && c.p95 !== null && s.p95 !== null && c.p95 > Math.max(1000, 3 * s.p95)) {
    return { verdict: 'bad', reason: `the new release is slower: p95 ${round(c.p95)} ms against ${round(s.p95)} ms`, ...facts };
  }
  return { verdict: 'ok', reason: `${c.n} requests, ${round(c.rate * 100, 1)}% errors (old release: ${round(s.rate * 100, 1)}%)`, ...facts };
}

/** Everything since a deploy against the hour before it. */
export function judgeDeploy(after, before, { maxErrorRate = 5, minRequests = 20 } = {}) {
  const a = errorStats(after);
  const b = errorStats(before);
  if (a.n < minRequests) return { verdict: 'ok', reason: `only ${a.n} requests since the deploy`, after: a, before: b };
  if (a.rate * 100 >= maxErrorRate && a.rate > 2 * b.rate + 0.01) {
    return { verdict: 'bad', reason: `${round(a.rate * 100, 1)}% of ${a.n} requests failed since the deploy (before it: ${round(b.rate * 100, 1)}%)`, after: a, before: b };
  }
  return { verdict: 'ok', reason: `${a.n} requests, ${round(a.rate * 100, 1)}% errors`, after: a, before: b };
}

// ── Reports ─────────────────────────────────────────────────────────────────
export function incidentReport({ app, release, reason, since, records }) {
  const s = summarize(records, { since });
  const perMinute = new Map();
  for (const r of records) {
    const m = new Date(Math.floor(r.time / 6e4) * 6e4).toISOString().slice(11, 16);
    const v = perMinute.get(m) ?? { n: 0, e5: 0 };
    v.n++;
    if (Number(r.s) >= 500) v.e5++;
    perMinute.set(m, v);
  }
  const lines = [
    `# Incident: ${app}`,
    '',
    `**What happened:** ${reason}`,
    '',
    `- Release: \`${release}\``,
    `- Window: ${new Date(since).toISOString()} to ${new Date().toISOString()}`,
    `- Requests: ${s.requests}, server errors: ${s.statuses['5xx']} (${s.errorRate}%), p95 ${s.latency.p95 ?? '-'} ms`,
    '',
    '## Where it failed',
    '',
    '| Route | Status | Requests |',
    '|---|---|---|',
    ...(s.errors.length ? s.errors.map((e) => `| \`${e.path}\` | ${e.status} | ${e.n} |`) : ['| (no server errors in the logs) | | |']),
    '',
    '## Minute by minute',
    '',
    '| Minute (UTC) | Requests | Errors |',
    '|---|---|---|',
    ...[...perMinute].slice(-30).map(([m, v]) => `| ${m} | ${v.n} | ${v.e5} |`),
    ''
  ];
  return lines.join('\n');
}

const fmtBytes = (n) => (n > 1e9 ? `${round(n / 1e9, 2)} GB` : n > 1e6 ? `${round(n / 1e6, 1)} MB` : n > 1e3 ? `${round(n / 1e3)} KB` : `${n} B`);

function printInsights(app, s) {
  const out = [];
  out.push(`${app}: ${s.requests} requests since ${s.window.since.replace('T', ' ').slice(0, 16)} UTC (${s.perMinute}/min)`);
  out.push(`  status      2xx ${s.statuses['2xx']}  3xx ${s.statuses['3xx']}  4xx ${s.statuses['4xx']}  5xx ${s.statuses['5xx']}  (errors ${s.errorRate}%)`);
  out.push(`  speed       p50 ${s.latency.p50 ?? '-'} ms  p95 ${s.latency.p95 ?? '-'} ms  p99 ${s.latency.p99 ?? '-'} ms`);
  out.push(`  sent        ${fmtBytes(s.bytes)}`);
  if (s.cacheHitRate !== null) out.push(`  edge cache  ${s.cacheHitRate}% served from cache (${Object.entries(s.cache).map(([k, v]) => `${k} ${v}`).join(', ')})`);
  out.push(`  shield      ${s.shield.refused} scanner requests refused, ${s.shield.limited} rate-limited`);
  if (s.topPaths.length) out.push('  busiest', ...s.topPaths.slice(0, 5).map((p) => `    ${String(p.n).padStart(7)}  ${p.path}`));
  if (s.slowest.length) out.push('  slowest (p95)', ...s.slowest.map((p) => `    ${String(p.p95).padStart(5)} ms  ${p.path}`));
  if (s.errors.length) out.push('  server errors', ...s.errors.map((e) => `    ${String(e.n).padStart(7)}  ${e.status} ${e.path}`));
  if (s.notFound.length) out.push('  not found', ...s.notFound.slice(0, 5).map((e) => `    ${String(e.n).padStart(7)}  ${e.path}`));
  return out.join('\n');
}

function printAnalytics(app, a) {
  const out = [`${app}: ${a.visitors} visitors, ${a.pageviews} page views (bots left out: ${a.botRequests} requests)`];
  if (a.perDay.length) out.push('  per day', ...a.perDay.map((d) => `    ${d.day}  ${d.visitors}`));
  if (a.topPages.length) out.push('  top pages', ...a.topPages.map((p) => `    ${String(p.n).padStart(7)}  ${p.path}`));
  if (a.referrers.length) out.push('  referrers', ...a.referrers.map((r) => `    ${String(r.n).padStart(7)}  ${r.host}`));
  out.push(`  devices     ${Object.entries(a.devices).map(([k, v]) => `${k} ${v}`).join(', ') || '-'}`);
  out.push(`  browsers    ${Object.entries(a.browsers).map(([k, v]) => `${k} ${v}`).join(', ') || '-'}`);
  return out.join('\n');
}

function printVitals(app, v) {
  const out = [`${app}: Core Web Vitals from ${v.views} page views${v.score !== null ? ` — experience score ${v.score}/100` : ''}`];
  for (const [metric, m] of Object.entries(v.metrics)) {
    out.push(`  ${metric.padEnd(5)} p75 ${String(m.p75).padStart(6)}${VITALS[metric].unit}  ${m.rating}  (${m.samples} samples)`);
  }
  if (!v.views) out.push('  no measurements yet: they arrive as real visitors use the site');
  if (v.slowestPages.length) out.push('  slowest pages (LCP p75)', ...v.slowestPages.map((p) => `    ${String(p.lcp).padStart(6)} ms  ${p.page}`));
  return out.join('\n');
}

// ── CLI ─────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json' || a === '--report') args[a.slice(2)] = true;
    else if (a === '-n') args.n = Number(argv[++i]);
    else if (a.startsWith('--')) args[a.slice(2)] = argv[++i];
    else args._.push(a);
  }
  return args;
}

async function main(argv) {
  const args = parseArgs(argv);
  const cmd = args._[0];
  const app = args.app ?? 'app';
  const print = (obj, text) => console.log(args.json ? JSON.stringify(obj, null, 2) : text);

  if (cmd === 'insights') {
    const since = parseSince(args.since ?? '24h');
    const s = summarize(await collect(args.log, { since }), { since });
    print(s, printInsights(app, s));
  } else if (cmd === 'analytics') {
    const since = parseSince(args.since ?? '7d');
    const a = analyze(await collect(args.log, { since }));
    print(a, printAnalytics(app, a));
  } else if (cmd === 'vitals') {
    const since = parseSince(args.since ?? '7d');
    const v = vitalsOf(await collect(args.log, { since }), String(args.hosts ?? '').split(/\s+/).filter(Boolean));
    print(v, printVitals(app, v));
  } else if (cmd === 'canary') {
    const since = parseSince(args.since);
    const j = judgeCanary(await collect(args.log, { since }), {
      canary: args.canary,
      stable: args.stable,
      maxErrorRate: Number(args['max-error-rate'] ?? 5),
      minRequests: Number(args['min-requests'] ?? 20)
    });
    if (args.report) {
      const f = (x) => `${x.n} requests, ${round(x.rate * 100, 1)}% errors, p95 ${x.p95 === null ? '-' : round(x.p95)} ms`;
      console.log(`new release: ${f(j.canary)}\nold release: ${f(j.stable)}\nverdict so far: ${j.verdict} (${j.reason})`);
    } else console.log(`${j.verdict} ${j.reason}`);
  } else if (cmd === 'autopilot') {
    const since = parseSince(args.since);
    const after = await collect(args.log, { since });
    const before = await collect(args.log, { since: since - 3600_000, until: since });
    const j = judgeDeploy(after, before, { maxErrorRate: Number(args['max-error-rate'] ?? 5), minRequests: Number(args['min-requests'] ?? 20) });
    console.log(`${j.verdict} ${j.reason}`);
  } else if (cmd === 'incident') {
    const since = parseSince(args.since);
    console.log(incidentReport({ app, release: args.release ?? '?', reason: args.reason ?? 'unknown', since, records: await collect(args.log, { since }) }));
  } else if (cmd === 'events') {
    const n = args.n ?? 30;
    const events = (await collect(args.events, { since: 0 })).filter((e) => !args.app || e.app === args.app).slice(-n);
    if (args.json) console.log(JSON.stringify(events, null, 2));
    else if (!events.length) console.log('no events yet');
    else for (const e of events) console.log(`${e.t.replace('T', ' ').slice(0, 19)}  ${(e.app || '-').padEnd(12)} ${e.type.padEnd(16)} ${e.msg}`);
  } else {
    console.error('usage: insights.mjs insights|analytics|vitals|canary|autopilot|incident|events --log <file> ...');
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(`insights: ${err.message}`);
    process.exitCode = 1;
  });
}
