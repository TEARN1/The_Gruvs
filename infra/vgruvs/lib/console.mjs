#!/usr/bin/env node
// The V-Gruvs console: one page with every app's health, releases, rollouts,
// traffic, speed and the platform's events. Written as static files (no
// server, nothing to attack) by `vgruvs console build`, after every deploy
// and every few minutes by the heal timer.
//
//   console.mjs --root /srv/vgruvs --etc /etc/vgruvs --state /var/lib/vgruvs
//               --logs /var/log/nginx/vgruvs --out /srv/vgruvs/_console [--certs /etc/letsencrypt/live]

import { X509Certificate } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, readlinkSync, renameSync, statSync, statfsSync, writeFileSync } from 'node:fs';
import { hostname, loadavg, uptime } from 'node:os';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { analyze, collect, summarize, vitalsOf } from './insights.mjs';
import { readConf } from './notify.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const safeRead = (f) => {
  try {
    return readFileSync(f, 'utf8');
  } catch {
    return '';
  }
};

function ago(iso, now = Date.now()) {
  const t = typeof iso === 'number' ? iso : Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

const num = (n) => (n === null || n === undefined ? '–' : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : String(n));
const bytes = (n) => (n > 1e9 ? `${(n / 1e9).toFixed(1)} GB` : n > 1e6 ? `${(n / 1e6).toFixed(0)} MB` : `${Math.round(n / 1e3)} KB`);

// ── Gathering ───────────────────────────────────────────────────────────────
function releasesOf(root, app) {
  const dir = join(root, app, 'releases');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((r) => !r.endsWith('.tmp'))
    .map((r) => {
      const meta = safeRead(join(dir, r, '.vgruvs-release')).split('\n');
      let mtime = 0;
      try {
        mtime = statSync(join(dir, r)).mtimeMs;
      } catch {
        // pruned meanwhile
      }
      return { id: r, deployed: meta[1] || '', mtime };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

function currentOf(root, app) {
  try {
    return basename(readlinkSync(join(root, app, 'current')));
  } catch {
    return null;
  }
}

async function healthOf(conf, root, app, slot) {
  if (conf.APP_TYPE === 'static') return existsSync(join(root, app, 'current', 'index.html')) ? 'ok' : 'down';
  const port = slot === 'b' ? conf.PORT_B : conf.PORT_A;
  try {
    const res = await fetch(`http://127.0.0.1:${port}${conf.HEALTH_PATH || '/'}`, { redirect: 'manual', signal: AbortSignal.timeout(2500) });
    return res.status < 400 ? 'ok' : 'down';
  } catch {
    return 'down';
  }
}

function server(root) {
  const mem = {};
  for (const line of safeRead('/proc/meminfo').split('\n')) {
    const m = /^(\w+):\s+(\d+)/.exec(line);
    if (m) mem[m[1]] = Number(m[2]) * 1024;
  }
  let disk = null;
  try {
    const s = statfsSync(root);
    disk = { total: s.blocks * s.bsize, free: s.bavail * s.bsize };
  } catch {
    // not available
  }
  return {
    host: hostname(),
    uptime: uptime(),
    load: loadavg().map((n) => Math.round(n * 100) / 100),
    memTotal: mem.MemTotal ?? null,
    memAvailable: mem.MemAvailable ?? null,
    swapTotal: mem.SwapTotal ?? 0,
    swapFree: mem.SwapFree ?? 0,
    disk
  };
}

function certs(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const pem = safeRead(join(dir, name, 'fullchain.pem'));
    const first = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/.exec(pem);
    if (!first) continue;
    try {
      const validTo = Date.parse(new X509Certificate(first[0]).validTo);
      out.push({ name, validTo: new Date(validTo).toISOString(), days: Math.floor((validTo - Date.now()) / 864e5) });
    } catch {
      // not a certificate
    }
  }
  return out.sort((a, b) => a.days - b.days);
}

export async function gather({ root, etc, state, logs, certDir = '/etc/letsencrypt/live' }) {
  const appsDir = join(etc, 'apps');
  const names = existsSync(appsDir) ? readdirSync(appsDir).filter((f) => f.endsWith('.conf')).map((f) => f.slice(0, -5)).sort() : [];
  const since24 = Date.now() - 864e5;
  const vitalsLog = await collect(join(logs, 'vitals.log'), { since: Date.now() - 7 * 864e5 });
  const apps = [];
  for (const name of names) {
    const conf = readConf(join(appsDir, `${name}.conf`));
    const domains = String(conf.DOMAINS || '').split(/\s+/).filter(Boolean);
    const slot = safeRead(join(root, name, 'active-slot')).trim() || 'a';
    const rolloutText = safeRead(join(root, name, 'rollout'));
    let rollout = null;
    if (rolloutText) {
      const r = Object.fromEntries(rolloutText.split('\n').map((l) => /^(\w+)=(.*)$/.exec(l)).filter(Boolean).map((m) => [m[1], m[2].replace(/^"|"$/g, '')]));
      const steps = (r.R_STEPS || '').split(/\s+/).filter(Boolean);
      rollout = { release: r.R_RELEASE, previous: r.R_PREVIOUS, percent: Number(steps[Number(r.R_INDEX) || 0] ?? 100), steps, started: Number(r.R_STARTED) * 1000 };
    }
    const records = await collect(join(logs, `${name}.log`), { since: since24 });
    apps.push({
      name,
      type: conf.APP_TYPE,
      domains,
      current: currentOf(root, name),
      releases: releasesOf(root, name).slice(0, 6),
      health: await healthOf(conf, root, name, slot),
      maintenance: existsSync(join(root, name, 'maintenance')) ? safeRead(join(root, name, 'maintenance')).trim() : null,
      rollout,
      rolloutConfig: conf.ROLLOUT || '',
      traffic: summarize(records, { since: since24 }),
      visitors: analyze(records),
      vitals: vitalsOf(vitalsLog, domains)
    });
  }
  const events = (await collect(join(state, 'events.jsonl'), { since: 0 })).slice(-60).reverse();
  const incidentsDir = join(state, 'incidents');
  const incidents = existsSync(incidentsDir) ? readdirSync(incidentsDir).filter((f) => f.endsWith('.md')).sort().reverse().slice(0, 5) : [];
  const blocklist = safeRead(join(etc, 'shield', 'blocklist')).split('\n').filter((l) => l.trim() && !l.startsWith('#'));
  return {
    generated: new Date().toISOString(),
    server: server(root),
    certs: certs(certDir),
    shield: { attack: existsSync(join(etc, 'shield', 'attack')), blocked: blocklist.length },
    apps,
    events,
    incidents
  };
}

// ── Rendering ───────────────────────────────────────────────────────────────
function sparkline(series) {
  if (!series?.length || !series.some((p) => p.n)) return '<p class="quiet spark-empty">No requests in the last 24 hours.</p>';
  const w = 280;
  const h = 44;
  const max = Math.max(1, ...series.map((p) => p.n));
  const bw = w / series.length;
  const bars = series
    .map((p, i) => {
      const bh = (p.n / max) * (h - 4);
      const eh = (p.e5 / max) * (h - 4);
      return `<rect x="${(i * bw + 1).toFixed(1)}" y="${(h - bh).toFixed(1)}" width="${Math.max(1, bw - 2).toFixed(1)}" height="${bh.toFixed(1)}" rx="1.5" fill="var(--accent)" opacity=".75"/>` +
        (p.e5 ? `<rect x="${(i * bw + 1).toFixed(1)}" y="${(h - eh).toFixed(1)}" width="${Math.max(1, bw - 2).toFixed(1)}" height="${Math.max(1.5, eh).toFixed(1)}" rx="1.5" fill="var(--bad)"/>` : '');
    })
    .join('');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Requests over the last 24 hours, errors in red">${bars}</svg>`;
}

const VITAL_UNITS = { LCP: 'ms', INP: 'ms', CLS: '', FCP: 'ms', TTFB: 'ms' };
function vitalChips(v) {
  if (!v?.views) return '<p class="quiet">Web Vitals arrive as real visitors use the site.</p>';
  const chips = ['LCP', 'INP', 'CLS']
    .filter((m) => v.metrics[m])
    .map((m) => `<span class="chip ${v.metrics[m].rating}"><b>${m}</b> ${esc(v.metrics[m].p75)}${VITAL_UNITS[m]}</span>`)
    .join('');
  return `<div class="vitals">${v.score !== null ? `<span class="score" title="Experience score from ${v.views} page views">${v.score}</span>` : ''}${chips}</div>`;
}

const TYPE_LABEL = { static: 'Static', functions: 'Functions', node: 'Node' };
const EVENT_TONE = { deploy: 'good', verified: 'good', rollout_done: 'good', deploy_failed: 'bad', auto_rollback: 'bad', rollout_abort: 'bad', cron_failed: 'bad', disk_full: 'bad', cert_expiring: 'warn', rollback: 'warn', heal_restart: 'warn', maintenance_on: 'warn', attack_on: 'warn' };

function appCard(a, now) {
  const t = a.traffic;
  const live = a.releases.find((r) => r.id === a.current);
  const status = a.maintenance ? 'warn' : a.health === 'ok' ? 'good' : a.current ? 'bad' : 'idle';
  const statusText = a.maintenance ? 'Maintenance' : a.health === 'ok' ? 'Live' : a.current ? 'Not answering' : 'Not deployed';
  const rollout = a.rollout
    ? `<div class="rollout"><div class="rollout-head"><span>Rolling out <code>${esc(a.rollout.release)}</code></span><b>${a.rollout.percent}%</b></div>
       <div class="meter"><i style="width:${a.rollout.percent}%"></i></div>
       <p class="quiet">Steps ${esc(a.rollout.steps.join(' → '))} → 100 · started ${esc(ago(a.rollout.started, now))} · <code>vgruvs rollout ${esc(a.name)} promote</code> or <code>abort</code></p></div>`
    : '';
  const releases = a.releases
    .map((r) => `<li class="${r.id === a.current ? 'is-live' : ''}"><code>${esc(r.id)}</code><span>${r.id === a.current ? 'live' : esc(ago(r.deployed || r.mtime, now))}</span>${r.id === a.current ? '' : `<code class="cmd">vgruvs rollback ${esc(a.name)} ${esc(r.id)}</code>`}</li>`)
    .join('');
  return `<article class="app">
  <header>
    <div><h2>${esc(a.name)}</h2><span class="badge">${TYPE_LABEL[a.type] ?? esc(a.type)}</span></div>
    <span class="status ${status}"><i></i>${statusText}</span>
  </header>
  <p class="domains">${a.domains.map((d) => `<a href="https://${esc(d)}" rel="noopener">${esc(d)}</a>`).join(' · ')}</p>
  <p class="release">${a.current ? `<code>${esc(a.current)}</code> <span class="quiet">live${live ? ` · deployed ${esc(ago(live.deployed || live.mtime, now))}` : ''}</span>` : '<span class="quiet">Nothing deployed yet</span>'}</p>
  ${a.maintenance ? `<p class="note warn">Maintenance page on: “${esc(a.maintenance)}”</p>` : ''}
  ${rollout}
  <dl class="stats">
    <div><dt title="Requests in the last 24 hours">Requests</dt><dd>${num(t.requests)}</dd></div>
    <div><dt>Errors</dt><dd class="${t.errorRate >= 1 ? 'bad-text' : ''}">${t.errorRate}%</dd></div>
    <div><dt>p95</dt><dd>${t.latency.p95 === null ? '–' : `${t.latency.p95} ms`}</dd></div>
    <div><dt>${t.cacheHitRate === null ? 'Visitors' : 'Edge cache'}</dt><dd>${t.cacheHitRate === null ? num(a.visitors.visitors) : `${t.cacheHitRate}%`}</dd></div>
  </dl>
  ${sparkline(t.series)}
  <div class="row"><span class="quiet">${num(a.visitors.visitors)} visitors · ${num(a.visitors.pageviews)} page views · ${bytes(t.bytes)} sent</span></div>
  ${vitalChips(a.vitals)}
  <details><summary>Releases${a.rolloutConfig ? ` · rolls out ${esc(a.rolloutConfig)} → 100%` : ''}</summary><ul class="releases">${releases || '<li class="quiet">None yet</li>'}</ul></details>
</article>`;
}

export function render(data) {
  const now = Date.parse(data.generated);
  const s = data.server;
  const memUsed = s.memTotal && s.memAvailable !== null ? 1 - s.memAvailable / s.memTotal : null;
  const diskUsed = s.disk ? 1 - s.disk.free / s.disk.total : null;
  const problems = data.apps.filter((a) => a.current && a.health !== 'ok').length + data.certs.filter((c) => c.days < 14).length;
  const pctBar = (v) => (v === null ? '' : `<div class="meter ${v > 0.9 ? 'bad' : v > 0.8 ? 'warn' : ''}"><i style="width:${Math.round(v * 100)}%"></i></div>`);
  const events = data.events
    .slice(0, 25)
    .map((e) => `<li class="${EVENT_TONE[e.type] ?? ''}"><time datetime="${esc(e.t)}">${esc(String(e.t).slice(5, 16).replace('T', ' '))}</time><span class="who">${esc(e.app || 'platform')}</span><span>${esc(e.msg)}</span></li>`)
    .join('');
  const totalReq = data.apps.reduce((a, x) => a + x.traffic.requests, 0);
  const refused = data.apps.reduce((a, x) => a + x.traffic.shield.refused, 0);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="60">
<meta name="robots" content="noindex">
<title>V-Gruvs Console</title>
<style>
:root{--bg:#06070c;--panel:#0d0f18;--panel2:#121522;--line:#1d2133;--fg:#e9ecf6;--muted:#8d93ab;--accent:#7b7bff;--accent2:#2ee6c5;--good:#38d996;--warn:#f4b04b;--bad:#ff5b6e;--idle:#5f667f;color-scheme:dark}
@media (prefers-color-scheme:light){:root{--bg:#f4f5fa;--panel:#ffffff;--panel2:#f7f8fc;--line:#e1e4ee;--fg:#141724;--muted:#5d6379;--accent:#5252e6;--accent2:#0d9e86;--good:#14935f;--warn:#b26c08;--bad:#d4253c;--idle:#9aa0b3;color-scheme:light}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:0 16px 48px;
background-image:radial-gradient(1200px 400px at 10% -10%,color-mix(in srgb,var(--accent) 18%,transparent),transparent),radial-gradient(900px 300px at 100% 0,color-mix(in srgb,var(--accent2) 10%,transparent),transparent);background-repeat:no-repeat}
.wrap{max-width:1240px;margin:0 auto}
code{font:12.5px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
a{color:inherit;text-decoration-color:color-mix(in srgb,var(--accent) 60%,transparent);text-underline-offset:3px}
.top{display:flex;flex-wrap:wrap;gap:12px 24px;align-items:center;justify-content:space-between;padding:28px 0 20px}
.brand{display:flex;align-items:center;gap:12px}
.brand svg{width:34px;height:34px}
.brand h1{font-size:20px;letter-spacing:.02em;margin:0}
.brand p{margin:0;color:var(--muted);font-size:12.5px}
.pill{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border:1px solid var(--line);border-radius:999px;background:var(--panel);font-size:13px}
.pill i,.status i{width:8px;height:8px;border-radius:50%;background:var(--good);box-shadow:0 0 10px var(--good)}
.pill.bad i{background:var(--bad);box-shadow:0 0 10px var(--bad)}
.strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:20px}
.strip>div{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 14px;min-width:0}
.label{color:var(--muted);font-size:11.5px;letter-spacing:.08em;text-transform:uppercase}
.big{font-size:20px;font-variant-numeric:tabular-nums;margin-top:2px}
.meter{height:5px;border-radius:3px;background:var(--line);margin-top:8px;overflow:hidden}
.meter i{display:block;height:100%;background:linear-gradient(90deg,var(--accent),var(--accent2));border-radius:3px}
.meter.warn i{background:var(--warn)}.meter.bad i{background:var(--bad)}
.apps{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:16px}
.app{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:18px;display:flex;flex-direction:column;gap:10px;min-width:0}
.app header{display:flex;justify-content:space-between;align-items:center;gap:8px}
.app header>div{display:flex;align-items:center;gap:10px;min-width:0}
.app h2{margin:0;font-size:17px}
.badge{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);border:1px solid var(--line);border-radius:6px;padding:2px 6px}
.status{display:inline-flex;align-items:center;gap:7px;font-size:12.5px}
.status.warn i{background:var(--warn);box-shadow:0 0 10px var(--warn)}.status.bad i{background:var(--bad);box-shadow:0 0 10px var(--bad)}.status.idle i{background:var(--idle);box-shadow:none}
.domains,.release{margin:0;overflow-wrap:anywhere}
.quiet{color:var(--muted);font-size:12.5px;margin:0}
.note{margin:0;padding:8px 10px;border-radius:8px;font-size:13px}
.note.warn{background:color-mix(in srgb,var(--warn) 14%,transparent);border:1px solid color-mix(in srgb,var(--warn) 40%,transparent)}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:4px 0 0}
.stats div{background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:8px 10px;min-width:0}
.stats dt{color:var(--muted);font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.stats dd{margin:2px 0 0;font-size:16px;font-variant-numeric:tabular-nums}
.bad-text{color:var(--bad)}
.spark{width:100%;height:44px;display:block}
.spark-empty{height:44px;display:flex;align-items:center}
.vitals{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.score{font-weight:700;font-size:13px;width:34px;height:34px;display:grid;place-items:center;border-radius:50%;border:2px solid var(--accent2)}
.chip{font-size:12px;padding:3px 8px;border-radius:999px;border:1px solid var(--line);font-variant-numeric:tabular-nums}
.chip b{font-weight:600;margin-right:4px}
.chip.good{border-color:color-mix(in srgb,var(--good) 55%,transparent);color:var(--good)}
.chip.needs-improvement{border-color:color-mix(in srgb,var(--warn) 55%,transparent);color:var(--warn)}
.chip.poor{border-color:color-mix(in srgb,var(--bad) 55%,transparent);color:var(--bad)}
.rollout{border:1px solid color-mix(in srgb,var(--accent) 45%,transparent);border-radius:10px;padding:10px;background:color-mix(in srgb,var(--accent) 8%,transparent)}
.rollout-head{display:flex;justify-content:space-between;gap:8px}
details summary{cursor:pointer;color:var(--muted);font-size:12.5px}
.releases{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:6px}
.releases li{display:grid;grid-template-columns:1fr auto;gap:2px 8px;font-size:12.5px;min-width:0}
.releases li code{overflow-wrap:anywhere}
.releases li.is-live code:first-child{color:var(--good)}
.releases .cmd{grid-column:1/-1;color:var(--muted);font-size:11.5px}
h3{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:28px 0 10px}
.grid2{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:16px}
@media (max-width:860px){.grid2{grid-template-columns:1fr}.stats{grid-template-columns:repeat(2,1fr)}}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:14px 16px;min-width:0}
.timeline{list-style:none;margin:0;padding:0;display:grid;gap:2px}
.timeline li{display:grid;grid-template-columns:96px 104px minmax(0,1fr);gap:10px;padding:6px 0;border-bottom:1px dashed var(--line);font-size:13px}
.timeline li:last-child{border-bottom:0}
.timeline time{color:var(--muted);font-variant-numeric:tabular-nums}
.timeline .who{color:var(--accent);overflow:hidden;text-overflow:ellipsis}
.timeline li.good span:last-child::before{content:"● ";color:var(--good)}
.timeline li.bad span:last-child::before{content:"● ";color:var(--bad)}
.timeline li.warn span:last-child::before{content:"● ";color:var(--warn)}
@media (max-width:560px){.timeline li{grid-template-columns:1fr}.timeline .who{display:none}}
.kv{display:grid;gap:8px;margin:0}
.kv div{display:flex;justify-content:space-between;gap:12px;font-size:13px}
.kv dt{color:var(--muted)}.kv dd{margin:0;text-align:right}
.cheats{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:6px 16px;font-size:12.5px;color:var(--muted)}
.cheats code{color:var(--fg)}
footer{margin-top:28px;color:var(--muted);font-size:12px}
</style>
</head>
<body>
<div class="wrap">
<div class="top">
  <div class="brand">
    <svg viewBox="0 0 40 40" aria-hidden="true"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="var(--accent)"/><stop offset="1" stop-color="var(--accent2)"/></linearGradient></defs><path d="M6 8 L20 33 L34 8" fill="none" stroke="url(#g)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="20" cy="20" r="17" fill="none" stroke="url(#g)" stroke-opacity=".35" stroke-width="1.5"/></svg>
    <div><h1>V-Gruvs Console</h1><p>${esc(s.host)} · updated ${esc(data.generated.slice(11, 16))} UTC · refreshes every minute</p></div>
  </div>
  <span class="pill ${problems ? 'bad' : ''}"><i></i>${problems ? `${problems} thing${problems > 1 ? 's' : ''} need${problems > 1 ? '' : 's'} attention` : 'Every app is answering'}</span>
</div>

<section class="strip" aria-label="Server">
  <div><div class="label">Memory</div><div class="big">${s.memTotal ? `${bytes(s.memTotal - s.memAvailable)} / ${bytes(s.memTotal)}` : '–'}</div>${pctBar(memUsed)}</div>
  <div><div class="label">Disk</div><div class="big">${s.disk ? `${bytes(s.disk.total - s.disk.free)} / ${bytes(s.disk.total)}` : '–'}</div>${pctBar(diskUsed)}</div>
  <div><div class="label">Load · uptime</div><div class="big">${esc(s.load[0])} · ${Math.floor(s.uptime / 86400)}d ${Math.floor((s.uptime % 86400) / 3600)}h</div></div>
  <div><div class="label">Requests · 24h</div><div class="big">${num(totalReq)}</div></div>
  <div><div class="label">Shield</div><div class="big">${data.shield.attack ? '<span class="bad-text">Attack mode</span>' : 'Normal'}</div><p class="quiet">${num(refused)} scans refused · ${data.shield.blocked} blocked</p></div>
</section>

<section class="apps" aria-label="Apps">
${data.apps.map((a) => appCard(a, now)).join('\n')}
${data.apps.length ? '' : '<p class="quiet">No apps yet. Add one with <code>vgruvs apps add</code>.</p>'}
</section>

<div class="grid2">
  <section>
    <h3>Activity</h3>
    <div class="panel"><ul class="timeline">${events || '<li><span class="quiet">Deploys, rollbacks and incidents appear here.</span></li>'}</ul></div>
  </section>
  <section>
    <h3>Certificates</h3>
    <div class="panel"><dl class="kv">${data.certs.map((c) => `<div><dt>${esc(c.name)}</dt><dd class="${c.days < 14 ? 'bad-text' : ''}">${c.days === 1 ? '1 day' : `${c.days} days`}</dd></div>`).join('') || '<p class="quiet">None found.</p>'}</dl></div>
    <h3>Incidents</h3>
    <div class="panel">${data.incidents.length ? `<dl class="kv">${data.incidents.map((f) => `<div><dt><code>${esc(f)}</code></dt></div>`).join('')}</dl><p class="quiet">In /var/lib/vgruvs/incidents on the droplet.</p>` : '<p class="quiet">No incidents. The autopilot writes a report whenever it rolls a deploy back.</p>'}</div>
  </section>
</div>

<h3>Commands</h3>
<div class="panel cheats">
  <span><code>vgruvs status</code> what is live</span>
  <span><code>vgruvs rollback &lt;app&gt;</code> undo the last deploy</span>
  <span><code>vgruvs insights &lt;app&gt;</code> traffic and errors</span>
  <span><code>vgruvs vitals &lt;app&gt;</code> real-user speed</span>
  <span><code>vgruvs maintenance &lt;app&gt; on</code> maintenance page</span>
  <span><code>vgruvs shield attack on</code> under attack</span>
  <span><code>vgruvs doctor</code> check everything</span>
  <span><code>vgruvs events</code> what happened</span>
</div>
<footer>V-Gruvs ${esc(data.version ?? '')} · a self-hosted platform for The Gruvs, Excellency and The Resident · data stays on this server</footer>
</div>
</body>
</html>
`;
}

function writeAtomic(file, content) {
  writeFileSync(`${file}.tmp`, content);
  renameSync(`${file}.tmp`, file);
}

async function main(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[++i];
  const data = await gather({
    root: args.root ?? '/srv/vgruvs',
    etc: args.etc ?? '/etc/vgruvs',
    state: args.state ?? '/var/lib/vgruvs',
    logs: args.logs ?? '/var/log/nginx/vgruvs',
    certDir: args.certs ?? process.env.VGRUVS_CERT_DIR ?? '/etc/letsencrypt/live'
  });
  data.version = '2.0.0';
  const out = args.out ?? join(args.root ?? '/srv/vgruvs', '_console');
  mkdirSync(out, { recursive: true });
  writeAtomic(join(out, 'index.html'), render(data));
  writeAtomic(join(out, 'data.json'), JSON.stringify(data, null, 2));
  console.log(join(out, 'index.html'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(`console: ${err.stack || err.message}`);
    process.exitCode = 1;
  });
}
