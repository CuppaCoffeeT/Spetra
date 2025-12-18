import { create } from 'zustand';
import { format } from 'date-fns';

import {
  initializeDatabase,
  getTransactionsForMonth,
  insertTransaction,
  updateTransactionCategory,
  getAccounts,
  insertAccount,
  getCategories,
  insertCategoryIfNotExists,
} from '@/src/lib/db';
import {
  Account,
  CategorizedTotal,
  MonthlySummary,
  Transaction,
  TransactionDirection,
  TransactionInput,
} from '@/src/types';

export interface Filters {
  category?: string;
  direction?: TransactionDirection;
  accountId?: number;
}

interface AppState {
  loading: boolean;
  bootstrapped: boolean;
  transactions: Transaction[];
  accounts: Account[];
  categories: import('@/src/types').Category[];
  selectedMonth: string; // YYYY-MM
  filters: Filters;
  bootstrap: () => Promise<void>;
  refreshTransactions: (monthKey?: string) => Promise<void>;
  addTransaction: (input: TransactionInput) => Promise<void>;
  updateCategory: (transactionId: number, category: string) => Promise<void>;
  addAccount: (payload: { name: string; type: Account['type']; currency: string }) => Promise<void>;
  addCategory: (name: string) => Promise<void>;
  setSelectedMonth: (monthKey: string) => void;
  setFilters: (filters: Filters) => void;
  getVisibleTransactions: () => Transaction[];
  getMonthlySummary: (monthKey?: string) => MonthlySummary;
  getTopCategories: (monthKey?: string, limit?: number) => CategorizedTotal[];
}

const currentMonthKey = () => format(new Date(), 'yyyy-MM');

export const useAppStore = create<AppState>()((set, get) => ({
  loading: false,
  bootstrapped: false,
  transactions: [],
  accounts: [],
  categories: [],
  selectedMonth: currentMonthKey(),
  filters: {},
  bootstrap: async () => {
    const state = get();
    if (state.bootstrapped || state.loading) {
      return;
    }
    set({ loading: true });
    try {
      await initializeDatabase();
      const [accounts, categories, transactions] = await Promise.all([
        getAccounts(),
        getCategories(),
        getTransactionsForMonth(state.selectedMonth),
      ]);
      set({
        accounts,
        categories,
        transactions,
        bootstrapped: true,
        loading: false,
      });
    } catch (error) {
      console.error('Failed to bootstrap database', error);
      set({ loading: false });
      throw error;
    }
  },
  refreshTransactions: async (monthKey) => {
    const key = monthKey ?? get().selectedMonth;
    const transactions = await getTransactionsForMonth(key);
    set({ transactions });
  },
  addTransaction: async (input) => {
    await insertTransaction(input);
    await get().refreshTransactions();
  },
  updateCategory: async (transactionId, category) => {
    await updateTransactionCategory(transactionId, category);
    set({
      transactions: get().transactions.map((txn) =>
        txn.id === transactionId ? { ...txn, category, edited: true } : txn
      ),
    });
  },
  addAccount: async ({ name, type, currency }) => {
    await insertAccount(name, type, currency);
    const accounts = await getAccounts();
    set({ accounts });
  },
  addCategory: async (name: string) => {
    await insertCategoryIfNotExists(name.trim());
    const categories = await getCategories();
    set({ categories });
  },
  setSelectedMonth: (monthKey) => {
    set({ selectedMonth: monthKey });
    void get().refreshTransactions(monthKey);
  },
  setFilters: (filters) => set({ filters }),
  getVisibleTransactions: () => {
    const { transactions, filters } = get();
    return transactions.filter((txn) => {
      if (filters.category && txn.category !== filters.category) return false;
      if (filters.direction && txn.direction !== filters.direction) return false;
      if (
        filters.accountId !== undefined &&
        filters.accountId !== null &&
        txn.accountId !== filters.accountId
      )
        return false;
      return true;
    });
  },
  getMonthlySummary: (monthKey) => {
    const key = monthKey ?? get().selectedMonth;
    const base: MonthlySummary = { monthKey: key, totalIn: 0, totalOut: 0, net: 0 };
    const data = get().transactions;
    for (const txn of data) {
      if (!txn.txnDatetime.startsWith(key)) continue;
      if (txn.direction === 'in') {
        base.totalIn += txn.amountNative;
      } else {
        base.totalOut += txn.amountNative;
      }
    }
    base.net = base.totalIn - base.totalOut;
    return base;
  },
  getTopCategories: (monthKey, limit = 5) => {
    const key = monthKey ?? get().selectedMonth;
    const totals = new Map<string, number>();
    for (const txn of get().transactions) {
      if (!txn.txnDatetime.startsWith(key)) continue;
      if (!txn.category) continue;
      const current = totals.get(txn.category) ?? 0;
      const amount = txn.amountNative * (txn.direction === 'out' ? 1 : -1);
      totals.set(txn.category, current + amount);
    }
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([category, total]) => ({ category, total }));
  },
}));
