#!/usr/bin/env node
// V-Gruvs notifications: deploys, rollbacks and problems sent to a chat or a
// phone. Configured in /etc/vgruvs/notify.conf:
//
//   NOTIFY_URL=https://discord.com/api/webhooks/...     Discord
//   NOTIFY_URL=https://hooks.slack.com/services/...     Slack
//   NOTIFY_URL=https://ntfy.sh/<your-topic>             ntfy (phone push, free)
//   NOTIFY_URL=https://example.com/hook                 anything else: the event as JSON
//   NOTIFY_EVENTS="deploy_failed auto_rollback ..."     optional; the default is below
//
//   notify.mjs --etc /etc/vgruvs --type deploy --app thegruvs --msg "r12 is live" [--force]

import { readFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const DEFAULT_EVENTS = [
  'deploy', 'deploy_failed', 'rollback', 'auto_rollback', 'rollout_started', 'rollout_done', 'rollout_abort',
  'heal_restart', 'cert_expiring', 'disk_full', 'attack_on', 'attack_off', 'cron_failed', 'maintenance_on', 'maintenance_off'
];

const ICONS = {
  deploy: '✅', verified: '🛡️', deploy_failed: '❌', rollback: '⏪', auto_rollback: '🚨', rollout_started: '🚦', rollout_step: '🚦',
  rollout_done: '✅', rollout_abort: '🛑', heal_restart: '🩹', cert_expiring: '🔐', disk_full: '💾', attack_on: '🛡️',
  attack_off: '🛡️', cron_failed: '⏰', maintenance_on: '🚧', maintenance_off: '🚧', test: '👋'
};

/** KEY=VALUE lines, shell-style quotes allowed. */
export function readConf(file) {
  const conf = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line);
    if (!m) continue;
    conf[m[1]] = m[2].trim().replace(/^(["'])(.*)\1$/, '$2');
  }
  return conf;
}

export function kindOf(url, explicit) {
  if (explicit && explicit !== 'auto') return explicit;
  const host = new URL(url).hostname;
  if (/(^|\.)discord(app)?\.com$/.test(host)) return 'discord';
  if (host === 'hooks.slack.com') return 'slack';
  if (host === 'ntfy.sh' || host.startsWith('ntfy.')) return 'ntfy';
  return 'json';
}

/** The HTTP request for one event: { headers, body }. */
export function payload(kind, event) {
  const icon = ICONS[event.type] ?? '•';
  const title = `${icon} ${event.app ? `${event.app}: ` : ''}${event.type.replaceAll('_', ' ')}`;
  const text = `${title}\n${event.msg}\n— V-Gruvs on ${event.host}`;
  switch (kind) {
    case 'discord':
      return { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: text.slice(0, 1900), allowed_mentions: { parse: [] } }) };
    case 'slack':
      return { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) };
    case 'ntfy':
      return {
        headers: { 'content-type': 'text/plain; charset=utf-8', Title: `V-Gruvs ${event.app || event.host}`, Tags: event.type, Priority: /fail|abort|auto_rollback|disk|cert/.test(event.type) ? 'high' : 'default' },
        body: `${icon} ${event.msg}`
      };
    default:
      return { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source: 'vgruvs', ...event }) };
  }
}

async function main(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--force') args.force = true;
    else if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[++i];
  }
  const conf = readConf(join(args.etc ?? '/etc/vgruvs', 'notify.conf'));
  if (!conf.NOTIFY_URL) return;
  const wanted = conf.NOTIFY_EVENTS ? conf.NOTIFY_EVENTS.split(/[\s,]+/).filter(Boolean) : DEFAULT_EVENTS;
  if (!args.force && !wanted.includes(args.type)) return;
  const event = { type: args.type ?? 'test', app: args.app ?? '', msg: args.msg ?? '', host: hostname(), time: new Date().toISOString() };
  const { headers, body } = payload(kindOf(conf.NOTIFY_URL, conf.NOTIFY_KIND), event);
  const res = await fetch(conf.NOTIFY_URL, { method: 'POST', headers, body, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`${conf.NOTIFY_URL.replace(/\/[^/]*$/, '/…')} answered ${res.status}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(`notify: ${err.message}`);
    process.exitCode = 1;
  });
}
