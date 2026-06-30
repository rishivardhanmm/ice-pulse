'use client';

import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { AiStatusProvider } from '../ai/AiStatusProvider';
import { AssistantProvider } from '../ai/AssistantProvider';
import { AssistantLauncher } from '../ai/AssistantLauncher';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <AiStatusProvider>
      <AssistantProvider>
        <Sidebar open={open} onClose={() => setOpen(false)} />
        {open && (
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            aria-hidden="true"
          />
        )}
        <Topbar onMenuClick={() => setOpen(true)} />
        <main className="min-h-screen pt-16 lg:ml-[248px]">
          <div className="mx-auto w-full max-w-[1440px] animate-fadeIn p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
        <AssistantLauncher />
      </AssistantProvider>
    </AiStatusProvider>
  );
}
