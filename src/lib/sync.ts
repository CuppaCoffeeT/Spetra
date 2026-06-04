import { supabase } from './supabase';
import { getUnsyncedTransactions, markAsSynced, insertTransaction } from './db';
import type { Transaction, TransactionInput, BankAccount, BankAccountInput } from '../types';
import { Platform } from 'react-native';

export async function syncToSupabase(userId: string): Promise<number> {
  if (Platform.OS === 'web') {
    // On web, write directly to Supabase
    return 0;
  }

  const unsynced = await getUnsyncedTransactions(userId);

  if (unsynced.length === 0) {
    return 0;
  }

  const { error } = await supabase.from('transactions').upsert(
    unsynced.map((t) => ({
      id: t.id,
      user_id: t.userId,
      amount: t.amount,
      currency: t.currency,
      direction: t.direction,
      description: t.description,
      category: t.category,
      transaction_date: t.transactionDate,
      source: t.source,
      source_email: t.sourceEmail,
      dedupe_hash: t.dedupeHash,
      created_at: t.createdAt,
      synced_at: new Date().toISOString(),
    })),
    { onConflict: 'dedupe_hash' }
  );

  if (error) {
    console.error('Sync to Supabase failed:', error);
    throw error;
  }

  await markAsSynced(unsynced.map((t) => t.id));
  return unsynced.length;
}

export async function syncFromSupabase(userId: string): Promise<number> {
  if (Platform.OS === 'web') {
    // On web, we read directly from Supabase
    return 0;
  }

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('transaction_date', { ascending: false });

  if (error) {
    console.error('Sync from Supabase failed:', error);
    throw error;
  }

  let imported = 0;

  for (const row of data || []) {
    const input: TransactionInput = {
      amount: row.amount,
      currency: row.currency,
      direction: row.direction,
      description: row.description,
      category: row.category,
      transactionDate: row.transaction_date,
      source: row.source,
      sourceEmail: row.source_email,
    };

    const result = await insertTransaction(userId, input);
    if (result) {
      imported++;
    }
  }

  return imported;
}

// For web: save directly to Supabase
export async function saveTransactionToSupabase(
  userId: string,
  input: TransactionInput
): Promise<Transaction | null> {
  const dedupeHash = `${input.amount}-${input.transactionDate.substring(0, 10)}-${input.description.substring(0, 30).toLowerCase()}`;
  let hash = 0;
  for (let i = 0; i < dedupeHash.length; i++) {
    const char = dedupeHash.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const hashStr = Math.abs(hash).toString(36);

  const { data, error } = await supabase
    .from('transactions')
    .upsert({
      user_id: userId,
      amount: input.amount,
      currency: input.currency,
      direction: input.direction,
      description: input.description,
      category: input.category || null,
      transaction_date: input.transactionDate,
      source: input.source,
      source_email: input.sourceEmail || null,
      dedupe_hash: hashStr,
      synced_at: new Date().toISOString(),
    }, { onConflict: 'dedupe_hash' })
    .select()
    .single();

  if (error) {
    console.error('Save to Supabase failed:', error);
    return null;
  }

  return {
    id: data.id,
    userId: data.user_id,
    amount: data.amount,
    currency: data.currency,
    direction: data.direction,
    description: data.description,
    category: data.category,
    transactionDate: data.transaction_date,
    source: data.source,
    sourceEmail: data.source_email,
    dedupeHash: data.dedupe_hash,
    createdAt: data.created_at,
    syncedAt: data.synced_at,
  };
}

export async function saveTransactionsBatchToSupabase(
  userId: string,
  inputs: TransactionInput[]
): Promise<number> {
  if (inputs.length === 0) return 0;

  const rows = inputs.map((input) => {
    const dedupeStr = `${input.amount}-${input.transactionDate.substring(0, 10)}-${input.description.substring(0, 30).toLowerCase()}`;
    let hash = 0;
    for (let i = 0; i < dedupeStr.length; i++) {
      const char = dedupeStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return {
      user_id: userId,
      amount: input.amount,
      currency: input.currency,
      direction: input.direction,
      description: input.description,
      category: input.category || null,
      transaction_date: input.transactionDate,
      source: input.source,
      source_email: input.sourceEmail || null,
      dedupe_hash: Math.abs(hash).toString(36),
      synced_at: new Date().toISOString(),
    };
  });

  // Deduplicate rows by dedupe_hash to avoid Postgres "ON CONFLICT DO UPDATE
  // command cannot affect row a second time" error
  const uniqueRows = Array.from(
    new Map(rows.map((r) => [r.dedupe_hash, r])).values()
  );

  const { error, count } = await supabase
    .from('transactions')
    .upsert(uniqueRows, { onConflict: 'dedupe_hash', count: 'exact' });

  if (error) {
    console.error('Batch save to Supabase failed:', error);
    return 0;
  }

  return count ?? uniqueRows.length;
}

export async function updateTransactionInSupabase(
  id: string,
  updates: { category?: string }
): Promise<boolean> {
  const updateData: Record<string, unknown> = {};
  if (updates.category !== undefined) {
    updateData.category = updates.category;
  }

  const { error } = await supabase
    .from('transactions')
    .update(updateData)
    .eq('id', id);

  if (error) {
    console.error('Update transaction failed:', error);
    return false;
  }
  return true;
}

// Bank accounts
export async function saveBankAccountToSupabase(
  userId: string,
  input: BankAccountInput
): Promise<BankAccount | null> {
  const { data, error } = await supabase
    .from('bank_accounts')
    .upsert({
      user_id: userId,
      bank_name: input.bankName,
      account_type: input.accountType,
      last_four_digits: input.lastFourDigits,
      source_email: input.sourceEmail || null,
    }, { onConflict: 'user_id,bank_name,last_four_digits' })
    .select()
    .single();

  if (error) {
    console.error('Save bank account failed:', error);
    return null;
  }

  return {
    id: data.id,
    userId: data.user_id,
    bankName: data.bank_name,
    accountType: data.account_type,
    lastFourDigits: data.last_four_digits,
    label: data.label,
    sourceEmail: data.source_email,
    createdAt: data.created_at,
  };
}

export async function getBankAccountsFromSupabase(userId: string): Promise<BankAccount[]> {
  const { data, error } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('user_id', userId)
    .order('bank_name', { ascending: true });

  if (error) {
    console.error('Fetch bank accounts failed:', error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    bankName: row.bank_name,
    accountType: row.account_type,
    lastFourDigits: row.last_four_digits,
    label: row.label,
    sourceEmail: row.source_email,
    createdAt: row.created_at,
  }));
}

export async function updateBankAccountLabelInSupabase(
  id: string,
  label: string
): Promise<boolean> {
  const { error } = await supabase
    .from('bank_accounts')
    .update({ label })
    .eq('id', id);

  if (error) {
    console.error('Update bank account label failed:', error);
    return false;
  }
  return true;
}

export async function getTransactionsFromSupabase(userId: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('transaction_date', { ascending: false });

  if (error) {
    console.error('Fetch from Supabase failed:', error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    amount: row.amount,
    currency: row.currency,
    direction: row.direction,
    description: row.description,
    category: row.category,
    transactionDate: row.transaction_date,
    source: row.source,
    sourceEmail: row.source_email,
    dedupeHash: row.dedupe_hash,
    createdAt: row.created_at,
    syncedAt: row.synced_at,
  }));
}
