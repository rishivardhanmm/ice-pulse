/**
 * Shared DTOs for ICE Pulse.
 *
 * These are the clean, UI-ready shapes returned by the API and consumed by the
 * dashboard. They are intentionally free of any server-only imports so both the
 * server (repositories/services/API) and the client (React) can use them.
 */

export type SyncStatus = 'running' | 'success' | 'failed';

export interface PowerBIReportDTO {
  id: string;
  name: string;
  webUrl: string;
  embedUrl: string;
  datasetId: string;
  workspaceId: string;
  workspaceName: string;
  reportType: string;
}

export interface PowerBIWorkspaceDTO {
  id: string;
  name: string;
  type: string;
}

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

export interface ConnectionStatusDTO {
  source: string;
  configured: boolean;
  connected: boolean;
  message: string;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
}

/** Which ad channel(s) a dashboard view covers. */
export type ChannelFilter = 'all' | 'google' | 'meta';

export interface DashboardOverviewDTO {
  dateRange: DateRange;
  currency: string;
  /** Which channel(s) this overview covers. */
  channel: ChannelFilter;
  summary: MetricsTotals;
  /** Equivalent-length preceding period, for deltas. Null when unavailable. */
  previous: MetricsTotals | null;
  trends: TrendPoint[];
  topCampaigns: CampaignDTO[];
  lastSyncedAt: string | null;
  hasData: boolean;
  googleAds: ConnectionStatusDTO;
  /** Per-channel totals for the side-by-side split (only when channel = 'all'). */
  channels?: { google: MetricsTotals; meta: MetricsTotals } | null;
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

export interface MetaCampaignDTO {
  id: number;
  metaCampaignId: string;
  name: string;
  status: string | null;
  objective: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  conversionsValue: number;
  costPerConversion: number | null;
  averageCpc: number | null;
}

export interface MetaCampaignListDTO {
  dateRange: DateRange;
  currency: string;
  campaigns: MetaCampaignDTO[];
  totals: MetricsTotals;
  filters: {
    statuses: string[];
    objectives: string[];
  };
}

export interface ConversionGoalDTO {
  goal: number;
  achievedThisMonth: number;
  pctAchieved: number;
  projectedTotal: number;
  status: 'on_track' | 'behind' | 'achieved';
}

export interface BudgetPacingDTO {
  /** computed = real amount + spend maths; manual = staff-typed % fallback. */
  mode: 'computed' | 'manual';
  monthlyBudget: number | null;
  spentThisMonth: number;
  pctUsed: number;
  dailyRunRate: number;
  projectedSpend: number;
  daysElapsed: number;
  daysRemaining: number;
  status: 'on_track' | 'over' | 'under' | 'no_budget';
  /** Monthly conversion goal progress (null when no goal set). */
  conversionGoal: ConversionGoalDTO | null;
  updatedAt: string;
}

export interface ClientAiSummaryDTO {
  narrative: string;
  whatToWatch: string[];
  model: string;
  usage: AiTokenUsage;
}

export interface PostIdeaDTO {
  id: number;
  ideaDate: string;
  platform: string;
  caption: string;
  hashtags: string | null;
  imageBrief: string | null;
  newsHook: string | null;
}

export interface MetaPageDTO {
  id: string;
  name: string;
  category: string | null;
}

export interface MetaSocialPostDTO {
  id: string;
  pageId: string;
  pageName: string;
  message: string | null;
  createdTime: string;
  permalinkUrl: string | null;
  imageUrl: string | null;
  likes: number;
  comments: number;
  shares: number;
}

export interface BestTimeSlotDTO {
  /** e.g. "Tuesday 9am–12pm" */
  label: string;
  avgEngagement: number;
  posts: number;
}

export interface MetaSocialFeedDTO {
  configured: boolean;
  pages: MetaPageDTO[];
  posts: MetaSocialPostDTO[];
  /** Top posting slots by average engagement (null until enough post history). */
  bestTimes: BestTimeSlotDTO[] | null;
  /** Setup guidance when configured but no pages are accessible yet. */
  notice: string | null;
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

export interface AnomalyDTO {
  id: number;
  source: 'google_ads' | 'meta_ads';
  campaignName: string;
  metric: string;
  metricDate: string;
  actualValue: number;
  expectedValue: number;
  zScore: number;
  direction: 'spike' | 'drop';
  severity: 'high' | 'medium';
  narrative: string | null;
}

export type AdCopyPlatform = 'google' | 'meta';

export interface AdCopyRequest {
  platform: AdCopyPlatform;
  product: string;
  audience?: string;
  tone?: string;
  keyPoints?: string;
  newsHook?: string;
  variants?: number;
}

export interface AdCopyVariant {
  headline: string;
  description: string;
  /** Meta only: the longer primary text above the creative. */
  primaryText?: string;
}

export interface AdCopyResult {
  platform: AdCopyPlatform;
  variants: AdCopyVariant[];
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

export interface ApprovalReviewerDTO {
  userId: number;
  name: string;
  email: string;
}

export interface ApprovalDetailDTO {
  submission: ApprovalSubmissionDTO;
  events: ApprovalEventDTO[];
  /** Named reviewers the submitter asked (empty = anyone with approval power). */
  reviewers: ApprovalReviewerDTO[];
  canDecide: boolean;
}

// ── News Insights ────────────────────────────────────────────────────
export interface NewsKeywordDTO {
  id: number;
  keyword: string;
  clientId: number | null;
  clientName: string | null;
  /** Competitor name — stories about it get a "how to respond" angle. */
  isCompetitor: boolean;
  createdAt: string;
}

export interface NewsArticleDTO {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  description: string;
  imageUrl: string | null;
  marketingHook: string;
}

export interface MarketingCalendarEventDTO {
  date: string;
  event: string;
  category: string;
  marketingRelevance: string;
}

// ── Campaign Calendar ─────────────────────────────────────────────────
export type CalendarEventType = 'google_ads' | 'meta_ads' | 'approval' | 'manual' | 'zoho_social';

export interface CalendarEventDTO {
  id: string;
  title: string;
  start: string;
  end: string;
  type: CalendarEventType;
  color: string;
  clientName: string | null;
  clientId: number | null;
  status?: string;
  href?: string;
}

export interface ManualCalendarEventInput {
  title: string;
  startDate: string;
  endDate?: string | null;
  clientId?: number | null;
  color?: string | null;
  notes?: string | null;
}

// ── Zoho Social ──────────────────────────────────────────────────────
export interface ZohoSocialPostDTO {
  id: number;
  zohoPostId: string;
  network: string;
  contentText: string | null;
  mediaUrls: string[];
  postType: string;
  permalinkUrl: string | null;
  publishedAt: string;
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  engagementRate: number | null;
  profileName: string;
  clientId: number | null;
  clientName: string | null;
  brandName: string;
}

export interface ZohoSocialSummaryDTO {
  network: string;
  postCount: number;
  totalImpressions: number;
  totalReach: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  avgEngagementRate: number | null;
}

export interface ZohoSocialConnectionDTO {
  status: string;
  orgId: string;
  connectedAt: string;
  lastRefreshedAt: string | null;
  scopes: string[];
  brandCount: number;
  profileCount: number;
}

export interface ZohoSocialStatusDTO {
  configured: boolean;
  connected: boolean;
  connection: ZohoSocialConnectionDTO | null;
}

export interface ZohoSocialProfileDTO {
  id: number;
  brandId: number;
  zohoProfileId: string;
  network: string;
  profileName: string;
  followerCount: number | null;
  clientId: number | null;
  clientName: string | null;
  brandName: string;
}

export interface AiSocialInsightDTO {
  summary: string;
  topPerformers: { network: string; insight: string }[];
  contentTips: string[];
  timingTips: string[];
  model: string;
  usage: { totalTokens: number; estimatedCostUsd: number };
}

export interface AiPostDraftDTO {
  caption: string;
  hashtags: string[];
  bestNetworks: string[];
  bestTimes: string[];
  rationale: string;
  model: string;
  usage: { totalTokens: number; estimatedCostUsd: number };
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
