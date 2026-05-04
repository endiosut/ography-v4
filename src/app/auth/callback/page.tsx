'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// ─────────────────────────────────────────────────────────────────
//  OGraphy V4 — Auth Callback Handler
//  File: src/app/auth/callback/page.tsx  (NEW FILE)
//
//  WHY THIS EXISTS:
//  Supabase redirects to SITE_URL after magic link / OAuth.
//  If SITE_URL in Supabase is set to localhost:3000, auth breaks
//  in production. This page handles the token exchange and
//  redirects correctly to /portal (client) or /admin (admin email).
//
//  ALSO FIX IN SUPABASE DASHBOARD:
//  Authentication → URL Configuration:
//    Site URL: https://ography-v4.vercel.app
//    Redirect URLs (add all):
//      https://ography-v4.vercel.app/**
//      https://ography-v4.vercel.app/auth/callback
//      https://ography-v4.vercel.app/portal
//      https://ography-v4.vercel.app/admin
// ─────────────────────────────────────────────────────────────────

const ADMIN_EMAIL = 'endiosut.eo@gmail.com';
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const sb = createClient(SB_URL, SB_ANON);

        // Exchange the code/token from the URL hash or query params
        const { data, error } = await sb.auth.getSession();

        if (error || !data.session) {
          // Try to exchange the hash fragment token
          const hash = window.location.hash;
          if (hash.includes('access_token')) {
            // Session will be set automatically by Supabase client from hash
            await new Promise(resolve => setTimeout(resolve, 500));
            const { data: retryData } = await sb.auth.getSession();
            if (retryData.session) {
              redirectUser(retryData.session.user.email || '');
              return;
            }
          }
          router.push('/login');
          return;
        }

        redirectUser(data.session.user.email || '');
      } catch {
        router.push('/login');
      }
    };

    const redirectUser = (email: string) => {
      if (email === ADMIN_EMAIL) {
        router.push('/admin');
      } else {
        router.push('/portal');
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0906',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Montserrat, sans-serif',
    }}>
      <div style={{ textAlign: 'center' }}>
        <img src="/logo.svg" alt="OGraphy" style={{ width: 120, marginBottom: '2rem', opacity: 0.7 }} />
        <div style={{ fontSize: '.65rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(201,169,110,.4)' }}>
          Signing you in...
        </div>
      </div>
    </div>
  );
}
