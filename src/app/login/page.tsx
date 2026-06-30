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
    setLoading(false);
    if (result?.error) {
      setError('Incorrect email or password.');
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ background: 'var(--page-bg)' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex items-center justify-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/ice-logo-indigo.svg" alt="ICE" className="h-8 w-auto" />
          <span
            className="font-display text-xl font-extrabold leading-none"
            style={{ color: 'var(--text-primary)' }}
          >
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
          className="rounded-2xl border p-8"
          style={{
            background: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
            boxShadow: '0 8px 32px rgba(20,8,42,0.08)',
          }}
        >
          <h1
            className="mb-1 text-center text-lg font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            Sign in to ICE Pulse
          </h1>
          <p className="mb-6 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            Marketing intelligence for ICE Creates
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-xs font-semibold"
                style={{ color: 'var(--text-secondary)' }}
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
                className="ice-search w-full px-3 py-2.5 text-sm"
                placeholder="you@icecreates.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-xs font-semibold"
                style={{ color: 'var(--text-secondary)' }}
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
                className="ice-search w-full px-3 py-2.5 text-sm"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="rounded-lg px-3 py-2 text-xs font-medium" style={{ background: 'var(--red-subtle)', color: 'var(--red)' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="ice-pill-btn-gold w-full justify-center py-2.5 text-sm disabled:opacity-60"
            >
              {loading ? (
                <i className="bi bi-arrow-repeat animate-spin" aria-hidden="true" />
              ) : null}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-[11px]" style={{ color: 'var(--text-muted)' }}>
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
