'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';

// One bell, both audiences. The RLS policies do the filtering — a client
// literally cannot select an admin-audience row, so the same query is safe on
// both surfaces and there is no client-side "am I an admin" check to get wrong.

export type Notification = {
  id: string;
  audience: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  severity: 'info' | 'success' | 'warning' | 'critical';
  read_at: string | null;
  created_at: string;
};

const SEVERITY: Record<string, { dot: string; label: string }> = {
  info:     { dot: '#8ab4d8', label: 'Info' },
  success:  { dot: '#4a9e6b', label: 'Done' },
  warning:  { dot: '#e0b470', label: 'Needs action' },
  critical: { dot: '#e07070', label: 'Urgent' },
};

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationBell({
  audience,
  tone = 'dark',
}: {
  audience: 'admin' | 'client';
  tone?: 'dark' | 'admin';
}) {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const gold = '#c9a96e';

  const getSb = useCallback(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createBrowserClient(url, key);
  }, []);

  const load = useCallback(async () => {
    const sb = getSb();
    if (!sb) { setLoading(false); return; }
    try {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { setItems([]); setLoading(false); return; }

      const { data, error } = await sb
        .from('notifications')
        .select('id,audience,kind,title,body,link,severity,read_at,created_at')
        .eq('audience', audience)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) {
        console.error('[bell] load:', error.message);
        setItems([]);
      } else {
        setItems((data || []) as Notification[]);
      }
    } catch (e) {
      console.error('[bell] threw:', e);
    } finally {
      setLoading(false);
    }
  }, [audience, getSb]);

  useEffect(() => { load(); }, [load]);

  // Poll rather than subscribe. Realtime needs the publication enabling on the
  // table; polling every 60s is enough for a manual-settlement workflow and has
  // no setup that can silently be missing.
  useEffect(() => {
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  // Close on outside click, so the panel does not sit over the page.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const unread = items.filter(i => !i.read_at);

  const markRead = async (ids: string[]) => {
    if (!ids.length) return;
    const sb = getSb();
    if (!sb) return;
    const now = new Date().toISOString();
    // Optimistic, but the error is still checked — an RLS refusal here would
    // otherwise show as "read" and silently come back on the next poll.
    setItems(prev => prev.map(i => (ids.includes(i.id) ? { ...i, read_at: now } : i)));
    const { error } = await sb.from('notifications').update({ read_at: now }).in('id', ids);
    if (error) {
      console.error('[bell] markRead:', error.message);
      load();
    }
  };

  const panelBg = tone === 'admin' ? 'var(--dark, #0f0d0a)' : '#0f0d0a';
  const border = tone === 'admin' ? 'var(--border, rgba(201,169,110,.15))' : 'rgba(201,169,110,.15)';

  return (
    <div style={{ position: 'relative' }} ref={panelRef}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Notifications"
        aria-label={`Notifications${unread.length ? `, ${unread.length} unread` : ''}`}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer', padding: '.35rem',
          display: 'flex', alignItems: 'center', color: gold, position: 'relative',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {unread.length > 0 && (
          <span style={{
            position: 'absolute', top: -2, right: -2,
            background: unread.some(u => u.severity === 'critical') ? '#e07070' : gold,
            color: '#0a0906', borderRadius: '50%', minWidth: 16, height: 16,
            fontSize: '.48rem', fontWeight: 700, display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: '0 3px',
            lineHeight: 1, fontFamily: 'Montserrat, sans-serif',
          }}>
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + .6rem)', right: 0, width: 340, maxWidth: '90vw',
          maxHeight: 440, overflowY: 'auto', zIndex: 300,
          background: panelBg, border: `1px solid ${border}`, borderRadius: 6,
          boxShadow: '0 18px 48px rgba(0,0,0,.55)', fontFamily: 'Montserrat, sans-serif',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '.8rem 1rem', borderBottom: `1px solid ${border}`, position: 'sticky', top: 0,
            background: panelBg,
          }}>
            <span style={{ fontSize: '.58rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(240,232,216,.45)' }}>
              Notifications{unread.length ? ` · ${unread.length} new` : ''}
            </span>
            {unread.length > 0 && (
              <button
                onClick={() => markRead(unread.map(u => u.id))}
                style={{ background: 'none', border: 'none', color: gold, cursor: 'pointer', fontSize: '.58rem', fontFamily: 'Montserrat, sans-serif' }}
              >
                Mark all read
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', fontSize: '.68rem', color: 'rgba(232,213,183,.3)' }}>Loading…</div>
          ) : items.length === 0 ? (
            <div style={{ padding: '2.2rem 1rem', textAlign: 'center', fontSize: '.7rem', color: 'rgba(232,213,183,.3)', lineHeight: 1.7 }}>
              Nothing yet.<br />
              <span style={{ fontSize: '.62rem', opacity: .7 }}>
                {audience === 'admin'
                  ? 'Payments needing review will appear here.'
                  : 'Updates about your projects will appear here.'}
              </span>
            </div>
          ) : (
            items.map(n => {
              const sev = SEVERITY[n.severity] || SEVERITY.info;
              const body = (
                <div style={{
                  padding: '.8rem 1rem',
                  borderBottom: `1px solid ${border}`,
                  background: n.read_at ? 'transparent' : 'rgba(201,169,110,.045)',
                  display: 'flex', gap: '.6rem', alignItems: 'flex-start',
                }}>
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%', background: sev.dot,
                    marginTop: 5, flexShrink: 0, opacity: n.read_at ? .35 : 1,
                  }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '.72rem', color: '#f0e8d8', lineHeight: 1.4, marginBottom: '.2rem' }}>
                      {n.title}
                    </div>
                    {n.body && (
                      <div style={{ fontSize: '.65rem', color: 'rgba(232,213,183,.45)', lineHeight: 1.6 }}>
                        {n.body}
                      </div>
                    )}
                    <div style={{ fontSize: '.55rem', color: 'rgba(232,213,183,.22)', marginTop: '.35rem' }}>
                      {timeAgo(n.created_at)}
                    </div>
                  </div>
                </div>
              );

              return n.link ? (
                <Link
                  key={n.id}
                  href={n.link}
                  onClick={() => { markRead([n.id]); setOpen(false); }}
                  style={{ textDecoration: 'none', display: 'block' }}
                >
                  {body}
                </Link>
              ) : (
                <div key={n.id} onClick={() => markRead([n.id])} style={{ cursor: 'default' }}>
                  {body}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
