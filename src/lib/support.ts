// Where a stuck client is sent. One definition, used by every surface that can
// dead-end: the payment screen, the agreement screen, proof rejection.
//
// A manual settlement rail WILL strand people — a rate they cannot compute, a
// transfer that has not landed, a proof that was rejected. In a card checkout
// the processor absorbs that. Here, you do. So every failure state must offer a
// human, not just an error.

export const WHATSAPP_URL = 'https://wa.me/message/XT3YVW2B4KOVP1';
export const SUPPORT_EMAIL = 'ographyy@gmail.com';

/**
 * WhatsApp deep link carrying context, so the first message already says which
 * project and what went wrong instead of "hi".
 *
 * NOTE: wa.me/message/<code> is a short link and does NOT accept ?text=. Only
 * the wa.me/<number> form does. Rather than silently drop the context, the
 * caller copies it into the page and the client pastes it — see PayHelp.
 */
export function whatsappHref(): string {
  return WHATSAPP_URL;
}

export function supportSubject(ref: string | null | undefined, topic: string): string {
  return ref ? `${topic} — ${ref}` : topic;
}

export function mailtoHref(ref: string | null | undefined, topic: string, body?: string): string {
  const params = new URLSearchParams({ subject: supportSubject(ref, topic) });
  if (body) params.set('body', body);
  return `mailto:${SUPPORT_EMAIL}?${params.toString()}`;
}
