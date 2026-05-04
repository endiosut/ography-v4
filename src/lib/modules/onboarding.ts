// Onboarding Engine — reused by contact form, Stripe webhook, and any future entry point.
// Every new client follows the same path: upsert client → create project → log event → fire n8n.

import { createClient } from '@supabase/supabase-js';
import { fireEvent } from './notify';
import { logEvent } from './workflow';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service env vars not set');
  return createClient(url, key);
}

export type LeadInput = {
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  serviceName?: string;
  notes?: string | null;
  source?: string;
  // If set, creates a paid project instead of a lead
  stripeSessionId?: string;
  amountPaid?: number;
  catalogItemId?: string | null;
  deliveryType?: string;
};

export type OnboardResult = {
  clientId: string;
  projectId: string;
  isNewClient: boolean;
};

export async function handleLead(input: LeadInput): Promise<OnboardResult> {
  const sb = getServiceSupabase();

  // Upsert client — idempotent, email is the key
  let { data: client } = await sb.from('clients').select('id').eq('email', input.email).single();
  let isNewClient = false;

  if (!client) {
    isNewClient = true;
    const { data: newClient, error } = await sb
      .from('clients')
      .insert({
        name: input.name,
        email: input.email,
        phone: input.phone || null,
        company: input.company || null,
        source: input.source || 'contact_form',
        status: 'lead',
        notes: input.notes || null,
      })
      .select('id')
      .single();

    if (error || !newClient) throw new Error('Client creation failed: ' + error?.message);
    client = newClient;
  }

  const isPaid = !!input.stripeSessionId;

  // Create project
  const { data: project, error: projectError } = await sb
    .from('projects')
    .insert({
      client_id: client.id,
      catalog_item_id: input.catalogItemId || null,
      service_name: input.serviceName || 'Studio Service',
      stage: isPaid ? 'payment_received' : 'lead',
      total_amount_usd: input.amountPaid || null,
      deposit_paid_usd: isPaid ? input.amountPaid : null,
      balance_due_usd: isPaid ? 0 : null,
      stripe_session_id: input.stripeSessionId || null,
      delivery_type: input.deliveryType || 'digital',
      notes: input.notes || null,
    })
    .select('id')
    .single();

  if (projectError || !project) throw new Error('Project creation failed: ' + projectError?.message);

  // If paid, create payment record + blank brief
  if (isPaid && input.amountPaid) {
    await Promise.all([
      sb.from('payments').insert({
        project_id: project.id,
        client_id: client.id,
        stripe_session_id: input.stripeSessionId,
        amount_usd: input.amountPaid,
        milestone: 'full',
        status: 'paid',
        paid_at: new Date().toISOString(),
      }),
      sb.from('briefs').insert({
        project_id: project.id,
        client_id: client.id,
        status: 'pending',
      }),
    ]);
  }

  // Log the event
  await logEvent({
    projectId: project.id,
    eventType: isPaid ? 'PAYMENT_RECEIVED' : 'LEAD_CREATED',
    toStage: isPaid ? 'payment_received' : 'lead',
    triggeredBy: isPaid ? 'stripe' : 'client',
    metadata: { serviceName: input.serviceName, source: input.source },
  });

  // Fire n8n
  await fireEvent({
    event: isPaid ? 'PAYMENT_RECEIVED' : 'LEAD_CREATED',
    projectId: project.id,
    clientName: input.name,
    clientEmail: input.email,
    serviceName: input.serviceName,
    stage: isPaid ? 'payment_received' : 'lead',
    amount: input.amountPaid || null,
    notes: input.notes,
    timestamp: new Date().toISOString(),
  });

  return { clientId: client.id, projectId: project.id, isNewClient };
}
