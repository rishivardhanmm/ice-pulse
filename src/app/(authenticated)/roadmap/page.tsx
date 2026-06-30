import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { RoadmapModuleCard, type RoadmapModule } from '@/components/roadmap/RoadmapModuleCard';

export const metadata = { title: 'Roadmap — ICE Pulse' };

const MODULES: RoadmapModule[] = [
  { icon: 'bi-stars', name: 'AI Insights', description: 'AI summary, recommendations, Ask-Pulse chat, per-campaign analysis and automated client reports (GPT-4o-mini).', phase: 'Live', color: '#FFD500', live: true },
  { icon: 'bi-meta', name: 'Meta Ads', description: 'Facebook & Instagram ad performance via the Meta Marketing API. Connector, sync and scheduling are built — add credentials in Sync Centre to activate.', phase: 'Live', color: '#1877F2', live: true },
  { icon: 'bi-check2-circle', name: 'Approvals', description: 'Submit, comment on, approve or reject creative with a full audit trail. Admin-defined team roles control who can approve.', phase: 'Live', color: '#22D3A0', live: true },
  { icon: 'bi-palette', name: 'Canva', description: 'OAuth connection, capabilities, brand templates, designs and export — foundation for the report-generation workflow.', phase: 'Live', color: '#FF86EF', live: true },
  { icon: 'bi-wallet2', name: 'Budget Tracking', description: 'Staff-set budget utilisation % per client, shown to both staff and clients on the dashboard.', phase: 'Live', color: '#FF9D4D', live: true },
  { icon: 'bi-people', name: 'Client Share Zone', description: 'Client logins with a read-only, scoped performance dashboard and budget view — no access to other clients’ data.', phase: 'Live', color: '#C79DFE', live: true },
  { icon: 'bi-arrow-repeat', name: 'Sync Scheduling', description: 'Admin-configurable automatic sync interval per data source, running in the background.', phase: 'Live', color: '#00D9D0', live: true },
  { icon: 'bi-envelope', name: 'Email Notifications', description: 'Automatic emails when content is submitted for approval and when a decision is made.', phase: 'Live', color: '#FFD500', live: true },
  { icon: 'bi-share-fill', name: 'Zoho Social', description: 'Scheduled posts and social engagement from Zoho Social.', phase: 'Phase 2', color: '#C79DFE' },
  { icon: 'bi-chat-square-heart', name: 'Social Posts', description: 'Organic social post performance across channels.', phase: 'Phase 2', color: '#FF86EF' },
  { icon: 'bi-calendar3', name: 'Campaign Calendar', description: 'Plan and visualise campaigns across the year.', phase: 'Phase 2', color: '#FFD500' },
  { icon: 'bi-bar-chart-line', name: 'Power BI', description: 'Embedded Power BI reports and datasets.', phase: 'Phase 3', color: '#FFD500' },
  { icon: 'bi-database', name: 'Campaign Results DB', description: 'External company database of campaign outcomes (schema TBD).', phase: 'Future', color: '#00D9D0' },
];

interface PhaseItem {
  label: string;
  done: boolean;
}

interface Phase {
  label: string;
  title: string;
  items: PhaseItem[];
}

const PHASES: Phase[] = [
  {
    label: 'Phase 1',
    title: 'Foundation',
    items: [
      { label: 'Internal dashboard', done: true },
      { label: 'Google Ads sync', done: true },
      { label: 'MSSQL data store', done: true },
      { label: 'Campaign performance UI', done: true },
    ],
  },
  {
    label: 'Phase 2',
    title: 'More channels',
    items: [
      { label: 'Meta integration', done: true },
      { label: 'Zoho scheduling', done: false },
      { label: 'Social post tracking', done: false },
      { label: 'Campaign calendar', done: false },
    ],
  },
  {
    label: 'Phase 3',
    title: 'Workflow & reporting',
    items: [
      { label: 'Canva assets', done: true },
      { label: 'Content approvals', done: true },
      { label: 'Team roles & permissions', done: true },
      { label: 'Email notifications', done: true },
      { label: 'Client share zone', done: true },
      { label: 'Budget tracking', done: true },
      { label: 'Sync scheduling', done: true },
      { label: 'Power BI embedding', done: false },
    ],
  },
  {
    label: 'Phase 4',
    title: 'Intelligence',
    items: [
      { label: 'AI insights', done: true },
      { label: 'AI reporting assistant', done: true },
      { label: 'Campaign recommendations', done: true },
      { label: 'Newsjacking centre', done: false },
    ],
  },
];

function phaseStatus(items: PhaseItem[]): { label: string; cls: string } {
  const doneCount = items.filter((i) => i.done).length;
  if (doneCount === items.length) return { label: 'Complete', cls: 'status-live' };
  if (doneCount > 0) return { label: 'In progress', cls: 'status-paused' };
  return { label: 'Planned', cls: 'status-neutral' };
}

export default function RoadmapPage() {
  return (
    <>
      <PageHeader
        title="Roadmap & Future Modules"
        subtitle="What's live today and what's coming next."
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {MODULES.map((m) => (
          <RoadmapModuleCard key={m.name} module={m} />
        ))}
      </div>

      <h2 className="ice-section-title mb-3 text-base">Delivery phases</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PHASES.map((phase) => {
          const status = phaseStatus(phase.items);
          return (
            <Card key={phase.label}>
              <div className="mb-2 flex items-center justify-between">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {phase.label}
                </span>
                <span className={`status-pill ${status.cls}`}>{status.label}</span>
              </div>
              <h3 className="ice-section-title mb-3 text-base">{phase.title}</h3>
              <ul className="space-y-2">
                {phase.items.map((item) => (
                  <li key={item.label} className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <i
                      className={`bi ${item.done ? 'bi-check-circle-fill' : 'bi-circle'} mt-0.5`}
                      style={{ color: item.done ? 'var(--green)' : 'var(--text-muted)' }}
                      aria-hidden="true"
                    />
                    {item.label}
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </>
  );
}
