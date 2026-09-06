// POST /api/stripe/webhook — payment confirmation.
//
// SECURITY (fixed 06 Sep 2026). The previous implementation was:
//
//     const body = await req.text();
//     event = JSON.parse(body);
//     if (event.type === 'checkout.session.completed') { await handleLead(...) }
//
// No signature check. The route is public and the repository is public, so
// anyone who could read this path could POST a hand-written JSON body and
// create a client, a project and a `paid` payment row for an amount they chose
// — a forged sale, with no money behind it. Every event is now verified against
// STRIPE_WEBHOOK_SECRET before a single row is written.
//
// It also now finishes the job. It used to call handleLead(), which created a
// SECOND client and project — the checkout route already created those. Now it
// resolves the agreement the session was created from and accepts it, which is
// what agreements_on_accept is waiting for.

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { handleLead } from '@/lib/modules/onboarding';
import { logEvent } from '@/lib/modules/workflow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

let _stripe: Stripe | null = null;
function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!_stripe) _stripe = new Stripe(key);
  return _stripe;
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service env vars not set');
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !secret) {
    // Fail CLOSED. An unverifiable event is not a payment. Returning 500 makes
    // Stripe retry, so nothing is silently lost once the secret is set.
    console.error('[stripe-webhook] not configured', {
      hasKey: Boolean(stripe), hasSecret: Boolean(secret),
    });
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  // Must be the RAW body. Parsing it first invalidates the signature.
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, signature, secret);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'signature verification failed';
    console.error('[stripe-webhook] rejected:', msg);
    return NextResponse.json({ error: `Webhook Error: ${msg}` }, { status: 400 });
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // A completed session can still be unpaid (e.g. a delayed payment method).
  if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
    console.warn('[stripe-webhook] session completed but not paid:',
      session.id, session.payment_status);
    return NextResponse.json({ received: true, pending: session.payment_status });
  }

  const sb = getServiceSupabase();
  const amountPaid = (session.amount_total || 0) / 100;
  const meta = session.metadata || {};

  try {
    // Idempotency. Stripe retries, and a retry must not double-record a sale.
    const { data: seen } = await sb
      .from('payments').select('id').eq('stripe_session_id', session.id).limit(1).maybeSingle();
    if (seen) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    // ── Path A: session created by /api/checkout ────────────────────────────
    if (meta.agreement_id && meta.project_id) {
      // Accepting the agreement fires agreements_on_accept, which fills
      // projects.total_amount_usd and inserts the pending deposit payment.
      const { error: acceptErr } = await sb
        .from('agreements')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
          accepted_name: session.customer_details?.name || null,
        })
        .eq('id', meta.agreement_id);

      if (acceptErr) {
        console.error('[stripe-webhook] agreement accept failed:', acceptErr.message);
        return NextResponse.json({ error: acceptErr.message }, { status: 500 });
      }

      const milestone = meta.intent === 'full' ? 'full' : 'deposit';
      const paidAt = new Date().toISOString();

      // The trigger inserted a PENDING deposit row. Settle that one rather than
      // adding a second row for the same money.
      const { data: pendingRow } = await sb
        .from('payments')
        .select('id')
        .eq('project_id', meta.project_id)
        .eq('milestone', 'deposit')
        .eq('status', 'pending')
        .limit(1)
        .maybeSingle();

      if (pendingRow && milestone === 'deposit') {
        await sb.from('payments').update({
          status: 'paid',
          paid_at: paidAt,
          amount_usd: amountPaid,
          stripe_session_id: session.id,
          stripe_payment_intent: typeof session.payment_intent === 'string'
            ? session.payment_intent : null,
        }).eq('id', pendingRow.id);
      } else {
        await sb.from('payments').insert({
          project_id: meta.project_id,
          client_id: meta.client_id || null,
          amount_usd: amountPaid,
          milestone,
          status: 'paid',
          paid_at: paidAt,
          stripe_session_id: session.id,
          stripe_payment_intent: typeof session.payment_intent === 'string'
            ? session.payment_intent : null,
        });
      }

      await sb.from('projects').update({
        stage: 'payment_received',
        deposit_paid_usd: amountPaid,
        stripe_session_id: session.id,
      }).eq('id', meta.project_id);

      // The brief is the next thing the client has to do. Without a row here
      // /portal/brief has nothing to open.
      const { data: brief } = await sb
        .from('briefs').select('id').eq('project_id', meta.project_id).limit(1).maybeSingle();
      if (!brief) {
        await sb.from('briefs').insert({
          project_id: meta.project_id,
          client_id: meta.client_id || null,
          status: 'pending',
        });
      }

      await logEvent({
        projectId: meta.project_id,
        eventType: 'PAYMENT_RECEIVED',
        toStage: 'payment_received',
        triggeredBy: 'stripe',
        metadata: {
          sessionId: session.id, amountPaid, milestone,
          agreementId: meta.agreement_id, agreementRef: meta.agreement_ref,
        },
      });

      return NextResponse.json({ received: true, projectId: meta.project_id });
    }

    // ── Path B: a Payment Link or dashboard-created session ─────────────────
    // No agreement to accept, so fall back to onboarding a fresh lead.
    const email = session.customer_details?.email;
    if (!email) return NextResponse.json({ error: 'No email on session' }, { status: 400 });

    await handleLead({
      name: session.customer_details?.name || email.split('@')[0] || 'Client',
      email,
      serviceName: meta.service_name || 'Studio Service',
      source: 'stripe',
      stripeSessionId: session.id,
      amountPaid,
      catalogItemId: meta.catalog_item_id || null,
      deliveryType: meta.delivery_type || 'digital',
    });

    return NextResponse.json({ received: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'webhook handling failed';
    console.error('[stripe-webhook] error:', msg);
    // 500 so Stripe retries — a dropped payment event is money with no record.
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
