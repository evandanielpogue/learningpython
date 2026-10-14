import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';

/* Self-hosted: Inter as one variable file, JetBrains Mono for copyable values. */
const inter = localFont({
  src: './fonts/inter-latin-wght-normal.woff2',
  variable: '--font-inter',
  weight: '100 900',
  display: 'swap',
});

const jetbrains = localFont({
  src: [
    { path: './fonts/jetbrains-mono-latin-400-normal.woff2', weight: '400' },
    { path: './fonts/jetbrains-mono-latin-500-normal.woff2', weight: '500' },
  ],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Frontdoor', template: '%s · Frontdoor' },
  description: 'Get hired by going in the front door: one company at a time.',
};

export const viewport: Viewport = {
  themeColor: '#0b1b27',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable} h-full`}>
      <body className="min-h-full">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
