'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import NavBar from '@/components/NavBar';
import { WHATSAPP_URL, SUPPORT_EMAIL, mailtoHref } from '@/lib/support';

// Payment instruction + proof submission — step 4 of the loop.
//
//   cart -> contact -> agreement (3) -> PAY (4) -> brief (5) -> production -> delivery
//
// Manual regional payments have no callback: nothing tells you a UPI transfer
// landed. So this page does the only three things that make that workable —
//   1. state the exact amount and the reference to quote (project_ref)
//   2. show how to pay, per the client's own region
//   3. capture proof, so the client gets a receipt and you get something to match
//
// Approval stays human and deliberate. A screenshot is a claim, not a payment.

type Payment = {
  id: string; project_id: string | null; client_id: string | null;
  amount_usd: number | null; milestone: string | null;
  status: string | null; paid_at: string | null;
};

type Project = { id: string; project_ref: string | null; service_name: string | null };

type Method = {
  id: string; label: string; method_type: string;
  country_code: string | null; currency_code: string;
  instructions: string; account_holder: string | null;
  account_reference: string | null; qr_code_path: string | null;
  sort_order: number;
  // Added 06 Sep 2026 with the P2P rails.
  network: string | null;      // crypto only — wrong chain destroys the funds
  memo_tag: string | null;     // some exchange deposits are unattributed without it
  asset_code: string | null;   // USDT, BTC — distinct from the fiat currency
  rate_per_usd: number | null; // units of currency_code per 1 USD; null = ask
};

type Proof = {
  id: string; review_status: string; submitted_at: string;
  reference_text: string | null; review_note: string | null;
};

const gold = '#c9a96e', cream = '#e8d5b7', ink = '#0a0906', panel = '#0f0d0a';

// What a client can send as evidence. Screenshots come off phones, so HEIC and
// HEIF are named explicitly rather than relying on `image/*` — several in-app
// browsers (Instagram, WhatsApp) will not match HEIC against the wildcard and
// grey out the file the client is trying to attach.
const PROOF_ACCEPT = [
  'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif',
  'image/*', 'application/pdf',
].join(',');
const PROOF_MAX_BYTES = 10 * 1024 * 1024;

const METHOD_LABEL: Record<string, string> = {
  upi: 'UPI', mobile_money: 'Mobile money', bank_transfer: 'Bank transfer',
  crypto: 'Crypto', cash: 'Cash', other: 'Other',
};

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('[pay] Missing Supabase env.', 'URL:', Boolean(url), 'ANON:', Boolean(key));
    throw new Error('Supabase configuration missing');
  }
  return createBrowserClient(url, key);
}

const money = (n: number | null | undefined) =>
  n == null ? '—' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/**
 * The human escape hatch.
 *
 * A card checkout fails loudly and the processor handles it. A manual rail
 * fails quietly and strands the client — an unknown FX rate, a transfer that
 * has not landed, a rejected proof. Every one of those states needs a person,
 * so this sits in all of them.
 *
 * wa.me/message/<code> is a short link and ignores ?text=, so the context line
 * is rendered for the client to copy rather than silently dropped.
 */
function PayHelp({ payRef }: { payRef: string }) {
  return (
    <div style={{ marginTop: '.9rem', display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          background: 'rgba(37,211,102,.12)', border: '1px solid rgba(37,211,102,.45)',
          color: '#25d366', textDecoration: 'none', borderRadius: 4,
          padding: '.5rem 1rem', fontSize: '.62rem', letterSpacing: '.1em',
          textTransform: 'uppercase', fontFamily: 'Montserrat, sans-serif',
        }}
      >
        Message us on WhatsApp
      </a>
      <a
        href={mailtoHref(payRef, 'Payment help')}
        style={{
          border: '1px solid rgba(201,169,110,.3)', color: gold, textDecoration: 'none',
          borderRadius: 4, padding: '.5rem 1rem', fontSize: '.62rem', letterSpacing: '.1em',
          textTransform: 'uppercase', fontFamily: 'Montserrat, sans-serif',
        }}
      >
        Email
      </a>
      <span style={{ fontSize: '.6rem', color: 'rgba(232,213,183,.3)' }}>
        Quote <strong style={{ color: 'rgba(232,213,183,.5)', fontFamily: 'IBM Plex Mono, monospace' }}>{payRef}</strong>
      </span>
    </div>
  );
}

/**
 * Copyable value.
 *
 * This is the single most important control on the page and it did not exist.
 * A QR code is unusable to most people paying here, because they are paying on
 * the SAME PHONE that is displaying it — there is no second device to scan
 * with. Binance and 1xbet both solve this with copy-to-clipboard on the
 * address plus an app deep link. Without it the client is retyping a UPI ID or
 * a wallet address by hand, and a mistyped wallet address sends the money to
 * a stranger.
 */
function CopyRow({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard is blocked on insecure origins and in some in-app browsers;
      // selecting the text still works, so fail quietly rather than alarm.
      console.error('[pay] clipboard unavailable');
    }
  };

  return (
    <div style={{ marginBottom: '.7rem' }}>
      <div style={{ fontSize: '.58rem', color: 'rgba(232,213,183,.32)', marginBottom: '.25rem' }}>{label}</div>
      <div style={{ display: 'flex', gap: '.5rem', alignItems: 'stretch' }}>
        <div style={{
          flex: 1, minWidth: 0, color: '#f0e8d8',
          fontFamily: mono ? 'IBM Plex Mono, monospace' : 'Montserrat, sans-serif',
          fontSize: '.76rem', background: 'rgba(201,169,110,.06)',
          border: '1px solid rgba(201,169,110,.18)', borderRadius: 4,
          padding: '.55rem .7rem', overflowWrap: 'anywhere',
        }}>
          {value}
        </div>
        <button
          onClick={copy}
          style={{
            flexShrink: 0, background: copied ? 'rgba(74,158,107,.15)' : 'rgba(201,169,110,.1)',
            border: `1px solid ${copied ? 'rgba(74,158,107,.5)' : 'rgba(201,169,110,.3)'}`,
            color: copied ? '#4a9e6b' : gold, borderRadius: 4, cursor: 'pointer',
            padding: '0 .9rem', fontSize: '.6rem', letterSpacing: '.1em',
            textTransform: 'uppercase', fontFamily: 'Montserrat, sans-serif',
            WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
          }}
        >
          {copied ? '✓' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

// Countdown from payment_links.expires_at. Null expiry = no timer, not "expired".
function useCountdown(expiresAt: string | null) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!expiresAt) { setLeft(null); return; }
    const tick = () => setLeft(new Date(expiresAt).getTime() - Date.now());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  if (left == null) return null;
  if (left <= 0) return { expired: true, text: 'Expired' };
  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  return {
    expired: false,
    text: h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h remaining`
        : h > 0   ? `${h}h ${m}m remaining`
                  : `${m}m ${s}s remaining`,
    urgent: h < 6,
  };
}

export default function PayPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const router = useRouter();

  const [user, setUser] = useState<{ email: string; name?: string } | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [methods, setMethods] = useState<Method[]>([]);
  const [proof, setProof] = useState<Proof | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const [chosen, setChosen] = useState<string | null>(null);
  const [reference, setReference] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const countdown = useCountdown(expiresAt);

  const load = useCallback(async () => {
    try {
      const sb = getSupabase();
      const { data: { user: u } } = await sb.auth.getUser();
      if (!u) { router.replace(`/login?next=/portal/pay/${paymentId}`); return; }
      setUser({ email: u.email || '', name: u.user_metadata?.full_name });

      const { data: pay, error: payErr } = await sb
        .from('payments').select('*').eq('id', paymentId).maybeSingle();
      if (payErr) console.error('[pay] payment:', payErr.message);
      if (!pay) { setError('This payment is not available on your account.'); return; }
      setPayment(pay as Payment);

      if (pay.project_id) {
        const [{ data: proj }, { data: link }] = await Promise.all([
          sb.from('projects').select('id,project_ref,service_name').eq('id', pay.project_id).maybeSingle(),
          sb.from('payment_links').select('expires_at,is_active').eq('project_id', pay.project_id)
            .eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        ]);
        if (proj) setProject(proj as Project);
        if (link?.expires_at) setExpiresAt(link.expires_at as string);
      }

      // Ordered + limit(1), NOT maybeSingle() on the bare filter.
      //
      // payment_proofs used to carry UNIQUE(payment_id), so exactly one row was
      // possible and maybeSingle() was safe. Migration 008b replaced that with a
      // partial unique on OPEN proofs, so a client whose proof was rejected can
      // now submit a corrected one — and from that moment there are two rows.
      // maybeSingle() throws on more than one row, so leaving it would have
      // broken this page for precisely the clients who had already had a
      // payment problem.
      const { data: existing, error: proofErr } = await sb
        .from('payment_proofs')
        .select('id,review_status,submitted_at,reference_text,review_note')
        .eq('payment_id', paymentId)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (proofErr) console.error('[pay] proof read:', proofErr.message);
      setProof((existing as Proof) ?? null);

      const { data: ms, error: mErr } = await sb
        .from('payment_methods').select('*').eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (mErr) console.error('[pay] methods:', mErr.message);
      setMethods((ms || []) as Method[]);
      if (ms?.length === 1) setChosen(ms[0].id as string);
    } catch (e) {
      console.error('[pay] load threw:', e);
      setError('We could not load this payment.');
    } finally {
      setLoading(false);
    }
  }, [paymentId, router]);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [paymentId]);

  // QR lives in `payment-qr` — public to read, admin-only to write.
  //
  // It used to be read from `catalog-images`, which grants INSERT/UPDATE/DELETE
  // to `public`. Any anonymous visitor could have overwritten a payment QR
  // there with their own wallet's code, and every subsequent payment would have
  // gone to them with nothing on this page looking wrong.
  useEffect(() => {
    const m = methods.find(x => x.id === chosen);
    if (!m?.qr_code_path) { setQrUrl(null); return; }
    (async () => {
      try {
        const sb = getSupabase();
        const { data } = await sb.storage.from('payment-qr').getPublicUrl(m.qr_code_path!);
        setQrUrl(data?.publicUrl ?? null);
      } catch (e) { console.error('[pay] qr url:', e); setQrUrl(null); }
    })();
  }, [chosen, methods]);

  const submit = async () => {
    if (!payment) return;
    if (!chosen) { setError('Choose how you paid.'); return; }
    if (!file && !reference.trim()) {
      setError('Attach a screenshot or enter the transaction reference — we need one of them to match your payment.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const sb = getSupabase();
      let filePath: string | null = null;

      if (file) {
        // Folder MUST be the payment id — the storage policy checks it.
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
        filePath = `${payment.id}/${Date.now()}-${safe}`;
        const { error: upErr } = await sb.storage
          .from('payment-proofs').upload(filePath, file, { upsert: false });
        if (upErr) {
          console.error('[pay] upload failed:', upErr.message);
          setError('The file could not be uploaded. Try a smaller image, or send just the reference.');
          return;
        }
      }

      const { error: insErr } = await sb.from('payment_proofs').insert({
        payment_id: payment.id,
        payment_method_id: chosen,
        file_path: filePath,
        reference_text: reference.trim() || null,
        review_status: 'submitted',   // required by the RLS insert policy
      });

      if (insErr) {
        console.error('[pay] proof insert failed:', insErr.message, insErr.code);
        setError(
          insErr.code === '23505'
            ? 'A proof has already been submitted for this payment.'
            : 'We could not record your submission. Nothing was charged — please try again.'
        );
        return;
      }
      await load();
    } catch (e) {
      console.error('[pay] submit threw:', e);
      setError('We could not record your submission. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '.6rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(201,169,110,.35)' }}>
          Loading payment…
        </div>
      </div>
    );
  }

  if (error && !payment) {
    return (
      <div style={{ minHeight: '100vh', background: ink, fontFamily: 'Montserrat, sans-serif' }}>
        <NavBar user={user ? { email: user.email, full_name: user.name } : undefined} />
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '9rem 2rem', textAlign: 'center' }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.4rem', color: '#f0e8d8', fontWeight: 300, marginBottom: '.75rem' }}>
            Payment unavailable
          </div>
          <div style={{ fontSize: '.75rem', color: 'rgba(232,213,183,.4)', lineHeight: 1.8, marginBottom: '2rem' }}>{error}</div>
          <Link href="/portal" style={{ color: gold, border: '1px solid rgba(201,169,110,.3)', padding: '.8rem 2rem', fontSize: '.65rem', letterSpacing: '.14em', textTransform: 'uppercase', textDecoration: 'none' }}>
            ← Back to portal
          </Link>
        </div>
      </div>
    );
  }

  const p = payment!;
  const isPaid = p.status === 'paid';
  const method = methods.find(m => m.id === chosen) || null;
  const payRef = project?.project_ref || p.id.slice(0, 8).toUpperCase();

  // The amount in the currency the client will actually send.
  // Deliberately null when the rate is unknown — never a silent 1:1.
  const localAmount = (() => {
    if (!method || p.amount_usd == null) return null;
    const rate = method.rate_per_usd;
    if (rate == null || !Number.isFinite(Number(rate))) return null;
    const value = Number(p.amount_usd) * Number(rate);
    const unit = method.asset_code || method.currency_code;
    return `${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unit}`;
  })();

  // upi:// opens the client's UPI app with payee and amount prefilled. `tn` is
  // the transaction note — this is what carries the project reference, and
  // without it a manual transfer cannot be matched.
  // Amount is only included when the INR figure is actually known.
  const upiHref = (() => {
    if (!method || method.method_type !== 'upi' || !method.account_reference) return null;
    const params = new URLSearchParams({
      pa: method.account_reference,
      pn: method.account_holder || 'OGraphy',
      tn: payRef,
      cu: method.currency_code || 'INR',
    });
    if (localAmount && method.rate_per_usd != null && p.amount_usd != null) {
      params.set('am', (Number(p.amount_usd) * Number(method.rate_per_usd)).toFixed(2));
    }
    return `upi://pay?${params.toString()}`;
  })();

  return (
    <div style={{ minHeight: '100vh', background: ink, fontFamily: 'Montserrat, sans-serif', color: cream }}>
      <NavBar user={user ? { email: user.email, full_name: user.name } : undefined} />

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '7rem 2rem 6rem' }}>
        <Link href="/portal" style={{ fontSize: '.6rem', color: 'rgba(201,169,110,.45)', textDecoration: 'none', letterSpacing: '.1em' }}>
          ← Portal
        </Link>

        <div style={{ marginTop: '1.25rem', marginBottom: '1.75rem' }}>
          <div style={{ fontSize: '.5rem', letterSpacing: '.3em', textTransform: 'uppercase', color: 'rgba(201,169,110,.4)', marginBottom: '.5rem' }}>
            {p.milestone === 'deposit' ? 'Deposit' : p.milestone === 'balance' ? 'Balance' : 'Payment'}
          </div>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(1.7rem,4vw,2.5rem)', fontWeight: 300, color: '#f0e8d8', lineHeight: 1.15 }}>
            {isPaid ? 'Payment confirmed' : proof ? 'Payment under review' : money(p.amount_usd)}
          </h1>
          {project?.service_name && (
            <div style={{ fontSize: '.7rem', color: 'rgba(232,213,183,.35)', marginTop: '.5rem' }}>{project.service_name}</div>
          )}
        </div>

        {/* Countdown — only when a link actually sets an expiry */}
        {countdown && !isPaid && !proof && (
          <div style={{
            border: `1px solid ${countdown.expired ? 'rgba(224,112,112,.3)' : countdown.urgent ? 'rgba(224,180,112,.3)' : 'rgba(201,169,110,.15)'}`,
            background: countdown.expired ? 'rgba(224,112,112,.05)' : 'rgba(201,169,110,.03)',
            padding: '.7rem 1.1rem', borderRadius: 6, marginBottom: '1.25rem',
            fontSize: '.68rem', letterSpacing: '.06em',
            color: countdown.expired ? '#e07070' : countdown.urgent ? '#e0b470' : 'rgba(232,213,183,.5)',
          }}>
            {countdown.expired
              ? 'This payment window has closed. Contact us and we will reissue it.'
              : `Payment window — ${countdown.text}`}
          </div>
        )}

        {/* ── AMOUNT + REFERENCE ── */}
        <div style={{ border: '1px solid rgba(201,169,110,.15)', background: panel, borderRadius: 6, padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
            <span style={{ fontSize: '.7rem', color: 'rgba(232,213,183,.4)' }}>Amount due</span>
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '1.35rem', color: gold }}>{money(p.amount_usd)}</span>
          </div>
          <div style={{ height: 1, background: 'rgba(201,169,110,.08)', margin: '.85rem 0' }} />
          <div style={{ fontSize: '.7rem', color: 'rgba(232,213,183,.4)', marginBottom: '.4rem' }}>
            Use this as your payment reference
          </div>
          <div style={{
            fontFamily: 'IBM Plex Mono, monospace', fontSize: '1.05rem', color: '#f0e8d8',
            background: 'rgba(201,169,110,.06)', border: '1px dashed rgba(201,169,110,.25)',
            padding: '.65rem .9rem', borderRadius: 4, letterSpacing: '.05em',
          }}>
            {payRef}
          </div>
          <div style={{ fontSize: '.62rem', color: 'rgba(232,213,183,.25)', marginTop: '.5rem', lineHeight: 1.6 }}>
            Without it we may not be able to match your transfer, which delays your project.
          </div>
        </div>

        {/* ── ALREADY PAID / UNDER REVIEW ── */}
        {isPaid ? (
          <div style={{ border: '1px solid rgba(74,158,107,.3)', background: 'rgba(74,158,107,.05)', padding: '1.5rem', borderRadius: 6 }}>
            <div style={{ fontSize: '.75rem', color: '#4a9e6b', marginBottom: '.4rem' }}>
              Received{p.paid_at ? ` on ${new Date(p.paid_at).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}
            </div>
            <div style={{ fontSize: '.72rem', color: 'rgba(232,213,183,.5)', lineHeight: 1.7 }}>
              Your project moves to the next stage. You can submit your brief from the portal.
            </div>
          </div>
        ) : proof && proof.review_status !== 'rejected' ? (
          <div style={{ border: '1px solid rgba(201,169,110,.2)', background: panel, padding: '1.5rem', borderRadius: 6 }}>
            <div style={{ fontSize: '.75rem', color: gold, marginBottom: '.5rem' }}>
              {proof.review_status === 'rejected' ? 'We could not verify this payment' : 'Submitted — under review'}
            </div>
            <div style={{ fontSize: '.72rem', color: 'rgba(232,213,183,.5)', lineHeight: 1.7 }}>
              Received {new Date(proof.submitted_at).toLocaleString()}.
              {proof.reference_text ? ` Reference: ${proof.reference_text}.` : ''}
              {proof.review_status === 'rejected'
                ? ' Please contact us so we can sort it out.'
                : ' We check payments manually — usually within one working day. Your portal updates as soon as it clears.'}
            </div>
            {proof.review_note && (
              <div style={{ marginTop: '.9rem', paddingTop: '.9rem', borderTop: '1px solid rgba(201,169,110,.08)', fontSize: '.7rem', color: 'rgba(232,213,183,.45)' }}>
                {proof.review_note}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* A rejected proof used to end the flow: the UI showed "contact
                us" and the UNIQUE constraint made a second submission
                impossible anyway. Now the reason is shown and the form below
                stays open so the client can correct and resubmit. */}
            {proof?.review_status === 'rejected' && (
              <div style={{
                border: '1px solid rgba(224,112,112,.35)', background: 'rgba(224,112,112,.06)',
                borderRadius: 6, padding: '1.1rem 1.25rem', marginBottom: '1.5rem',
              }}>
                <div style={{ fontSize: '.75rem', color: '#e07070', marginBottom: '.45rem' }}>
                  We could not verify your last payment
                </div>
                <div style={{ fontSize: '.72rem', color: 'rgba(232,213,183,.55)', lineHeight: 1.7 }}>
                  {proof.review_note
                    ? proof.review_note
                    : 'The details did not match a transfer we received.'}
                  {' '}You can submit again below — or message us and we will sort it out with you.
                </div>
                <PayHelp payRef={payRef} />
              </div>
            )}

            {/* ── HOW TO PAY ── */}
            <div style={{ border: '1px solid rgba(201,169,110,.12)', background: panel, borderRadius: 6, padding: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '.52rem', letterSpacing: '.22em', textTransform: 'uppercase', color: 'rgba(201,169,110,.4)', marginBottom: '1rem' }}>
                How to pay
              </div>

              {methods.length === 0 ? (
                <div style={{ fontSize: '.73rem', color: 'rgba(232,213,183,.4)', lineHeight: 1.8 }}>
                  No payment methods are configured yet. Contact us at{' '}
                  <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: gold }}>{SUPPORT_EMAIL}</a>{' '}
                  and we will send instructions directly.
                  <PayHelp payRef={payRef} />
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                    {methods.map(m => (
                      <button
                        key={m.id}
                        onClick={() => { setChosen(m.id); setError(null); }}
                        style={{
                          border: `1px solid ${chosen === m.id ? gold : 'rgba(201,169,110,.18)'}`,
                          background: chosen === m.id ? 'rgba(201,169,110,.08)' : 'transparent',
                          color: chosen === m.id ? '#f0e8d8' : 'rgba(232,213,183,.5)',
                          padding: '.55rem 1rem', borderRadius: 4, cursor: 'pointer',
                          fontFamily: 'Montserrat, sans-serif', fontSize: '.66rem', letterSpacing: '.06em',
                          WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
                        }}
                      >
                        {m.label}
                        <span style={{ opacity: .5 }}> · {METHOD_LABEL[m.method_type] || m.method_type}</span>
                      </button>
                    ))}
                  </div>

                  {method && (
                    <div>
                      {/* Wrong-chain transfers are unrecoverable, so the network
                          is stated before anything else, not buried in prose. */}
                      {method.method_type === 'crypto' && method.network && (
                        <div style={{
                          border: '1px solid rgba(224,180,112,.35)', background: 'rgba(224,180,112,.07)',
                          borderRadius: 6, padding: '.75rem 1rem', marginBottom: '1rem',
                          fontSize: '.7rem', color: '#e0b470', lineHeight: 1.65,
                        }}>
                          Send <strong>{method.asset_code || 'funds'}</strong> on the{' '}
                          <strong>{method.network}</strong> network only. A transfer on any other
                          network cannot be recovered.
                        </div>
                      )}

                      {/* The amount in the currency they will actually send. */}
                      {localAmount ? (
                        <div style={{
                          border: '1px solid rgba(201,169,110,.2)', borderRadius: 6,
                          padding: '.8rem 1rem', marginBottom: '1rem',
                          display: 'flex', justifyContent: 'space-between',
                          alignItems: 'baseline', gap: '.75rem', flexWrap: 'wrap',
                        }}>
                          <span style={{ fontSize: '.66rem', color: 'rgba(232,213,183,.4)' }}>
                            Send exactly
                          </span>
                          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '1.15rem', color: gold }}>
                            {localAmount}
                          </span>
                        </div>
                      ) : method.currency_code !== 'USD' ? (
                        // A missing rate must never silently imply 1:1 — that
                        // would undercharge by ~88x on INR.
                        <div style={{
                          border: '1px solid rgba(224,180,112,.3)', background: 'rgba(224,180,112,.06)',
                          borderRadius: 6, padding: '.75rem 1rem', marginBottom: '1rem',
                          fontSize: '.7rem', color: '#e0b470', lineHeight: 1.65,
                        }}>
                          We have not published today&#39;s {method.currency_code} rate yet.
                          Message us and we will confirm the exact {method.currency_code} amount
                          before you send anything.
                          <PayHelp payRef={payRef} />
                        </div>
                      ) : null}

                      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                        {qrUrl && (
                          <div style={{ flexShrink: 0 }}>
                            <img
                              src={qrUrl} alt={`${method.label} QR code`}
                              style={{ width: 170, height: 170, objectFit: 'contain', background: '#fff', padding: 10, borderRadius: 6 }}
                            />
                            <div style={{ fontSize: '.55rem', color: 'rgba(232,213,183,.25)', textAlign: 'center', marginTop: '.4rem' }}>
                              Paying on this phone? Use Copy instead.
                            </div>
                          </div>
                        )}

                        <div style={{ flex: 1, minWidth: 240 }}>
                          {method.account_holder && (
                            <CopyRow label="Account name" value={method.account_holder} mono={false} />
                          )}
                          {method.account_reference && (
                            <CopyRow
                              label={method.method_type === 'crypto' ? 'Pay ID / address' : 'Send to'}
                              value={method.account_reference}
                            />
                          )}
                          {method.memo_tag && (
                            <CopyRow label="Memo / tag — required" value={method.memo_tag} />
                          )}
                          {/* The reference is what makes a manual transfer
                              matchable. It needs copying more than anything. */}
                          <CopyRow label="Payment reference — include this" value={payRef} />

                          {/* Opens the UPI app directly with the payee filled
                              in, which is the whole point on mobile. */}
                          {upiHref && (
                            <a
                              href={upiHref}
                              style={{
                                display: 'inline-block', marginTop: '.35rem', marginBottom: '.6rem',
                                background: gold, color: ink, textDecoration: 'none',
                                padding: '.6rem 1.2rem', borderRadius: 4, fontSize: '.63rem',
                                letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 600,
                              }}
                            >
                              Open UPI app →
                            </a>
                          )}

                          <div style={{ fontSize: '.7rem', color: 'rgba(232,213,183,.55)', lineHeight: 1.75, whiteSpace: 'pre-wrap', marginTop: '.6rem' }}>
                            {method.instructions}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ── CONFIRM ── */}
            {methods.length > 0 && (
              <div style={{ border: '1px solid rgba(201,169,110,.2)', background: panel, borderRadius: 6, padding: '1.5rem' }}>
                <div style={{ fontSize: '.52rem', letterSpacing: '.22em', textTransform: 'uppercase', color: 'rgba(201,169,110,.4)', marginBottom: '.4rem' }}>
                  After you have paid
                </div>
                <div style={{ fontSize: '.7rem', color: 'rgba(232,213,183,.4)', lineHeight: 1.7, marginBottom: '1.1rem' }}>
                  Send us the receipt so we can match it. A screenshot or the transaction reference — either is enough.
                </div>

                <input
                  value={reference}
                  onChange={e => { setReference(e.target.value); setError(null); }}
                  placeholder="Transaction reference / UTR"
                  style={{
                    width: '100%', padding: '.75rem 1rem', boxSizing: 'border-box',
                    background: 'rgba(25,22,15,.9)', border: '1px solid rgba(201,169,110,.18)',
                    color: '#f0e8d8', fontFamily: 'IBM Plex Mono, monospace', fontSize: '.8rem',
                    outline: 'none', marginBottom: '.75rem',
                  }}
                />

                <label style={{
                  display: 'block', border: '1px dashed rgba(201,169,110,.25)', borderRadius: 4,
                  padding: '1rem', textAlign: 'center', cursor: 'pointer', marginBottom: '1rem',
                  fontSize: '.7rem', color: file ? '#f0e8d8' : 'rgba(232,213,183,.35)',
                }}>
                  {/* HEIC/HEIF are named explicitly: iPhones shoot HEIC by
                      default and some in-app browsers do NOT match those files
                      against a bare `image/*`, so the picker would grey out the
                      exact screenshot most clients are trying to send. */}
                  <input
                    type="file"
                    accept={PROOF_ACCEPT}
                    onChange={e => {
                      const f = e.target.files?.[0] ?? null;
                      // Rejected at pick time rather than after an upload that
                      // fails at the storage layer with an opaque message.
                      if (f && f.size > PROOF_MAX_BYTES) {
                        setError(`That file is ${(f.size / 1024 / 1024).toFixed(1)}MB — please keep it under 10MB.`);
                        e.target.value = '';
                        setFile(null);
                        return;
                      }
                      setFile(f);
                      setError(null);
                    }}
                    style={{ display: 'none' }}
                  />
                  {file
                    ? `📎 ${file.name} · ${(file.size / 1024).toFixed(0)}KB`
                    : 'Attach a screenshot or receipt (optional)'}
                  <span style={{ display: 'block', fontSize: '.58rem', color: 'rgba(232,213,183,.25)', marginTop: '.35rem' }}>
                    PNG · JPG · HEIC · WEBP · PDF — up to 10MB
                  </span>
                </label>

                {error && (
                  <div style={{ fontSize: '.68rem', color: '#e07070', background: 'rgba(224,112,112,.06)', border: '1px solid rgba(224,112,112,.15)', padding: '.55rem .8rem', marginBottom: '.9rem' }}>
                    {error}
                  </div>
                )}

                <button
                  onClick={submit}
                  disabled={submitting}
                  style={{
                    width: '100%', padding: '1rem', border: 'none', background: gold, color: ink,
                    fontWeight: 500, fontFamily: 'Montserrat, sans-serif', fontSize: '.7rem',
                    letterSpacing: '.14em', textTransform: 'uppercase',
                    cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1,
                    WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
                  }}
                >
                  {submitting ? 'Submitting…' : "I've paid — submit proof"}
                </button>

                <div style={{ fontSize: '.6rem', color: 'rgba(232,213,183,.25)', textAlign: 'center', marginTop: '.85rem', lineHeight: 1.6 }}>
                  We verify payments manually. Once submitted you cannot edit this — contact us if something needs correcting.
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
