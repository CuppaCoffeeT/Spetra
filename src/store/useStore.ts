import { create } from 'zustand';
import { Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import * as db from '../lib/db';
import * as sync from '../lib/sync';
import type { Transaction, TransactionInput, GmailAuthState } from '../types';
import { gmailService } from '../services/gmail';
import { parseEmails } from '../services/parser';
import Constants from 'expo-constants';

interface AppState {
  // Auth
  session: Session | null;
  authLoading: boolean;
  initAuth: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;

  // Transactions
  transactions: Transaction[];
  transactionsLoading: boolean;
  loadTransactions: () => Promise<void>;
  addTransaction: (input: TransactionInput) => Promise<Transaction | null>;

  // Gmail
  gmailState: GmailAuthState;
  gmailLoading: boolean;
  initGmail: () => void;
  connectGmail: () => Promise<void>;
  disconnectGmail: () => Promise<void>;
  syncEmails: () => Promise<number>;

  // Sync
  syncLoading: boolean;
  syncData: () => Promise<void>;
}

let authSubscription: { unsubscribe: () => void } | null = null;

export const useStore = create<AppState>()((set, get) => ({
  // Auth state
  session: null,
  authLoading: true,

  initAuth: async () => {
    set({ authLoading: true });
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Auth init error:', error);
        // Clear stale session data to stop retry loops
        await supabase.auth.signOut().catch(() => {});
        set({ session: null, authLoading: false });
        return;
      }
      set({ session: data.session, authLoading: false });

      if (!authSubscription) {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          set({ session });
          if (session) {
            get().loadTransactions();
          }
        });
        authSubscription = subscription;
      }
    } catch (error) {
      console.error('Auth init failed:', error);
      // Clear stale session data on failure
      await supabase.auth.signOut().catch(() => {});
      set({ session: null, authLoading: false });
    }
  },

  signIn: async (email, password) => {
    set({ authLoading: true });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    set({ authLoading: false });
    if (error) throw error;
  },

  signUp: async (email, password) => {
    set({ authLoading: true });
    const { error } = await supabase.auth.signUp({ email, password });
    set({ authLoading: false });
    if (error) throw error;
  },

  signOut: async () => {
    set({ authLoading: true });
    await supabase.auth.signOut();
    set({ authLoading: false, session: null, transactions: [] });
  },

  // Transactions state
  transactions: [],
  transactionsLoading: false,

  loadTransactions: async () => {
    const userId = get().session?.user?.id;
    if (!userId) return;

    set({ transactionsLoading: true });
    try {
      let transactions: Transaction[];

      if (Platform.OS === 'web') {
        transactions = await sync.getTransactionsFromSupabase(userId);
      } else {
        transactions = await db.getTransactions(userId);
      }

      set({ transactions, transactionsLoading: false });
    } catch (error) {
      console.error('Load transactions failed:', error);
      set({ transactionsLoading: false });
    }
  },

  addTransaction: async (input) => {
    const userId = get().session?.user?.id;
    if (!userId) return null;

    try {
      let transaction: Transaction | null;

      if (Platform.OS === 'web') {
        transaction = await sync.saveTransactionToSupabase(userId, input);
      } else {
        transaction = await db.insertTransaction(userId, input);
      }

      if (transaction) {
        set((state) => ({
          transactions: [transaction!, ...state.transactions],
        }));
      }

      return transaction;
    } catch (error) {
      console.error('Add transaction failed:', error);
      return null;
    }
  },

  // Gmail state
  gmailState: { isConnected: false },
  gmailLoading: false,

  initGmail: async () => {
    const extra = Constants.expoConfig?.extra as { googleClientId?: string } | undefined;
    const clientId = extra?.googleClientId;
    if (clientId) {
      gmailService.initialize(clientId);

      // Check for OAuth callback (returning from Google)
      const wasCallback = await gmailService.checkOAuthCallback();
      if (wasCallback) {
        set({ gmailState: gmailService.getState() });
        return;
      }

      set({ gmailState: gmailService.getState() });
    }
  },

  connectGmail: async () => {
    set({ gmailLoading: true });
    try {
      const state = await gmailService.connect();
      set({ gmailState: state, gmailLoading: false });
    } catch (error) {
      console.error('Gmail connect failed:', error);
      set({ gmailLoading: false });
      throw error;
    }
  },

  disconnectGmail: async () => {
    set({ gmailLoading: true });
    const state = await gmailService.disconnect();
    set({ gmailState: state, gmailLoading: false });
  },

  syncEmails: async () => {
    const userId = get().session?.user?.id;
    if (!userId) return 0;

    set({ gmailLoading: true });
    try {
      const messages = await gmailService.fetchRecentMessages();
      const inputs = parseEmails(messages);

      let added = 0;
      for (const input of inputs) {
        const result = await get().addTransaction(input);
        if (result) added++;
      }

      set({ gmailState: gmailService.getState(), gmailLoading: false });
      return added;
    } catch (error) {
      console.error('Email sync failed:', error);
      set({ gmailLoading: false });
      throw error;
    }
  },

  // Sync state
  syncLoading: false,

  syncData: async () => {
    const userId = get().session?.user?.id;
    if (!userId || Platform.OS === 'web') return;

    set({ syncLoading: true });
    try {
      await sync.syncToSupabase(userId);
      await sync.syncFromSupabase(userId);
      await get().loadTransactions();
      set({ syncLoading: false });
    } catch (error) {
      console.error('Sync failed:', error);
      set({ syncLoading: false });
    }
  },
}));
