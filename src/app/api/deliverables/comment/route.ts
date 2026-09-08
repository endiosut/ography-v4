// POST /api/deliverables/comment — the client asks for a revision, or either
// side replies on a delivery.
//
// A revision request needs to be a TRACKED STATE, not a WhatsApp message. Two
// reasons: the agreement caps revisions (agreements.revisions_included), so
// "how many have we used" has to be answerable from data; and an unresolved
// request is the thing most likely to stall a project silently.

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

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
    const { deliverableId, body: text, isRevisionRequest } = await req.json();

    const cookieStore = await cookies();
    const authed = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );
    const { data: { user } } = await authed.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

    if (typeof deliverableId !== 'string' || !UUID_RE.test(deliverableId)) {
      return NextResponse.json({ error: 'deliverableId required' }, { status: 400 });
    }
    const message = String(text || '').trim();
    if (!message) return NextResponse.json({ error: 'Say what needs changing.' }, { status: 400 });
    if (message.length > 4000) {
      return NextResponse.json({ error: 'That is too long — keep it under 4000 characters.' }, { status: 400 });
    }

    const isAdmin =
      (user.email || '').toLowerCase() === adminEmail() ||
      (user.app_metadata as { role?: string } | undefined)?.role === 'admin';

    const sb = serviceClient();

    const { data: deliverable } = await sb
      .from('deliverables')
      .select('id, project_id, version, title')
      .eq('id', deliverableId)
      .maybeSingle();

    if (!deliverable) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Ownership is proved with the CALLER'S OWN client, so RLS decides. An
    // admin bypasses via is_admin() inside the policy; a client who does not
    // own the project simply gets nothing back.
    if (!isAdmin) {
      const { data: owned } = await authed
        .from('projects').select('id').eq('id', deliverable.project_id).maybeSingle();
      if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const author = isAdmin ? 'admin' : 'client';
    const revision = author === 'client' && Boolean(isRevisionRequest);

    const { data: comment, error } = await sb
      .from('deliverable_comments')
      .insert({
        deliverable_id: deliverableId,
        project_id: deliverable.project_id,
        author,
        author_user_id: user.id,
        body: message,
        is_revision_request: revision,
      })
      .select('id, created_at')
      .maybeSingle();

    if (error) {
      console.error('[deliverables/comment] insert failed:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Notify the other side. A comment nobody sees is the stall this is meant
    // to prevent.
    const { data: project } = await sb
      .from('projects').select('project_ref, client_id').eq('id', deliverable.project_id).maybeSingle();

    if (author === 'client') {
      await sb.from('notifications').insert({
        audience: 'admin',
        kind: revision ? 'revision_requested' : 'client_comment',
        title: revision
          ? `Revision requested — ${project?.project_ref || 'project'}`
          : `Client commented — ${project?.project_ref || 'project'}`,
        body: message.slice(0, 300),
        link: '/admin/projects',
        severity: revision ? 'warning' : 'info',
        project_id: deliverable.project_id,
      });
    } else if (project?.client_id) {
      await sb.from('notifications').insert({
        audience: 'client',
        kind: 'admin_comment',
        title: 'We replied on your delivery',
        body: message.slice(0, 300),
        link: '/portal',
        severity: 'info',
        client_id: project.client_id,
        project_id: deliverable.project_id,
      });
    }

    // How many revisions has this project used, against what the agreement
    // allows? Returned so the UI can say so instead of guessing.
    const { count: used } = await sb
      .from('deliverable_comments')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', deliverable.project_id)
      .eq('is_revision_request', true);

    return NextResponse.json({
      ok: true,
      commentId: comment?.id,
      author,
      isRevisionRequest: revision,
      revisionsUsed: used ?? null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'comment failed';
    console.error('[deliverables/comment] error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
