import { SectionHeader } from '@/components/public/shared/SectionHeader';
import { UpdateCard } from '@/components/public/shared/UpdateCard';
import { Carousel } from '@/components/public/shared/Carousel';

interface SoulTravel {
  id: string;
  slug: string;
  title: string;
  startTime: string;
  location: string | null;
  coverImageUrl: string | null;
  startingPrice: number | string;
  guide: { slug: string; displayName: string; avatarUrl: string | null };
}

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
  // Hide the section entirely when there are no live tours. Placeholder
  // retreats were misleading — they looked like real offerings.
  if (!soulTravels || soulTravels.length === 0) return null;

  const cards = soulTravels.map(s => ({
    image: s.coverImageUrl || '/images/poppy_field.jpg',
    imageAlt: s.title,
    destination: s.location || 'California',
    title: s.title,
    excerpt: `${formatPrice(s.startingPrice)} · Led by ${s.guide.displayName}`,
    date: formatDate(s.startTime),
    href: `/tours/${s.slug}`,
  }));

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
