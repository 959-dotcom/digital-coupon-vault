import type { Metadata } from 'next';
import { IBM_Plex_Mono, Noto_Sans_Thai } from 'next/font/google';
import { Providers } from './providers';
import { copy } from '@/lib/copy';
import './globals.css';

const sans = Noto_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex',
});

export const metadata: Metadata = {
  title: `${copy.brand} — ${copy.tagline}`,
  description: copy.tagline,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className={`${sans.variable} ${mono.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
