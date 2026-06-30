'use client';

import { THEME_ICONS, THEME_LABELS, useTheme } from './ThemeProvider';

export function ThemeToggle() {
  const { theme, cycleTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={cycleTheme}
      title={`Theme: ${THEME_LABELS[theme]} — click to switch`}
      aria-label={`Switch theme (current: ${THEME_LABELS[theme]})`}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-base transition-colors"
      style={{ background: 'var(--icon-btn-bg)', color: 'var(--icon-btn-text)' }}
    >
      <i className={`bi ${THEME_ICONS[theme]}`} aria-hidden="true" />
    </button>
  );
}
