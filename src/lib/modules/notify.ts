// Standardized event payload for n8n — one schema, all events routed by type.
// n8n receives this and branches: WhatsApp to admin, email/WhatsApp to client, etc.

export type OGraphyEvent =
  | 'LEAD_CREATED'
  | 'PAYMENT_RECEIVED'
  | 'BRIEF_SUBMITTED'
  | 'STAGE_CHANGED'
  | 'DELIVERED'
  | 'SUBSCRIPTION_STARTED';

export type EventPayload = {
  event: OGraphyEvent;
  projectId?: string;
  clientName: string;
  clientEmail: string;
  serviceName?: string;
  stage?: string;
  amount?: number | null;
  notes?: string | null;
  deliverableUrl?: string | null;
  timestamp: string;
};

const N8N_WEBHOOK = 'https://ographyy.app.n8n.cloud/webhook/ography-new-lead';

export async function fireEvent(payload: EventPayload): Promise<void> {
  try {
    await fetch(N8N_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Non-blocking — never fail the main flow because of notification
  }
}
