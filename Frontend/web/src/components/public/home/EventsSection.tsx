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
  // No events yet → render nothing rather than fake cards. The "All Events"
  // link is still reachable from the nav.
  if (!events || events.length === 0) return null;

  const cards = events.map(e => ({
    image: e.coverImageUrl || '/images/yoga_outdoor.jpg',
    imageAlt: e.title,
    tag: `${e.type === 'VIRTUAL' ? 'Virtual' : e.type === 'SOUL_TRAVEL' ? 'Soul Travel' : 'In-Person'}${e.location ? ` · ${e.location.split(',')[0]}` : ''}`,
    tagVariant: 'default' as const,
    title: e.title,
    excerpt: e.spotsLeft !== null ? `${e.spotsLeft} spots remaining` : '',
    avatarImage: e.guide.avatarUrl || '/images/logo.jpg',
    avatarAlt: e.guide.displayName,
    metaText: `${formatEventDate(e.startTime)} · ${formatPrice(e.startingPrice)} · ${e.guide.displayName}`,
    href: `/events/${e.id}`,
  }));

  return (
    <section id="events" style={{ padding: '60px 0 72px' }}>
      <SectionHeader title="Upcoming Events" linkLabel="All Events" linkHref="/events" />

      <Carousel id="events-feed">
        {cards.map((event, i) => (
          <div key={`${event.title}-${i}`} data-card>
            <FeedCard {...event} />
          </div>
        ))}
      </Carousel>
    </section>
  );
}
