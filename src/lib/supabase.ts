'use client';
import { createBrowserClient } from '@supabase/ssr'

// CHANGED 16 Aug 2026 — this is the blocker for the RLS read lockdown (D3).
//
// Was:  createClient(url, anonKey)   // '@supabase/supabase-js'
// That client authenticates as `anon` and reads its session from localStorage.
// Seven admin pages import this module, so every admin query ran as an
// anonymous visitor. They only render because SELECT is still `USING (true)`
// for `public` — i.e. the admin dashboard is powered by the security hole, and
// locking RLS down first would blank all seven pages.
//
// It also means the manual check "open /admin, do payment links render?" would
// have returned a FALSE GREEN: they render precisely because anon can read
// everything.
//
// createBrowserClient reads the session from COOKIES — the same store
// middleware, /auth/callback and /login already write to. Identical query API,
// so all seven importers are fixed by this one swap.
//
// Hardcoded url/key fallbacks removed: they defeated key rotation and masked
// misconfiguration. Env is read inside the factory, never at module scope.
//
// ORDER, do not invert:
//   1. this change   2. verify all 7 admin pages render   3. THEN the D3 lockdown

function makeClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.error('[supabase] Missing env.',
      'URL set:', Boolean(url), 'ANON set:', Boolean(key))
    throw new Error('Supabase configuration missing')
  }
  return createBrowserClient(url, key)
}

let _client: ReturnType<typeof makeClient> | null = null
function client() {
  if (!_client) _client = makeClient()
  return _client
}

// Lazy so a missing env var throws inside a handler, not at module init where
// it blanks the whole route. Typed off makeClient so inference is preserved.
export const supabase: ReturnType<typeof makeClient> = new Proxy(
  {} as ReturnType<typeof makeClient>,
  { get: (_t, p, r) => Reflect.get(client() as object, p, r) }
)

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

export type CatalogItem = {
  id: string; name: string; category: string; subcategory: string | null
  description: string | null; format: string[] | null; delivery: string
  turnaround: string | null; base_price_usd: number | null; price_note: string | null
  image_url: string | null; thumbnail_url: string | null; style_tags: string[] | null
  is_featured: boolean; is_active: boolean; sort_order: number
}

export type Deliverable = {
  id: string; project_id: string; file_name: string | null
  file_url: string | null; file_type: string | null
  version: number; is_final: boolean; notes: string | null; created_at: string
}

// Admin queries
export async function getAdminStats() {
  try {
    const [clients, projects, payments] = await Promise.all([
      supabase.from('clients').select('id, status', { count: 'exact' }),
      supabase.from('projects').select('id, stage, total_amount_usd', { count: 'exact' }),
      supabase.from('payments').select('id, amount_usd, status', { count: 'exact' }),
    ])
    const activeProjects = (projects.data || []).filter(p => p.stage !== 'completed').length
    const totalEarned = (payments.data || []).filter(p => p.status === 'paid').reduce((s, p) => s + (p.amount_usd || 0), 0)
    const pendingPayments = (payments.data || []).filter(p => p.status === 'pending').reduce((s, p) => s + (p.amount_usd || 0), 0)
    const pipelineValue = (projects.data || []).filter(p => p.stage !== 'completed').reduce((s, p) => s + (p.total_amount_usd || 0), 0)
    return { activeProjects, totalEarned, pendingPayments, pipelineValue, totalClients: clients.count || 0 }
  } catch (e) {
    console.error('getAdminStats error:', e)
    return { activeProjects: 0, totalEarned: 0, pendingPayments: 0, pipelineValue: 0, totalClients: 0 }
  }
}

export async function getProjects() {
  try {
    const { data, error } = await supabase.from('projects')
      .select('*, clients(name, email)')
      .order('created_at', { ascending: false })
    if (error) console.error('getProjects error:', error)
    return data || []
  } catch (e) {
    console.error('getProjects error:', e)
    return []
  }
}

export async function getCatalogItems() {
  const { data } = await supabase.from('catalog_items')
    .select('*')
    .order('sort_order', { ascending: true })
  return data || []
}

export async function upsertCatalogItem(payload: Partial<CatalogItem>) {
  const { data, error } = await supabase
    .from('catalog_items')
    .upsert(payload)
    .select('*')
    .single()

  if (error) {
    throw error
  }
  return data as CatalogItem
}

export async function uploadCatalogImage(file: File | Blob, itemId: string) {
  const fileName = `${itemId}/${Date.now()}-${(file as File).name || 'image'}`
  const { error: uploadError } = await supabase.storage
    .from('catalog-images')
    .upload(fileName, file, { upsert: true })

  if (uploadError) {
    throw uploadError
  }

  const { data: publicData } = supabase.storage
    .from('catalog-images')
    .getPublicUrl(fileName)

  if (!publicData?.publicUrl) {
    throw new Error('Failed to create public URL for catalog image')
  }

  return publicData.publicUrl
}

export async function updateProjectStage(id: string, stage: string) {
  const { error } = await supabase.from('projects').update({ stage }).eq('id', id)
  if (error) {
    throw error
  }
}
