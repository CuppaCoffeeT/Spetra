import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import type { Transaction, TransactionInput } from '../types';

const DB_NAME = 'spend-tracker.db';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  if (Platform.OS === 'web') {
    // SQLite not available on web - use in-memory store
    throw new Error('SQLite not available on web');
  }

  db = await SQLite.openDatabaseAsync(DB_NAME);
  await initializeSchema(db);
  return db;
}

async function initializeSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'SGD',
      direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
      description TEXT NOT NULL,
      category TEXT,
      transaction_date TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'email',
      source_email TEXT,
      dedupe_hash TEXT UNIQUE,
      created_at TEXT NOT NULL,
      synced_at TEXT,
      receipt_id TEXT,
      notes TEXT,
      category_confidence REAL,
      edited INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
    CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_synced ON transactions(synced_at);
  `);

  await migrateSchema(database);
}

async function migrateSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  const result = await database.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  );
  const version = result?.user_version ?? 0;

  if (version < 1) {
    // Existing installs predate the wallet/budgeting columns. SQLite lacks
    // ADD COLUMN IF NOT EXISTS, so guard each ALTER against re-runs.
    const alters = [
      'ALTER TABLE transactions ADD COLUMN receipt_id TEXT',
      'ALTER TABLE transactions ADD COLUMN notes TEXT',
      'ALTER TABLE transactions ADD COLUMN category_confidence REAL',
      'ALTER TABLE transactions ADD COLUMN edited INTEGER NOT NULL DEFAULT 0',
    ];

    for (const sql of alters) {
      try {
        await database.execAsync(sql);
      } catch {
        // Column already exists (table was created with the new schema).
      }
    }

    await database.execAsync('PRAGMA user_version = 1');
  }
}

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function generateDedupeHash(amount: number, date: string, description: string): string {
  const key = `${amount}-${date.substring(0, 10)}-${description.substring(0, 30).toLowerCase()}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export async function insertTransaction(
  userId: string,
  input: TransactionInput
): Promise<Transaction | null> {
  const database = await getDatabase();

  const dedupeHash = generateDedupeHash(input.amount, input.transactionDate, input.description);

  // Check for duplicate
  const existing = await database.getFirstAsync<{ id: string }>(
    'SELECT id FROM transactions WHERE dedupe_hash = ?',
    [dedupeHash]
  );

  if (existing) {
    return null; // Duplicate
  }

  const id = generateId();
  const now = new Date().toISOString();

  await database.runAsync(
    `INSERT INTO transactions (id, user_id, amount, currency, direction, description, category, transaction_date, source, source_email, dedupe_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      input.amount,
      input.currency,
      input.direction,
      input.description,
      input.category || null,
      input.transactionDate,
      input.source,
      input.sourceEmail || null,
      dedupeHash,
      now,
    ]
  );

  return {
    id,
    userId,
    amount: input.amount,
    currency: input.currency,
    direction: input.direction,
    description: input.description,
    category: input.category || null,
    transactionDate: input.transactionDate,
    source: input.source,
    sourceEmail: input.sourceEmail || null,
    dedupeHash,
    createdAt: now,
    syncedAt: null,
  };
}

export async function getTransactions(userId: string): Promise<Transaction[]> {
  const database = await getDatabase();

  const rows = await database.getAllAsync<{
    id: string;
    user_id: string;
    amount: number;
    currency: string;
    direction: string;
    description: string;
    category: string | null;
    transaction_date: string;
    source: string;
    source_email: string | null;
    dedupe_hash: string;
    created_at: string;
    synced_at: string | null;
    receipt_id: string | null;
    notes: string | null;
    category_confidence: number | null;
    edited: number;
  }>(
    'SELECT * FROM transactions WHERE user_id = ? ORDER BY transaction_date DESC',
    [userId]
  );

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    amount: row.amount,
    currency: row.currency,
    direction: row.direction as 'in' | 'out',
    description: row.description,
    category: row.category,
    transactionDate: row.transaction_date,
    source: row.source as 'email' | 'manual',
    sourceEmail: row.source_email,
    dedupeHash: row.dedupe_hash,
    createdAt: row.created_at,
    syncedAt: row.synced_at,
    receiptId: row.receipt_id,
    notes: row.notes,
    categoryConfidence: row.category_confidence,
    edited: row.edited === 1,
  }));
}

export async function getUnsyncedTransactions(userId: string): Promise<Transaction[]> {
  const database = await getDatabase();

  const rows = await database.getAllAsync<{
    id: string;
    user_id: string;
    amount: number;
    currency: string;
    direction: string;
    description: string;
    category: string | null;
    transaction_date: string;
    source: string;
    source_email: string | null;
    dedupe_hash: string;
    created_at: string;
    synced_at: string | null;
    receipt_id: string | null;
    notes: string | null;
    category_confidence: number | null;
    edited: number;
  }>(
    'SELECT * FROM transactions WHERE user_id = ? AND synced_at IS NULL',
    [userId]
  );

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    amount: row.amount,
    currency: row.currency,
    direction: row.direction as 'in' | 'out',
    description: row.description,
    category: row.category,
    transactionDate: row.transaction_date,
    source: row.source as 'email' | 'manual',
    sourceEmail: row.source_email,
    dedupeHash: row.dedupe_hash,
    createdAt: row.created_at,
    syncedAt: row.synced_at,
    receiptId: row.receipt_id,
    notes: row.notes,
    categoryConfidence: row.category_confidence,
    edited: row.edited === 1,
  }));
}

export async function markAsSynced(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const database = await getDatabase();
  const now = new Date().toISOString();
  const placeholders = ids.map(() => '?').join(',');

  await database.runAsync(
    `UPDATE transactions SET synced_at = ? WHERE id IN (${placeholders})`,
    [now, ...ids]
  );
}
