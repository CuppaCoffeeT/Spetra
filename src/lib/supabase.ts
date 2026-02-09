import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra as {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
} | undefined;

const supabaseUrl = extra?.supabaseUrl || '';
const supabaseAnonKey = extra?.supabaseAnonKey || '';

// On web, use localStorage for auth persistence
// Detect if there's a stale session and clear it to prevent CORS retry loops
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  try {
    const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      // If the session has expired, clear it preemptively
      if (parsed?.expires_at && parsed.expires_at * 1000 < Date.now()) {
        localStorage.removeItem(storageKey);
      }
    }
  } catch {
    // Ignore parsing errors
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
