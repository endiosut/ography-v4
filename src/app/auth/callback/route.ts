import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const ADMIN_EMAIL = 'endiosut.eo@gmail.com';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) return NextResponse.redirect(new URL('/login', origin));

  const pendingCookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(c => pendingCookies.push(c as typeof pendingCookies[0]));
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    return NextResponse.redirect(new URL('/login', origin));
  }

  const email = data.session.user.email || '';
  const dest = email === ADMIN_EMAIL ? '/admin' : '/portal';
  const response = NextResponse.redirect(new URL(dest, origin));

  pendingCookies.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
  );

  return response;
}
