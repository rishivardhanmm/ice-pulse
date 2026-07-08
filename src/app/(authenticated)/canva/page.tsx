import { Suspense } from 'react';
import { CanvaSettingsView } from '@/components/canva/CanvaSettingsView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Canva Integration — ICE Pulse' };

export default function CanvaPage() {
  return (
    <Suspense fallback={null}>
      <CanvaSettingsView />
    </Suspense>
  );
}
