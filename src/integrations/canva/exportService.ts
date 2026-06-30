import {
  createExportJob,
  updateExportJob,
  upsertDesign,
} from '@/server/db/repositories/canva.repo';
import { canvaApiFetch } from './apiClient';
import { getValidAccessToken } from './tokenService';
import type { CanvaExportJobResponse } from './types';

/**
 * Design export. Requires the `design:content:read` scope and a design the
 * connected user can access. Export is asynchronous, so we create the job and
 * briefly poll for completion.
 * Docs: https://www.canva.dev/docs/connect/api-reference/exports/create-design-export-job/
 */

// Report-relevant formats only (avoids guessing format-specific options).
const SUPPORTED_FORMATS = ['pdf', 'png', 'jpg'] as const;
export type CanvaExportFormat = (typeof SUPPORTED_FORMATS)[number];

export function isSupportedFormat(f: string): f is CanvaExportFormat {
  return (SUPPORTED_FORMATS as readonly string[]).includes(f);
}

function formatPayload(format: CanvaExportFormat): Record<string, unknown> {
  if (format === 'jpg') return { type: 'jpg', quality: 90 }; // jpg requires quality (1-100)
  return { type: format };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface ExportResult {
  jobId: number;
  status: string; // in_progress | success | failed
  downloadUrl: string | null; // short-lived Canva URL, kept internal
  error: string | null;
}

export async function exportDesign(params: {
  connectionId: number;
  canvaDesignId: string;
  format: CanvaExportFormat;
}): Promise<ExportResult> {
  const token = await getValidAccessToken(params.connectionId);
  const designRowId = await upsertDesign({
    connectionId: params.connectionId,
    canvaDesignId: params.canvaDesignId,
    title: null,
  });

  const created = await canvaApiFetch<CanvaExportJobResponse>(token, '/exports', {
    method: 'POST',
    json: { design_id: params.canvaDesignId, format: formatPayload(params.format) },
  });
  let job = created.job;
  const jobRowId = await createExportJob({
    designId: designRowId,
    canvaExportId: job.id,
    exportFormat: params.format,
    status: job.status,
  });

  // Poll briefly (exports usually complete within a few seconds).
  for (let i = 0; i < 6 && job.status === 'in_progress'; i += 1) {
    await sleep(1500);
    const polled = await canvaApiFetch<CanvaExportJobResponse>(token, `/exports/${job.id}`);
    job = polled.job;
  }

  const downloadUrl = job.status === 'success' ? (job.urls?.[0] ?? null) : null;
  const error = job.status === 'failed' ? (job.error?.message ?? 'Export failed') : null;
  await updateExportJob(jobRowId, {
    canvaExportId: job.id,
    status: job.status,
    downloadUrl,
    errorMessage: error,
  });

  return { jobId: jobRowId, status: job.status, downloadUrl, error };
}
