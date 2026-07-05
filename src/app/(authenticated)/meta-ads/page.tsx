import { Suspense } from 'react';
import { MetaCampaignsView } from '@/components/meta-ads/MetaCampaignsView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Meta Ads — ICE Pulse' };

export default function MetaAdsPage() {
  return (
    <Suspense fallback={null}>
      <MetaCampaignsView />
    </Suspense>
  );
}
