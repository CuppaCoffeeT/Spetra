const rules: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /grab/i, category: 'Transport' },
  { pattern: /taxi|cab/i, category: 'Transport' },
  { pattern: /fairprice|redmart|cold storage/i, category: 'Groceries' },
  { pattern: /shopee|lazada|amazon/i, category: 'Shopping' },
  { pattern: /paynow/i, category: 'Transfers' },
  { pattern: /salary|payroll|income/i, category: 'Income' },
  { pattern: /coffee|starbucks|%/i, category: 'Food' },
  { pattern: /food|restaurant|dining/i, category: 'Food' },
];

export const categorizeDescription = (description: string | null | undefined) => {
  if (!description) return undefined;
  for (const rule of rules) {
    if (rule.pattern.test(description)) {
      return rule.category;
    }
  }
  return undefined;
};
