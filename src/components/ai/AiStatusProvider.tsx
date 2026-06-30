'use client';

import { createContext, useContext } from 'react';
import { aiUsageUrl } from '@/lib/api-client';
import { useFetch } from '@/lib/use-fetch';
import type { AiUsageSummaryDTO } from '@/lib/types';

interface AiStatusValue {
  enabled: boolean;
  configured: boolean;
  model: string;
  usage: AiUsageSummaryDTO | null;
  loading: boolean;
  refresh: () => void;
}

const FALLBACK: AiStatusValue = {
  enabled: false,
  configured: false,
  model: 'gpt-4o-mini',
  usage: null,
  loading: false,
  refresh: () => {},
};

const AiStatusContext = createContext<AiStatusValue | null>(null);

export function AiStatusProvider({ children }: { children: React.ReactNode }) {
  const { data, loading, refetch } = useFetch<AiUsageSummaryDTO>(aiUsageUrl());
  const value: AiStatusValue = {
    enabled: data?.enabled ?? false,
    configured: data?.configured ?? false,
    model: data?.model ?? 'gpt-4o-mini',
    usage: data,
    loading,
    refresh: refetch,
  };
  return <AiStatusContext.Provider value={value}>{children}</AiStatusContext.Provider>;
}

export function useAiStatus(): AiStatusValue {
  return useContext(AiStatusContext) ?? FALLBACK;
}
