'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useCartStore } from '@/store/cart.store';
import { C, font, serif } from '@/components/guide/dashboard-ui';

// ─── API shape ──────────────────────────────────────────────────────────────

interface CartBucket {
  itemCount: number;
  subtotal: number;
  hasWarnings: boolean;
  thumbnails: string[];
}
interface PendingTour {
  id: string;
  title: string;
  coverImageUrl: string | null;
  tourSlug: string;
  travelers: number;
  depositDue: number;
  totalAmount: number;
  currency: string;
  holdExpiresAt: string | null;
  holdHoursLeft: number | null;
  departureStart: string | null;
}
interface PendingBooking {
  id: string;
  serviceName: string;
  guideName: string;
  guideAvatar: string | null;
  slotStart: string;
  durationMin: number;
  totalAmount: number;
  currency: string;
}
interface PendingTicket {
  id: string;           // purchaseGroupId
  eventId: string;
  eventTitle: string;
  coverImageUrl: string | null;
  tierName: string;
  quantity: number;
  totalAmount: number;
  eventStart: string;
}
interface PendingActions {
  cart: CartBucket | null;
  pendingTours: PendingTour[];
  pendingBookings: PendingBooking[];
  pendingTickets: PendingTicket[];
}

// ─── Formatting helpers ────────────────────────────────────────────────────

function fmtMoney(n: number) { return `$${n.toFixed(2)}`; }

/** Relative deadline phrase + flag for "urgent" (<24h) styling. */
function formatDeadline(iso: string | null, hoursLeft: number | null): { label: string; urgent: boolean } | null {
  if (!iso || hoursLeft == null) return null;
  if (hoursLeft <= 0) return { label: 'Hold expires any moment', urgent: true };
  if (hoursLeft < 1) return { label: `Hold expires in under an hour`, urgent: true };
  if (hoursLeft < 24) return { label: `Hold expires in ${hoursLeft}h`, urgent: true };
  const days = Math.floor(hoursLeft / 24);
  return { label: `Hold expires in ${days} day${days > 1 ? 's' : ''}`, urgent: false };
}

function fmtSlot(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// ═══════════════════════════════════════════════════════════════════════════
// PANEL
// ═══════════════════════════════════════════════════════════════════════════

export function NeedsAttentionPanel() {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<PendingActions | null>(null);
  const cartItems = useCartStore((s) => s.items);
  const syncCart = useCartStore((s) => s.syncFromServer);

  useEffect(() => {
    setMounted(true);
    syncCart();
    api.get('/seekers/dashboard/pending-actions')
      .then((r) => setData(r.data))
      .catch(() => setData({ cart: null, pendingTours: [], pendingBookings: [], pendingTickets: [] }));
  }, [syncCart]);

  // Cart-row routing mirrors /cart page: events-only → event checkout; else /checkout
  const cartResumeHref = useMemo(() => {
    if (cartItems.length === 0) return '/cart';
    const types = new Set(cartItems.map((i) => i.itemType));
    if (types.size === 1 && types.has('EVENT_TICKET')) return '/checkout/event';
    return '/checkout';
  }, [cartItems]);

  if (!mounted || !data) return null;

  const rows: React.ReactNode[] = [];

  // ─── Cart row ────────────────────────────────────────────────────────────
  if (data.cart && data.cart.itemCount > 0) {
    rows.push(
      <AttentionRow
        key="cart"
        icon="🛍️"
        iconBg="rgba(232,184,75,0.18)"
        title="Your cart is waiting"
        subtitle={`${data.cart.itemCount} item${data.cart.itemCount !== 1 ? 's' : ''} · ${fmtMoney(data.cart.subtotal)} — complete checkout anytime.`}
        warningLabel={data.cart.hasWarnings ? 'Some items changed' : undefined}
        thumbnails={data.cart.thumbnails}
        primaryHref={cartResumeHref}
        primaryLabel="Complete Checkout →"
        secondaryHref="/cart"
        secondaryLabel="Review Cart"
      />,
    );
  }

  // ─── Pending soul tours ──────────────────────────────────────────────────
  for (const tour of data.pendingTours) {
    const deadline = formatDeadline(tour.holdExpiresAt, tour.holdHoursLeft);
    rows.push(
      <AttentionRow
        key={`tour-${tour.id}`}
        icon="🌍"
        iconBg="rgba(232,184,75,0.12)"
        title={tour.title}
        subtitle={
          `${tour.travelers} traveller${tour.travelers > 1 ? 's' : ''} · Deposit due ${fmtMoney(tour.depositDue)} of ${fmtMoney(tour.totalAmount)}`
        }
        badge="Tour · Deposit due"
        deadline={deadline}
        thumbnails={tour.coverImageUrl ? [tour.coverImageUrl] : []}
        primaryHref={`/seeker/dashboard/tours/${tour.id}`}
        primaryLabel="Pay Deposit →"
        secondaryHref={`/tours/${tour.tourSlug}`}
        secondaryLabel="Tour Details"
      />,
    );
  }

  // ─── Pending service bookings ────────────────────────────────────────────
  for (const booking of data.pendingBookings) {
    rows.push(
      <AttentionRow
        key={`booking-${booking.id}`}
        icon="📅"
        iconBg="rgba(90,138,106,0.18)"
        title={booking.serviceName}
        subtitle={`With ${booking.guideName} · ${fmtSlot(booking.slotStart)} · ${fmtMoney(booking.totalAmount)}`}
        badge="Session · Awaiting payment"
        thumbnails={booking.guideAvatar ? [booking.guideAvatar] : []}
        primaryHref={`/seeker/dashboard/bookings/${booking.id}`}
        primaryLabel="Complete Payment →"
      />,
    );
  }

  // ─── Pending event tickets ───────────────────────────────────────────────
  for (const ticket of data.pendingTickets) {
    rows.push(
      <AttentionRow
        key={`ticket-${ticket.id}`}
        icon="🎫"
        iconBg="rgba(240,120,32,0.15)"
        title={ticket.eventTitle}
        subtitle={
          `${ticket.quantity} × ${ticket.tierName} · ${fmtMoney(ticket.totalAmount)} · ${fmtSlot(ticket.eventStart)}`
        }
        badge="Ticket reservation · Awaiting payment"
        thumbnails={ticket.coverImageUrl ? [ticket.coverImageUrl] : []}
        primaryHref={`/events/${ticket.eventId}/checkout`}
        primaryLabel="Complete Purchase →"
      />,
    );
  }

  if (rows.length === 0) return null;

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        fontFamily: font,
        fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
        color: C.warmGray, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span>✦ Needs your attention</span>
        <span style={{
          padding: '2px 8px', borderRadius: 10,
          background: 'rgba(232,184,75,0.15)', color: '#B8960F',
          fontSize: 10, fontWeight: 600,
        }}>
          {rows.length}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows}
      </div>
    </div>
  );
}

// ─── Single row ────────────────────────────────────────────────────────────

interface RowProps {
  icon: string;
  iconBg: string;
  title: string;
  subtitle: string;
  badge?: string;
  warningLabel?: string;
  deadline?: { label: string; urgent: boolean } | null;
  thumbnails?: string[];
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}

function AttentionRow({
  icon, iconBg, title, subtitle, badge, warningLabel, deadline,
  thumbnails = [], primaryHref, primaryLabel, secondaryHref, secondaryLabel,
}: RowProps) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #3A3530 0%, #4A4036 100%)',
      color: '#E8B84B',
      borderRadius: 14,
      padding: '18px 22px',
      display: 'flex',
      alignItems: 'center',
      gap: 18,
      flexWrap: 'wrap',
    }}>
      <div style={{
        fontSize: 24,
        width: 48, height: 48,
        borderRadius: '50%',
        background: iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>

      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          marginBottom: 4,
        }}>
          {badge && (
            <span style={{
              fontFamily: font, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase',
              color: 'rgba(232,184,75,0.75)',
            }}>
              {badge}
            </span>
          )}
          {deadline && (
            <span style={{
              fontFamily: font, fontSize: 10, fontWeight: 600,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              padding: '2px 8px', borderRadius: 10,
              background: deadline.urgent ? 'rgba(231,76,60,0.18)' : 'rgba(232,184,75,0.15)',
              color: deadline.urgent ? '#FF7A6E' : 'rgba(232,184,75,0.9)',
            }}>
              ⏱ {deadline.label}
            </span>
          )}
          {warningLabel && (
            <span style={{
              fontFamily: font, fontSize: 10, fontWeight: 600,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              padding: '2px 8px', borderRadius: 10,
              background: 'rgba(231,76,60,0.18)', color: '#FF7A6E',
            }}>
              ⚠ {warningLabel}
            </span>
          )}
        </div>
        <div style={{
          fontFamily: serif, fontSize: 19, fontWeight: 500,
          color: '#F5D98A', marginBottom: 3,
          lineHeight: 1.25,
        }}>
          {title}
        </div>
        <div style={{ fontFamily: font, fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
          {subtitle}
        </div>
      </div>

      {thumbnails.length > 0 && (
        <div style={{ display: 'flex', gap: 6 }}>
          {thumbnails.slice(0, 3).map((src, i) => (
            <div key={i} style={{
              width: 44, height: 44, borderRadius: 8, overflow: 'hidden',
              background: 'rgba(232,184,75,0.08)',
              border: '1px solid rgba(232,184,75,0.2)',
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link
          href={primaryHref}
          style={{
            padding: '10px 20px', borderRadius: 8,
            background: '#E8B84B', color: '#3A3530',
            fontFamily: font, fontSize: 11, fontWeight: 600,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            textDecoration: 'none', whiteSpace: 'nowrap',
          }}
        >
          {primaryLabel}
        </Link>
        {secondaryHref && secondaryLabel && (
          <Link
            href={secondaryHref}
            style={{
              padding: '10px 20px', borderRadius: 8,
              background: 'transparent', color: '#F5D98A',
              border: '1.5px solid rgba(232,184,75,0.35)',
              fontFamily: font, fontSize: 11, fontWeight: 500,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              textDecoration: 'none', whiteSpace: 'nowrap',
            }}
          >
            {secondaryLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
