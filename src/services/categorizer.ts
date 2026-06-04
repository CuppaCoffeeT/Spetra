// Default category set (name + identity colour). These are DATA used for
// seeding the per-user `categories` table; hex values are allowed here.
// sort_order is derived from the array index.
export const DEFAULT_CATEGORIES: { name: string; color: string }[] = [
  { name: 'Transport', color: '#0EA5E9' },
  { name: 'Groceries', color: '#16A34A' },
  { name: 'Shopping', color: '#EC4899' },
  { name: 'Food', color: '#F59E0B' },
  { name: 'Bills', color: '#6366F1' },
  { name: 'Income', color: '#10B981' },
  { name: 'Transfer', color: '#64748B' },
  { name: 'Healthcare', color: '#EF4444' },
  { name: 'Entertainment', color: '#8B5CF6' },
  { name: 'Other', color: '#94A3B8' },
];

// Names only — derived from DEFAULT_CATEGORIES so the source of truth stays in
// one place. Kept as a string[] for existing consumers.
export const CATEGORIES: string[] = DEFAULT_CATEGORIES.map((c) => c.name);

const rules: Array<{ pattern: RegExp; category: string }> = [
  // Transport
  { pattern: /grab|gojek|tada|comfort|taxi|uber|mrt|bus|transit|shell|esso|petrol|caltex/i, category: 'Transport' },

  // Groceries
  { pattern: /fairprice|ntuc|redmart|cold storage|giant|sheng siong|don don donki/i, category: 'Groceries' },

  // Shopping
  { pattern: /shopee|lazada|amazon|qoo10|carousell|zalora|uniqlo|h&m|zara|courts/i, category: 'Shopping' },

  // Food
  { pattern: /starbucks|coffee|kfc|mcdonald|burger|pizza|foodpanda|deliveroo|grab.*food|restaurant|cafe|hawker/i, category: 'Food' },

  // Bills
  { pattern: /singtel|starhub|m1|circles|giga|netflix|spotify|youtube|disney|subscription|insurance|utility/i, category: 'Bills' },

  // Income
  { pattern: /salary|payroll|bonus|allowance|reimbursement/i, category: 'Income' },

  // Transfers
  { pattern: /paynow|transfer|fund transfer/i, category: 'Transfer' },

  // Healthcare
  { pattern: /clinic|hospital|pharmacy|guardian|watsons|doctor|dental/i, category: 'Healthcare' },

  // Entertainment
  { pattern: /cinema|movie|golden village|cathay|shaw|concert|event/i, category: 'Entertainment' },
];

// Score the most likely category for a piece of text by testing the internal
// keyword regexes. A keyword hit yields ~0.85 confidence; no hit falls back to
// { category: 'Other', confidence: 0.2 }. First matching rule wins (same order
// and result NAME as categorize()).
export function scoreCategory(text: string): { category: string; confidence: number } {
  for (const rule of rules) {
    if (rule.pattern.test(text)) {
      return { category: rule.category, confidence: 0.85 };
    }
  }
  return { category: 'Other', confidence: 0.2 };
}

export function categorize(description: string): string {
  return scoreCategory(description).category;
}
