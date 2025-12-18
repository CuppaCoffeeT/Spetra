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

export const useAuth = create<AuthState>()((set) => ({
  session: null,
  loading: false,
  init: async () => {
    set({ loading: true });
    const { data } = await supabase.auth.getSession();
    set({ session: data.session ?? null, loading: false });
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session: session ?? null });
    });
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
    await supabase.auth.signOut();
    set({ loading: false, session: null });
  },
}));

