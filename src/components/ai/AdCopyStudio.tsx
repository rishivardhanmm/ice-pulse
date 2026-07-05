'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import type { AdCopyPlatform, AdCopyResult, AdCopyVariant } from '@/lib/types';

const TONES = ['Confident & warm', 'Playful', 'Urgent', 'Empathetic', 'Bold & punchy', 'Professional'];

const LIMITS: Record<AdCopyPlatform, { headline: number; description: number; primaryText?: number }> = {
  google: { headline: 30, description: 90 },
  meta: { headline: 40, description: 30, primaryText: 125 },
};

function CharCount({ text, max }: { text: string; max: number }) {
  const over = text.length > max;
  return (
    <span
      className="ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold tabular-nums"
      style={{
        background: over ? 'var(--red-subtle)' : 'var(--status-neutral-bg)',
        color: over ? 'var(--red)' : 'var(--text-muted)',
      }}
    >
      {text.length}/{max}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        });
      }}
      className="ice-icon-btn h-7 w-7 text-xs"
      title="Copy to clipboard"
      aria-label="Copy to clipboard"
    >
      <i className={`bi ${copied ? 'bi-check-lg' : 'bi-clipboard'}`} aria-hidden="true" />
    </button>
  );
}

function VariantCard({ variant, platform, index }: { variant: AdCopyVariant; platform: AdCopyPlatform; index: number }) {
  const limits = LIMITS[platform];
  const full = [variant.primaryText, variant.headline, variant.description].filter(Boolean).join('\n');
  return (
    <Card className="relative">
      <div className="mb-3 flex items-center justify-between">
        <span
          className="rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide"
          style={{ background: 'var(--status-neutral-bg)', color: 'var(--text-secondary)' }}
        >
          VARIANT {index + 1}
        </span>
        <CopyButton text={full} />
      </div>

      {variant.primaryText && (
        <div className="mb-3">
          <p className="mb-0.5 flex items-center text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            Primary text
            <CharCount text={variant.primaryText} max={limits.primaryText ?? 125} />
          </p>
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {variant.primaryText}
          </p>
        </div>
      )}

      <div className="mb-3">
        <p className="mb-0.5 flex items-center text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          Headline
          <CharCount text={variant.headline} max={limits.headline} />
        </p>
        <p className="text-[15px] font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
          {variant.headline}
        </p>
      </div>

      <div>
        <p className="mb-0.5 flex items-center text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          Description
          <CharCount text={variant.description} max={limits.description} />
        </p>
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {variant.description}
        </p>
      </div>
    </Card>
  );
}

const inputStyle = {
  background: 'var(--search-bg)',
  border: '1px solid var(--search-border)',
  color: 'var(--search-text)',
} as const;

export function AdCopyStudio() {
  const sp = useSearchParams();
  const [platform, setPlatform] = useState<AdCopyPlatform>('google');
  const [product, setProduct] = useState('');
  const [audience, setAudience] = useState('');
  const [tone, setTone] = useState(TONES[0]);
  const [keyPoints, setKeyPoints] = useState('');
  // Prefilled when arriving from News Insights via "Create ad copy from this hook".
  const [newsHook, setNewsHook] = useState(sp.get('hook') ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AdCopyResult | null>(null);

  async function generate() {
    if (!product.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ai/ad-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, product, audience, tone, keyPoints, newsHook, variants: 5 }),
      });
      const body = (await res.json()) as AdCopyResult & { error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setResult(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Ad Copy Studio"
        subtitle="AI-drafted ad copy variants that respect each platform's character limits — starting points for the creative team, not final ads."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px,1fr]">
        {/* Brief form */}
        <Card className="h-fit">
          <h2 className="ice-section-title mb-4 text-base">The brief</h2>

          <div className="mb-4">
            <p className="mb-1.5 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Platform
            </p>
            <div className="flex gap-2">
              {(['google', 'meta'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatform(p)}
                  className="flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition-colors"
                  style={
                    platform === p
                      ? { background: 'var(--indigo)', color: '#fff' }
                      : { background: 'var(--surface)', color: 'var(--text-secondary)' }
                  }
                >
                  <i className={`bi ${p === 'google' ? 'bi-google' : 'bi-meta'} mr-1.5`} aria-hidden="true" />
                  {p === 'google' ? 'Google Search' : 'Meta (FB/IG)'}
                </button>
              ))}
            </div>
          </div>

          <label className="mb-4 block">
            <span className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              What are we promoting? <span style={{ color: 'var(--red)' }}>*</span>
            </span>
            <textarea
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              rows={3}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={inputStyle}
              placeholder="e.g. NHS stop-smoking support programme for new parents in Liverpool"
            />
          </label>

          <label className="mb-4 block">
            <span className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Target audience
            </span>
            <input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={inputStyle}
              placeholder="e.g. parents aged 25-40 who smoke"
            />
          </label>

          <label className="mb-4 block">
            <span className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Tone of voice
            </span>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={inputStyle}
            >
              {TONES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="mb-4 block">
            <span className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Key points (optional)
            </span>
            <textarea
              value={keyPoints}
              onChange={(e) => setKeyPoints(e.target.value)}
              rows={2}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={inputStyle}
              placeholder="e.g. free service, 12-week programme, local support groups"
            />
          </label>

          <label className="mb-5 block">
            <span className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              Newsjacking hook (optional)
            </span>
            <textarea
              value={newsHook}
              onChange={(e) => setNewsHook(e.target.value)}
              rows={2}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={inputStyle}
              placeholder="Paste a marketing hook from News Insights to tie the copy to a timely story"
            />
          </label>

          {error && (
            <p className="mb-4 rounded-xl px-3 py-2 text-xs font-medium" style={{ background: 'var(--red-subtle)', color: 'var(--red)' }}>
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={() => void generate()}
            disabled={!product.trim() || loading}
            className="ice-pill-btn-gold w-full justify-center py-2.5"
          >
            <i className={`bi ${loading ? 'bi-arrow-repeat animate-spin' : 'bi-stars'}`} aria-hidden="true" />
            {loading ? 'Writing…' : 'Generate 5 variants'}
          </button>
        </Card>

        {/* Results */}
        <div>
          {!result && !loading && (
            <Card className="flex min-h-[280px] flex-col items-center justify-center text-center">
              <div
                className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl text-xl"
                style={{ background: 'var(--ai-bg)', border: '1px solid var(--ai-border)' }}
              >
                <i className="bi bi-stars" style={{ color: 'var(--violet)' }} aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Describe the brief, get 5 on-limit variants
              </p>
              <p className="mt-1 max-w-sm text-xs" style={{ color: 'var(--text-muted)' }}>
                Each variant takes a different creative angle. Character counts are validated against{' '}
                {platform === 'google' ? 'Google RSA' : 'Meta'} limits so everything is ready to paste in.
              </p>
            </Card>
          )}

          {loading && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-40 rounded-2xl" />
              ))}
            </div>
          )}

          {result && !loading && (
            <>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {result.variants.length} variants · {result.model} · ~${result.usage.estimatedCostUsd.toFixed(4)}
                </p>
                <button type="button" onClick={() => void generate()} className="ice-action-chip" disabled={loading}>
                  <i className="bi bi-arrow-clockwise" aria-hidden="true" /> Regenerate
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {result.variants.map((v, i) => (
                  <VariantCard key={i} variant={v} platform={result.platform} index={i} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
