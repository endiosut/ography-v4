'use client';
import { useState } from 'react';

// ─────────────────────────────────────────────────────────────────
//  OGraphy V4 — Login Page (Client-First Design)
//  File: src/app/login/page.tsx
//
//  DESIGN DECISIONS:
//  - Primary audience: CLIENTS — lands on client portal by default
//  - Google sign-in is the hero CTA (prominent, first)
//  - Magic link email is the secondary CTA for clients
//  - Admin access is hidden at the bottom as a small discreet link
//    (no public invitation — admin navigates to /login#admin directly
//    or clicks the hidden link)
//  - The email placeholder is NOT pre-filled with admin email
//  - After sign-in: clients → /portal, admin email → /admin
//
//  REDIRECT FIX:
//  In Supabase → Authentication → URL Configuration:
//    Site URL: https://ography-v4.vercel.app
//    Add redirect URLs:
//      https://ography-v4.vercel.app/**
//      https://ography-v4.vercel.app/auth/callback
// ─────────────────────────────────────────────────────────────────

const ADMIN_EMAIL = 'endiosut.eo@gmail.com';
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [showAdmin, setShowAdmin] = useState(false);

  const getSupabase = async () => {
    const { createClient } = await import('@supabase/supabase-js');
    return createClient(SB_URL, SB_ANON);
  };

  const handleGoogle = async () => {
    setLoading(true); setError('');
    try {
      const sb = await getSupabase();
      await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
    } catch {
      setError('Google sign-in failed. Try again.');
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email) return;
    setLoading(true); setError('');
    try {
      const sb = await getSupabase();
      const { error: err } = await sb.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (err) throw err;
      setSent(true);
    } catch (e: any) {
      setError(e.message || 'Something went wrong.');
    } finally { setLoading(false); }
  };

  const handleAdminLogin = async () => {
    if (!email || !password) return;
    setLoading(true); setError('');
    try {
      const sb = await getSupabase();
      const { error: err } = await sb.auth.signInWithPassword({ email, password });
      if (err) throw err;
      window.location.href = '/admin';
    } catch {
      setError('Invalid credentials.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0906',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '2rem',
      fontFamily: 'Montserrat, sans-serif',
    }}>
      {/* Logo — floating */}
      <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <img src="/logo.svg" alt="OGraphy" style={{
          width: 160, height: 'auto', display: 'block', margin: '0 auto',
          animation: 'logoFloat 3.5s ease-in-out infinite',
        }} />
      </div>

      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* ── CLIENT PORTAL ACCESS ── */}
        {!showAdmin && !sent && (
          <div style={{
            background: '#0f0d0a', border: '1px solid rgba(201,169,110,.12)',
            padding: '2.5rem',
          }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ fontSize: '.52rem', letterSpacing: '.22em', textTransform: 'uppercase', color: 'rgba(201,169,110,.4)', marginBottom: '.5rem' }}>
                Client Portal
              </div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.4rem', fontWeight: 300, color: '#f0e8d8' }}>
                Access your projects
              </div>
            </div>

            {/* Google — Hero CTA */}
            <button
              onClick={handleGoogle}
              disabled={loading}
              style={{
                width: '100%', padding: '1rem 1.5rem',
                background: '#fff', color: '#1f1f1f',
                border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'Montserrat, sans-serif', fontSize: '.78rem',
                fontWeight: 500, letterSpacing: '.04em',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '.85rem', marginBottom: '1.25rem', transition: 'opacity .2s',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {/* Official Google G logo */}
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '1.25rem' }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(201,169,110,.1)' }} />
              <span style={{ fontSize: '.5rem', color: 'rgba(240,232,216,.2)', letterSpacing: '.1em' }}>OR</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(201,169,110,.1)' }} />
            </div>

            {/* Magic link */}
            <div style={{ marginBottom: '.75rem' }}>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleMagicLink()}
                style={{
                  width: '100%', padding: '.85rem 1.1rem',
                  background: 'rgba(30,26,21,.8)',
                  border: '1px solid rgba(201,169,110,.18)',
                  color: '#f0e8d8', fontFamily: 'Montserrat, sans-serif',
                  fontSize: '.82rem', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            {error && (
              <div style={{ fontSize: '.68rem', color: '#e07070', padding: '.5rem .75rem', background: 'rgba(224,112,112,.06)', border: '1px solid rgba(224,112,112,.15)', marginBottom: '.75rem' }}>
                {error}
              </div>
            )}

            <button
              onClick={handleMagicLink}
              disabled={loading || !email}
              style={{
                width: '100%', padding: '.9rem',
                background: 'transparent', border: '1px solid rgba(201,169,110,.3)',
                color: '#c9a96e', fontFamily: 'Montserrat, sans-serif',
                fontSize: '.68rem', letterSpacing: '.14em', textTransform: 'uppercase',
                cursor: loading || !email ? 'not-allowed' : 'pointer',
                opacity: loading || !email ? 0.5 : 1, transition: 'all .2s',
              }}
            >
              {loading ? '...' : 'Send Sign-In Link'}
            </button>

            <div style={{ marginTop: '1rem', fontSize: '.6rem', color: 'rgba(240,232,216,.25)', textAlign: 'center', lineHeight: 1.6 }}>
              No password needed. We'll email you a secure link.
            </div>

            {/* New client CTA */}
            <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(201,169,110,.06)', textAlign: 'center' }}>
              <a href="/contact" style={{ fontSize: '.62rem', color: 'rgba(201,169,110,.45)', textDecoration: 'none', letterSpacing: '.08em' }}>
                Don't have an account? Start a project →
              </a>
            </div>
          </div>
        )}

        {/* ── MAGIC LINK SENT ── */}
        {sent && (
          <div style={{ background: '#0f0d0a', border: '1px solid rgba(201,169,110,.12)', padding: '2.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1.25rem' }}>✉️</div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.4rem', color: '#f0e8d8', marginBottom: '.75rem', fontWeight: 300 }}>
              Check your inbox
            </div>
            <div style={{ fontSize: '.75rem', color: 'rgba(240,232,216,.4)', lineHeight: 1.8 }}>
              We sent a sign-in link to <br />
              <strong style={{ color: '#c9a96e' }}>{email}</strong>
            </div>
            <div style={{ marginTop: '1rem', fontSize: '.62rem', color: 'rgba(240,232,216,.25)' }}>
              Link expires in 1 hour
            </div>
            <button onClick={() => { setSent(false); setEmail(''); }} style={{ marginTop: '1.5rem', background: 'none', border: 'none', color: 'rgba(201,169,110,.4)', fontSize: '.6rem', cursor: 'pointer', letterSpacing: '.08em' }}>
              Use a different email
            </button>
          </div>
        )}

        {/* ── ADMIN LOGIN (hidden, accessible) ── */}
        {showAdmin && (
          <div style={{ background: '#0f0d0a', border: '1px solid rgba(201,169,110,.12)', padding: '2.5rem' }}>
            <div style={{ fontSize: '.52rem', letterSpacing: '.22em', textTransform: 'uppercase', color: 'rgba(201,169,110,.3)', marginBottom: '1.75rem', textAlign: 'center' }}>
              Studio Access
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input
                type="email"
                placeholder="Admin email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ padding: '.85rem 1.1rem', background: 'rgba(30,26,21,.8)', border: '1px solid rgba(201,169,110,.18)', color: '#f0e8d8', fontFamily: 'Montserrat, sans-serif', fontSize: '.82rem', outline: 'none' }}
              />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
                style={{ padding: '.85rem 1.1rem', background: 'rgba(30,26,21,.8)', border: '1px solid rgba(201,169,110,.18)', color: '#f0e8d8', fontFamily: 'Montserrat, sans-serif', fontSize: '.82rem', outline: 'none' }}
              />
              {error && (
                <div style={{ fontSize: '.68rem', color: '#e07070', padding: '.5rem .75rem', background: 'rgba(224,112,112,.06)' }}>{error}</div>
              )}
              <button onClick={handleAdminLogin} disabled={loading} style={{ padding: '1rem', background: '#c9a96e', color: '#0a0906', border: 'none', cursor: 'pointer', fontFamily: 'Montserrat, sans-serif', fontSize: '.7rem', fontWeight: 500, letterSpacing: '.14em', textTransform: 'uppercase', opacity: loading ? 0.6 : 1 }}>
                {loading ? '...' : 'Enter Studio'}
              </button>
            </div>
            <button onClick={() => setShowAdmin(false)} style={{ display: 'block', margin: '1.25rem auto 0', background: 'none', border: 'none', color: 'rgba(240,232,216,.2)', fontSize: '.58rem', cursor: 'pointer', letterSpacing: '.08em' }}>
              ← Back to client login
            </button>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <div style={{ fontSize: '.52rem', color: 'rgba(240,232,216,.12)', letterSpacing: '.1em', marginBottom: '1rem' }}>
            OGraphy V4 · Studio Platform
          </div>
          {/* Hidden admin link — discreet, not prominently displayed */}
          {!showAdmin && (
            <button
              onClick={() => setShowAdmin(true)}
              style={{ background: 'none', border: 'none', color: 'rgba(240,232,216,.08)', fontSize: '.48rem', cursor: 'pointer', letterSpacing: '.06em' }}
            >
              studio
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes logoFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}
