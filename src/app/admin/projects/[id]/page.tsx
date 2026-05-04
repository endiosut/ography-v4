'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AdminSidebar from '@/components/AdminSidebar'
import { supabase } from '@/lib/supabase'

const STAGES = ['payment_received','brief_submitted','in_production','review','revision','delivering','completed']
const STAGE_LABEL: Record<string,string> = {
  payment_received:'Payment Received', brief_submitted:'Brief In',
  in_production:'In Production', review:'In Review',
  revision:'Revision', delivering:'Delivering', completed:'Completed'
}

export default function ProjectDetail() {
  const { id } = useParams<{id:string}>()
  const router = useRouter()
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    supabase.from('projects')
      .select('*, clients(*), briefs(*), payments(*), deliverables(*)')
      .eq('id', id).single()
      .then(({data}) => {
        setProject(data)
        setNotes(data?.notes || '')
        setLoading(false)
      })
  }, [id])

  const advanceStage = async () => {
    if (!project) return
    const idx = STAGES.indexOf(project.stage)
    if (idx >= STAGES.length - 1) return
    const next = STAGES[idx + 1]
    await supabase.from('projects').update({stage:next}).eq('id', id)
    setProject((p:any) => ({...p, stage:next}))
  }

  const saveNotes = async () => {
    setSaving(true)
    await supabase.from('projects').update({notes}).eq('id', id)
    setSaving(false)
  }

  if (loading) return (
    <div style={{display:'flex', minHeight:'100vh'}}>
      <AdminSidebar />
      <main style={{marginLeft:220, flex:1, padding:'2.5rem', color:'var(--cream-muted)'}}>Loading...</main>
    </div>
  )

  if (!project) return (
    <div style={{display:'flex', minHeight:'100vh'}}>
      <AdminSidebar />
      <main style={{marginLeft:220, flex:1, padding:'2.5rem', color:'var(--cream-muted)'}}>Project not found.</main>
    </div>
  )

  const stageIdx = STAGES.indexOf(project.stage)

  return (
    <div style={{display:'flex', minHeight:'100vh'}}>
      <AdminSidebar />
      <main style={{marginLeft:220, flex:1, padding:'2.5rem', minWidth:0}}>
        {/* Header */}
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'2rem'}}>
          <div>
            <button onClick={() => router.back()} style={{background:'transparent', border:'none', color:'var(--cream-dim)', cursor:'pointer', fontSize:'.7rem', marginBottom:'.5rem', fontFamily:'Montserrat,sans-serif', padding:0}}>← Back</button>
            <div style={{fontFamily:'IBM Plex Mono,monospace', fontSize:'.8rem', color:'var(--gold)', marginBottom:'.3rem'}}>{project.project_ref}</div>
            <h1 style={{fontFamily:'Cormorant Garamond,serif', fontSize:'1.6rem', fontWeight:300, color:'var(--cream)'}}>{project.service_name}</h1>
          </div>
          {project.stage !== 'completed' && (
            <button onClick={advanceStage} style={{background:'var(--gold)', color:'var(--black)', border:'none', padding:'.65rem 1.5rem', fontFamily:'Montserrat,sans-serif', fontSize:'.7rem', fontWeight:500, letterSpacing:'.1em', textTransform:'uppercase', cursor:'pointer'}}>
              Advance → {STAGE_LABEL[STAGES[stageIdx+1]] || 'Complete'}
            </button>
          )}
        </div>

        {/* Stage bar */}
        <div style={{display:'flex', gap:'2px', marginBottom:'2rem'}}>
          {STAGES.map((s, i) => (
            <div key={s} style={{
              flex:1, padding:'.5rem .25rem', textAlign:'center',
              background: i <= stageIdx ? 'var(--gold)' : 'var(--dark)',
              border: '1px solid', borderColor: i <= stageIdx ? 'var(--gold)' : 'var(--border)',
            }}>
              <div style={{fontSize:'.5rem', letterSpacing:'.1em', textTransform:'uppercase', color: i <= stageIdx ? 'var(--black)' : 'var(--cream-dim)', fontWeight: i === stageIdx ? 600 : 400}}>
                {STAGE_LABEL[s]}
              </div>
            </div>
          ))}
        </div>

        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem'}}>
          {/* Client info */}
          <div style={{background:'var(--dark)', border:'1px solid var(--border)', padding:'1.5rem'}}>
            <div style={{fontSize:'.6rem', letterSpacing:'.12em', textTransform:'uppercase', color:'var(--gold)', marginBottom:'1rem'}}>Client</div>
            {project.clients ? (
              <>
                <div style={{fontSize:'.9rem', fontWeight:500, color:'var(--cream)', marginBottom:'.5rem'}}>{project.clients.name}</div>
                <div style={{fontSize:'.75rem', color:'var(--cream-muted)', fontFamily:'IBM Plex Mono,monospace'}}>{project.clients.email}</div>
                {project.clients.phone && <div style={{fontSize:'.72rem', color:'var(--cream-dim)', marginTop:'.25rem'}}>{project.clients.phone}</div>}
                {project.clients.instagram && <div style={{fontSize:'.72rem', color:'var(--gold)', marginTop:'.25rem'}}>{project.clients.instagram}</div>}
              </>
            ) : <div style={{color:'var(--cream-dim)', fontSize:'.78rem'}}>No client linked</div>}
          </div>

          {/* Project info */}
          <div style={{background:'var(--dark)', border:'1px solid var(--border)', padding:'1.5rem'}}>
            <div style={{fontSize:'.6rem', letterSpacing:'.12em', textTransform:'uppercase', color:'var(--gold)', marginBottom:'1rem'}}>Project</div>
            {[
              ['Value', project.total_amount_usd ? `$${project.total_amount_usd.toLocaleString()}` : null],
              ['Deposit', project.deposit_paid_usd ? `$${project.deposit_paid_usd.toLocaleString()}` : null],
              ['Balance Due', project.balance_due_usd ? `$${project.balance_due_usd.toLocaleString()}` : null],
              ['Deadline', project.deadline ? new Date(project.deadline).toLocaleDateString() : null],
              ['Delivery', project.delivery_type],
            ].filter(([,v]) => v).map(([label,value]) => (
              <div key={label as string} style={{display:'flex', justifyContent:'space-between', marginBottom:'.5rem'}}>
                <span style={{fontSize:'.65rem', color:'var(--cream-dim)'}}>{label}</span>
                <span style={{fontSize:'.72rem', color:'var(--cream)', fontFamily:'IBM Plex Mono,monospace'}}>{value}</span>
              </div>
            ))}
          </div>

          {/* Brief summary */}
          {project.briefs?.[0] && (
            <div style={{background:'var(--dark)', border:'1px solid var(--border)', padding:'1.5rem'}}>
              <div style={{fontSize:'.6rem', letterSpacing:'.12em', textTransform:'uppercase', color:'var(--gold)', marginBottom:'1rem'}}>Brief</div>
              {[
                ['Business', project.briefs[0].business_name],
                ['Style', project.briefs[0].style_direction],
                ['Industry', project.briefs[0].industry],
                ['Message', project.briefs[0].additional_message],
              ].filter(([,v]) => v).map(([label,value]) => (
                <div key={label as string} style={{marginBottom:'.75rem'}}>
                  <div style={{fontSize:'.52rem', letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(240,232,216,.35)', marginBottom:'.2rem'}}>{label}</div>
                  <div style={{fontSize:'.78rem', color:'var(--cream)', lineHeight:1.5}}>{value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Notes */}
          <div style={{background:'var(--dark)', border:'1px solid var(--border)', padding:'1.5rem'}}>
            <div style={{fontSize:'.6rem', letterSpacing:'.12em', textTransform:'uppercase', color:'var(--gold)', marginBottom:'1rem'}}>Notes</div>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              style={{background:'var(--dark2)', border:'1px solid var(--border)', color:'var(--cream)', fontFamily:'Montserrat,sans-serif', fontSize:'.78rem', padding:'.75rem', width:'100%', minHeight:120, outline:'none', resize:'vertical'}}
              placeholder="Internal notes, production details, client preferences..."
            />
            <button onClick={saveNotes} disabled={saving} style={{background:'transparent', border:'1px solid var(--border)', color:'var(--cream-muted)', padding:'.4rem 1rem', fontFamily:'Montserrat,sans-serif', fontSize:'.65rem', cursor:'pointer', marginTop:'.5rem', letterSpacing:'.08em'}}>
              {saving ? 'Saving...' : 'Save Notes'}
            </button>
          </div>

          {/* Payments */}
          {project.payments?.length > 0 && (
            <div style={{background:'var(--dark)', border:'1px solid var(--border)', padding:'1.5rem', gridColumn:'1/-1'}}>
              <div style={{fontSize:'.6rem', letterSpacing:'.12em', textTransform:'uppercase', color:'var(--gold)', marginBottom:'1rem'}}>Payments</div>
              {project.payments.map((p:any) => (
                <div key={p.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'.6rem 0', borderBottom:'1px solid var(--border)'}}>
                  <span style={{fontSize:'.72rem', color:'var(--cream-muted)', textTransform:'capitalize'}}>{p.milestone}</span>
                  <span style={{fontFamily:'IBM Plex Mono,monospace', fontSize:'.78rem', color:'var(--cream)'}}>{p.amount_usd ? `$${p.amount_usd.toLocaleString()}` : '—'}</span>
                  <span style={{fontSize:'.65rem', color: p.status==='paid' ? '#27ae60' : '#f59e0b', textTransform:'capitalize'}}>{p.status}</span>
                  <span style={{fontSize:'.65rem', color:'var(--cream-dim)', fontFamily:'IBM Plex Mono,monospace'}}>{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
