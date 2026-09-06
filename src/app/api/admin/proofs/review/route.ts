// POST /api/admin/proofs/review — approve or reject a payment proof.
//
// Moved off the browser because approval is a MONEY decision that touches three
// tables and then has to send a receipt. Doing that client-side meant each
// write could half-succeed with no way to notify afterwards, since the delivery
// channels only exist server-side.
//
// Admin identity is established from the CALLER'S SESSION, not from anything in
// the request body. The service-role client is used only after that check
// passes.

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, sendWhatsApp } from '@/lib/modules/deliver';
import { receiptHtml, receiptText, receiptSubject } from '@/lib/modules/receipt';
import { fireEvent } from '@/lib/modules/notify';
import { SUPPORT_EMAIL } from '@/lib/support';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function adminEmail() {
  return (process.env.OGRAPHY_ADMIN_EMAIL || 'endiosut.eo@gmail.com').toLowerCase();
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service env vars not set');
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const { proofId, decision, note } = await req.json();

    if (typeof proofId !== 'string' || !UUID_RE.test(proofId)) {
      return NextResponse.json({ error: 'proofId required' }, { status: 400 });
    }
    if (decision !== 'approved' && decision !== 'rejected') {
      return NextResponse.json({ error: 'decision must be approved or rejected' }, { status: 400 });
    }
    // A rejection the client cannot act on is worse than no rejection.
    if (decision === 'rejected' && !String(note || '').trim()) {
      return NextResponse.json({ error: 'A rejection needs a reason.' }, { status: 400 });
    }

    // ── who is calling ──────────────────────────────────────────────────────
    const cookieStore = await cookies();
    const authed = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => { /* read-only here; nothing to persist */ },
        },
      }
    );
    const { data: { user } } = await authed.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

    const isAdmin =
      (user.email || '').toLowerCase() === adminEmail() ||
      (user.app_metadata as { role?: string } | undefined)?.role === 'admin';
    if (!isAdmin) return NextResponse.json({ error: 'Not permitted' }, { status: 403 });

    const sb = serviceClient();

    const { data: proof, error: pErr } = await sb
      .from('payment_proofs')
      .select('id, payment_id, payment_method_id, reference_text, txid, review_status')
      .eq('id', proofId)
      .maybeSingle();

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
    if (!proof) return NextResponse.json({ error: 'Proof not found' }, { status: 404 });
    if (!['submitted', 'under_review'].includes(proof.review_status)) {
      return NextResponse.json(
        { error: `This proof is already ${proof.review_status}.` },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();

    const { error: upErr } = await sb
      .from('payment_proofs')
      .update({
        review_status: decision,
        review_note: String(note || '').trim() || null,
        reviewed_at: now,
        reviewed_by: user.id,
      })
      .eq('id', proof.id);

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    if (decision === 'rejected') {
      return NextResponse.json({ ok: true, decision, receipt: null });
    }

    // ── approved: the money is in ───────────────────────────────────────────
    const { error: payErr } = await sb
      .from('payments')
      .update({
        status: 'paid',
        paid_at: now,
        payment_method_id: proof.payment_method_id,
      })
      .eq('id', proof.payment_id);

    if (payErr) {
      return NextResponse.json(
        { error: `Proof approved but the payment could not be marked paid: ${payErr.message}` },
        { status: 500 }
      );
    }

    // Re-query the row. A refused update returns no error either.
    const { data: payment } = await sb
      .from('payments')
      .select('id, status, paid_at, amount_usd, milestone, project_id, client_id')
      .eq('id', proof.payment_id)
      .maybeSingle();

    if (payment?.status !== 'paid') {
      return NextResponse.json(
        { error: 'The payment is still not marked paid. Nothing was collected.' },
        { status: 500 }
      );
    }

    const [{ data: project }, { data: client }, { data: method }] = await Promise.all([
      sb.from('projects')
        .select('id, project_ref, service_name, balance_due_usd, stage')
        .eq('id', payment.project_id).maybeSingle(),
      sb.from('clients').select('name, email, phone').eq('id', payment.client_id).maybeSingle(),
      proof.payment_method_id
        ? sb.from('payment_methods').select('label').eq('id', proof.payment_method_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    // Deactivate the link — its window is irrelevant once paid.
    await sb.from('payment_links')
      .update({ is_active: false })
      .eq('payment_id', payment.id);

    // Move the project on and open the brief, if not already.
    if (project?.id) {
      await sb.from('projects').update({ stage: 'payment_received' }).eq('id', project.id);
      const { data: brief } = await sb
        .from('briefs').select('id').eq('project_id', project.id).limit(1).maybeSingle();
      if (!brief) {
        await sb.from('briefs').insert({
          project_id: project.id, client_id: payment.client_id, status: 'pending',
        });
      }
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      req.headers.get('origin') ||
      `https://${req.headers.get('host')}`;

    const receipt = {
      clientName: client?.name || 'there',
      projectRef: project?.project_ref || payment.id.slice(0, 8).toUpperCase(),
      serviceName: project?.service_name ?? null,
      amountUsd: Number(payment.amount_usd ?? 0),
      milestone: payment.milestone || 'payment',
      methodLabel: method?.label ?? null,
      reference: proof.txid || proof.reference_text || null,
      paidAt: payment.paid_at || now,
      portalUrl: `${origin}/portal`,
      balanceUsd: project?.balance_due_usd ?? null,
    };

    // Delivery is best-effort and reported per channel. An undelivered receipt
    // must not roll back a real payment.
    const [emailRes, waRes] = await Promise.all([
      client?.email
        ? sendEmail({
            to: client.email,
            subject: receiptSubject(receipt),
            html: receiptHtml(receipt),
            replyTo: SUPPORT_EMAIL,
          })
        : Promise.resolve({ channel: 'email' as const, delivered: false, error: 'no_email' }),
      client?.phone
        ? sendWhatsApp({
            to: client.phone,
            text: receiptText(receipt),
            template: process.env.WHATSAPP_RECEIPT_TEMPLATE,
            templateParams: process.env.WHATSAPP_RECEIPT_TEMPLATE
              ? [receipt.clientName, receipt.projectRef,
                 `$${receipt.amountUsd.toFixed(2)}`, receipt.portalUrl]
              : undefined,
          })
        : Promise.resolve({ channel: 'whatsapp' as const, delivered: false, error: 'no_phone' }),
    ]);

    await fireEvent({
      event: 'PAYMENT_PROOF_REVIEWED',
      projectId: project?.id,
      clientName: receipt.clientName,
      clientEmail: client?.email || '',
      serviceName: receipt.serviceName || undefined,
      stage: 'payment_received',
      amount: receipt.amountUsd,
      notes: `Approved. ${receipt.methodLabel || ''} ${receipt.reference || ''}`.trim(),
      actionUrl: receipt.portalUrl,
      timestamp: now,
    });

    return NextResponse.json({
      ok: true,
      decision,
      amountUsd: receipt.amountUsd,
      delivery: { email: emailRes, whatsapp: waRes },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'review failed';
    console.error('[proofs/review] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
