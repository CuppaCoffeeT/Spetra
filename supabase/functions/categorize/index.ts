// POST /functions/v1/categorize — user-JWT-authenticated (default verify_jwt).
// Actions (body.action, default 'categorize'):
//   categorize: { text }                   -> { category, confidence, tier }
//   learn:      { text, category }         -> correction becomes an embedded
//               example + a priority-200 rule (called by the web app on edits)
//   seed:       {}                         -> seed up to 8 starter examples,
//               returns { seeded, remaining, total } (call until remaining=0)
//   status:     {}                         -> { examples, seeds, corrections }

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { categorizeFull, learnCorrection, seedExamples } from '../_shared/categorizer.ts';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const headers = { ...CORS, 'content-type': 'application/json' };
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers });

  // User-scoped client: RLS applies, so all reads/writes (rules, examples,
  // categories) are automatically restricted to this user.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
  );
  const { data: userData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !userData?.user) return json(401, { error: 'unauthorized' });
  const userId = userData.user.id;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid JSON' });
  }
  const action = String(body.action ?? 'categorize');

  if (action === 'learn') {
    const text = String(body.text ?? '').trim();
    const category = String(body.category ?? '').trim();
    if (!text || !category) return json(400, { error: 'text and category required' });
    const learned = await learnCorrection(supabase, userId, text, category);
    // Non-2xx when NOTHING persisted, so the web client's client-side rule
    // fallback fires instead of silently dropping the correction.
    if (!learned.exampleOk && !learned.ruleOk) {
      return json(500, { error: 'learn persisted nothing', ...learned });
    }
    return json(200, { status: 'learned', ...learned });
  }

  if (action === 'seed') {
    try {
      const seeded = await seedExamples(supabase, userId, 8);
      // Zero progress with work remaining = embedding/insert failure — error
      // out so the client's seeding loop stops instead of spinning forever.
      if (seeded.seeded === 0 && seeded.remaining > 0) {
        return json(500, {
          error: 'seeding made no progress — embedding model unavailable? (works on the hosted edge runtime only)',
          ...seeded,
        });
      }
      return json(200, seeded);
    } catch (e) {
      return json(500, { error: e instanceof Error ? e.message : 'seed failed' });
    }
  }

  if (action === 'status') {
    const { data, error } = await supabase
      .from('category_examples')
      .select('source')
      .eq('user_id', userId);
    if (error) return json(500, { error: error.message });
    const rows = data ?? [];
    return json(200, {
      examples: rows.length,
      seeds: rows.filter((r: any) => r.source === 'seed').length,
      corrections: rows.filter((r: any) => r.source === 'correction').length,
    });
  }

  const text = String(body.text ?? '').trim();
  if (!text) return json(400, { error: 'text required' });
  return json(200, await categorizeFull(supabase, userId, text));
});
