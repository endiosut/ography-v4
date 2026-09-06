// In-app notification centre.
//
// WHY THIS EXISTS SEPARATELY FROM THE OUTBOX: the outbox is outbound mail and
// WhatsApp. This is what a person sees when they open the app. It is the only
// channel that works before any provider keys exist, and it survives a failed
// send — which matters, because for the life of this project every notification
// went to a dead n8n webhook and nobody ever knew.
//
// The catalogue below is the whole set of moments worth interrupting someone
// for. Anything that is not a decision, money, or a blocked flow is left out on
// purpose: a bell that cries wolf gets ignored, and then the one that matters
// gets ignored too.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type Audience = 'admin' | 'client';
export type Severity = 'info' | 'success' | 'warning' | 'critical';

export type NotifyInput = {
  audience: Audience;
  kind: string;
  title: string;
  body?: string | null;
  link?: string | null;
  severity?: Severity;
  clientId?: string | null;
  projectId?: string | null;
  paymentId?: string | null;
  dedupeKey?: string | null;
};

function serviceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service env vars not set');
  return createClient(url, key);
}

/**
 * Write a notification. Never throws — a notification failing must not fail the
 * payment, agreement or review that triggered it.
 */
export async function notify(input: NotifyInput): Promise<{ id: string | null; duplicate: boolean }> {
  try {
    // The DB constraint enforces this too, but failing here gives a readable
    // reason instead of a raw check-constraint violation in the logs.
    if (input.audience === 'client' && !input.clientId) {
      console.error('[notifications] client notification with no clientId:', input.kind);
      return { id: null, duplicate: false };
    }

    const sb = serviceClient();
    const { data, error } = await sb
      .from('notifications')
      .insert({
        audience: input.audience,
        kind: input.kind,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
        severity: input.severity ?? 'info',
        client_id: input.audience === 'client' ? input.clientId : null,
        project_id: input.projectId ?? null,
        payment_id: input.paymentId ?? null,
        dedupe_key: input.dedupeKey ?? null,
      })
      .select('id')
      .maybeSingle();

    if (error) {
      // 23505 on the dedupe index means it is already there — success.
      if (error.code === '23505') return { id: null, duplicate: true };
      console.error('[notifications] insert failed:', error.message, error.code);
      return { id: null, duplicate: false };
    }
    return { id: data?.id ?? null, duplicate: false };
  } catch (e) {
    console.error('[notifications] threw:', e);
    return { id: null, duplicate: false };
  }
}

/** Notify the admin and the client about the same event, in their own words. */
export async function notifyBoth(args: {
  admin: Omit<NotifyInput, 'audience'>;
  client: Omit<NotifyInput, 'audience'>;
}) {
  await Promise.all([
    notify({ ...args.admin, audience: 'admin', clientId: null }),
    notify({ ...args.client, audience: 'client' }),
  ]);
}

const money = (n: number | null | undefined) =>
  n == null ? '—' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ─────────────────────────────────────────────────────────────────────────────
//  THE CATALOGUE — every moment that earns an interruption.
//
//  ADMIN gets what needs a DECISION or is BLEEDING:
//    proof submitted ......... money is claimed, needs your eyes
//    payment feedback ........ someone hit a wall and asked for help
//    agreement accepted ...... a job just became real
//    window expired unpaid ... a live deal is going cold
//    delivery dead ........... a receipt never reached a paying client
//
//  CLIENT gets what changes THEIR state or needs THEIR action:
//    agreement ready ......... sign this
//    payment window open ..... pay now, here is how long you have
//    proof received .......... we have it, we are checking
//    payment approved ........ receipt, and what happens next
//    proof rejected .......... what was wrong and how to fix it
// ─────────────────────────────────────────────────────────────────────────────

export const events = {
  async proofSubmitted(a: {
    clientId: string; clientName: string; projectId: string | null;
    paymentId: string; projectRef: string; amountUsd: number | null; methodLabel?: string | null;
  }) {
    await notifyBoth({
      admin: {
        kind: 'proof_submitted',
        title: `Payment proof to review — ${a.projectRef}`,
        body: `${a.clientName} says they sent ${money(a.amountUsd)}${a.methodLabel ? ` by ${a.methodLabel}` : ''}. Check it against your account before approving.`,
        link: '/admin/payments/proofs',
        severity: 'warning',
        projectId: a.projectId, paymentId: a.paymentId,
        dedupeKey: `admin:proof_submitted:${a.paymentId}`,
      },
      client: {
        kind: 'proof_received',
        title: 'We have your payment proof',
        body: 'We check payments by hand, usually within one working day. Your project updates here as soon as it clears.',
        link: `/portal/pay/${a.paymentId}`,
        severity: 'info',
        clientId: a.clientId, projectId: a.projectId, paymentId: a.paymentId,
        dedupeKey: `client:proof_received:${a.paymentId}`,
      },
    });
  },

  async paymentApproved(a: {
    clientId: string; projectId: string | null; paymentId: string;
    projectRef: string; amountUsd: number;
  }) {
    await notify({
      audience: 'client',
      kind: 'payment_approved',
      title: `Payment confirmed — ${money(a.amountUsd)}`,
      body: `We have received your payment for ${a.projectRef}. Your receipt is on its way and your project moves to the next stage.`,
      link: '/portal',
      severity: 'success',
      clientId: a.clientId, projectId: a.projectId, paymentId: a.paymentId,
      dedupeKey: `client:payment_approved:${a.paymentId}`,
    });
  },

  async proofRejected(a: {
    clientId: string; projectId: string | null; paymentId: string; reason: string;
  }) {
    await notify({
      audience: 'client',
      kind: 'proof_rejected',
      title: 'We could not verify your payment',
      body: `${a.reason} You can submit again — nothing has been charged and your quote is unchanged.`,
      link: `/portal/pay/${a.paymentId}`,
      severity: 'warning',
      clientId: a.clientId, projectId: a.projectId, paymentId: a.paymentId,
      // Not deduped on payment alone: a second rejection is a NEW thing to say.
      dedupeKey: null,
    });
  },

  async agreementAccepted(a: {
    clientId: string; clientName: string; projectId: string | null;
    paymentId: string | null; projectRef: string; depositUsd: number | null;
    expiresAt?: string | null;
  }) {
    await notifyBoth({
      admin: {
        kind: 'agreement_accepted',
        title: `Agreement signed — ${a.projectRef}`,
        body: `${a.clientName} accepted. Deposit of ${money(a.depositUsd)} is now due.`,
        link: '/admin/payments',
        severity: 'success',
        projectId: a.projectId, paymentId: a.paymentId,
        dedupeKey: `admin:agreement_accepted:${a.projectRef}`,
      },
      client: {
        kind: 'payment_window_open',
        title: `Deposit due — ${money(a.depositUsd)}`,
        body: a.expiresAt
          ? `Your payment window is open until ${new Date(a.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. You can extend it twice if you need longer.`
          : 'Choose how you would like to pay.',
        link: a.paymentId ? `/portal/pay/${a.paymentId}` : '/portal',
        severity: 'warning',
        clientId: a.clientId, projectId: a.projectId, paymentId: a.paymentId,
        dedupeKey: a.paymentId ? `client:window_open:${a.paymentId}` : null,
      },
    });
  },

  async paymentFeedback(a: {
    paymentId: string; projectId: string | null; projectRef: string;
    reason: string; detail?: string | null; wantsContact: boolean;
  }) {
    await notify({
      audience: 'admin',
      kind: 'payment_feedback',
      title: a.wantsContact
        ? `Client asked for help paying — ${a.projectRef}`
        : `Payment feedback — ${a.projectRef}`,
      body: `${a.reason}${a.detail ? ` · "${a.detail}"` : ''}`,
      link: '/admin/payments',
      severity: a.wantsContact ? 'critical' : 'info',
      projectId: a.projectId, paymentId: a.paymentId,
      dedupeKey: null,
    });
  },

  async deliveryFailed(a: {
    paymentId: string | null; projectId: string | null; channel: string; reason: string;
  }) {
    await notify({
      audience: 'admin',
      kind: 'delivery_failed',
      title: `A ${a.channel} message never reached the client`,
      body: `${a.reason} — it was retried until it gave up. Reach out directly.`,
      link: '/admin/payments',
      severity: 'critical',
      projectId: a.projectId, paymentId: a.paymentId,
      dedupeKey: a.paymentId ? `admin:delivery_failed:${a.paymentId}:${a.channel}` : null,
    });
  },
};
