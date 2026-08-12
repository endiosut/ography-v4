import { NextRequest, NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

// Admin identity. Override per-environment with OGRAPHY_ADMIN_EMAIL.
// Read inside the handler — never at module scope (see FIX 1).
function getAdminEmail() {
  return (process.env.OGRAPHY_ADMIN_EMAIL || 'endiosut.eo@gmail.com').toLowerCase();
}

// FIX 7 — admin identity is now claim-first, email second.
// Previously admin was decided ONLY by matching a hardcoded email string, in
// three separate files (here, auth/callback/route.ts, login/page.tsx). That
// meant the owner's route through the app was structurally different from every
// client's route, so owner testing could never exercise the client path — which
// is exactly how the broken /portal survived ten weeks of "it works for me".
// `app_metadata.role` is already set to 'admin' on the owner account in
// Supabase, and the newer RLS policies already key off it, so this aligns the
// edge check with the database check. The email match is kept as a fallback
// only, so nothing breaks if a JWT is issued before the claim propagates.
function resolveIsAdmin(user: User | null): boolean {
  if (!user) return false;
  const role = (user.app_metadata as Record<string, unknown> | undefined)?.role;
  if (role === 'admin' || role === 'ops') return true;
  return (user.email || '').toLowerCase() === getAdminEmail();
}

// FIX 6 (P1 — the login loop) ────────────────────────────────────────────────
// @supabase/ssr rotates the refresh token during getUser() and hands the new
// cookies to setAll(), which writes them onto `response`. Every redirect in this
// file previously returned a BRAND NEW NextResponse.redirect(...) object, which
// carries none of those cookies. The browser therefore kept the OLD refresh
// token, replayed it on the next request, and Supabase rejected it with
// `refresh_token_already_used` (400) — observed 4x at an identical timestamp in
// production, i.e. concurrent requests racing one token.
// Every redirect must be built through this helper.
function redirectWith(response: NextResponse, url: URL): NextResponse {
  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

// Routes that must never touch Supabase auth (see FIX 2).
// Public marketing + legal pages: no session needed, so no network round-trip.
const PUBLIC_PREFIXES = [
  '/_next',
  '/api',
  '/auth/callback',
  '/catalog',
  '/contact',
  '/privacy',
  '/terms',
];

function isPublicPath(pathname: string) {
  if (pathname === '/') return true;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) return true;
  if (pathname.startsWith('/api')) return true;
  if (/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|txt|xml|woff2?)$/.test(pathname)) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // FIX 2 — short-circuit BEFORE creating any Supabase client.
  // Previously every public page paid an auth round-trip; on a paused
  // free-tier project that is the documented 504.
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // FIX 1 — env read moved inside the handler, with an explicit guard.
  // Previously these were module-level non-null assertions: a missing or
  // renamed var threw at module init and 500'd EVERY matched route,
  // including /portal. Same bug class the 29 May commits fixed in pages
  // but never in middleware.
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error(
      '[middleware] Missing Supabase env vars.',
      'NEXT_PUBLIC_SUPABASE_URL set:', Boolean(SUPABASE_URL),
      'NEXT_PUBLIC_SUPABASE_ANON_KEY set:', Boolean(SUPABASE_ANON_KEY),
      'path:', pathname
    );
    // Fail CLOSED on protected routes — never silently expose /admin or /portal.
    if (pathname.startsWith('/admin') || pathname.startsWith('/portal')) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      url.search = '?error=config';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // FIX 8 — pass the whole `request`, not just its headers.
  // `NextResponse.next({ request: { headers } })` snapshots headers only, so the
  // refreshed cookies written onto request.cookies inside setAll() never reach
  // downstream Server Components — they saw a stale (or absent) session even
  // when middleware had just refreshed it successfully.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // FIX 5 — getUser() can throw (network, paused project, expired refresh).
  // Unhandled, it crashed middleware and 500'd the route.
  let user: User | null = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) console.error('[middleware] getUser error:', error.message, 'path:', pathname);
    user = data?.user ?? null;
  } catch (err) {
    console.error('[middleware] getUser threw:', err, 'path:', pathname);
    if (pathname.startsWith('/admin') || pathname.startsWith('/portal')) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('next', pathname);
      return redirectWith(response, url);
    }
    return response;
  }

  const userEmail = user?.email?.toLowerCase() || null;
  const isAdmin = resolveIsAdmin(user);

  // /admin routes
  if (pathname.startsWith('/admin')) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('next', pathname);
      return redirectWith(response, url);
    }
    if (!isAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = '/portal';
      return redirectWith(response, url);
    }
    return response;
  }

  // /portal routes
  if (pathname.startsWith('/portal')) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('next', '/portal');
      return redirectWith(response, url);
    }

    // FIX 3 — authenticated is NOT the same as onboarded.
    // A magic-link user with no `clients` row previously landed on an empty
    // portal that reads as "broken". We do NOT redirect (a paid client can
    // legitimately arrive seconds before the Stripe webhook inserts the row,
    // and redirecting would bounce a real customer). Instead we surface the
    // state so the page can render a correct pending/onboarding view.
    // FIX 9 — the previous `.or(user_id.eq.${user.id},email.eq.${userEmail})`
    // interpolated a raw email into a PostgREST filter string. An address
    // containing a comma or parenthesis breaks the filter or alters its meaning.
    // Query by user_id (the canonical join, now maintained by the
    // on_auth_user_created_link_client trigger) and fall back to a separate,
    // properly-escaped email query only for legacy rows.
    let clientState = 'unknown';
    try {
      const { data: byId, error: idErr } = await supabase
        .from('clients').select('id').eq('user_id', user.id).limit(1).maybeSingle();
      if (idErr) console.error('[middleware] client lookup by user_id:', idErr.message);

      if (byId) {
        clientState = 'active';
      } else if (userEmail) {
        const { data: byEmail, error: emErr } = await supabase
          .from('clients').select('id').eq('email', userEmail).limit(1).maybeSingle();
        if (emErr) console.error('[middleware] client lookup by email:', emErr.message);
        clientState = byEmail ? 'active' : 'none';
      } else {
        clientState = 'none';
      }
    } catch (err) {
      console.error('[middleware] client lookup threw:', err);
    }

    // NOTE (D8): this header is currently written and read by nobody.
    // /portal resolves its own client row directly. Kept only so an existing
    // consumer is not broken silently — delete it once confirmed unused.
    response.headers.set('x-og-client-state', clientState);
    return response;
  }

  // /login route
  if (pathname === '/login') {
    if (user) {
      const nextParam = request.nextUrl.searchParams.get('next');
      const url = request.nextUrl.clone();

      // Only allow internal relative redirects — blocks open-redirect via ?next=
      const safeNext =
        nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
          ? nextParam
          : null;

      if (safeNext) {
        url.pathname = safeNext.startsWith('/admin') && !isAdmin ? '/portal' : safeNext;
      } else {
        url.pathname = isAdmin ? '/admin' : '/portal';
      }

      url.searchParams.delete('next');
      return redirectWith(response, url);
    }
    return response;
  }

  return response;
}

// FIX 10 — narrow the matcher.
// The old pattern still ran middleware for fonts (.woff/.woff2), .ico, .txt,
// .xml and /_next/data. Each of those triggers a getUser() call, so one page
// load fired many PARALLEL refresh attempts against a single refresh token —
// the concurrency signature seen in production (4 identical-timestamp
// `refresh_token_already_used` errors). Excluding static assets removes the race.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|_next/data|favicon.ico|logo.svg|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|css|js|woff|woff2|ttf|otf)$).*)',
  ],
};
