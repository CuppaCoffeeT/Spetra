// camelCase shapes used across the web app (mapped from snake_case rows in api.ts).
export type Direction = 'in' | 'out';

export interface Transaction {
  id: string;
  amount: number;
  currency: string;
  direction: Direction;
  description: string;
  merchant: string | null;
  cardLabel: string | null;
  category: string | null;
  transactionDate: string;
  source: string;
  categoryConfidence: number | null;
  needsReview: boolean;
  notes: string | null;
}

export interface TransactionInput {
  amount: number;
  currency: string;
  direction: Direction;
  description: string;
  merchant?: string | null;
  category: string | null;
  transactionDate: string; // ISO
  notes?: string | null;
  categoryConfidence?: number | null;
}

export interface TransactionItem {
  id: string;
  transactionId: string;
  name: string;
  qty: number;
  unitPrice: number | null;
  amount: number;
  category: string | null;
  sortOrder: number;
}

// Editable line-item row before save (no ids yet).
export interface ItemDraft {
  name: string;
  qty: number;
  unitPrice: number | null;
  amount: number;
  category: string | null;
}

export interface Category {
  id: string;
  name: string;
  color: string | null;
  sortOrder: number;
}

export interface Budget {
  id: string;
  categoryId: string | null;
  month: string; // 'YYYY-MM'
  limitAmount: number;
}

export interface Rule {
  id: string;
  pattern: string;
  category: string;
  priority: number; // 200 = user correction, 100 = default, 50 = LLM-cached
}

export interface IngestKey {
  id: string;
  key: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface CatSuggestion {
  category: string;
  confidence: number;
  tier: 'rule' | 'keyword' | 'llm' | 'none';
}

export interface ReceiptParse {
  merchant: string | null;
  date: string | null; // YYYY-MM-DD
  currency: string;
  total: number | null;
  items: { name: string; qty: number; unitPrice: number | null; amount: number }[];
}
