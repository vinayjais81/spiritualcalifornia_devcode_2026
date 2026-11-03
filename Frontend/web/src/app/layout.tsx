import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import { Playfair_Display, Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });

// Design v6 rebrand: headings use Playfair Display (was Cormorant Garamond).
// The CSS variable is named --font-playfair-display; the legacy
// --font-cormorant token in globals.css aliases to it so any un-migrated
// `font-cormorant` class still renders Playfair.
const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  // Playfair Display's lightest weight is 400 (Cormorant had 300); the
  // design's 300-weight headings render at 400, which reads similarly.
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-playfair-display',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-inter',
  display: 'swap',
});

// Link-sharing card (Facebook, LinkedIn, WhatsApp, Slack, X…). Crawlers need
// an ABSOLUTE og:image URL, which Next builds from metadataBase — without it
// Next falls back to http://localhost:3000 and every shared link loses its
// image. NEXT_PUBLIC_* is inlined at build time; QA can override it, and the
// fallback is the production domain so a missing var still yields a working
// card.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://spiritualcalifornia.com';

const SHARE_TITLE = 'Spiritual California | Find Your Path';
const SHARE_DESCRIPTION =
  'A trusted marketplace connecting seekers with verified guides for mind, body, and soul.';
const SHARE_IMAGE = {
  url: '/og-image.png',
  width: 1200,
  height: 630,
  alt: 'Spiritual California',
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Spiritual California — Find Your Guide. Begin Your Journey.',
  description:
    'A trusted marketplace connecting seekers with verified guides — across coaching, therapy, traditional medicine, and spiritual practice.',
  // No `url` here on purpose: child pages inherit this whole block, and a
  // fixed og:url would tell Facebook every page IS the homepage.
  openGraph: {
    type: 'website',
    siteName: 'Spiritual California',
    locale: 'en_US',
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
    images: [SHARE_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
    images: [SHARE_IMAGE.url],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${geist.variable} ${playfairDisplay.variable} ${inter.variable} font-sans antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
