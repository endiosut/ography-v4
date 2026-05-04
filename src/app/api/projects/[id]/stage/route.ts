// Admin: advance project stage via API.
// Called from admin dashboard or via n8n for automated progressions.

import { NextRequest, NextResponse } from 'next/server';
import { advanceStage, VALID_STAGES, type Stage } from '@/lib/modules/workflow';
import { createServerClient } from '@supabase/ssr';

const ADMIN_EMAIL = 'endiosut.eo@gmail.com';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin session
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => req.cookies.getAll(),
          setAll: () => {},
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { stage, notes, deliverableUrl } = body;

    if (!stage || !VALID_STAGES.includes(stage)) {
      return NextResponse.json({ error: `Invalid stage. Valid: ${VALID_STAGES.join(', ')}` }, { status: 400 });
    }

    await advanceStage({
      projectId: params.id,
      toStage: stage as Stage,
      triggeredBy: 'admin',
      notes: notes || null,
      deliverableUrl: deliverableUrl || null,
    });

    return NextResponse.json({ success: true, projectId: params.id, newStage: stage });
  } catch (e: any) {
    console.error('Stage advance error:', e);
    return NextResponse.json({ error: e.message || 'Stage advance failed' }, { status: 500 });
  }
}
