import { Suspense } from 'react';
import { PowerBIView } from '@/components/power-bi/PowerBIView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Power BI Reports — ICE Pulse' };

export default function PowerBIPage() {
  return (
    <Suspense fallback={null}>
      <PowerBIView />
    </Suspense>
  );
}
