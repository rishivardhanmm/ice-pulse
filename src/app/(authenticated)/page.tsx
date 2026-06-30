import { Suspense } from 'react';
import { DashboardView } from '@/components/dashboard/DashboardView';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardView />
    </Suspense>
  );
}
