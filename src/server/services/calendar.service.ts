import {
  getGoogleAdsCampaigns,
  getMetaAdsCampaigns,
  getApprovalEvents,
  getManualEvents,
  getZohoScheduledEvents,
  createManualEvent as repoCreate,
  deleteManualEvent as repoDelete,
} from '@/server/db/repositories/calendar.repo';
import type { CalendarEventDTO, ManualCalendarEventInput } from '@/lib/types';

export async function getCalendarEvents(
  from: string,
  to: string,
  clientId?: number | null,
): Promise<CalendarEventDTO[]> {
  const [google, meta, approvals, manual, zoho] = await Promise.all([
    getGoogleAdsCampaigns(from, to, clientId).catch(() => [] as CalendarEventDTO[]),
    getMetaAdsCampaigns(from, to, clientId).catch(() => [] as CalendarEventDTO[]),
    getApprovalEvents(from, to, clientId).catch(() => [] as CalendarEventDTO[]),
    getManualEvents(from, to, clientId).catch(() => [] as CalendarEventDTO[]),
    getZohoScheduledEvents(from, to, clientId).catch(() => [] as CalendarEventDTO[]),
  ]);
  return [...google, ...meta, ...approvals, ...manual, ...zoho];
}

export async function createCalendarEvent(
  input: ManualCalendarEventInput,
  userId: number,
): Promise<number> {
  return repoCreate({ ...input, createdBy: userId });
}

export async function deleteCalendarEvent(id: number): Promise<void> {
  return repoDelete(id);
}
