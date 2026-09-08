// POST /api/admin/deliver — publish finished work to a client.
//
// Nothing in the codebase ever wrote a `deliverables` row; the portal only read
// the table. So "the work is ready" had no representation, and the second half
// of every job was uncollectable because nothing created a `balance` payment.
//
// The split follows the agreement's OWN terms rather than inventing new ones:
//   balance_due_on  = 'delivery'       -> the invoice is raised here
//   ip_transfers_on = 'final_payment'  -> file_url unlocks when it clears
//
// preview_url is visible immediately. Showing the client nothing until they pay
// is a standoff — they cannot confirm the work exists. Releasing everything on
// delivery removes any reason to pay the balance. A preview does both jobs.

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

/** Only http(s). A javascript: or data: URL here would be stored and then
 *  rendered as a link in the client's portal. */
function safeUrl(u: unknown): string | null {
  if (typeof u !== 'string' || !u.trim()) return null;
  try {
    const parsed = new URL(u.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Auth before validation — an anonymous caller learns only that they are
    // not signed in.
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

    const { projectId, title, fileUrl, previewUrl, notes, isFinal } = body;

    if (typeof projectId !== 'string' || !UUID_RE.test(projectId)) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    }
    const finalUrl = safeUrl(fileUrl);
    const preview = safeUrl(previewUrl);
    if (!finalUrl && !preview) {
      return NextResponse.json(
        { error: 'Give at least one link — a preview, the final files, or both.' },
        { status: 400 }
      );
    }

    const sb = serviceClient();

    const { data: project } = await sb
      .from('projects')
      .select('id, project_ref, service_name, client_id, agreement_id')
      .eq('id', projectId)
      .maybeSingle();

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // Version numbers are per project and monotonic, so a revision is visibly a
    // new version rather than an edit that erases what the client already saw.
    const { data: last } = await sb
      .from('deliverables')
      .select('version')
      .eq('project_id', projectId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    const version = (Number(last?.version) || 0) + 1;

    const { data: deliverable, error: dErr } = await sb
      .from('deliverables')
      .insert({
        project_id: projectId,
        client_id: project.client_id,
        title: typeof title === 'string' && title.trim() ? title.trim() : `Delivery v${version}`,
        file_name: typeof title === 'string' ? title.trim() : null,
        file_url: finalUrl,
        preview_url: preview,
        notes: typeof notes === 'string' ? notes.trim() || null : null,
        version,
        is_final: Boolean(isFinal),
        // The trigger keys off this: it raises the balance invoice and notifies.
        delivered_at: new Date().toISOString(),
      })
      .select('id, version, delivered_at')
      .maybeSingle();

    if (dErr || !deliverable) {
      console.error('[deliver] insert failed:', dErr?.message);
      return NextResponse.json({ error: dErr?.message || 'Could not deliver' }, { status: 500 });
    }

    // Read back what the TRIGGER did rather than assuming it fired.
    const { data: balance } = await sb
      .from('payments')
      .select('id, amount_usd, status')
      .eq('project_id', projectId)
      .eq('milestone', 'balance')
      .maybeSingle();

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      req.headers.get('origin') ||
      `https://${req.headers.get('host')}`;

    const { data: client } = await sb
      .from('clients').select('name,email,phone').eq('id', project.client_id).maybeSingle();

    let queued = false;
    if (client?.email) {
      const amt = balance?.amount_usd != null ? `$${Number(balance.amount_usd).toFixed(2)}` : null;
      await enqueueAndTry({
        event: 'WORK_DELIVERED',
        channel: 'email',
        recipient: client.email,
        subject: `Your work is ready · ${project.project_ref}`,
        bodyText:
          `Your ${project.service_name || 'project'} is ready.\n\n` +
          `Open your portal: ${origin}/portal\n` +
          (amt ? `\nBalance due: ${amt}. The final files unlock once it is settled.\n` : '') +
          `\nQuestions? ${WHATSAPP_URL} or ${SUPPORT_EMAIL}`,
        bodyHtml:
          `<p>Your ${project.service_name || 'project'} is ready.</p>` +
          (amt ? `<p><strong>Balance due: ${amt}.</strong> The final files unlock once it is settled.</p>` : '') +
          `<p><a href="${origin}/portal">Open your portal</a></p>`,
        payload: { replyTo: SUPPORT_EMAIL },
        projectId,
        dedupeKey: `delivered:${deliverable.id}:email`,
      });
      queued = true;
    }

    return NextResponse.json({
      ok: true,
      deliverableId: deliverable.id,
      version: deliverable.version,
      balance: balance
        ? { id: balance.id, amountUsd: balance.amount_usd, status: balance.status }
        : null,
      // Honest: says what the trigger actually produced, not what was intended.
      balanceRaised: Boolean(balance),
      notificationQueued: queued,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'deliver failed';
    console.error('[deliver] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
