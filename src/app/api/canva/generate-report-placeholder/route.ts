import { getActiveConnection, getCapabilities } from '@/server/db/repositories/canva.repo';
import { buildCanvaReportPayload, describeGenerationAvailability } from '@/integrations/canva';
import { defaultRange, isValidDateStr } from '@/lib/date';
import { jsonError, jsonOk } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Placeholder for future Canva report generation. Returns the data payload plus
 * whether the connected account can actually generate (Autofill capability).
 * Does NOT create a design — generation is implemented only once the capability
 * is confirmed available.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      from?: string;
      to?: string;
      clientId?: number;
      campaignId?: number;
      templateId?: string;
    };
    const def = defaultRange(30);
    const from = isValidDateStr(body.from) ? (body.from as string) : def.from;
    const to = isValidDateStr(body.to) ? (body.to as string) : def.to;

    const payload = await buildCanvaReportPayload(from, to);
    const conn = await getActiveConnection();
    const capabilities = conn ? await getCapabilities(conn.id) : [];
    const generation = describeGenerationAvailability(capabilities);

    return jsonOk({ status: 'placeholder', generation, payload });
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}
