'use client';
import { createBrowserClient } from '@supabase/ssr';

/**
 * Shared browser Supabase client for the admin surfaces.
 *
 * WHY THIS CHANGED (16 Aug 2026) — this is the blocker for the RLS read lockdown.
 *
 * This module previously exported:
 *     createClient(url, anonKey)        // from '@supabase/supabase-js'
 *
 * That client authenticates as `anon` and reads its session from localStorage.
 * Seven admin pages import it — briefs, catalog, catalog/upload, clients,
 * payments, projects, projects/[id] — so every admin query ran as an anonymous
 * visitor. They only "worked" because the SELECT policies on clients, projects,
 * payments, briefs and deliverables are still `USING (true)` for `public`.
 *
 * In other words: the admin dashboard is currently powered by the security hole.
 * Locking down SELECT first would have blanked all seven pages.
 *
 * It also means the proposed manual test — "open /admin, do payment links
 * render?" — would have returned a FALSE GREEN. They render precisely because
 * anon can read everything.
 *
 * `createBrowserClient` from '@supabase/ssr' reads the session from COOKIES,
 * the same store middleware, /auth/callback and /login already write to. The
 * query API is identical, so all seven importers are fixed by this one change.
 *
 * ORDER OF OPERATIONS, do not invert:
 *   1. this change  (admin reads as the signed-in admin)
 *   2. verify all seven admin pages still render with real data
 *   3. THEN apply the SELECT lockdown  (D3)
 *
 * Env vars are read inside the factory, never at module scope — module-level
 * `process.env.X!` has broken /admin, /login and /portal in this codebase
 * before. The hardcoded URL/key fallbacks that used to live here are gone;
 * they defeated key rotation and hid misconfiguration.
 */
function makeClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error(
      '[supabase] Missing env vars.',
      'NEXT_PUBLIC_SUPABASE_URL set:', Boolean(url),
      'NEXT_PUBLIC_SUPABASE_ANON_KEY set:', Boolean(key)
    );
    throw new Error('Supabase configuration missing');
  }
  return createBrowserClient(url, key);
}

let _client: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Lazily constructed so a missing env var throws at call time, inside a
 * component's effect, rather than at module init where it blanks the route.
 */
export function getSupabase() {
  if (!_client) _client = makeClient();
  return _client;
}

/**
 * Back-compat named export. The seven admin pages do `supabase.from(...)`
 * inside effects and handlers, so the proxy defers construction until the
 * first property access — module import alone never touches env.
 */
export const supabase = new Proxy({} as ReturnType<typeof createBrowserClient>, {
  get(_t, prop, receiver) {
    return Reflect.get(getSupabase() as object, prop, receiver);
  },
});

// ── Admin types (unchanged) ────────────────────────────────────────────────
export type Client = {
  id: string; name: string; email: string; phone: string | null
  company: string | null; instagram: string | null; country: string | null
  source: string; status: string; notes: string | null; created_at: string; updated_at: string
}

export type Project = {
  id: string; project_ref: string; client_id: string | null; catalog_item_id: string | null
  service_name: string; stage: string; total_amount_usd: number | null
  deposit_paid_usd: number | null; balance_due_usd: number | null
  stripe_session_id: string | null; deadline: string | null; delivered_at: string | null
  delivery_type: string | null; notes: string | null; created_at: string; updated_at: string
  clients?: { name: string; email: string } | null
}

export type Brief = {
  id: string; project_id: string | null; client_id: string | null
  business_name: string | null; business_description: string | null
  target_audience: string | null; industry: string | null
  style_direction: string | null; colors_liked: string | null
  colors_to_avoid: string | null; additional_message: string | null
  submitted_at: string | null; status: string; created_at: string
}

export type Payment = {
  id: string; project_id: string | null; client_id: string | null
  stripe_session_id: string | null; amount_usd: number | null
  milestone: string; status: string; paid_at: string | null
  receipt_url: string | null; created_at: string
}
