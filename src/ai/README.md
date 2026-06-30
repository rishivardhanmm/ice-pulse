# AI layer (placeholder — Phase 4)

Not implemented yet. Reserves the home for the future AI insights / reporting
assistant and campaign recommendations.

## Important distinction

The current dashboard includes a **"Pulse Assistant"** widget and **insight
cards**. These are **deterministic, rule-based** (e.g. "highest spend
campaign", "best CTR") — they are NOT AI and live in
`src/server/services/insights.ts` and `src/components/`.

## When built

- Add provider clients here (default to the latest Claude models, e.g.
  `claude-opus-4-8`, via the Anthropic API).
- Feed already-aggregated metrics (never raw secrets) as context.
- Keep AI output clearly labelled and separate from deterministic insights.

No AI calls or stubbed prompts should exist here until implemented for real.
