'use client'
import { useEffect, useState } from 'react'
import AdminSidebar from '@/components/AdminSidebar'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Client = {
  id: string; name: string; email: string; phone: string | null
  instagram: string | null; source: string; status: string
  created_at: string; company: string | null; country: string | null
  notes: string | null
}

type ProjectLite = {
  id: string
  client_id: string | null
  service_name: string
  stage: string
  delivery_type: string | null
  deadline: string | null
}

const STATUS_OPTIONS = ['lead','onboarding','active','completed','paused']
const SOURCE_OPTIONS = ['instagram','referral','website','stripe','whatsapp','other']
const STATUS_BADGES: Record<string, {border:string; color:string; background:string}> = {
  lead: {border:'rgba(201,169,110,.25)', color:'#c9a96e', background:'rgba(201,169,110,.08)'},
  onboarding: {border:'rgba(88,101,242,.3)', color:'#5865f2', background:'rgba(88,101,242,.08)'},
  active: {border:'rgba(56,189,248,.35)', color:'#38bdf8', background:'rgba(56,189,248,.08)'},
  completed: {border:'rgba(52,211,153,.3)', color:'#34d399', background:'rgba(52,211,153,.08)'},
  paused: {border:'rgba(249,115,22,.3)', color:'#f97316', background:'rgba(249,115,22,.08)'},
}

function parseNotes(notes: string | null) {
  const serviceMatch = notes?.match(/Service:\s*([^\n]*)/i)
  const sourceMatch = notes?.match(/Source:\s*([^\n]*)/i)
  const messageMatch = notes?.match(/Message:\s*([\s\S]*)/i)
  return {
    service: serviceMatch?.[1]?.trim() || 'Unknown',
    source: sourceMatch?.[1]?.trim() || 'Unknown',
    message: messageMatch?.[1]?.trim() || '',
  }
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [ordersFilter, setOrdersFilter] = useState<'all' | 'with_orders' | 'without_orders'>('all')
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [projectsByClient, setProjectsByClient] = useState<Record<string, ProjectLite[]>>({})
  const [form, setForm] = useState({ name:'', email:'', phone:'', instagram:'', source:'instagram', status:'lead', company:'', country:'' })
  const set = (k:string, v:string) => setForm(f => ({...f, [k]:v}))

  useEffect(() => {
    const load = async () => {
      const [{ data: clientData }, { data: projectData }] = await Promise.all([
        supabase.from('clients').select('*').order('created_at', {ascending:false}),
        supabase.from('projects').select('id,client_id,service_name,stage,delivery_type,deadline').order('created_at', {ascending:false}),
      ])

      const clientsList = (clientData || []) as Client[]
      const projectsList = (projectData || []) as ProjectLite[]
      const map: Record<string, ProjectLite[]> = {}
      for (const project of projectsList) {
        if (!project.client_id) continue
        if (!map[project.client_id]) map[project.client_id] = []
        map[project.client_id].push(project)
      }

      setClients(clientsList)
      setProjectsByClient(map)
      setLoading(false)
    }

    load()
  }, [])

  const visible = clients.filter(c => {
    if (filter !== 'all' && c.status !== filter) return false
    const hasOrders = (projectsByClient[c.id]?.length || 0) > 0
    if (ordersFilter === 'with_orders' && !hasOrders) return false
    if (ordersFilter === 'without_orders' && hasOrders) return false
    return true
  })

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    const {data, error} = await supabase.from('clients').insert({
      name:form.name, email:form.email, phone:form.phone||null,
      instagram:form.instagram||null, source:form.source, status:form.status,
      company:form.company||null, country:form.country||null
    }).select().single()
    if (!error && data) {
      setClients(c => [data, ...c])
      setForm({name:'',email:'',phone:'',instagram:'',source:'instagram',status:'lead',company:'',country:''})
      setAdding(false)
    }
    setSaving(false)
  }

  const inp: React.CSSProperties = {
    background:'var(--dark3)', border:'1px solid var(--border)', color:'var(--cream)',
    fontFamily:'Montserrat,sans-serif', fontSize:'.78rem', padding:'.6rem .85rem',
    outline:'none', width:'100%'
  }
  const lbl: React.CSSProperties = {
    fontSize:'.55rem', letterSpacing:'.12em', textTransform:'uppercase',
    color:'rgba(240,232,216,.4)', marginBottom:'.35rem', display:'block'
  }

  return (
    <div style={{display:'flex', minHeight:'100vh'}}>
      <AdminSidebar />
      <main style={{marginLeft:220, flex:1, padding:'2.5rem', minWidth:0}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:'1.75rem'}}>
          <div>
            <div style={{fontSize:'.55rem', letterSpacing:'.2em', textTransform:'uppercase', color:'var(--gold)', marginBottom:'.4rem'}}>CRM</div>
            <h1 style={{fontFamily:'Cormorant Garamond,serif', fontSize:'1.8rem', fontWeight:300, color:'var(--cream)'}}>Clients</h1>
          </div>
          <button onClick={() => setAdding(a => !a)} style={{background:'var(--gold)', color:'var(--black)', border:'none', padding:'.55rem 1.25rem', fontFamily:'Montserrat,sans-serif', fontSize:'.7rem', fontWeight:500, letterSpacing:'.1em', textTransform:'uppercase', cursor:'pointer'}}>
            {adding ? '✕ Cancel' : '+ Add Client'}
          </button>
        </div>

        {adding && (
          <form onSubmit={handleAdd} style={{background:'var(--dark)', border:'1px solid var(--border2)', padding:'1.5rem', marginBottom:'1.5rem'}}>
            <div style={{fontSize:'.62rem', letterSpacing:'.1em', textTransform:'uppercase', color:'var(--gold)', marginBottom:'1rem'}}>New Client</div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'1rem', marginBottom:'1rem'}}>
              <div><label style={lbl}>Name *</label><input style={inp} required value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Full name" /></div>
              <div><label style={lbl}>Email *</label><input style={inp} required type="email" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="email@..." /></div>
              <div><label style={lbl}>Phone</label><input style={inp} value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="+971..." /></div>
              <div><label style={lbl}>Instagram</label><input style={inp} value={form.instagram} onChange={e=>set('instagram',e.target.value)} placeholder="@handle" /></div>
              <div><label style={lbl}>Company</label><input style={inp} value={form.company} onChange={e=>set('company',e.target.value)} placeholder="Company name" /></div>
              <div><label style={lbl}>Country</label><input style={inp} value={form.country} onChange={e=>set('country',e.target.value)} placeholder="UAE, NG, IN..." /></div>
              <div><label style={lbl}>Source</label>
                <select style={{...inp, cursor:'pointer'}} value={form.source} onChange={e=>set('source',e.target.value)}>
                  {SOURCE_OPTIONS.map(s => <option key={s} value={s} style={{textTransform:'capitalize'}}>{s}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Status</label>
                <select style={{...inp, cursor:'pointer'}} value={form.status} onChange={e=>set('status',e.target.value)}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s} style={{textTransform:'capitalize'}}>{s}</option>)}
                </select>
              </div>
            </div>
            <button type="submit" disabled={saving} style={{background:'var(--gold)', color:'var(--black)', border:'none', padding:'.55rem 1.5rem', fontFamily:'Montserrat,sans-serif', fontSize:'.7rem', fontWeight:500, letterSpacing:'.1em', textTransform:'uppercase', cursor:'pointer', opacity:saving?.6:1}}>
              {saving ? 'Saving...' : 'Add Client'}
            </button>
          </form>
        )}

        {/* Filter */}
        <div style={{display:'flex', gap:'.4rem', marginBottom:'1.25rem', flexWrap:'wrap'}}>
          {(['all', ...STATUS_OPTIONS]).map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding:'.3rem .75rem', border:'1px solid', cursor:'pointer',
              fontSize:'.6rem', fontFamily:'Montserrat,sans-serif', letterSpacing:'.08em',
              textTransform:'capitalize',
              borderColor: filter===s ? 'var(--gold)' : 'var(--border)',
              background: filter===s ? 'var(--gold-dim2)' : 'transparent',
              color: filter===s ? 'var(--gold)' : 'var(--cream-muted)',
            }}>{s === 'all' ? 'All' : s}</button>
          ))}
          {(['all', 'with_orders', 'without_orders'] as const).map(s => (
            <button key={s} onClick={() => setOrdersFilter(s)} style={{
              padding:'.3rem .75rem', border:'1px solid', cursor:'pointer',
              fontSize:'.6rem', fontFamily:'Montserrat,sans-serif', letterSpacing:'.08em',
              textTransform:'uppercase',
              borderColor: ordersFilter===s ? 'var(--gold)' : 'var(--border)',
              background: ordersFilter===s ? 'var(--gold-dim2)' : 'transparent',
              color: ordersFilter===s ? 'var(--gold)' : 'var(--cream-muted)',
            }}>{s.replace('_',' ')}</button>
          ))}
        </div>

        {loading ? (
          <div style={{color:'var(--cream-muted)', padding:'3rem 0', textAlign:'center'}}>Loading...</div>
        ) : visible.length === 0 ? (
          <div style={{color:'var(--cream-muted)', padding:'3rem 0', textAlign:'center', fontSize:'.85rem'}}>No clients yet.</div>
        ) : (
          <div style={{border:'1px solid var(--border)'}}>
            <table style={{width:'100%', borderCollapse:'collapse'}}>
              <thead>
                <tr style={{borderBottom:'1px solid var(--border)', background:'var(--dark)'}}>
                  {['Name','Contact','Service','Source','Status','Orders','Country','Added'].map(h => (
                    <th key={h} style={{padding:'.75rem 1rem', textAlign:'left', fontSize:'.52rem', letterSpacing:'.14em', textTransform:'uppercase', color:'var(--cream-dim)', fontWeight:400}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((c, i) => (
                  <tr key={c.id}
                    style={{borderBottom: i<visible.length-1?'1px solid var(--border)':'none', background:'var(--dark)', cursor:'pointer'}}
                    onMouseEnter={e=>(e.currentTarget.style.background='var(--dark2)')}
                    onMouseLeave={e=>(e.currentTarget.style.background='var(--dark)')}
                  >
                    <td style={{padding:'.8rem 1rem'}}>
                      <div style={{fontSize:'.78rem', fontWeight:500, color:'var(--cream)'}}>{c.name}</div>
                      {c.company && <div style={{fontSize:'.62rem', color:'var(--cream-muted)'}}>{c.company}</div>}
                      {c.instagram && <div style={{fontSize:'.6rem', color:'var(--gold)'}}>{c.instagram}</div>}
                    </td>
                    <td style={{padding:'.8rem 1rem'}}>
                      <div style={{fontSize:'.72rem', color:'var(--cream-muted)', fontFamily:'IBM Plex Mono,monospace'}}>{c.email}</div>
                      {c.phone && <div style={{fontSize:'.65rem', color:'var(--cream-dim)'}}>{c.phone}</div>}
                    </td>
                    <td style={{padding:'.8rem 1rem', fontSize:'.72rem', color:'var(--cream-muted)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
                      {parseNotes(c.notes).service}
                    </td>
                    <td style={{padding:'.8rem 1rem', fontSize:'.7rem', color:'var(--cream-muted)', textTransform:'capitalize'}}>{c.source}</td>
                    <td style={{padding:'.8rem 1rem'}}>
                      {(() => {
                        const badge = STATUS_BADGES[c.status] || STATUS_BADGES.lead
                        return (
                          <span style={{fontSize:'.6rem', padding:'.2rem .6rem', border:'1px solid', textTransform:'capitalize', borderColor: badge.border, color: badge.color, background: badge.background}}>{c.status}</span>
                        )
                      })()}
                    </td>
                    <td style={{padding:'.8rem 1rem'}}>
                      {projectsByClient[c.id]?.length ? (
                        <div>
                          <div style={{fontSize:'.64rem', color:'var(--gold)'}}>{projectsByClient[c.id].length} linked order(s)</div>
                          {projectsByClient[c.id].slice(0, 2).map(project => (
                            <div key={project.id} style={{fontSize:'.62rem', color:'var(--cream-muted)', marginTop:'.2rem'}}>
                              {project.service_name} · {project.stage}{project.delivery_type ? ` · ${project.delivery_type}` : ''}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span style={{fontSize:'.62rem', color:'var(--cream-dim)'}}>No orders yet</span>
                      )}
                    </td>
                    <td style={{padding:'.8rem 1rem', fontSize:'.72rem', color:'var(--cream-muted)'}}>{c.country || '—'}</td>
                    <td style={{padding:'.8rem 1rem', fontFamily:'IBM Plex Mono,monospace', fontSize:'.65rem', color:'var(--cream-dim)'}}>{new Date(c.created_at).toLocaleDateString()}</td>
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
