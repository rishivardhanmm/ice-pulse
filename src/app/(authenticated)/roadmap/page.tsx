import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { RoadmapModuleCard, type RoadmapModule } from '@/components/roadmap/RoadmapModuleCard';

export const metadata = { title: 'Roadmap — ICE Pulse' };

interface ModuleGroup {
  label: string;
  modules: RoadmapModule[];
}

const GROUPS: ModuleGroup[] = [
  {
    label: 'Data & channels',
    modules: [
      {
        icon: 'bi-google',
        name: 'Google Ads',
        description: 'Service-account sync, campaign performance page, daily metrics.',
        phase: 'Live',
        color: '#4285F4',
        status: 'live',
      },
      {
        icon: 'bi-meta',
        name: 'Meta Ads',
        description: 'Facebook & Instagram campaign sync (incl. campaigns with no spend), dedicated performance page.',
        phase: 'Live',
        color: '#1877F2',
        status: 'live',
      },
      {
        icon: 'bi-grid-1x2-fill',
        name: 'Cross-channel Dashboard',
        description: 'Combined Google + Meta KPIs, an All/Google/Meta channel switcher, and a side-by-side channel-split card.',
        phase: 'Live',
        color: '#FFD500',
        status: 'live',
      },
      {
        icon: 'bi-bar-chart-line',
        name: 'Power BI',
        description: 'Azure AD auth + workspace/report browsing + embedded viewer are built and tested working. Blocked on your Power BI admin granting the ICE Pulse service principal access to a workspace — see the Power BI page for exact steps.',
        phase: 'Needs setup',
        color: '#F2C811',
        status: 'needs_setup',
      },
      {
        icon: 'bi-share-fill',
        name: 'Zoho Social',
        description: 'Retired — confirmed Zoho Social has no public REST API, so no integration could ever connect. Replaced by pulling organic posts directly from the Meta Graph API instead (see Social Posts).',
        phase: 'Retired',
        color: '#8e86a6',
        status: 'retired',
      },
    ],
  },
  {
    label: 'AI intelligence',
    modules: [
      {
        icon: 'bi-chat-heart',
        name: 'Ask-Pulse assistant',
        description: 'Text-to-SQL chat that answers from real data — channel-aware (Google-only, Meta-only, or both depending on the question), defaults to all-time unless a period is named, and never dead-ends when data exists.',
        phase: 'Live',
        color: '#C79DFE',
        status: 'live',
      },
      {
        icon: 'bi-stars',
        name: 'AI Insights',
        description: 'Dashboard summary + 2-4 specific, actionable recommendations, aware of both ad channels.',
        phase: 'Live',
        color: '#FFD500',
        status: 'live',
      },
      {
        icon: 'bi-file-earmark-text',
        name: 'AI Reports',
        description: 'Client-ready performance reports — for the whole account, one client, or hand-picked campaigns across both channels.',
        phase: 'Live',
        color: '#22D3A0',
        status: 'live',
      },
      {
        icon: 'bi-graph-up-arrow',
        name: 'AI Anomaly Watch',
        description: 'Deterministic z-score detection against each campaign’s own 28-day baseline (no AI tokens), then one batched AI call writes plain-English explanations. Shown on the dashboard and the client’s own page.',
        phase: 'Live',
        color: '#FF5B6A',
        status: 'live',
      },
      {
        icon: 'bi-envelope-paper',
        name: 'Weekly AI Digest',
        description: 'Branded weekly email compiling the AI report, needs-attention signals and anomalies for every internal/admin user.',
        phase: 'Live',
        color: '#FFD500',
        status: 'live',
      },
      {
        icon: 'bi-arrow-left-right',
        name: 'AI Campaign Comparison',
        description: 'Pick any two campaigns and get a grounded verdict, specific contrasts, and one practical recommendation.',
        phase: 'Live',
        color: '#00D9D0',
        status: 'live',
      },
      {
        icon: 'bi-calendar-range',
        name: 'Suggested Campaign Windows',
        description: 'AI combines the cultural marketing calendar with the account’s own weekday performance history to suggest 2-4 launch windows a month.',
        phase: 'Live',
        color: '#C79DFE',
        status: 'live',
      },
      {
        icon: 'bi-pencil-square',
        name: 'Ad Copy Studio',
        description: 'Platform-aware Google/Meta ad copy variants with real character-limit validation, five angles per brief.',
        phase: 'Live',
        color: '#FF9D4D',
        status: 'live',
      },
      {
        icon: 'bi-lightbulb',
        name: 'Daily AI Post Ideas',
        description: 'Three ready-to-post ideas every day — caption, hashtags and a designer image brief for the ICE brand templates, riding live News Insights hooks where relevant.',
        phase: 'Live',
        color: '#FFD500',
        status: 'live',
      },
      {
        icon: 'bi-shield-check',
        name: 'Content pre-review',
        description: 'One click checks a submission’s title/caption for spelling, grammar, tone and brand issues before it goes to an approver, with a one-click corrected version.',
        phase: 'Live',
        color: '#22D3A0',
        status: 'live',
      },
      {
        icon: 'bi-binoculars',
        name: 'Competitor Watch',
        description: 'Flag competitor names as keywords in News Insights — their stories get a "how our clients could respond" angle instead of a generic hook.',
        phase: 'Live',
        color: '#FF9D4D',
        status: 'live',
      },
      {
        icon: 'bi-image',
        name: 'AI-generated post images',
        description: 'Post ideas currently ship a designer brief, not a finished image — no image-capable model is configured yet. Add an image model (e.g. gpt-image-1) to generate on-brand visuals automatically.',
        phase: 'Planned',
        color: '#8e86a6',
        status: 'planned',
      },
    ],
  },
  {
    label: 'Client experience',
    modules: [
      {
        icon: 'bi-people',
        name: 'Client Share Zone',
        description: 'Scoped read-only dashboard per client — sees only their own campaigns, on both Google and Meta.',
        phase: 'Live',
        color: '#C79DFE',
        status: 'live',
      },
      {
        icon: 'bi-wallet2',
        name: 'Budget Pacing',
        description: 'Real spend vs a monthly budget amount (both channels combined), daily run-rate, projected month-end figure and an honest on-track/over/under status.',
        phase: 'Live',
        color: '#FF9D4D',
        status: 'live',
      },
      {
        icon: 'bi-trophy',
        name: 'Conversion Goal Tracking',
        description: 'Monthly conversion target vs achieved, with a projected total and status shown on the client dashboard.',
        phase: 'Live',
        color: '#FFD500',
        status: 'live',
      },
      {
        icon: 'bi-question-circle',
        name: 'Plain-English AI Summary',
        description: 'A jargon-free narrative of the period’s performance written for someone with no marketing background, plus a metric glossary and suggested Ask-Pulse questions.',
        phase: 'Live',
        color: '#22D3A0',
        status: 'live',
      },
    ],
  },
  {
    label: 'Workflow & approvals',
    modules: [
      {
        icon: 'bi-check2-circle',
        name: 'Content Approvals',
        description: 'Submit, comment on, approve or reject creative with a full audit trail.',
        phase: 'Live',
        color: '#22D3A0',
        status: 'live',
      },
      {
        icon: 'bi-person-check',
        name: 'Named Reviewers',
        description: 'Search for and request approval from specific people — only they (or an admin) can decide that submission.',
        phase: 'Live',
        color: '#00D9D0',
        status: 'live',
      },
      {
        icon: 'bi-shield-lock',
        name: 'Team Roles & Permissions',
        description: 'Admin-defined job-title roles control who can approve content, separate from the fixed admin/internal/client system role.',
        phase: 'Live',
        color: '#C79DFE',
        status: 'live',
      },
      {
        icon: 'bi-envelope',
        name: 'Email Notifications',
        description: 'Automatic emails on submission and on decision.',
        phase: 'Live',
        color: '#FFD500',
        status: 'live',
      },
    ],
  },
  {
    label: 'Social & content',
    modules: [
      {
        icon: 'bi-chat-square-heart',
        name: 'Social Posts',
        description: 'Organic Facebook/Instagram posts pulled live from the Meta Graph API, with engagement and best-time-to-post analytics once enough post history exists.',
        phase: 'Live',
        color: '#FF86EF',
        status: 'live',
      },
      {
        icon: 'bi-newspaper',
        name: 'News Insights',
        description: 'Self-seeding keyword feed with AI creative hooks, one-click "create ad copy from this hook", and a monthly marketing calendar.',
        phase: 'Live',
        color: '#FF9D4D',
        status: 'live',
      },
      {
        icon: 'bi-calendar3',
        name: 'Campaign Calendar',
        description: 'Unified calendar of Google + Meta campaigns, approvals and manual events, plus AI-suggested launch windows.',
        phase: 'Live',
        color: '#FFD500',
        status: 'live',
      },
    ],
  },
  {
    label: 'Platform',
    modules: [
      {
        icon: 'bi-palette',
        name: 'Canva',
        description: 'OAuth connection, capabilities, and brand-asset browsing. Brand-template autofill needs Canva Enterprise, which ICE doesn’t currently have.',
        phase: 'Live',
        color: '#FF86EF',
        status: 'live',
      },
      {
        icon: 'bi-arrow-repeat',
        name: 'Sync Scheduling',
        description: 'Admin-configurable automatic sync interval per data source (and per AI job — anomaly watch, weekly digest, daily post ideas), running in the background.',
        phase: 'Live',
        color: '#00D9D0',
        status: 'live',
      },
      {
        icon: 'bi-calendar-check',
        name: 'All-time date range',
        description: 'An "All time" preset alongside 7/14/30/90 days on every date picker in the app — dashboard, Google Ads, Meta Ads, client pages, Sync Centre.',
        phase: 'Live',
        color: '#22D3A0',
        status: 'live',
      },
      {
        icon: 'bi-diagram-3',
        name: 'Unified campaign assignment',
        description: 'Client Management assigns BOTH Google and Meta campaigns to a client from one screen, each clearly badged by channel.',
        phase: 'Live',
        color: '#FFD500',
        status: 'live',
      },
    ],
  },
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
    title: 'Multi-channel',
    items: [
      { label: 'Meta Ads integration + page', done: true },
      { label: 'Cross-channel dashboard', done: true },
      { label: 'Client share zone', done: true },
      { label: 'Budget tracking', done: true },
    ],
  },
  {
    label: 'Phase 3',
    title: 'Workflow & access',
    items: [
      { label: 'Content approvals + audit trail', done: true },
      { label: 'Team roles & permissions', done: true },
      { label: 'Email notifications', done: true },
      { label: 'Sync scheduling', done: true },
      { label: 'Canva asset browsing', done: true },
    ],
  },
  {
    label: 'Phase 4',
    title: 'Core AI',
    items: [
      { label: 'AI insights & recommendations', done: true },
      { label: 'Ask-Pulse text-to-SQL assistant', done: true },
      { label: 'Per-campaign AI analysis', done: true },
      { label: 'AI client reports', done: true },
    ],
  },
  {
    label: 'Phase 5',
    title: 'Content & social',
    items: [
      { label: 'News Insights + AI hooks', done: true },
      { label: 'Campaign calendar', done: true },
      { label: 'Zoho Social (retired — no public API)', done: true },
      { label: 'Social Posts via Meta Graph API', done: true },
    ],
  },
  {
    label: 'Phase 6',
    title: 'Deep AI intelligence',
    items: [
      { label: 'AI Anomaly Watch', done: true },
      { label: 'Weekly AI digest email', done: true },
      { label: 'Ad Copy Studio', done: true },
      { label: 'Daily AI post ideas', done: true },
      { label: 'AI campaign comparison', done: true },
      { label: 'Suggested campaign windows', done: true },
      { label: 'Content pre-review (AI check)', done: true },
      { label: 'Competitor watch', done: true },
      { label: 'Budget pacing + conversion goals', done: true },
    ],
  },
  {
    label: 'Phase 7',
    title: 'Cross-channel correctness',
    items: [
      { label: 'Channel-aware Ask-Pulse (Google/Meta/both)', done: true },
      { label: 'Ask-Pulse defaults to all-time data', done: true },
      { label: 'Meta client-scoping (overview, reports, anomalies)', done: true },
      { label: 'Unified Google+Meta campaign assignment UI', done: true },
      { label: 'All-time range on every date picker', done: true },
    ],
  },
  {
    label: 'Phase 8',
    title: 'Pending external setup',
    items: [
      { label: 'Power BI workspace access grant (Vigo/tenant admin)', done: false },
      { label: 'Image-capable AI model for post ideas', done: false },
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
        subtitle="What's live today, what needs one more setup step, and what's next."
      />

      {GROUPS.map((group) => (
        <div key={group.label} className="mb-8">
          <h2 className="ice-section-title mb-3 text-base">{group.label}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {group.modules.map((m) => (
              <RoadmapModuleCard key={m.name} module={m} />
            ))}
          </div>
        </div>
      ))}

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
