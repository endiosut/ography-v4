import { createClient } from '@supabase/supabase-js'

// Hardcoded fallbacks ensure the client works even if env vars aren't set at build time
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://unzwefrtgsgmtljlbavf.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuendlZnJ0Z3NnbXRsamxiYXZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MTM1MjMsImV4cCI6MjA5MjA4OTUyM30.QPoyf_UYDD82xW1KYaSbukPrfMoTAACVMKPT05HKI90'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Admin types
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
}

export async function getProjects() {
  const { data } = await supabase.from('projects')
    .select('*, clients(name, email)')
    .order('created_at', { ascending: false })
  return data || []
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
