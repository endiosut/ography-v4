// GET/POST /api/outbox/drain — send everything that is due.
//
// This is the retry engine. It is deliberately callable three ways, because
// the free tier of every scheduler is restrictive and a retry loop that only
// works on a paid plan is not a retry loop:
//
//   1. Vercel Cron        — see vercel.json. Hobby allows daily; Pro allows
//                           frequent. Vercel signs its calls, so a CRON_SECRET
//                           is not required for those.
//   2. Any external pinger — a free uptime monitor hitting this URL every few
//                           minutes with ?key=CRON_SECRET works fine.
//   3. Opportunistically   — enqueueAndTry() calls drain() in-process, so in
//                           practice most messages go out immediately and the
//                           scheduler only mops up failures.
//
// Protected because draining is a send: an open endpoint would let anyone
// force delivery attempts and burn the Resend quota.

import { NextRequest, NextResponse } from 'next/server';
import { drain } from '@/lib/modules/outbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;

  // Vercel Cron signs its requests with the deployment's own secret.
  const auth = req.headers.get('authorization');
  if (secret && auth === `Bearer ${secret}`) return true;

  // Allow an external scheduler with the key in the query string.
  const key = new URL(req.url).searchParams.get('key');
  if (secret && key === secret) return true;

  // Vercel's own cron requests carry this header.
  if (req.headers.get('x-vercel-cron')) return true;

  // Fail CLOSED when no secret is configured. An unprotected drain endpoint on
  // a public URL is a way to burn someone else's email quota.
  return false;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const limit = Math.min(100, Math.max(1, Number(new URL(req.url).searchParams.get('limit')) || 20));
    const summary = await drain(limit);
    return NextResponse.json({ ok: true, ...summary });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'drain failed';
    console.error('[outbox/drain] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
