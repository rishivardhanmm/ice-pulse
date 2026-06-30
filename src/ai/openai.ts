import { getAiConfig } from '../server/config/env';
import type { AiCompleteOptions, AiCompletion, AiProvider } from './provider';

interface OpenAiResponse {
  model?: string;
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  error?: { message?: string };
}

/** OpenAI Chat Completions provider (raw fetch — no SDK dependency). */
export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';

  async complete(options: AiCompleteOptions): Promise<AiCompletion> {
    const cfg = getAiConfig();
    const body = {
      model: cfg.model,
      messages: [{ role: 'system', content: options.system }, ...options.messages],
      max_tokens: options.maxTokens ?? cfg.maxOutputTokens,
      temperature: 0.3,
      ...(options.json ? { response_format: { type: 'json_object' as const } } : {}),
    };

    const resp = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        // Azure AI Foundry's OpenAI-compatible endpoint also accepts this header.
        'api-key': cfg.apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const raw = await resp.text();
    let data: OpenAiResponse | null = null;
    try {
      data = raw ? (JSON.parse(raw) as OpenAiResponse) : null;
    } catch {
      data = null;
    }

    if (!resp.ok) {
      const message = data?.error?.message ?? `${resp.status} ${resp.statusText}`;
      throw new Error(`OpenAI API error: ${message}`);
    }

    const usage = data?.usage ?? {};
    return {
      text: data?.choices?.[0]?.message?.content ?? '',
      model: data?.model ?? cfg.model,
      usage: {
        promptTokens: Number(usage.prompt_tokens ?? 0),
        completionTokens: Number(usage.completion_tokens ?? 0),
        totalTokens: Number(usage.total_tokens ?? 0),
      },
    };
  }
}
