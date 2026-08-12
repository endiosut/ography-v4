'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import NavBar from '@/components/NavBar';

// NOTE: force-dynamic lives in ./layout.tsx — route segment config is ignored
// in 'use client' files. See the comment there.

// FIX A (P1, root cause of the empty portal) ────────────────────────────────
// This page previously used `createClient` from '@supabase/supabase-js', which
// reads the session from **localStorage**. Every other auth surface in this app
// — middleware.ts, auth/callback/route.ts and login/page.tsx — uses
// '@supabase/ssr', which reads the session from **cookies**.
//
// Result: after Google OAuth or magic link the code exchange happens
// server-side, so cookies are set and localStorage is never written. Middleware
// saw a valid user and let the request through; this page then found no session
// and rendered the "Sign in to access your portal" screen. Clicking that button
// returned to /login, where middleware saw the user WAS signed in and redirected
// straight back here — an infinite loop with no data and no exit.
//
// That is why testers reported being stuck on /portal.
//
// FIX B — env vars are read inside the factory, never at module scope. Module
// level `process.env.X!` throws at module init if the var is missing and blanks
// the whole route. This bug was fixed in login/page.tsx (cd1671f5) and
// admin/page.tsx (d0e0ede7) but never here.
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error(
      '[portal] Missing Supabase env vars.',
      'URL set:', Boolean(url),
      'ANON set:', Boolean(key)
    );
    throw new Error('Supabase configuration missing');
  }
  return createBrowserClient(url, key);
}

// FIX C — the stage vocabulary must match the database.
// `projects.stage` defaults to 'payment_received' in Postgres, but the old
// STATUS_FLOW keys were lead/confirmed/in_production/review/delivered/completed.
// getStatusIndex('payment_received') returned -1, so the progress bar rendered
// zero filled segments for every real project — the tracker always looked frozen.
// Keys below are the database values. `STAGE_ALIASES` maps legacy strings so
// older rows still resolve instead of falling off the end.
const STATUS_FLOW = [
  { key: 'payment_received', label: 'Payment Received', icon: '📥', color: '#6b6355' },
  { key: 'brief_submitted',  label: 'Brief Received',   icon: '📝', color: '#4a7a9e' },
  { key: 'in_production',    label: 'In Production',    icon: '⚡', color: '#c9a96e' },
  { key: 'review',           label: 'Under Review',     icon: '🔍', color: '#9e7a4a' },
  { key: 'delivered',        label: 'Delivered',        icon: '📦', color: '#4a9e6b' },
  { key: 'completed',        label: 'Completed',        icon: '🏆', color: '#c9a96e' },
];

const STAGE_ALIASES: Record<string, string> = {
  lead: 'payment_received',
  confirmed: 'brief_submitted',
  brief: 'brief_submitted',
  production: 'in_production',
  qa: 'review',
  client_review: 'review',
  complete: 'completed',
};

function normaliseStage(raw?: string | null): string {
  const s = (raw || '').trim();
  if (!s) return STATUS_FLOW[0].key;
  if (STATUS_FLOW.some(f => f.key === s)) return s;
  return STAGE_ALIASES[s] || STATUS_FLOW[0].key;
}

type Project = {
  id: string;
  project_ref?: string | null;
  service_name?: string;
  stage?: string;
  created_at: string;
  updated_at: string;
  deadline?: string | null;
  delivered_at?: string | null;
  total_amount_usd?: number | null;
  deposit_paid_usd?: number | null;
  balance_due_usd?: number | null;
  notes?: string;
};

// FIX D — deliverables live in their own table keyed on project_id.
// There is no `projects.deliverable_url` column; the old code read one and the
// Download button therefore never appeared, even after delivery.
type Deliverable = {
  id: string;
  project_id: string;
  file_name: string | null;
  file_url: string | null;
  version: number | null;
  is_final: boolean | null;
};

type Payment = {
  id: string;
  project_id: string | null;
  amount_usd: number | null;
  status: string | null;
  paid_at: string | null;
  receipt_url: string | null;
};

type Client = {
  id: string;
  name: string;
  email: string;
  company?: string;
  status: string;
};

type CatalogCount = { count: number };

export default function PortalPage() {
  const [user, setUser] = useState<{ email: string; name?: string; avatar?: string } | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [catalogCount, setCatalogCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'projects' | 'purchases' | 'settings'>('projects');
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const sb = getSupabase();

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

        // FIX E — resolve the client row by user_id first (the canonical join,
        // now maintained by the on_auth_user_created_link_client trigger), and
        // fall back to email only for legacy rows that predate the backfill.
        // The old code used .eq('email', …).single(); `.single()` ERRORS on zero
        // rows and on duplicates, and this table contains duplicate/junk emails.
        // `.maybeSingle()` returns null instead of throwing.
        const [catalogRes, byUserId] = await Promise.all([
          sb.from('catalog_items').select('id', { count: 'exact', head: true }).eq('is_active', true),
          sb.from('clients').select('*').eq('user_id', u.id).limit(1).maybeSingle(),
        ]);

        setCatalogCount(catalogRes.count || 0);

        let clientRow = byUserId.data;
        if (byUserId.error) console.error('[portal] client lookup by user_id:', byUserId.error.message);

        if (!clientRow && u.email) {
          const byEmail = await sb
            .from('clients').select('*').eq('email', u.email).limit(1).maybeSingle();
          if (byEmail.error) console.error('[portal] client lookup by email:', byEmail.error.message);
          clientRow = byEmail.data;
        }

        if (!clientRow) {
          setLoading(false);
          return; // renders the explicit "being reviewed" state, not a blank page
        }

        setClient(clientRow);

        const { data: projectData, error: projErr } = await sb
          .from('projects')
          .select('*')
          .eq('client_id', clientRow.id)
          .order('created_at', { ascending: false });
        if (projErr) console.error('[portal] projects:', projErr.message);

        const rows = projectData || [];
        setProjects(rows);

        // FIX D (cont.) — pull deliverables and payments for the caller's
        // projects. Neither was ever fetched, so the portal could not show a
        // download link, a payment status, or a balance.
        const ids = rows.map(r => r.id);
        if (ids.length) {
          const [delRes, payRes] = await Promise.all([
            sb.from('deliverables').select('*').in('project_id', ids).order('version', { ascending: false }),
            sb.from('payments').select('*').in('project_id', ids).order('created_at', { ascending: false }),
          ]);
          if (delRes.error) console.error('[portal] deliverables:', delRes.error.message);
          if (payRes.error) console.error('[portal] payments:', payRes.error.message);
          setDeliverables(delRes.data || []);
          setPayments(payRes.data || []);
        }
      } catch (e) {
        console.error('[portal] init failed:', e);
        setAuthError(true);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleSignOut = async () => {
    try {
      const sb = getSupabase();
      await sb.auth.signOut();
    } catch (e) {
      console.error('[portal] sign-out failed:', e);
    } finally {
      // Full reload is correct here: it clears all client caches after signOut.
      window.location.assign('/');
    }
  };

  const getStatusIndex = (stage?: string) =>
    STATUS_FLOW.findIndex(s => s.key === normaliseStage(stage));

  const getStatusInfo = (stage?: string) =>
    STATUS_FLOW.find(s => s.key === normaliseStage(stage)) || STATUS_FLOW[0];

  const deliverablesFor = (projectId: string) =>
    deliverables.filter(d => d.project_id === projectId);

  const paymentFor = (projectId: string) =>
    payments.find(p => p.project_id === projectId) || null;

  const money = (n?: number | null) =>
    n == null ? null : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  const isDone = (p: Project) => ['completed', 'delivered'].includes(normaliseStage(p.stage));
  const activeProjects = projects.filter(p => !isDone(p)).length;
  const completedProjects = projects.filter(p => isDone(p)).length;

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

  // FIX F (P1) — this screen used to be a dead end.
  // It offered only "Sign In →", which sent the user to /login, where middleware
  // saw them as already authenticated and redirected them straight back here.
  // Testers had no way out of the loop without being told verbally to type the
  // homepage URL. Every exit below is now explicit: home, catalog, contact, and
  // a real sign-out that clears the session so /login is reachable again.
  if (authError || !user) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0906', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Montserrat, sans-serif', padding: '2rem' }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <img src="/logo.svg" alt="OGraphy — back to homepage" style={{ width: 140, height: 'auto', display: 'block', margin: '0 auto 2rem' }} />
          </Link>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.4rem', color: '#f0e8d8', marginBottom: '.75rem', fontWeight: 300 }}>
            We couldn&apos;t load your session
          </div>
          <div style={{ fontSize: '.75rem', color: 'rgba(232,213,183,.4)', lineHeight: 1.7, marginBottom: '2rem' }}>
            Your project files, status updates and brief submissions live here. Sign in
            again to reach them — or head back to the site.
          </div>

          <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '2rem' }}>
            <button
              onClick={handleSignOut}
              style={{ background: '#c9a96e', color: '#0a0906', padding: '.9rem 2rem', fontSize: '.66rem', letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 500, border: 'none', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
            >
              Sign in again →
            </button>
            <Link href="/" style={{ display: 'inline-block', color: '#c9a96e', border: '1px solid rgba(201,169,110,.3)', padding: '.9rem 2rem', fontSize: '.66rem', letterSpacing: '.14em', textTransform: 'uppercase', textDecoration: 'none' }}>
              Back to site
            </Link>
          </div>

          <div style={{ display: 'flex', gap: '1.25rem', justifyContent: 'center', fontSize: '.6rem', letterSpacing: '.08em' }}>
            <Link href="/catalog" style={{ color: 'rgba(201,169,110,.45)', textDecoration: 'none' }}>Catalog</Link>
            <Link href="/contact" style={{ color: 'rgba(201,169,110,.45)', textDecoration: 'none' }}>Start a project</Link>
            <a href="mailto:ographyy@gmail.com" style={{ color: 'rgba(201,169,110,.45)', textDecoration: 'none' }}>Get help</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0906', fontFamily: 'Montserrat, sans-serif', color: '#e8d5b7' }}>

      <NavBar
        user={{ email: user.email, full_name: user.name, avatar_url: user.avatar }}
        onSignOut={handleSignOut}
      />

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '7rem 3rem 5rem' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: '.5rem', letterSpacing: '.3em', textTransform: 'uppercase', color: 'rgba(201,169,110,.4)', marginBottom: '.5rem' }}>Client Portal</div>
            <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(1.6rem,3vw,2.4rem)', fontWeight: 300, color: '#f0e8d8', lineHeight: 1.2 }}>
              {client
                ? `Welcome back, ${client.name?.split(' ')[0] || user.name?.split(' ')[0] || 'there'}.`
                : `Hello, ${user.name?.split(' ')[0] || user.email.split('@')[0]}.`}
            </h1>
            {client?.company && <div style={{ fontSize: '.7rem', color: 'rgba(232,213,183,.35)', marginTop: '.4rem' }}>{client.company}</div>}
          </div>
          <Link href="/contact" style={{ fontSize: '.6rem', letterSpacing: '.14em', textTransform: 'uppercase', color: '#c9a96e', border: '1px solid rgba(201,169,110,.3)', padding: '.5rem 1.1rem', textDecoration: 'none' }}>
            + New Request
          </Link>
        </div>

        {/* Stats cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2.5rem' }}>
          {[
            { label: 'Active', value: activeProjects },
            { label: 'Completed', value: completedProjects },
            { label: 'Services', value: catalogCount || '—' },
          ].map(stat => (
            <div key={stat.label} style={{ border: '1px solid rgba(201,169,110,.1)', background: '#0f0d0a', padding: '1.25rem', textAlign: 'center', borderRadius: 4 }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2rem', color: '#c9a96e', fontWeight: 300, lineHeight: 1 }}>{stat.value}</div>
              <div style={{ fontSize: '.48rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(232,213,183,.3)', marginTop: '.5rem' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* AI Studio CTA banner */}
        <Link href="/portal/ai-studio" style={{ textDecoration: 'none', display: 'block', marginBottom: '2.5rem' }}>
          <div style={{
            border: '1px solid rgba(201,169,110,.2)', background: 'linear-gradient(135deg, rgba(201,169,110,.04) 0%, rgba(201,169,110,.01) 100%)',
            padding: '1.25rem 1.75rem', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer', transition: 'border-color .2s',
          }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(201,169,110,.4)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(201,169,110,.2)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: 36, height: 36, border: '1px solid rgba(201,169,110,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c9a96e" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="3"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2m-3.5-7.5-1.5 1.5M5 5l1.5 1.5M19 19l-1.5-1.5M5 19l1.5-1.5"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '.65rem', color: '#c9a96e', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '.2rem' }}>Projects</div>
                <div style={{ fontSize: '.75rem', color: 'rgba(232,213,183,.55)', lineHeight: 1.5 }}>Generate briefs, explore aesthetics, get brand guidance</div>
              </div>
            </div>
            <div style={{ fontSize: '.65rem', color: 'rgba(201,169,110,.5)', letterSpacing: '.1em' }}>Open →</div>
          </div>
        </Link>

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

        {/* PROJECTS TAB */}
        {activeTab === 'projects' && (
          <div>
            {!client ? (
              <div style={{ textAlign: 'center', padding: '4rem 2rem', border: '1px solid rgba(201,169,110,.08)' }}>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.3rem', color: '#f0e8d8', marginBottom: '1rem', fontWeight: 300 }}>
                  Your request is being reviewed
                </div>
                <div style={{ fontSize: '.75rem', color: 'rgba(232,213,183,.4)', lineHeight: 1.8, maxWidth: 360, margin: '0 auto 1.5rem' }}>
                  {"We've received your submission and our team is reviewing it. You'll receive an email with next steps within 24 hours."}
                </div>
                <div style={{ fontSize: '.62rem', color: 'rgba(201,169,110,.4)', letterSpacing: '.1em' }}>
                  Questions? <a href="mailto:ographyy@gmail.com" style={{ color: '#c9a96e', textDecoration: 'none' }}>ographyy@gmail.com</a>
                </div>
              </div>
            ) : projects.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 2rem', border: '1px solid rgba(201,169,110,.08)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '1rem', opacity: 0.2 }}>📁</div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.3rem', color: '#f0e8d8', marginBottom: '1rem', fontWeight: 300 }}>
                  No active projects yet
                </div>
                <div style={{ fontSize: '.75rem', color: 'rgba(232,213,183,.4)', lineHeight: 1.8, maxWidth: 360, margin: '0 auto 1.5rem' }}>
                  Once you submit a brief and we confirm your project, it will appear here with live status updates.
                </div>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <Link href="/contact" style={{ display: 'inline-block', background: '#c9a96e', color: '#0a0906', padding: '.8rem 2rem', fontSize: '.65rem', letterSpacing: '.14em', textTransform: 'uppercase', textDecoration: 'none', fontWeight: 500 }}>
                    Start a Project →
                  </Link>
                  <Link href="/portal/ai-studio" style={{ display: 'inline-block', background: 'transparent', color: '#c9a96e', border: '1px solid rgba(201,169,110,.3)', padding: '.8rem 2rem', fontSize: '.65rem', letterSpacing: '.14em', textTransform: 'uppercase', textDecoration: 'none' }}>
                    Open Projects
                  </Link>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {projects.map(project => {
                  const statusInfo = getStatusInfo(project.stage);
                  const statusIdx = getStatusIndex(project.stage);
                  const files = deliverablesFor(project.id);
                  const payment = paymentFor(project.id);
                  const balance = project.balance_due_usd;
                  return (
                    <div key={project.id} style={{ border: '1px solid rgba(201,169,110,.1)', background: '#0f0d0a', padding: '2rem', borderRadius: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                        <div>
                          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.2rem', color: '#f0e8d8', fontWeight: 300, marginBottom: '.3rem' }}>
                            {project.service_name || 'OGraphy Project'}
                          </div>
                          {/* FIX G — project_ref, deadline and last-updated were
                              never rendered. Without them the tracker gives the
                              client nothing to quote back and no sense of motion. */}
                          <div style={{ fontSize: '.58rem', color: 'rgba(232,213,183,.3)', letterSpacing: '.08em', display: 'flex', gap: '.9rem', flexWrap: 'wrap' }}>
                            {project.project_ref && (
                              <span style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'rgba(201,169,110,.55)' }}>{project.project_ref}</span>
                            )}
                            <span>
                              {new Date(project.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </span>
                            {project.deadline && (
                              <span style={{ color: 'rgba(201,169,110,.5)' }}>
                                Due {new Date(project.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                            {project.updated_at && (
                              <span>Updated {new Date(project.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            )}
                          </div>
                        </div>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '.5rem',
                          background: 'rgba(201,169,110,.06)', border: `1px solid ${statusInfo.color}33`,
                          padding: '.35rem .85rem', borderRadius: 20,
                        }}>
                          <span style={{ fontSize: '.8rem' }}>{statusInfo.icon}</span>
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

                      {/* FIX H — payment state was never surfaced. A client
                          could not see what they had paid or what was owed. */}
                      {(payment || project.total_amount_usd != null) && (
                        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '.62rem', borderTop: '1px solid rgba(201,169,110,.06)', paddingTop: '.85rem', marginBottom: '1rem' }}>
                          {project.total_amount_usd != null && (
                            <span style={{ color: 'rgba(232,213,183,.45)' }}>
                              Total <strong style={{ color: '#e8d5b7', fontWeight: 500 }}>{money(project.total_amount_usd)}</strong>
                            </span>
                          )}
                          {balance != null && balance > 0 && (
                            <span style={{ color: 'rgba(224,180,112,.85)' }}>
                              Balance due <strong style={{ fontWeight: 500 }}>{money(balance)}</strong>
                            </span>
                          )}
                          {payment?.status && (
                            <span style={{
                              letterSpacing: '.1em', textTransform: 'uppercase', fontSize: '.55rem',
                              color: payment.status === 'paid' ? '#4a9e6b' : 'rgba(232,213,183,.4)',
                              border: `1px solid ${payment.status === 'paid' ? 'rgba(74,158,107,.3)' : 'rgba(201,169,110,.15)'}`,
                              padding: '.25rem .6rem', borderRadius: 12,
                            }}>
                              {payment.status}
                            </span>
                          )}
                          {payment?.receipt_url && (
                            <a href={payment.receipt_url} target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(201,169,110,.6)', fontSize: '.58rem', textDecoration: 'none', letterSpacing: '.08em' }}>
                              Receipt ↗
                            </a>
                          )}
                        </div>
                      )}

                      {project.notes && (
                        <div style={{ fontSize: '.7rem', color: 'rgba(232,213,183,.35)', lineHeight: 1.7, marginBottom: '1rem', borderTop: '1px solid rgba(201,169,110,.06)', paddingTop: '.75rem' }}>
                          {project.notes.slice(0, 120)}{project.notes.length > 120 ? '…' : ''}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        {/* FIX D (cont.) — read from the `deliverables` table.
                            The old code read project.deliverable_url, a column
                            that does not exist, so this button never appeared. */}
                        {files.length > 0 ? (
                          files.map(f => (
                            <a
                              key={f.id}
                              href={f.file_url || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ display: 'inline-block', background: f.is_final ? '#c9a96e' : 'transparent', color: f.is_final ? '#0a0906' : '#c9a96e', border: f.is_final ? 'none' : '1px solid rgba(201,169,110,.3)', padding: '.65rem 1.5rem', fontSize: '.6rem', letterSpacing: '.12em', textTransform: 'uppercase', textDecoration: 'none', fontWeight: 500 }}
                            >
                              {f.file_name || 'Download'}{f.version && f.version > 1 ? ` v${f.version}` : ''} →
                            </a>
                          ))
                        ) : normaliseStage(project.stage) === 'delivered' ? (
                          <span style={{ fontSize: '.6rem', color: 'rgba(232,213,183,.3)', letterSpacing: '.08em' }}>
                            Files are being prepared for release.
                          </span>
                        ) : null}
                        {['in_production', 'review'].includes(normaliseStage(project.stage)) && (
                          <Link href="/portal/ai-studio" style={{ display: 'inline-block', color: '#c9a96e', border: '1px solid rgba(201,169,110,.25)', padding: '.65rem 1.2rem', fontSize: '.58rem', letterSpacing: '.1em', textTransform: 'uppercase', textDecoration: 'none' }}>
                            Ask AI Assistant
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* PURCHASES TAB */}
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
                  projects.map(p => {
                    const effectiveStatus = normaliseStage(p.stage);
                    return (
                      <div key={p.id} style={{ borderBottom: '1px solid rgba(201,169,110,.06)', padding: '.9rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '.78rem', color: '#e8d5b7' }}>{p.service_name || 'Project'}</div>
                          <div style={{ fontSize: '.6rem', color: 'rgba(232,213,183,.3)', marginTop: '.2rem' }}>
                            {new Date(p.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div style={{ fontSize: '.58rem', color: getStatusInfo(effectiveStatus).color, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                          {getStatusInfo(effectiveStatus).label}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div style={{ padding: '2rem', fontSize: '.75rem', color: 'rgba(232,213,183,.3)', textAlign: 'center' }}>
                No account record found. Contact <a href="mailto:ographyy@gmail.com" style={{ color: '#c9a96e', textDecoration: 'none' }}>ographyy@gmail.com</a> to link your account.
              </div>
            )}
          </div>
        )}

        {/* SETTINGS TAB */}
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
