// POST /api/payments/proof — a client submits evidence that they paid.
//
// WHY THIS EXISTS: proof submission used to be a direct browser insert into
// `payment_proofs`. That worked, but it meant NO SERVER CODE RAN — so there was
// nowhere to send a notification from. The delivery channels only exist
// server-side, so the owner learned about a payment claim only by opening
// /admin/payments/proofs and looking. A client could sit "paid" for a day.
//
// Moving it here buys three things the browser insert could never have:
//   1. an instant Telegram ping to the owner, the moment a claim is made
//   2. server-side validation of the storage path (pathBelongsToPayment below)
//   3. a durable, retrying record of the alert in the outbox
//
// WHAT STAYS IN THE BROWSER: the file upload itself. Streaming a 10MB photo
// through a serverless function to hand it to storage is slower, costs more and
// can time out. The storage RLS policy already enforces that a client may only
// write into their own payment's folder, so the upload is safe where it is.
// This route re-checks the path anyway — see below.
//
// NOT DUPLICATED HERE: the in-app notifications. The `notify_on_payment_proof`
// trigger fires on INSERT and writes both the admin and client bell entries.
// Adding them here too would double-notify.

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { enqueueAndTry } from '@/lib/modules/outbox';
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

/**
 * Trim to something safe to paste into a chat message.
 *
 * Strips control characters ONLY. Spaces and hyphens are meaningful inside a
 * bank reference or a UPI ref -- removing them would corrupt the one string
 * the admin has to match against a bank statement.
 *
 * The class is built from a string so no literal control byte ever appears in
 * this source file.
 */
const CONTROL_CHARS = new RegExp("[\u0000-\u001F\u007F]", "g");

function clean(v: unknown, max = 200): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().replace(CONTROL_CHARS, '');
  return s ? s.slice(0, max) : null;
}

/**
 * The storage path must live under THIS payment's folder.
 *
 * The bucket policy already enforces this at upload time, but the path arrives
 * here as a plain string in the request body. Without this check a client could
 * upload legitimately to their own folder and then POST a path pointing at
 * someone else's — which would attach another client's bank screenshot to their
 * own proof, and put it in front of an admin who is about to approve money.
 */
function pathBelongsToPayment(filePath: string, paymentId: string): boolean {
  return filePath.startsWith(`${paymentId}/`) && !filePath.includes('..');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // ── who is calling — BEFORE validating the payload ──────────────────────
    const cookieStore = await cookies();
    const authed = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await authed.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

    const { paymentId, methodId, filePath, reference, txid, paidAmount, paidCurrency } = body;

    if (typeof paymentId !== 'string' || !UUID_RE.test(paymentId)) {
      return NextResponse.json({ error: 'paymentId required' }, { status: 400 });
    }
    if (typeof methodId !== 'string' || !UUID_RE.test(methodId)) {
      return NextResponse.json({ error: 'Choose how you paid.' }, { status: 400 });
    }

    const ref = clean(reference);
    const tx = clean(txid, 120);
    const path = clean(filePath, 400);

    if (!path && !ref && !tx) {
      return NextResponse.json(
        { error: 'Attach a screenshot or enter the transaction reference — we need one of them to match your payment.' },
        { status: 400 }
      );
    }
    if (path && !pathBelongsToPayment(path, paymentId)) {
      return NextResponse.json({ error: 'That file does not belong to this payment.' }, { status: 403 });
    }

    // ── ownership, proved by RLS rather than asserted ───────────────────────
    // Queried with the CALLER'S OWN client, so the policy decides. If the
    // payment is not theirs this simply returns nothing.
    const { data: owned } = await authed
      .from('payments')
      .select('id, status, amount_usd, milestone, project_id, client_id')
      .eq('id', paymentId)
      .maybeSingle();

    if (!owned) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    if (owned.status === 'paid') {
      return NextResponse.json({ error: 'This payment is already settled.' }, { status: 409 });
    }

    const sb = serviceClient();

    const { data: proof, error: insErr } = await sb
      .from('payment_proofs')
      .insert({
        payment_id: paymentId,
        payment_method_id: methodId,
        file_path: path,
        reference_text: ref,
        txid: tx,
        paid_amount: Number.isFinite(Number(paidAmount)) ? Number(paidAmount) : null,
        paid_currency: clean(paidCurrency, 12),
        review_status: 'submitted',
      })
      .select('id, submitted_at')
      .maybeSingle();

    if (insErr) {
      // 23505 is the partial unique index: one OPEN proof per payment. It is a
      // real state, not a crash — say which state.
      if (insErr.code === '23505') {
        return NextResponse.json(
          { error: 'You already have a proof waiting to be checked for this payment.' },
          { status: 409 }
        );
      }
      console.error('[proof] insert failed:', insErr.message, insErr.code);
      return NextResponse.json(
        { error: 'We could not record your submission. Nothing was charged — please try again.' },
        { status: 500 }
      );
    }

    // ── alert the owner, instantly ──────────────────────────────────────────
    // Everything below is best-effort. A notification must NEVER fail a proof
    // that is already safely recorded, so the whole block is caught and the
    // response reports what happened rather than throwing.
    const [{ data: project }, { data: client }, { data: method }] = await Promise.all([
      sb.from('projects').select('project_ref, service_name').eq('id', owned.project_id).maybeSingle(),
      sb.from('clients').select('name, email, phone, country').eq('id', owned.client_id).maybeSingle(),
      sb.from('payment_methods').select('label, currency_code, rate_per_usd').eq('id', methodId).maybeSingle(),
    ]);

    const projectRef = project?.project_ref || paymentId.slice(0, 8).toUpperCase();
    const usd = owned.amount_usd == null ? null : Number(owned.amount_usd);

    // What we ASKED for, in the rail's own currency — so the number in the
    // alert is the number to look for on the bank statement.
    const expected =
      usd != null && method?.rate_per_usd != null
        ? `${(usd * Number(method.rate_per_usd)).toLocaleString('en-US', {
            minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${method.currency_code}`
        : null;

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      req.headers.get('origin') ||
      `https://${req.headers.get('host')}`;

    const lines = [
      `💰 PAYMENT CLAIMED — ${projectRef}`,
      '',
      `Client:   ${client?.name || 'Unknown'}${client?.country ? ` (${client.country})` : ''}`,
      `Service:  ${project?.service_name || '—'}`,
      `Invoice:  ${usd != null ? `$${usd.toFixed(2)}` : 'no amount set'} (${owned.milestone || 'payment'})`,
      `Rail:     ${method?.label || 'Unknown'}`,
      expected ? `Expected: ${expected}` : null,
      '',
      tx ? `TXID:      ${tx}` : null,
      ref ? `Reference: ${ref}` : null,
      path ? '📎 Screenshot attached' : null,
      '',
      '⚠️ Check this against your account before approving.',
      `${origin}/admin/payments/proofs`,
    ].filter(Boolean) as string[];

    const text = lines.join('\n');
    const dedupe = `proof:${proof!.id}`;
    const alerts: Record<string, string> = {};

    const adminChat = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (adminChat) {
      try {
        await enqueueAndTry({
          event: 'PROOF_SUBMITTED',
          channel: 'telegram',
          recipient: adminChat,
          bodyText: text,
          paymentId,
          projectId: owned.project_id,
          dedupeKey: `${dedupe}:telegram`,
        });
        alerts.telegram = 'queued';
      } catch (e) {
        console.error('[proof] telegram enqueue failed:', e);
        alerts.telegram = 'failed';
      }
    } else {
      alerts.telegram = 'not_configured';
    }

    // Email to the owner as the backup path — a Telegram outage must not mean
    // silence on a money event.
    try {
      await enqueueAndTry({
        event: 'PROOF_SUBMITTED',
        channel: 'email',
        recipient: adminEmail(),
        subject: `Payment claimed · ${projectRef} · ${usd != null ? `$${usd.toFixed(2)}` : 'no amount'}`,
        bodyText: text,
        bodyHtml: `<pre style="font-family:ui-monospace,monospace;font-size:13px">${text
          .replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>`,
        payload: { replyTo: SUPPORT_EMAIL },
        paymentId,
        projectId: owned.project_id,
        dedupeKey: `${dedupe}:email`,
      });
      alerts.email = 'queued';
    } catch (e) {
      console.error('[proof] email enqueue failed:', e);
      alerts.email = 'failed';
    }

    return NextResponse.json({
      ok: true,
      proofId: proof!.id,
      submittedAt: proof!.submitted_at,
      // Reports what was QUEUED. The outbox row is the record of what left.
      alerts,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'proof submission failed';
    console.error('[proof] error:', msg);
    return NextResponse.json(
      { error: 'We could not record your submission. Nothing was charged — please try again.' },
      { status: 500 }
    );
  }
}
