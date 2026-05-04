const fs = require('fs');
const base = 'C:/Users/Endi Osut/ography-v4';

// src/app/portal/page.tsx
fs.mkdirSync(base + '/src/app/portal', {recursive:true});
fs.writeFileSync(base + '/src/app/portal/page.tsx', `'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Project = {
  id: string; project_ref: string; service_name: string; stage: string
  total_amount_usd: number | null; created_at: string; deadline: string | null
  briefs: { id: string; status: string; submitted_at: string | null }[]
  payments: { amount_usd: number; status: string; milestone: string }[]
}

type Client = {
  id: string; name: string; email: string
}

const STAGES = ['payment_received','brief_submitted','in_production','review','delivering','completed']
const STAGE_LABEL: Record<string,string> = {
  payment_received:'Payment Received', brief_submitted:'Brief Submitted',
  in_production:'In Production', review:'In Review',
  delivering:'Delivering', completed:'Completed'
}

export default function ClientPortal() {
  const router = useRouter()
  const [client, setClient] = useState<Client | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const [tab, setTab] = useState<'status'|'brief'|'files'>('status')

  // Brief form state
  const [brief, setBrief] = useState({
    business_name:'', business_description:'', target_audience:'',
    industry:'', style_direction:'', colors_liked:'', colors_to_avoid:'',
    additional_message:''
  })
  const [briefFile, setBriefFile] = useState<File | null>(null)
  const [submittingBrief, setSubmittingBrief] = useState(false)
  const [briefSuccess, setBriefSuccess] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login'); return }

      const { data: clientData } = await supabase
        .from('clients')
        .select('id, name, email')
        .eq('email', user.email)
        .single()

      if (!clientData) {
        // Auto-create client record on first portal visit
        const { data: newClient } = await supabase
          .from('clients')
          .insert({ name: user.email?.split('@')[0] || 'Client', email: user.email!, source: 'portal', status: 'active' })
          .select().single()
        setClient(newClient)
      } else {
        setClient(clientData)
      }

      const { data: projectData } = await supabase
        .from('projects')
        .select('id, project_ref, service_name, stage, total_amount_usd, created_at, deadline, briefs(id,status,submitted_at), payments(amount_usd,status,milestone)')
        .eq('client_id', clientData?.id || '')
        .order('created_at', { ascending: false })

      setProjects(projectData || [])
      if (projectData?.length) setActiveProject(projectData[0])
      setLoading(false)
    })
  }, [])

  const submitBrief = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeProject || !client) return
    setSubmittingBrief(true)

    const { data: briefData } = await supabase.from('briefs').insert({
      project_id: activeProject.id,
      client_id: client.id,
      ...brief,
      submitted_at: new Date().toISOString(),
      status: 'pending'
    }).select().single()

    if (briefData && briefFile) {
      const ext = briefFile.name.split('.').pop()
      const path = \`\${client.id}/\${briefData.id}/\${Date.now()}.\${ext}\`
      const { data: upload } = await supabase.storage.from('brief-files').upload(path, briefFile)
      if (upload) {
        const { data: url } = supabase.storage.from('brief-files').getPublicUrl(path)
        await supabase.from('brief_files').insert({
          brief_id: briefData.id, client_id: client.id,
          file_name: briefFile.name, file_url: url.publicUrl,
          file_type: briefFile.type, file_size_kb: Math.round(briefFile.size / 1024)
        })
      }
    }

    // Advance project stage
    await supabase.from('projects').update({ stage: 'brief_submitted' }).eq('id', activeProject.id)
    setProjects(ps => ps.map(p => p.id === activeProject.id ? {...p, stage:'brief_submitted'} : p))
    setActiveProject(p => p ? {...p, stage:'brief_submitted'} : p)

    setBriefSuccess(true)
    setSubmittingBrief(false)
    setBrief({ business_name:'', business_description:'', target_audience:'', industry:'', style_direction:'', colors_liked:'', colors_to_avoid:'', additional_message:'' })
    setTimeout(() => { setBriefSuccess(false); setTab('status') }, 3000)
  }

  const inp: React.CSSProperties = {
    background:'rgba(30,26,21,.8)', border:'1px solid rgba(201,169,110,.15)',
    color:'#f0e8d8', fontFamily:'Montserrat,sans-serif', fontSize:'.8rem',
    padding:'.65rem 1rem', width:'100%', outline:'none'
  }
  const lbl: React.CSSProperties = {
    fontSize:'.55rem', letterSpacing:'.12em', textTransform:'uppercase',
    color:'rgba(240,232,216,.4)', marginBottom:'.35rem', display:'block'
  }

  if (loading) return (
    <div style={{minHeight:'100vh',background:'#0a0906',display:'flex',alignItems:'center',justifyContent:'center',color:'rgba(240,232,216,.4)',fontFamily:'Montserrat,sans-serif',fontSize:'.8rem'}}>
      Loading your portal...
    </div>
  )

  return (
    <div style={{minHeight:'100vh', background:'#0a0906', fontFamily:'Montserrat,sans-serif'}}>
      {/* Header */}
      <div style={{borderBottom:'1px solid rgba(201,169,110,.12)', padding:'1.25rem 2rem', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <img src="/logo.svg" alt="OGraphy" style={{height:36, width:'auto'}} />
        <div style={{display:'flex', alignItems:'center', gap:'1.5rem'}}>
          {client && <span style={{fontSize:'.72rem', color:'rgba(240,232,216,.5)'}}>{client.name}</span>}
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} style={{background:'transparent', border:'1px solid rgba(201,169,110,.2)', color:'rgba(240,232,216,.5)', padding:'.3rem .75rem', fontSize:'.6rem', cursor:'pointer', fontFamily:'Montserrat,sans-serif', letterSpacing:'.1em', textTransform:'uppercase'}}>Sign Out</button>
        </div>
      </div>

      <div style={{maxWidth:1000, margin:'0 auto', padding:'2.5rem 2rem'}}>
        {/* Welcome */}
        <div style={{marginBottom:'2rem'}}>
          <div style={{fontSize:'.55rem', letterSpacing:'.2em', textTransform:'uppercase', color:'#c9a96e', marginBottom:'.4rem'}}>Client Portal</div>
          <h1 style={{fontFamily:'Cormorant Garamond,serif', fontSize:'1.8rem', fontWeight:300, color:'#f0e8d8'}}>
            Welcome{client?.name ? \`, \${client.name}\` : ' back'}
          </h1>
        </div>

        {projects.length === 0 ? (
          <div style={{background:'#0f0d0a', border:'1px solid rgba(201,169,110,.12)', padding:'3rem', textAlign:'center'}}>
            <div style={{fontSize:'.85rem', color:'rgba(240,232,216,.5)', marginBottom:'1rem'}}>No active projects yet.</div>
            <a href="/catalog" style={{color:'#c9a96e', fontSize:'.75rem', textDecoration:'none', letterSpacing:'.1em'}}>BROWSE SERVICES →</a>
          </div>
        ) : (
          <div style={{display:'grid', gridTemplateColumns:'240px 1fr', gap:'1.5rem'}}>
            {/* Project list */}
            <div>
              <div style={{fontSize:'.55rem', letterSpacing:'.14em', textTransform:'uppercase', color:'rgba(240,232,216,.35)', marginBottom:'.75rem'}}>Your Projects</div>
              {projects.map(p => (
                <div key={p.id}
                  onClick={() => { setActiveProject(p); setTab('status') }}
                  style={{padding:'.85rem 1rem', marginBottom:2, cursor:'pointer', border:'1px solid', borderColor:activeProject?.id===p.id?'rgba(201,169,110,.4)':'rgba(201,169,110,.1)', background:activeProject?.id===p.id?'rgba(201,169,110,.06)':'transparent'}}
                >
                  <div style={{fontSize:'.65rem', fontFamily:'IBM Plex Mono,monospace', color:'#c9a96e', marginBottom:'.2rem'}}>{p.project_ref}</div>
                  <div style={{fontSize:'.75rem', color:'#f0e8d8', fontWeight:500}}>{p.service_name}</div>
                  <div style={{fontSize:'.6rem', color:'rgba(240,232,216,.4)', marginTop:'.25rem', textTransform:'capitalize'}}>{p.stage.replace('_',' ')}</div>
                </div>
              ))}
            </div>

            {/* Active project detail */}
            {activeProject && (
              <div style={{background:'#0f0d0a', border:'1px solid rgba(201,169,110,.12)'}}>
                {/* Tabs */}
                <div style={{display:'flex', borderBottom:'1px solid rgba(201,169,110,.12)'}}>
                  {(['status','brief','files'] as const).map(t => (
                    <button key={t} onClick={() => setTab(t)} style={{
                      flex:1, padding:'.85rem', background:'transparent', border:'none',
                      borderBottom: tab===t?'2px solid #c9a96e':'2px solid transparent',
                      color: tab===t?'#c9a96e':'rgba(240,232,216,.4)',
                      fontFamily:'Montserrat,sans-serif', fontSize:'.65rem', letterSpacing:'.12em',
                      textTransform:'uppercase', cursor:'pointer',
                    }}>{t === 'brief' ? 'Submit Brief' : t === 'files' ? 'My Files' : 'Project Status'}</button>
                  ))}
                </div>

                <div style={{padding:'1.75rem'}}>
                  {/* STATUS TAB */}
                  {tab === 'status' && (
                    <div>
                      <div style={{fontFamily:'Cormorant Garamond,serif', fontSize:'1.3rem', fontWeight:300, color:'#f0e8d8', marginBottom:'1.5rem'}}>{activeProject.service_name}</div>

                      {/* Stage progress */}
                      <div style={{marginBottom:'1.75rem'}}>
                        <div style={{fontSize:'.55rem', letterSpacing:'.14em', textTransform:'uppercase', color:'rgba(240,232,216,.35)', marginBottom:'.75rem'}}>Progress</div>
                        <div style={{display:'flex', gap:2}}>
                          {STAGES.map((s, i) => {
                            const stageIdx = STAGES.indexOf(activeProject.stage)
                            const done = i <= stageIdx
                            return (
                              <div key={s} style={{flex:1, padding:'.4rem .25rem', textAlign:'center', background:done?'rgba(201,169,110,.2)':'rgba(201,169,110,.04)', borderBottom:\`2px solid \${done?'#c9a96e':'rgba(201,169,110,.15)'}\`}}>
                                <div style={{fontSize:'.48rem', letterSpacing:'.08em', textTransform:'uppercase', color:done?'#c9a96e':'rgba(240,232,216,.25)', fontWeight:done?500:300}}>{STAGE_LABEL[s]}</div>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Project details */}
                      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem'}}>
                        {[
                          ['Project Ref', activeProject.project_ref],
                          ['Service', activeProject.service_name],
                          ['Stage', activeProject.stage.replace('_',' ')],
                          ['Value', activeProject.total_amount_usd ? \`$\${activeProject.total_amount_usd.toLocaleString()}\` : '—'],
                          ['Started', new Date(activeProject.created_at).toLocaleDateString()],
                          ['Deadline', activeProject.deadline ? new Date(activeProject.deadline).toLocaleDateString() : '—'],
                        ].map(([label, value]) => (
                          <div key={label} style={{padding:'.75rem', background:'rgba(201,169,110,.04)', border:'1px solid rgba(201,169,110,.08)'}}>
                            <div style={{fontSize:'.5rem', letterSpacing:'.12em', textTransform:'uppercase', color:'rgba(240,232,216,.3)', marginBottom:'.25rem'}}>{label}</div>
                            <div style={{fontSize:'.75rem', color:'#f0e8d8', textTransform:'capitalize'}}>{value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Next step CTA */}
                      {activeProject.stage === 'payment_received' && (
                        <div style={{marginTop:'1.5rem', padding:'1rem', background:'rgba(201,169,110,.06)', border:'1px solid rgba(201,169,110,.2)'}}>
                          <div style={{fontSize:'.7rem', color:'#c9a96e', marginBottom:'.5rem', fontWeight:500}}>Next Step: Submit Your Brief</div>
                          <div style={{fontSize:'.72rem', color:'rgba(240,232,216,.6)', marginBottom:'.75rem'}}>Tell us about your project so we can get started. The more detail you provide, the better the result.</div>
                          <button onClick={() => setTab('brief')} style={{background:'#c9a96e', color:'#0a0906', border:'none', padding:'.55rem 1.25rem', fontFamily:'Montserrat,sans-serif', fontSize:'.65rem', fontWeight:500, letterSpacing:'.1em', textTransform:'uppercase', cursor:'pointer'}}>
                            Submit Brief →
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* BRIEF TAB */}
                  {tab === 'brief' && (
                    <div>
                      {activeProject.briefs?.length > 0 && activeProject.briefs[0].submitted_at ? (
                        <div style={{padding:'1.5rem', background:'rgba(39,174,96,.06)', border:'1px solid rgba(39,174,96,.2)', textAlign:'center'}}>
                          <div style={{color:'#27ae60', fontSize:'.8rem', fontWeight:500, marginBottom:'.4rem'}}>✓ Brief Submitted</div>
                          <div style={{fontSize:'.72rem', color:'rgba(240,232,216,.5)'}}>Submitted on {new Date(activeProject.briefs[0].submitted_at).toLocaleDateString()}. We'll be in touch shortly.</div>
                        </div>
                      ) : (
                        <form onSubmit={submitBrief} style={{display:'flex', flexDirection:'column', gap:'1rem'}}>
                          <div style={{fontSize:'.6rem', letterSpacing:'.12em', textTransform:'uppercase', color:'#c9a96e', marginBottom:'.25rem'}}>Project Brief</div>
                          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem'}}>
                            <div><label style={lbl}>Business Name *</label><input style={inp} required value={brief.business_name} onChange={e=>setBrief(b=>({...b,business_name:e.target.value}))} placeholder="Your brand or business name" /></div>
                            <div><label style={lbl}>Industry</label><input style={inp} value={brief.industry} onChange={e=>setBrief(b=>({...b,industry:e.target.value}))} placeholder="Fashion, Tech, Food..." /></div>
                            <div style={{gridColumn:'1/-1'}}><label style={lbl}>Business Description</label><textarea style={{...inp,minHeight:70,resize:'vertical'}} value={brief.business_description} onChange={e=>setBrief(b=>({...b,business_description:e.target.value}))} placeholder="What does your business do? Who do you serve?" /></div>
                            <div><label style={lbl}>Target Audience</label><input style={inp} value={brief.target_audience} onChange={e=>setBrief(b=>({...b,target_audience:e.target.value}))} placeholder="Who are your customers?" /></div>
                            <div><label style={lbl}>Style Direction</label><input style={inp} value={brief.style_direction} onChange={e=>setBrief(b=>({...b,style_direction:e.target.value}))} placeholder="Minimalist, bold, luxury, organic..." /></div>
                            <div><label style={lbl}>Colors You Like</label><input style={inp} value={brief.colors_liked} onChange={e=>setBrief(b=>({...b,colors_liked:e.target.value}))} placeholder="Black + gold, earth tones..." /></div>
                            <div><label style={lbl}>Colors to Avoid</label><input style={inp} value={brief.colors_to_avoid} onChange={e=>setBrief(b=>({...b,colors_to_avoid:e.target.value}))} placeholder="Bright red, neon..." /></div>
                            <div style={{gridColumn:'1/-1'}}><label style={lbl}>Additional Message</label><textarea style={{...inp,minHeight:80,resize:'vertical'}} value={brief.additional_message} onChange={e=>setBrief(b=>({...b,additional_message:e.target.value}))} placeholder="Anything else we should know? Links, references, inspirations..." /></div>
                            <div style={{gridColumn:'1/-1'}}>
                              <label style={lbl}>Reference Files (optional)</label>
                              <input type="file" accept=".pdf,.png,.jpg,.jpeg,.ai,.psd,.zip" onChange={e=>setBriefFile(e.target.files?.[0]||null)} style={{...inp, cursor:'pointer'}} />
                              <div style={{fontSize:'.58rem', color:'rgba(240,232,216,.3)', marginTop:'.3rem'}}>PDF, PNG, JPG, AI, PSD, ZIP — max 20MB</div>
                            </div>
                          </div>
                          {briefSuccess && <div style={{padding:'.75rem', background:'rgba(39,174,96,.08)', border:'1px solid rgba(39,174,96,.3)', color:'#27ae60', fontSize:'.72rem'}}>✓ Brief submitted! We'll review and be in touch within 24 hours.</div>}
                          <button type="submit" disabled={submittingBrief} style={{background:'#c9a96e', color:'#0a0906', border:'none', padding:'1rem', fontFamily:'Montserrat,sans-serif', fontSize:'.72rem', fontWeight:500, letterSpacing:'.12em', textTransform:'uppercase', cursor:submittingBrief?'default':'pointer', opacity:submittingBrief?.6:1}}>
                            {submittingBrief ? 'Submitting...' : 'Submit Brief'}
                          </button>
                        </form>
                      )}
                    </div>
                  )}

                  {/* FILES TAB */}
                  {tab === 'files' && (
                    <div>
                      <div style={{fontSize:'.6rem', letterSpacing:'.12em', textTransform:'uppercase', color:'#c9a96e', marginBottom:'1rem'}}>Delivered Files</div>
                      <div style={{padding:'2.5rem', textAlign:'center', background:'rgba(201,169,110,.03)', border:'1px solid rgba(201,169,110,.08)'}}>
                        <div style={{fontSize:'.8rem', color:'rgba(240,232,216,.3)', marginBottom:'.5rem'}}>No files delivered yet</div>
                        <div style={{fontSize:'.68rem', color:'rgba(240,232,216,.2)'}}>Final deliverables will appear here once your project is complete.</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
`, 'utf8');
console.log('✓ src/app/portal/page.tsx');

// src/app/api/stripe/webhook/route.ts
fs.mkdirSync(base + '/src/app/api/stripe/webhook', {recursive:true});
fs.writeFileSync(base + '/src/app/api/stripe/webhook/route.ts', `import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  // For now: accept all events (add Stripe signature verification when live)
  let event: any
  try {
    event = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object

    const email = session.customer_details?.email
    const name = session.customer_details?.name || email?.split('@')[0] || 'Client'
    const amountPaid = session.amount_total / 100
    const serviceName = session.metadata?.service_name || 'Studio Service'
    const catalogItemId = session.metadata?.catalog_item_id || null

    if (!email) {
      return NextResponse.json({ error: 'No email in session' }, { status: 400 })
    }

    // Upsert client
    let { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('email', email)
      .single()

    if (!client) {
      const { data: newClient } = await supabase
        .from('clients')
        .insert({ name, email, source: 'stripe', status: 'active' })
        .select().single()
      client = newClient
    }

    if (!client) return NextResponse.json({ error: 'Client creation failed' }, { status: 500 })

    // Create project
    const { data: project } = await supabase
      .from('projects')
      .insert({
        client_id: client.id,
        catalog_item_id: catalogItemId,
        service_name: serviceName,
        stage: 'payment_received',
        total_amount_usd: amountPaid,
        deposit_paid_usd: amountPaid,
        balance_due_usd: 0,
        stripe_session_id: session.id,
        delivery_type: session.metadata?.delivery_type || 'digital'
      })
      .select().single()

    if (!project) return NextResponse.json({ error: 'Project creation failed' }, { status: 500 })

    // Create payment record
    await supabase.from('payments').insert({
      project_id: project.id,
      client_id: client.id,
      stripe_session_id: session.id,
      amount_usd: amountPaid,
      milestone: 'full',
      status: 'paid',
      paid_at: new Date().toISOString()
    })

    // Create empty brief
    await supabase.from('briefs').insert({
      project_id: project.id,
      client_id: client.id,
      status: 'pending'
    })

    console.log(\`✓ Project created: \${project.project_ref} for \${email}\`)
  }

  return NextResponse.json({ received: true })
}
`, 'utf8');
console.log('✓ src/app/api/stripe/webhook/route.ts');

// src/app/catalog/page.tsx
fs.mkdirSync(base + '/src/app/catalog', {recursive:true});
fs.writeFileSync(base + '/src/app/catalog/page.tsx', `'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Item = {
  id: string; name: string; category: string; subcategory: string | null
  description: string | null; delivery: string; turnaround: string | null
  base_price_usd: number | null; price_note: string | null
  image_url: string | null; style_tags: string[] | null; is_featured: boolean
}

const CATEGORIES = ['all','identity','content','print','digital','event']
const CATEGORY_LABELS: Record<string,string> = {
  all:'All Services', identity:'Identity', content:'Content',
  print:'Print & Physical', digital:'Editorial', event:'Event Media'
}
const DELIVERY_ICONS: Record<string,string> = { digital:'↗', physical:'⊕', both:'◈' }

export default function PublicCatalog() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    supabase.from('catalog_items')
      .select('id,name,category,subcategory,description,delivery,turnaround,base_price_usd,price_note,image_url,style_tags,is_featured')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .then(({ data }) => { setItems(data || []); setLoading(false) })
  }, [])

  const visible = filter === 'all' ? items : items.filter(i => i.category === filter)
  const featured = items.filter(i => i.is_featured)

  return (
    <div style={{ minHeight:'100vh', background:'#0a0906', fontFamily:'Montserrat,sans-serif' }}>
      {/* Header */}
      <header style={{ borderBottom:'1px solid rgba(201,169,110,.1)', padding:'1.25rem 2rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <a href="https://ography-site.vercel.app" style={{ textDecoration:'none' }}>
          <img src="/logo.svg" alt="OGraphy" style={{ height:36, width:'auto' }} />
        </a>
        <nav style={{ display:'flex', gap:'1.5rem', alignItems:'center' }}>
          <a href="/contact" style={{ fontSize:'.65rem', letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(240,232,216,.5)', textDecoration:'none' }}>Request a Service</a>
          <a href="/portal" style={{ fontSize:'.65rem', letterSpacing:'.1em', textTransform:'uppercase', color:'#c9a96e', textDecoration:'none', border:'1px solid rgba(201,169,110,.3)', padding:'.35rem .85rem' }}>Client Portal</a>
        </nav>
      </header>

      {/* Hero */}
      <div style={{ textAlign:'center', padding:'4rem 2rem 3rem' }}>
        <div style={{ fontSize:'.55rem', letterSpacing:'.3em', textTransform:'uppercase', color:'rgba(201,169,110,.6)', marginBottom:'1rem' }}>Visual Readiness as a Service</div>
        <h1 style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'clamp(2rem,5vw,3.5rem)', fontWeight:300, color:'#f0e8d8', marginBottom:'1rem', lineHeight:1.15 }}>
          One contact. One invoice.<br/>One coordinated result.
        </h1>
        <p style={{ fontSize:'.8rem', color:'rgba(240,232,216,.5)', maxWidth:520, margin:'0 auto 2rem', lineHeight:1.7 }}>
          Submit your requirements. We execute. You receive.
        </p>
      </div>

      {/* Featured strip */}
      {featured.length > 0 && (
        <div style={{ maxWidth:1100, margin:'0 auto 3rem', padding:'0 2rem' }}>
          <div style={{ fontSize:'.52rem', letterSpacing:'.2em', textTransform:'uppercase', color:'rgba(201,169,110,.5)', marginBottom:'1rem' }}>Featured Services</div>
          <div style={{ display:'flex', gap:'1px', background:'rgba(201,169,110,.1)', overflowX:'auto' }}>
            {featured.slice(0,4).map(item => (
              <div key={item.id} style={{ flex:'0 0 260px', background:'#0a0906', padding:'1.25rem', borderBottom:'2px solid rgba(201,169,110,.3)' }}>
                <div style={{ fontSize:'.52rem', letterSpacing:'.12em', textTransform:'uppercase', color:'rgba(201,169,110,.5)', marginBottom:'.4rem' }}>{item.category}</div>
                <div style={{ fontSize:'.9rem', fontWeight:500, color:'#f0e8d8', marginBottom:'.4rem' }}>{item.name}</div>
                <div style={{ fontSize:'.75rem', color:'#c9a96e', fontFamily:'IBM Plex Mono,monospace' }}>{item.price_note || (item.base_price_usd ? \`from $\${item.base_price_usd}\` : '—')}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category filters */}
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'0 2rem 2rem' }}>
        <div style={{ display:'flex', gap:'.5rem', flexWrap:'wrap', marginBottom:'2rem' }}>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setFilter(c)} style={{
              padding:'.4rem 1rem', border:'1px solid', cursor:'pointer',
              fontSize:'.6rem', fontFamily:'Montserrat,sans-serif', letterSpacing:'.1em',
              borderColor: filter===c ? '#c9a96e' : 'rgba(201,169,110,.15)',
              background: filter===c ? 'rgba(201,169,110,.08)' : 'transparent',
              color: filter===c ? '#c9a96e' : 'rgba(240,232,216,.45)',
            }}>{CATEGORY_LABELS[c] || c}</button>
          ))}
          <span style={{ marginLeft:'auto', fontSize:'.6rem', color:'rgba(240,232,216,.3)', alignSelf:'center' }}>{visible.length} services</span>
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:'4rem', color:'rgba(240,232,216,.3)', fontSize:'.8rem' }}>Loading catalog...</div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'1px', background:'rgba(201,169,110,.08)' }}>
            {visible.map(item => (
              <div key={item.id} style={{ background:'#0a0906', padding:'1.75rem', display:'flex', flexDirection:'column' }}>
                {/* Image */}
                <div style={{ width:'100%', aspectRatio:'16/9', background:'#0f0d0a', marginBottom:'1.25rem', overflow:'hidden', borderRadius:4 }}>
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  ) : (
                    <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.6rem', letterSpacing:'.14em', textTransform:'uppercase', color:'rgba(240,232,216,.15)' }}>
                      {CATEGORY_LABELS[item.category]}
                    </div>
                  )}
                </div>

                {/* Meta */}
                <div style={{ fontSize:'.5rem', letterSpacing:'.14em', textTransform:'uppercase', color:'rgba(201,169,110,.5)', marginBottom:'.4rem' }}>
                  {CATEGORY_LABELS[item.category]}
                  {item.subcategory ? \` · \${item.subcategory.replace('_',' ')}\` : ''}
                </div>
                <div style={{ fontSize:'1rem', fontWeight:500, color:'#f0e8d8', marginBottom:'.5rem' }}>{item.name}</div>
                {item.description && (
                  <div style={{ fontSize:'.72rem', color:'rgba(240,232,216,.5)', lineHeight:1.6, marginBottom:'1rem', flex:1 }}>
                    {item.description.length > 100 ? item.description.substring(0,100)+'...' : item.description}
                  </div>
                )}

                {/* Price row */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'.75rem' }}>
                  <div>
                    <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:'.9rem', color:'#c9a96e' }}>
                      {item.price_note || (item.base_price_usd ? \`from $\${item.base_price_usd}\` : 'Get quote')}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:'.4rem' }}>
                    {item.turnaround && <span style={{ fontSize:'.55rem', padding:'.15rem .5rem', border:'1px solid rgba(201,169,110,.15)', color:'rgba(240,232,216,.4)' }}>{item.turnaround}</span>}
                    <span style={{ fontSize:'.55rem', padding:'.15rem .5rem', border:'1px solid rgba(201,169,110,.15)', color:'rgba(240,232,216,.4)', textTransform:'capitalize' }}>{item.delivery}</span>
                  </div>
                </div>

                {/* CTA */}
                <a href={\`/contact?service=\${encodeURIComponent(item.name)}\`} style={{
                  display:'block', textAlign:'center', background:'transparent',
                  border:'1px solid rgba(201,169,110,.3)', color:'#c9a96e',
                  padding:'.6rem', fontFamily:'Montserrat,sans-serif', fontSize:'.62rem',
                  letterSpacing:'.12em', textTransform:'uppercase', textDecoration:'none',
                  transition:'all .2s'
                }}
                  onMouseEnter={e=>{(e.target as HTMLElement).style.background='rgba(201,169,110,.08)'}}
                  onMouseLeave={e=>{(e.target as HTMLElement).style.background='transparent'}}
                >
                  Request This Service
                </a>
              </div>
            ))}
          </div>
        )}

        {/* Bottom CTA */}
        <div style={{ textAlign:'center', padding:'4rem 0 2rem' }}>
          <div style={{ fontSize:'.72rem', color:'rgba(240,232,216,.4)', marginBottom:'1.5rem' }}>
            Need something custom? We handle it.
          </div>
          <a href="/contact" style={{ display:'inline-block', background:'#c9a96e', color:'#0a0906', padding:'.85rem 2.5rem', fontFamily:'Montserrat,sans-serif', fontSize:'.72rem', fontWeight:500, letterSpacing:'.14em', textTransform:'uppercase', textDecoration:'none' }}>
            Start Your Project
          </a>
        </div>
      </div>
    </div>
  )
}
`, 'utf8');
console.log('✓ src/app/catalog/page.tsx');

// src/app/contact/page.tsx
fs.mkdirSync(base + '/src/app/contact', {recursive:true});
fs.writeFileSync(base + '/src/app/contact/page.tsx', `'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const SERVICES = [
  'Echo Launch Kit','Brand Amplification','Fractional Creative Partner',
  'Social Media Starter Pack','UGC Asset Kit','Monthly Content Bundle',
  'Event Pull-Up Banner','Business Card Set','Framed Wall Print','Event Identity Kit',
  'Pitch Deck Design','Business Proposal','Student CV & Portfolio',
  'Photo Retouch Pack','Custom Lightroom Preset Pack',
  'Same-Day Event Edits','Event Photo Package','Custom / Other'
]

function ContactForm() {
  const params = useSearchParams()
  const [form, setForm] = useState({
    name:'', email:'', phone:'', company:'', service: params.get('service') || '', message:''
  })
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const set = (k:string,v:string) => setForm(f=>({...f,[k]:v}))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true); setError('')

    // Upsert client as lead
    const { error: err } = await supabase.from('clients').upsert({
      name: form.name,
      email: form.email,
      phone: form.phone || null,
      company: form.company || null,
      source: 'website',
      status: 'lead',
      notes: \`Service interest: \${form.service}\\n\\nMessage: \${form.message}\`
    }, { onConflict: 'email' })

    if (err) { setError('Something went wrong. Please try again.'); setSubmitting(false); return }

    setSuccess(true); setSubmitting(false)
    setForm({ name:'', email:'', phone:'', company:'', service:'', message:'' })
  }

  const inp: React.CSSProperties = {
    background:'rgba(30,26,21,.8)', border:'1px solid rgba(201,169,110,.15)',
    color:'#f0e8d8', fontFamily:'Montserrat,sans-serif', fontSize:'.82rem',
    padding:'.75rem 1rem', width:'100%', outline:'none'
  }
  const lbl: React.CSSProperties = {
    fontSize:'.55rem', letterSpacing:'.12em', textTransform:'uppercase',
    color:'rgba(240,232,216,.4)', marginBottom:'.35rem', display:'block'
  }

  if (success) return (
    <div style={{ minHeight:'100vh', background:'#0a0906', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Montserrat,sans-serif', padding:'2rem', flexDirection:'column', textAlign:'center' }}>
      <img src="/logo.svg" alt="OGraphy" style={{ height:60, marginBottom:'2rem' }} />
      <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'2rem', fontWeight:300, color:'#f0e8d8', marginBottom:'1rem' }}>Request Received</div>
      <div style={{ fontSize:'.78rem', color:'rgba(240,232,216,.5)', maxWidth:380, lineHeight:1.7, marginBottom:'2rem' }}>
        We'll review your request and get back to you within 24 hours.
      </div>
      <a href="/catalog" style={{ color:'#c9a96e', fontSize:'.65rem', letterSpacing:'.12em', textTransform:'uppercase', textDecoration:'none', border:'1px solid rgba(201,169,110,.3)', padding:'.5rem 1.25rem' }}>Browse More Services</a>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#0a0906', fontFamily:'Montserrat,sans-serif' }}>
      <header style={{ borderBottom:'1px solid rgba(201,169,110,.1)', padding:'1.25rem 2rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <a href="/catalog"><img src="/logo.svg" alt="OGraphy" style={{ height:36 }} /></a>
        <a href="/catalog" style={{ fontSize:'.65rem', letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(240,232,216,.4)', textDecoration:'none' }}>← Browse Catalog</a>
      </header>

      <div style={{ maxWidth:580, margin:'0 auto', padding:'4rem 2rem' }}>
        <div style={{ fontSize:'.55rem', letterSpacing:'.25em', textTransform:'uppercase', color:'rgba(201,169,110,.6)', marginBottom:'1rem' }}>Start Your Project</div>
        <h1 style={{ fontFamily:'Cormorant Garamond,serif', fontSize:'2.2rem', fontWeight:300, color:'#f0e8d8', marginBottom:'2.5rem' }}>Request a Service</h1>

        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
            <div><label style={lbl}>Full Name *</label><input style={inp} required value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Your name" /></div>
            <div><label style={lbl}>Email *</label><input style={inp} required type="email" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="your@email.com" /></div>
            <div><label style={lbl}>Phone</label><input style={inp} value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="+1 234 567 890" /></div>
            <div><label style={lbl}>Company / Brand</label><input style={inp} value={form.company} onChange={e=>set('company',e.target.value)} placeholder="Your business name" /></div>
          </div>

          <div>
            <label style={lbl}>Service Interest</label>
            <select style={{...inp, cursor:'pointer'}} value={form.service} onChange={e=>set('service',e.target.value)}>
              <option value="">Select a service...</option>
              {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label style={lbl}>Message *</label>
            <textarea style={{...inp, minHeight:120, resize:'vertical'}} required value={form.message} onChange={e=>set('message',e.target.value)} placeholder="Tell us about your project. What do you need, when do you need it, and any other context that helps us respond effectively." />
          </div>

          {error && <div style={{ padding:'.75rem', background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.2)', color:'#ef4444', fontSize:'.72rem' }}>{error}</div>}

          <button type="submit" disabled={submitting} style={{
            background:'#c9a96e', color:'#0a0906', border:'none',
            padding:'1.1rem', fontFamily:'Montserrat,sans-serif', fontSize:'.72rem',
            fontWeight:500, letterSpacing:'.14em', textTransform:'uppercase',
            cursor:submitting?'default':'pointer', opacity:submitting?.6:1
          }}>
            {submitting ? 'Sending...' : 'Send Request'}
          </button>

          <div style={{ fontSize:'.62rem', color:'rgba(240,232,216,.25)', textAlign:'center', lineHeight:1.6 }}>
            We respond within 24 hours. No spam, no newsletters.
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ContactPage() {
  return <Suspense fallback={<div style={{minHeight:'100vh',background:'#0a0906'}} />}><ContactForm /></Suspense>
}
`, 'utf8');
console.log('✓ src/app/contact/page.tsx');

console.log('\nAll missing parts installed.');
console.log('Run: Remove-Item -Recurse -Force .next && npm run dev');