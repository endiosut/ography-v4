'use client'
import { useEffect, useState } from 'react'
import AdminSidebar from '@/components/AdminSidebar'
import { getProjects, updateProjectStage, type Project } from '@/lib/supabase'
import Link from 'next/link'

const STAGES = ['payment_received','brief_submitted','in_production','review','revision','delivering','completed']
const STAGE_LABEL: Record<string, string> = {
  payment_received: 'Payment Received', brief_submitted: 'Brief In',
  in_production: 'In Production', review: 'In Review',
  revision: 'Revision', delivering: 'Delivering', completed: 'Completed',
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getProjects().then(p => { setProjects(p); setLoading(false) })
  }, [])

  const visible = filter === 'all' ? projects : projects.filter(p => p.stage === filter)

  const advanceStage = async (project: Project) => {
    const idx = STAGES.indexOf(project.stage)
    if (idx < STAGES.length - 1) {
      const next = STAGES[idx + 1]
      await updateProjectStage(project.id, next)
      setProjects(ps => ps.map(p => p.id === project.id ? { ...p, stage: next } : p))
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <AdminSidebar />
      <main style={{ marginLeft: 220, flex: 1, padding: '2.5rem', minWidth: 0 }}>
        <div style={{ marginBottom: '1.75rem' }}>
          <div style={{ fontSize: '.55rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '.4rem' }}>Studio</div>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.8rem', fontWeight: 300, color: 'var(--cream)' }}>Projects</h1>
        </div>

        {/* Stage filter */}
        <div style={{ display: 'flex', gap: '.4rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {(['all', ...STAGES] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding: '.3rem .75rem', border: '1px solid', cursor: 'pointer',
              fontSize: '.6rem', fontFamily: 'Montserrat', letterSpacing: '.08em',
              borderColor: filter === s ? 'var(--gold)' : 'var(--border)',
              background: filter === s ? 'var(--gold-dim2)' : 'transparent',
              color: filter === s ? 'var(--gold)' : 'var(--cream-muted)',
            }}>
              {s === 'all' ? 'All' : STAGE_LABEL[s]}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ color: 'var(--cream-muted)', padding: '3rem 0', textAlign: 'center' }}>Loading...</div>
        ) : visible.length === 0 ? (
          <div style={{ color: 'var(--cream-muted)', padding: '3rem 0', textAlign: 'center', fontSize: '.85rem' }}>No projects yet.</div>
        ) : (
          <div style={{ border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--dark)' }}>
                  {['Ref', 'Client', 'Service', 'Stage', 'Value', 'Deadline', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '.75rem 1rem', textAlign: 'left', fontSize: '.52rem', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--cream-dim)', fontWeight: 400 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((p, i) => (
                  <tr key={p.id} style={{ borderBottom: i < visible.length - 1 ? '1px solid var(--border)' : 'none', background: 'var(--dark)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--dark2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--dark)')}
                  >
                    <td style={{ padding: '.8rem 1rem' }}>
                      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '.65rem', color: 'var(--gold)' }}>{p.project_ref}</span>
                    </td>
                    <td style={{ padding: '.8rem 1rem' }}>
                      <Link href={`/admin/projects/${p.id}`} style={{ textDecoration: 'none', color: 'var(--cream)', fontSize: '.78rem', fontWeight: 400 }}>
                        {p.clients?.name || '—'}
                      </Link>
                      <div style={{ fontSize: '.6rem', color: 'var(--cream-muted)' }}>{p.clients?.email}</div>
                    </td>
                    <td style={{ padding: '.8rem 1rem', fontSize: '.75rem', color: 'var(--cream-muted)' }}>{p.service_name}</td>
                    <td style={{ padding: '.8rem 1rem' }}>
                      <span style={{ fontSize: '.6rem', padding: '.2rem .6rem', border: '1px solid', borderColor: 'var(--border)', color: 'var(--cream-muted)' }}>
                        {STAGE_LABEL[p.stage] || p.stage}
                      </span>
                    </td>
                    <td style={{ padding: '.8rem 1rem', fontFamily: 'IBM Plex Mono', fontSize: '.72rem', color: 'var(--cream)' }}>
                      {p.total_amount_usd ? `$${p.total_amount_usd.toLocaleString()}` : '—'}
                    </td>
                    <td style={{ padding: '.8rem 1rem', fontFamily: 'IBM Plex Mono', fontSize: '.65rem', color: 'var(--cream-muted)' }}>
                      {p.deadline ? new Date(p.deadline).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '.8rem 1rem' }}>
                      {p.stage !== 'completed' && (
                        <button onClick={() => advanceStage(p)} style={{
                          background: 'transparent', border: '1px solid var(--border)',
                          color: 'var(--cream-muted)', padding: '.25rem .65rem',
                          fontSize: '.55rem', cursor: 'pointer', fontFamily: 'Montserrat',
                          letterSpacing: '.08em',
                        }}>
                          Advance →
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
