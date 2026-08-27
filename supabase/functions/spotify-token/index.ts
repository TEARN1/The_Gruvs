/**
 * spotify-token — Supabase Edge Function (Deno)
 *
 * Exchanges the Spotify client credentials (ID & Secret) for an access token.
 * This runs server-side so the Client Secret is never shipped in a public
 * client bundle. Requires a valid user session (JWT) from the client.
 *
 * Deploy:
 *   supabase secrets set SPOTIFY_CLIENT_ID=xxx SPOTIFY_CLIENT_SECRET=xxx
 *   supabase functions deploy spotify-token
 */

import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')      || '';
// The caller's JWT is what we're verifying, so this client is built with the
// ANON key — never the service_role key. Pairing service_role with a
// caller-controlled Authorization header is a privilege-escalation footgun: any
// future refactor (or a supabase-js change in how a custom auth header is
// honoured) turns a failed verification into a fully privileged client.
const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY') || '';

const SPOTIFY_CLIENT_ID     = Deno.env.get('SPOTIFY_CLIENT_ID')     || '';
const SPOTIFY_CLIENT_SECRET = Deno.env.get('SPOTIFY_CLIENT_SECRET') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return json({ error: 'method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);

  // 1. Verify the caller actually has a session.
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authHeader } },
  });
  // Pass the JWT explicitly rather than relying on the global header being
  // picked up — this fails closed if the token is missing or invalid.
  const jwt = authHeader.slice('Bearer '.length).trim();
  const { data: { user }, error: authError } = await userClient.auth.getUser(jwt);
  if (authError || !user) return json({ error: 'unauthorized' }, 401);

  // 2. Server-side credentials must be configured.
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    console.error('[spotify-token] SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET not set');
    return json({ error: 'music search unavailable' }, 503);
  }

  // 3. Exchange credentials for an app token.
  try {
    const credentials = btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`);
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!res.ok) {
      // Log the detail server-side; never echo an upstream body to the caller.
      console.error(`[spotify-token] Spotify API ${res.status}:`, await res.text());
      return json({ error: 'token exchange failed' }, 502);
    }

    const data = await res.json();
    // Return only what the client needs — not the whole upstream payload.
    return json({ access_token: data.access_token, expires_in: data.expires_in });
  } catch (err) {
    console.error('[spotify-token] unexpected error:', err);
    return json({ error: 'token exchange failed' }, 502);
  }
});
