// Tiered self-learning categorizer (server-side).
// Tier 1: learned rules (user corrections priority 200 > LLM-cached 50)
// Tier 2: keyword scorer (port of src/services/categorizer.ts)
// Tier 3: Claude Haiku fallback — verdict cached back into `rules` so the
//         same merchant never hits the LLM twice. Skipped when no API key.

// deno-lint-ignore-file no-explicit-any

export interface CatResult {
  category: string;
  confidence: number;
  tier: 'rule' | 'keyword' | 'llm' | 'none';
}

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

async function llmCategorize(
  text: string,
  categories: string[],
  apiKey: string
): Promise<{ category: string; confidence: number } | null> {
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
    // Constrain to the user's own list (case-insensitive match).
    const hit = categories.find((c) => c.toLowerCase() === parsed.category.toLowerCase());
    if (!hit) return null;
    const confidence = typeof parsed.confidence === 'number'
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0.7;
    return { category: hit, confidence };
  } catch (e) {
    console.error('llmCategorize failed:', e);
    return null;
  }
}

// Full tiered categorization. `supabase` may be a service-role client (ingest)
// or a user-scoped client (categorize fn) — both only touch this user's rows.
export async function categorizeFull(
  supabase: any,
  userId: string,
  text: string
): Promise<CatResult> {
  const haystack = text.toLowerCase();
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

  // Tier 3 — LLM fallback, cached as a low-priority rule.
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (apiKey) {
    const categories = await fetchCategoryNames(supabase, userId);
    const verdict = await llmCategorize(text, categories, apiKey);
    if (verdict) {
      const merchantKey = extractMerchantKey(text);
      if (merchantKey && verdict.confidence >= 0.6) {
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
      return { ...verdict, tier: 'llm' };
    }
  }

  return { ...scored, tier: 'none' };
}
