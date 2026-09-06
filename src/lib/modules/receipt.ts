// Receipt generation.
//
// Before this, nothing rendered or delivered a bill. payments.receipt_url was
// READ by /portal but written by nothing, so the column was permanently null
// and a paying client got no document at all.
//
// A receipt here is deliberately plain HTML in the email body rather than a
// PDF attachment: it renders in every mail client, it is searchable, and it
// needs no rendering dependency. The portal link is the canonical record.

import { SUPPORT_EMAIL, WHATSAPP_URL } from '@/lib/support';

export type ReceiptInput = {
  clientName: string;
  projectRef: string;
  serviceName: string | null;
  amountUsd: number;
  milestone: string;          // 'deposit' | 'full' | 'balance'
  methodLabel: string | null;
  reference: string | null;   // UTR / txid the client gave
  paidAt: string;             // ISO
  portalUrl: string;
  balanceUsd?: number | null;
};

const money = (n: number | null | undefined) =>
  n == null ? '—' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const esc = (s: string | null | undefined) =>
  String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export function receiptSubject(r: ReceiptInput): string {
  const kind = r.milestone === 'deposit' ? 'Deposit received' : 'Payment received';
  return `${kind} · ${r.projectRef} · ${money(r.amountUsd)}`;
}

/** Short enough for WhatsApp, where long messages get truncated in preview. */
export function receiptText(r: ReceiptInput): string {
  const kind = r.milestone === 'deposit' ? 'Deposit' : 'Payment';
  return [
    `OGraphy — ${kind} received`,
    ``,
    `${r.projectRef}${r.serviceName ? ` · ${r.serviceName}` : ''}`,
    `Amount: ${money(r.amountUsd)}`,
    r.methodLabel ? `Method: ${r.methodLabel}` : null,
    r.reference ? `Ref: ${r.reference}` : null,
    `Date: ${new Date(r.paidAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`,
    r.balanceUsd != null && r.balanceUsd > 0 ? `Balance remaining: ${money(r.balanceUsd)}` : null,
    ``,
    `Your project: ${r.portalUrl}`,
  ].filter(Boolean).join('\n');
}

export function receiptHtml(r: ReceiptInput): string {
  const kind = r.milestone === 'deposit' ? 'Deposit received' : 'Payment received';
  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:8px 0;color:#8a8175;font-size:13px;">${esc(label)}</td>
      <td style="padding:8px 0;color:#1a1712;font-size:13px;text-align:right;font-weight:500;">${esc(value)}</td>
    </tr>`;

  // Inline styles only, and a light background: many clients strip <style>
  // blocks, and a dark-themed receipt reads as broken in most inboxes.
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f2ec;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e5ded1;border-radius:8px;overflow:hidden;">
    <div style="background:#0a0906;padding:20px 24px;">
      <div style="color:#c9a96e;font-size:11px;letter-spacing:.25em;text-transform:uppercase;">OGraphy</div>
      <div style="color:#f0e8d8;font-size:20px;margin-top:6px;">${esc(kind)}</div>
    </div>

    <div style="padding:24px;">
      <p style="margin:0 0 16px;color:#1a1712;font-size:14px;line-height:1.6;">
        Hi ${esc(r.clientName)}, we have confirmed your payment. Thank you.
      </p>

      <div style="background:#faf8f4;border:1px solid #eee7db;border-radius:6px;padding:16px;">
        <div style="font-size:26px;color:#1a1712;font-weight:600;">${money(r.amountUsd)}</div>
        <div style="font-size:12px;color:#8a8175;margin-top:2px;text-transform:capitalize;">${esc(r.milestone)} payment</div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-top:16px;">
        ${row('Reference', r.projectRef)}
        ${r.serviceName ? row('Service', r.serviceName) : ''}
        ${r.methodLabel ? row('Paid by', r.methodLabel) : ''}
        ${r.reference ? row('Transaction', r.reference) : ''}
        ${row('Date', new Date(r.paidAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }))}
        ${r.balanceUsd != null && r.balanceUsd > 0 ? row('Balance remaining', money(r.balanceUsd)) : ''}
      </table>

      <a href="${esc(r.portalUrl)}"
         style="display:block;margin-top:22px;background:#c9a96e;color:#0a0906;text-align:center;
                padding:12px;border-radius:4px;text-decoration:none;font-size:13px;
                letter-spacing:.1em;text-transform:uppercase;font-weight:600;">
        View your project
      </a>

      <p style="margin:18px 0 0;color:#8a8175;font-size:12px;line-height:1.7;">
        Questions? Reply to this email, write to
        <a href="mailto:${esc(SUPPORT_EMAIL)}" style="color:#9a7f4e;">${esc(SUPPORT_EMAIL)}</a>,
        or <a href="${esc(WHATSAPP_URL)}" style="color:#9a7f4e;">message us on WhatsApp</a>.
        Quote ${esc(r.projectRef)}.
      </p>
    </div>
  </div>

  <p style="max-width:520px;margin:14px auto 0;color:#a49b8c;font-size:11px;text-align:center;">
    This is a receipt for a payment confirmed by OGraphy. Keep it for your records.
  </p>
</body></html>`;
}
