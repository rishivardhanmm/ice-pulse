import { getAiConfig } from '../server/config/env';
import { recordAiUsage } from '../server/db/repositories/aiUsage.repo';
import { logger } from '../server/logger';
import { getAiProvider } from './index';
import type { AiCompleteOptions, AiCompletion } from './provider';

export interface RunAiResult extends AiCompletion {
  estimatedCostUsd: number;
}

/**
 * Runs an AI completion for `feature`, computes the estimated USD cost from the
 * configured per-1M prices, and records token usage. A recording failure is
 * logged but never breaks the feature.
 */
export async function runAi(
  feature: string,
  options: AiCompleteOptions,
  meta?: Record<string, unknown>,
): Promise<RunAiResult> {
  const cfg = getAiConfig();
  const provider = getAiProvider();
  const completion = await provider.complete(options);

  const estimatedCostUsd =
    (completion.usage.promptTokens / 1_000_000) * cfg.inputPricePer1M +
    (completion.usage.completionTokens / 1_000_000) * cfg.outputPricePer1M;

  try {
    await recordAiUsage({
      feature,
      provider: provider.name,
      model: completion.model,
      promptTokens: completion.usage.promptTokens,
      completionTokens: completion.usage.completionTokens,
      totalTokens: completion.usage.totalTokens,
      estimatedCostUsd,
      meta: meta ?? null,
    });
  } catch (err) {
    logger.error('Failed to record AI usage', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return { ...completion, estimatedCostUsd };
}
