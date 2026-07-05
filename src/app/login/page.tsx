'use client';

import { useState, FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const callbackUrl = params.get('callbackUrl') ?? '/';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      // A DB outage surfaces as the same generic error as a wrong password.
      // Probe /api/health to tell them apart and show an honest message.
      const dbDown = await isDatabaseDown();
      setLoading(false);
      setError(
        dbDown
          ? "Can't reach the database, so sign-in is temporarily unavailable — this isn't your password. Please try again shortly."
          : 'Incorrect email or password.',
      );
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  async function isDatabaseDown(): Promise<boolean> {
    // Healthy DB responds fast; a slow/failed probe means it's unreachable.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    try {
      const res = await fetch('/api/health', { signal: controller.signal, cache: 'no-store' });
      if (!res.ok) return true;
      const body = (await res.json()) as { database?: string };
      return body.database !== 'connected';
    } catch {
      return true;
    } finally {
      clearTimeout(timer);
    }
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden p-4"
      style={{ background: 'linear-gradient(180deg, #180b33 0%, #10061f 100%)' }}
    >
      {/* Ambient brand glows */}
      <div
        className="pointer-events-none absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full opacity-[0.13]"
        style={{ background: 'radial-gradient(circle, #ffd500, transparent 65%)' }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-48 -right-40 h-[520px] w-[520px] rounded-full opacity-[0.11]"
        style={{ background: 'radial-gradient(circle, #00d9d0, transparent 65%)' }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.07]"
        style={{ background: 'radial-gradient(circle, #c79dfe, transparent 60%)' }}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="mb-9 flex items-center justify-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/ice-logo-white.svg" alt="ICE" className="h-8 w-auto" />
          <span className="font-display text-2xl font-extrabold leading-none text-white">
            Pulse
          </span>
          <span
            className="rounded-full px-1.5 py-0.5 text-[8px] font-bold tracking-wider"
            style={{ background: 'var(--gold)', color: '#14082a' }}
          >
            BETA
          </span>
        </div>

        <div
          className="rounded-3xl border p-8 backdrop-blur-xl"
          style={{
            background: 'rgba(255,255,255,0.045)',
            borderColor: 'rgba(255,255,255,0.1)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
          }}
        >
          <h1 className="mb-1.5 text-center text-lg font-semibold text-white">
            Welcome back
          </h1>
          <p className="mb-7 text-center text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Marketing intelligence for ICE Creates
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-xs font-medium"
                style={{ color: 'rgba(255,255,255,0.65)' }}
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border px-3.5 py-2.5 text-sm text-white outline-none transition-all placeholder:text-white/25 focus:border-[#ffd500]/60 focus:ring-2 focus:ring-[#ffd500]/20"
                style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' }}
                placeholder="you@icecreates.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-xs font-medium"
                style={{ color: 'rgba(255,255,255,0.65)' }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border px-3.5 py-2.5 text-sm text-white outline-none transition-all placeholder:text-white/25 focus:border-[#ffd500]/60 focus:ring-2 focus:ring-[#ffd500]/20"
                style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' }}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p
                className="rounded-xl px-3 py-2 text-xs font-medium"
                style={{ background: 'rgba(255,91,106,0.14)', color: '#ff8b97' }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all hover:-translate-y-px hover:brightness-105 disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg, #ffd500, #ffb800)',
                color: '#14082a',
                boxShadow: '0 8px 24px rgba(255,213,0,0.25)',
              }}
            >
              {loading ? (
                <i className="bi bi-arrow-repeat animate-spin" aria-hidden="true" />
              ) : null}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="mt-7 text-center text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Access is by invitation only.{' '}
          <a href="mailto:hello@icecreates.com" style={{ color: 'var(--gold)' }}>
            Contact ICE Creates
          </a>{' '}
          if you need access.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
