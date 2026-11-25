import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export function createBrowserClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY) are missing.');
  }
  return createSupabaseClient(supabaseUrl, supabaseAnonKey);
}

export const supabaseBrowser = createBrowserClient();

