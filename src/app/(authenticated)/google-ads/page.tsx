import { Suspense } from 'react';
import { CampaignsView } from '@/components/google-ads/CampaignsView';

export const dynamic = 'force-dynamic';

export default function GoogleAdsPage() {
  return (
    <Suspense fallback={null}>
      <CampaignsView />
    </Suspense>
  );
}
