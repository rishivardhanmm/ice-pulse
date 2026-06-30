/**
 * Shared DTOs for ICE Pulse.
 *
 * These are the clean, UI-ready shapes returned by the API and consumed by the
 * dashboard. They are intentionally free of any server-only imports so both the
 * server (repositories/services/API) and the client (React) can use them.
 */

export type SyncStatus = 'running' | 'success' | 'failed';

export interface ClientDTO {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncRunDTO {
  id: number;
  source: string;
  status: SyncStatus;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  recordsProcessed: number;
  recordsInserted: number;
  recordsUpdated: number;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
}

export interface MetricsTotals {
  spend: number;
  impressions: number;
  clicks: number;
  /** Click-through rate as a percentage, e.g. 2.83 */
  ctr: number;
  conversions: number;
  conversionsValue: number;
  costPerConversion: number | null;
  averageCpc: number | null;
  /** Conversion rate as a percentage */
  conversionRate: number | null;
}

export interface DateRange {
  from: string;
  to: string;
}

export interface MetricsSummaryDTO {
  dateRange: DateRange;
  currency: string;
  totals: MetricsTotals;
  lastSyncedAt: string | null;
}

/** Manually-set budget utilisation for a client (set by ICE staff, shown to client). */
export interface ClientBudgetDTO {
  pctUsed: number;
  updatedAt: string | null;
}

export interface CampaignDTO {
  id: number;
  googleCampaignId: string;
  googleCustomerId: string;
  name: string;
  status: string | null;
  channelType: string | null;
  startDate: string | null;
  endDate: string | null;
  // Aggregated metrics over the requested date range
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  conversionsValue: number;
  costPerConversion: number | null;
  averageCpc: number | null;
}

export interface TrendPoint {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
}

export interface TrendsDTO {
  dateRange: DateRange;
  points: TrendPoint[];
}

export interface CampaignDetailDTO {
  campaign: CampaignDTO;
  dateRange: DateRange;
  currency: string;
  daily: TrendPoint[];
}

export type InsightTone = 'positive' | 'neutral' | 'warning' | 'info';

export interface InsightDTO {
  id: string;
  label: string;
  value: string;
  body: string;
  tone: InsightTone;
  available: boolean;
}

export interface ConnectionStatusDTO {
  source: string;
  configured: boolean;
  connected: boolean;
  message: string;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
}

export interface DashboardOverviewDTO {
  dateRange: DateRange;
  currency: string;
  summary: MetricsTotals;
  /** Equivalent-length preceding period, for deltas. Null when unavailable. */
  previous: MetricsTotals | null;
  trends: TrendPoint[];
  topCampaigns: CampaignDTO[];
  insights: InsightDTO[];
  lastSyncedAt: string | null;
  hasData: boolean;
  googleAds: ConnectionStatusDTO;
}

export type CampaignSortKey =
  | 'spend'
  | 'clicks'
  | 'impressions'
  | 'ctr'
  | 'conversions'
  | 'name';

export interface CampaignQuery {
  from: string;
  to: string;
  status?: string;
  channelType?: string;
  search?: string;
  sort: CampaignSortKey;
  direction: 'asc' | 'desc';
}

export interface CampaignListDTO {
  dateRange: DateRange;
  currency: string;
  campaigns: CampaignDTO[];
  totals: MetricsTotals;
  filters: {
    statuses: string[];
    channelTypes: string[];
  };
}

/** Result of a sync, returned by the connector and the trigger API. */
export interface SyncResultDTO {
  source: string;
  status: SyncStatus;
  startedAt: string;
  finishedAt: string | null;
  recordsProcessed: number;
  recordsInserted: number;
  recordsUpdated: number;
  errorMessage: string | null;
  syncRunId: number | null;
}

// ── AI ───────────────────────────────────────────────────────────────
export interface AiTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface AiInsightsResult {
  summary: string;
  recommendations: string[];
  model: string;
  usage: AiTokenUsage;
}

export interface AiChartSpec {
  /** line = time series; bar = vertical bars; hbar = horizontal bars (long labels); pie = share of total. */
  type: 'line' | 'bar' | 'hbar' | 'pie';
  x: string;
  y: string[];
  /** Optional category column → one coloured line/bar per distinct value (e.g. campaign_name). */
  series?: string;
}

export interface AiDisplaySpec {
  /**
   * text  = answer only.
   * chart = a single AiResultChart.
   * stats = a single entity's metrics as cards.
   * multiples = small-multiples grid (one mini trend per metric, for mixed-scale metrics over time).
   */
  kind: 'text' | 'chart' | 'stats' | 'multiples';
  chart?: AiChartSpec;
}

export interface AiAskResult {
  answer: string;
  sql: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  truncated: boolean;
  display: AiDisplaySpec;
  model: string;
  usage: AiTokenUsage;
}

export interface AiCampaignAnalysis {
  summary: string;
  strengths: string[];
  suggestion: string;
  model: string;
  usage: AiTokenUsage;
}

export interface AiUsageBucket {
  calls: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
}

export interface AiUsageByFeature {
  feature: string;
  calls: number;
  totalTokens: number;
  costUsd: number;
}

export interface AiUsageRecent {
  id: number;
  feature: string;
  model: string;
  totalTokens: number;
  costUsd: number;
  createdAt: string;
}

export interface AiUsageSummaryDTO {
  enabled: boolean;
  configured: boolean;
  model: string;
  today: AiUsageBucket;
  month: AiUsageBucket;
  allTime: AiUsageBucket;
  byFeature: AiUsageByFeature[];
  recent: AiUsageRecent[];
}

// ── Signals (deterministic, no AI) ───────────────────────────────────
export type SignalSeverity = 'warning' | 'info' | 'positive';

export interface Signal {
  id: string;
  kind: string;
  severity: SignalSeverity;
  title: string;
  detail: string;
  action?: string;
  campaignId?: number;
  campaignName?: string;
}

export interface SignalsDTO {
  dateRange: DateRange;
  currency: string;
  signals: Signal[];
}

// ── AI client report ─────────────────────────────────────────────────
export interface AiReportDTO {
  account: string | null;
  dateRange: DateRange;
  currency: string;
  generatedAt: string;
  headline: string;
  summary: string;
  highlights: string[];
  concerns: string[];
  recommendations: string[];
  totals: MetricsTotals;
  model: string;
  usage: AiTokenUsage;
}

// ── Sync scheduling ──────────────────────────────────────────────────
export interface SyncScheduleDTO {
  id: number;
  source: string;
  enabled: boolean;
  intervalMinutes: number;
  lookbackDays: number;
  lastRunAt: string | null;
  lastStatus: string | null;
  updatedAt: string;
}

// ── Team roles + content approval ─────────────────────────────────────
export interface TeamRoleDTO {
  id: number;
  name: string;
  canApprove: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type ApprovalEventType = 'submitted' | 'comment' | 'approved' | 'rejected' | 'resubmitted';

export interface ApprovalSubmissionDTO {
  id: number;
  submissionType: string;
  clientId: number | null;
  clientName: string | null;
  campaignId: number | null;
  campaignName: string | null;
  title: string | null;
  caption: string | null;
  imagePath: string | null;
  canvaDesignId: string | null;
  status: ApprovalStatus;
  submittedBy: number;
  submittedByName: string;
  decidedBy: number | null;
  decidedByName: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalEventDTO {
  id: number;
  submissionId: number;
  eventType: ApprovalEventType;
  comment: string | null;
  actorId: number;
  actorName: string;
  createdAt: string;
}

export interface ApprovalDetailDTO {
  submission: ApprovalSubmissionDTO;
  events: ApprovalEventDTO[];
  canDecide: boolean;
}

// ── Canva integration (internal) ─────────────────────────────────────
export interface CanvaCapabilityDTO {
  /** brand_template | autofill | asset_upload | export */
  name: string;
  available: boolean;
  checkedAt: string | null;
}

export interface CanvaConnectionDTO {
  status: string; // connected | disconnected | expired | revoked | error
  canvaUserId: string | null;
  canvaTeamId: string | null;
  email: string | null;
  displayName: string | null;
  scopes: string[];
  connectedAt: string | null;
  lastRefreshedAt: string | null;
}

export interface CanvaStatusDTO {
  configured: boolean; // client id/secret present
  hasEncryptionKey: boolean;
  redirectUri: string;
  requestedScopes: string[];
  connected: boolean;
  connection: CanvaConnectionDTO | null;
  capabilities: CanvaCapabilityDTO[];
  templateCount: number;
  lastTemplateSyncAt: string | null;
}

export interface CanvaTemplateDTO {
  id: number;
  canvaTemplateId: string;
  title: string | null;
  thumbnailUrl: string | null;
  templateType: string | null;
  source: string;
  lastSyncedAt: string | null;
}

/** Pulse → Canva report payload (foundation for future report generation). */
export interface CanvaReportPayload {
  clientName: string | null;
  campaignName: string | null;
  dateRange: DateRange;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number | null;
  conversions: number;
  costPerConversion: number | null;
  topCampaign: string | null;
  worstCampaign: string | null;
  recommendation: string | null;
  generatedAt: string;
}
