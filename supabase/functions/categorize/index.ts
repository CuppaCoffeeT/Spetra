// POST /functions/v1/categorize — { "text": "BURGER KING SG" }
// User-JWT-authenticated (default verify_jwt). Runs the same tiered
// categorizer as ingest; used by the web app's manual-entry auto-suggest.

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { categorizeFull } from '../_shared/categorizer.ts';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const headers = { ...CORS, 'content-type': 'application/json' };

  // User-scoped client: RLS applies, so rules/categories reads + the LLM
  // rule-cache write are automatically restricted to this user.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
  );
  const { data: userData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !userData?.user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid JSON' }), { status: 400, headers });
  }
  const text = String(body.text ?? '').trim();
  if (!text) {
    return new Response(JSON.stringify({ error: 'text required' }), { status: 400, headers });
  }

  const result = await categorizeFull(supabase, userData.user.id, text);
  return new Response(JSON.stringify(result), { headers });
});
