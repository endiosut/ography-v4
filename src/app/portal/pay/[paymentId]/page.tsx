'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import NavBar from '@/components/NavBar';

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
};

type Proof = {
  id: string; review_status: string; submitted_at: string;
  reference_text: string | null; review_note: string | null;
};

const gold = '#c9a96e', cream = '#e8d5b7', ink = '#0a0906', panel = '#0f0d0a';

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

      const { data: existing } = await sb
        .from('payment_proofs').select('id,review_status,submitted_at,reference_text,review_note')
        .eq('payment_id', paymentId).maybeSingle();
      if (existing) setProof(existing as Proof);

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

  // QR lives in the private catalog-images bucket path recorded on the method.
  useEffect(() => {
    const m = methods.find(x => x.id === chosen);
    if (!m?.qr_code_path) { setQrUrl(null); return; }
    (async () => {
      try {
        const sb = getSupabase();
        const { data } = await sb.storage.from('catalog-images').getPublicUrl(m.qr_code_path!);
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
        ) : proof ? (
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
            {/* ── HOW TO PAY ── */}
            <div style={{ border: '1px solid rgba(201,169,110,.12)', background: panel, borderRadius: 6, padding: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '.52rem', letterSpacing: '.22em', textTransform: 'uppercase', color: 'rgba(201,169,110,.4)', marginBottom: '1rem' }}>
                How to pay
              </div>

              {methods.length === 0 ? (
                <div style={{ fontSize: '.73rem', color: 'rgba(232,213,183,.4)', lineHeight: 1.8 }}>
                  No payment methods are configured yet. Contact us at{' '}
                  <a href="mailto:ographyy@gmail.com" style={{ color: gold }}>ographyy@gmail.com</a> and we will send instructions directly.
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
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                      {qrUrl && (
                        <img
                          src={qrUrl} alt={`${method.label} QR code`}
                          style={{ width: 170, height: 170, objectFit: 'contain', background: '#fff', padding: 10, borderRadius: 6, flexShrink: 0 }}
                        />
                      )}
                      <div style={{ flex: 1, minWidth: 220 }}>
                        {method.account_holder && (
                          <div style={{ fontSize: '.7rem', marginBottom: '.4rem' }}>
                            <span style={{ color: 'rgba(232,213,183,.32)' }}>Account name </span>
                            <span style={{ color: '#f0e8d8' }}>{method.account_holder}</span>
                          </div>
                        )}
                        {method.account_reference && (
                          <div style={{ fontSize: '.7rem', marginBottom: '.4rem' }}>
                            <span style={{ color: 'rgba(232,213,183,.32)' }}>Send to </span>
                            <span style={{ color: '#f0e8d8', fontFamily: 'IBM Plex Mono, monospace' }}>{method.account_reference}</span>
                          </div>
                        )}
                        <div style={{ fontSize: '.7rem', color: 'rgba(232,213,183,.55)', lineHeight: 1.75, whiteSpace: 'pre-wrap', marginTop: '.6rem' }}>
                          {method.instructions}
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
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={e => { setFile(e.target.files?.[0] ?? null); setError(null); }}
                    style={{ display: 'none' }}
                  />
                  {file ? `📎 ${file.name}` : 'Attach a screenshot or receipt (optional)'}
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
