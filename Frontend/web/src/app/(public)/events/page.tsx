'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Event {
  id: string;
  title: string;
  type: 'VIRTUAL' | 'IN_PERSON' | 'SOUL_TRAVEL';
  startTime: string;
  endTime: string;
  location: string | null;
  coverImageUrl: string | null;
  ticketTiers: Array<{ price: number; name: string; capacity: number; sold: number }>;
  guide: { displayName: string; slug: string; user: { avatarUrl: string | null } };
}

const fallbackEvents: Event[] = [
  { id: 'e1', title: 'Full Moon Sound Bath — Live in LA', type: 'IN_PERSON', startTime: '2026-04-15T19:00:00', endTime: '2026-04-15T21:00:00', location: 'Los Angeles, CA', coverImageUrl: null, ticketTiers: [{ price: 45, name: 'General', capacity: 50, sold: 32 }], guide: { displayName: 'Maya Williams', slug: 'maya-williams', user: { avatarUrl: null } } },
  { id: 'e2', title: 'Breathwork for Transformation — Online', type: 'VIRTUAL', startTime: '2026-04-20T10:00:00', endTime: '2026-04-20T12:00:00', location: null, coverImageUrl: null, ticketTiers: [{ price: 35, name: 'General', capacity: 100, sold: 67 }], guide: { displayName: 'Marcus Thompson', slug: 'marcus-thompson', user: { avatarUrl: null } } },
  { id: 'e3', title: 'Chakra Alignment Workshop', type: 'IN_PERSON', startTime: '2026-04-25T14:00:00', endTime: '2026-04-25T17:00:00', location: 'San Jose, CA', coverImageUrl: null, ticketTiers: [{ price: 75, name: 'General', capacity: 30, sold: 22 }], guide: { displayName: 'Priya Sharma', slug: 'priya-sharma', user: { avatarUrl: null } } },
  { id: 'e4', title: 'Crystal Grid Masterclass', type: 'VIRTUAL', startTime: '2026-05-02T18:00:00', endTime: '2026-05-02T20:00:00', location: null, coverImageUrl: null, ticketTiers: [{ price: 55, name: 'General', capacity: 40, sold: 15 }], guide: { displayName: 'Dr. Sarah Chen', slug: 'dr-sarah-chen', user: { avatarUrl: null } } },
  { id: 'e5', title: 'New Moon Meditation Circle', type: 'IN_PERSON', startTime: '2026-05-08T20:00:00', endTime: '2026-05-08T21:30:00', location: 'Santa Cruz, CA', coverImageUrl: null, ticketTiers: [{ price: 25, name: 'General', capacity: 20, sold: 18 }], guide: { displayName: 'Elena Vasquez', slug: 'elena-vasquez', user: { avatarUrl: null } } },
  { id: 'e6', title: 'Qi Gong in the Park', type: 'IN_PERSON', startTime: '2026-05-12T08:00:00', endTime: '2026-05-12T09:30:00', location: 'Golden Gate Park, SF', coverImageUrl: null, ticketTiers: [{ price: 0, name: 'Free', capacity: 50, sold: 35 }], guide: { displayName: 'Carlos Mendez', slug: 'carlos-mendez', user: { avatarUrl: null } } },
];

function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); }
function fmtTime(d: string) { return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }
function fmtMonth(d: string) { return new Date(d).toLocaleDateString('en-US', { month: 'short' }).toUpperCase(); }
function fmtDay(d: string) { return new Date(d).getDate().toString(); }

const typeBadge = (type: string) => {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    VIRTUAL: { label: 'Online', bg: 'rgba(90,138,106,0.12)', color: '#5A8A6A' },
    IN_PERSON: { label: 'In-Person', bg: 'rgba(240,120,32,0.1)', color: '#F07820' },
    SOUL_TRAVEL: { label: 'Soul Travel', bg: 'rgba(232,184,75,0.15)', color: '#B8960F' },
  };
  const b = map[type] || map.IN_PERSON;
  return <span style={{ padding: '3px 10px', borderRadius: 12, background: b.bg, color: b.color, fontSize: 10, fontWeight: 600 }}>{b.label}</span>;
};

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>(fallbackEvents);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get('/events/public');
        if (res.data?.events?.length) setEvents(res.data.events);
      } catch { /* keep fallback */ }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 48px 80px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#E8B84B', marginBottom: 10 }}>✦ Upcoming Events</div>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 44, fontWeight: 400, color: '#3A3530', marginBottom: 10 }}>
          Workshops, Circles &amp; Ceremonies
        </h1>
        <p style={{ fontSize: 15, color: '#8A8278', maxWidth: 520, margin: '0 auto' }}>
          Join our community of seekers and practitioners for transformative experiences — in person and online.
        </p>
      </div>

      {/* Events grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
        {events.map(event => {
          const lowestPrice = Math.min(...event.ticketTiers.map(t => t.price));
          const spotsLeft = event.ticketTiers.reduce((sum, t) => sum + t.capacity - t.sold, 0);
          return (
            <div key={event.id} style={{
              background: '#fff', border: '1px solid rgba(232,184,75,0.1)', borderRadius: 12,
              overflow: 'hidden', display: 'flex', transition: 'box-shadow 0.3s',
            }}>
              {/* Date box */}
              <div style={{
                width: 80, flexShrink: 0, background: '#FAFAF7',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                borderRight: '1px solid rgba(232,184,75,0.1)', padding: 16,
              }}>
                <div style={{ fontSize: 10, letterSpacing: '0.1em', color: '#E8B84B', fontWeight: 600 }}>{fmtMonth(event.startTime)}</div>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 500, color: '#3A3530' }}>{fmtDay(event.startTime)}</div>
              </div>
              {/* Content */}
              <div style={{ flex: 1, padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  {typeBadge(event.type)}
                  {spotsLeft <= 5 && spotsLeft > 0 && (
                    <span style={{ fontSize: 10, color: '#C0392B', fontWeight: 500 }}>{spotsLeft} spots left</span>
                  )}
                </div>
                <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: '#3A3530', lineHeight: 1.3, marginBottom: 6 }}>
                  {event.title}
                </h3>
                <div style={{ fontSize: 12, color: '#8A8278', marginBottom: 4 }}>
                  {fmtDate(event.startTime)} · {fmtTime(event.startTime)} – {fmtTime(event.endTime)}
                </div>
                {event.location && <div style={{ fontSize: 12, color: '#8A8278', marginBottom: 8 }}>📍 {event.location}</div>}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <Link href={`/guides/${event.guide.slug}`} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#FDF6E3', border: '1.5px solid #E8B84B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: '#E8B84B' }}>
                      {event.guide.displayName.split(' ').map(w => w[0]).join('').slice(0, 2)}
                    </div>
                    <span style={{ fontSize: 12, color: '#3A3530' }}>{event.guide.displayName}</span>
                  </Link>
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 500, color: '#3A3530' }}>
                    {lowestPrice === 0 ? 'Free' : `$${lowestPrice}`}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
