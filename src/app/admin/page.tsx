'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import AdminSidebar from '@/components/AdminSidebar'
import Link from 'next/link'

// NOTE: force-dynamic lives in ./layout.tsx — route segment config is ignored
// in 'use client' files. See the comment there.

const STAGE_LABELS: Record<string, string> = {
  payment_received: 'Payment Received',
  brief_submitted: 'Brief In',
  in_production: 'In Production',
  review: 'In Review',
  revision: 'Revision',
  delivering: 'Delivering',
  completed: 'Completed',
}

type Project = {
  id: string
  service_name: string
  stage: string
  total_amount_usd: number | null
  created_at: string
  clients?: { name: string; email: string } | null
}

type Stats = {
  activeProjects: number
  pipelineValue: number
  totalEarned: number
  totalClients: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Log env vars (first 10 chars only) to verify they are defined
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    console.log('[Admin] NEXT_PUBLIC_SUPABASE_URL:', url ? url.slice(0, 10) + '...' : 'UNDEFINED')
    console.log('[Admin] NEXT_PUBLIC_SUPABASE_ANON_KEY:', key ? key.slice(0, 10) + '...' : 'UNDEFINED')

    if (!url || !key) {
      const msg = 'Supabase env vars are undefined — check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
      console.error('[Admin]', msg)
      setError(msg)
      setLoading(false)
      return
    }

    // createBrowserClient MUST be inside useEffect — never at module level
    const supabase = createBrowserClient(url, key)

    Promise.all([
      supabase.from('clients').select('id, status', { count: 'exact' }),
      supabase.from('projects').select('*, clients(name, email)').order('created_at', { ascending: false }).limit(20),
      supabase.from('payments').select('id, amount_usd, status', { count: 'exact' }),
    ]).then(([clientsRes, projectsRes, paymentsRes]) => {
      if (clientsRes.error) console.error('[Admin] clients error:', clientsRes.error)
      if (projectsRes.error) console.error('[Admin] projects error:', projectsRes.error)
      if (paymentsRes.error) console.error('[Admin] payments error:', paymentsRes.error)

      const allProjects: Project[] = projectsRes.data ?? []
      const allPayments = paymentsRes.data ?? []

      const activeProjects = allProjects.filter(p => p.stage !== 'completed').length
      const pipelineValue = allProjects
        .filter(p => p.stage !== 'completed')
        .reduce((s, p) => s + (p.total_amount_usd ?? 0), 0)
      const totalEarned = allPayments
        .filter((p: any) => p.status === 'paid')
        .reduce((s: number, p: any) => s + (p.amount_usd ?? 0), 0)

      setStats({
        activeProjects,
        pipelineValue,
        totalEarned,
        totalClients: clientsRes.count ?? 0,
      })
      setProjects(allProjects.slice(0, 8))
    }).catch(err => {
      console.error('[Admin] fetch failed:', err)
      setError(err?.message ?? 'Unknown fetch error')
    }).finally(() => {
      setLoading(false)
    })
  }, [])

  const stageGroups = ['payment_received', 'brief_submitted', 'in_production', 'review', 'revision', 'delivering']

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
          <div style={{ color: 'var(--cream-muted)', fontSize: '.85rem' }}>Loading dashboard...</div>
        ) : error ? (
          <div style={{ color: '#e74c3c', fontSize: '.85rem', padding: '1rem', border: '1px solid #e74c3c', background: 'rgba(231,76,60,.08)' }}>
            Error: {error}
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)', marginBottom: '2.5rem' }}>
              {[
                { label: 'Active Projects', value: stats?.activeProjects ?? 0 },
                { label: 'Pipeline Value', value: `$${(stats?.pipelineValue ?? 0).toLocaleString()}` },
                { label: 'Total Earned', value: `$${(stats?.totalEarned ?? 0).toLocaleString()}` },
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
