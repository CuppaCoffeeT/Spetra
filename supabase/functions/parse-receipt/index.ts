// POST /functions/v1/parse-receipt — { "imageBase64": "...", "mediaType": "image/jpeg" }
// User-JWT-authenticated. Sends the receipt image to Claude vision and returns
// structured fields incl. line items (the TaxHacker approach):
//   { merchant, date, currency, total, items: [{name, qty, unitPrice, amount}] }
// 501 when ANTHROPIC_API_KEY isn't configured — the client then falls back to
// tesseract.js (text-only, no reliable items).

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info',
};

const SYSTEM = `You extract structured data from retail receipt images.
Respond with ONLY strict JSON, no prose, in this exact shape:
{"merchant": string|null, "date": "YYYY-MM-DD"|null, "currency": string (ISO code, default "SGD"),
 "total": number|null, "items": [{"name": string, "qty": number, "unitPrice": number|null, "amount": number}]}
Rules: items are the purchased line items only (skip subtotal/tax/change/payment lines);
amount is the line total; if quantity is not shown use 1; total is the grand total paid.
If the image is not a receipt, return {"merchant":null,"date":null,"currency":"SGD","total":null,"items":[]}.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const headers = { ...CORS, 'content-type': 'application/json' };
  const fail = (status: number, error: string) =>
    new Response(JSON.stringify({ error }), { status, headers });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
  );
  const { data: userData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !userData?.user) return fail(401, 'unauthorized');

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return fail(501, 'llm_not_configured');

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail(400, 'invalid JSON');
  }
  const imageBase64 = String(body.imageBase64 ?? '');
  const mediaType = String(body.mediaType ?? 'image/jpeg');
  if (!imageBase64) return fail(400, 'imageBase64 required');
  if (imageBase64.length > 7_000_000) return fail(413, 'image too large — resize below ~5MB');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 2000,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: 'Extract this receipt.' },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    console.error('anthropic error', res.status, await res.text());
    return fail(502, 'vision extraction failed');
  }
  const data = await res.json();
  const raw: string = data?.content?.[0]?.text ?? '';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return fail(502, 'no JSON in vision response');

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const items = Array.isArray(parsed.items)
      ? parsed.items
          .filter((i: any) => i && typeof i.name === 'string' && typeof i.amount === 'number')
          .map((i: any) => ({
            name: i.name.slice(0, 120),
            qty: typeof i.qty === 'number' && i.qty > 0 ? i.qty : 1,
            unitPrice: typeof i.unitPrice === 'number' ? i.unitPrice : null,
            amount: i.amount,
          }))
      : [];
    return new Response(
      JSON.stringify({
        merchant: typeof parsed.merchant === 'string' ? parsed.merchant.slice(0, 80) : null,
        date: typeof parsed.date === 'string' ? parsed.date : null,
        currency: typeof parsed.currency === 'string' ? parsed.currency : 'SGD',
        total: typeof parsed.total === 'number' ? parsed.total : null,
        items,
      }),
      { headers }
    );
  } catch {
    return fail(502, 'unparseable vision response');
  }
});
