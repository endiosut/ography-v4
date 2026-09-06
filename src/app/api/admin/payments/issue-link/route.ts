// POST /api/admin/payments/issue-link — open or reopen a payment window.
//
// WHY THIS EXISTS: a window was only ever created at one moment — when a client
// accepted an agreement. Everything else had no way to get one:
//   · a BALANCE payment (the second half, after delivery)
//   · a payment created by hand in the admin
//   · a client who exhausted their two self-service renewals
//   · the 8 historical payments, which predate links entirely
// Those all sat with expires_at null, which the pay page reads as "no timer" —
// workable, but it meant the admin had no lever at all.
//
// The link identity is immutable (migration 012 enforces token/payment_id/
// project_id cannot change on UPDATE), so "reissue" means deactivating the old
// row and inserting a new one, never mutating the old token. An old link can
// therefore never start collecting against a different invoice.

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { enqueueAndTry } from '@/lib/modules/outbox';
import { SUPPORT_EMAIL, WHATSAPP_URL } from '@/lib/support';

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
    const { paymentId, windowMinutes, notify } = await req.json();

    if (typeof paymentId !== 'string' || !UUID_RE.test(paymentId)) {
      return NextResponse.json({ error: 'paymentId required' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const authed = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await authed.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

    const isAdmin =
      (user.email || '').toLowerCase() === adminEmail() ||
      (user.app_metadata as { role?: string } | undefined)?.role === 'admin';
    if (!isAdmin) return NextResponse.json({ error: 'Not permitted' }, { status: 403 });

    const sb = serviceClient();

    const { data: payment } = await sb
      .from('payments')
      .select('id, status, amount_usd, milestone, project_id, client_id')
      .eq('id', paymentId)
      .maybeSingle();

    if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    if (payment.status === 'paid') {
      return NextResponse.json({ error: 'This payment is already settled.' }, { status: 409 });
    }
    if (payment.amount_usd == null) {
      // A window on an amount-less payment is a countdown to nothing — the
      // client still would not know what to send.
      return NextResponse.json(
        { error: 'This payment has no amount yet. Set one before issuing a link.' },
        { status: 409 }
      );
    }

    const minutes = Math.min(30, Math.max(15,
      Number(windowMinutes) || Number(process.env.PAYMENT_WINDOW_MINUTES) || 30));

    // Retire any existing active window first. The partial unique index
    // (one active link per payment) would reject the insert otherwise — which
    // is the point: two live windows means two competing expiries.
    await sb.from('payment_links')
      .update({ is_active: false })
      .eq('payment_id', paymentId)
      .eq('is_active', true);

    const until = new Date(Date.now() + minutes * 60_000).toISOString();

    const { data: link, error: linkErr } = await sb
      .from('payment_links')
      .insert({
        project_id: payment.project_id,
        payment_id: paymentId,
        expires_at: until,
        window_minutes: minutes,
        max_renewals: 2,
        renewals_used: 0,
        is_active: true,
      })
      .select('id, token, expires_at, window_minutes, max_renewals')
      .maybeSingle();

    if (linkErr || !link) {
      console.error('[issue-link] insert failed:', linkErr?.message);
      return NextResponse.json({ error: linkErr?.message || 'Could not issue link' }, { status: 500 });
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      req.headers.get('origin') ||
      `https://${req.headers.get('host')}`;
    const payUrl = `${origin}/portal/pay/${paymentId}`;

    let queued = false;
    if (notify) {
      const [{ data: client }, { data: project }] = await Promise.all([
        sb.from('clients').select('name,email,phone').eq('id', payment.client_id).maybeSingle(),
        sb.from('projects').select('project_ref,service_name').eq('id', payment.project_id).maybeSingle(),
      ]);

      const ref = project?.project_ref || paymentId.slice(0, 8).toUpperCase();
      const amount = `$${Number(payment.amount_usd).toFixed(2)}`;
      const text =
        `OGraphy — your payment window is open for ${minutes} minutes.\n\n` +
        `${ref}${project?.service_name ? ` · ${project.service_name}` : ''}\n` +
        `Amount: ${amount}\n\n` +
        `Pay here: ${payUrl}\n\n` +
        `Need help? ${WHATSAPP_URL} or ${SUPPORT_EMAIL}`;

      // Keyed on the LINK id, so each reissue is its own message rather than
      // being swallowed as a duplicate of the previous one.
      if (client?.email) {
        await enqueueAndTry({
          event: 'PAYMENT_LINK',
          channel: 'email',
          recipient: client.email,
          subject: `Payment window open · ${ref} · ${amount}`,
          bodyText: text,
          bodyHtml: `<p>Your payment window is open for ${minutes} minutes.</p>
                     <p><strong>${ref}</strong><br/>Amount: ${amount}</p>
                     <p><a href="${payUrl}">Open your payment page</a></p>`,
          payload: { replyTo: SUPPORT_EMAIL },
          paymentId, projectId: payment.project_id,
          dedupeKey: `paylink:${link.id}:email`,
        });
        queued = true;
      }
      if (client?.phone) {
        await enqueueAndTry({
          event: 'PAYMENT_LINK',
          channel: 'whatsapp',
          recipient: client.phone,
          bodyText: text,
          paymentId, projectId: payment.project_id,
          dedupeKey: `paylink:${link.id}:whatsapp`,
        });
        queued = true;
      }
    }

    return NextResponse.json({
      ok: true,
      payUrl,
      token: link.token,
      expiresAt: link.expires_at,
      windowMinutes: link.window_minutes,
      maxRenewals: link.max_renewals,
      notificationQueued: queued,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'issue-link failed';
    console.error('[issue-link] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
