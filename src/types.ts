export type TransactionDirection = 'in' | 'out';

export type TransactionSource = 'sms' | 'email' | 'push' | 'manual';

export interface Transaction {
  id: number;
  amountNative: number;
  currencyNative: string;
  amountBase: number | null;
  currencyBase: string | null;
  fxRate: number | null;
  direction: TransactionDirection;
  descriptionRaw: string | null;
  descriptionClean: string | null;
  category: string | null;
  categoryConfidence: number | null;
  accountId: number | null;
  txnDatetime: string;
  ingestedAt: string;
  source: TransactionSource;
  sourceMeta: string | null;
  dedupeHash: string | null;
  parserVersion: string | null;
  isTransfer: boolean;
  isRefund: boolean;
  edited: boolean;
  notes: string | null;
}

export interface Account {
  id: number;
  name: string;
  type: 'bank' | 'wallet' | 'cash' | 'card' | 'other';
  currencyDefault: string;
}

export interface Rule {
  id: number;
  pattern: string;
  category: string;
  priority: number;
}

export interface FxRate {
  date: string;
  base: string;
  quote: string;
  rate: number;
}

export interface Category {
  id: number;
  name: string;
}

export type TransactionInput = {
  amountNative: number;
  currencyNative: string;
  direction: TransactionDirection;
  description: string;
  category?: string;
  txnDatetime: string;
  accountId?: number | null;
  source?: TransactionSource;
  notes?: string;
};

export interface MonthlySummary {
  monthKey: string;
  totalIn: number;
  totalOut: number;
  net: number;
}

export interface CategorizedTotal {
  category: string;
  total: number;
}
