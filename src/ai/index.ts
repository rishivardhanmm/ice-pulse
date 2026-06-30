import { getAiConfig } from '../server/config/env';
import type { AiProvider } from './provider';
import { OpenAiProvider } from './openai';

/** Returns the configured AI provider (throws via getAiConfig if not configured). */
export function getAiProvider(): AiProvider {
  const cfg = getAiConfig();
  switch (cfg.provider) {
    case 'openai':
    default:
      return new OpenAiProvider();
  }
}
