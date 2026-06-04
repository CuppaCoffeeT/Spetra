import { supabase } from './supabase';
import type { Receipt, ReceiptInput } from '../types';

type ReceiptRow = {
  id: string;
  user_id: string;
  transaction_id: string | null;
  storage_path: string;
  merchant: string | null;
  total: number | null;
  currency: string | null;
  receipt_date: string | null;
  raw_text: string | null;
};

function mapRow(row: ReceiptRow): Receipt {
  return {
    id: row.id,
    userId: row.user_id,
    transactionId: row.transaction_id,
    storagePath: row.storage_path,
    merchant: row.merchant,
    total: row.total,
    currency: row.currency,
    receiptDate: row.receipt_date,
    rawText: row.raw_text,
  };
}

/**
 * Upload a receipt image to the private 'receipts' Storage bucket.
 * Returns the storage path (null on error). Works on web + native (SDK 54):
 * the image uri is fetched to an ArrayBuffer before upload.
 */
export async function uploadReceiptImage(
  userId: string,
  imageUri: string
): Promise<string | null> {
  try {
    const path = `${userId}/${new Date().getTime()}.jpg`;
    const buf = await (await fetch(imageUri)).arrayBuffer();

    const { error } = await supabase.storage
      .from('receipts')
      .upload(path, buf, { contentType: 'image/jpeg', upsert: true });

    if (error) {
      console.error('Upload receipt image failed:', error);
      return null;
    }

    return path;
  } catch (err) {
    console.error('Upload receipt image failed:', err);
    return null;
  }
}

export async function saveReceiptToSupabase(
  userId: string,
  input: ReceiptInput
): Promise<Receipt | null> {
  const { data, error } = await supabase
    .from('receipts')
    .insert({
      user_id: userId,
      transaction_id: input.transactionId ?? null,
      storage_path: input.storagePath,
      merchant: input.merchant ?? null,
      total: input.total ?? null,
      currency: input.currency ?? null,
      receipt_date: input.receiptDate ?? null,
      raw_text: input.rawText ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error('Save receipt failed:', error);
    return null;
  }

  return mapRow(data);
}

export async function getReceiptForTransaction(
  transactionId: string
): Promise<Receipt | null> {
  const { data, error } = await supabase
    .from('receipts')
    .select('*')
    .eq('transaction_id', transactionId)
    .maybeSingle();

  if (error) {
    console.error('Fetch receipt failed:', error);
    return null;
  }

  return data ? mapRow(data) : null;
}

/**
 * Create a short-lived (1h) signed URL for displaying a stored receipt image.
 */
export async function getReceiptSignedUrl(
  storagePath: string
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('receipts')
    .createSignedUrl(storagePath, 3600);

  if (error) {
    console.error('Create receipt signed URL failed:', error);
    return null;
  }

  return data?.signedUrl ?? null;
}
