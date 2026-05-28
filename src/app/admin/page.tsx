'use client'
import { useEffect, useState } from 'react'
import AdminSidebar from '@/components/AdminSidebar'
import { getAdminStats, getProjects, type Project } from '@/lib/supabase'
import Link from 'next/link'

const STAGE_LABELS: Record<string, string> = {
  payment_received: 'Payment Received',
  brief_submitted: 'Brief In',
  in_production: 'In Production',
  review: 'In Review',
  revision: 'Revision',
  delivering: 'Delivering',
  completed: 'Completed',
}

const STAGE_COLORS: Record<string, string> = {
  payment_received: 'var(--gold)',
  brief_submitted: '#f39c12',
  in_production: '#2980b9',
  review: '#8e44ad',
  revision: '#e67e22',
  delivering: '#27ae60',
  completed: '#27ae60',
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getAdminStats(), getProjects()]).then(([s, p]) => {
      setStats(s); setProjects(p.slice(0, 8)); setLoading(false)
    }).catch(() => { setStats(null); setProjects([]); setLoading(false) })
  }, [])

  const active = projects.filter(p => p.stage !== 'completed')
  const stageGroups = ['payment_received','brief_submitted','in_production','review','revision','delivering']

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <AdminSidebar />
      <main style={{ marginLeft: 220, flex: 1, padding: '2.5rem', minWidth: 0 }}>

        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ fontSize: '.58rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '.5rem' }}>OGraphy Studio</div>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2rem', fontWeight: 300, color: 'var(--cream)', letterSpacing: '-.01em' }}>
            Studio Dashboard
          </h1>
        </div>

        {loading ? (
          <div style={{ color: 'var(--cream-muted)', fontSize: '.85rem' }}>Loading...</div>
        ) : (
          <>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)', marginBottom: '2.5rem' }}>
              {[
                { label: 'Active Projects', value: stats?.activeProjects ?? 0 },
                { label: 'Pipeline Value', value: stats ? `$${(stats.pipelineValue ?? 0).toLocaleString()}` : '—' },
                { label: 'Total Earned', value: stats ? `$${(stats.totalEarned ?? 0).toLocaleString()}` : '—' },
                { label: 'Total Clients', value: stats?.totalClients ?? 0 },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: 'var(--dark)', padding: '1.5rem' }}>
                  <div style={{ fontSize: '.55rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--cream-dim)', marginBottom: '.5rem' }}>{label}</div>
                  <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '1.75rem', color: 'var(--cream)' }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Active pipeline */}
            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.2rem', fontWeight: 300, color: 'var(--cream)' }}>Active Pipeline</h2>
              <Link href="/admin/projects" style={{ fontSize: '.68rem', color: 'var(--gold)', textDecoration: 'none', letterSpacing: '.08em' }}>View all →</Link>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)', marginBottom: '2.5rem' }}>
              {stageGroups.map(stage => {
                const stageProjects = projects.filter(p => p.stage === stage)
                return (
                  <div key={stage} style={{ background: 'var(--dark)', padding: '1rem .75rem', minHeight: 200 }}>
                    <div style={{ fontSize: '.52rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--cream-dim)', marginBottom: '.75rem', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{STAGE_LABELS[stage]}</span>
                      <span style={{ background: 'var(--dark2)', padding: '.1rem .35rem', fontSize: '.5rem' }}>{stageProjects.length}</span>
                    </div>
                    {stageProjects.map(p => (
                      <Link key={p.id} href={`/admin/projects/${p.id}`} style={{ textDecoration: 'none' }}>
                        <div style={{ background: 'var(--dark2)', border: '1px solid var(--border)', padding: '.6rem .65rem', marginBottom: '.4rem', cursor: 'pointer' }}>
                          <div style={{ fontSize: '.65rem', fontWeight: 500, color: 'var(--cream)', marginBottom: '.15rem' }}>{p.clients?.name || 'Unknown'}</div>
                          <div style={{ fontSize: '.58rem', color: 'var(--cream-muted)' }}>{p.service_name}</div>
                          {p.total_amount_usd && (
                            <div style={{ fontSize: '.58rem', fontFamily: 'IBM Plex Mono', color: 'var(--gold)', marginTop: '.2rem' }}>
                              ${p.total_amount_usd.toLocaleString()}
                            </div>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )
              })}
            </div>

            {/* Quick actions */}
            <div style={{ display: 'flex', gap: '1rem' }}>
              <Link href="/admin/catalog/upload" className="btn-gold" style={{ textDecoration: 'none', fontSize: '.7rem', padding: '.65rem 1.5rem' }}>
                + Add Catalog Item
              </Link>
              <Link href="/admin/clients" className="btn-outline" style={{ textDecoration: 'none', fontSize: '.7rem', padding: '.65rem 1.5rem' }}>
                View Clients
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
