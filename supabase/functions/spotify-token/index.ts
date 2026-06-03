/**
 * spotify-token — Supabase Edge Function (Deno)
 *
 * Exchanges the Spotify client credentials (ID & Secret) for an access token.
 * This runs server-side to prevent shipping the Client Secret in public client bundles.
 * Requires a valid user session (JWT) from the client to prevent abuse.
 *
 * Deploy:
 *   supabase secrets set SPOTIFY_CLIENT_ID=xxx SPOTIFY_CLIENT_SECRET=xxx
 *   supabase functions deploy spotify-token
 */

import { createClient } from 'npm:@supabase/supabase-js';

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const SPOTIFY_CLIENT_ID = Deno.env.get('SPOTIFY_CLIENT_ID') || Deno.env.get('EXPO_PUBLIC_SPOTIFY_CLIENT_ID') || '';
const SPOTIFY_CLIENT_SECRET = Deno.env.get('SPOTIFY_CLIENT_SECRET') || Deno.env.get('EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight options request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    // 1. Verify user session
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // 2. Verify Spotify credentials exist in environment
    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
      throw new Error('Spotify credentials are not configured on the server.');
    }

    // 3. Exchange credentials for access token
    const credentials = btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`);
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[spotify-token] Spotify API error status ${res.status}:`, errText);
      throw new Error(`Spotify token exchange failed with status ${res.status}`);
    }

    const data = await res.json();

    // 4. Return token response to the client
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error(`[spotify-token] Error: ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), {
      status: err.message === 'Unauthorized' ? 401 : 400,
      headers: corsHeaders,
    });
  }
});
