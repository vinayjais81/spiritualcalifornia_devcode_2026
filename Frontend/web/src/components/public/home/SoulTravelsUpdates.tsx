import { SectionHeader } from '@/components/public/shared/SectionHeader';
import { UpdateCard } from '@/components/public/shared/UpdateCard';
import { Carousel } from '@/components/public/shared/Carousel';

interface SoulTravel {
  id: string;
  title: string;
  startTime: string;
  location: string | null;
  coverImageUrl: string | null;
  startingPrice: number | string;
  guide: { slug: string; displayName: string; avatarUrl: string | null };
}

const staticUpdates = [
  { image: '/images/ayurveda.jpg', imageAlt: 'Retreat', destination: 'California · Big Sur', title: 'Dawn at Esalen: A Morning That Changed Everything', excerpt: 'The Pacific was still dark when we gathered on the cliff edge. What we witnessed was not just a sunrise — it was a mirror...', date: 'Upcoming · By Spiritual CA', href: '/travels' },
  { image: '/images/poppy_close.jpg', imageAlt: 'Retreat', destination: 'California · Mount Shasta', title: 'Sacred Mountain: Crystal Healing at the Vortex', excerpt: 'At the base of Mount Shasta, the energy is palpable. Our group sat in circle with crystals as the mountain held us...', date: 'Upcoming · By Spiritual CA', href: '/travels' },
  { image: '/images/yoga_outdoor.jpg', imageAlt: 'Retreat', destination: 'California · Joshua Tree', title: 'Desert Drums: Rhythm and Renewal Under the Stars', excerpt: 'The Milky Way was impossibly bright. Our drum circle echoed off the boulders as something ancient moved through us...', date: 'Upcoming · By Spiritual CA', href: '/travels' },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatPrice(p: number | string) {
  const n = typeof p === 'string' ? parseFloat(p) : p;
  return n === 0 ? 'Free' : `from $${n.toFixed(0)}`;
}

interface Props {
  soulTravels?: SoulTravel[] | null;
}

export function SoulTravelsUpdates({ soulTravels }: Props) {
  const cards = soulTravels && soulTravels.length > 0
    ? soulTravels.map(s => ({
        image: s.coverImageUrl || '/images/poppy_field.jpg',
        imageAlt: s.title,
        destination: s.location || 'California',
        title: s.title,
        excerpt: `${formatPrice(s.startingPrice)} · Led by ${s.guide.displayName}`,
        date: formatDate(s.startTime),
        href: '/travels',
      }))
    : staticUpdates;

  return (
    <section style={{ padding: '64px 0 72px', background: '#FFFFFF' }}>
      <SectionHeader title="Soul Travels" linkLabel="All Retreats" linkHref="/travels" />

      <Carousel id="travels-feed">
        {cards.map(u => (
          <div key={u.title} data-card>
            <UpdateCard {...u} />
          </div>
        ))}
      </Carousel>
    </section>
  );
}
