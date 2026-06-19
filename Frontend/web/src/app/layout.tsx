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

export const metadata: Metadata = {
  title: 'Spiritual California — Find Your Guide. Begin Your Journey.',
  description:
    'A trusted marketplace connecting seekers with verified guides — across coaching, therapy, traditional medicine, and spiritual practice.',
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
