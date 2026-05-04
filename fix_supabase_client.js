const fs = require('fs');
const base = 'C:/Users/Endi Osut/ography-v4';

// 1. Fix supabase.ts with hardcoded fallback values
fs.mkdirSync(base + '/src/lib', {recursive:true});
fs.writeFileSync(base + '/src/lib/supabase.ts', `import { createClient } from '@supabase/supabase-js'

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
`, 'utf8');
console.log('supabase.ts fixed with hardcoded fallbacks');

// 2. Overwrite .env.local with correct values
fs.writeFileSync(base + '/.env.local', `NEXT_PUBLIC_SUPABASE_URL=https://unzwefrtgsgmtljlbavf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuendlZnJ0Z3NnbXRsamxiYXZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MTM1MjMsImV4cCI6MjA5MjA4OTUyM30.QPoyf_UYDD82xW1KYaSbukPrfMoTAACVMKPT05HKI90
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuendlZnJ0Z3NnbXRsamxiYXZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjUxMzUyMywiZXhwIjoyMDkyMDg5NTIzfQ.3Eg8BjGIwW6eiDZsUDe3liCwkugYLcYK6u-hSC3AsEg
STRIPE_SECRET_KEY=sk_test_REPLACE_LATER
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_REPLACE_LATER
NEXT_PUBLIC_APP_URL=http://localhost:3000
`, 'utf8');
console.log('.env.local written');

// 3. Check the fix
const content = fs.readFileSync(base + '/src/lib/supabase.ts', 'utf8');
console.log('Has hardcoded URL:', content.includes('https://unzwefrtgsgmtljlbavf.supabase.co'));
console.log('Has hardcoded key:', content.includes('QPoyf_UYDD'));
console.log('');
console.log('Now run:');
console.log('  Remove-Item -Recurse -Force .next');
console.log('  vercel --prod --yes');
