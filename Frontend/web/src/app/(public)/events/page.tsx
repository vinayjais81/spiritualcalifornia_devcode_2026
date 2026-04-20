'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { MiniCalendar } from '@/components/public/shared/MiniCalendar';

// ─── Types ──────────────────────────────────────────────────────────────────

interface TicketTier {
  price: number | string;
  name: string;
  capacity: number;
  sold: number;
}

interface EventGuide {
  displayName: string;
  slug: string;
  isVerified?: boolean;
  user: { avatarUrl: string | null };
}

interface EventItem {
  id: string;
  title: string;
  description?: string | null;
  type: 'VIRTUAL' | 'IN_PERSON' | 'RETREAT' | 'SOUL_TRAVEL';
  startTime: string;
  endTime: string;
  location: string | null;
  coverImageUrl: string | null;
  ticketTiers: TicketTier[];
  guide: EventGuide;
}

// ─── Type filter configuration ──────────────────────────────────────────────

type TypeFilter = 'all' | 'virtual' | 'inperson' | 'retreat' | 'free';

const TYPE_FILTERS: Array<{ value: TypeFilter; label: string }> = [
  { value: 'all',      label: 'All Events' },
  { value: 'virtual',  label: 'Virtual' },
  { value: 'inperson', label: 'In-Person' },
  { value: 'retreat',  label: 'Retreat' },
  { value: 'free',     label: 'Free' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];

const FALLBACK_EVENT_IMAGES = [
  '/images/hero1.jpg',
  '/images/hero2.jpg',
  '/images/hero3.jpg',
  '/images/yoga_outdoor.jpg',
  '/images/ayurveda.jpg',
  '/images/poppy_close.jpg',
  '/images/poppy_field.jpg',
];

function pickFallbackImage(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash + seed.charCodeAt(i)) % 997;
  return FALLBACK_EVENT_IMAGES[hash % FALLBACK_EVENT_IMAGES.length];
}

function toYmd(iso: string): string {
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function fmtMonth(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short' });
}

function fmtDay(iso: string): string {
  return String(new Date(iso).getDate());
}

function fmtFullDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function eventTypeBadge(type: EventItem['type'], isFree: boolean) {
  if (isFree && type === 'VIRTUAL') {
    return { label: 'Virtual · Free', bg: 'rgba(76,175,80,0.9)', color: '#fff' };
  }
  switch (type) {
    case 'VIRTUAL':    return { label: 'Virtual',        bg: 'rgba(76,175,80,0.9)',    color: '#fff' };
    case 'IN_PERSON':  return { label: 'In-Person',      bg: 'rgba(232,184,75,0.95)',  color: '#3A3530' };
    case 'RETREAT':    return { label: 'Retreat',        bg: 'rgba(44,36,32,0.9)',     color: '#fff' };
    case 'SOUL_TRAVEL':return { label: 'Soul Travel',    bg: 'rgba(184,150,15,0.9)',   color: '#fff' };
    default:           return { label: 'Event',          bg: 'rgba(138,130,120,0.5)',  color: '#fff' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  useEffect(() => {
    setLoading(true);
    api
      .get('/events/public', { params: { limit: 50 } })
      .then((res) => setEvents(res.data?.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  const eventDates = useMemo(
    () => Array.from(new Set(events.map((e) => toYmd(e.startTime)))),
    [events],
  );

  // Apply filters
  const filtered = useMemo(() => {
    return events.filter((ev) => {
      const isFree = ev.ticketTiers.every((t) => Number(t.price) === 0);
      if (typeFilter === 'virtual' && ev.type !== 'VIRTUAL') return false;
      if (typeFilter === 'inperson' && ev.type !== 'IN_PERSON') return false;
      if (typeFilter === 'retreat' && ev.type !== 'RETREAT') return false;
      if (typeFilter === 'free' && !isFree) return false;
      if (selectedDate && toYmd(ev.startTime) !== selectedDate) return false;
      return true;
    });
  }, [events, typeFilter, selectedDate]);

  // Group by month
  const grouped = useMemo(() => {
    const groups: Record<string, EventItem[]> = {};
    for (const ev of filtered) {
      const key = monthKey(ev.startTime);
      (groups[key] = groups[key] || []).push(ev);
    }
    return Object.entries(groups).sort(
      (a, b) => new Date(a[1][0].startTime).getTime() - new Date(b[1][0].startTime).getTime(),
    );
  }, [filtered]);

  return (
    <>
      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <div style={{
        marginTop: 69,
        background: 'linear-gradient(135deg, #2C2420 0%, #3A3530 100%)',
        padding: '48px 48px 40px', textAlign: 'center',
      }}>
        <div style={{
          fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
          color: '#E8B84B', marginBottom: 10,
        }}>
          ✦ Upcoming Gatherings
        </div>
        <h1 style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 44, fontWeight: 300, color: '#fff', marginBottom: 8,
        }}>
          Events &amp; Experiences
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
          Live sessions, workshops, retreats, and sound baths — in person and online.
        </p>
      </div>

      {/* ── LAYOUT ───────────────────────────────────────────────────── */}
      <div
        className="events-layout"
        style={{
          maxWidth: 1280, margin: '0 auto',
          display: 'grid', gridTemplateColumns: '320px 1fr', gap: 40,
          padding: '40px 48px 80px', alignItems: 'start',
        }}
      >
        {/* Sidebar */}
        <aside style={{ position: 'sticky', top: 90 }} className="events-sidebar">
          <div style={{ marginBottom: 24 }}>
            <MiniCalendar
              eventDates={eventDates}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
          </div>
          <div style={{
            background: '#fff', borderRadius: 16, padding: 20,
            boxShadow: '0 2px 14px rgba(58,53,48,0.06)',
          }}>
            <div style={{
              fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
              color: '#8A8278', marginBottom: 14,
            }}>
              Event Type
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {TYPE_FILTERS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTypeFilter(t.value)}
                  style={{
                    padding: '7px 14px', borderRadius: 20,
                    border: `1px solid ${typeFilter === t.value ? '#E8B84B' : 'rgba(138,130,120,0.25)'}`,
                    fontSize: 12,
                    color: typeFilter === t.value ? '#3A3530' : '#8A8278',
                    cursor: 'pointer',
                    background: typeFilter === t.value ? '#E8B84B' : 'transparent',
                    fontWeight: typeFilter === t.value ? 500 : 400,
                    transition: 'all 0.2s',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Events list */}
        <div>
          {selectedDate && (
            <div style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 28, fontWeight: 300, color: '#3A3530', marginBottom: 28,
              display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            }}>
              {fmtFullDate(selectedDate)}
              <button
                type="button"
                onClick={() => setSelectedDate(null)}
                style={{
                  fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: '#8A8278', background: 'none',
                  border: '1px solid rgba(138,130,120,0.3)', borderRadius: 20,
                  padding: '4px 12px', cursor: 'pointer',
                }}
              >
                Clear
              </button>
            </div>
          )}

          {loading && (
            <div style={{ textAlign: 'center', padding: 80, color: '#8A8278', fontSize: 14 }}>
              Loading events…
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60, color: '#8A8278' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🗓️</div>
              <h3 style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 22, color: '#3A3530', marginBottom: 8,
              }}>
                No events found
              </h3>
              <p>Try another date or clear your filters.</p>
            </div>
          )}

          {!loading && grouped.map(([month, monthEvents]) => (
            <div key={month} style={{ marginBottom: 28 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20,
              }}>
                <div style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: 20, fontWeight: 400, color: '#3A3530',
                  whiteSpace: 'nowrap',
                }}>
                  {month}
                </div>
                <div style={{ flex: 1, height: 1, background: 'rgba(232,184,75,0.2)' }} />
                <div style={{ fontSize: 11, color: '#8A8278', whiteSpace: 'nowrap' }}>
                  {monthEvents.length} event{monthEvents.length !== 1 ? 's' : ''}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                {monthEvents.map((ev) => (
                  <EventCard key={ev.id} event={ev} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <style jsx global>{`
        @media (max-width: 960px) {
          .events-layout { grid-template-columns: 1fr !important; padding: 24px 20px 60px !important; }
          .events-sidebar { position: static !important; }
        }
        @media (max-width: 700px) {
          .event-card-grid { grid-template-columns: 1fr !important; }
          .event-img { min-height: 180px !important; max-height: 220px !important; }
        }
      `}</style>
    </>
  );
}

function EventCard({ event }: { event: EventItem }) {
  const isFree = event.ticketTiers.every((t) => Number(t.price) === 0);
  const tierPrices = event.ticketTiers.map((t) => Number(t.price));
  const lowestPrice = tierPrices.length > 0 ? Math.min(...tierPrices) : 0;
  const spotsLeft = event.ticketTiers.reduce((sum, t) => sum + (t.capacity - t.sold), 0);
  const img = event.coverImageUrl || pickFallbackImage(event.id);
  const badge = eventTypeBadge(event.type, isFree);

  return (
    <div
      className="event-card-grid"
      style={{
        background: '#fff', borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 2px 16px rgba(58,53,48,0.07)',
        display: 'grid', gridTemplateColumns: '260px 1fr',
        transition: 'transform 0.3s, box-shadow 0.3s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 6px 28px rgba(58,53,48,0.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 16px rgba(58,53,48,0.07)';
      }}
    >
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <img
          className="event-img"
          src={img}
          alt={event.title}
          style={{
            width: '100%', height: '100%', objectFit: 'cover', display: 'block',
            minHeight: 200,
          }}
        />
        <div style={{
          position: 'absolute', top: 14, left: 14,
          fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase',
          padding: '5px 12px', borderRadius: 12,
          background: badge.bg, color: badge.color,
        }}>
          {badge.label}
        </div>
        <div style={{
          position: 'absolute', bottom: 14, left: 14,
          background: 'rgba(44,36,32,0.88)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          borderRadius: 10, padding: '8px 12px', textAlign: 'center',
        }}>
          <div style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 24, color: '#E8B84B', lineHeight: 1,
          }}>
            {fmtDay(event.startTime)}
          </div>
          <div style={{
            fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.7)', marginTop: 2,
          }}>
            {fmtMonth(event.startTime)}
          </div>
        </div>
      </div>

      <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase',
          color: '#E8B84B', marginBottom: 10,
        }}>
          {event.type === 'RETREAT' ? 'Retreat' : event.type === 'SOUL_TRAVEL' ? 'Soul Travel' : event.type === 'VIRTUAL' ? 'Online Event' : 'In-Person Event'}
        </div>
        <h3 style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 22, fontWeight: 500, color: '#3A3530',
          marginBottom: 8, lineHeight: 1.3,
        }}>
          {event.title}
        </h3>

        <Link
          href={`/guides/${event.guide.slug}`}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
            textDecoration: 'none',
          }}
        >
          <div style={{
            width: 28, height: 28, borderRadius: '50%', overflow: 'hidden',
            background: '#FDF6E3', border: '1.5px solid #E8B84B',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 600, color: '#E8B84B',
          }}>
            {event.guide.user?.avatarUrl ? (
              <img src={event.guide.user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              event.guide.displayName.split(' ').map((w) => w[0]).join('').slice(0, 2)
            )}
          </div>
          <div style={{ fontSize: 12, color: '#8A8278' }}>
            Hosted by <strong style={{ color: '#3A3530' }}>{event.guide.displayName}</strong>
            {event.guide.isVerified && ' · Verified Practitioner'}
          </div>
        </Link>

        {event.description && (
          <div style={{
            fontSize: 13, color: '#8A8278', lineHeight: 1.6, marginBottom: 16, flex: 1,
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {event.description.replace(/<[^>]*>/g, '')}
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
          <Detail icon="🕖" text={`${fmtTime(event.startTime)} – ${fmtTime(event.endTime)}`} />
          {event.type === 'VIRTUAL' ? (
            <Detail icon="💻" text="Live on Zoom" />
          ) : event.location ? (
            <Detail icon="📍" text={event.location} />
          ) : null}
          {spotsLeft > 0 && spotsLeft <= 10 ? (
            <Detail icon="👥" text={`${spotsLeft} spots remaining`} highlight />
          ) : event.type === 'VIRTUAL' ? (
            <Detail icon="👥" text="Open to all" />
          ) : (
            <Detail icon="👥" text={`${spotsLeft} spots available`} />
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 'auto' }}>
          <Link
            href={`/events/${event.id}/checkout`}
            style={{
              padding: '12px 28px', background: '#E8B84B', color: '#3A3530',
              fontSize: 12, fontWeight: 600, letterSpacing: '0.08em',
              textTransform: 'uppercase', borderRadius: 8, textDecoration: 'none',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#F5D98A'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#E8B84B'; }}
          >
            {isFree ? 'Register Free' : 'Buy Ticket'}
          </Link>
          <Link
            href={`/events/${event.id}`}
            style={{
              padding: '12px 20px',
              border: '1.5px solid rgba(138,130,120,0.3)',
              color: '#8A8278', fontSize: 12, letterSpacing: '0.08em',
              textTransform: 'uppercase', borderRadius: 8, textDecoration: 'none',
              transition: 'all 0.2s',
            }}
          >
            Full Details
          </Link>
          <div style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 22, fontWeight: 500, marginLeft: 'auto',
            color: isFree ? '#4CAF50' : '#3A3530',
          }}>
            {isFree ? 'Free' : `$${lowestPrice}`}
          </div>
        </div>
      </div>
    </div>
  );
}

function Detail({ icon, text, highlight }: { icon: string; text: string; highlight?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
      color: highlight ? '#E57373' : '#8A8278',
      fontWeight: highlight ? 500 : 400,
    }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      {text}
    </div>
  );
}
