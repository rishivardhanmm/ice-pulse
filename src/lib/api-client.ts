import type {
  AiAskResult,
  AiCampaignAnalysis,
  AiInsightsResult,
  AiReportDTO,
  ApprovalDetailDTO,
  ApprovalStatus,
  ApprovalSubmissionDTO,
  CampaignSortKey,
  CanvaReportPayload,
  SyncResultDTO,
  SyncScheduleDTO,
  TeamRoleDTO,
} from './types';

function qs(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') sp.set(key, value);
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export function overviewUrl(
  from: string,
  to: string,
  filters?: { clientId?: number | null; campaignIds?: number[] },
): string {
  return `/api/dashboard/overview${qs({
    from,
    to,
    clientId: filters?.clientId ? String(filters.clientId) : undefined,
    campaignIds: filters?.campaignIds?.length ? filters.campaignIds.join(',') : undefined,
  })}`;
}

export function summaryUrl(from: string, to: string): string {
  return `/api/google-ads/metrics/summary${qs({ from, to })}`;
}

export function trendsUrl(from: string, to: string): string {
  return `/api/google-ads/metrics/trends${qs({ from, to })}`;
}

export interface CampaignListParams {
  from: string;
  to: string;
  sort?: CampaignSortKey;
  direction?: 'asc' | 'desc';
  status?: string;
  channel?: string;
  search?: string;
}

export function campaignsUrl(p: CampaignListParams): string {
  return `/api/google-ads/campaigns${qs({
    from: p.from,
    to: p.to,
    sort: p.sort,
    direction: p.direction,
    status: p.status,
    channel: p.channel,
    search: p.search,
  })}`;
}

export function campaignDetailUrl(id: number, from: string, to: string): string {
  return `/api/google-ads/campaigns/${id}${qs({ from, to })}`;
}

export function syncRunsUrl(limit = 25): string {
  return `/api/sync-runs${qs({ limit: String(limit) })}`;
}

export function signalsUrl(from: string, to: string): string {
  return `/api/insights/signals${qs({ from, to })}`;
}

export function googleAdsStatusUrl(): string {
  return '/api/google-ads/status';
}

export function metaAdsStatusUrl(): string {
  return '/api/meta-ads/status';
}

/** Triggers a Meta Ads sync and returns the result. */
export async function triggerMetaAdsSync(range?: {
  from?: string;
  to?: string;
}): Promise<SyncResultDTO> {
  const res = await fetch('/api/sync/meta-ads', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(range ?? {}),
  });
  const body = (await res.json().catch(() => null)) as SyncResultDTO | { error: string } | null;
  if (body && 'source' in body) return body;
  const message = body && 'error' in body ? body.error : `Sync request failed (${res.status})`;
  throw new Error(message);
}

/** Triggers a Google Ads sync and returns the result (also on non-2xx). */
export async function triggerGoogleAdsSync(range?: {
  from?: string;
  to?: string;
}): Promise<SyncResultDTO> {
  const res = await fetch('/api/sync/google-ads', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(range ?? {}),
  });
  const body = (await res.json().catch(() => null)) as SyncResultDTO | { error: string } | null;
  if (body && 'source' in body) return body;
  const message = body && 'error' in body ? body.error : `Sync request failed (${res.status})`;
  throw new Error(message);
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const data = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export function aiUsageUrl(): string {
  return '/api/ai/usage';
}

export function generateAiInsights(range: { from: string; to: string }): Promise<AiInsightsResult> {
  return postJson<AiInsightsResult>('/api/ai/insights', range);
}

export function askAiQuestion(payload: {
  question: string;
  from: string;
  to: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<AiAskResult> {
  return postJson<AiAskResult>('/api/ai/ask', payload);
}

export function analyzeCampaignAi(
  id: number,
  range: { from: string; to: string },
): Promise<AiCampaignAnalysis> {
  return postJson<AiCampaignAnalysis>(`/api/ai/campaign/${id}`, range);
}

export function generateClientReport(range: { from: string; to: string }): Promise<AiReportDTO> {
  return postJson<AiReportDTO>('/api/ai/report', range);
}

// ── Canva ────────────────────────────────────────────────────────────
export function canvaStatusUrl(): string {
  return '/api/canva/status';
}

export function canvaTemplatesUrl(): string {
  return '/api/canva/templates';
}

export function disconnectCanva(): Promise<{ ok: boolean }> {
  return postJson('/api/canva/disconnect', {});
}

export function refreshCanvaCapabilities(): Promise<{ ok: boolean; capabilities: Record<string, boolean> }> {
  return postJson('/api/canva/refresh-capabilities', {});
}

export function syncCanvaTemplates(): Promise<{ available: boolean; synced: number; reason?: string }> {
  return postJson('/api/canva/sync-templates', {});
}

export interface CanvaGenerationResult {
  status: string;
  generation: { autofillAvailable: boolean; brandTemplatesAvailable: boolean; message: string };
  payload: CanvaReportPayload;
}

export function generateCanvaReportPlaceholder(body: {
  from: string;
  to: string;
  clientId?: number;
  campaignId?: number;
  templateId?: string;
}): Promise<CanvaGenerationResult> {
  return postJson<CanvaGenerationResult>('/api/canva/generate-report-placeholder', body);
}

export function exportCanvaDesign(body: {
  canvaDesignId: string;
  format: string;
}): Promise<{ jobId: number; status: string; downloadUrl: string | null; error: string | null }> {
  return postJson('/api/canva/export-design', body);
}

// ── Sync schedules ────────────────────────────────────────────────────
export function syncSchedulesUrl(): string {
  return '/api/admin/sync-schedules';
}

export async function updateSyncSchedule(
  source: string,
  body: { enabled?: boolean; intervalMinutes?: number; lookbackDays?: number },
): Promise<SyncScheduleDTO> {
  const res = await fetch(`/api/admin/sync-schedules/${source}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as SyncScheduleDTO | { error: string } | null;
  if (!res.ok || !data || 'error' in data) {
    throw new Error(data && 'error' in data ? data.error : `Request failed (${res.status})`);
  }
  return data;
}

// ── Team roles ──────────────────────────────────────────────────────────
export function teamRolesUrl(): string {
  return '/api/admin/team-roles';
}

export function createTeamRole(body: { name: string; canApprove: boolean }): Promise<TeamRoleDTO> {
  return postJson<TeamRoleDTO>('/api/admin/team-roles', body);
}

export async function updateTeamRole(
  id: number,
  body: { name?: string; canApprove?: boolean },
): Promise<TeamRoleDTO> {
  const res = await fetch(`/api/admin/team-roles/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as TeamRoleDTO | { error: string } | null;
  if (!res.ok || !data || 'error' in data) {
    throw new Error(data && 'error' in data ? data.error : `Request failed (${res.status})`);
  }
  return data;
}

// ── Approvals ───────────────────────────────────────────────────────────
export function approvalsUrl(filters?: { status?: ApprovalStatus; mine?: boolean }): string {
  return `/api/approvals${qs({
    status: filters?.status,
    mine: filters?.mine ? '1' : undefined,
  })}`;
}

export function approvalDetailUrl(id: number): string {
  return `/api/approvals/${id}`;
}

async function postForm<T>(url: string, form: FormData): Promise<T> {
  const res = await fetch(url, { method: 'POST', body: form });
  const data = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export function submitApproval(body: {
  clientId?: number | null;
  campaignId?: number | null;
  title?: string;
  caption?: string;
  image: File;
}): Promise<{ id: number }> {
  const form = new FormData();
  if (body.clientId) form.set('clientId', String(body.clientId));
  if (body.campaignId) form.set('campaignId', String(body.campaignId));
  if (body.title) form.set('title', body.title);
  if (body.caption) form.set('caption', body.caption);
  form.set('image', body.image);
  return postForm<{ id: number }>('/api/approvals', form);
}

export function addApprovalComment(id: number, comment: string): Promise<{ ok: boolean }> {
  return postJson(`/api/approvals/${id}/comment`, { comment });
}

export function decideApproval(
  id: number,
  decision: 'approved' | 'rejected',
  comment?: string,
): Promise<{ ok: boolean }> {
  return postJson(`/api/approvals/${id}/decision`, { decision, comment });
}

export function resubmitApproval(
  id: number,
  body: { title?: string; caption?: string; image?: File },
): Promise<{ ok: boolean }> {
  const form = new FormData();
  if (body.title) form.set('title', body.title);
  if (body.caption) form.set('caption', body.caption);
  if (body.image) form.set('image', body.image);
  return postForm(`/api/approvals/${id}/resubmit`, form);
}

export type { ApprovalDetailDTO, ApprovalSubmissionDTO };
