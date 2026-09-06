'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import AdminSidebar from '@/components/AdminSidebar'
import { supabase } from '@/lib/supabase'

// Proof review queue — the human half of a P2P settlement rail.
//
// In this model nothing tells you a UPI transfer or a Binance Pay send landed.
// The client submits evidence and someone decides. That decision step existed
// in the schema (payment_proofs.review_status, reviewed_by, review_note) and in
// the client-facing screen, but there was no way to make it: no admin surface
// read payment_proofs at all. Proofs could be submitted and never seen.
//
// A screenshot is a CLAIM, not a payment. Approving here marks real money as
// received, so the flow is deliberate: open the evidence, check it against your
// own account, then approve or reject with a reason the client will read.

type Proof = {
  id: string
  payment_id: string
  payment_method_id: string | null
  file_path: string | null
  reference_text: string | null
  txid: string | null
  paid_amount: number | null
  paid_currency: string | null
  review_status: string
  review_note: string | null
  submitted_at: string
  payments?: {
    id: string; amount_usd: number | null; milestone: string | null; status: string | null
    projects?: { project_ref: string | null; service_name: string | null } | null
    clients?: { name: string | null; email: string | null } | null
  } | null
  payment_methods?: { label: string; method_type: string; network: string | null } | null
}

const money = (n: number | null | undefined) =>
  n == null ? '—' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

export default function ProofsPage() {
  const [proofs, setProofs] = useState<Proof[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'open' | 'all'>('open')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('payment_proofs')
      .select('*, payments(id,amount_usd,milestone,status,projects(project_ref,service_name),clients(name,email)), payment_methods(label,method_type,network)')
      .order('submitted_at', { ascending: false })

    if (filter === 'open') q = q.in('review_status', ['submitted', 'under_review'])

    const { data, error: err } = await q
    if (err) {
      console.error('[admin/proofs] load:', err.message)
      setError(`Could not load proofs: ${err.message}`)
      setLoading(false)
      return
    }
    setError(null)
    setProofs((data || []) as Proof[])
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  // The bucket is private, so a plain public URL renders nothing. Signed URLs
  // are minted on demand and deliberately short-lived — proof images carry bank
  // details and account names.
  const openFile = async (p: Proof) => {
    if (!p.file_path) return
    if (fileUrls[p.id]) { window.open(fileUrls[p.id], '_blank', 'noopener'); return }

    const { data, error: err } = await supabase
      .storage.from('payment-proofs').createSignedUrl(p.file_path, 300)

    if (err || !data?.signedUrl) {
      console.error('[admin/proofs] signed url:', err?.message)
      setError(`Could not open the attachment: ${err?.message || 'no URL returned'}`)
      return
    }
    setFileUrls(u => ({ ...u, [p.id]: data.signedUrl }))
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  const review = async (p: Proof, decision: 'approved' | 'rejected') => {
    const note = (notes[p.id] || '').trim()

    if (decision === 'rejected' && !note) {
      setError('A rejection needs a reason — the client sees this text and has to know what to fix.')
      return
    }
    if (decision === 'approved' && !confirm(
      `Approve ${money(p.payments?.amount_usd)} as RECEIVED for ${p.payments?.projects?.project_ref || 'this project'}?\n\nOnly do this once you have confirmed the money is actually in your account.`
    )) return

    setBusyId(p.id); setError(null); setNotice(null)

    // Server route, not three client-side writes.
    //
    // Approval touches payment_proofs, payments, projects and briefs, then has
    // to send a receipt — and the delivery channels only exist server-side. Done
    // from the browser, any step could half-succeed with no way to notify
    // afterwards. The route establishes admin identity from the session cookie,
    // never from anything this page sends.
    try {
      const res = await fetch('/api/admin/proofs/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proofId: p.id, decision, note }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'The review could not be saved.')
        setBusyId(null)
        return
      }

      if (decision === 'rejected') {
        setNotice('Rejected. The client can correct and resubmit.')
      } else {
        // Report per-channel truthfully rather than claiming "receipt sent".
        const em = data.delivery?.email
        const wa = data.delivery?.whatsapp
        const sent = [em?.delivered && 'email', wa?.delivered && 'WhatsApp'].filter(Boolean)
        const failed = [
          !em?.delivered && `email (${em?.skipped ? 'not configured' : em?.error || 'failed'})`,
          !wa?.delivered && `WhatsApp (${wa?.skipped ? 'not configured' : wa?.error || 'failed'})`,
        ].filter(Boolean)

        setNotice(
          `Approved — payment marked received.` +
          (sent.length ? ` Receipt sent by ${sent.join(' and ')}.` : '') +
          (failed.length ? ` NOT delivered: ${failed.join('; ')}.` : '')
        )
      }

      setNotes(n => ({ ...n, [p.id]: '' }))
      await load()
    } catch (e) {
      console.error('[admin/proofs] review failed:', e)
      setError('Could not reach the review service. Nothing was changed.')
    } finally {
      setBusyId(null)
    }
  }

  const openCount = proofs.filter(p => ['submitted', 'under_review'].includes(p.review_status)).length

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <AdminSidebar />
      <main style={{ marginLeft: 220, flex: 1, padding: '2.5rem', minWidth: 0 }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '.55rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '.4rem' }}>
            Finance · <Link href="/admin/payments" style={{ color: 'var(--cream-muted)' }}>Payments</Link> / Proofs
          </div>
          <h1 style={{ fontFamily: 'Cormorant Garamond,serif', fontSize: '1.8rem', fontWeight: 300, color: 'var(--cream)' }}>
            Payment Proofs
          </h1>
          <p style={{ fontSize: '.75rem', color: 'var(--cream-muted)', marginTop: '.5rem', lineHeight: 1.7, maxWidth: 640 }}>
            Clients submit evidence of a transfer here. Check it against your own account
            before approving — a screenshot is a claim, not a payment.
          </p>
        </div>

        {error && (
          <div style={{ border: '1px solid rgba(239,68,68,.35)', background: 'rgba(239,68,68,.07)', padding: '.85rem 1.1rem', marginBottom: '1rem', fontSize: '.75rem', color: '#ef4444', lineHeight: 1.6 }}>
            {error}
          </div>
        )}
        {notice && (
          <div style={{ border: '1px solid rgba(39,174,96,.3)', background: 'rgba(39,174,96,.07)', padding: '.85rem 1.1rem', marginBottom: '1rem', fontSize: '.75rem', color: '#27ae60' }}>
            {notice}
          </div>
        )}

        <div style={{ display: 'flex', gap: '.4rem', marginBottom: '1.25rem', alignItems: 'center' }}>
          {(['open', 'all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '.3rem .75rem', border: '1px solid', cursor: 'pointer',
              fontSize: '.6rem', fontFamily: 'Montserrat,sans-serif', letterSpacing: '.08em', textTransform: 'capitalize',
              borderColor: filter === f ? 'var(--gold)' : 'var(--border)',
              background: filter === f ? 'var(--gold-dim2)' : 'transparent',
              color: filter === f ? 'var(--gold)' : 'var(--cream-muted)',
            }}>{f === 'open' ? `Awaiting review${openCount ? ` (${openCount})` : ''}` : 'All'}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ color: 'var(--cream-muted)', padding: '3rem', textAlign: 'center' }}>Loading…</div>
        ) : proofs.length === 0 ? (
          <div style={{ color: 'var(--cream-muted)', padding: '3rem', textAlign: 'center', fontSize: '.85rem', border: '1px solid var(--border)' }}>
            {filter === 'open' ? 'Nothing awaiting review.' : 'No proofs submitted yet.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {proofs.map(p => {
              const open = ['submitted', 'under_review'].includes(p.review_status)
              const statusColor = p.review_status === 'approved' ? '#27ae60'
                : p.review_status === 'rejected' ? '#ef4444' : '#f59e0b'
              return (
                <div key={p.id} style={{ border: '1px solid var(--border)', background: 'var(--dark)', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '.9rem' }}>
                    <div>
                      <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: '.7rem', color: 'var(--gold)' }}>
                        {p.payments?.projects?.project_ref || '—'}
                      </div>
                      <div style={{ fontSize: '.85rem', color: 'var(--cream)', marginTop: '.2rem' }}>
                        {p.payments?.clients?.name || 'Unknown client'}
                        <span style={{ color: 'var(--cream-dim)', fontSize: '.7rem' }}>
                          {p.payments?.clients?.email ? ` · ${p.payments.clients.email}` : ''}
                        </span>
                      </div>
                      <div style={{ fontSize: '.7rem', color: 'var(--cream-muted)', marginTop: '.15rem' }}>
                        {p.payments?.projects?.service_name || '—'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: '1.15rem', color: 'var(--cream)' }}>
                        {money(p.payments?.amount_usd)}
                      </div>
                      <div style={{ fontSize: '.6rem', color: 'var(--cream-dim)', textTransform: 'capitalize', marginTop: '.2rem' }}>
                        {p.payments?.milestone || '—'} · {p.payment_methods?.label || 'method unknown'}
                        {p.payment_methods?.network ? ` (${p.payment_methods.network})` : ''}
                      </div>
                      <span style={{
                        display: 'inline-block', marginTop: '.35rem', fontSize: '.58rem', padding: '.15rem .5rem',
                        border: `1px solid ${statusColor}44`, color: statusColor, background: `${statusColor}11`,
                        textTransform: 'capitalize',
                      }}>{p.review_status}</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '.6rem', fontSize: '.7rem', paddingTop: '.8rem', borderTop: '1px solid var(--border)' }}>
                    <Detail label="Submitted" value={new Date(p.submitted_at).toLocaleString()} />
                    <Detail label="Reference / UTR" value={p.reference_text || '—'} mono />
                    <Detail label="Transaction ID" value={p.txid || '—'} mono />
                    <Detail
                      label="Client says they sent"
                      value={p.paid_amount != null ? `${p.paid_amount} ${p.paid_currency || ''}`.trim() : '—'}
                    />
                  </div>

                  <div style={{ marginTop: '.9rem', display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {p.file_path ? (
                      <button onClick={() => openFile(p)} style={btnGhost}>Open attachment ↗</button>
                    ) : (
                      <span style={{ fontSize: '.65rem', color: 'var(--cream-dim)' }}>
                        No screenshot — reference only
                      </span>
                    )}
                  </div>

                  {open && (
                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                      <textarea
                        placeholder="Note to the client — required when rejecting. They read this."
                        value={notes[p.id] || ''}
                        onChange={e => setNotes(n => ({ ...n, [p.id]: e.target.value }))}
                        style={{
                          width: '100%', minHeight: 54, resize: 'vertical', boxSizing: 'border-box',
                          background: 'var(--dark2, #0f0d0a)', color: 'var(--cream)',
                          border: '1px solid var(--border)', padding: '.55rem .7rem',
                          fontSize: '.72rem', fontFamily: 'Montserrat,sans-serif', outline: 'none',
                        }}
                      />
                      <div style={{ display: 'flex', gap: '.6rem', marginTop: '.7rem', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => review(p, 'approved')}
                          disabled={busyId === p.id}
                          style={{ ...btnApprove, opacity: busyId === p.id ? .5 : 1 }}
                        >
                          {busyId === p.id ? 'Working…' : '✓ Approve — money received'}
                        </button>
                        <button
                          onClick={() => review(p, 'rejected')}
                          disabled={busyId === p.id}
                          style={{ ...btnReject, opacity: busyId === p.id ? .5 : 1 }}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}

                  {!open && p.review_note && (
                    <div style={{ marginTop: '.8rem', paddingTop: '.8rem', borderTop: '1px solid var(--border)', fontSize: '.7rem', color: 'var(--cream-muted)' }}>
                      Note to client: {p.review_note}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: '.52rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--cream-dim)', marginBottom: '.2rem' }}>{label}</div>
      <div style={{ color: 'var(--cream-muted)', fontFamily: mono ? 'IBM Plex Mono,monospace' : 'inherit', overflowWrap: 'anywhere' }}>{value}</div>
    </div>
  )
}

const btnGhost: React.CSSProperties = {
  background: 'transparent', color: 'var(--cream-muted)', border: '1px solid var(--border)',
  padding: '.4rem 1rem', fontSize: '.62rem', cursor: 'pointer',
  fontFamily: 'Montserrat,sans-serif', letterSpacing: '.08em',
}

const btnApprove: React.CSSProperties = {
  background: 'rgba(39,174,96,.12)', color: '#27ae60', border: '1px solid rgba(39,174,96,.45)',
  padding: '.5rem 1.2rem', fontSize: '.62rem', cursor: 'pointer',
  fontFamily: 'Montserrat,sans-serif', letterSpacing: '.1em', textTransform: 'uppercase',
}

const btnReject: React.CSSProperties = {
  background: 'transparent', color: '#ef4444', border: '1px solid rgba(239,68,68,.35)',
  padding: '.5rem 1.2rem', fontSize: '.62rem', cursor: 'pointer',
  fontFamily: 'Montserrat,sans-serif', letterSpacing: '.1em', textTransform: 'uppercase',
}
