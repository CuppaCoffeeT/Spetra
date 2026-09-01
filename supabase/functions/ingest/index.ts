// POST /functions/v1/ingest — the single live-ingestion webhook.
// Auth: `x-ingest-key` header (per-user secret from the `ingest_keys` table);
// verify_jwt is OFF for this function (see config.toml) — the key IS the auth.
//
// Two payload shapes:
//   { "type": "shortcut", "merchant": "...", "amount": "4.50"|4.5,
//     "card": "...", "currency": "SGD", "timestamp": "..." }        (iOS Shortcut)
//   { "type": "email", "subject": "...", "text": "...",
//     "from": "...", "receivedAt": "..." }                          (Email worker)
//
// Pipeline: resolve key -> parse -> cross-source merge/dedupe -> categorize
// (rules -> keywords -> LLM) -> insert. An Apple Pay tap often produces BOTH a
// Shortcut POST (seconds) and a bank alert email (later): whichever arrives
// second enriches the existing row instead of creating a duplicate.

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { parseEmailText, legacyDedupeHash } from '../_shared/parser.ts';
import { categorizeFull } from '../_shared/categorizer.ts';

const MERGE_WINDOW_MS = 36 * 60 * 60 * 1000; // ±36h: bank emails can lag a tap

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// Shortcuts sends amount as text like "$4.50", "SGD 4.50" or a number.
function parseAmount(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;
  const m = raw.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const v = parseFloat(m[0]);
  return Number.isFinite(v) ? v : null;
}

// Find a recent opposite-source row with the same amount to enrich instead of
// inserting a duplicate. Picks the closest-in-time unmatched candidate.
async function findMergeCandidate(
  supabase: any,
  userId: string,
  amount: number,
  direction: string,
  occurredAt: string,
  otherSource: string,
  matchedFlag: string
): Promise<any | null> {
  const t = new Date(occurredAt).getTime();
  const { data, error } = await supabase
    .from('transactions')
    .select('id, transaction_date, description, merchant, card_label, source_meta')
    .eq('user_id', userId)
    .eq('amount', amount)
    .eq('direction', direction)
    .eq('source', otherSource)
    .gte('transaction_date', new Date(t - MERGE_WINDOW_MS).toISOString())
    .lte('transaction_date', new Date(t + MERGE_WINDOW_MS).toISOString());
  if (error) {
    console.error('merge lookup failed:', error.message);
    return null;
  }
  const candidates = (data ?? [])
    .filter((r: any) => !(r.source_meta?.[matchedFlag]))
    .sort(
      (a: any, b: any) =>
        Math.abs(new Date(a.transaction_date).getTime() - t) -
        Math.abs(new Date(b.transaction_date).getTime() - t)
    );
  return candidates[0] ?? null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // --- auth: resolve ingest key -> user ---
  const key = req.headers.get('x-ingest-key');
  if (!key) return json(401, { error: 'missing x-ingest-key' });
  const { data: keyRow } = await supabase
    .from('ingest_keys')
    .select('id, user_id')
    .eq('key', key)
    .maybeSingle();
  if (!keyRow) return json(401, { error: 'invalid ingest key' });
  const userId: string = keyRow.user_id;
  await supabase
    .from('ingest_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyRow.id);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid JSON body' });
  }

  // ------------------------------------------------- shortcut (Apple Pay tap)
  if (body.type === 'shortcut') {
    const merchant = String(body.merchant ?? '').trim();
    const amountRaw = parseAmount(body.amount);
    if (!merchant || amountRaw === null || amountRaw === 0) {
      return json(400, { error: 'shortcut payload needs merchant + amount' });
    }
    const amount = Math.abs(amountRaw);
    const direction: 'in' | 'out' = amountRaw < 0 ? 'in' : 'out';
    const occurredAt = body.timestamp && !isNaN(Date.parse(body.timestamp))
      ? new Date(body.timestamp).toISOString()
      : new Date().toISOString();
    const card = body.card ? String(body.card).trim() : null;

    // The bank email for this tap may (rarely) have arrived first — enrich it.
    const emailRow = await findMergeCandidate(
      supabase, userId, amount, direction, occurredAt, 'email', 'shortcut_matched'
    );
    if (emailRow) {
      await supabase
        .from('transactions')
        .update({
          merchant,
          card_label: card,
          source_meta: { ...(emailRow.source_meta ?? {}), shortcut_matched: true },
        })
        .eq('id', emailRow.id);
      return json(200, { status: 'merged', id: emailRow.id });
    }

    const cat = await categorizeFull(supabase, userId, merchant);
    const { data: inserted, error } = await supabase
      .from('transactions')
      .upsert(
        {
          user_id: userId,
          amount,
          currency: String(body.currency ?? 'SGD'),
          direction,
          description: merchant,
          merchant,
          card_label: card,
          category: cat.category,
          category_confidence: cat.confidence,
          needs_review: cat.confidence < 0.6,
          transaction_date: occurredAt,
          source: 'shortcut',
          source_meta: { raw: body, categorized_by: cat.tier },
          dedupe_hash: legacyDedupeHash(amount, occurredAt, merchant),
          synced_at: new Date().toISOString(),
        },
        { onConflict: 'dedupe_hash', ignoreDuplicates: true }
      )
      .select()
      .maybeSingle();
    if (error) return json(500, { error: error.message });
    if (!inserted) return json(200, { status: 'duplicate' });
    return json(201, { status: 'created', id: inserted.id, category: cat.category });
  }

  // ------------------------------------------------------- email (bank alert)
  if (body.type === 'email') {
    const subject = String(body.subject ?? '');
    const text = String(body.text ?? body.body ?? '');
    const receivedAt = body.receivedAt && !isNaN(Date.parse(body.receivedAt))
      ? new Date(body.receivedAt).toISOString()
      : new Date().toISOString();

    const parsed = parseEmailText(subject, text, receivedAt);
    if (!parsed) return json(200, { status: 'skipped', reason: 'not a transaction email' });

    // Exact dedupe vs. the legacy Gmail-poll path (same hash algorithm).
    const hash = legacyDedupeHash(parsed.amount, parsed.transactionDate, parsed.description);
    const { data: dup } = await supabase
      .from('transactions')
      .select('id')
      .eq('dedupe_hash', hash)
      .maybeSingle();
    if (dup) return json(200, { status: 'duplicate', id: dup.id });

    // Cross-source: the Shortcut row for this tap usually exists already.
    const shortcutRow = await findMergeCandidate(
      supabase, userId, parsed.amount, parsed.direction, parsed.transactionDate,
      'shortcut', 'email_matched'
    );
    if (shortcutRow) {
      await supabase
        .from('transactions')
        .update({
          // Keep the Shortcut's merchant; note the email's richer description.
          source_email: body.from ?? null,
          source_meta: {
            ...(shortcutRow.source_meta ?? {}),
            email_matched: true,
            email_description: parsed.description,
            email_subject: subject.slice(0, 200),
          },
        })
        .eq('id', shortcutRow.id);
      return json(200, { status: 'merged', id: shortcutRow.id });
    }

    const cat = await categorizeFull(supabase, userId, `${parsed.description} ${subject}`);
    const { data: inserted, error } = await supabase
      .from('transactions')
      .upsert(
        {
          user_id: userId,
          amount: parsed.amount,
          currency: parsed.currency,
          direction: parsed.direction,
          description: parsed.description,
          merchant: parsed.description,
          category: cat.category,
          category_confidence: cat.confidence,
          needs_review: cat.confidence < 0.6,
          transaction_date: parsed.transactionDate,
          source: 'email',
          source_email: body.from ?? null,
          source_meta: { email_subject: subject.slice(0, 200), categorized_by: cat.tier },
          dedupe_hash: hash,
          synced_at: new Date().toISOString(),
        },
        { onConflict: 'dedupe_hash', ignoreDuplicates: true }
      )
      .select()
      .maybeSingle();
    if (error) return json(500, { error: error.message });
    if (!inserted) return json(200, { status: 'duplicate' });
    return json(201, { status: 'created', id: inserted.id, category: cat.category });
  }

  return json(400, { error: 'type must be "shortcut" or "email"' });
});
