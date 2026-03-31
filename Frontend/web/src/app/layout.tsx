import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import { Cormorant_Garamond, Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });

const cormorantGaramond = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant-garamond',
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
        className={`${geist.variable} ${cormorantGaramond.variable} ${inter.variable} font-sans antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
