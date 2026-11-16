#!/usr/bin/env node
// V-Gruvs crons, Vercel style: "crons" in vercel.json, e.g.
//   { "crons": [{ "path": "/api/daily-report", "schedule": "0 5 * * *" }] }
// plus CRONS in the app's conf: "*/5 * * * * /api/cleanup; 0 3 * * 1 /api/weekly".
// Schedules are standard five-field cron expressions, evaluated in UTC.
//
//   cron.mjs due  --vercel-json <file> --extra "<crons>" --now <ISO>   paths due this minute
//   cron.mjs list --vercel-json <file> --extra "<crons>"               schedules and next runs

import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const FIELDS = [
  { name: 'minute', min: 0, max: 59 },
  { name: 'hour', min: 0, max: 23 },
  { name: 'day of month', min: 1, max: 31 },
  { name: 'month', min: 1, max: 12, names: ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] },
  { name: 'day of week', min: 0, max: 7, names: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] }
];

function value(field, token) {
  const named = field.names?.indexOf(token.toLowerCase());
  if (named !== undefined && named >= 0) return named + (field.name === 'month' ? 1 : 0);
  if (!/^\d+$/.test(token)) throw new Error(`"${token}" is not a valid ${field.name}`);
  const n = Number(token);
  if (n < field.min || n > field.max) throw new Error(`${field.name} ${n} is out of range ${field.min}-${field.max}`);
  return n;
}

// One field (every-15 steps, "1-5", "mon,wed", "0") -> the set of values it allows.
function parseField(field, text) {
  const allowed = new Set();
  for (const part of text.split(',')) {
    const [range, stepText] = part.split('/');
    const step = stepText === undefined ? 1 : Number(stepText);
    if (!Number.isInteger(step) || step < 1) throw new Error(`bad step in "${part}"`);
    let lo;
    let hi;
    if (range === '*') {
      lo = field.min;
      hi = field.max;
    } else if (range.includes('-')) {
      [lo, hi] = range.split('-').map((t) => value(field, t));
    } else {
      lo = value(field, range);
      hi = stepText === undefined ? lo : field.max;
    }
    if (lo > hi) throw new Error(`bad range "${range}"`);
    for (let v = lo; v <= hi; v += step) allowed.add(field.name === 'day of week' && v === 7 ? 0 : v);
  }
  return allowed;
}

export function parseSchedule(expr) {
  const parts = String(expr).trim().split(/\s+/);
  if (parts.length !== 5) throw new Error(`"${expr}" needs five fields: minute hour day-of-month month day-of-week`);
  const sets = parts.map((p, i) => parseField(FIELDS[i], p));
  return { expr, sets, domAny: parts[2] === '*', dowAny: parts[4] === '*' };
}

/** Whether a schedule fires in the minute of `date` (UTC). */
export function matches(schedule, date) {
  const s = typeof schedule === 'string' ? parseSchedule(schedule) : schedule;
  const [min, hour, dom, month, dow] = s.sets;
  if (!min.has(date.getUTCMinutes()) || !hour.has(date.getUTCHours()) || !month.has(date.getUTCMonth() + 1)) return false;
  const domOk = dom.has(date.getUTCDate());
  const dowOk = dow.has(date.getUTCDay());
  // As in cron: when both day fields are restricted, either one may match.
  if (!s.domAny && !s.dowAny) return domOk || dowOk;
  return domOk && dowOk;
}

export function nextRun(schedule, from = new Date()) {
  const s = typeof schedule === 'string' ? parseSchedule(schedule) : schedule;
  const t = new Date(Math.floor(from.getTime() / 60_000) * 60_000 + 60_000);
  for (let i = 0; i < 366 * 24 * 60; i++, t.setTime(t.getTime() + 60_000)) {
    if (matches(s, t)) return new Date(t);
  }
  return null;
}

/** Jobs from vercel.json and the conf's CRONS, each { schedule, path, source }. */
export function loadJobs({ vercelJson, extra = '' }) {
  const jobs = [];
  if (vercelJson && existsSync(vercelJson)) {
    const config = JSON.parse(readFileSync(vercelJson, 'utf8'));
    for (const c of config.crons ?? []) jobs.push({ schedule: c.schedule, path: c.path, source: 'vercel.json' });
  }
  for (const item of String(extra).split(/[;\n]/).map((s) => s.trim()).filter(Boolean)) {
    const parts = item.split(/\s+/);
    if (parts.length < 6) throw new Error(`CRONS entry "${item}" needs a schedule and a path`);
    jobs.push({ schedule: parts.slice(0, 5).join(' '), path: parts.slice(5).join(' '), source: 'CRONS' });
  }
  for (const j of jobs) {
    if (!/^\/[^\s]*$/.test(j.path)) throw new Error(`cron path "${j.path}" must start with /`);
    parseSchedule(j.schedule);
  }
  return jobs;
}

function main(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[++i];
    else args._.push(argv[i]);
  }
  const jobs = loadJobs({ vercelJson: args['vercel-json'], extra: args.extra ?? '' });
  if (args._[0] === 'due') {
    const now = args.now ? new Date(args.now) : new Date();
    for (const j of jobs) if (matches(j.schedule, now)) console.log(j.path);
  } else if (args._[0] === 'list') {
    if (!jobs.length) console.log('no crons (add "crons" to vercel.json, or CRONS to the app conf)');
    for (const j of jobs) {
      const next = nextRun(j.schedule);
      console.log(`${j.schedule.padEnd(16)} ${j.path.padEnd(32)} next ${next ? next.toISOString().slice(0, 16).replace('T', ' ') : 'never'} UTC  (${j.source})`);
    }
  } else {
    console.error('usage: cron.mjs due|list --vercel-json <file> --extra "<crons>" [--now <ISO>]');
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2));
  } catch (err) {
    console.error(`cron: ${err.message}`);
    process.exitCode = 1;
  }
}
