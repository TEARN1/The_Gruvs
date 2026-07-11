/**
 * delete-account — Supabase Edge Function (Deno)
 *
 * Permanent, compliant account + data deletion (Apple 5.1.1(v) / Google Play).
 * A signed-in user calls this to delete THEMSELVES — the JWT is verified, so the
 * uid is taken from the token, never from the request body (no deleting others).
 *
 * Steps:
 *   1. Verify the caller's JWT → uid.
 *   2. purge_user_data(uid) — deletes their rows across public.*.
 *   3. Remove their storage objects (all buckets, recursive under `${uid}/`).
 *   4. auth.admin.deleteUser(uid) — removes the login + cascades FK'd rows.
 *
 * Deploy with verify_jwt = true.
 */

import { createClient } from 'npm:@supabase/supabase-js';

const SUPABASE_URL        = Deno.env.get('SUPABASE_URL')              || '';
const SERVICE_ROLE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const ANON_KEY            = Deno.env.get('SUPABASE_ANON_KEY')         || '';

const BUCKETS = ['avatars', 'covers', 'event-media', 'moments', 'reels', 'chat_media'];

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Recursively collect object paths under a prefix (Supabase list is per-folder).
async function collectPaths(admin: any, bucket: string, prefix: string): Promise<string[]> {
  const out: string[] = [];
  const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error || !data) return out;
  for (const entry of data) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id === null && !entry.metadata) {
      // a folder — recurse
      out.push(...await collectPaths(admin, bucket, path));
    } else {
      out.push(path);
    }
  }
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing bearer token' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  // 1. Verify the caller from their own JWT (never trust a body-supplied id).
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
  const uid = user.id;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    // 2. Purge their DB rows.
    await admin.rpc('purge_user_data', { p_user: uid });

    // 3. Remove their storage objects across all buckets (best-effort).
    for (const bucket of BUCKETS) {
      try {
        const paths = await collectPaths(admin, bucket, uid);
        for (let i = 0; i < paths.length; i += 100) {
          await admin.storage.from(bucket).remove(paths.slice(i, i + 100));
        }
      } catch { /* bucket may not exist / empty — continue */ }
    }

    // 4. Delete the login. Cascades anything FK'd to auth.users ON DELETE CASCADE.
    const { error: delErr } = await admin.auth.admin.deleteUser(uid);
    if (delErr) throw delErr;

    return new Response(JSON.stringify({ deleted: true }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('delete-account error:', err);
    return new Response(JSON.stringify({ error: 'Deletion failed', detail: String((err as Error)?.message || err) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
