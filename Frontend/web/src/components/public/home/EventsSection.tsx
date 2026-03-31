import { SectionHeader } from '@/components/public/shared/SectionHeader';
import { FeedCard } from '@/components/public/shared/FeedCard';
import { Carousel } from '@/components/public/shared/Carousel';

interface EventData {
  id: string;
  title: string;
  type: string;
  startTime: string;
  location: string | null;
  coverImageUrl: string | null;
  startingPrice: number | string;
  spotsLeft: number | null;
  guide: { slug: string; displayName: string; avatarUrl: string | null };
}

const staticEvents = [
  { image: '/images/yoga_outdoor.jpg', imageAlt: 'Event', tag: 'Virtual · Meditation', tagVariant: 'default' as const, title: 'New Moon Meditation Circle', excerpt: 'A live guided session to release what no longer serves you and set intentions for the cycle ahead.', avatarImage: '/images/hero1.jpg', avatarAlt: 'Host', metaText: 'Upcoming · Free · 90 min' },
  { image: '/images/hero2.jpg', imageAlt: 'Event', tag: 'In-Person · Healing', tagVariant: 'default' as const, title: 'Somatic Healing Workshop', excerpt: 'A half-day immersive experience in body-based trauma release, breathwork, and movement.', avatarImage: '/images/hero2.jpg', avatarAlt: 'Host', metaText: 'Upcoming · $120 · 4 hours' },
];

function formatEventDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatPrice(p: number | string) {
  const n = typeof p === 'string' ? parseFloat(p) : p;
  return n === 0 ? 'Free' : `$${n.toFixed(0)}`;
}

interface Props {
  events?: EventData[] | null;
}

export function EventsSection({ events }: Props) {
  const cards = events && events.length > 0
    ? events.map(e => ({
        image: e.coverImageUrl || '/images/yoga_outdoor.jpg',
        imageAlt: e.title,
        tag: `${e.type === 'VIRTUAL' ? 'Virtual' : e.type === 'SOUL_TRAVEL' ? 'Soul Travel' : 'In-Person'}${e.location ? ` · ${e.location.split(',')[0]}` : ''}`,
        tagVariant: 'default' as const,
        title: e.title,
        excerpt: e.spotsLeft !== null ? `${e.spotsLeft} spots remaining` : '',
        avatarImage: e.guide.avatarUrl || '/images/logo.jpg',
        avatarAlt: e.guide.displayName,
        metaText: `${formatEventDate(e.startTime)} · ${formatPrice(e.startingPrice)} · ${e.guide.displayName}`,
        href: '/events',
      }))
    : staticEvents.map(s => ({ ...s, href: '/events' }));

  return (
    <section id="events" style={{ padding: '60px 0 72px' }}>
      <SectionHeader title="Upcoming Events" linkLabel="All Events" linkHref="/events" />

      <Carousel id="events-feed">
        {cards.map(event => (
          <div key={event.title} data-card>
            <FeedCard {...event} />
          </div>
        ))}
      </Carousel>
    </section>
  );
}
