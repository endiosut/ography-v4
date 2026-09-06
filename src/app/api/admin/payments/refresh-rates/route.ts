// POST/GET /api/admin/payments/refresh-rates — pull live FX onto every rail.
//
// The UPI rail settles in INR while all amounts are USD. Leaving the rate null
// makes the pay page say "we will confirm the amount" — honest, but friction on
// the primary rail. Hardcoding drifts, and the drift is money.
//
// Runs two ways, like the outbox drain:
//   · the scheduler (vercel.json cron), with CRON_SECRET
//   · an admin clicking "Refresh rates", authenticated by session cookie
//
// A refusal is never silent: a rate that cannot be fetched, or that moves more
// than 25% against the stored one, is left ALONE and reported.

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { fetchRate, isPlausible } from '@/lib/modules/fx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function adminEmail() {
  return (process.env.OGRAPHY_ADMIN_EMAIL || 'endiosut.eo@gmail.com').toLowerCase();
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service env vars not set');
  return createClient(url, key);
}

async function authorize(req: NextRequest): Promise<{ ok: boolean; how?: string }> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (secret && auth === `Bearer ${secret}`) return { ok: true, how: 'cron' };
  if (secret && new URL(req.url).searchParams.get('key') === secret) return { ok: true, how: 'cron' };
  if (req.headers.get('x-vercel-cron')) return { ok: true, how: 'cron' };

  const cookieStore = await cookies();
  const authed = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await authed.auth.getUser();
  if (!user) return { ok: false };

  const isAdmin =
    (user.email || '').toLowerCase() === adminEmail() ||
    (user.app_metadata as { role?: string } | undefined)?.role === 'admin';
  return isAdmin ? { ok: true, how: 'admin' } : { ok: false };
}

async function handle(req: NextRequest) {
  const auth = await authorize(req);
  if (!auth.ok) return NextResponse.json({ error: 'Not authorized' }, { status: 401 });

  try {
    const sb = serviceClient();

    const { data: methods, error } = await sb
      .from('payment_methods')
      .select('id, label, currency_code, asset_code, rate_per_usd, is_active')
      .eq('is_active', true);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const results: Array<Record<string, unknown>> = [];

    for (const m of methods || []) {
      // A stablecoin rail quotes in USD terms already; an FX lookup for "USDT"
      // would fail and is meaningless.
      const code = (m.currency_code || 'USD').toUpperCase();
      if (code === 'USD') {
        results.push({ label: m.label, currency: code, skipped: 'settles in USD' });
        continue;
      }

      const quote = await fetchRate(code);
      if (!quote) {
        results.push({ label: m.label, currency: code, updated: false, reason: 'no provider could quote it' });
        continue;
      }

      const prev = m.rate_per_usd == null ? null : Number(m.rate_per_usd);
      if (!isPlausible(prev, quote.rate)) {
        // A decimal shift or an inverted quote would change what every client
        // in that currency is asked to pay. Refuse and surface it.
        console.error(`[refresh-rates] IMPLAUSIBLE ${code}: stored ${prev} -> fetched ${quote.rate}. Left unchanged.`);
        results.push({
          label: m.label, currency: code, updated: false,
          reason: `implausible move ${prev} -> ${quote.rate}; left unchanged`,
        });
        continue;
      }

      const { error: upErr } = await sb
        .from('payment_methods')
        .update({ rate_per_usd: quote.rate, rate_updated_at: quote.asOf })
        .eq('id', m.id);

      if (upErr) {
        results.push({ label: m.label, currency: code, updated: false, reason: upErr.message });
        continue;
      }

      results.push({
        label: m.label, currency: code, updated: true,
        previous: prev, rate: quote.rate, source: quote.source, asOf: quote.asOf,
      });
    }

    return NextResponse.json({ ok: true, via: auth.how, results });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'refresh failed';
    console.error('[refresh-rates] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
