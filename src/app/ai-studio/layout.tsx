import { notFound } from 'next/navigation';
import { AI_STUDIO_ENABLED } from '@/lib/features';

// Hard route guard. When the flag is false this segment 404s before the page
// renders, so the route is not merely unlinked — it is unreachable by URL.
export const dynamic = 'force-dynamic';

export default function AiStudioSegmentLayout({ children }: { children: React.ReactNode }) {
  if (!AI_STUDIO_ENABLED) notFound();
  return <>{children}</>;
}
