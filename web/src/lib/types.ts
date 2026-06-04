// camelCase shapes used across the web viewer (mapped from snake_case rows in api.ts).
export type Direction = 'in' | 'out';

export interface Transaction {
  id: string;
  amount: number;
  currency: string;
  direction: Direction;
  description: string;
  category: string | null;
  transactionDate: string;
  source: string;
  categoryConfidence: number | null;
  notes: string | null;
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
