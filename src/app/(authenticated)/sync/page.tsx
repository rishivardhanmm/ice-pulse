import { Suspense } from 'react';
import { SyncView } from '@/components/sync/SyncView';

export const dynamic = 'force-dynamic';

export default function SyncPage() {
  return (
    <Suspense fallback={null}>
      <SyncView />
    </Suspense>
  );
}
