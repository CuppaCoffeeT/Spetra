import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/src/lib/supabase';

interface AuthState {
  session: Session | null;
  loading: boolean;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

let _initCalled = false;

export const useAuth = create<AuthState>()((set) => ({
  session: null,
  loading: true,
  init: async () => {
    if (_initCalled) return;
    _initCalled = true;
    try {
      const { data } = await supabase.auth.getSession();
      set({ session: data.session ?? null, loading: false });
      supabase.auth.onAuthStateChange((_event, session) => {
        set({ session: session ?? null });
      });
    } catch (error) {
      console.error('Auth init failed:', error);
      _initCalled = false;
      set({ session: null, loading: false });
    }
  },
  signIn: async (email, password) => {
    set({ loading: true });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    set({ loading: false });
    if (error) throw error;
  },
  signUp: async (email, password) => {
    set({ loading: true });
    const { error } = await supabase.auth.signUp({ email, password });
    set({ loading: false });
    if (error) throw error;
  },
  signOut: async () => {
    set({ loading: true });
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Sign out failed:', error);
    }
    set({ loading: false, session: null });
  },
}));

