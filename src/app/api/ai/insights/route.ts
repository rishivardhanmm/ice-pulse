import { generateInsights } from '@/ai/ai.service';
import { isAiConfigured } from '@/server/config/env';
import { jsonOk, jsonError } from '@/server/api/http';
import { defaultRange, isValidDateStr } from '@/lib/date';
import { toErrorMessage } from '@/server/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!isAiConfigured()) {
    return jsonError('AI is not configured. Set AI_ENABLED=true and OPENAI_API_KEY in .env.local.', 400);
  }
  try {
    let body: { from?: string; to?: string } = {};
    try {
      body = (await req.json()) as { from?: string; to?: string };
    } catch {
      body = {};
    }
    const def = defaultRange(30);
    const from = isValidDateStr(body.from) ? (body.from as string) : def.from;
    const to = isValidDateStr(body.to) ? (body.to as string) : def.to;
    const range = from > to ? { from: to, to: from } : { from, to };
    const data = await generateInsights(range.from, range.to);
    return jsonOk(data);
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}
