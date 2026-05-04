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

  useEffect(() => {
    supabase.from('payments')
      .select('*, clients(name), projects(project_ref,service_name)')
      .order('created_at', {ascending:false})
      .then(({data}) => { setPayments(data || []); setLoading(false) })
  }, [])

  const visible = filter === 'all' ? payments : payments.filter(p => p.status === filter)

  const totalCollected = payments.filter(p => p.status === 'paid').reduce((s,p) => s + (p.amount_usd||0), 0)
  const pending = payments.filter(p => p.status === 'pending').reduce((s,p) => s + (p.amount_usd||0), 0)
  const thisMonth = payments.filter(p => p.status === 'paid' && p.paid_at && new Date(p.paid_at).getMonth() === new Date().getMonth()).reduce((s,p) => s + (p.amount_usd||0), 0)

  const markPaid = async (id: string) => {
    await supabase.from('payments').update({status:'paid', paid_at:new Date().toISOString()}).eq('id', id)
    setPayments(ps => ps.map(p => p.id === id ? {...p, status:'paid', paid_at:new Date().toISOString()} : p))
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

        {/* Summary */}
        <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'1px', background:'var(--border)', border:'1px solid var(--border)', marginBottom:'1.5rem'}}>
          {[
            {label:'Total Collected', value:`$${totalCollected.toLocaleString()}`, color:'var(--cream)'},
            {label:'Pending', value:`$${pending.toLocaleString()}`, color:'#f59e0b'},
            {label:'This Month', value:`$${thisMonth.toLocaleString()}`, color:'#27ae60'},
          ].map(({label,value,color}) => (
            <div key={label} style={{background:'var(--dark)', padding:'1.25rem'}}>
              <div style={{fontSize:'.55rem', letterSpacing:'.14em', textTransform:'uppercase', color:'var(--cream-dim)', marginBottom:'.4rem'}}>{label}</div>
              <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:'1.6rem', color}}>{value}</div>
            </div>
          ))}
        </div>

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
                        <button onClick={() => markPaid(p.id)} style={{background:'transparent', border:'1px solid rgba(39,174,96,.4)', color:'#27ae60', padding:'.2rem .6rem', fontSize:'.58rem', cursor:'pointer', fontFamily:'Montserrat,sans-serif', letterSpacing:'.08em'}}>
                          Mark Paid
                        </button>
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
