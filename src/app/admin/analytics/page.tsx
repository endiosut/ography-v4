'use client';
import { useEffect, useState } from 'react';
import AdminSidebar from '@/components/AdminSidebar';
import { getAdminMetrics, type AdminMetrics } from '@/lib/modules/analytics';
import Link from 'next/link';

const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead',
  payment_received: 'Payment Received',
  brief_submitted: 'Brief In',
  in_production: 'In Production',
  review: 'In Review',
  revision: 'Revision',
  delivering: 'Delivering',
  completed: 'Completed',
};

const STAGE_ORDER = ['lead', 'payment_received', 'brief_submitted', 'in_production', 'review', 'revision', 'delivering', 'completed'];

export default function AnalyticsPage() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminMetrics().then(m => { setMetrics(m); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  const fmtUSD = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const reusablePct = metrics
    ? Math.round((metrics.activeProjects + metrics.completedProjects) / Math.max(metrics.totalProjects, 1) * 100)
    : 0;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0906' }}>
      <AdminSidebar />
      <main style={{ marginLeft: 220, flex: 1, padding: '2.5rem 3rem', minWidth: 0, fontFamily: 'Montserrat, sans-serif', color: '#e8d5b7' }}>

        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ fontSize: '.52rem', letterSpacing: '.25em', textTransform: 'uppercase', color: 'rgba(201,169,110,.5)', marginBottom: '.5rem' }}>OGraphy Studio</div>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2rem', fontWeight: 300, color: '#f0e8d8' }}>
            System Analytics
          </h1>
          <p style={{ fontSize: '.7rem', color: 'rgba(232,213,183,.35)', marginTop: '.4rem' }}>
            Layer 3 visibility — system health, conversion, pipeline, leverage.
          </p>
        </div>

        {loading ? (
          <div style={{ color: 'rgba(232,213,183,.3)', fontSize: '.8rem' }}>Computing metrics...</div>
        ) : !metrics ? (
          <div style={{ color: 'rgba(232,213,183,.3)', fontSize: '.8rem' }}>Failed to load metrics.</div>
        ) : (
          <>
            {/* Reusable Output % — the one metric that matters */}
            <div style={{ border: '1px solid rgba(201,169,110,.2)', background: '#0f0d0a', padding: '1.75rem 2rem', marginBottom: '2rem', borderRadius: 6, display: 'flex', alignItems: 'center', gap: '2rem' }}>
              <div>
                <div style={{ fontSize: '.5rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(201,169,110,.45)', marginBottom: '.4rem' }}>Reusable Output %</div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '3rem', color: reusablePct >= 60 ? '#4a9e6b' : reusablePct >= 30 ? '#c9a96e' : '#e07070', fontWeight: 300, lineHeight: 1 }}>
                  {reusablePct}%
                </div>
                <div style={{ fontSize: '.65rem', color: 'rgba(232,213,183,.4)', marginTop: '.4rem' }}>
                  {reusablePct >= 60 ? 'Building a scalable system' : reusablePct >= 30 ? 'Building leverage' : 'Trapped in execution'}
                </div>
              </div>
              <div style={{ flex: 1, height: 8, background: 'rgba(201,169,110,.1)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(reusablePct, 100)}%`, height: '100%', background: reusablePct >= 60 ? '#4a9e6b' : reusablePct >= 30 ? '#c9a96e' : '#e07070', transition: 'width .5s ease', borderRadius: 4 }} />
              </div>
              <div style={{ fontSize: '.62rem', color: 'rgba(232,213,183,.3)', textAlign: 'right', lineHeight: 1.6 }}>
                <div>Target: {'>'} 60%</div>
                <div style={{ color: 'rgba(232,213,183,.5)' }}>{metrics.totalProjects} total projects</div>
              </div>
            </div>

            {/* Revenue KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1px', background: 'rgba(201,169,110,.08)', border: '1px solid rgba(201,169,110,.08)', marginBottom: '2rem' }}>
              {[
                { label: 'Total Revenue', value: fmtUSD(metrics.totalRevenue), sub: 'all time' },
                { label: 'Pipeline Value', value: fmtUSD(metrics.pipelineValue), sub: 'active projects' },
                { label: 'Avg Project Value', value: fmtUSD(metrics.avgProjectValue), sub: 'per project' },
                { label: 'This Month', value: fmtUSD(metrics.revenueThisMonth), sub: '30 days' },
              ].map(kpi => (
                <div key={kpi.label} style={{ background: '#0f0d0a', padding: '1.25rem 1.5rem' }}>
                  <div style={{ fontSize: '.5rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(201,169,110,.4)', marginBottom: '.5rem' }}>{kpi.label}</div>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.6rem', color: '#c9a96e', fontWeight: 300 }}>{kpi.value}</div>
                  <div style={{ fontSize: '.55rem', color: 'rgba(232,213,183,.2)', marginTop: '.3rem', letterSpacing: '.06em' }}>{kpi.sub}</div>
                </div>
              ))}
            </div>

            {/* Volume KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1px', background: 'rgba(201,169,110,.08)', border: '1px solid rgba(201,169,110,.08)', marginBottom: '2rem' }}>
              {[
                { label: 'Total Clients', value: fmt(metrics.totalClients), sub: `+${metrics.newClientsThisMonth} this month` },
                { label: 'Active Projects', value: fmt(metrics.activeProjects), sub: 'in progress' },
                { label: 'Completed', value: fmt(metrics.completedProjects), sub: 'delivered' },
                { label: 'Conversion Rate', value: `${metrics.leadToProjectRate.toFixed(0)}%`, sub: 'lead → project' },
              ].map(kpi => (
                <div key={kpi.label} style={{ background: '#0f0d0a', padding: '1.25rem 1.5rem' }}>
                  <div style={{ fontSize: '.5rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(201,169,110,.4)', marginBottom: '.5rem' }}>{kpi.label}</div>
                  <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.6rem', color: '#f0e8d8', fontWeight: 300 }}>{kpi.value}</div>
                  <div style={{ fontSize: '.55rem', color: 'rgba(232,213,183,.2)', marginTop: '.3rem', letterSpacing: '.06em' }}>{kpi.sub}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
              {/* Pipeline by stage */}
              <div style={{ border: '1px solid rgba(201,169,110,.1)', background: '#0f0d0a', padding: '1.5rem', borderRadius: 6 }}>
                <div style={{ fontSize: '.52rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(201,169,110,.45)', marginBottom: '1.25rem' }}>Pipeline by Stage</div>
                {STAGE_ORDER.map(stage => {
                  const count = metrics.stageBreakdown[stage] || 0;
                  const maxCount = Math.max(...Object.values(metrics.stageBreakdown), 1);
                  return (
                    <div key={stage} style={{ marginBottom: '.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.3rem', fontSize: '.62rem' }}>
                        <span style={{ color: 'rgba(232,213,183,.5)' }}>{STAGE_LABELS[stage] || stage}</span>
                        <span style={{ color: '#c9a96e', fontFamily: 'Cormorant Garamond, serif', fontSize: '.9rem' }}>{count}</span>
                      </div>
                      <div style={{ height: 3, background: 'rgba(201,169,110,.1)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${(count / maxCount) * 100}%`, height: '100%', background: '#c9a96e', borderRadius: 2 }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Top services */}
              <div style={{ border: '1px solid rgba(201,169,110,.1)', background: '#0f0d0a', padding: '1.5rem', borderRadius: 6 }}>
                <div style={{ fontSize: '.52rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(201,169,110,.45)', marginBottom: '1.25rem' }}>Top Services</div>
                {metrics.topServices.length === 0 ? (
                  <div style={{ fontSize: '.72rem', color: 'rgba(232,213,183,.25)' }}>No data yet.</div>
                ) : (
                  metrics.topServices.map((s, i) => (
                    <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.65rem 0', borderBottom: '1px solid rgba(201,169,110,.06)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
                        <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1rem', color: 'rgba(201,169,110,.3)', minWidth: 20 }}>0{i + 1}</span>
                        <span style={{ fontSize: '.72rem', color: '#e8d5b7' }}>{s.name}</span>
                      </div>
                      <span style={{ fontSize: '.65rem', color: '#c9a96e', background: 'rgba(201,169,110,.08)', padding: '.2rem .6rem', borderRadius: 20 }}>{s.count}x</span>
                    </div>
                  ))
                )}

                {/* System health note */}
                <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(201,169,110,.03)', border: '1px solid rgba(201,169,110,.08)', borderRadius: 4 }}>
                  <div style={{ fontSize: '.52rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(201,169,110,.3)', marginBottom: '.4rem' }}>Scale Check</div>
                  <div style={{ fontSize: '.65rem', color: 'rgba(232,213,183,.4)', lineHeight: 1.7 }}>
                    {metrics.totalClients < 10
                      ? 'Phase 1: Service. Focus on onboarding quality.'
                      : metrics.totalClients < 30
                      ? 'Phase 2: System. Extract repeating patterns into templates.'
                      : 'Phase 3: Scale. Every client is using the same engine.'}
                  </div>
                </div>
              </div>
            </div>

            {/* Automation health */}
            <div style={{ border: '1px solid rgba(201,169,110,.1)', background: '#0f0d0a', padding: '1.5rem 2rem', borderRadius: 6 }}>
              <div style={{ fontSize: '.52rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(201,169,110,.45)', marginBottom: '1.25rem' }}>Automation Stack</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '1rem' }}>
                {[
                  { module: 'Onboarding Engine', status: 'live', desc: 'Lead → project auto-created' },
                  { module: 'Workflow Engine', status: 'live', desc: 'Stage → n8n notification' },
                  { module: 'Communication Engine', status: 'n8n', desc: 'WhatsApp + email events' },
                  { module: 'Delivery Engine', status: 'live', desc: 'Deliverable → client unlock' },
                  { module: 'Analytics Engine', status: 'live', desc: 'Real-time metrics' },
                ].map(m => (
                  <div key={m.module} style={{ padding: '1rem', border: '1px solid rgba(201,169,110,.08)', borderRadius: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', marginBottom: '.5rem' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: m.status === 'live' ? '#4a9e6b' : '#c9a96e', flexShrink: 0 }} />
                      <div style={{ fontSize: '.5rem', letterSpacing: '.1em', color: m.status === 'live' ? '#4a9e6b' : '#c9a96e', textTransform: 'uppercase' }}>
                        {m.status === 'live' ? 'Live' : 'Config'}
                      </div>
                    </div>
                    <div style={{ fontSize: '.65rem', color: '#e8d5b7', marginBottom: '.3rem', lineHeight: 1.3 }}>{m.module}</div>
                    <div style={{ fontSize: '.55rem', color: 'rgba(232,213,183,.3)', lineHeight: 1.5 }}>{m.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
