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

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      req.headers.get('origin') ||
      `https://${req.headers.get('host')}`;

    const actionUrl = paymentId ? `${origin}/portal/pay/${paymentId}` : `${origin}/portal`;

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
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'failed';
    console.error('[agreements/accepted] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
