import { supabase } from './supabase';
import type { Budget, Transaction } from '../types';

type BudgetRow = {
  id: string;
  user_id: string;
  category_id: string | null;
  month: string;
  limit_amount: number;
  created_at: string;
  updated_at: string;
};

function mapRow(row: BudgetRow): Budget {
  return {
    id: row.id,
    userId: row.user_id,
    categoryId: row.category_id,
    month: row.month,
    limitAmount: row.limit_amount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getBudgetsFromSupabase(userId: string): Promise<Budget[]> {
  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', userId)
    .order('month', { ascending: false });

  if (error) {
    console.error('Fetch budgets failed:', error);
    return [];
  }

  return (data || []).map(mapRow);
}

export async function upsertBudgetToSupabase(
  userId: string,
  input: { categoryId: string; month: string; limitAmount: number }
): Promise<Budget | null> {
  const { data, error } = await supabase
    .from('budgets')
    .upsert(
      {
        user_id: userId,
        category_id: input.categoryId,
        month: input.month,
        limit_amount: input.limitAmount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,category_id,month' }
    )
    .select()
    .single();

  if (error) {
    console.error('Upsert budget failed:', error);
    return null;
  }

  return mapRow(data);
}

export async function deleteBudgetFromSupabase(id: string): Promise<boolean> {
  const { error } = await supabase.from('budgets').delete().eq('id', id);

  if (error) {
    console.error('Delete budget failed:', error);
    return false;
  }
  return true;
}

// --- Pure helpers (DRY — shared by both budget screens) ---

/** 'YYYY-MM' for today. */
export function currentMonth(): string {
  return monthOf(new Date().toISOString());
}

/** 'YYYY-MM' of an ISO date string. */
export function monthOf(isoDate: string): string {
  const d = new Date(isoDate);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Map of category name -> total 'out' amount for the given month.
 * Income ('in') never counts. Null/empty categories are skipped.
 */
export function spentByCategory(
  transactions: Transaction[],
  month: string
): Record<string, number> {
  const totals: Record<string, number> = {};

  for (const tx of transactions) {
    if (tx.direction !== 'out') continue;
    if (!tx.category) continue;
    if (monthOf(tx.transactionDate) !== month) continue;

    totals[tx.category] = (totals[tx.category] || 0) + tx.amount;
  }

  return totals;
}
