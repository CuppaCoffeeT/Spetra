export type TransactionDirection = 'in' | 'out';
export type TransactionSource = 'email' | 'manual';

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  direction: TransactionDirection;
  description: string;
  category: string | null;
  transactionDate: string;
  source: TransactionSource;
  sourceEmail: string | null;
  dedupeHash: string;
  createdAt: string;
  syncedAt: string | null;
}

export interface TransactionInput {
  amount: number;
  currency: string;
  direction: TransactionDirection;
  description: string;
  category?: string;
  transactionDate: string;
  source: TransactionSource;
  sourceEmail?: string;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  snippet: string;
  from: string;
  receivedAt: string;
  body: string;
}

export interface GmailAccount {
  email: string;
  lastSync?: string;
}

export interface GmailAuthState {
  accounts: GmailAccount[];
}

export interface BankAccount {
  id: string;
  userId: string;
  bankName: string;
  accountType: 'card' | 'account';
  lastFourDigits: string;
  label: string | null;
  sourceEmail: string | null;
  createdAt: string;
}

export interface BankAccountInput {
  bankName: string;
  accountType: 'card' | 'account';
  lastFourDigits: string;
  sourceEmail?: string;
}
