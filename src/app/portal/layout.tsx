// FIX (verified by build output) — force this segment to render dynamically.
//
// `export const dynamic = 'force-dynamic'` placed inside the page file had NO
// effect, because portal/page.tsx is a 'use client' component and Next.js ignores
// route segment config in Client Components. `next build` still marked the
// route as ○ (Static), which is exactly the condition that let production serve
// /portal, /admin and /login from a 7.7-day-old edge-cached prerender
// (x-vercel-cache: HIT, age 668204, all three sharing one ETag).
//
// Route segment config IS honoured in a layout, which is a Server Component by
// default, and it cascades to every page in the segment. This pass-through
// layout exists solely to carry that config.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PortalSegmentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
