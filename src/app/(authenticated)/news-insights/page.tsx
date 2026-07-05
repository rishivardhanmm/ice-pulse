import { Suspense } from 'react';
import { NewsInsightsView } from '@/components/news/NewsInsightsView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'News Insights — ICE Pulse' };

export default function NewsInsightsPage() {
  return (
    <Suspense fallback={null}>
      <NewsInsightsView />
    </Suspense>
  );
}
