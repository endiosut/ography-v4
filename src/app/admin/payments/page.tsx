'use client'
import { useEffect, useState } from 'react'
import AdminSidebar from '@/components/AdminSidebar'
import { supabase } from '@/lib/supabase'

type Payment = {
  id: string; project_id: string | null; amount_usd: number | null
  milestone: string; status: string; paid_at: string | null
  stripe_session_id: string | null; receipt_url: string | null; created_at: string
  clients?: { name: string }
  projects?: { project_ref: string; service_name: string }
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  type AgreementRow = {
    id: string; status: string
    total_usd: number | null; balance_usd: number | null
    project_ids: string[]
  }
  const [agreements, setAgreements] = useState<AgreementRow[]>([])

  const issueLink = async (id: string) => {
    setBusyId(id); setError(null); setNotice(null)
    try {
      const res = await fetch('/api/admin/payments/issue-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: id, notify: true }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not issue a link.'); return }

      const mins = data.windowMinutes
      const until = new Date(data.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      setNotice(
        `Window open for ${mins} min (until ${until}). ` +
        (data.notificationQueued
          ? 'The client has been notified.'
          : 'No email or phone on file — send them this link yourself: ') +
        (data.notificationQueued ? '' : data.payUrl)
      )
    } catch (e) {
      console.error('[admin/payments] issueLink:', e)
      setError('Could not reach the server.')
    } finally {
      setBusyId(null)
    }
  }

  useEffect(() => {
    (async () => {
      const [payRes, agRes] = await Promise.all([
        supabase.from('payments')
          .select('*, clients(name), projects(project_ref,service_name)')
          .order('created_at', { ascending: false }),
        // Agreements carry the CONTRACTED totals. Without them the page can
        // only see money that has already been turned into an invoice, which
        // is precisely the half of the picture that was missing.
        supabase.from('agreements').select('id,status,total_usd,balance_usd'),
      ])

      if (payRes.error) console.error('[admin/payments] payments:', payRes.error.message)
      if (agRes.error) console.error('[admin/payments] agreements:', agRes.error.message)

      const pays = payRes.data || []
      setPayments(pays)

      // Map each agreement to the projects it priced, so a balance row can be
      // matched back to its agreement.
      const { data: projs } = await supabase.from('projects').select('id,agreement_id')
      const byAgreement = new Map<string, string[]>()
      ;(projs || []).forEach(p => {
        if (!p.agreement_id) return
        byAgreement.set(p.agreement_id, [...(byAgreement.get(p.agreement_id) || []), p.id])
      })

      setAgreements((agRes.data || []).map(a => ({
        id: a.id, status: a.status,
        total_usd: a.total_usd, balance_usd: a.balance_usd,
        project_ids: byAgreement.get(a.id) || [],
      })))

      setLoading(false)
    })()
  }, [])

  const visible = filter === 'all' ? payments : payments.filter(p => p.status === filter)

  // ── THE MONEY, SPLIT BY HOW REAL IT IS ────────────────────────────────────
  //
  // The old summary showed "Total Collected / Pending / This Month", which
  // invites exactly the drift the owner was worried about: reading contracted
  // money as money you have. These four buckets are deliberately ordered from
  // certain to speculative, and they never add up to a single headline number,
  // because adding them would recreate the problem.
  const collected = payments
    .filter(p => p.status === 'paid')
    .reduce((s, p) => s + (p.amount_usd || 0), 0)

  const thisMonth = payments
    .filter(p => p.status === 'paid' && p.paid_at &&
      new Date(p.paid_at).getMonth() === new Date().getMonth() &&
      new Date(p.paid_at).getFullYear() === new Date().getFullYear())
    .reduce((s, p) => s + (p.amount_usd || 0), 0)

  // ASKED FOR: an invoice exists and carries an amount. This is the only
  // "owed to you" figure that is actually chaseable today.
  const invoiced = payments
    .filter(p => p.status === 'pending' && p.amount_usd != null)
    .reduce((s, p) => s + (p.amount_usd || 0), 0)

  // CONTRACTED, NOT YET INVOICED: the second instalment on accepted agreements
  // where the work has not been delivered, so no balance payment exists yet.
  // Real, but not collectable until you deliver.
  const contractedNotInvoiced = agreements
    .filter(a => a.status === 'accepted')
    .reduce((s, a) => {
      const hasBalanceRow = payments.some(
        p => p.project_id && a.project_ids.includes(p.project_id) && p.milestone === 'balance')
      return hasBalanceRow ? s : s + Number(a.balance_usd || 0)
    }, 0)

  // QUOTED ONLY: sent, never accepted. May never become anything.
  const quotedUnaccepted = agreements
    .filter(a => a.status === 'sent')
    .reduce((s, a) => s + Number(a.total_usd || 0), 0)

  // Rows that can never be collected as they stand — no amount to ask for.
  const unusable = payments.filter(p => p.status === 'pending' && p.amount_usd == null).length

  // Rewritten 06 Sep 2026. Was:
  //
  //   await supabase.from('payments').update({status:'paid', ...}).eq('id', id)
  //   setPayments(ps => ps.map(...))     // optimistic; error never read
  //
  // `payments` has RLS enabled with a SELECT policy and NO update policy for
  // any role, so that UPDATE was refused every time. The return value was
  // discarded and the row was repainted green regardless — the page reported a
  // collection that had not happened, and the number reverted on next load.
  //
  // Now the error is read, the write is confirmed by re-reading the row, and
  // the UI only changes if the DATABASE changed.
  const markPaid = async (id: string) => {
    setError(null); setNotice(null)

    const { error: err } = await supabase
      .from('payments')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', id)

    if (err) {
      console.error('[admin/payments] markPaid:', err.message, err.code)
      setError(
        err.code === '42501'
          ? 'The database refused this update. `payments` has no admin write policy yet — apply section 1 of supabase/migrations/008_payment_rails.sql.'
          : `Could not mark paid: ${err.message}`
      )
      return
    }

    // Re-query the row itself. A silent no-op returns no error either.
    const { data: row } = await supabase
      .from('payments').select('id,status,paid_at').eq('id', id).maybeSingle()

    if (row?.status !== 'paid') {
      setError('The update reported success but the row is still not paid. Nothing was changed.')
      return
    }

    setPayments(ps => ps.map(p => p.id === id ? { ...p, status: 'paid', paid_at: row.paid_at } : p))
    setNotice('Payment marked paid.')
  }

  const STATUS_COLORS: Record<string,string> = {
    paid: '#27ae60', pending: '#f59e0b', failed: '#ef4444', refunded: '#6b7280'
  }

  return (
    <div style={{display:'flex', minHeight:'100vh'}}>
      <AdminSidebar />
      <main style={{marginLeft:220, flex:1, padding:'2.5rem', minWidth:0}}>
        <div style={{marginBottom:'1.75rem'}}>
          <div style={{fontSize:'.55rem', letterSpacing:'.2em', textTransform:'uppercase', color:'var(--gold)', marginBottom:'.4rem'}}>Finance</div>
          <h1 style={{fontFamily:'Cormorant Garamond,serif', fontSize:'1.8rem', fontWeight:300, color:'var(--cream)'}}>Payments</h1>
        </div>

        {error && (
          <div style={{border:'1px solid rgba(239,68,68,.35)', background:'rgba(239,68,68,.07)', padding:'.85rem 1.1rem', marginBottom:'1rem', fontSize:'.75rem', color:'#ef4444', lineHeight:1.6}}>
            {error}
          </div>
        )}
        {notice && (
          <div style={{border:'1px solid rgba(39,174,96,.3)', background:'rgba(39,174,96,.07)', padding:'.85rem 1.1rem', marginBottom:'1rem', fontSize:'.75rem', color:'#27ae60'}}>
            {notice}
          </div>
        )}

        {/* Summary — four buckets, ordered from certain to speculative.
            They are deliberately NOT summed into one headline: adding money you
            hold to money you merely hope for is the whole failure mode. */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))', gap:'1px', background:'var(--border)', border:'1px solid var(--border)', marginBottom:'.75rem'}}>
          {[
            {label:'In hand · collected',      value:`$${collected.toLocaleString()}`,             color:'#27ae60',
             note:`$${thisMonth.toLocaleString()} of it this month`},
            {label:'Invoiced · chase this',    value:`$${invoiced.toLocaleString()}`,              color:'#f59e0b',
             note:'asked for, not yet received'},
            {label:'Contracted · not invoiced',value:`$${contractedNotInvoiced.toLocaleString()}`, color:'var(--cream-muted)',
             note:'second instalments — deliver the work to bill it'},
            {label:'Quoted · unaccepted',      value:`$${quotedUnaccepted.toLocaleString()}`,      color:'var(--cream-dim)',
             note:'may never happen — do not count it'},
          ].map(({label,value,color,note}) => (
            <div key={label} style={{background:'var(--dark)', padding:'1.25rem'}}>
              <div style={{fontSize:'.55rem', letterSpacing:'.14em', textTransform:'uppercase', color:'var(--cream-dim)', marginBottom:'.4rem'}}>{label}</div>
              <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:'1.6rem', color}}>{value}</div>
              <div style={{fontSize:'.5rem', color:'var(--cream-dim)', marginTop:'.45rem', lineHeight:1.5}}>{note}</div>
            </div>
          ))}
        </div>

        {unusable > 0 && (
          <div style={{fontSize:'.62rem', color:'var(--cream-dim)', marginBottom:'1.25rem', lineHeight:1.6}}>
            {unusable} pending payment{unusable > 1 ? 's carry' : ' carries'} no amount, so
            {unusable > 1 ? ' they are' : ' it is'} counted in none of the figures above —
            there is nothing to ask for until an amount is set.
          </div>
        )}

        {/* Filter */}
        <div style={{display:'flex', gap:'.4rem', marginBottom:'1.25rem'}}>
          {['all','paid','pending','failed','refunded'].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding:'.3rem .75rem', border:'1px solid', cursor:'pointer',
              fontSize:'.6rem', fontFamily:'Montserrat,sans-serif', letterSpacing:'.08em', textTransform:'capitalize',
              borderColor: filter===s ? 'var(--gold)' : 'var(--border)',
              background: filter===s ? 'var(--gold-dim2)' : 'transparent',
              color: filter===s ? 'var(--gold)' : 'var(--cream-muted)',
            }}>{s === 'all' ? 'All' : s}</button>
          ))}
        </div>

        {loading ? (
          <div style={{color:'var(--cream-muted)', padding:'3rem', textAlign:'center'}}>Loading...</div>
        ) : visible.length === 0 ? (
          <div style={{color:'var(--cream-muted)', padding:'3rem', textAlign:'center', fontSize:'.85rem'}}>No payments yet.</div>
        ) : (
          <div style={{border:'1px solid var(--border)'}}>
            <table style={{width:'100%', borderCollapse:'collapse'}}>
              <thead>
                <tr style={{borderBottom:'1px solid var(--border)', background:'var(--dark)'}}>
                  {['Project','Client','Service','Amount','Milestone','Status','Paid','Action'].map(h => (
                    <th key={h} style={{padding:'.75rem 1rem', textAlign:'left', fontSize:'.52rem', letterSpacing:'.14em', textTransform:'uppercase', color:'var(--cream-dim)', fontWeight:400}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((p, i) => (
                  <tr key={p.id} style={{borderBottom:i<visible.length-1?'1px solid var(--border)':'none', background:'var(--dark)'}}
                    onMouseEnter={e=>(e.currentTarget.style.background='var(--dark2)')}
                    onMouseLeave={e=>(e.currentTarget.style.background='var(--dark)')}
                  >
                    <td style={{padding:'.8rem 1rem', fontFamily:'IBM Plex Mono,monospace', fontSize:'.65rem', color:'var(--gold)'}}>{p.projects?.project_ref || '—'}</td>
                    <td style={{padding:'.8rem 1rem', fontSize:'.78rem', color:'var(--cream)'}}>{p.clients?.name || '—'}</td>
                    <td style={{padding:'.8rem 1rem', fontSize:'.72rem', color:'var(--cream-muted)'}}>{p.projects?.service_name || '—'}</td>
                    <td style={{padding:'.8rem 1rem', fontFamily:'IBM Plex Mono,monospace', fontSize:'.78rem', color:'var(--cream)'}}>{p.amount_usd ? `$${p.amount_usd.toLocaleString()}` : '—'}</td>
                    <td style={{padding:'.8rem 1rem', fontSize:'.7rem', color:'var(--cream-muted)', textTransform:'capitalize'}}>{p.milestone}</td>
                    <td style={{padding:'.8rem 1rem'}}>
                      <span style={{fontSize:'.6rem', padding:'.2rem .55rem', border:'1px solid', textTransform:'capitalize',
                        borderColor:`${STATUS_COLORS[p.status]||'#6b7280'}44`, color:STATUS_COLORS[p.status]||'var(--cream-muted)',
                        background:`${STATUS_COLORS[p.status]||'#6b7280'}11`}}>
                        {p.status}
                      </span>
                    </td>
                    <td style={{padding:'.8rem 1rem', fontFamily:'IBM Plex Mono,monospace', fontSize:'.65rem', color:'var(--cream-dim)'}}>{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : '—'}</td>
                    <td style={{padding:'.8rem 1rem'}}>
                      {p.status === 'pending' && (
                        <div style={{display:'flex', gap:'.35rem', flexWrap:'wrap'}}>
                          <button onClick={() => markPaid(p.id)} style={{background:'transparent', border:'1px solid rgba(39,174,96,.4)', color:'#27ae60', padding:'.2rem .6rem', fontSize:'.58rem', cursor:'pointer', fontFamily:'Montserrat,sans-serif', letterSpacing:'.08em'}}>
                            Mark Paid
                          </button>
                          {/* A window could previously only be opened at the
                              moment an agreement was accepted. Balances, hand-made
                              payments and clients who used up their two renewals
                              had no route to one at all. */}
                          <button
                            onClick={() => issueLink(p.id)}
                            disabled={busyId === p.id || p.amount_usd == null}
                            title={p.amount_usd == null ? 'Set an amount first — a window on an amount-less payment counts down to nothing' : 'Open a fresh payment window and notify the client'}
                            style={{background:'transparent', border:'1px solid rgba(201,169,110,.4)', color:'var(--gold)', padding:'.2rem .6rem', fontSize:'.58rem', cursor: p.amount_usd == null ? 'not-allowed' : 'pointer', fontFamily:'Montserrat,sans-serif', letterSpacing:'.08em', opacity: p.amount_usd == null ? .4 : 1}}
                          >
                            {busyId === p.id ? '…' : 'Issue Link'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
