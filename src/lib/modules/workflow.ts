// Workflow Engine — every stage transition goes through here.
// Logs an event, updates Supabase, fires n8n notification.
// Plug in any new stage or service type without changing call sites.

import { createClient } from '@supabase/supabase-js';
import { fireEvent, OGraphyEvent } from './notify';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service env vars not set');
  return createClient(url, key);
}

export const VALID_STAGES = [
  'lead',
  'payment_received',
  'brief_submitted',
  'in_production',
  'review',
  'revision',
  'delivering',
  'completed',
] as const;

export type Stage = (typeof VALID_STAGES)[number];

type LogEventInput = {
  projectId: string;
  eventType: string;
  fromStage?: string | null;
  toStage?: string | null;
  triggeredBy?: string;
  metadata?: Record<string, any>;
};

export async function logEvent(input: LogEventInput): Promise<void> {
  try {
    const sb = getServiceSupabase();
    await sb.from('project_events').insert({
      project_id: input.projectId,
      event_type: input.eventType,
      from_stage: input.fromStage || null,
      to_stage: input.toStage || null,
      triggered_by: input.triggeredBy || 'system',
      metadata: input.metadata || {},
    });
  } catch {
    // project_events table may not exist yet — never block the main flow
  }
}

type AdvanceInput = {
  projectId: string;
  toStage: Stage;
  triggeredBy?: 'admin' | 'client' | 'system' | 'n8n';
  notes?: string | null;
  deliverableUrl?: string | null;
};

type ProjectMeta = {
  client_id: string;
  service_name: string;
  stage: string;
  clients: { name: string; email: string } | null;
};

export async function advanceStage(input: AdvanceInput): Promise<void> {
  const sb = getServiceSupabase();

  const { data: project } = await sb
    .from('projects')
    .select('client_id, service_name, stage, clients(name, email)')
    .eq('id', input.projectId)
    .single<ProjectMeta>();

  if (!project) throw new Error('Project not found');

  const fromStage = project.stage;

  // Build update payload
  const updatePayload: Record<string, any> = {
    stage: input.toStage,
    updated_at: new Date().toISOString(),
  };
  if (input.notes) updatePayload.notes = input.notes;
  if (input.deliverableUrl) updatePayload.deliverable_url = input.deliverableUrl;
  if (input.toStage === 'completed' || input.toStage === 'delivering') {
    updatePayload.delivered_at = new Date().toISOString();
  }

  await sb.from('projects').update(updatePayload).eq('id', input.projectId);

  // Log the transition
  await logEvent({
    projectId: input.projectId,
    eventType: 'STAGE_CHANGED',
    fromStage,
    toStage: input.toStage,
    triggeredBy: input.triggeredBy || 'admin',
    metadata: { notes: input.notes },
  });

  // Determine n8n event type
  const eventType: OGraphyEvent =
    input.toStage === 'delivering' || input.toStage === 'completed'
      ? 'DELIVERED'
      : 'STAGE_CHANGED';

  // Fire notification
  const client = project.clients;
  await fireEvent({
    event: eventType,
    projectId: input.projectId,
    clientName: client?.name || 'Client',
    clientEmail: client?.email || '',
    serviceName: project.service_name,
    stage: input.toStage,
    notes: input.notes,
    deliverableUrl: input.deliverableUrl || null,
    timestamp: new Date().toISOString(),
  });
}
