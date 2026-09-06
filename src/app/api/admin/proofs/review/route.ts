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
import { enqueueAndTry } from '@/lib/modules/outbox';
import { events } from '@/lib/modules/notifications';
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
      // Tell the client in-app, not only in the review note they have to go
      // looking for. This works even with no email provider configured.
      const { data: rejPay } = await sb
        .from('payments').select('client_id, project_id').eq('id', proof.payment_id).maybeSingle();
      if (rejPay?.client_id) {
        await events.proofRejected({
          clientId: rejPay.client_id,
          projectId: rejPay.project_id,
          paymentId: proof.payment_id,
          reason: String(note || '').trim(),
        });
      }
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

    // The receipt goes through the OUTBOX, not straight out on the wire.
    //
    // A receipt that fires once and loses to a transient blip is a client who
    // paid and got nothing. Queuing it makes the message durable first: it is
    // retried with backoff, and the dedupe key means re-approving or a retry of
    // this request cannot double-send.
    const dedupe = `receipt:${payment.id}`;

    const queued: Record<string, { queued: boolean; duplicate?: boolean; reason?: string }> = {};

    if (client?.email) {
      const r = await enqueueAndTry({
        event: 'RECEIPT',
        channel: 'email',
        recipient: client.email,
        subject: receiptSubject(receipt),
        bodyHtml: receiptHtml(receipt),
        bodyText: receiptText(receipt),
        payload: { replyTo: SUPPORT_EMAIL },
        paymentId: payment.id,
        projectId: project?.id ?? null,
        dedupeKey: `${dedupe}:email`,
      });
      queued.email = { queued: true, duplicate: r.duplicate };
    } else {
      queued.email = { queued: false, reason: 'no email on file' };
    }

    if (client?.phone) {
      const r = await enqueueAndTry({
        event: 'RECEIPT',
        channel: 'whatsapp',
        recipient: client.phone,
        bodyText: receiptText(receipt),
        payload: process.env.WHATSAPP_RECEIPT_TEMPLATE
          ? {
              template: process.env.WHATSAPP_RECEIPT_TEMPLATE,
              templateParams: [receipt.clientName, receipt.projectRef,
                               `$${receipt.amountUsd.toFixed(2)}`, receipt.portalUrl],
            }
          : {},
        paymentId: payment.id,
        projectId: project?.id ?? null,
        dedupeKey: `${dedupe}:whatsapp`,
      });
      queued.whatsapp = { queued: true, duplicate: r.duplicate };
    } else {
      queued.whatsapp = { queued: false, reason: 'no phone on file' };
    }

    // In-app confirmation, independent of whether any email actually sends.
    if (payment.client_id) {
      await events.paymentApproved({
        clientId: payment.client_id,
        projectId: project?.id ?? null,
        paymentId: payment.id,
        projectRef: receipt.projectRef,
        amountUsd: receipt.amountUsd,
      });
    }

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

    // Report what was QUEUED. Claiming "sent" here would be the same lie the
    // old n8n call told — the outbox is the record of what actually left.
    const { data: outboxRows } = await sb
      .from('notification_outbox')
      .select('channel,status,last_error')
      .eq('payment_id', payment.id)
      .eq('event', 'RECEIPT');

    return NextResponse.json({
      ok: true,
      decision,
      amountUsd: receipt.amountUsd,
      queued,
      outbox: outboxRows ?? [],
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'review failed';
    console.error('[proofs/review] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
