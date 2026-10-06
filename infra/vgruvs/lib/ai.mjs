#!/usr/bin/env node
// V-Gruvs AI incident analysis (opt-in). When the autopilot rolls a deploy
// back or a rollout is stopped, it writes an incident report; with
// /etc/vgruvs/ai.env present, this sends that report to Claude and appends
// a plain-language root-cause analysis to it.
//
//   /etc/vgruvs/ai.env (mode 600):
//     ANTHROPIC_API_KEY=sk-ant-...
//     AI_MODEL=claude-opus-5-5      optional
//     AI_EFFORT=high                optional: low | medium | high | xhigh | max
//
//   ai.mjs --etc /etc/vgruvs --incident /var/lib/vgruvs/incidents/<file>.md
//
// What is sent: only the report itself. It holds aggregate numbers per route
// and the app's output with query strings and IP addresses removed; it never
// holds visitor addresses, cookies or request bodies.
//
// Raw HTTP on purpose: the droplet's V-Gruvs tools have no npm dependencies.

import { appendFileSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readConf } from './notify.mjs';

const API = process.env.VGRUVS_AI_URL || 'https://api.anthropic.com/v1/messages'; // overridable for tests
const DEFAULT_MODEL = 'claude-opus-5-5';
// Models that take server-side fallbacks in the "default" form.
const FALLBACK_MODELS = new Set(['claude-fable-5-1', 'claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5']);
const MAX_REPORT_BYTES = 200_000;

const SYSTEM = `You are the on-call engineer for V-Gruvs, a small self-hosted platform on one DigitalOcean droplet (nginx in front; static sites, a Vercel-style functions runtime, and Next.js standalone servers, deployed blue/green).
A deploy was just rolled back automatically, or a staged rollout was stopped, because errors rose on real traffic. You get the incident report: the reason, server errors per route, a minute-by-minute count, and the app's own output.
Write for the site's owner, who is not a full-time engineer:
1. What most likely went wrong, in one or two sentences.
2. The evidence in the report that points there.
3. What to check or change before deploying again, as a short list.
Say plainly when the report is not enough to tell, and what to look at next (for example: vgruvs logs <app>, vgruvs insights <app>). Keep it under 250 words.`;

export function buildRequest({ model, effort, report }) {
  const body = {
    model,
    max_tokens: 16000,
    output_config: { effort },
    system: SYSTEM,
    messages: [{ role: 'user', content: report }]
  };
  const headers = { 'content-type': 'application/json', 'anthropic-version': '2023-06-01' };
  if (FALLBACK_MODELS.has(model)) {
    // On a safety decline, the API re-runs the request on Anthropic's
    // recommended model for that category instead of returning the refusal.
    body.fallbacks = 'default';
    headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
  }
  return { headers, body };
}

/** The text of a Messages API response, or an explanation of why there is none. */
export function analysisFrom(response) {
  if (response.stop_reason === 'refusal') {
    const category = response.stop_details?.category;
    return { ok: false, text: `The model declined to analyse this report${category ? ` (${category})` : ''}.` };
  }
  const text = (response.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
  if (!text) return { ok: false, text: 'The model returned no analysis.' };
  if (response.stop_reason === 'max_tokens') return { ok: true, text: `${text}\n\n(The analysis was cut off at its length limit.)` };
  return { ok: true, text };
}

async function main(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[++i];
  const conf = readConf(join(args.etc ?? '/etc/vgruvs', 'ai.env'));
  if (!conf.ANTHROPIC_API_KEY) throw new Error('no ANTHROPIC_API_KEY in ai.env');
  const file = args.incident;
  if (statSync(file).size > MAX_REPORT_BYTES) {
    appendFileSync(file, `\n## AI analysis\n\nSkipped: the report is larger than ${MAX_REPORT_BYTES / 1000} KB.\n`);
    return;
  }
  const report = readFileSync(file, 'utf8');
  const model = conf.AI_MODEL || DEFAULT_MODEL;
  const { headers, body } = buildRequest({ model, effort: conf.AI_EFFORT || 'high', report });
  headers['x-api-key'] = conf.ANTHROPIC_API_KEY;

  let section;
  try {
    const res = await fetch(API, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(180_000) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      section = `The analysis request failed: HTTP ${res.status}${json?.error?.type ? ` (${json.error.type})` : ''}.`;
    } else {
      const { text } = analysisFrom(json);
      const served = json.model && json.model !== model ? ` (answered by ${json.model})` : '';
      section = `${text}\n\n_Model: ${model}${served}._`;
    }
  } catch (err) {
    section = `The analysis request failed: ${err.name === 'TimeoutError' ? 'no answer within 3 minutes' : err.message}.`;
  }
  appendFileSync(file, `\n## AI analysis (${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC)\n\n${section}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(`ai: ${err.message}`);
    process.exitCode = 1;
  });
}
