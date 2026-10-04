/**
 * delete-account — permanent, compliant account + data deletion.
 * Apple 5.1.1(v) / Google Play both require real deletion, not deactivation.
 *
 * The JWT is verified, so the uid comes from the TOKEN, never the request body:
 * a user can only ever delete THEMSELVES.
 *
 *   1. verify caller -> uid
 *   2. purge_user_data(uid)  — deletes their rows across public.*
 *   3. wipe their storage objects in every bucket (recursive)
 *   4. auth.admin.deleteUser(uid) — removes the login + cascades FK'd rows
 *
 * Steps 2 and 3 must fully succeed before step 4. If anything fails, the login
 * is kept and the caller gets an error, so the user can retry. Deleting the
 * login first would strand their data with no account left to retry from,
 * while telling them it was gone.
 *
 * Deploy with verify_jwt = true.
 */
import { createClient } from 'npm:@supabase/supabase-js';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const ANON_KEY         = Deno.env.get('SUPABASE_ANON_KEY') || '';

// Fallback only. Buckets are listed at runtime so a newly added bucket can
// never be missed again — 'gossip-media' and 'stories' were both missed by a
// hard-coded list. The Resident shares this project and uploads under the
// same `${uid}/` convention, so every bucket is swept.
const KNOWN_BUCKETS = [
  'avatars', 'covers', 'event-media', 'moments', 'reels',
  'chat_media', 'gossip-media', 'stories',
];

const PAGE = 1000;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

async function listBuckets(admin: any): Promise<string[]> {
  const { data, error } = await admin.storage.listBuckets();
  if (error || !data) return KNOWN_BUCKETS;
  return [...new Set([...KNOWN_BUCKETS, ...data.map((b: { id: string }) => b.id)])];
}

// Storage list is per-folder and paged — walk every page of every folder.
// Throws on a list error: silently skipping a folder would leave files behind.
async function collectPaths(admin: any, bucket: string, prefix: string): Promise<string[]> {
  const out: string[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: PAGE, offset });
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    if (!data?.length) break;
    for (const entry of data) {
      const p = `${prefix}/${entry.name}`;
      if (entry.id === null && !entry.metadata) out.push(...await collectPaths(admin, bucket, p));
      else out.push(p);
    }
    if (data.length < PAGE) break;
  }
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Missing bearer token' }, 401);

  // 1. The uid comes from the caller's own verified token — never from the body.
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return json({ error: 'Invalid session' }, 401);
  const uid = user.id;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    // 2. Purge their database rows. supabase-js returns { error } rather than
    //    throwing, so it must be checked explicitly.
    const { error: purgeErr } = await admin.rpc('purge_user_data', { p_user: uid });
    if (purgeErr) throw new Error(`purge_user_data: ${purgeErr.message}`);

    // 3. Wipe their storage in every bucket. A bucket with no folder for this
    //    user lists as empty, which is fine; a real failure aborts.
    for (const bucket of await listBuckets(admin)) {
      const paths = await collectPaths(admin, bucket, uid);
      for (let i = 0; i < paths.length; i += 100) {
        const { error: rmErr } = await admin.storage.from(bucket).remove(paths.slice(i, i + 100));
        if (rmErr) throw new Error(`remove ${bucket}: ${rmErr.message}`);
      }
    }

    // 4. Only now delete the login itself.
    const { error: delErr } = await admin.auth.admin.deleteUser(uid);
    if (delErr) throw new Error(`deleteUser: ${delErr.message}`);

    return json({ deleted: true });
  } catch (err) {
    // Full detail goes to the function logs only; the client gets a stable
    // message and can safely retry, since the account still exists.
    console.error('delete-account failed for', uid, err);
    return json({ error: 'Deletion failed — your account was not deleted. Please try again.' }, 500);
  }
});
