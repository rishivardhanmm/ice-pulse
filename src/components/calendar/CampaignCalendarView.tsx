'use client';

import { useState, useCallback, useMemo } from 'react';
import { Calendar, dateFnsLocalizer, type View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enAU } from 'date-fns/locale';
import { useFetch } from '@/lib/use-fetch';
import { calendarEventsUrl, createCalendarEvent, deleteCalendarEvent } from '@/lib/api-client';
import { useAiStatus } from '@/components/ai/AiStatusProvider';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import type { CalendarEventDTO, CalendarEventType } from '@/lib/types';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { 'en-AU': enAU },
});

type ExtendedEventType = CalendarEventType | 'suggested_window';

const TYPE_LABELS: Record<ExtendedEventType, string> = {
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
  approval: 'Approval',
  manual: 'Manual',
  zoho_social: 'Zoho Social',
  suggested_window: 'Suggested Window (AI)',
};

const LEGEND = [
  { label: 'Google Ads', color: '#4285F4' },
  { label: 'Meta Ads', color: '#1877F2' },
  { label: 'Approval (Pending)', color: '#F59E0B' },
  { label: 'Approval (Approved)', color: '#22D3A0' },
  { label: 'Approval (Rejected)', color: '#EF4444' },
  { label: 'Manual Event', color: '#A78BFA' },
  { label: 'Zoho Scheduled Post', color: '#E05735' },
  { label: 'Suggested Window (AI)', color: '#C79DFE' },
];

const SUGGESTED_WINDOW_COLOR = '#C79DFE';

interface WindowItem {
  startDate: string;
  endDate: string;
  title: string;
  rationale: string;
}

interface WindowsResp {
  month: string;
  windows: WindowItem[];
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function monthRange(date: Date): { from: string; to: string } {
  const y = date.getFullYear();
  const m = date.getMonth();
  const from = isoDate(new Date(y, m - 1, 1));
  const to = isoDate(new Date(y, m + 2, 0));
  return { from, to };
}

interface RbcEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  color: string;
  type: ExtendedEventType;
  clientName: string | null;
  clientId: number | null;
  status?: string;
  href?: string;
  rationale?: string;
  /** Raw YYYY-MM-DD strings for suggested windows, to avoid local-time round-trip drift. */
  rawStartDate?: string;
  rawEndDate?: string;
}

function toRbcEvents(events: CalendarEventDTO[]): RbcEvent[] {
  return events.map((e) => {
    const start = new Date(e.start + 'T00:00:00');
    const rawEnd = new Date(e.end + 'T00:00:00');
    // react-big-calendar end date for all-day events must be exclusive (next day)
    const end = new Date(rawEnd);
    end.setDate(end.getDate() + 1);
    return {
      id: e.id,
      title: e.title,
      start,
      end,
      color: e.color,
      type: e.type,
      clientName: e.clientName,
      clientId: e.clientId,
      status: e.status,
      href: e.href,
    };
  });
}

function toSuggestedRbcEvents(windows: WindowItem[]): RbcEvent[] {
  return windows.map((w, i) => {
    const start = new Date(w.startDate + 'T00:00:00');
    const end = new Date(w.endDate + 'T00:00:00');
    end.setDate(end.getDate() + 1);
    return {
      id: `suggested-${i}`,
      title: w.title,
      start,
      end,
      color: SUGGESTED_WINDOW_COLOR,
      type: 'suggested_window',
      clientName: null,
      clientId: null,
      rationale: w.rationale,
      rawStartDate: w.startDate,
      rawEndDate: w.endDate,
    };
  });
}

interface EventsResp { events: CalendarEventDTO[] }

const DEFAULT_COLOR_SWATCHES = ['#A78BFA', '#FF9D4D', '#22D3A0', '#4285F4', '#F59E0B', '#EF4444'];

export function CampaignCalendarView() {
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState<View>('month');
  const [clientFilter, setClientFilter] = useState<number | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<RbcEvent | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addingWindow, setAddingWindow] = useState(false);

  const { configured: aiConfigured } = useAiStatus();

  const range = useMemo(() => monthRange(date), [date]);
  const url = calendarEventsUrl(range.from, range.to, clientFilter);
  const eventsQ = useFetch<EventsResp>(url);

  const windowsMonth = useMemo(() => format(date, 'yyyy-MM'), [date]);
  const windowsQ = useFetch<WindowsResp>(
    aiConfigured ? `/api/ai/campaign-windows?month=${windowsMonth}` : null,
  );

  const rbcEvents = useMemo(
    () => [
      ...toRbcEvents(eventsQ.data?.events ?? []),
      ...toSuggestedRbcEvents(windowsQ.data?.windows ?? []),
    ],
    [eventsQ.data, windowsQ.data],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!id.startsWith('manual-')) return;
      try {
        await deleteCalendarEvent(id);
        eventsQ.refetch();
        setSelectedEvent(null);
      } catch {
        // silent
      }
    },
    [eventsQ],
  );

  const handleAddSuggestedWindow = useCallback(
    async (event: RbcEvent) => {
      if (!event.rawStartDate) return;
      setAddingWindow(true);
      try {
        await createCalendarEvent({
          title: event.title,
          startDate: event.rawStartDate,
          endDate: event.rawEndDate ?? null,
          color: SUGGESTED_WINDOW_COLOR,
          notes: event.rationale ?? null,
        });
        eventsQ.refetch();
        setSelectedEvent(null);
      } catch {
        // silent – user can retry from the detail panel
      } finally {
        setAddingWindow(false);
      }
    },
    [eventsQ],
  );

  return (
    <>
      <PageHeader title="Campaign Calendar" subtitle="Visualise campaigns, approvals and key dates in one place.">
        <button
          className="ice-btn ice-btn-primary text-xs"
          onClick={() => setShowAddForm(true)}
        >
          <i className="bi bi-plus-lg mr-1" aria-hidden="true" />
          Add Event
        </button>
      </PageHeader>

      {/* Calendar card */}
      <Card padded={false}>
        <div className="p-4">
          <Calendar
            localizer={localizer}
            events={rbcEvents}
            date={date}
            view={view}
            onNavigate={setDate}
            onView={(v) => setView(v)}
            views={['month', 'week', 'agenda']}
            style={{ height: 600 }}
            eventPropGetter={(event: RbcEvent) => ({
              style: {
                backgroundColor: event.type === 'suggested_window' ? 'transparent' : event.color,
                border: event.type === 'suggested_window' ? `1.5px dashed ${event.color}` : 'none',
                borderRadius: '4px',
                color: event.type === 'suggested_window' ? event.color : '#fff',
                fontSize: '11px',
                padding: '1px 4px',
                fontStyle: event.type === 'suggested_window' ? 'italic' : 'normal',
              },
            })}
            onSelectEvent={(event: RbcEvent) => setSelectedEvent(event)}
            popup
            selectable={false}
          />
        </div>

        {/* Legend */}
        <div
          className="flex flex-wrap gap-x-4 gap-y-2 border-t px-4 py-3"
          style={{ borderColor: 'var(--card-border)' }}
        >
          {LEGEND.map((l) => (
            <div
              key={l.label}
              className="flex items-center gap-1.5 text-[11px]"
              style={{ color: 'var(--text-secondary)' }}
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ background: l.color }}
              />
              {l.label}
            </div>
          ))}
        </div>
      </Card>

      {/* Event detail slide-over */}
      {selectedEvent && (
        <EventDetailPanel
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDelete={handleDelete}
          onAddSuggestedWindow={handleAddSuggestedWindow}
          addingWindow={addingWindow}
        />
      )}

      {/* Add event form */}
      {showAddForm && (
        <AddEventForm
          onClose={() => setShowAddForm(false)}
          onSaved={() => {
            eventsQ.refetch();
            setShowAddForm(false);
          }}
        />
      )}
    </>
  );
}

function EventDetailPanel({
  event,
  onClose,
  onDelete,
  onAddSuggestedWindow,
  addingWindow,
}: {
  event: RbcEvent;
  onClose: () => void;
  onDelete: (id: string) => void;
  onAddSuggestedWindow: (event: RbcEvent) => void;
  addingWindow: boolean;
}) {
  const isManual = event.id.startsWith('manual-');
  const isSuggested = event.type === 'suggested_window';
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-end"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="relative h-full w-full max-w-sm overflow-y-auto p-6 shadow-2xl"
        style={{ background: 'var(--card-bg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute right-4 top-4 text-lg"
          style={{ color: 'var(--text-muted)' }}
          onClick={onClose}
        >
          <i className="bi bi-x-lg" aria-hidden="true" />
        </button>

        <div className="mb-1 flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ background: event.color }}
          />
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            {TYPE_LABELS[event.type]}
          </span>
        </div>

        <h2 className="mb-4 text-base font-bold" style={{ color: 'var(--text-primary)' }}>
          {event.title}
        </h2>

        <dl className="space-y-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {event.clientName && (
            <div>
              <dt className="font-semibold" style={{ color: 'var(--text-muted)' }}>Client</dt>
              <dd>{event.clientName}</dd>
            </div>
          )}
          <div>
            <dt className="font-semibold" style={{ color: 'var(--text-muted)' }}>Start</dt>
            <dd>{event.start.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</dd>
          </div>
          <div>
            <dt className="font-semibold" style={{ color: 'var(--text-muted)' }}>End</dt>
            <dd>
              {new Date(event.end.getTime() - 86400000).toLocaleDateString('en-AU', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </dd>
          </div>
          {event.status && (
            <div>
              <dt className="font-semibold" style={{ color: 'var(--text-muted)' }}>Status</dt>
              <dd className="capitalize">{event.status.toLowerCase()}</dd>
            </div>
          )}
          {isSuggested && event.rationale && (
            <div>
              <dt className="font-semibold" style={{ color: 'var(--text-muted)' }}>Why this window</dt>
              <dd className="leading-relaxed">{event.rationale}</dd>
            </div>
          )}
        </dl>

        <div className="mt-6 flex flex-wrap gap-2">
          {event.href && (
            <a href={event.href} className="ice-btn ice-btn-primary text-xs">
              View Details
            </a>
          )}
          {isManual && (
            <button
              className="ice-btn text-xs"
              style={{ color: 'var(--red)' }}
              onClick={() => onDelete(event.id)}
            >
              <i className="bi bi-trash mr-1" aria-hidden="true" />
              Delete
            </button>
          )}
          {isSuggested && (
            <button
              className="ice-btn ice-btn-primary text-xs"
              onClick={() => onAddSuggestedWindow(event)}
              disabled={addingWindow}
            >
              <i className="bi bi-calendar-plus mr-1" aria-hidden="true" />
              {addingWindow ? 'Adding…' : 'Add to Calendar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AddEventForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(isoDate(new Date()));
  const [endDate, setEndDate] = useState('');
  const [color, setColor] = useState(DEFAULT_COLOR_SWATCHES[0]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!title.trim() || !startDate) return;
    setSaving(true);
    setError('');
    try {
      await createCalendarEvent({
        title: title.trim(),
        startDate,
        endDate: endDate || null,
        color,
        notes: notes || null,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save event');
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{ background: 'var(--card-bg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-5 text-base font-bold" style={{ color: 'var(--text-primary)' }}>
          Add Calendar Event
        </h2>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Title *
            </label>
            <input
              className="ice-input w-full text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event name"
              maxLength={200}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                Start Date *
              </label>
              <input
                type="date"
                className="ice-input w-full text-sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                End Date
              </label>
              <input
                type="date"
                className="ice-input w-full text-sm"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Colour
            </label>
            <div className="flex gap-2">
              {DEFAULT_COLOR_SWATCHES.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    background: c,
                    borderColor: color === c ? 'var(--text-primary)' : 'transparent',
                  }}
                  title={c}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Notes
            </label>
            <textarea
              className="ice-input w-full resize-none text-sm"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              maxLength={1000}
            />
          </div>

          {error && (
            <p className="text-xs" style={{ color: 'var(--red)' }}>
              {error}
            </p>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button className="ice-btn ice-btn-ghost text-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            className="ice-btn ice-btn-primary text-sm"
            onClick={handleSave}
            disabled={saving || !title.trim() || !startDate}
          >
            {saving ? 'Saving…' : 'Save Event'}
          </button>
        </div>
      </div>
    </div>
  );
}
