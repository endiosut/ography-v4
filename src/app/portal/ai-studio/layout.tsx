import { notFound } from 'next/navigation';
import { AI_STUDIO_ENABLED } from '@/lib/features';

// Same guard for the client-facing tool. Inherits force-dynamic from
// /portal/layout.tsx.
export default function PortalAiStudioSegmentLayout({ children }: { children: React.ReactNode }) {
  if (!AI_STUDIO_ENABLED) notFound();
  return <>{children}</>;
}
