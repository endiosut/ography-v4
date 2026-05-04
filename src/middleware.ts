import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// ─────────────────────────────────────────────────────────────────
//  OGraphy V4 — Middleware
//  File: src/middleware.ts  (root level, next to package.json)
//
//  Route protection:
//  - /admin/*  → requires admin email (endiosut.eo@gmail.com)
//  - /portal   → requires any authenticated session
//  - /login    → redirects to /portal if already logged in (client)
//                redirects to /admin if logged in as admin
//  - /auth/callback → always allowed (handles OAuth redirect)
//  - All other routes → public, no restriction
//
//  Admin email is checked server-side — no client-side bypass possible.
// ─────────────────────────────────────────────────────────────────

const ADMIN_EMAIL = 'endiosut.eo@gmail.com';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow these paths
  const publicPaths = [
    '/auth/callback',
    '/login',
    '/',
    '/catalog',
    '/contact',
    '/privacy',
    '/terms',
    '/_next',
    '/api',
    '/favicon.ico',
    '/logo.svg',
  ];

  const isPublic = publicPaths.some(path => pathname === path || pathname.startsWith(path));
  const isAdmin = pathname.startsWith('/admin');
  const isPortal = pathname.startsWith('/portal');

  // If fully public route, skip auth check
  if (!isAdmin && !isPortal && isPublic) {
    return NextResponse.next();
  }

  // Create Supabase server client
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Get session
  const { data: { user } } = await supabase.auth.getUser();

  // ── /admin routes ──
  if (isAdmin) {
    if (!user) {
      // Not logged in → redirect to login
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }
    if (user.email !== ADMIN_EMAIL) {
      // Logged in but not admin → redirect to portal
      const url = request.nextUrl.clone();
      url.pathname = '/portal';
      return NextResponse.redirect(url);
    }
    // Is admin → allow
    return response;
  }

  // ── /portal route ──
  if (isPortal) {
    if (!user) {
      // Not logged in → redirect to login
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('next', '/portal');
      return NextResponse.redirect(url);
    }
    // Any authenticated user can access portal
    return response;
  }

  // ── /login route ──
  // If already logged in, redirect to appropriate page
  if (pathname === '/login') {
    if (user) {
      const url = request.nextUrl.clone();
      // Check where they were trying to go
      const next = request.nextUrl.searchParams.get('next');
      if (next) {
        url.pathname = next;
      } else {
        url.pathname = user.email === ADMIN_EMAIL ? '/admin' : '/portal';
      }
      url.searchParams.delete('next');
      return NextResponse.redirect(url);
    }
    return response;
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt
     * - Public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|logo.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
