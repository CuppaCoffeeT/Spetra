import { createClient } from '@supabase/supabase-js';

// Same Supabase project as the native app. The anon key is public (RLS scopes
// every row to the signed-in user), so inlining it here is fine — matches how
// the Expo app stores it in app.json. Override via Vite env if you prefer.
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://fpasfffeywotrclprcai.supabase.co';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwYXNmZmZleXdvdHJjbHByY2FpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxMzQxNDcsImV4cCI6MjA3NDcxMDE0N30.RAijwJV10m8dBwJUfb-y-aQeDb-m-1rEVL9ruc2-jZg';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
