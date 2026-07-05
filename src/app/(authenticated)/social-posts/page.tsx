import { Suspense } from 'react';
// Meta Graph API feed replaced the Zoho Social view — Zoho Social has no
// public REST API, so organic posts come straight from Meta instead.
import { MetaSocialView } from '@/components/social/MetaSocialView';
import { Skeleton } from '@/components/ui/Skeleton';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Social Posts — ICE Pulse' };

export default function SocialPostsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <MetaSocialView />
    </Suspense>
  );
}
