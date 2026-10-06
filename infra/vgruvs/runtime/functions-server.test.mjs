// node --test infra/vgruvs/runtime/
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileSource, createServer, rewrite } from './functions-server.mjs';

let server;
let base;

before(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vgruvs-fn-'));
  mkdirSync(join(dir, 'api'));
  mkdirSync(join(dir, 'dist'));
  writeFileSync(join(dir, 'dist', 'index.html'), '<!doctype html><title>app</title>');
  writeFileSync(join(dir, 'dist', 'robots.txt'), 'ok');
  writeFileSync(join(dir, 'secret.txt'), 'outside the static root');
  writeFileSync(join(dir, '.vgruvs-release'), 'abc123\n');
  writeFileSync(
    join(dir, 'vercel.json'),
    JSON.stringify({
      rewrites: [
        { source: '/verify/:id', destination: '/api/echo?id=:id' },
        { source: '/eval/:token', destination: '/index.html' }
      ]
    })
  );
  writeFileSync(
    join(dir, 'api', 'echo.js'),
    `export async function GET(request) {
       const url = new URL(request.url);
       return Response.json({ id: url.searchParams.get('id'), q: url.searchParams.get('q'), origin: url.origin });
     }
     export async function POST(request) {
       const headers = new Headers({ 'content-type': 'application/json' });
       headers.append('set-cookie', 'a=1');
       headers.append('set-cookie', 'b=2');
       return new Response(JSON.stringify({ got: await request.json() }), { status: 201, headers });
     }`
  );
  writeFileSync(join(dir, 'api', 'boom.js'), `export async function GET() { throw new Error('secret detail'); }`);
  writeFileSync(join(dir, 'api', 'plain.js'), `export default async function (request) { return new Response('plain ' + request.method); }`);
  server = createServer({ dir, static: 'dist' });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

test('compiles Vercel-style sources', () => {
  assert.deepEqual(compileSource('/verify/:id')('/verify/EA-2026-00001'), { id: 'EA-2026-00001' });
  assert.equal(compileSource('/verify/:id')('/verify/a/b'), null);
  assert.deepEqual(compileSource('/docs/:path*')('/docs/a/b'), { path: 'a/b' });
});

test('a rewrite keeps the original query string', () => {
  const rules = [{ match: compileSource('/verify/:id'), destination: '/api/echo?id=:id' }];
  assert.equal(rewrite(rules, '/verify/X1', '?d=abc'), '/api/echo?id=X1&d=abc');
  assert.equal(rewrite(rules, '/other', ''), null);
});

test('reports health with the release id and functions', async () => {
  const res = await fetch(`${base}/_vgruvs/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.release, 'abc123');
  assert.deepEqual(body.functions.sort(), ['boom', 'echo', 'plain']);
});

test('runs a function through a vercel.json rewrite, with the public origin from nginx', async () => {
  const res = await fetch(`${base}/verify/EA-2026-00001?q=1`, {
    headers: { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'excellencyacs.com' }
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { id: 'EA-2026-00001', q: '1', origin: 'https://excellencyacs.com' });
});

test('passes the method, body and every Set-Cookie header', async () => {
  const res = await fetch(`${base}/api/echo`, { method: 'POST', body: JSON.stringify({ a: 1 }), headers: { 'content-type': 'application/json' } });
  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), { got: { a: 1 } });
  assert.deepEqual(res.headers.getSetCookie(), ['a=1', 'b=2']);
});

test('supports a default export handler', async () => {
  const res = await fetch(`${base}/api/plain`, { method: 'PUT' });
  assert.equal(await res.text(), 'plain PUT');
});

test('answers 405 for a method the function does not export', async () => {
  const res = await fetch(`${base}/api/echo`, { method: 'DELETE' });
  assert.equal(res.status, 405);
  assert.equal(res.headers.get('allow'), 'GET, POST');
});

test('hides function errors behind a 500', async () => {
  const res = await fetch(`${base}/api/boom`);
  assert.equal(res.status, 500);
  assert.doesNotMatch(await res.text(), /secret detail/);
});

test('404s an unknown function rather than serving the app', async () => {
  assert.equal((await fetch(`${base}/api/nope`)).status, 404);
});

test('falls back to index.html for app routes and static rewrites', async () => {
  for (const path of ['/eval/inv_123', '/some/deep/link']) {
    const res = await fetch(`${base}${path}`);
    assert.equal(res.status, 200, path);
    assert.match(await res.text(), /<title>app<\/title>/);
    assert.equal(res.headers.get('cache-control'), 'no-cache');
  }
});

test('never serves files outside the static root', async () => {
  const res = await fetch(`${base}/..%2Fsecret.txt`);
  assert.doesNotMatch(await res.text(), /outside the static root/);
});

test('refuses a body over 1 MB', async () => {
  const res = await fetch(`${base}/api/echo`, { method: 'POST', body: 'x'.repeat(1024 * 1024 + 10) }).catch(() => null);
  assert.ok(!res || res.status === 413);
});
