import { Suspense } from 'react';
import { ApprovalDetail } from '@/components/approvals/ApprovalDetail';

export const dynamic = 'force-dynamic';

export default function ApprovalDetailPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={null}>
      <ApprovalDetail id={Number(params.id)} />
    </Suspense>
  );
}
