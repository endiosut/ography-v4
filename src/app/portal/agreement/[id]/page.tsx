'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import NavBar from '@/components/NavBar';

// Agreement review + acceptance.
//
// This is step 3 of the loop: cart -> contact -> AGREEMENT -> deposit -> brief
// -> production -> delivery. It is the screen where price stops being a null
// column: accepting fires agreements_on_accept(), which stamps
// projects.total_amount_usd, opens a `deposit` payment row, and writes an
// AGREEMENT_ACCEPTED project_event.
//
// The client cannot edit anything here. RLS (005) allows UPDATE only on their
// own agreement row, and the only field this page writes is `status`.

type LineItem = {
  catalog_item_id?: string;
  name: string;
  unit_price_usd: number;
  quantity: number;
  turnaround?: string | null;
};

type Agreement = {
  id: string;
  agreement_ref: string | null;
  line_items: LineItem[] | null;
  currency_code: string;
  subtotal_usd: number | null;
  discount_usd: number | null;
  total_usd: number | null;
  deposit_pct: number | null;
  deposit_usd: number | null;
  balance_usd: number | null;
  turnaround_days: number | null;
  revisions_included: number;
  cancellation_window_hours: number;
  balance_due_on: string;
  ip_transfers_on: string;
  client_obligations: string | null;
  notes: string | null;
  terms_version: string;
  status: string;
  accepted_at: string | null;
  expires_at: string | null;
  created_at: string;
};

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('[agreement] Missing Supabase env.', 'URL:', Boolean(url), 'ANON:', Boolean(key));
    throw new Error('Supabase configuration missing');
  }
  return createBrowserClient(url, key);
}

const money = (n: number | null | undefined) =>
  n == null ? '—' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const BALANCE_LABEL: Record<string, string> = {
  delivery: 'on delivery',
  milestone: 'at the agreed milestone',
  net_7: 'within 7 days of delivery',
  net_14: 'within 14 days of delivery',
};

const IP_LABEL: Record<string, string> = {
  final_payment: 'transfers to you once the balance is paid in full',
  acceptance: 'transfers to you on acceptance of this agreement',
  never: 'remains licensed, not transferred',
};

const gold = '#c9a96e';
const cream = '#e8d5b7';
const ink = '#0a0906';
const panel = '#0f0d0a';

export default function AgreementPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [projectRef, setProjectRef] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<{ email: string; name?: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const sb = getSupabase();
      const { data: { user: u } } = await sb.auth.getUser();
      if (!u) { router.replace(`/login?next=/portal/agreement/${id}`); return; }
      setUser({ email: u.email || '', name: u.user_metadata?.full_name });

      const { data, error: err } = await sb
        .from('agreements').select('*').eq('id', id).maybeSingle();

      if (err) { console.error('[agreement] load:', err.message); setError('We could not load this agreement.'); return; }
      if (!data) { setError('This agreement is not available on your account.'); return; }

      setAgreement(data as Agreement);
      if (!signature) setSignature(u.user_metadata?.full_name || '');

      const { data: proj } = await sb
        .from('projects').select('project_ref').eq('agreement_id', id).limit(1).maybeSingle();
      if (proj?.project_ref) setProjectRef(proj.project_ref);
    } catch (e) {
      console.error('[agreement] load threw:', e);
      setError('We could not load this agreement.');
    } finally {
      setLoading(false);
    }
  }, [id, router, signature]);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const accept = async () => {
    if (!agreement) return;
    if (!agreed) { setError('Please confirm you have read and accept the terms.'); return; }
    if (!signature.trim()) { setError('Please type your full name to sign.'); return; }

    setSubmitting(true);
    setError(null);
    try {
      const sb = getSupabase();
      // Only `status` (+ signature metadata) is written. The database trigger
      // does the rest: project totals, deposit payment row, audit event.
      const { error: err } = await sb
        .from('agreements')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
          accepted_name: signature.trim(),
          accepted_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 300) : null,
        })
        .eq('id', agreement.id);

      if (err) {
        console.error('[agreement] accept failed:', err.message, err.code);
        setError('We could not record your acceptance. Nothing was charged — please try again.');
        return;
      }
      await load();
    } catch (e) {
      console.error('[agreement] accept threw:', e);
      setError('We could not record your acceptance. Nothing was charged — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '.6rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(201,169,110,.35)' }}>
          Loading agreement…
        </div>
      </div>
    );
  }

  if (error && !agreement) {
    return (
      <div style={{ minHeight: '100vh', background: ink, fontFamily: 'Montserrat, sans-serif' }}>
        <NavBar user={user ? { email: user.email, full_name: user.name } : undefined} />
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '9rem 2rem', textAlign: 'center' }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.4rem', color: '#f0e8d8', fontWeight: 300, marginBottom: '.75rem' }}>
            Agreement unavailable
          </div>
          <div style={{ fontSize: '.75rem', color: 'rgba(232,213,183,.4)', lineHeight: 1.8, marginBottom: '2rem' }}>{error}</div>
          <Link href="/portal" style={{ color: gold, border: `1px solid rgba(201,169,110,.3)`, padding: '.8rem 2rem', fontSize: '.65rem', letterSpacing: '.14em', textTransform: 'uppercase', textDecoration: 'none' }}>
            ← Back to portal
          </Link>
        </div>
      </div>
    );
  }

  const a = agreement!;
  const items = Array.isArray(a.line_items) ? a.line_items : [];
  const isAccepted = a.status === 'accepted';
  const isDead = a.status === 'expired' || a.status === 'cancelled';

  return (
    <div style={{ minHeight: '100vh', background: ink, fontFamily: 'Montserrat, sans-serif', color: cream }}>
      <NavBar user={user ? { email: user.email, full_name: user.name } : undefined} />

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '7rem 2rem 6rem' }}>

        <Link href="/portal" style={{ fontSize: '.6rem', color: 'rgba(201,169,110,.45)', textDecoration: 'none', letterSpacing: '.1em' }}>
          ← Portal
        </Link>

        <div style={{ marginTop: '1.25rem', marginBottom: '2rem' }}>
          <div style={{ fontSize: '.5rem', letterSpacing: '.3em', textTransform: 'uppercase', color: 'rgba(201,169,110,.4)', marginBottom: '.5rem' }}>
            Service Agreement
          </div>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(1.7rem,4vw,2.5rem)', fontWeight: 300, color: '#f0e8d8', lineHeight: 1.15 }}>
            {isAccepted ? 'Agreement accepted' : 'Review and accept'}
          </h1>
          <div style={{ fontSize: '.6rem', color: 'rgba(232,213,183,.3)', marginTop: '.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {a.agreement_ref && <span style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'rgba(201,169,110,.55)' }}>{a.agreement_ref}</span>}
            {projectRef && <span style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{projectRef}</span>}
            <span>Terms {a.terms_version}</span>
          </div>
        </div>

        {isAccepted && (
          <div style={{ border: '1px solid rgba(74,158,107,.3)', background: 'rgba(74,158,107,.05)', padding: '1.25rem 1.5rem', marginBottom: '2rem', borderRadius: 6 }}>
            <div style={{ fontSize: '.7rem', color: '#4a9e6b', letterSpacing: '.08em', marginBottom: '.35rem' }}>
              Accepted{a.accepted_at ? ` on ${new Date(a.accepted_at).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}
            </div>
            <div style={{ fontSize: '.72rem', color: 'rgba(232,213,183,.5)', lineHeight: 1.7 }}>
              Your deposit of <strong style={{ color: cream }}>{money(a.deposit_usd)}</strong> is now due. Use{' '}
              <strong style={{ color: gold, fontFamily: 'IBM Plex Mono, monospace' }}>{projectRef || a.agreement_ref}</strong>{' '}
              as the payment reference so we can match it immediately.
            </div>
          </div>
        )}

        {isDead && (
          <div style={{ border: '1px solid rgba(224,112,112,.2)', background: 'rgba(224,112,112,.04)', padding: '1rem 1.25rem', marginBottom: '2rem', borderRadius: 6, fontSize: '.72rem', color: 'rgba(232,213,183,.45)' }}>
            This agreement is {a.status}. Contact us if you would like a new one.
          </div>
        )}

        {/* ── LINE ITEMS ── */}
        <div style={{ border: '1px solid rgba(201,169,110,.12)', background: panel, borderRadius: 6, overflow: 'hidden', marginBottom: '1.5rem' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(201,169,110,.08)', fontSize: '.52rem', letterSpacing: '.22em', textTransform: 'uppercase', color: 'rgba(201,169,110,.4)' }}>
            What you are commissioning
          </div>
          {items.length === 0 ? (
            <div style={{ padding: '1.5rem', fontSize: '.75rem', color: 'rgba(232,213,183,.3)' }}>No line items on this agreement.</div>
          ) : items.map((li, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '1rem 1.5rem', borderBottom: '1px solid rgba(201,169,110,.05)' }}>
              <div>
                <div style={{ fontSize: '.8rem', color: '#f0e8d8' }}>{li.name}</div>
                <div style={{ fontSize: '.6rem', color: 'rgba(232,213,183,.3)', marginTop: '.2rem' }}>
                  {money(li.unit_price_usd)} × {li.quantity}
                  {li.turnaround ? ` · ${li.turnaround}` : ''}
                </div>
              </div>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '.78rem', color: cream, whiteSpace: 'nowrap' }}>
                {money((li.unit_price_usd || 0) * (li.quantity || 1))}
              </div>
            </div>
          ))}

          <div style={{ padding: '1.25rem 1.5rem', background: 'rgba(201,169,110,.03)' }}>
            {[
              ['Subtotal', money(a.subtotal_usd)],
              ...(Number(a.discount_usd) > 0 ? [['Discount', `− ${money(a.discount_usd)}`]] : []),
              ['Total', money(a.total_usd)],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.72rem', color: 'rgba(232,213,183,.5)', marginBottom: '.4rem' }}>
                <span>{label}</span>
                <span style={{ fontFamily: 'IBM Plex Mono, monospace', color: label === 'Total' ? cream : undefined }}>{value}</span>
              </div>
            ))}
            <div style={{ height: 1, background: 'rgba(201,169,110,.1)', margin: '.75rem 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.8rem', color: gold }}>
              <span>Due now ({Number(a.deposit_pct ?? 0)}% deposit)</span>
              <span style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{money(a.deposit_usd)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.68rem', color: 'rgba(232,213,183,.35)', marginTop: '.3rem' }}>
              <span>Balance {BALANCE_LABEL[a.balance_due_on] || a.balance_due_on}</span>
              <span style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{money(a.balance_usd)}</span>
            </div>
          </div>
        </div>

        {/* ── COMMITMENTS ── */}
        <div style={{ border: '1px solid rgba(201,169,110,.12)', background: panel, borderRadius: 6, padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '.52rem', letterSpacing: '.22em', textTransform: 'uppercase', color: 'rgba(201,169,110,.4)', marginBottom: '1rem' }}>
            What we both commit to
          </div>
          {[
            ['We deliver', a.turnaround_days ? `within ${a.turnaround_days} working days of receiving your brief and deposit` : 'within the turnaround stated per service'],
            ['Revisions', `${a.revisions_included} round${a.revisions_included === 1 ? '' : 's'} included`],
            ['You may cancel', `within ${a.cancellation_window_hours} hours of accepting, for a full refund of the deposit`],
            ['Balance is due', BALANCE_LABEL[a.balance_due_on] || a.balance_due_on],
            ['Ownership', `Copyright in the final work ${IP_LABEL[a.ip_transfers_on] || a.ip_transfers_on}`],
            ...(a.client_obligations ? [['You provide', a.client_obligations]] : []),
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: '1rem', marginBottom: '.7rem', fontSize: '.72rem', lineHeight: 1.65 }}>
              <div style={{ minWidth: 118, color: 'rgba(232,213,183,.32)' }}>{k}</div>
              <div style={{ color: 'rgba(232,213,183,.72)' }}>{v}</div>
            </div>
          ))}
          {a.notes && (
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(201,169,110,.06)', fontSize: '.7rem', color: 'rgba(232,213,183,.45)', lineHeight: 1.7 }}>
              {a.notes}
            </div>
          )}
        </div>

        {/* ── ACCEPT ── */}
        {!isAccepted && !isDead && (
          <div style={{ border: `1px solid rgba(201,169,110,.2)`, background: panel, borderRadius: 6, padding: '1.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '.6rem', fontSize: '.7rem', lineHeight: 1.6, color: 'rgba(232,213,183,.55)', marginBottom: '1.1rem' }}>
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => { setAgreed(e.target.checked); if (e.target.checked) setError(null); }}
                style={{ marginTop: 3 }}
              />
              <span>
                I have read and accept these terms, the{' '}
                <a href="/terms" style={{ color: gold }}>Terms of Service</a> and the{' '}
                <a href="/privacy" style={{ color: gold }}>Privacy Policy</a>.
              </span>
            </label>

            <div style={{ fontSize: '.55rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(201,169,110,.35)', marginBottom: '.45rem' }}>
              Type your full name to sign
            </div>
            <input
              value={signature}
              onChange={e => setSignature(e.target.value)}
              placeholder="Your full name"
              style={{
                width: '100%', padding: '.8rem 1rem', boxSizing: 'border-box',
                background: 'rgba(25,22,15,.9)', border: '1px solid rgba(201,169,110,.18)',
                color: '#f0e8d8', fontFamily: 'Cormorant Garamond, serif', fontSize: '1rem',
                outline: 'none', marginBottom: '1rem',
              }}
            />

            {error && (
              <div style={{ fontSize: '.68rem', color: '#e07070', background: 'rgba(224,112,112,.06)', border: '1px solid rgba(224,112,112,.15)', padding: '.55rem .8rem', marginBottom: '.9rem' }}>
                {error}
              </div>
            )}

            <button
              onClick={accept}
              disabled={submitting}
              style={{
                width: '100%', padding: '1rem', border: 'none',
                background: gold, color: ink, fontWeight: 500,
                fontFamily: 'Montserrat, sans-serif', fontSize: '.7rem',
                letterSpacing: '.14em', textTransform: 'uppercase',
                cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1,
                WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
              }}
            >
              {submitting ? 'Recording…' : `Accept and proceed — ${money(a.deposit_usd)} due`}
            </button>

            <div style={{ fontSize: '.6rem', color: 'rgba(232,213,183,.25)', textAlign: 'center', marginTop: '.85rem', lineHeight: 1.6 }}>
              Accepting does not charge you. You will receive payment instructions next.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
