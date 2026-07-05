import { Suspense } from 'react';
import { AdCopyStudio } from '@/components/ai/AdCopyStudio';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ad Copy Studio — ICE Pulse' };

export default function AdCopyPage() {
  return (
    <Suspense fallback={null}>
      <AdCopyStudio />
    </Suspense>
  );
}
