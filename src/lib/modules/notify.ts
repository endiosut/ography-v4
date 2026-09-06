// Standardized event payload for n8n — one schema, all events routed by type.
// n8n receives this and branches: WhatsApp to admin, email/WhatsApp to client.

export type OGraphyEvent =
  | 'LEAD_CREATED'
  | 'PAYMENT_RECEIVED'
  | 'AGREEMENT_ACCEPTED'
  | 'PAYMENT_PROOF_SUBMITTED'
  | 'PAYMENT_PROOF_REVIEWED'
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
  /** Absolute URL the client should open next (e.g. the payment screen). */
  actionUrl?: string | null;
  timestamp: string;
};

// ─────────────────────────────────────────────────────────────────────────────
//  MEASURED 06 Sep 2026 — THIS ENDPOINT IS DEAD
//
//    GET https://ographyy.app.n8n.cloud/webhook/ography-new-lead
//    -> 404, body: "<title>404 - No workspace here</title>"
//
//  That is not "workflow inactive" (n8n answers that with a JSON
//  "webhook not registered" error). "No workspace here" means the n8n Cloud
//  WORKSPACE at ographyy.app.n8n.cloud does not exist — expired, renamed, or
//  deleted. Every notification this app has ever tried to send has gone
//  nowhere.
//
//  And it was invisible, because the old implementation was:
//      try { await fetch(...) } catch { /* non-blocking */ }
//  A 404 is a RESOLVED fetch, so it did not even reach the catch. Nothing was
//  logged, ever, on any path.
//
//  Now: the URL is configurable, non-2xx is logged loudly with the status, and
//  the function reports whether it actually delivered. It still never throws —
//  a dead notifier must not fail a payment — but it no longer lies.
// ─────────────────────────────────────────────────────────────────────────────
const N8N_WEBHOOK =
  process.env.N8N_WEBHOOK_URL || 'https://ographyy.app.n8n.cloud/webhook/ography-new-lead';

export type FireResult = { delivered: boolean; status?: number; error?: string };

export async function fireEvent(payload: EventPayload): Promise<FireResult> {
  if (!N8N_WEBHOOK) {
    console.error('[notify] no webhook configured; dropped event', payload.event);
    return { delivered: false, error: 'no_webhook_configured' };
  }

  try {
    const res = await fetch(N8N_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      // Without this a hung notifier holds the request open for the platform
      // default. The client should never wait on a webhook.
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.error(
        `[notify] ${payload.event} NOT DELIVERED — ${res.status} from ${N8N_WEBHOOK}.` +
          (res.status === 404
            ? ' 404 here usually means the n8n workspace or webhook path no longer exists.'
            : '')
      );
      return { delivered: false, status: res.status };
    }

    return { delivered: true, status: res.status };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[notify] ${payload.event} failed to send:`, msg);
    return { delivered: false, error: msg };
  }
}
