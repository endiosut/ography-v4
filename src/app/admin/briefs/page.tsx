'use client'
import { useEffect, useState } from 'react'
import AdminSidebar from '@/components/AdminSidebar'
import { supabase } from '@/lib/supabase'

type Brief = {
  id: string; project_id: string | null; client_id: string | null
  business_name: string | null; style_direction: string | null
  submitted_at: string | null; status: string; created_at: string
  print_format: string | null; print_quantity: number | null
  additional_message: string | null; industry: string | null
  clients?: { name: string; email: string }
  projects?: { project_ref: string; service_name: string }
}

const STATUS_OPTIONS = ['pending','reviewed','in_progress','approved','changes_requested']
const STATUS_COLORS: Record<string,string> = {
  pending: '#f59e0b', reviewed: '#2980b9', in_progress: '#8e44ad',
  approved: '#27ae60', changes_requested: '#ef4444'
}

export default function BriefsPage() {
  const [briefs, setBriefs] = useState<Brief[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState<Brief | null>(null)

  useEffect(() => {
    supabase.from('briefs')
      .select('*, clients(name,email), projects(project_ref,service_name)')
      .order('created_at', {ascending:false})
      .then(({data}) => { setBriefs(data || []); setLoading(false) })
  }, [])

  const visible = filter === 'all' ? briefs : briefs.filter(b => b.status === filter)

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('briefs').update({status}).eq('id', id)
    setBriefs(bs => bs.map(b => b.id === id ? {...b, status} : b))
    if (selected?.id === id) setSelected(s => s ? {...s, status} : s)
  }

  return (
    <div style={{display:'flex', minHeight:'100vh'}}>
      <AdminSidebar />
      <main style={{marginLeft:220, flex:1, padding:'2.5rem', minWidth:0}}>
        <div style={{marginBottom:'1.75rem'}}>
          <div style={{fontSize:'.55rem', letterSpacing:'.2em', textTransform:'uppercase', color:'var(--gold)', marginBottom:'.4rem'}}>Studio</div>
          <h1 style={{fontFamily:'Cormorant Garamond,serif', fontSize:'1.8rem', fontWeight:300, color:'var(--cream)'}}>Briefs</h1>
        </div>

        <div style={{display:'flex', gap:'.4rem', marginBottom:'1.25rem', flexWrap:'wrap'}}>
          {(['all', ...STATUS_OPTIONS]).map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding:'.3rem .75rem', border:'1px solid', cursor:'pointer',
              fontSize:'.6rem', fontFamily:'Montserrat,sans-serif', letterSpacing:'.08em', textTransform:'capitalize',
              borderColor: filter===s ? 'var(--gold)' : 'var(--border)',
              background: filter===s ? 'var(--gold-dim2)' : 'transparent',
              color: filter===s ? 'var(--gold)' : 'var(--cream-muted)',
            }}>{s === 'all' ? 'All' : s.replace('_',' ')}</button>
          ))}
        </div>

        <div style={{display:'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap:'1.5rem'}}>
          {/* Table */}
          <div style={{border:'1px solid var(--border)'}}>
            {loading ? (
              <div style={{color:'var(--cream-muted)', padding:'3rem', textAlign:'center'}}>Loading...</div>
            ) : visible.length === 0 ? (
              <div style={{color:'var(--cream-muted)', padding:'3rem', textAlign:'center', fontSize:'.85rem'}}>No briefs yet.</div>
            ) : (
              <table style={{width:'100%', borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{borderBottom:'1px solid var(--border)', background:'var(--dark)'}}>
                    {['Client','Project','Business','Industry','Submitted','Status'].map(h => (
                      <th key={h} style={{padding:'.75rem 1rem', textAlign:'left', fontSize:'.52rem', letterSpacing:'.14em', textTransform:'uppercase', color:'var(--cream-dim)', fontWeight:400}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((b, i) => (
                    <tr key={b.id}
                      onClick={() => setSelected(selected?.id === b.id ? null : b)}
                      style={{borderBottom:i<visible.length-1?'1px solid var(--border)':'none', background:selected?.id===b.id?'var(--dark2)':'var(--dark)', cursor:'pointer'}}
                      onMouseEnter={e=>(e.currentTarget.style.background='var(--dark2)')}
                      onMouseLeave={e=>(e.currentTarget.style.background=selected?.id===b.id?'var(--dark2)':'var(--dark)')}
                    >
                      <td style={{padding:'.8rem 1rem'}}>
                        <div style={{fontSize:'.78rem', color:'var(--cream)', fontWeight:500}}>{b.clients?.name || '—'}</div>
                        <div style={{fontSize:'.6rem', color:'var(--cream-muted)'}}>{b.clients?.email}</div>
                      </td>
                      <td style={{padding:'.8rem 1rem', fontFamily:'IBM Plex Mono,monospace', fontSize:'.65rem', color:'var(--gold)'}}>{b.projects?.project_ref || '—'}</td>
                      <td style={{padding:'.8rem 1rem', fontSize:'.75rem', color:'var(--cream-muted)'}}>{b.business_name || '—'}</td>
                      <td style={{padding:'.8rem 1rem', fontSize:'.7rem', color:'var(--cream-muted)', textTransform:'capitalize'}}>{b.industry || '—'}</td>
                      <td style={{padding:'.8rem 1rem', fontFamily:'IBM Plex Mono,monospace', fontSize:'.65rem', color:'var(--cream-dim)'}}>{b.submitted_at ? new Date(b.submitted_at).toLocaleDateString() : 'Pending'}</td>
                      <td style={{padding:'.8rem 1rem'}}>
                        <span style={{fontSize:'.6rem', padding:'.2rem .55rem', border:'1px solid', textTransform:'capitalize', borderColor:`${STATUS_COLORS[b.status]}44`, color:STATUS_COLORS[b.status] || 'var(--cream-muted)', background:`${STATUS_COLORS[b.status]}11`}}>
                          {b.status.replace('_',' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Detail panel */}
          {selected && (
            <div style={{background:'var(--dark)', border:'1px solid var(--border)', padding:'1.5rem', position:'sticky', top:'2.5rem', height:'fit-content', maxHeight:'80vh', overflowY:'auto'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem'}}>
                <div style={{fontSize:'.6rem', letterSpacing:'.12em', textTransform:'uppercase', color:'var(--gold)'}}>Brief Detail</div>
                <button onClick={() => setSelected(null)} style={{background:'transparent', border:'none', color:'var(--cream-dim)', cursor:'pointer', fontSize:'1rem'}}>✕</button>
              </div>
              {[
                ['Client', selected.clients?.name],
                ['Business', selected.business_name],
                ['Industry', selected.industry],
                ['Style Direction', selected.style_direction],
                ['Print Format', selected.print_format],
                ['Print Qty', selected.print_quantity?.toString()],
                ['Message', selected.additional_message],
              ].filter(([,v]) => v).map(([label, value]) => (
                <div key={label as string} style={{marginBottom:'.85rem'}}>
                  <div style={{fontSize:'.52rem', letterSpacing:'.12em', textTransform:'uppercase', color:'rgba(240,232,216,.35)', marginBottom:'.2rem'}}>{label}</div>
                  <div style={{fontSize:'.78rem', color:'var(--cream)', lineHeight:1.6}}>{value}</div>
                </div>
              ))}
              <div style={{marginTop:'1.25rem', paddingTop:'1rem', borderTop:'1px solid var(--border)'}}>
                <div style={{fontSize:'.52rem', letterSpacing:'.12em', textTransform:'uppercase', color:'rgba(240,232,216,.35)', marginBottom:'.5rem'}}>Update Status</div>
                <div style={{display:'flex', flexWrap:'wrap', gap:'.35rem'}}>
                  {STATUS_OPTIONS.map(s => (
                    <button key={s} onClick={() => updateStatus(selected.id, s)} style={{
                      padding:'.25rem .6rem', border:'1px solid', cursor:'pointer',
                      fontSize:'.58rem', fontFamily:'Montserrat,sans-serif', textTransform:'capitalize',
                      borderColor: selected.status===s ? STATUS_COLORS[s] : 'var(--border)',
                      color: selected.status===s ? STATUS_COLORS[s] : 'var(--cream-muted)',
                      background: selected.status===s ? `${STATUS_COLORS[s]}15` : 'transparent',
                    }}>{s.replace('_',' ')}</button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
