import { SQLiteDatabase, openDatabaseAsync } from 'expo-sqlite';
import { MIGRATIONS } from '@/src/lib/schema';
import {
  Account,
  Transaction,
  TransactionInput,
  TransactionDirection,
  Category,
} from '@/src/types';

const DB_NAME = 'wallet-tracker.db';

let dbInstance: SQLiteDatabase | null = null;

export const getDb = async () => {
  if (!dbInstance) {
    dbInstance = await openDatabaseAsync(DB_NAME);
    await dbInstance.execAsync('PRAGMA foreign_keys = ON;');
  }
  return dbInstance;
};

export const initializeDatabase = async () => {
  const db = await getDb();
  for (const statement of MIGRATIONS) {
    await db.execAsync(statement);
  }
  await ensureSeedData();
};

type TransactionRow = {
  id: number;
  amount_native: number;
  currency_native: string;
  amount_base: number | null;
  currency_base: string | null;
  fx_rate: number | null;
  direction: TransactionDirection;
  description_raw: string | null;
  description_clean: string | null;
  category: string | null;
  category_confidence: number | null;
  account_id: number | null;
  txn_datetime: string;
  ingested_at: string;
  source: string;
  source_meta: string | null;
  dedupe_hash: string | null;
  parser_version: string | null;
  is_transfer: number;
  is_refund: number;
  edited: number;
  notes: string | null;
};

type AccountRow = {
  id: number;
  name: string;
  type: string;
  currency_default: string;
};

type CategoryRow = {
  id: number;
  name: string;
};

const mapTransaction = (row: TransactionRow): Transaction => ({
  id: row.id,
  amountNative: row.amount_native,
  currencyNative: row.currency_native,
  amountBase: row.amount_base,
  currencyBase: row.currency_base,
  fxRate: row.fx_rate,
  direction: row.direction,
  descriptionRaw: row.description_raw,
  descriptionClean: row.description_clean,
  category: row.category,
  categoryConfidence: row.category_confidence,
  accountId: row.account_id,
  txnDatetime: row.txn_datetime,
  ingestedAt: row.ingested_at,
  source: row.source as Transaction['source'],
  sourceMeta: row.source_meta,
  dedupeHash: row.dedupe_hash,
  parserVersion: row.parser_version,
  isTransfer: Boolean(row.is_transfer),
  isRefund: Boolean(row.is_refund),
  edited: Boolean(row.edited),
  notes: row.notes,
});

const mapAccount = (row: AccountRow): Account => ({
  id: row.id,
  name: row.name,
  type: row.type as Account['type'],
  currencyDefault: row.currency_default,
});

const mapCategory = (row: CategoryRow): Category => ({ id: row.id, name: row.name });

export const getTransactions = async (): Promise<Transaction[]> => {
  const db = await getDb();
  const rows = await db.getAllAsync<TransactionRow>(
    'SELECT * FROM transactions ORDER BY datetime(txn_datetime) DESC;'
  );
  return rows.map(mapTransaction);
};

export const getTransactionsForMonth = async (isoMonth: string) => {
  const db = await getDb();
  const rows = await db.getAllAsync<TransactionRow>(
    `SELECT * FROM transactions WHERE substr(txn_datetime, 1, 7) = ? ORDER BY datetime(txn_datetime) DESC;`,
    [isoMonth]
  );
  return rows.map(mapTransaction);
};

export const insertTransaction = async (input: TransactionInput) => {
  const db = await getDb();
  const now = new Date().toISOString();
  const {
    amountNative,
    currencyNative,
    direction,
    description,
    category,
    txnDatetime,
    accountId,
    source = 'manual',
    notes,
  } = input;

  const result = await db.runAsync(
    `INSERT INTO transactions (
      amount_native,
      currency_native,
      direction,
      description_raw,
      description_clean,
      category,
      txn_datetime,
      ingested_at,
      source,
      account_id,
      notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      amountNative,
      currencyNative,
      direction,
      description,
      description,
      category ?? null,
      txnDatetime,
      now,
      source,
      accountId ?? null,
      notes ?? null,
    ]
  );

  return result.lastInsertRowId ?? null;
};

export const updateTransactionCategory = async (
  transactionId: number,
  category: string
) => {
  const db = await getDb();
  await db.runAsync(
    `UPDATE transactions SET category = ?, edited = 1 WHERE id = ?;`,
    [category, transactionId]
  );
};

export const getAccounts = async (): Promise<Account[]> => {
  const db = await getDb();
  const rows = await db.getAllAsync<AccountRow>(
    'SELECT * FROM accounts ORDER BY name COLLATE NOCASE;'
  );
  return rows.map(mapAccount);
};

export const getCategories = async (): Promise<Category[]> => {
  const db = await getDb();
  const rows = await db.getAllAsync<CategoryRow>(
    'SELECT * FROM categories ORDER BY name COLLATE NOCASE;'
  );
  return rows.map(mapCategory);
};

export const insertAccount = async (
  name: string,
  type: Account['type'],
  currencyDefault: string
) => {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO accounts (name, type, currency_default) VALUES (?, ?, ?);`,
    [name, type, currencyDefault]
  );
  return result.lastInsertRowId ?? null;
};

export const insertCategoryIfNotExists = async (name: string) => {
  const db = await getDb();
  await db.runAsync(`INSERT OR IGNORE INTO categories (name) VALUES (?);`, [name]);
  const row = await db.getFirstAsync<CategoryRow>(
    `SELECT id, name FROM categories WHERE name = ?;`,
    [name]
  );
  return row ? row.id : null;
};

export const getTransactionCount = async () => {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM transactions;'
  );
  return row?.count ?? 0;
};

export const ensureSeedData = async () => {
  const db = await getDb();
  const accountCountRow = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM accounts;'
  );
  if (!accountCountRow?.count) {
    await db.runAsync(
      `INSERT INTO accounts (name, type, currency_default) VALUES
        ('UOB Current', 'bank', 'SGD'),
        ('GrabPay Wallet', 'wallet', 'SGD');`
    );
  }

  const categoryCountRow = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM categories;'
  );
  if (!categoryCountRow?.count) {
    await db.runAsync(
      `INSERT INTO categories (name) VALUES
        ('Food'),
        ('Transport'),
        ('Groceries'),
        ('Shopping'),
        ('Income'),
        ('Bills');`
    );
  }

  const transactionCount = await getTransactionCount();
  if (transactionCount === 0) {
    const now = new Date();
    const sample = [
      {
        amount_native: -18.4,
        currency_native: 'SGD',
        direction: 'out',
        description: 'Lunch at Amoy Street Food Centre',
        category: 'Food',
        account_id: 1,
        txn_datetime: new Date(now.getFullYear(), now.getMonth(), 5, 12, 30).toISOString(),
      },
      {
        amount_native: -12.0,
        currency_native: 'SGD',
        direction: 'out',
        description: 'Grab Transport Ride',
        category: 'Transport',
        account_id: 2,
        txn_datetime: new Date(now.getFullYear(), now.getMonth(), 6, 9, 15).toISOString(),
      },
      {
        amount_native: 2500,
        currency_native: 'SGD',
        direction: 'in',
        description: 'Salary Credit',
        category: 'Income',
        account_id: 1,
        txn_datetime: new Date(now.getFullYear(), now.getMonth(), 1, 10, 0).toISOString(),
      },
    ];

    for (const item of sample) {
      await db.runAsync(
        `INSERT INTO transactions (
          amount_native,
          currency_native,
          direction,
          description_raw,
          description_clean,
          category,
          txn_datetime,
          ingested_at,
          source,
          account_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'email', ?);`,
        [
          Math.abs(item.amount_native),
          item.currency_native,
          item.direction,
          item.description,
          item.description,
          item.category,
          item.txn_datetime,
          now.toISOString(),
          item.account_id,
        ]
      );
    }
  }
};
