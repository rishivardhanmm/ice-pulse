import './globals.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { SessionWrapper } from '@/components/auth/SessionWrapper';

export const metadata: Metadata = {
  title: 'ICE Pulse — Marketing Intelligence',
  description: 'Internal marketing intelligence dashboard for ICE Creates.',
};

// Applies the saved theme before paint to avoid a flash of the wrong theme.
const themeBootScript = `(function(){try{var t=localStorage.getItem('ice-theme');if(!t||['light','calm'].indexOf(t)<0)t='light';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <SessionWrapper>
          <ThemeProvider>{children}</ThemeProvider>
        </SessionWrapper>
      </body>
    </html>
  );
}
