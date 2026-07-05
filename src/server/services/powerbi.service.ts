import { getPowerBIConfig } from '../config/env';
import {
  generateEmbedToken,
  listReportsInWorkspace,
  listWorkspaces,
  type PBIEmbedToken,
  type PBIReport,
} from '../../integrations/power-bi/client';
import type { PowerBIReportDTO, PowerBIWorkspaceDTO } from '../../lib/types';

let reportsCache: { data: PowerBIReportDTO[]; expiresAt: number } | null = null;

function toReportDTO(r: PBIReport): PowerBIReportDTO {
  return {
    id: r.id,
    name: r.name,
    webUrl: r.webUrl,
    embedUrl: r.embedUrl,
    datasetId: r.datasetId,
    workspaceId: r.workspaceId,
    workspaceName: r.workspaceName,
    reportType: r.reportType ?? 'PowerBIReport',
  };
}

export async function getAllReports(force = false): Promise<PowerBIReportDTO[]> {
  if (!force && reportsCache && Date.now() < reportsCache.expiresAt) {
    return reportsCache.data;
  }

  const { tenantId, clientId, clientSecret } = getPowerBIConfig();

  const workspaces = await listWorkspaces(tenantId, clientId, clientSecret);

  const pages = await Promise.allSettled(
    workspaces.map((ws) =>
      listReportsInWorkspace(ws.id, ws.name, tenantId, clientId, clientSecret),
    ),
  );

  const data: PowerBIReportDTO[] = [];
  for (const page of pages) {
    if (page.status === 'fulfilled') {
      data.push(...page.value.map(toReportDTO));
    }
  }

  reportsCache = { data, expiresAt: Date.now() + 10 * 60_000 };
  return data;
}

export async function getWorkspaces(): Promise<PowerBIWorkspaceDTO[]> {
  const { tenantId, clientId, clientSecret } = getPowerBIConfig();
  const workspaces = await listWorkspaces(tenantId, clientId, clientSecret);
  return workspaces.map((ws) => ({ id: ws.id, name: ws.name, type: ws.type }));
}

export async function getEmbedToken(
  workspaceId: string,
  reportId: string,
): Promise<PBIEmbedToken> {
  const { tenantId, clientId, clientSecret } = getPowerBIConfig();
  return generateEmbedToken(workspaceId, reportId, tenantId, clientId, clientSecret);
}
