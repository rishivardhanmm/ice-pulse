'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import { useAiStatus } from './AiStatusProvider';
import { AssistantOverlay } from './AssistantOverlay';

interface AssistantValue {
  /** Open the full-screen assistant; optionally pre-fill and auto-send a question. */
  openAssistant: (question?: string) => void;
  closeAssistant: () => void;
}

const AssistantContext = createContext<AssistantValue | null>(null);

/**
 * Single host for the Pulse Assistant overlay so any surface (the floating
 * launcher, the dashboard "Ask Pulse" bar, …) can open it — with an optional
 * pre-filled question — from one place.
 */
export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const { configured } = useAiStatus();
  const [open, setOpen] = useState(false);
  const [seed, setSeed] = useState(0); // bump to remount the chat on each open
  const [initialQuestion, setInitialQuestion] = useState<string | undefined>(undefined);

  const openAssistant = useCallback((question?: string) => {
    setInitialQuestion(question);
    setSeed((s) => s + 1);
    setOpen(true);
  }, []);
  const closeAssistant = useCallback(() => setOpen(false), []);

  return (
    <AssistantContext.Provider value={{ openAssistant, closeAssistant }}>
      {children}
      {configured && open && (
        <AssistantOverlay key={seed} initialQuestion={initialQuestion} onClose={closeAssistant} />
      )}
    </AssistantContext.Provider>
  );
}

export function useAssistant(): AssistantValue {
  return useContext(AssistantContext) ?? { openAssistant: () => {}, closeAssistant: () => {} };
}
