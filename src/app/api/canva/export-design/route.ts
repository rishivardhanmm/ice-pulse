import { getActiveConnection } from '@/server/db/repositories/canva.repo';
import { exportDesign, isSupportedFormat } from '@/integrations/canva';
import { jsonError, jsonOk } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Export a Canva design to pdf/png/jpg. Connection-gated; requires design:content:read. */
export async function POST(req: Request) {
  try {
    const conn = await getActiveConnection();
    if (!conn) return jsonError('Canva is not connected.', 409);

    const body = (await req.json().catch(() => ({}))) as { canvaDesignId?: string; format?: string };
    const canvaDesignId = (body.canvaDesignId ?? '').trim();
    const format = (body.format ?? 'pdf').trim().toLowerCase();
    if (!canvaDesignId) return jsonError('canvaDesignId is required.', 400);
    if (!isSupportedFormat(format)) {
      return jsonError('Unsupported export format. Use pdf, png or jpg.', 400);
    }

    const result = await exportDesign({ connectionId: conn.id, canvaDesignId, format });
    return jsonOk(result);
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}
