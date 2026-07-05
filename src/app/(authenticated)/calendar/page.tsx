import { Suspense } from 'react';
import { CampaignCalendarView } from '@/components/calendar/CampaignCalendarView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Campaign Calendar — ICE Pulse' };

export default function CalendarPage() {
  return (
    <Suspense fallback={null}>
      <CampaignCalendarView />
    </Suspense>
  );
}
