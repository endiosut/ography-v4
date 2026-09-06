// POST /api/payments/extend — renew an expired/expiring payment window.
//
// Server-side, not a client UPDATE on payment_links, for two reasons:
//   1. the renewal CAP has to be enforced somewhere the client cannot reach.
//      A browser-side update with an owner RLS policy would let anyone set
//      expires_at to the year 3000 and renew forever.
//   2. ownership must be proved from the session cookie, not from the body.
//
// Two renewals maximum. After that the client is escalated to a human instead
// of being handed a fourth identical window they have already failed to use.

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service env vars not set');
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const { paymentId } = await req.json();
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

    // Ownership is proved with the CALLER'S OWN client, so RLS decides. If the
    // payment is not theirs, this simply returns nothing.
    const { data: owned } = await authed
      .from('payments').select('id, status').eq('id', paymentId).maybeSingle();

    if (!owned) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    if (owned.status === 'paid') {
      return NextResponse.json({ error: 'This payment is already settled.' }, { status: 409 });
    }

    const sb = serviceClient();

    const { data: link } = await sb
      .from('payment_links')
      .select('id, expires_at, renewals_used, max_renewals, window_minutes, is_active')
      .eq('payment_id', paymentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!link) {
      return NextResponse.json({ error: 'No payment window to renew.' }, { status: 404 });
    }
    if (link.renewals_used >= link.max_renewals) {
      return NextResponse.json(
        {
          error: 'renewal_limit',
          message:
            'You have already extended this window twice. Message us and we will reopen it for you.',
          renewalsUsed: link.renewals_used,
          maxRenewals: link.max_renewals,
        },
        { status: 409 }
      );
    }

    // Extend from NOW, not from the old expiry — extending from a timestamp
    // that already passed would hand back a window that is instantly stale.
    const minutes = Math.min(30, Math.max(15, Number(link.window_minutes) || 30));
    const until = new Date(Date.now() + minutes * 60_000).toISOString();

    const { data: updated, error: upErr } = await sb
      .from('payment_links')
      .update({
        expires_at: until,
        renewals_used: link.renewals_used + 1,
        is_active: true,
      })
      .eq('id', link.id)
      .select('expires_at, renewals_used, max_renewals')
      .maybeSingle();

    if (upErr) {
      console.error('[payments/extend] update failed:', upErr.message);
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      expiresAt: updated?.expires_at ?? until,
      renewalsUsed: updated?.renewals_used ?? link.renewals_used + 1,
      maxRenewals: updated?.max_renewals ?? link.max_renewals,
      windowMinutes: minutes,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'extend failed';
    console.error('[payments/extend] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
