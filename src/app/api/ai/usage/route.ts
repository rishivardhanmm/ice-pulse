import { getAiUsageData, type AiUsageData } from '@/server/db/repositories/aiUsage.repo';
import { describeConfigState } from '@/server/config/env';
import { jsonOk, jsonError } from '@/server/api/http';
import { toErrorMessage } from '@/server/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMPTY_BUCKET = {
  calls: 0,
  totalTokens: 0,
  promptTokens: 0,
  completionTokens: 0,
  costUsd: 0,
};
const EMPTY: AiUsageData = {
  today: EMPTY_BUCKET,
  month: EMPTY_BUCKET,
  allTime: EMPTY_BUCKET,
  byFeature: [],
  recent: [],
};

export async function GET() {
  try {
    const ai = describeConfigState().ai;
    // Tolerate a missing ai_usage table (pre-migration) — report zeros, not 500.
    let data: AiUsageData = EMPTY;
    try {
      data = await getAiUsageData();
    } catch {
      data = EMPTY;
    }
    return jsonOk({ enabled: ai.enabled, configured: ai.configured, model: ai.model, ...data });
  } catch (err) {
    return jsonError(toErrorMessage(err), 500);
  }
}
