'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

// ─────────────────────────────────────────────────────────────────
//  OGraphy V4 — Client Portal
//  File: src/app/portal/page.tsx
//
//  Status tracking flow:
//  lead → confirmed → in_production → review → delivered → completed
//  
//  Client sees: real-time status of every project
//  Admin signals progress by updating `status` field in Supabase projects table
//  Client is notified by n8n webhook when status changes
// ─────────────────────────────────────────────────────────────────

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const STATUS_FLOW = [
  { key: 'lead', label: 'Request Received', icon: '📥', color: '#6b6355' },
  { key: 'confirmed', label: 'Confirmed', icon: '✅', color: '#4a7a9e' },
  { key: 'in_production', label: 'In Production', icon: '⚡', color: '#c9a96e' },
  { key: 'review', label: 'Under Review', icon: '🔍', color: '#9e7a4a' },
  { key: 'delivered', label: 'Delivered', icon: '📦', color: '#4a9e6b' },
  { key: 'completed', label: 'Completed', icon: '🏆', color: '#c9a96e' },
];

type Project = {
  id: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
  notes?: string;
  service?: string;
  deliverable_url?: string;
};

type Client = {
  id: string;
  name: string;
  email: string;
  company?: string;
  status: string;
};

export default function PortalPage() {
  const [user, setUser] = useState<{ email: string; name?: string; avatar?: string } | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'projects' | 'purchases' | 'settings'>('projects');
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const sb = createClient(SB_URL, SB_ANON);

        // Get session
        const { data: { user: u } } = await sb.auth.getUser();
        if (!u) {
          setAuthError(true);
          setLoading(false);
          return;
        }

        setUser({
          email: u.email || '',
          name: u.user_metadata?.full_name || u.user_metadata?.name,
          avatar: u.user_metadata?.avatar_url,
        });

        // Find client record by email
        const { data: clientData } = await sb
          .from('clients')
          .select('*')
          .eq('email', u.email)
          .single();

        if (clientData) {
          setClient(clientData);

          // Fetch projects linked to this client
          const { data: projectData } = await sb
            .from('projects')
            .select('*')
            .eq('client_id', clientData.id)
            .order('created_at', { ascending: false });

          setProjects(projectData || []);
        }
      } catch (e) {
        console.error('Portal error:', e);
        setAuthError(true);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleSignOut = async () => {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(SB_URL, SB_ANON);
    await sb.auth.signOut();
    window.location.href = '/login';
  };

  const getStatusIndex = (status: string) =>
    STATUS_FLOW.findIndex(s => s.key === status);

  const getStatusInfo = (status: string) =>
    STATUS_FLOW.find(s => s.key === status) || STATUS_FLOW[0];

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || '?';

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0906', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Montserrat, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <img src="/logo.svg" alt="OGraphy" style={{ width: 120, marginBottom: '1.5rem', opacity: 0.6, animation: 'pulse 1.5s infinite' }} />
          <div style={{ fontSize: '.6rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(201,169,110,.3)' }}>Loading your portal...</div>
        </div>
        <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.8} }`}</style>
      </div>
    );
  }

  if (authError || !user) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0906', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Montserrat, sans-serif' }}>
        <div style={{ textAlign: 'center', maxWidth: 380 }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <img src="/logo.svg" alt="OGraphy" style={{ width: 140, height: 'auto', marginBottom: '2rem', display: 'block', margin: '0 auto 2rem' }} />
          </Link>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.4rem', color: '#f0e8d8', marginBottom: '.75rem', fontWeight: 300 }}>
            Sign in to access your portal
          </div>
          <div style={{ fontSize: '.75rem', color: 'rgba(232,213,183,.4)', lineHeight: 1.7, marginBottom: '2rem' }}>
            Your project files, status updates, and brief submissions are here.
          </div>
          <Link href="/login" style={{ display: 'inline-block', background: '#c9a96e', color: '#0a0906', padding: '.9rem 2.2rem', fontSize: '.68rem', letterSpacing: '.14em', textTransform: 'uppercase', textDecoration: 'none', fontWeight: 500 }}>
            Sign In →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0906', fontFamily: 'Montserrat, sans-serif', color: '#e8d5b7' }}>

      {/* Nav */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: '.6rem 3rem', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', background: 'rgba(10,9,6,.97)',
        backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(201,169,110,.12)',
      }}>
        {/* Logo — fixed size, links to catalog */}
        <Link href="/catalog" style={{ textDecoration: 'none' }}>
          <img src="/logo.svg" alt="OGraphy" style={{ width: 148, height: 'auto', display: 'block' }} />
        </Link>

        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <Link href="/catalog" style={{ fontSize: '.6rem', letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(201,169,110,.4)', textDecoration: 'none' }}>
            Add Services
          </Link>
          {/* User avatar + signout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: user.avatar ? 'transparent' : 'rgba(201,169,110,.12)',
              border: '1px solid rgba(201,169,110,.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', fontSize: '.65rem', color: '#c9a96e', fontWeight: 500,
            }}>
              {user.avatar
                ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initials
              }
            </div>
            <div style={{ fontSize: '.6rem', color: 'rgba(232,213,183,.35)' }}>
              {user.name || user.email.split('@')[0]}
            </div>
            <button
              onClick={handleSignOut}
              style={{ fontSize: '.58rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(232,213,183,.2)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif' }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '7rem 3rem 5rem' }}>

        {/* Header */}
        <div style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: '.5rem', letterSpacing: '.3em', textTransform: 'uppercase', color: 'rgba(201,169,110,.4)', marginBottom: '.5rem' }}>Client Portal</div>
            <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(1.6rem,3vw,2.4rem)', fontWeight: 300, color: '#f0e8d8', lineHeight: 1.2 }}>
              {client ? `Welcome back, ${client.name?.split(' ')[0] || user.name?.split(' ')[0] || 'there'}.` : `Hello, ${user.name?.split(' ')[0] || user.email.split('@')[0]}.`}
            </h1>
            {client?.company && <div style={{ fontSize: '.7rem', color: 'rgba(232,213,183,.35)', marginTop: '.4rem' }}>{client.company}</div>}
          </div>
          <Link href="/contact" style={{ fontSize: '.6rem', letterSpacing: '.14em', textTransform: 'uppercase', color: '#c9a96e', border: '1px solid rgba(201,169,110,.3)', padding: '.5rem 1.1rem', textDecoration: 'none' }}>
            + New Request
          </Link>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(201,169,110,.08)', marginBottom: '2.5rem' }}>
          {[
            { key: 'projects', label: 'Active Projects' },
            { key: 'purchases', label: 'All Requests' },
            { key: 'settings', label: 'Account' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                padding: '.75rem 1.5rem', border: 'none', background: 'transparent',
                fontFamily: 'Montserrat, sans-serif', fontSize: '.6rem',
                letterSpacing: '.12em', textTransform: 'uppercase', cursor: 'pointer',
                color: activeTab === tab.key ? '#c9a96e' : 'rgba(232,213,183,.3)',
                borderBottom: `1px solid ${activeTab === tab.key ? '#c9a96e' : 'transparent'}`,
                marginBottom: -1,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── PROJECTS TAB ── */}
        {activeTab === 'projects' && (
          <div>
            {!client ? (
              /* No client record yet — they submitted but not processed */
              <div style={{ textAlign: 'center', padding: '4rem 2rem', border: '1px solid rgba(201,169,110,.08)' }}>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.3rem', color: '#f0e8d8', marginBottom: '1rem', fontWeight: 300 }}>
                  Your request is being reviewed
                </div>
                <div style={{ fontSize: '.75rem', color: 'rgba(232,213,183,.4)', lineHeight: 1.8, maxWidth: 360, margin: '0 auto 1.5rem' }}>
                  We've received your submission and our team is reviewing it. You'll receive an email with next steps within 24 hours.
                </div>
                <div style={{ fontSize: '.62rem', color: 'rgba(201,169,110,.4)', letterSpacing: '.1em' }}>
                  Questions? <a href="mailto:ographyy@gmail.com" style={{ color: '#c9a96e', textDecoration: 'none' }}>ographyy@gmail.com</a>
                </div>
              </div>
            ) : projects.length === 0 ? (
              /* Client exists but no projects assigned yet */
              <div style={{ textAlign: 'center', padding: '4rem 2rem', border: '1px solid rgba(201,169,110,.08)' }}>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.3rem', color: '#f0e8d8', marginBottom: '1rem', fontWeight: 300 }}>
                  No active projects yet
                </div>
                <div style={{ fontSize: '.75rem', color: 'rgba(232,213,183,.4)', lineHeight: 1.8, maxWidth: 360, margin: '0 auto 1.5rem' }}>
                  Once you submit a brief and we confirm your project, it will appear here with live status updates.
                </div>
                <Link href="/contact" style={{ display: 'inline-block', background: '#c9a96e', color: '#0a0906', padding: '.8rem 2rem', fontSize: '.65rem', letterSpacing: '.14em', textTransform: 'uppercase', textDecoration: 'none', fontWeight: 500 }}>
                  Start a Project →
                </Link>
              </div>
            ) : (
              /* Projects with status tracker */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {projects.map(project => {
                  const statusInfo = getStatusInfo(project.status);
                  const statusIdx = getStatusIndex(project.status);
                  return (
                    <div key={project.id} style={{ border: '1px solid rgba(201,169,110,.1)', background: '#0f0d0a', padding: '2rem', borderRadius: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                        <div>
                          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.2rem', color: '#f0e8d8', fontWeight: 300, marginBottom: '.3rem' }}>
                            {project.name || project.service || 'OGraphy Project'}
                          </div>
                          <div style={{ fontSize: '.58rem', color: 'rgba(232,213,183,.3)', letterSpacing: '.08em' }}>
                            {new Date(project.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </div>
                        </div>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '.5rem',
                          background: 'rgba(201,169,110,.06)', border: `1px solid ${statusInfo.color}33`,
                          padding: '.35rem .85rem', borderRadius: 20,
                        }}>
                          <span>{statusInfo.icon}</span>
                          <span style={{ fontSize: '.58rem', letterSpacing: '.1em', textTransform: 'uppercase', color: statusInfo.color }}>
                            {statusInfo.label}
                          </span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div style={{ marginBottom: '1.25rem' }}>
                        <div style={{ display: 'flex', gap: 0, marginBottom: '.75rem' }}>
                          {STATUS_FLOW.map((s, i) => (
                            <div key={s.key} style={{ flex: 1, height: 3, background: i <= statusIdx ? '#c9a96e' : 'rgba(201,169,110,.1)', transition: 'background .3s', marginRight: i < STATUS_FLOW.length - 1 ? 2 : 0, borderRadius: 2 }} />
                          ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.46rem', color: 'rgba(232,213,183,.2)', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                          <span>Received</span>
                          <span>In Production</span>
                          <span>Complete</span>
                        </div>
                      </div>

                      {project.notes && (
                        <div style={{ fontSize: '.7rem', color: 'rgba(232,213,183,.35)', lineHeight: 1.7, marginBottom: '1rem', borderTop: '1px solid rgba(201,169,110,.06)', paddingTop: '.75rem' }}>
                          {project.notes.slice(0, 120)}{project.notes.length > 120 ? '…' : ''}
                        </div>
                      )}

                      {project.deliverable_url && (
                        <a
                          href={project.deliverable_url}
                          style={{ display: 'inline-block', background: '#c9a96e', color: '#0a0906', padding: '.65rem 1.5rem', fontSize: '.6rem', letterSpacing: '.12em', textTransform: 'uppercase', textDecoration: 'none', fontWeight: 500 }}
                        >
                          Download Files →
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── PURCHASES TAB ── */}
        {activeTab === 'purchases' && (
          <div>
            {client ? (
              <div>
                <div style={{ fontSize: '.65rem', color: 'rgba(232,213,183,.3)', marginBottom: '1.5rem', letterSpacing: '.06em' }}>
                  All requests associated with {client.email}
                </div>
                {projects.length === 0 ? (
                  <div style={{ padding: '2rem', border: '1px solid rgba(201,169,110,.08)', textAlign: 'center', fontSize: '.75rem', color: 'rgba(232,213,183,.3)' }}>
                    No requests yet.
                  </div>
                ) : (
                  projects.map(p => (
                    <div key={p.id} style={{ borderBottom: '1px solid rgba(201,169,110,.06)', padding: '.9rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '.78rem', color: '#e8d5b7' }}>{p.name || p.service || 'Project'}</div>
                        <div style={{ fontSize: '.6rem', color: 'rgba(232,213,183,.3)', marginTop: '.2rem' }}>
                          {new Date(p.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div style={{ fontSize: '.58rem', color: getStatusInfo(p.status).color, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                        {getStatusInfo(p.status).label}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div style={{ padding: '2rem', fontSize: '.75rem', color: 'rgba(232,213,183,.3)', textAlign: 'center' }}>
                No account record found. Contact <a href="mailto:ographyy@gmail.com" style={{ color: '#c9a96e', textDecoration: 'none' }}>ographyy@gmail.com</a> to link your account.
              </div>
            )}
          </div>
        )}

        {/* ── SETTINGS TAB ── */}
        {activeTab === 'settings' && (
          <div style={{ maxWidth: 500 }}>
            <div style={{ border: '1px solid rgba(201,169,110,.1)', padding: '2rem', background: '#0f0d0a', borderRadius: 6 }}>
              <div style={{ fontSize: '.55rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(201,169,110,.4)', marginBottom: '1.5rem' }}>Account Info</div>
              {[
                ['Name', user.name || '—'],
                ['Email', user.email],
                ['Company', client?.company || '—'],
                ['Account Status', client?.status || 'Pending'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', gap: '1rem', marginBottom: '.75rem', paddingBottom: '.75rem', borderBottom: '1px solid rgba(201,169,110,.06)' }}>
                  <div style={{ fontSize: '.62rem', color: 'rgba(232,213,183,.3)', minWidth: 100, letterSpacing: '.06em' }}>{label}</div>
                  <div style={{ fontSize: '.72rem', color: '#e8d5b7' }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '1.5rem', padding: '1.5rem', border: '1px solid rgba(224,112,112,.1)', background: 'rgba(224,112,112,.02)', borderRadius: 6 }}>
              <div style={{ fontSize: '.62rem', color: 'rgba(224,112,112,.5)', marginBottom: '.75rem', letterSpacing: '.08em' }}>Account Actions</div>
              <button
                onClick={handleSignOut}
                style={{ fontSize: '.62rem', color: 'rgba(224,112,112,.5)', background: 'transparent', border: '1px solid rgba(224,112,112,.2)', padding: '.6rem 1.25rem', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', letterSpacing: '.1em', textTransform: 'uppercase' }}
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(201,169,110,.06)', padding: '2rem 3rem', maxWidth: 1000, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '.58rem', color: 'rgba(232,213,183,.15)' }}>© 2026 OGraphy</div>
        <a href="mailto:ographyy@gmail.com" style={{ fontSize: '.58rem', color: 'rgba(201,169,110,.25)', textDecoration: 'none' }}>ographyy@gmail.com</a>
      </footer>

      <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.8} }`}</style>
    </div>
  );
}
