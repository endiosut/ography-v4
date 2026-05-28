'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CartIcon } from '@/context/CartContext';

const ADMIN_EMAIL = 'endiosut.eo@gmail.com';
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type NavUser = { email: string; full_name?: string; avatar_url?: string } | null;

interface NavBarProps {
  /** Pre-pass user if parent already fetched it; otherwise NavBar fetches itself */
  user?: NavUser;
  onSignOut?: () => void;
}

export default function NavBar({ user: userProp, onSignOut }: NavBarProps) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<NavUser>(userProp ?? null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Scroll listener — compress nav after 30px
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fetch auth only if not provided by parent
  useEffect(() => {
    if (userProp !== undefined) return;
    (async () => {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const sb = createClient(SB_URL, SB_ANON);
        const { data: { user: u } } = await sb.auth.getUser();
        if (u) setUser({ email: u.email || '', full_name: u.user_metadata?.full_name || u.user_metadata?.name, avatar_url: u.user_metadata?.avatar_url });
      } catch {}
    })();
  }, [userProp]);

  const handleSignOut = async () => {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const sb = createClient(SB_URL, SB_ANON);
      await sb.auth.signOut();
      setUser(null);
      setProfileOpen(false);
      onSignOut?.();
    } catch {}
  };

  const isAdmin = user?.email === ADMIN_EMAIL;
  const isActive = (href: string) => pathname === href || (href !== '/' && pathname.startsWith(href));

  const linkStyle = (href: string): React.CSSProperties => ({
    fontSize: '.62rem',
    letterSpacing: '.15em',
    textTransform: 'uppercase',
    color: isActive(href) ? '#c9a96e' : 'rgba(201,169,110,.45)',
    textDecoration: 'none',
    borderBottom: isActive(href) ? '1px solid rgba(201,169,110,.45)' : '1px solid transparent',
    paddingBottom: 2,
    transition: 'color .2s, border-color .2s',
  });

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || '?';

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      padding: scrolled ? '.45rem 4rem' : '.65rem 4rem',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: scrolled ? 'rgba(10,9,6,.52)' : 'rgba(10,9,6,.96)',
      backdropFilter: scrolled ? 'blur(32px)' : 'blur(20px)',
      borderBottom: '1px solid rgba(201,169,110,.18)',
      transition: 'all 0.35s cubic-bezier(0.16,1,0.3,1)',
    }}>
      <Link href="/" style={{ textDecoration: 'none', lineHeight: 0 }}>
        <img
          src="/logo.svg"
          alt="OGraphy"
          style={{
            width: scrolled ? 118 : 148,
            height: 'auto',
            objectFit: 'contain',
            opacity: scrolled ? 0.75 : 1,
            transition: 'all 0.35s cubic-bezier(0.16,1,0.3,1)',
          }}
        />
      </Link>

      <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
        <Link href="/catalog" style={linkStyle('/catalog')}>Services</Link>
        <Link href="/ai-studio" style={linkStyle('/ai-studio')}>AI Studio</Link>
        <Link href="/contact" style={linkStyle('/contact')}>Contact</Link>

        {/* Auth-aware right section */}
        {!user ? (
          <Link href="/login" style={{ fontSize: '.62rem', letterSpacing: '.12em', textTransform: 'uppercase', background: '#c9a96e', color: '#0a0906', padding: '.38rem .9rem', textDecoration: 'none', fontWeight: 500 }}>
            Sign In
          </Link>
        ) : isAdmin ? (
          <Link href="/admin" style={linkStyle('/admin')}>Studio</Link>
        ) : (
          <Link href="/portal" style={linkStyle('/portal')}>Portal</Link>
        )}

        <CartIcon />

        {/* Profile avatar (when logged in) */}
        {user && (
          <div ref={profileRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setProfileOpen(o => !o)}
              style={{
                width: 30, height: 30, borderRadius: '50%',
                background: user.avatar_url ? 'transparent' : 'rgba(201,169,110,.12)',
                border: '1px solid rgba(201,169,110,.3)',
                cursor: 'pointer', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#c9a96e', fontSize: '.58rem', fontWeight: 500,
              }}
            >
              {user.avatar_url
                ? <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initials}
            </button>
            {profileOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                background: '#0f0d0a', border: '1px solid rgba(201,169,110,.15)',
                minWidth: 200, zIndex: 200, padding: '.75rem 0',
              }}>
                <div style={{ padding: '.5rem 1.25rem 1rem', borderBottom: '1px solid rgba(201,169,110,.08)' }}>
                  <div style={{ fontSize: '.72rem', color: '#e8d5b7', marginBottom: '.2rem' }}>{user.full_name || 'My Account'}</div>
                  <div style={{ fontSize: '.6rem', color: 'rgba(232,213,183,.35)' }}>{user.email}</div>
                </div>
                {(isAdmin
                  ? [{ label: 'Admin Dashboard', href: '/admin' }, { label: 'Analytics', href: '/admin/analytics' }]
                  : [{ label: 'My Portal', href: '/portal' }, { label: 'Projects', href: '/portal/ai-studio' }]
                ).map(item => (
                  <Link key={item.label} href={item.href}
                    onClick={() => setProfileOpen(false)}
                    style={{ display: 'block', padding: '.6rem 1.25rem', fontSize: '.68rem', color: 'rgba(232,213,183,.55)', textDecoration: 'none', letterSpacing: '.08em' }}>
                    {item.label}
                  </Link>
                ))}
                <div style={{ borderTop: '1px solid rgba(201,169,110,.08)', marginTop: '.5rem', paddingTop: '.5rem' }}>
                  <button onClick={handleSignOut} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '.6rem 1.25rem', fontSize: '.65rem', color: 'rgba(224,112,112,.6)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '.08em', fontFamily: 'Montserrat, sans-serif' }}>
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
