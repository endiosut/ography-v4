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
  // Real catalog_items.id + quantity, from the contact form / cart.
  // Prices are NEVER taken from here — they are re-read from the database.
  catalogItems?: { id: string; quantity: number }[];
};

export type OnboardResult = {
  clientId: string;
  projectId: string;
  isNewClient: boolean;
  // Null when the lead carried no priced catalog item. The contact page uses
  // this to send the visitor straight to their quote instead of a dead end.
  agreementId: string | null;
};

export async function handleLead(input: LeadInput): Promise<OnboardResult> {
  const sb = getServiceSupabase();

  // ── CLIENT RESOLUTION (rewritten 16 Aug 2026) ────────────────────────────
  //
  // The previous implementation was:
  //   let { data: client } = await sb.from('clients')
  //       .select('id').eq('email', input.email).single();
  //
  // Three defects, in increasing severity:
  //
  //  1. `.single()` ERRORS on zero rows and on multiple rows. The error was
  //     DISCARDED — only `data` was destructured. A duplicate-email row made
  //     `client` null, the code then INSERTed, and hit clients_email_key.
  //     The whole submission 500'd and the lead was lost with no record.
  //
  //  2. `.eq('email', …)` is case-SENSITIVE. route.ts lowercases the submitted
  //     address, but rows written by other paths (portal, signup, seed) are not
  //     guaranteed lowercase. A mixed-case row would miss the lookup and then
  //     violate the unique constraint on insert. Currently 0 mixed-case rows,
  //     so this has not bitten yet — it is a live landmine, not a live fire.
  //
  //  3. Failures were invisible. `clients.source` is 'contact_form' or the
  //     referrer for anything this function creates. Measured 16 Aug:
  //     ZERO rows in the whole table carry a contact-form source. Whatever the
  //     cause per submission, this branch has never once produced a client.
  //
  // Now: case-insensitive lookup, maybeSingle (null instead of throwing),
  // errors surfaced, and a unique-violation fallback that re-reads rather than
  // losing the lead.
  let isNewClient = false;

  const { data: existing, error: lookupErr } = await sb
    .from('clients')
    .select('id')
    .ilike('email', input.email)
    .limit(1)
    .maybeSingle();

  if (lookupErr) {
    console.error('[onboarding] client lookup failed:', lookupErr.message, {
      email: input.email,
    });
  }

  let client: { id: string } | null = existing ?? null;

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
      .maybeSingle();

    if (error) {
      // 23505 = unique_violation. The row exists under a casing or a race the
      // lookup missed. Re-read it rather than dropping a real lead.
      if (error.code === '23505') {
        console.warn('[onboarding] insert hit clients_email_key, re-reading:', input.email);
        const { data: raced } = await sb
          .from('clients').select('id').ilike('email', input.email).limit(1).maybeSingle();
        if (!raced) {
          throw new Error('Client exists but could not be read back: ' + input.email);
        }
        client = raced;
        isNewClient = false;
      } else {
        console.error('[onboarding] client creation failed:', error.message, error.code);
        throw new Error('Client creation failed: ' + error.message);
      }
    } else if (!newClient) {
      throw new Error('Client creation returned no row for ' + input.email);
    } else {
      client = newClient;
    }
  }

  if (!client) throw new Error('Could not resolve a client for ' + input.email);

  const isPaid = !!input.stripeSessionId;

  // ── AMOUNT PIPELINE (17 Aug 2026) ────────────────────────────────────────
  //
  // Measured before this change:
  //   projects 18 · catalog_item_id NOT NULL on 0 · total_amount_usd NOT NULL
  //   on 0 · agreements 0 · checkout_sessions 0
  //
  // The contact form sent service NAMES as a comma-joined string. Nothing ever
  // carried a catalog_items.id, so no price could be derived, so no agreement
  // could be built — and /portal/agreement/[id] and /portal/pay/[paymentId]
  // were unreachable by construction, not by bug.
  //
  // The DB already does the arithmetic. `agreements_recalc` sums
  // quantity × unit_price_usd from line_items and writes subtotal/total/
  // deposit/balance. `agreements_on_accept` then fills projects.total_amount_usd
  // and INSERTs the pending deposit payment that the pay page reads.
  // The only missing link was a row in `agreements` pointed at by
  // projects.agreement_id. That is what this block creates.
  //
  // Prices are re-read from catalog_items on the server. A browser-supplied
  // price is a browser-supplied invoice.
  let agreementId: string | null = null;
  let resolvedCatalogItemId: string | null = input.catalogItemId || null;
  let resolvedServiceName: string | null = null;

  if (input.catalogItems?.length) {
    const ids = Array.from(new Set(input.catalogItems.map((c) => c.id)));
    const { data: items, error: itemsErr } = await sb
      .from('catalog_items')
      .select('id, name, base_price_usd, turnaround, price_note, is_active')
      .in('id', ids)
      .eq('is_active', true);

    if (itemsErr) {
      // Do not lose the lead over a pricing failure. Log loudly, fall through
      // to the plain-lead path, and let the admin price it by hand.
      console.error('[onboarding] catalog read failed, falling back to unpriced lead:',
        itemsErr.message);
    } else if (items?.length) {
      const qty = new Map(input.catalogItems.map((c) => [c.id, c.quantity]));
      const lineItems = items.map((it) => ({
        catalog_item_id: it.id,
        name: it.name,
        quantity: qty.get(it.id) ?? 1,
        // Keys `quantity` and `unit_price_usd` are what agreements_recalc reads.
        // Do not rename them without changing the trigger.
        unit_price_usd: Number(it.base_price_usd ?? 0),
        turnaround: it.turnaround ?? null,
        price_note: it.price_note ?? null,
      }));

      resolvedCatalogItemId = items[0].id;
      resolvedServiceName = items.map((i) => i.name).join(', ');

      const { data: agreement, error: agreementErr } = await sb
        .from('agreements')
        .insert({
          client_id: client.id,
          line_items: lineItems,
          status: 'sent',
          sent_at: new Date().toISOString(),
          // 14 days. Null would mean "never expires"; an open-ended quote is
          // a price you have to honour indefinitely.
          expires_at: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
          notes: input.notes || null,
        })
        .select('id, total_usd, deposit_usd')
        .maybeSingle();

      if (agreementErr || !agreement) {
        console.error('[onboarding] agreement creation failed:',
          agreementErr?.message, agreementErr?.code);
      } else {
        agreementId = agreement.id;
      }
    }
  }

  // Create project
  const { data: project, error: projectError } = await sb
    .from('projects')
    .insert({
      client_id: client.id,
      agreement_id: agreementId,
      catalog_item_id: resolvedCatalogItemId,
      service_name: resolvedServiceName || input.serviceName || 'Studio Service',
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
    metadata: {
      serviceName: resolvedServiceName || input.serviceName,
      source: input.source,
      agreementId,
      catalogItemId: resolvedCatalogItemId,
    },
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

  return { clientId: client.id, projectId: project.id, isNewClient, agreementId };
}
