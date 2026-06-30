import { Suspense } from 'react';
import { ApprovalsView } from '@/components/approvals/ApprovalsView';

export const dynamic = 'force-dynamic';

export default function ApprovalsPage() {
  return (
    <Suspense fallback={null}>
      <ApprovalsView />
    </Suspense>
  );
}
