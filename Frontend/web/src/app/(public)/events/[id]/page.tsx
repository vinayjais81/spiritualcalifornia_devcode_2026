'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';

interface TicketTier {
  id: string;
  name: string;
  description: string | null;
  price: number | string;
  capacity: number;
  sold: number;
}

interface EventDetail {
  id: string;
  title: string;
  description: string | null;
  type: 'VIRTUAL' | 'IN_PERSON' | 'RETREAT' | 'SOUL_TRAVEL';
  startTime: string;
  endTime: string;
  timezone: string;
  location: string | null;
  coverImageUrl: string | null;
  ticketTiers: TicketTier[];
  guide: {
    id: string;
    slug: string;
    displayName: string;
    tagline: string | null;
    isVerified: boolean;
    user: { avatarUrl: string | null };
  };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function EventDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api
      .get(`/events/${id}`)
      .then((res) => setEvent(res.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8A8278', marginTop: 69 }}>
        Loading event…
      </div>
    );
  }

  if (notFound || !event) {
    return (
      <div style={{ maxWidth: 600, margin: '160px auto', textAlign: 'center', padding: '0 24px' }}>
        <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 42, fontWeight: 300, color: '#3A3530', marginBottom: 16 }}>
          Event not found.
        </p>
        <p style={{ fontSize: 14, color: '#8A8278', marginBottom: 32 }}>
          This event may have been cancelled or the link is incorrect.
        </p>
        <Link
          href="/events"
          style={{
            fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase',
            color: '#3A3530', textDecoration: 'none',
            borderBottom: '1.5px solid #E8B84B', paddingBottom: 2,
          }}
        >
          Browse All Events
        </Link>
      </div>
    );
  }

  const isFree = event.ticketTiers.every((t) => Number(t.price) === 0);
  const tierPrices = event.ticketTiers.map((t) => Number(t.price));
  const lowestPrice = tierPrices.length > 0 ? Math.min(...tierPrices) : 0;
  const spotsLeft = event.ticketTiers.reduce((sum, t) => sum + (t.capacity - t.sold), 0);

  const typeLabel =
    event.type === 'VIRTUAL' ? 'Online Event'
    : event.type === 'IN_PERSON' ? 'In-Person Event'
    : event.type === 'RETREAT' ? 'Retreat'
    : 'Soul Travel';

  return (
    <>
      {/* Hero banner */}
      <div style={{
        marginTop: 69, height: 320,
        background: 'linear-gradient(135deg, #2C2420 0%, #3A3530 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        {event.coverImageUrl && (
          <img
            src={event.coverImageUrl}
            alt=""
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              opacity: 0.4,
            }}
          />
        )}
      </div>

      <div style={{ maxWidth: 980, margin: '-60px auto 0', padding: '0 48px 80px', position: 'relative', zIndex: 2 }}>
        <div style={{
          background: '#fff', borderRadius: 20,
          boxShadow: '0 8px 40px rgba(58,53,48,0.08)',
          padding: '40px 48px',
        }}>
          <div style={{
            fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
            color: '#E8B84B', marginBottom: 10,
          }}>
            ✦ {typeLabel}
          </div>
          <h1 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 40, fontWeight: 400, color: '#3A3530',
            lineHeight: 1.2, marginBottom: 20,
          }}>
            {event.title}
          </h1>

          <Link
            href={`/guides/${event.guide.slug}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 12,
              padding: '12px 18px',
              background: '#FDF6E3', borderRadius: 10,
              textDecoration: 'none', marginBottom: 28,
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: '50%', overflow: 'hidden',
              background: '#fff', border: '2px solid #E8B84B',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 600, color: '#E8B84B',
            }}>
              {event.guide.user.avatarUrl ? (
                <img src={event.guide.user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                event.guide.displayName.split(' ').map((w) => w[0]).join('').slice(0, 2)
              )}
            </div>
            <div>
              <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A8278' }}>
                Hosted by
              </div>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#3A3530' }}>
                {event.guide.displayName}
                {event.guide.isVerified && (
                  <span style={{
                    marginLeft: 8, fontSize: 10,
                    padding: '2px 8px', borderRadius: 10,
                    background: '#fff', border: '1px solid #E8B84B',
                    color: '#3A3530',
                  }}>
                    ✓ Verified
                  </span>
                )}
              </div>
            </div>
          </Link>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16, marginBottom: 32,
            padding: '20px 0',
            borderTop: '1px solid rgba(232,184,75,0.15)',
            borderBottom: '1px solid rgba(232,184,75,0.15)',
          }}>
            <InfoBlock icon="📅" label="Date">{fmtDate(event.startTime)}</InfoBlock>
            <InfoBlock icon="🕖" label="Time">
              {fmtTime(event.startTime)} – {fmtTime(event.endTime)}
            </InfoBlock>
            {event.type === 'VIRTUAL' ? (
              <InfoBlock icon="💻" label="Where">Live on Zoom (link emailed)</InfoBlock>
            ) : event.location ? (
              <InfoBlock icon="📍" label="Where">{event.location}</InfoBlock>
            ) : null}
            <InfoBlock icon="👥" label="Availability">
              {spotsLeft > 0 ? `${spotsLeft} spots available` : 'Sold out'}
            </InfoBlock>
          </div>

          {event.description && (
            <div style={{ marginBottom: 32 }}>
              <h2 style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 22, fontWeight: 400, color: '#3A3530', marginBottom: 14,
              }}>
                About this event
              </h2>
              <div
                style={{ fontSize: 15, color: '#3A3530', lineHeight: 1.75 }}
                dangerouslySetInnerHTML={{ __html: event.description }}
              />
            </div>
          )}

          {event.ticketTiers.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h2 style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 22, fontWeight: 400, color: '#3A3530', marginBottom: 14,
              }}>
                Tickets
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {event.ticketTiers.map((t) => {
                  const tierLeft = t.capacity - t.sold;
                  return (
                    <div
                      key={t.id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '14px 18px', gap: 16,
                        border: '1px solid rgba(232,184,75,0.15)', borderRadius: 10,
                        background: '#FAFAF7',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500, color: '#3A3530' }}>{t.name}</div>
                        {t.description && (
                          <div style={{ fontSize: 12, color: '#8A8278', marginTop: 2 }}>{t.description}</div>
                        )}
                        <div style={{ fontSize: 11, color: '#8A8278', marginTop: 4 }}>
                          {tierLeft > 0 ? `${tierLeft} of ${t.capacity} remaining` : 'Sold out'}
                        </div>
                      </div>
                      <div style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontSize: 24, fontWeight: 500,
                        color: Number(t.price) === 0 ? '#4CAF50' : '#3A3530',
                      }}>
                        {Number(t.price) === 0 ? 'Free' : `$${Number(t.price).toFixed(0)}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <Link
              href={`/events/${event.id}/checkout`}
              style={{
                padding: '14px 36px', background: '#E8B84B', color: '#3A3530',
                fontSize: 13, fontWeight: 600, letterSpacing: '0.08em',
                textTransform: 'uppercase', borderRadius: 8, textDecoration: 'none',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#F5D98A'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#E8B84B'; }}
            >
              {isFree ? 'Register Free' : `Buy Tickets · From $${lowestPrice}`}
            </Link>
            <Link
              href="/events"
              style={{
                fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase',
                color: '#8A8278', textDecoration: 'none',
                borderBottom: '1px solid rgba(138,130,120,0.4)', paddingBottom: 2,
              }}
            >
              ← Back to all events
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

function InfoBlock({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase',
        color: '#8A8278', marginBottom: 4,
      }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 13, color: '#3A3530', fontWeight: 500 }}>{children}</div>
    </div>
  );
}
