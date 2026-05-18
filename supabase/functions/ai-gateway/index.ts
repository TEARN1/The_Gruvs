/**
 * ai-gateway — Secure AI Proxy for The Gruvs.
 *
 * This function acts as a middleman. It receives the Anthropic request body
 * from the app, validates the user's session, injects the hidden API key,
 * and forwards the request to Anthropic.
 */

import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js';

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') || '';
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    // 1. Validate the user session using the auth token passed from the app
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');

    // ── NEURAL DATA SHIELD INJECTION ──
    // Strip hardware fingerprints from the request before sending to Anthropic.
    const sanitizedParams = await req.json();
    if (sanitizedParams.metadata) {
      delete sanitizedParams.metadata.ip_address;
      delete sanitizedParams.metadata.hardware_id;
    }

    // 2. Parse the request body (the same format the Anthropic SDK expects)
    const anthropicParams = sanitizedParams;

    // 3. Execute the request using the hidden key
    // Optimization: Stream results for the swarm if requested (future-proof)
    const response = await anthropic.messages.create({
      ...anthropicParams,
      max_tokens: anthropicParams.max_tokens || 4096,
    });

    // 4. Return the response to the app
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error(`[ai-gateway] Error: ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), {
      status: err.message === 'Unauthorized' ? 401 : 400,
      headers: corsHeaders
    });
  }
});
