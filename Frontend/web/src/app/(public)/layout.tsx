import type { Metadata } from 'next';
import { Navbar } from '@/components/public/layout/Navbar';
import { Footer } from '@/components/public/layout/Footer';

export const metadata: Metadata = {
  title: 'Spiritual California — Find Your Guide. Begin Your Journey.',
  description:
    'A trusted marketplace connecting seekers with verified guides — across coaching, therapy, traditional medicine, and spiritual practice.',
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-site">
      <Navbar />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
