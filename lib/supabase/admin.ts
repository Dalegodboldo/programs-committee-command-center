import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from '@/lib/env';

// Server-only client that can read every row, for scheduled jobs with nobody signed in.
// Needs SUPABASE_SECRET_KEY (Supabase > Project Settings > API Keys > Secret keys) in Vercel.
// Older projects call it the service_role key; SUPABASE_SERVICE_ROLE_KEY works too.
export function secretKey() {
  return (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
}

export function supabaseAdmin() {
  const key = secretKey();
  if (!key) return null;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
