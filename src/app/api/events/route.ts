// Inbound webhook from n8n → updates project stage in Supabase.
// n8n calls this after any external action (e.g., WhatsApp confirmation received, payment processed).
// Protected by WEBHOOK_SECRET env var.

import { NextRequest, NextResponse } from 'next/server';
import { advanceStage, VALID_STAGES, type Stage } from '@/lib/modules/workflow';
import { logEvent } from '@/lib/modules/workflow';

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get('x-webhook-secret') || '';
    const expectedSecret = process.env.WEBHOOK_SECRET || '';

    if (expectedSecret && secret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, event, stage, notes, deliverableUrl, triggeredBy } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    // Handle stage advance
    if (event === 'STAGE_CHANGED' && stage) {
      if (!VALID_STAGES.includes(stage)) {
        return NextResponse.json({ error: `Invalid stage. Valid: ${VALID_STAGES.join(', ')}` }, { status: 400 });
      }

      await advanceStage({
        projectId,
        toStage: stage as Stage,
        triggeredBy: 'n8n',
        notes: notes || null,
        deliverableUrl: deliverableUrl || null,
      });

      return NextResponse.json({ success: true, projectId, newStage: stage });
    }

    // Handle arbitrary event logging (brief_submitted, etc.)
    if (event) {
      await logEvent({
        projectId,
        eventType: event,
        triggeredBy: triggeredBy || 'n8n',
        metadata: { notes, deliverableUrl },
      });
      return NextResponse.json({ success: true, logged: event });
    }

    return NextResponse.json({ error: 'event field is required' }, { status: 400 });
  } catch (e: any) {
    console.error('Events webhook error:', e);
    return NextResponse.json({ error: e.message || 'Webhook failed' }, { status: 500 });
  }
}
