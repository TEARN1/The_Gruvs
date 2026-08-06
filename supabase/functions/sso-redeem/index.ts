// sso-redeem — exchange a one-time cross-app handoff code for a login session.
//
// Called by The Resident (or The Gruvs) WITHOUT a session — the user isn't
// logged in on this domain yet; the one-time code IS the credential. So JWT
// verification is intentionally OFF and this function implements its own auth:
// the code must be unused, unexpired, and audience-bound. It is single-use
// (atomic claim) and short-lived (60s), and the service_role key never leaves
// the server. Success returns a magiclink token_hash the client verifies to
// establish a real Supabase session for that user.
//
// Deploy:  supabase functions deploy sso-redeem --no-verify-jwt
// Pairs with: public.sso_issue_code(p_audience) RPC + sso_handoff_codes table.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  let body: { code?: string; audience?: string }
  try { body = await req.json() } catch { return json({ error: 'bad request' }, 400) }

  const code = String(body?.code || '')
  const audience = String(body?.audience || '')
  if (!code || (audience !== 'resident' && audience !== 'gruvs')) {
    return json({ error: 'invalid request' }, 400)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  // Atomic single-use claim: only an unused, unexpired, audience-matched code
  // flips used_at. A racing second request finds used_at already set → no row.
  const nowIso = new Date().toISOString()
  const { data: claimed, error: claimErr } = await admin
    .from('sso_handoff_codes')
    .update({ used_at: nowIso })
    .eq('code', code)
    .eq('audience', audience)
    .is('used_at', null)
    .gt('expires_at', nowIso)
    .select('user_id')
    .maybeSingle()

  if (claimErr || !claimed) return json({ error: 'expired or invalid code' }, 401)

  const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(claimed.user_id)
  if (userErr || !userRes?.user?.email) return json({ error: 'account not found' }, 401)

  // Mint a magiclink token the client verifies to get a session. No password,
  // no email actually sent — we only use the returned hashed_token.
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: userRes.user.email,
  })
  if (linkErr || !link?.properties?.hashed_token) {
    return json({ error: 'could not establish session' }, 500)
  }

  return json({ token_hash: link.properties.hashed_token, type: 'magiclink' })
})
