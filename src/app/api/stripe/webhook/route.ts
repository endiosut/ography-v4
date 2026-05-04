import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Lazy-initialize so build doesn't fail if env vars aren't set at build time
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env vars not set')
  return createClient(url, key)
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  let event: any
  try {
    event = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const supabase = getSupabase()
    const session = event.data.object
    const email = session.customer_details?.email
    const name = session.customer_details?.name || email?.split('@')[0] || 'Client'
    const amountPaid = session.amount_total / 100
    const serviceName = session.metadata?.service_name || 'Studio Service'
    const catalogItemId = session.metadata?.catalog_item_id || null

    if (!email) return NextResponse.json({ error: 'No email' }, { status: 400 })

    let { data: client } = await supabase.from('clients').select('id').eq('email', email).single()

    if (!client) {
      const { data: newClient } = await supabase
        .from('clients')
        .insert({ name, email, source: 'stripe', status: 'active' })
        .select().single()
      client = newClient
    }

    if (!client) return NextResponse.json({ error: 'Client creation failed' }, { status: 500 })

    const { data: project } = await supabase.from('projects').insert({
      client_id: client.id,
      catalog_item_id: catalogItemId,
      service_name: serviceName,
      stage: 'payment_received',
      total_amount_usd: amountPaid,
      deposit_paid_usd: amountPaid,
      balance_due_usd: 0,
      stripe_session_id: session.id,
      delivery_type: session.metadata?.delivery_type || 'digital'
    }).select().single()

    if (!project) return NextResponse.json({ error: 'Project creation failed' }, { status: 500 })

    await supabase.from('payments').insert({
      project_id: project.id,
      client_id: client.id,
      stripe_session_id: session.id,
      amount_usd: amountPaid,
      milestone: 'full',
      status: 'paid',
      paid_at: new Date().toISOString()
    })

    await supabase.from('briefs').insert({
      project_id: project.id,
      client_id: client.id,
      status: 'pending'
    })
  }

  return NextResponse.json({ received: true })
}
