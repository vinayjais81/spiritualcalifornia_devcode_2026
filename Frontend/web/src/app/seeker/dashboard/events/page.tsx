'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { C, font, serif, PageHeader, Panel, EmptyState } from '@/components/guide/dashboard-ui';

// ─── Types ──────────────────────────────────────────────────────────────────

interface EventTicket {
  id: string;
  attendeeName: string | null;
  attendeeEmail: string | null;
  qrCode: string | null;
  status: string;
}

interface EventPurchase {
  purchaseGroupId: string;
  status: string;
  ticketCount: number;
  totalAmount: number;
  bookingFee: number;
  createdAt: string;
  event: {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    timezone: string;
    location: string | null;
    type: string;
    coverImageUrl: string | null;
    isCancelled: boolean;
  };
  tier: { name: string; price: number };
  guide: { name: string; avatarUrl: string | null };
  tickets: EventTicket[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
function fmtMoney(v: number) {
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_STYLES: Record<string, { bg: string; color: string; border: string; label: string }> = {
  PENDING: { bg: '#FFF8E1', color: '#F57F17', border: '1px solid #FFE082', label: 'Pending Payment' },
  CONFIRMED: { bg: '#E8F5E9', color: '#2E7D32', border: '1px solid #A5D6A7', label: 'Confirmed' },
  CANCELLED: { bg: '#FFEBEE', color: '#C62828', border: '1px solid #EF9A9A', label: 'Cancelled' },
  REFUNDED: { bg: '#E3F2FD', color: '#1565C0', border: '1px solid #90CAF9', label: 'Refunded' },
};

const TYPE_LABELS: Record<string, string> = {
  VIRTUAL: 'Online',
  IN_PERSON: 'In-Person',
  SOUL_TRAVEL: 'Soul Travel',
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.PENDING;
  return (
    <span style={{ padding: '4px 12px', borderRadius: 20, fontFamily: font, fontSize: 11, background: s.bg, color: s.color, border: s.border, fontWeight: 500 }}>
      {s.label}
    </span>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function MyEventsPage() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all');

  const { data: purchases, isLoading } = useQuery<EventPurchase[]>({
    queryKey: ['seeker', 'my-events'],
    queryFn: async () => { const { data } = await api.get('/tickets/my-events'); return data; },
  });

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const now = new Date();
  const filtered = (purchases || []).filter((p) => {
    if (filter === 'upcoming') return new Date(p.event.startTime) >= now;
    if (filter === 'past') return new Date(p.event.startTime) < now;
    return true;
  });

  const totalSpent = (purchases || []).reduce((sum, p) => sum + p.totalAmount + p.bookingFee, 0);

  return (
    <div>
      <PageHeader title="My Events" subtitle={`${purchases?.length ?? 0} event${(purchases?.length ?? 0) !== 1 ? 's' : ''} · Total spent: ${fmtMoney(totalSpent)}`} />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {(['all', 'upcoming', 'past'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '8px 20px', borderRadius: 20, fontFamily: font, fontSize: 12, fontWeight: 500,
              border: filter === f ? `1.5px solid ${C.gold}` : '1.5px solid rgba(232,184,75,0.2)',
              background: filter === f ? C.goldPale : C.white,
              color: filter === f ? C.charcoal : C.warmGray,
              cursor: 'pointer', transition: 'all 0.2s', textTransform: 'capitalize',
            }}
          >
            {f === 'all' ? `All (${purchases?.length ?? 0})` : f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Panel title="Loading..." icon="⏳"><div style={{ padding: 40, textAlign: 'center', fontFamily: font, color: C.warmGray }}>Loading your events...</div></Panel>
      ) : !filtered.length ? (
        <Panel title="No Events" icon="🎫">
          <EmptyState message="No event tickets found. Browse upcoming events to find your next experience!" />
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Link href="/events" style={{ fontFamily: font, fontSize: 13, color: C.gold, textDecoration: 'none', fontWeight: 500 }}>Browse Events →</Link>
          </div>
        </Panel>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filtered.map((p) => {
            const isOpen = expanded.has(p.purchaseGroupId);
            const isPast = new Date(p.event.startTime) < now;
            const total = p.totalAmount + p.bookingFee;

            return (
              <div key={p.purchaseGroupId} style={{
                background: C.white, border: '1px solid rgba(232,184,75,0.12)', borderRadius: 12, overflow: 'hidden',
              }}>
                {/* Summary row */}
                <button
                  onClick={() => toggle(p.purchaseGroupId)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px',
                    textAlign: 'left', cursor: 'pointer', border: 'none', background: 'transparent',
                  }}
                >
                  {/* Event image or date box */}
                  {p.event.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.event.coverImageUrl} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 64, height: 64, borderRadius: 8, background: C.goldPale, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <div style={{ fontFamily: font, fontSize: 9, letterSpacing: '0.1em', color: C.gold, fontWeight: 600 }}>
                        {new Date(p.event.startTime).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                      </div>
                      <div style={{ fontFamily: serif, fontSize: 22, fontWeight: 500, color: C.charcoal }}>
                        {new Date(p.event.startTime).getDate()}
                      </div>
                    </div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <StatusPill status={p.event.isCancelled ? 'CANCELLED' : p.status} />
                      <span style={{ fontFamily: font, fontSize: 10, color: C.warmGray, padding: '2px 8px', background: C.offWhite, borderRadius: 4 }}>
                        {TYPE_LABELS[p.event.type] || p.event.type}
                      </span>
                      {isPast && !p.event.isCancelled && (
                        <span style={{ fontFamily: font, fontSize: 10, color: C.warmGray }}>Past event</span>
                      )}
                    </div>
                    <div style={{ fontFamily: serif, fontSize: 18, fontWeight: 500, color: C.charcoal, marginBottom: 2 }}>
                      {p.event.title}
                    </div>
                    <div style={{ fontFamily: font, fontSize: 12, color: C.warmGray }}>
                      {fmtDate(p.event.startTime)} · {fmtTime(p.event.startTime)} – {fmtTime(p.event.endTime)}
                      {p.event.location && ` · 📍 ${p.event.location}`}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: serif, fontSize: 20, fontWeight: 500, color: C.charcoal }}>{fmtMoney(total)}</div>
                    <div style={{ fontFamily: font, fontSize: 11, color: C.warmGray }}>
                      {p.ticketCount} ticket{p.ticketCount > 1 ? 's' : ''} · {p.tier.name}
                    </div>
                  </div>

                  <div style={{ fontSize: 18, color: C.warmGray, flexShrink: 0 }}>{isOpen ? '▲' : '▼'}</div>
                </button>

                {/* Expanded: ticket details + QR codes */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid rgba(232,184,75,0.12)', padding: '20px 24px', background: C.offWhite }}>
                    {/* Guide info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      {p.guide.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.guide.avatarUrl} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.goldPale, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: C.gold }}>
                          {p.guide.name[0]}
                        </div>
                      )}
                      <div>
                        <div style={{ fontFamily: font, fontSize: 13, fontWeight: 500, color: C.charcoal }}>Hosted by {p.guide.name}</div>
                        <div style={{ fontFamily: font, fontSize: 11, color: C.warmGray }}>Booked on {fmtDate(p.createdAt)}</div>
                      </div>
                    </div>

                    {/* Price breakdown */}
                    <div style={{ display: 'flex', gap: 24, marginBottom: 20, fontFamily: font, fontSize: 12 }}>
                      <div><span style={{ color: C.warmGray }}>Tickets:</span> <span style={{ color: C.charcoal }}>{p.ticketCount} × {fmtMoney(p.tier.price)}</span></div>
                      <div><span style={{ color: C.warmGray }}>Subtotal:</span> <span style={{ color: C.charcoal }}>{fmtMoney(p.totalAmount)}</span></div>
                      <div><span style={{ color: C.warmGray }}>Booking fee:</span> <span style={{ color: C.charcoal }}>{fmtMoney(p.bookingFee)}</span></div>
                      <div><span style={{ color: C.warmGray }}>Total:</span> <strong style={{ color: C.charcoal }}>{fmtMoney(total)}</strong></div>
                    </div>

                    {/* Individual tickets with QR codes */}
                    <div style={{ fontFamily: font, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.warmGray, marginBottom: 10 }}>
                      Tickets & QR Codes
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(p.tickets.length, 3)}, 1fr)`, gap: 12 }}>
                      {p.tickets.map((t, i) => (
                        <div key={t.id} style={{
                          background: C.white, border: '1px solid rgba(232,184,75,0.15)', borderRadius: 8,
                          padding: 16, textAlign: 'center',
                        }}>
                          <div style={{ fontFamily: font, fontSize: 10, color: C.warmGray, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                            Ticket {i + 1}
                          </div>
                          <div style={{ fontFamily: font, fontSize: 13, fontWeight: 500, color: C.charcoal, marginBottom: 2 }}>
                            {t.attendeeName || '—'}
                          </div>
                          <div style={{ fontFamily: font, fontSize: 11, color: C.warmGray, marginBottom: 10 }}>
                            {t.attendeeEmail || '—'}
                          </div>
                          {t.qrCode ? (
                            <div style={{ padding: 12, background: C.goldPale, borderRadius: 6 }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={t.qrCode} alt="QR Code" style={{ width: 120, height: 120, margin: '0 auto' }} />
                              <div style={{ fontFamily: font, fontSize: 10, color: C.warmGray, marginTop: 6 }}>Show at door</div>
                            </div>
                          ) : (
                            <div style={{ padding: 24, background: '#FFF8E1', borderRadius: 6, fontFamily: font, fontSize: 11, color: '#F57F17' }}>
                              QR code pending
                            </div>
                          )}
                          <div style={{ marginTop: 8 }}>
                            <StatusPill status={t.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
