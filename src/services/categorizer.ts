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

export function categorize(description: string): string {
  for (const rule of rules) {
    if (rule.pattern.test(description)) {
      return rule.category;
    }
  }
  return 'Other';
}
