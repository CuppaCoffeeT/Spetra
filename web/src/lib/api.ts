import { supabase } from './supabase';
import type {
  Budget,
  CategorizerStatus,
  CatSuggestion,
  Category,
  IngestKey,
  ItemDraft,
  ReceiptParse,
  Rule,
  Transaction,
  TransactionInput,
  TransactionItem,
} from './types';

// ---------------------------------------------------------------- transactions

function mapTxn(r: any): Transaction {
  return {
    id: r.id,
    amount: r.amount,
    currency: r.currency,
    direction: r.direction,
    description: r.description,
    merchant: r.merchant ?? null,
    cardLabel: r.card_label ?? null,
    category: r.category,
    transactionDate: r.transaction_date,
    source: r.source,
    categoryConfidence: r.category_confidence ?? null,
    needsReview: r.needs_review ?? false,
    notes: r.notes ?? null,
  };
}

export async function fetchTransactions(userId: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('transaction_date', { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []).map(mapTxn);
}

// Legacy dedupe hash — identical to the Expo app's, so manual double-entry of
// the same amount/day/description is rejected as a duplicate (matches native).
export function legacyDedupeHash(amount: number, date: string, description: string): string {
  const key = `${amount}-${date.substring(0, 10)}-${description.substring(0, 30).toLowerCase()}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export async function insertTransaction(
  userId: string,
  input: TransactionInput,
  items: ItemDraft[]
): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      amount: input.amount,
      currency: input.currency,
      direction: input.direction,
      description: input.description,
      merchant: input.merchant ?? null,
      category: input.category,
      category_confidence: input.categoryConfidence ?? null,
      transaction_date: input.transactionDate,
      source: 'manual',
      notes: input.notes ?? null,
      dedupe_hash: legacyDedupeHash(input.amount, input.transactionDate, input.description),
      synced_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') throw new Error('Duplicate: same amount, date and description already exists.');
    throw error;
  }
  const txn = mapTxn(data);
  if (items.length > 0) await saveItems(userId, txn.id, items);
  return txn;
}

export async function updateTransaction(
  id: string,
  fields: Partial<{
    amount: number;
    direction: 'in' | 'out';
    description: string;
    merchant: string | null;
    category: string | null;
    transactionDate: string;
    notes: string | null;
    needsReview: boolean;
  }>
): Promise<void> {
  const row: Record<string, unknown> = { edited: true };
  if (fields.amount !== undefined) row.amount = fields.amount;
  if (fields.direction !== undefined) row.direction = fields.direction;
  if (fields.description !== undefined) row.description = fields.description;
  if (fields.merchant !== undefined) row.merchant = fields.merchant;
  if (fields.category !== undefined) row.category = fields.category;
  if (fields.transactionDate !== undefined) row.transaction_date = fields.transactionDate;
  if (fields.notes !== undefined) row.notes = fields.notes;
  if (fields.needsReview !== undefined) row.needs_review = fields.needsReview;
  // NEVER touch dedupe_hash (frozen at insert — PRD R3).
  const { error } = await supabase.from('transactions').update(row).eq('id', id);
  if (error) throw error;
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) throw error;
}

// ------------------------------------------------------------------ line items

function mapItem(r: any): TransactionItem {
  return {
    id: r.id,
    transactionId: r.transaction_id,
    name: r.name,
    qty: r.qty,
    unitPrice: r.unit_price ?? null,
    amount: r.amount,
    category: r.category ?? null,
    sortOrder: r.sort_order ?? 0,
  };
}

export async function fetchItems(transactionId: string): Promise<TransactionItem[]> {
  const { data, error } = await supabase
    .from('transaction_items')
    .select('*')
    .eq('transaction_id', transactionId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapItem);
}

// Which transactions (of the given ids) have at least one line item.
export async function fetchItemizedIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('transaction_items')
    .select('transaction_id')
    .eq('user_id', userId)
    .limit(5000);
  if (error) throw error;
  return new Set((data ?? []).map((r: any) => r.transaction_id as string));
}

// Replace-all save: simplest correct diff for a personal-scale item list.
export async function saveItems(
  userId: string,
  transactionId: string,
  items: ItemDraft[]
): Promise<void> {
  const del = await supabase.from('transaction_items').delete().eq('transaction_id', transactionId);
  if (del.error) throw del.error;
  if (items.length === 0) return;
  const { error } = await supabase.from('transaction_items').insert(
    items.map((it, i) => ({
      user_id: userId,
      transaction_id: transactionId,
      name: it.name,
      qty: it.qty,
      unit_price: it.unitPrice,
      amount: it.amount,
      category: it.category,
      sort_order: i,
    }))
  );
  if (error) throw error;
}

// ------------------------------------------------------------------ categories

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

export async function createCategory(
  userId: string,
  name: string,
  color: string,
  sortOrder: number
): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .insert({ user_id: userId, name, color, sort_order: sortOrder });
  if (error) throw error;
}

export async function updateCategory(
  id: string,
  fields: Partial<{ name: string; color: string }>
): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
}

// ----------------------------------------------------------------------- rules

export async function fetchRules(userId: string): Promise<Rule[]> {
  const { data, error } = await supabase
    .from('rules')
    .select('*')
    .eq('user_id', userId)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    pattern: r.pattern,
    category: r.category,
    priority: r.priority,
  }));
}

export async function deleteRule(id: string): Promise<void> {
  const { error } = await supabase.from('rules').delete().eq('id', id);
  if (error) throw error;
}

// Stable lowercase merchant key — mirrors src/lib/rules.ts extractMerchantKey.
export function extractMerchantKey(description: string): string {
  const tokens = description.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ');
  for (const token of tokens) if (token.length >= 3) return token;
  return '';
}

// The learning loop: a user correction becomes a priority-200 rule that
// outranks keywords (85) and LLM-cached rules (50) on all future ingests.
export async function learnRule(
  userId: string,
  description: string,
  category: string
): Promise<void> {
  const pattern = extractMerchantKey(description);
  if (!pattern) return;
  const { error } = await supabase.from('rules').upsert(
    {
      user_id: userId,
      pattern,
      category,
      priority: 200,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,pattern' }
  );
  if (error) console.error('learnRule failed:', error.message);
}

// --------------------------------------------------------------------- budgets

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

export async function setBudget(
  userId: string,
  categoryId: string,
  month: string,
  limitAmount: number
): Promise<void> {
  const { error } = await supabase.from('budgets').upsert(
    {
      user_id: userId,
      category_id: categoryId,
      month,
      limit_amount: limitAmount,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,category_id,month' }
  );
  if (error) throw error;
}

export async function clearBudget(id: string): Promise<void> {
  const { error } = await supabase.from('budgets').delete().eq('id', id);
  if (error) throw error;
}

// ----------------------------------------------------------------- ingest keys

export async function fetchIngestKeys(userId: string): Promise<IngestKey[]> {
  const { data, error } = await supabase
    .from('ingest_keys')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    key: r.key,
    label: r.label ?? null,
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at ?? null,
  }));
}

export async function createIngestKey(userId: string, label: string): Promise<IngestKey> {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const key = 'stk_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const { data, error } = await supabase
    .from('ingest_keys')
    .insert({ user_id: userId, key, label })
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    key: data.key,
    label: data.label ?? null,
    createdAt: data.created_at,
    lastUsedAt: null,
  };
}

export async function deleteIngestKey(id: string): Promise<void> {
  const { error } = await supabase.from('ingest_keys').delete().eq('id', id);
  if (error) throw error;
}

// -------------------------------------------------------------- edge functions

export async function suggestCategory(text: string): Promise<CatSuggestion | null> {
  const { data, error } = await supabase.functions.invoke('categorize', { body: { text } });
  if (error) {
    console.error('categorize invoke failed:', error.message ?? error);
    return null;
  }
  return data as CatSuggestion;
}

// Teach the categorizer a correction server-side (embedded example + rule).
// Falls back to the client-side rule upsert if the function isn't reachable.
export async function learnCorrection(
  userId: string,
  text: string,
  category: string
): Promise<void> {
  const { error } = await supabase.functions.invoke('categorize', {
    body: { action: 'learn', text, category },
  });
  if (error) {
    console.error('server learn failed, falling back to rule-only:', error.message ?? error);
    await learnRule(userId, text, category);
  }
}

export async function seedCategorizer(): Promise<{ seeded: number; remaining: number; total: number }> {
  const { data, error } = await supabase.functions.invoke('categorize', {
    body: { action: 'seed' },
  });
  if (error) throw new Error('Seeding failed — are the edge functions deployed?');
  return data;
}

export async function categorizerStatus(): Promise<CategorizerStatus | null> {
  const { data, error } = await supabase.functions.invoke('categorize', {
    body: { action: 'status' },
  });
  if (error) return null;
  return data as CategorizerStatus;
}

export class ReceiptNotConfiguredError extends Error {}

export async function parseReceipt(imageBase64: string, mediaType: string): Promise<ReceiptParse> {
  const { data, error } = await supabase.functions.invoke('parse-receipt', {
    body: { imageBase64, mediaType },
  });
  if (error) {
    // supabase-js surfaces non-2xx as FunctionsHttpError with .context (Response)
    const status = (error as any)?.context?.status;
    if (status === 501) {
      throw new ReceiptNotConfiguredError(
        'AI receipt extraction is not configured (set the ANTHROPIC_API_KEY function secret).'
      );
    }
    throw new Error('Receipt extraction failed — try a clearer photo.');
  }
  return data as ReceiptParse;
}

// Attach the receipt image + row to a transaction (best-effort; never blocks the save).
export async function uploadReceipt(
  userId: string,
  transactionId: string,
  file: File,
  parsed: ReceiptParse | null
): Promise<void> {
  try {
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${userId}/${transactionId}-${Date.now()}.${ext}`;
    const up = await supabase.storage.from('receipts').upload(path, file, { upsert: false });
    if (up.error) throw up.error;
    const { error } = await supabase.from('receipts').insert({
      user_id: userId,
      transaction_id: transactionId,
      storage_path: path,
      merchant: parsed?.merchant ?? null,
      total: parsed?.total ?? null,
      currency: parsed?.currency ?? null,
      receipt_date: parsed?.date ? new Date(parsed.date).toISOString() : null,
    });
    if (error) throw error;
  } catch (e) {
    console.error('receipt upload failed (transaction saved anyway):', e);
  }
}

// Downscale + JPEG-encode an image for the vision API (keeps payloads small).
export async function fileToResizedBase64(
  file: File,
  maxDim = 1600
): Promise<{ base64: string; mediaType: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return { base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' };
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
