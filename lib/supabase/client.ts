'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';
import { requireSupabaseEnv } from './config';

/** Supabase-klient for nettleseren. Bruker anon-nøkkelen; RLS styrer tilgang. */
export function createClient() {
  const { url, anonKey } = requireSupabaseEnv();
  return createBrowserClient<Database>(url, anonKey);
}
