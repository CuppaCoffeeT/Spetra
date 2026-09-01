// Tiered self-learning categorizer (server-side) — no external API required.
// Tier 1: learned rules (user corrections priority 200 > cached verdicts 50)
// Tier 2: keyword scorer (port of src/services/categorizer.ts)
// Tier 3: gte-small embedding kNN over labeled examples (Supabase built-in
//         edge inference + pgvector — free, runs inside this function)
// Tier 4 (optional): generative fallback — Cloudflare Workers AI free tier
//         (CF_ACCOUNT_ID + CF_API_TOKEN), else Anthropic (ANTHROPIC_API_KEY).
//         Verdicts are cached as a rule AND an embedded example, so the same
//         merchant never needs the fallback twice and the kNN tier keeps
//         getting smarter. With no secrets configured, tiers 1-3 still work.

// deno-lint-ignore-file no-explicit-any

export interface CatResult {
  category: string;
  confidence: number;
  tier: 'rule' | 'keyword' | 'knn' | 'llm' | 'none';
}

// Accept a kNN match only at/above this cosine similarity. gte-small
// compresses its range (unrelated short strings often sit ~0.7), so 0.82 is
// deliberately conservative — corrections raise coverage over time.
const KNN_THRESHOLD = 0.82;

const KEYWORD_RULES: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /grab|gojek|tada|comfort|taxi|uber|mrt|bus|transit|shell|esso|petrol|caltex/i, category: 'Transport' },
  { pattern: /fairprice|ntuc|redmart|cold storage|giant|sheng siong|don don donki/i, category: 'Groceries' },
  { pattern: /shopee|lazada|amazon|qoo10|carousell|zalora|uniqlo|h&m|zara|courts/i, category: 'Shopping' },
  { pattern: /starbucks|coffee|kfc|mcdonald|burger|pizza|foodpanda|deliveroo|grab.*food|restaurant|cafe|hawker/i, category: 'Food' },
  { pattern: /singtel|starhub|m1|circles|giga|netflix|spotify|youtube|disney|subscription|insurance|utility/i, category: 'Bills' },
  { pattern: /salary|payroll|bonus|allowance|reimbursement/i, category: 'Income' },
  { pattern: /paynow|transfer|fund transfer/i, category: 'Transfer' },
  { pattern: /clinic|hospital|pharmacy|guardian|watsons|doctor|dental/i, category: 'Healthcare' },
  { pattern: /cinema|movie|golden village|cathay|shaw|concert|event/i, category: 'Entertainment' },
];

// Starter examples for the kNN tier — semantic breadth the keyword regexes
// can't cover. Seeded per-user (chunked; see seedExamples).
export const SEED_EXAMPLES: Array<{ category: string; content: string }> = [
  { category: 'Transport', content: 'taxi ride hailing private hire car' },
  { category: 'Transport', content: 'mrt bus train public transport fare' },
  { category: 'Transport', content: 'petrol station fuel car park parking erp' },
  { category: 'Groceries', content: 'supermarket groceries fresh food wet market' },
  { category: 'Groceries', content: 'minimart convenience store household provisions' },
  { category: 'Shopping', content: 'online shopping ecommerce marketplace order' },
  { category: 'Shopping', content: 'clothes fashion apparel shoes accessories' },
  { category: 'Shopping', content: 'electronics gadgets toys games collectibles merchandise hobby store' },
  { category: 'Food', content: 'restaurant cafe dinner lunch brunch meal' },
  { category: 'Food', content: 'fast food burger fried chicken pizza sushi noodles' },
  { category: 'Food', content: 'coffee tea bubble tea dessert bakery snack' },
  { category: 'Food', content: 'food delivery hawker centre food court kopitiam' },
  { category: 'Bills', content: 'phone internet mobile plan utility electricity bill' },
  { category: 'Bills', content: 'streaming subscription membership recurring fee' },
  { category: 'Bills', content: 'insurance premium policy payment' },
  { category: 'Income', content: 'salary payroll wages bonus commission' },
  { category: 'Income', content: 'refund cashback rebate reimbursement money received' },
  { category: 'Transfer', content: 'paynow transfer to friend split bill' },
  { category: 'Transfer', content: 'bank fund transfer between own accounts' },
  { category: 'Healthcare', content: 'clinic doctor consultation medical checkup' },
  { category: 'Healthcare', content: 'pharmacy medicine supplements vitamins' },
  { category: 'Healthcare', content: 'dental hospital specialist treatment' },
  { category: 'Entertainment', content: 'movie cinema film tickets' },
  { category: 'Entertainment', content: 'concert show exhibition event tickets' },
  { category: 'Entertainment', content: 'arcade karaoke bowling games leisure' },
];

export function scoreCategory(text: string): { category: string; confidence: number } {
  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(text)) return { category: rule.category, confidence: 0.85 };
  }
  return { category: 'Other', confidence: 0.2 };
}

// Stable lowercase merchant key: first alphanumeric token of length >= 3.
// Mirrors src/lib/rules.ts extractMerchantKey.
export function extractMerchantKey(description: string): string {
  const tokens = description.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ');
  for (const token of tokens) if (token.length >= 3) return token;
  return '';
}

// ------------------------------------------------------------- embeddings

let embedSession: any = null;

// Embed with the edge runtime's built-in gte-small (384 dims, normalized).
// Returns null when unavailable (e.g. local `deno run`) — callers skip the tier.
export async function embedText(text: string): Promise<number[] | null> {
  try {
    const SupabaseAi = (globalThis as any).Supabase;
    if (!SupabaseAi?.ai?.Session) return null;
    if (!embedSession) embedSession = new SupabaseAi.ai.Session('gte-small');
    const out = await embedSession.run(text.slice(0, 500), { mean_pool: true, normalize: true });
    return Array.isArray(out) ? (out as number[]) : null;
  } catch (e) {
    console.error('embedText failed:', e);
    return null;
  }
}

async function insertExample(
  supabase: any,
  userId: string,
  category: string,
  content: string,
  source: 'seed' | 'correction' | 'llm',
  embedding?: number[] | null
): Promise<boolean> {
  const emb = embedding ?? (await embedText(content));
  if (!emb) return false;
  const { error } = await supabase.from('category_examples').upsert(
    { user_id: userId, category, content, source, embedding: emb },
    { onConflict: 'user_id,content', ignoreDuplicates: source !== 'correction' }
  );
  if (error) {
    console.error('insertExample failed:', error.message);
    return false;
  }
  return true;
}

// Learn from a user correction: embedded example + priority-200 rule.
// Reports what actually persisted so the caller can surface total failure
// (the web client falls back to a client-side rule write on non-2xx).
export async function learnCorrection(
  supabase: any,
  userId: string,
  text: string,
  category: string
): Promise<{ exampleOk: boolean; ruleOk: boolean }> {
  const exampleOk = await insertExample(supabase, userId, category, text.slice(0, 200), 'correction');
  const pattern = extractMerchantKey(text);
  let ruleOk = false;
  if (pattern) {
    const { error } = await supabase.from('rules').upsert(
      { user_id: userId, pattern, category, priority: 200, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,pattern' }
    );
    ruleOk = !error;
    if (error) console.error('learn rule failed:', error.message);
  }
  return { exampleOk, ruleOk };
}

// Seed up to `batch` missing starter examples (chunked: embedding ~100-200ms
// CPU each vs the hosted 2s-CPU-per-request limit). Returns how many remain.
export async function seedExamples(
  supabase: any,
  userId: string,
  batch = 8
): Promise<{ seeded: number; remaining: number; total: number }> {
  const { data, error } = await supabase
    .from('category_examples')
    .select('content')
    .eq('user_id', userId);
  if (error) throw new Error(`seed lookup failed: ${error.message}`);
  const have = new Set((data ?? []).map((r: { content: string }) => r.content));
  const missing = SEED_EXAMPLES.filter((s) => !have.has(s.content));
  let seeded = 0;
  for (const s of missing.slice(0, batch)) {
    if (await insertExample(supabase, userId, s.category, s.content, 'seed')) seeded++;
  }
  return { seeded, remaining: missing.length - seeded, total: SEED_EXAMPLES.length };
}

async function knnCategorize(
  supabase: any,
  userId: string,
  text: string
): Promise<{ category: string; confidence: number } | null> {
  const emb = await embedText(text);
  if (!emb) return null;
  const { data, error } = await supabase.rpc('match_category_examples', {
    p_user_id: userId,
    p_embedding: emb,
    p_count: 3,
  });
  if (error) {
    console.error('knn match failed:', error.message);
    return null;
  }
  const top = data?.[0];
  if (!top || top.similarity < KNN_THRESHOLD) return null;
  return { category: top.category, confidence: Math.min(0.95, top.similarity) };
}

// ------------------------------------------------------ generative fallback

interface RuleRow {
  pattern: string;
  category: string;
  priority: number;
}

async function fetchRules(supabase: any, userId: string): Promise<RuleRow[]> {
  const { data, error } = await supabase
    .from('rules')
    .select('pattern, category, priority')
    .eq('user_id', userId)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) {
    console.error('fetch rules failed:', error.message);
    return [];
  }
  return data ?? [];
}

async function fetchCategoryNames(supabase: any, userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('name')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true });
  if (error || !data?.length) {
    return KEYWORD_RULES.map((r) => r.category).concat(['Other']);
  }
  return data.map((c: { name: string }) => c.name);
}

// Clean BOTH sides identically — a category named "Kids' Stuff" must still
// match a model reply with or without the punctuation.
function cleanName(raw: string): string {
  return raw.trim().replace(/["'.]/g, '').toLowerCase();
}

function matchCategory(raw: string, categories: string[]): string | null {
  const cleaned = cleanName(raw);
  return categories.find((c) => cleanName(c) === cleaned) ?? null;
}

// Cloudflare Workers AI free tier: llama-3.2-3b via REST. Prompt for a single
// category word (this model has no reliable JSON mode) and validate in code.
async function workersAiCategorize(
  text: string,
  categories: string[]
): Promise<{ category: string; confidence: number } | null> {
  const accountId = Deno.env.get('CF_ACCOUNT_ID');
  const token = Deno.env.get('CF_API_TOKEN');
  if (!accountId || !token) return null;
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.2-3b-instruct`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content:
                'You categorize personal spending transactions in Singapore. Reply with exactly one category name from the list — a single word or phrase, nothing else.',
            },
            {
              role: 'user',
              content: `Categories: ${categories.join(', ')}\nTransaction: ${text.slice(0, 300)}\nCategory:`,
            },
          ],
          max_tokens: 16,
        }),
      }
    );
    if (!res.ok) {
      console.error('workers ai error', res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const raw: string = data?.result?.response ?? '';
    const hit = matchCategory(raw, categories);
    return hit ? { category: hit, confidence: 0.7 } : null;
  } catch (e) {
    console.error('workersAiCategorize failed:', e);
    return null;
  }
}

async function anthropicCategorize(
  text: string,
  categories: string[]
): Promise<{ category: string; confidence: number } | null> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 200,
        system:
          'You categorize personal spending transactions in Singapore. ' +
          'Given a transaction description, pick the single best category from the provided list. ' +
          'Respond with ONLY strict JSON: {"category": "<one of the list>", "confidence": <0..1>}',
        messages: [
          {
            role: 'user',
            content: `Categories: ${categories.join(', ')}\nTransaction: ${text.slice(0, 300)}`,
          },
        ],
      }),
    });
    if (!res.ok) {
      console.error('anthropic error', res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const raw: string = data?.content?.[0]?.text ?? '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (typeof parsed.category !== 'string') return null;
    const hit = matchCategory(parsed.category, categories);
    if (!hit) return null;
    const confidence = typeof parsed.confidence === 'number'
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0.7;
    return { category: hit, confidence };
  } catch (e) {
    console.error('anthropicCategorize failed:', e);
    return null;
  }
}

// Full tiered categorization. `supabase` may be a service-role client (ingest)
// or a user-scoped client (categorize fn) — both only touch this user's rows.
// `exampleText` is the CLEAN merchant/description string used for the kNN
// query and for anything cached as a learned example — pass it when `text`
// carries extra context like a bank-alert email subject, which is shared
// across all alerts and would poison the example store (and future matches).
export async function categorizeFull(
  supabase: any,
  userId: string,
  text: string,
  exampleText?: string
): Promise<CatResult> {
  const haystack = text.toLowerCase();
  const learnText = (exampleText ?? text).slice(0, 200);
  const rules = await fetchRules(supabase, userId);

  // Tier 1 — learned rules (pre-sorted by priority desc; substring match).
  for (const rule of rules) {
    if (rule.pattern && haystack.includes(rule.pattern)) {
      return { category: rule.category, confidence: 0.99, tier: 'rule' };
    }
  }

  // Tier 2 — keyword scorer.
  const scored = scoreCategory(text);
  if (scored.confidence >= 0.85) {
    return { ...scored, tier: 'keyword' };
  }

  // Tier 3 — embedding kNN over labeled examples (free, in-function).
  const knn = await knnCategorize(supabase, userId, exampleText ?? text);
  if (knn) {
    return { ...knn, tier: 'knn' };
  }

  // Tier 4 — optional generative fallback (Workers AI free tier, else
  // Anthropic). Verdict is cached as a rule + an embedded example. Skip the
  // categories fetch entirely when no provider is configured (ingest hot path).
  const hasGenerative =
    (Deno.env.get('CF_ACCOUNT_ID') && Deno.env.get('CF_API_TOKEN')) ||
    Deno.env.get('ANTHROPIC_API_KEY');
  if (hasGenerative) {
    const categories = await fetchCategoryNames(supabase, userId);
    const verdict =
      (await workersAiCategorize(text, categories)) ??
      (await anthropicCategorize(text, categories));
    if (verdict) {
      if (verdict.confidence >= 0.6) {
        const merchantKey = extractMerchantKey(learnText);
        if (merchantKey) {
          // priority 50: below user corrections (200) and default rules (100).
          const { error } = await supabase.from('rules').upsert(
            {
              user_id: userId,
              pattern: merchantKey,
              category: verdict.category,
              priority: 50,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,pattern', ignoreDuplicates: true }
          );
          if (error) console.error('cache llm rule failed:', error.message);
        }
        await insertExample(supabase, userId, verdict.category, learnText, 'llm');
      }
      return { ...verdict, tier: 'llm' };
    }
  }

  return { ...scored, tier: 'none' };
}
