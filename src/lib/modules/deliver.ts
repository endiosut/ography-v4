// Direct delivery channels — email (Resend) and WhatsApp (Meta Cloud API).
//
// These replace the dependency on n8n for the one thing n8n was actually doing
// here: turning an event into a message. n8n is still called by notify.ts if a
// URL is configured, but it is no longer the only path, so a dead workspace no
// longer means silence.
//
// Every function fails SOFT and reports what happened. A notification must
// never fail a payment — but it must never silently claim success either,
// which is exactly how the n8n 404 went unnoticed for the life of the project.

export type Channel = 'email' | 'whatsapp';

export type DeliveryResult = {
  channel: Channel;
  delivered: boolean;
  status?: number;
  error?: string;
  /** Set when the channel is simply not configured — not a failure to alarm on. */
  skipped?: boolean;
};

// ── EMAIL — Resend ───────────────────────────────────────────────────────────
// Free tier: 3,000/month, 100/day. Requires a verified sending domain; until
// one is verified, onboarding@resend.dev works but ONLY to the account owner's
// own address, which is why RESEND_FROM is explicit rather than assumed.
export async function sendEmail(args: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<DeliveryResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  if (!key || !from) {
    console.warn('[deliver] email skipped — RESEND_API_KEY/RESEND_FROM not set');
    return { channel: 'email', delivered: false, skipped: true, error: 'not_configured' };
  }
  if (!args.to) {
    return { channel: 'email', delivered: false, error: 'no_recipient' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject: args.subject,
        html: args.html,
        ...(args.replyTo ? { reply_to: args.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[deliver] email NOT sent — ${res.status}: ${body.slice(0, 300)}`);
      return { channel: 'email', delivered: false, status: res.status, error: body.slice(0, 300) };
    }
    return { channel: 'email', delivered: true, status: res.status };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[deliver] email threw:', msg);
    return { channel: 'email', delivered: false, error: msg };
  }
}

// ── WHATSAPP — Meta Cloud API ────────────────────────────────────────────────
//
// THE CONSTRAINT THAT DECIDES THE DESIGN: outside a 24-hour window opened by
// the CUSTOMER messaging you first, Meta refuses free-form text. Only a
// pre-approved template may be sent. A receipt sent days after someone last
// wrote to you is therefore a TEMPLATE message, not a text one — and templates
// must be submitted to Meta and approved before they can be used.
//
// So: send a template when one is configured, fall back to text otherwise, and
// say plainly in the logs when the 24h window is what blocked it (error 131047)
// rather than reporting a vague failure.
export async function sendWhatsApp(args: {
  /** E.164 digits, no '+' — e.g. 919876543210 */
  to: string;
  /** Used when inside the 24h window, or when no template is configured. */
  text: string;
  /** Template name approved in Meta Business Manager. */
  template?: string;
  templateLang?: string;
  /** Body variables, in order, for the template's {{1}}, {{2}} … */
  templateParams?: string[];
}): Promise<DeliveryResult> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    console.warn('[deliver] whatsapp skipped — WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID not set');
    return { channel: 'whatsapp', delivered: false, skipped: true, error: 'not_configured' };
  }

  const to = (args.to || '').replace(/[^\d]/g, '');
  if (!to) return { channel: 'whatsapp', delivered: false, error: 'no_recipient' };

  const payload = args.template
    ? {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: args.template,
          language: { code: args.templateLang || 'en' },
          ...(args.templateParams?.length
            ? {
                components: [{
                  type: 'body',
                  parameters: args.templateParams.map(t => ({ type: 'text', text: t })),
                }],
              }
            : {}),
        },
      }
    : { messaging_product: 'whatsapp', to, type: 'text', text: { body: args.text } };

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const windowClosed = body.includes('131047') || /24 hour|re-?engagement/i.test(body);
      console.error(
        `[deliver] whatsapp NOT sent — ${res.status}: ${body.slice(0, 300)}` +
          (windowClosed
            ? ' | The 24-hour customer-service window is closed. Free-form text is not allowed; send an APPROVED TEMPLATE instead.'
            : '')
      );
      return { channel: 'whatsapp', delivered: false, status: res.status, error: body.slice(0, 300) };
    }
    return { channel: 'whatsapp', delivered: true, status: res.status };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[deliver] whatsapp threw:', msg);
    return { channel: 'whatsapp', delivered: false, error: msg };
  }
}
