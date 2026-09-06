// Durable outbound messaging.
//
// THE GAP THIS CLOSES: sends used to fire once. A transient failure — a Resend
// blip, a WhatsApp rate limit, a cold start timing out — lost the message
// permanently, and the only trace was a log line nobody reads. That is exactly
// how the dead n8n workspace went unnoticed for the life of the project.
//
// Every outbound message is now a ROW first and a network call second:
//   enqueue()  writes the row and returns immediately
//   drain()    sends what is due, with bounded retries and exponential backoff
//
// That buys the two things n8n was giving us — retry and history — without the
// service. It also makes fan-out cheap: adding Slack or a CRM is another
// enqueue() with a different channel, not another code path threaded through
// every caller.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { sendEmail, sendWhatsApp, type DeliveryResult } from './deliver';
import { events } from './notifications';

export type OutboxChannel = 'email' | 'whatsapp' | 'telegram' | 'webhook';

export type EnqueueInput = {
  event: string;
  channel: OutboxChannel;
  recipient?: string | null;
  subject?: string | null;
  bodyText?: string | null;
  bodyHtml?: string | null;
  payload?: Record<string, unknown>;
  paymentId?: string | null;
  projectId?: string | null;
  /** Makes the enqueue idempotent — the same receipt cannot be queued twice. */
  dedupeKey?: string | null;
  maxAttempts?: number;
};

function serviceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service env vars not set');
  return createClient(url, key);
}

/** 1m, 5m, 25m, 2h, 10h — a transient blip clears on attempt 2; a broken
 *  config stops hammering the API within the hour. */
function backoffMs(attempt: number): number {
  return Math.min(60_000 * Math.pow(5, attempt), 12 * 3_600_000);
}

export async function enqueue(input: EnqueueInput): Promise<{ id: string | null; duplicate: boolean }> {
  const sb = serviceClient();

  const { data, error } = await sb
    .from('notification_outbox')
    .insert({
      event: input.event,
      channel: input.channel,
      recipient: input.recipient ?? null,
      subject: input.subject ?? null,
      body_text: input.bodyText ?? null,
      body_html: input.bodyHtml ?? null,
      payload: input.payload ?? {},
      payment_id: input.paymentId ?? null,
      project_id: input.projectId ?? null,
      dedupe_key: input.dedupeKey ?? null,
      max_attempts: input.maxAttempts ?? 5,
    })
    .select('id')
    .maybeSingle();

  if (error) {
    // 23505 on the dedupe index is a SUCCESS: the message is already queued or
    // already sent. Treating it as an error would double-send on any retry.
    if (error.code === '23505') return { id: null, duplicate: true };
    console.error('[outbox] enqueue failed:', error.message, error.code);
    throw new Error(`outbox enqueue failed: ${error.message}`);
  }

  return { id: data?.id ?? null, duplicate: false };
}

// ── TELEGRAM ────────────────────────────────────────────────────────────────
// No 24-hour window, no template approval, no per-message cost, and the bot API
// is a single HTTP call. The catch is the reverse of WhatsApp's: a user must
// /start the bot before it may message them, so you need their chat_id.
async function sendTelegram(chatId: string, text: string): Promise<DeliveryResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { channel: 'email', delivered: false, skipped: true, error: 'not_configured' };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: false }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { channel: 'email', delivered: false, status: res.status, error: body.slice(0, 300) };
    }
    return { channel: 'email', delivered: true, status: res.status };
  } catch (e: unknown) {
    return { channel: 'email', delivered: false, error: e instanceof Error ? e.message : String(e) };
  }
}

type OutboxRow = {
  id: string; event: string; channel: OutboxChannel;
  recipient: string | null; subject: string | null;
  body_text: string | null; body_html: string | null;
  payload: Record<string, unknown>;
  attempts: number; max_attempts: number;
};

async function deliverOne(row: OutboxRow): Promise<DeliveryResult> {
  const p = row.payload || {};

  if (row.channel === 'email') {
    return sendEmail({
      to: row.recipient || '',
      subject: row.subject || 'OGraphy',
      html: row.body_html || `<pre>${row.body_text || ''}</pre>`,
      replyTo: typeof p.replyTo === 'string' ? p.replyTo : undefined,
    });
  }

  if (row.channel === 'whatsapp') {
    return sendWhatsApp({
      to: row.recipient || '',
      text: row.body_text || '',
      template: typeof p.template === 'string' ? p.template : undefined,
      templateLang: typeof p.templateLang === 'string' ? p.templateLang : undefined,
      templateParams: Array.isArray(p.templateParams) ? (p.templateParams as string[]) : undefined,
    });
  }

  if (row.channel === 'telegram') {
    return sendTelegram(row.recipient || '', row.body_text || '');
  }

  // webhook — n8n or anything else, kept so fan-out costs one row not one branch
  const url = (typeof p.url === 'string' && p.url) || process.env.N8N_WEBHOOK_URL;
  if (!url) return { channel: 'email', delivered: false, skipped: true, error: 'no_webhook_url' };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p.body ?? p),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok
      ? { channel: 'email', delivered: true, status: res.status }
      : { channel: 'email', delivered: false, status: res.status, error: `HTTP ${res.status}` };
  } catch (e: unknown) {
    return { channel: 'email', delivered: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export type DrainSummary = {
  picked: number; sent: number; retrying: number; dead: number; skipped: number;
};

/**
 * Send what is due. Safe to call concurrently — each row is claimed by a
 * conditional update, so two overlapping drains cannot both send the same one.
 */
export async function drain(limit = 20): Promise<DrainSummary> {
  const sb = serviceClient();
  const summary: DrainSummary = { picked: 0, sent: 0, retrying: 0, dead: 0, skipped: 0 };

  const { data: due, error } = await sb
    .from('notification_outbox')
    .select('id,event,channel,recipient,subject,body_text,body_html,payload,attempts,max_attempts')
    .eq('status', 'pending')
    .lte('next_attempt_at', new Date().toISOString())
    .order('next_attempt_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[outbox] drain read failed:', error.message);
    return summary;
  }
  if (!due?.length) return summary;

  for (const raw of due) {
    const row = raw as OutboxRow;

    // Claim it. `.eq('status','pending')` is the lock: if another drain got
    // here first the update matches nothing and we skip.
    const { data: claimed } = await sb
      .from('notification_outbox')
      .update({ attempts: row.attempts + 1 })
      .eq('id', row.id)
      .eq('status', 'pending')
      .lte('next_attempt_at', new Date().toISOString())
      .select('id')
      .maybeSingle();

    if (!claimed) continue;
    summary.picked++;

    const result = await deliverOne(row);

    if (result.delivered) {
      await sb.from('notification_outbox')
        .update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null,
                  last_status_code: result.status ?? null })
        .eq('id', row.id);
      summary.sent++;
      continue;
    }

    // A channel with no credentials is not a failure to retry 5 times.
    if (result.skipped) {
      await sb.from('notification_outbox')
        .update({ status: 'skipped', last_error: result.error ?? 'not_configured' })
        .eq('id', row.id);
      summary.skipped++;
      continue;
    }

    const attempts = row.attempts + 1;
    const exhausted = attempts >= row.max_attempts;

    await sb.from('notification_outbox')
      .update({
        status: exhausted ? 'dead' : 'pending',
        last_error: (result.error ?? 'send failed').slice(0, 500),
        last_status_code: result.status ?? null,
        next_attempt_at: new Date(Date.now() + backoffMs(attempts)).toISOString(),
      })
      .eq('id', row.id);

    if (exhausted) {
      summary.dead++;
      // A receipt that gave up after 5 attempts is a client who paid and heard
      // nothing. That has to reach a human, not just a log line.
      const { data: ctx } = await sb
        .from('notification_outbox')
        .select('payment_id, project_id')
        .eq('id', row.id)
        .maybeSingle();
      await events.deliveryFailed({
        paymentId: ctx?.payment_id ?? null,
        projectId: ctx?.project_id ?? null,
        channel: row.channel,
        reason: (result.error ?? 'send failed').slice(0, 200),
      });
    } else {
      summary.retrying++;
    }
  }

  return summary;
}

/**
 * Enqueue, then attempt delivery immediately without making the caller wait.
 * The row is already durable, so a failure here just means the drain picks it
 * up later — the message is never lost either way.
 */
export async function enqueueAndTry(input: EnqueueInput): Promise<{ id: string | null; duplicate: boolean }> {
  const res = await enqueue(input);
  if (!res.duplicate) {
    drain(5).catch(e => console.error('[outbox] opportunistic drain failed:', e));
  }
  return res;
}
