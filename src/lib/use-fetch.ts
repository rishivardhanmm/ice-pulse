'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Small typed data hook. Cancels stale responses (last request wins), reads the
 * JSON `error` field on non-2xx responses, and re-runs when `url` changes.
 * Pass `null` to skip fetching.
 */
export function useFetch<T>(url: string | null): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(url));
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const run = useCallback(async () => {
    if (!url) {
      setLoading(false);
      return;
    }
    const id = (requestId.current += 1);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, { cache: 'no-store' });
      const body = (await res.json().catch(() => null)) as unknown;
      if (id !== requestId.current) return; // a newer request superseded this one
      if (!res.ok) {
        const message =
          body && typeof body === 'object' && 'error' in body
            ? String((body as { error: unknown }).error)
            : `Request failed (${res.status})`;
        setError(message);
        setData(null);
      } else {
        setData(body as T);
      }
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err instanceof Error ? err.message : 'Network error');
      setData(null);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    run();
  }, [run]);

  return { data, loading, error, refetch: run };
}
