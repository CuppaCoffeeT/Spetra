import { supabase } from './supabase';
import type { Transaction, Category, Budget } from './types';

export async function fetchTransactions(userId: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('transaction_date', { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    amount: r.amount,
    currency: r.currency,
    direction: r.direction,
    description: r.description,
    category: r.category,
    transactionDate: r.transaction_date,
    source: r.source,
    categoryConfidence: r.category_confidence ?? null,
    notes: r.notes ?? null,
  }));
}

export async function fetchCategories(userId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color ?? null,
    sortOrder: r.sort_order ?? 0,
  }));
}

export async function fetchBudgets(userId: string): Promise<Budget[]> {
  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', userId)
    .limit(1000);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    categoryId: r.category_id ?? null,
    month: r.month,
    limitAmount: r.limit_amount,
  }));
}

// --- spend math (mirrors src/lib/budgets.ts) ---
export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function spentByCategory(
  transactions: Transaction[],
  month: string
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of transactions) {
    if (t.direction !== 'out') continue;
    if (monthOf(t.transactionDate) !== month) continue;
    const key = t.category ?? 'Uncategorized';
    out[key] = (out[key] ?? 0) + t.amount;
  }
  return out;
}

export function formatMoney(amount: number, currency = 'SGD'): string {
  const symbol = currency === 'SGD' || currency === 'USD' || currency === 'AUD' ? '$' : currency + ' ';
  return `${symbol}${Math.abs(amount).toFixed(2)}`;
}

export function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
