import { upsertTemplate } from '@/server/db/repositories/canva.repo';
import { logger } from '@/server/logger';
import { CanvaApiError, canvaApiFetch } from './apiClient';
import { getValidAccessToken } from './tokenService';
import type { CanvaBrandTemplateListResponse } from './types';

/**
 * Syncs the brand templates the connected Canva user can access into Pulse.
 *
 * The Brand Templates API requires the `brand_template` capability (Canva
 * Enterprise). For non-Enterprise accounts this returns `available: false`
 * gracefully rather than erroring — the UI degrades accordingly.
 * Docs: https://www.canva.dev/docs/connect/api-reference/brand-templates/list-brand-templates/
 */
export async function syncBrandTemplates(
  connectionId: number,
): Promise<{ available: boolean; synced: number; reason?: string }> {
  const token = await getValidAccessToken(connectionId);
  let synced = 0;
  let continuation: string | undefined;

  try {
    do {
      const query = continuation ? `?continuation=${encodeURIComponent(continuation)}` : '';
      const res = await canvaApiFetch<CanvaBrandTemplateListResponse>(
        token,
        `/brand-templates${query}`,
      );
      for (const t of res.items ?? []) {
        if (!t.id) continue;
        await upsertTemplate({
          connectionId,
          canvaTemplateId: t.id,
          title: t.title ?? null,
          thumbnailUrl: t.thumbnail?.url ?? null,
          templateType: null,
          source: 'brand_template',
        });
        synced += 1;
      }
      continuation = res.continuation;
    } while (continuation);
    return { available: true, synced };
  } catch (err) {
    // 401/403/404 here typically means the account lacks the brand_template
    // capability (non-Enterprise) — report unavailable instead of failing.
    if (err instanceof CanvaApiError && [401, 403, 404].includes(err.status)) {
      logger.info('Canva brand templates unavailable for this account', { status: err.status });
      return {
        available: false,
        synced,
        reason:
          'Brand template access is not available for this Canva account. This usually requires Canva Enterprise.',
      };
    }
    throw err;
  }
}
