import type { Config } from 'tailwindcss';

/**
 * ICE Pulse Tailwind config.
 *
 * Brand colours are constant across themes and taken straight from the ICE
 * brand kit. Everything that changes per theme (backgrounds, surfaces, text,
 * borders) is exposed as a CSS variable in `globals.css` and referenced here so
 * utility classes automatically follow the active theme (dark / light / calm).
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Constant ICE brand palette
        gold: '#FFD500',
        teal: '#00D9D0',
        cerise: '#FF86EF',
        violet: '#C79DFE',
        ice: {
          green: '#22D3A0',
          orange: '#FF9D4D',
          red: '#FF5B6A',
        },
        indigo: {
          DEFAULT: '#14082A',
          mid: '#1e0f3d',
        },
        // Theme-aware semantic tokens (driven by CSS variables)
        bg: 'var(--bg)',
        'bg-secondary': 'var(--bg-secondary)',
        surface: 'var(--surface)',
        'surface-hover': 'var(--surface-hover)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        card: 'var(--card-bg)',
        'card-border': 'var(--card-border)',
        sidebar: 'var(--sidebar-bg)',
      },
      fontFamily: {
        display: ['var(--font-albra)', 'Georgia', 'serif'],
        sans: ['var(--font-poppins)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        ice: '16px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(20,8,42,0.03), 0 4px 16px rgba(20,8,42,0.04)',
        'card-hover': '0 2px 4px rgba(20,8,42,0.05), 0 12px 32px rgba(20,8,42,0.1)',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(255,213,0,0.4)' },
          '50%': { opacity: '0.8', transform: 'scale(1.1)', boxShadow: '0 0 0 6px rgba(255,213,0,0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.25s ease',
        pulseDot: 'pulseDot 2s ease-in-out infinite',
        shimmer: 'shimmer 1.4s infinite',
      },
    },
  },
  plugins: [],
};

export default config;
