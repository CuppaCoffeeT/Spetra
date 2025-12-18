export const CREATE_TABLE_ACCOUNTS = `
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    currency_default TEXT NOT NULL
  );
`;

export const CREATE_TABLE_TRANSACTIONS = `
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount_native REAL NOT NULL,
    currency_native TEXT NOT NULL,
    amount_base REAL,
    currency_base TEXT,
    fx_rate REAL,
    direction TEXT NOT NULL CHECK(direction IN ('in', 'out')),
    description_raw TEXT,
    description_clean TEXT,
    category TEXT,
    category_confidence REAL,
    account_id INTEGER,
    txn_datetime TEXT NOT NULL,
    ingested_at TEXT NOT NULL,
    source TEXT NOT NULL CHECK(source IN ('sms', 'email', 'push', 'manual')),
    source_meta TEXT,
    dedupe_hash TEXT UNIQUE,
    parser_version TEXT,
    is_transfer INTEGER DEFAULT 0,
    is_refund INTEGER DEFAULT 0,
    edited INTEGER DEFAULT 0,
    notes TEXT,
    FOREIGN KEY(account_id) REFERENCES accounts(id)
  );
`;

export const CREATE_TABLE_RULES = `
  CREATE TABLE IF NOT EXISTS rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern TEXT NOT NULL,
    category TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 100
  );
`;

export const CREATE_TABLE_FX = `
  CREATE TABLE IF NOT EXISTS fx_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    base TEXT NOT NULL,
    quote TEXT NOT NULL,
    rate REAL NOT NULL
  );
`;

export const CREATE_TABLE_CATEGORIES = `
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );
`;

export const MIGRATIONS = [
  CREATE_TABLE_ACCOUNTS,
  CREATE_TABLE_TRANSACTIONS,
  CREATE_TABLE_RULES,
  CREATE_TABLE_FX,
  CREATE_TABLE_CATEGORIES,
];
