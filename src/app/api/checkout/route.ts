// POST /api/checkout — the route that was missing.
//
// Before this file existed, every "Pay" button in the cart called
// handleRequestAll(), which navigated to /contact. There was no code path
// anywhere in the repository that created a Stripe Checkout Session: `stripe`
// was in package.json but never imported, and STRIPE_SECRET_KEY was referenced
// in zero files. The webhook at /api/stripe/webhook was waiting for an event
// that nothing could ever cause. That is why checkout could not take money.
//
// Flow:
//   1. re-price the cart from catalog_items (never trust a browser price)
//   2. classify each line via the pricing matrix, refuse mixed carts
//   3. handleLead() -> client + agreement(sent) + project(lead)
//      The agreements_recalc trigger computes subtotal/total/deposit for us,
//      so the amount charged is the amount the agreement says is owed.
//   4. create the Stripe session with agreement_id in metadata
//   5. the webhook flips the agreement to 'accepted', which fires
//      agreements_on_accept -> fills project totals, creates the payment row
//
// Nothing here writes a payment as paid. Only a signature-verified webhook does.

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { handleLead } from '@/lib/modules/onboarding';
import { pricingMode, offerFor, chargeCents, type PricedItem } from '@/lib/pricing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Lazy — a module-scope `new Stripe(...)` throws at build time when the key is
// absent, which would fail the whole deployment rather than this one route.
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

type IncomingLine = { id: string; quantity: number };

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, company, intent } = body as {
      name?: string; email?: string; phone?: string; company?: string;
      intent?: 'full' | 'deposit';
    };

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email)) {
      return NextResponse.json({ error: 'That email address is not valid.' }, { status: 400 });
    }

    // Shape only. Quantities clamped so a crafted payload cannot mint a
    // 10,000-unit order.
    const lines: IncomingLine[] = Array.isArray(body.items)
      ? body.items
          .filter((c: unknown): c is { id: string; quantity?: unknown } =>
            !!c && typeof (c as { id?: unknown }).id === 'string')
          .map((c: { id: string; quantity?: unknown }) => ({
            id: c.id,
            quantity: Math.min(99, Math.max(1, Math.floor(Number(c.quantity) || 1))),
          }))
          .slice(0, 20)
      : [];

    if (lines.length === 0) {
      return NextResponse.json({ error: 'Your cart is empty.' }, { status: 400 });
    }

    // ── 1. Re-price from the database ───────────────────────────────────────
    const sb = getServiceSupabase();
    const ids = Array.from(new Set(lines.map((l) => l.id)));
    const { data: items, error: itemsErr } = await sb
      .from('catalog_items')
      .select('id, name, base_price_usd, price_note, turnaround, is_active')
      .in('id', ids)
      .eq('is_active', true);

    if (itemsErr) {
      console.error('[checkout] catalog read failed:', itemsErr.message);
      return NextResponse.json({ error: 'Could not price your cart.' }, { status: 500 });
    }
    if (!items?.length) {
      return NextResponse.json(
        { error: 'None of these services are available any more.' },
        { status: 400 }
      );
    }

    // ── 2. Classify, and refuse what cannot be charged correctly ────────────
    const qty = new Map(lines.map((l) => [l.id, l.quantity]));
    const priced = items.map((it) => {
      const p = it as PricedItem & { turnaround: string | null };
      return { item: p, mode: pricingMode(p), quantity: qty.get(p.id) ?? 1 };
    });

    const offer = offerFor(priced);
    if (offer.kind === 'blocked') {
      return NextResponse.json({ error: offer.reason, code: 'not_chargeable' }, { status: 409 });
    }

    // A "From $X" line has no known total, so "pay in full" is not a thing that
    // can be honestly offered. Downgrade rather than overcharge.
    const effectiveIntent: 'full' | 'deposit' =
      offer.kind === 'deposit_only' ? 'deposit' : intent === 'full' ? 'full' : 'deposit';

    const stripe = getStripe();
    if (!stripe) {
      // Deployed without keys: say so plainly instead of a blank failure, and
      // let the caller fall back to the request-a-quote flow.
      console.error('[checkout] STRIPE_SECRET_KEY is not set — cannot create a session.');
      return NextResponse.json(
        { error: 'Card payment is not switched on yet.', code: 'stripe_unconfigured' },
        { status: 503 }
      );
    }

    // ── 3. Client + agreement + project, via the existing onboarding path ───
    const serviceName = priced.map((p) => p.item.name).join(', ');
    const lead = await handleLead({
      name: String(name).trim(),
      email: String(email).toLowerCase().trim(),
      phone: phone || null,
      company: company || null,
      serviceName,
      source: 'checkout',
      notes: `Checkout started · ${effectiveIntent === 'full' ? 'full payment' : 'deposit'}`,
      catalogItems: priced.map((p) => ({ id: p.item.id, quantity: p.quantity })),
    });

    if (!lead.agreementId) {
      console.error('[checkout] handleLead returned no agreement; cannot price the session.');
      return NextResponse.json(
        { error: 'Could not build your quote. Please use the contact form.' },
        { status: 500 }
      );
    }

    // The trigger did the arithmetic. Read it back rather than recomputing —
    // two implementations of the same sum eventually disagree.
    const { data: agreement } = await sb
      .from('agreements')
      .select('id, agreement_ref, total_usd, deposit_usd, deposit_pct')
      .eq('id', lead.agreementId)
      .maybeSingle();

    const depositPct = Number(agreement?.deposit_pct ?? 50);

    // ── 4. Stripe session ───────────────────────────────────────────────────
    const isSubscription = offer.kind === 'subscription';

    const line_items = priced.map(({ item, mode, quantity }) => {
      const unit_amount = chargeCents(item, mode, effectiveIntent, depositPct);
      const suffix =
        mode === 'recurring' ? '' :
        effectiveIntent === 'deposit'
          ? (mode === 'quote' ? ' — booking deposit' : ` — ${depositPct}% deposit`)
          : '';
      return {
        quantity,
        price_data: {
          currency: 'usd',
          unit_amount,
          product_data: {
            name: `${item.name}${suffix}`,
            ...(item.price_note ? { description: item.price_note } : {}),
          },
          ...(isSubscription ? { recurring: { interval: 'month' as const } } : {}),
        },
      };
    });

    const total = line_items.reduce((n, l) => n + l.price_data.unit_amount * l.quantity, 0);
    if (total < 50) {
      // Stripe's floor for USD is $0.50; below it the session create just errors.
      return NextResponse.json(
        { error: 'This order is below the minimum card payment amount.' },
        { status: 400 }
      );
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      req.headers.get('origin') ||
      `https://${req.headers.get('host')}`;

    const session = await stripe.checkout.sessions.create({
      mode: isSubscription ? 'subscription' : 'payment',
      line_items,
      customer_email: String(email).toLowerCase().trim(),
      success_url: `${origin}/portal?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/catalog?checkout=cancelled`,
      client_reference_id: lead.projectId,
      metadata: {
        agreement_id: lead.agreementId,
        project_id: lead.projectId,
        client_id: lead.clientId,
        intent: effectiveIntent,
        agreement_ref: agreement?.agreement_ref ?? '',
        service_name: serviceName.slice(0, 400),
      },
    });

    if (!session.url) {
      console.error('[checkout] Stripe returned a session with no URL:', session.id);
      return NextResponse.json({ error: 'Could not start checkout.' }, { status: 502 });
    }

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
      agreementId: lead.agreementId,
      intent: effectiveIntent,
      amountUsd: total / 100,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Checkout failed';
    console.error('[checkout] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
