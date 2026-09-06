// POST /api/agreements/accepted — fires AGREEMENT_ACCEPTED after a client signs.
//
// Why a route at all: acceptance is a direct browser -> Postgres UPDATE (RLS
// lets a client write status on their own agreement). That never touches the
// app server, so fireEvent — which only exists server-side — could not run.
// Result: signing produced no notification to anyone, ever.
//
// This route does NOT accept the acceptance. It re-reads the agreement with the
// service role and only notifies if the DATABASE already says accepted. A
// caller cannot use it to fake a signature or to spam notifications for an
// agreement that was never signed.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fireEvent } from '@/lib/modules/notify';
import { events } from '@/lib/modules/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service env vars not set');
  return createClient(url, key);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  try {
    const { agreementId } = await req.json();
    if (typeof agreementId !== 'string' || !UUID_RE.test(agreementId)) {
      return NextResponse.json({ error: 'agreementId required' }, { status: 400 });
    }

    const sb = getServiceSupabase();

    const { data: agreement, error: aErr } = await sb
      .from('agreements')
      .select('id, agreement_ref, status, total_usd, deposit_usd, client_id, accepted_at')
      .eq('id', agreementId)
      .maybeSingle();

    if (aErr) {
      console.error('[agreements/accepted] read failed:', aErr.message);
      return NextResponse.json({ error: 'lookup failed' }, { status: 500 });
    }
    if (!agreement) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    // The gate. Trust the row, not the caller.
    if (agreement.status !== 'accepted') {
      return NextResponse.json({ error: 'not accepted', status: agreement.status }, { status: 409 });
    }

    const { data: project } = await sb
      .from('projects')
      .select('id, project_ref, service_name')
      .eq('agreement_id', agreement.id)
      .limit(1)
      .maybeSingle();

    const { data: client } = await sb
      .from('clients')
      .select('name, email')
      .eq('id', agreement.client_id)
      .maybeSingle();

    let paymentId: string | null = null;
    if (project?.id) {
      const { data: deposit } = await sb
        .from('payments')
        .select('id')
        .eq('project_id', project.id)
        .eq('milestone', 'deposit')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      paymentId = deposit?.id ?? null;
    }

    // ── OPEN THE PAYMENT WINDOW ─────────────────────────────────────────────
    // payment_links existed with an expires_at column, but nothing in the app
    // had ever created a row or set an expiry — all 8 historical rows had
    // expires_at NULL, so the countdown on /portal/pay could never render.
    // The window opens here, at the moment the client commits.
    let expiresAt: string | null = null;
    if (paymentId && project?.id) {
      const windowMinutes = Math.min(30, Math.max(15,
        Number(process.env.PAYMENT_WINDOW_MINUTES) || 30));

      const { data: existing } = await sb
        .from('payment_links')
        .select('id, expires_at')
        .eq('payment_id', paymentId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        expiresAt = existing.expires_at;
      } else {
        const until = new Date(Date.now() + windowMinutes * 60_000).toISOString();
        const { data: link, error: linkErr } = await sb
          .from('payment_links')
          .insert({
            project_id: project.id,
            payment_id: paymentId,
            expires_at: until,
            window_minutes: windowMinutes,
            max_renewals: 2,
            renewals_used: 0,
            is_active: true,
          })
          .select('expires_at')
          .maybeSingle();

        if (linkErr) {
          // A missing window must not block payment — the pay page treats a
          // null expiry as "no timer", not as "expired".
          console.error('[agreements/accepted] payment_link create failed:', linkErr.message);
        } else {
          expiresAt = link?.expires_at ?? null;
        }
      }
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      req.headers.get('origin') ||
      `https://${req.headers.get('host')}`;

    const actionUrl = paymentId ? `${origin}/portal/pay/${paymentId}` : `${origin}/portal`;

    // In-app for both sides. This is the notification that actually lands
    // today, because no email or WhatsApp provider is configured yet.
    await events.agreementAccepted({
      clientId: agreement.client_id,
      clientName: client?.name || 'A client',
      projectId: project?.id ?? null,
      paymentId,
      projectRef: project?.project_ref || agreement.agreement_ref || 'this project',
      depositUsd: agreement.deposit_usd != null ? Number(agreement.deposit_usd) : null,
      expiresAt,
    });

    const result = await fireEvent({
      event: 'AGREEMENT_ACCEPTED',
      projectId: project?.id,
      clientName: client?.name || 'Client',
      clientEmail: client?.email || '',
      serviceName: project?.service_name || undefined,
      stage: 'agreement_accepted',
      amount: agreement.deposit_usd != null ? Number(agreement.deposit_usd) : null,
      notes: `Deposit due. Reference ${project?.project_ref || agreement.agreement_ref}.`,
      actionUrl,
      timestamp: new Date().toISOString(),
    });

    // `delivered` is returned honestly. The n8n workspace is currently a 404,
    // so this will report false until that endpoint is fixed — which is the
    // point: the caller can then tell the client to expect no email yet.
    return NextResponse.json({
      ok: true,
      notified: result.delivered,
      notifyStatus: result.status ?? null,
      paymentId,
      actionUrl,
      expiresAt,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'failed';
    console.error('[agreements/accepted] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
