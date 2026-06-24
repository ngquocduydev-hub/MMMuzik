import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';

/**
 * Inter is the design's typeface (UI.png §Typography). The variable font is
 * SELF-HOSTED from the repo (not fetched from Google Fonts at build time) so the
 * Docker/CI build never depends on external network — see docs/features. Exposed via
 * a CSS variable consumed by tailwind's `font-sans`.
 */
const inter = localFont({
  src: './fonts/inter-latin-variable.woff2',
  weight: '100 900',
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'MMMuzik — Listen together, in real time',
  description: 'Share a link. Listen together. Right now.',
  applicationName: 'MMMuzik',
};

export const viewport: Viewport = {
  themeColor: '#0d0d14',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
