import type { Metadata } from 'next';
import { HeroSection } from '@/components/public/home/HeroSection';
import { PractitionersSection } from '@/components/public/home/PractitionersSection';
import { SoulTravelsBanner } from '@/components/public/home/SoulTravelsBanner';
import { SoulTravelsUpdates } from '@/components/public/home/SoulTravelsUpdates';
import { ShopSection } from '@/components/public/home/ShopSection';
import { EventsSection } from '@/components/public/home/EventsSection';

export const metadata: Metadata = {
  title: 'Spiritual California — Find Your Guide. Begin Your Journey.',
  description:
    'A trusted marketplace connecting seekers with verified guides — across coaching, therapy, traditional medicine, and spiritual practice.',
};

async function getHomeData() {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
    const res = await fetch(`${apiUrl}/home`, {
      next: { revalidate: 60 }, // Cache for 60 seconds
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const data = await getHomeData();

  return (
    <>
      <HeroSection />
      <PractitionersSection
        guides={data?.featuredGuides}
        blogPosts={data?.recentBlogPosts}
      />
      <SoulTravelsBanner />
      <SoulTravelsUpdates soulTravels={data?.soulTravelEvents} />
      <ShopSection products={data?.activeProducts} />
      <EventsSection events={data?.upcomingEvents} />
    </>
  );
}
