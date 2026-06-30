import type { ReactNode } from 'react';

export function Card({
  children,
  className = '',
  interactive = false,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  padded?: boolean;
}) {
  return (
    <div
      className={`ice-card ${interactive ? 'ice-card-interactive' : ''} ${
        padded ? 'p-5' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}
