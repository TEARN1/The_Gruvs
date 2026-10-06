#!/usr/bin/env node
// V-Gruvs functions runtime.
//
// Runs Vercel-style web functions on the droplet, so an app that deploys to
// Vercel deploys here unchanged:
//
//   api/<name>.js  exporting  GET / POST / ... (request: Request) => Response
//                  or        default (request: Request) => Response
//   vercel.json    "rewrites": [{ "source": "/verify/:id", "destination": "/api/verify-dossier?id=:id" }]
//
// nginx serves every file that exists in the static directory itself and
// proxies everything else here. This process then applies the rewrites, runs
// the matching function, or falls back to the app's index.html (single-page
// apps), which is what Vercel does for the same project.
//
//   node functions-server.mjs --dir <release> [--static dist] [--port 3200] [--host 127.0.0.1]
//
// No dependencies: Node 20+ has fetch, Request and Response built in.

import http from 'node:http';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const MAX_BODY = 1024 * 1024; // 1 MB, as on Vercel's hobby plan
const TIMEOUT_MS = Number(process.env.VGRUVS_FUNCTION_TIMEOUT_MS ?? 10_000);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml'
};

export function parseArgs(argv) {
  const args = { dir: process.cwd(), static: 'dist', port: 3200, host: '127.0.0.1' };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    if (key in args) args[key] = key === 'port' ? Number(argv[++i]) : argv[++i];
  }
  return args;
}

/** "/verify/:id" -> a matcher that returns { id } for "/verify/EA-1". Supports :name, :name* and (.*). */
export function compileSource(source) {
  const names = [];
  const pattern = source
    .split('/')
    .map((part) => {
      const param = part.match(/^:(\w+)(\*|\+)?$/);
      if (param) {
        names.push(param[1]);
        return param[2] ? '(.+)' : '([^/]+)';
      }
      if (part === '(.*)') {
        names.push(String(names.length));
        return '(.*)';
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  const re = new RegExp(`^${pattern}/?$`);
  return (path) => {
    const m = re.exec(path);
    if (!m) return null;
    return Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(m[i + 1])]));
  };
}

/** The rewrites from the release's vercel.json, compiled. */
export function loadRewrites(dir) {
  const file = join(dir, 'vercel.json');
  if (!existsSync(file)) return [];
  const config = JSON.parse(readFileSync(file, 'utf8'));
  return (config.rewrites ?? []).map((r) => ({ match: compileSource(r.source), destination: r.destination }));
}

/** Applies the first matching rewrite; returns the new path + query, or null. */
export function rewrite(rewrites, pathname, search) {
  for (const r of rewrites) {
    const params = r.match(pathname);
    if (!params) continue;
    let dest = r.destination;
    for (const [k, v] of Object.entries(params)) dest = dest.replaceAll(`:${k}`, encodeURIComponent(v));
    const url = new URL(dest, 'http://x');
    // The original query string is kept, as Vercel does; the rewrite's own wins.
    for (const [k, v] of new URLSearchParams(search)) if (!url.searchParams.has(k)) url.searchParams.append(k, v);
    return url.pathname + url.search;
  }
  return null;
}

export function listFunctions(dir) {
  const apiDir = join(dir, 'api');
  if (!existsSync(apiDir)) return [];
  return readdirSync(apiDir)
    .filter((f) => /\.(m?js)$/.test(f))
    .map((f) => f.replace(/\.m?js$/, ''));
}

/** Reads the request body, refusing more than MAX_BODY. */
function readBody(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('body too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolveBody(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * The public URL of a request. nginx on the same machine is the only client,
 * so its X-Forwarded-* headers are trusted; anything else sees plain http.
 */
function publicUrl(req, path) {
  const fromProxy = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '');
  const proto = fromProxy ? (req.headers['x-forwarded-proto'] ?? 'http') : 'http';
  const host = (fromProxy && req.headers['x-forwarded-host']) || req.headers.host || 'localhost';
  return new URL(path, `${proto}://${host}`);
}

export function createServer({ dir, static: staticDir = 'dist' }) {
  const root = resolve(dir);
  const staticRoot = resolve(root, staticDir);
  const rewrites = loadRewrites(root);
  const functions = new Set(listFunctions(root));
  const modules = new Map();
  let release = 'unknown';
  try {
    release = readFileSync(join(root, '.vgruvs-release'), 'utf8').split('\n')[0].trim() || release;
  } catch {
    // Not deployed by V-Gruvs (e.g. a local run).
  }

  async function loadFunction(name) {
    if (!modules.has(name)) {
      const file = existsSync(join(root, 'api', `${name}.mjs`)) ? `${name}.mjs` : `${name}.js`;
      modules.set(name, import(pathToFileURL(join(root, 'api', file)).href));
    }
    return modules.get(name);
  }

  function sendFile(res, file, method, cacheControl) {
    const body = readFileSync(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': cacheControl, 'Content-Length': body.length });
    res.end(method === 'HEAD' ? undefined : body);
  }

  /** A file inside the static root, or null; never escapes it. */
  function staticFile(pathname) {
    const file = normalize(join(staticRoot, decodeURIComponent(pathname)));
    if (file !== staticRoot && !file.startsWith(staticRoot + sep)) return null;
    try {
      return statSync(file).isFile() ? file : null;
    } catch {
      return null;
    }
  }

  async function runFunction(name, req, res, url) {
    const mod = await loadFunction(name);
    const handler = mod[req.method] ?? (req.method === 'HEAD' ? mod.GET : undefined) ?? mod.default?.fetch ?? mod.default;
    if (typeof handler !== 'function') {
      const allowed = METHODS.filter((m) => typeof mod[m] === 'function').join(', ');
      res.writeHead(405, { Allow: allowed, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'method not allowed' }));
      return;
    }
    const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await readBody(req);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
    const request = new Request(url, { method: req.method, headers, body });

    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error('function timed out'), { status: 504 })), TIMEOUT_MS);
    });
    try {
      const response = await Promise.race([handler(request), timeout]);
      const out = {};
      response.headers.forEach((v, k) => {
        if (k !== 'set-cookie') out[k] = v;
      });
      const cookies = response.headers.getSetCookie?.() ?? [];
      if (cookies.length) out['set-cookie'] = cookies;
      const buf = Buffer.from(await response.arrayBuffer());
      res.writeHead(response.status, out);
      res.end(req.method === 'HEAD' ? undefined : buf);
    } finally {
      clearTimeout(timer);
    }
  }

  return http.createServer(async (req, res) => {
    const started = Date.now();
    try {
      let url = publicUrl(req, req.url ?? '/');
      if (url.pathname === '/_vgruvs/health') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ ok: true, release, functions: [...functions] }));
        return;
      }

      const rewritten = rewrite(rewrites, url.pathname, url.search);
      if (rewritten) url = new URL(rewritten, url);

      const fn = url.pathname.match(/^\/api\/([A-Za-z0-9_-]+)\/?$/);
      if (fn && functions.has(fn[1])) {
        await runFunction(fn[1], req, res, url);
      } else if (url.pathname.startsWith('/api/')) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'no such function' }));
      } else if (!['GET', 'HEAD'].includes(req.method ?? '')) {
        res.writeHead(405, { Allow: 'GET, HEAD' });
        res.end();
      } else {
        // A rewrite to a static file, or the single-page app's fallback.
        const file = staticFile(url.pathname) ?? staticFile('/index.html');
        if (!file) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('not found');
        } else {
          sendFile(res, file, req.method, file.endsWith('index.html') ? 'no-cache' : 'public, max-age=300');
        }
      }
    } catch (err) {
      const status = err.status ?? 500;
      console.error(`[vgruvs] ${req.method} ${req.url} failed:`, err);
      if (!res.headersSent) res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error: status === 504 ? 'function timed out' : status === 413 ? 'request body too large' : 'internal error' }));
    } finally {
      console.log(`[vgruvs] ${req.method} ${req.url} ${res.statusCode} ${Date.now() - started}ms`);
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const server = createServer(args);
  server.listen(args.port, args.host, () => {
    console.log(`[vgruvs] functions for ${resolve(args.dir)} on http://${args.host}:${args.port}`);
  });
  // systemd stops with SIGTERM: finish in-flight requests, then exit.
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
}
