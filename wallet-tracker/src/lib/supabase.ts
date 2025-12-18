import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra || {}) as {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

export const supabase = createClient(
  extra.supabaseUrl || '',
  extra.supabaseAnonKey || ''
);


