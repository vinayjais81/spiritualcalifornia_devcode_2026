'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useCartStore } from '@/store/cart.store';
import { useAuthStore } from '@/store/auth.store';
import { api } from '@/lib/api';

// ─── Pending-actions types (shape mirrors /seekers/dashboard/pending-actions) ─

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
  id: string;
  eventId: string;
  eventTitle: string;
  coverImageUrl: string | null;
  tierName: string;
  quantity: number;
  totalAmount: number;
  eventStart: string;
}

interface PendingActionsResponse {
  cart: unknown;
  pendingTours: PendingTour[];
  pendingBookings: PendingBooking[];
  pendingTickets: PendingTicket[];
}

function fmtMoney(n: number) {
  return `$${n.toFixed(2)}`;
}

function fmtSlot(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    + ' · '
    + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  );
}

function formatHoldDeadline(hoursLeft: number | null): { label: string; urgent: boolean } | null {
  if (hoursLeft == null) return null;
  if (hoursLeft <= 0) return { label: 'Hold expires any moment', urgent: true };
  if (hoursLeft < 1) return { label: 'Hold expires in under an hour', urgent: true };
  if (hoursLeft < 24) return { label: `Hold expires in ${hoursLeft}h`, urgent: true };
  const days = Math.floor(hoursLeft / 24);
  return { label: `Hold expires in ${days} day${days > 1 ? 's' : ''}`, urgent: false };
}

// ─── PendingRow ─────────────────────────────────────────────────────────────
// One card per abandoned reservation. Visually consistent with the cart-item
// rows below but with a dedicated CTA per item (no shared checkout flow).
function PendingRow({
  badge,
  badgeColor,
  icon,
  coverUrl,
  title,
  subtitle,
  deadline,
  primaryHref,
  primaryLabel,
}: {
  badge: string;
  badgeColor: string;
  icon: string;
  coverUrl: string | null;
  title: string;
  subtitle: string;
  deadline: { label: string; urgent: boolean } | null;
  primaryHref: string;
  primaryLabel: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '12px 14px',
        marginBottom: 8,
        background: '#F5F2EB',
        border: '1px solid rgba(138,130,120,0.18)',
        borderRadius: 8,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 6,
          overflow: 'hidden',
          flexShrink: 0,
          background: badgeColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {coverUrl ? (
          <img src={coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: 20 }}>{icon}</span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 9,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#8A8278',
            marginBottom: 2,
            fontWeight: 600,
          }}
        >
          {badge}
        </div>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#3A3530', marginBottom: 2 }}>
          {title}
        </div>
        <div style={{ fontSize: 11, color: '#8A8278' }}>{subtitle}</div>
        {deadline && (
          <div
            style={{
              marginTop: 4,
              fontSize: 10,
              fontWeight: 500,
              color: deadline.urgent ? '#C0392B' : '#8A8278',
            }}
          >
            {deadline.urgent ? '⏱ ' : ''}{deadline.label}
          </div>
        )}
      </div>
      <Link
        href={primaryHref}
        style={{
          padding: '8px 14px',
          borderRadius: 6,
          background: 'transparent',
          color: '#3A3530',
          border: '1px solid rgba(58,53,48,0.4)',
          textDecoration: 'none',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        {primaryLabel}
      </Link>
    </div>
  );
}

const typeBadge = (type: string) => {
  const map: Record<string, { label: string; bg: string }> = {
    DIGITAL: { label: 'Digital', bg: 'rgba(240,120,20,0.15)' },
    EVENT_TICKET: { label: 'Event', bg: 'rgba(90,138,106,0.12)' },
    SOUL_TOUR: { label: 'Tour', bg: 'rgba(240,120,32,0.1)' },
  };
  const b = map[type];
  if (!b) return null;
  return <span style={{ padding: '2px 8px', borderRadius: 10, background: b.bg, fontSize: 10, fontWeight: 600, color: '#3A3530' }}>{b.label}</span>;
};

export default function CartPage() {
  const items = useCartStore((s) => s.items);
  const warnings = useCartStore((s) => s.warnings);
  const warningsAcknowledged = useCartStore((s) => s.warningsAcknowledged);
  const syncFromServer = useCartStore((s) => s.syncFromServer);
  const acknowledgeWarnings = useCartStore((s) => s.acknowledgeWarnings);
  const { updateQuantity, removeItem, getSubtotal, getItemCount } = useCartStore();
  const subtotal = getSubtotal();
  const itemCount = getItemCount();
  const hasPhysical = items.some(i => i.productType === 'PHYSICAL');
  const hasDigital = items.some(i => i.productType === 'DIGITAL');

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Pending items from prior reservations (tour deposits, service bookings,
  // event ticket holds). Each has its own dedicated checkout flow — we
  // surface them here as a convenience so seekers who land on /cart see
  // everything they owe in one place. Same data source as the dashboard's
  // NeedsAttentionPanel; the right-side Order Summary deliberately ignores
  // these because they don't share a Stripe payment intent with the cart.
  const [pendingTours, setPendingTours] = useState<PendingTour[]>([]);
  const [pendingBookings, setPendingBookings] = useState<PendingBooking[]>([]);
  const [pendingTickets, setPendingTickets] = useState<PendingTicket[]>([]);

  // Refresh from server on mount so stale items, price changes, etc. are
  // surfaced the moment the seeker lands on /cart — even if the navbar already
  // primed a sync earlier. Cheap: single GET.
  useEffect(() => { syncFromServer(); }, [syncFromServer]);

  // Load abandoned items (signed-in seekers only). Guests have nothing to
  // fetch and an unauthenticated call would 401, so skip cleanly.
  useEffect(() => {
    if (!isAuthenticated) {
      setPendingTours([]);
      setPendingBookings([]);
      setPendingTickets([]);
      return;
    }
    api
      .get<PendingActionsResponse>('/seekers/dashboard/pending-actions')
      .then((r) => {
        setPendingTours(r.data.pendingTours ?? []);
        setPendingBookings(r.data.pendingBookings ?? []);
        setPendingTickets(r.data.pendingTickets ?? []);
      })
      .catch(() => {
        // Soft-fail: a pending-actions error shouldn't break the cart.
        setPendingTours([]);
        setPendingBookings([]);
        setPendingTickets([]);
      });
  }, [isAuthenticated]);

  const pendingCount = pendingTours.length + pendingBookings.length + pendingTickets.length;

  // Toast "removed" warnings once each — store them in a ref so re-renders
  // don't spam the same message. Blocking warnings (price + overstock) stay
  // in the banner until the user acknowledges.
  const toastedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const w of warnings) {
      if (w.kind === 'removed' && !toastedRef.current.has(w.message)) {
        toast.info(w.message);
        toastedRef.current.add(w.message);
      }
    }
  }, [warnings]);

  const blockingWarnings = warnings.filter((w) => w.kind !== 'removed');
  const mustAcknowledge = blockingWarnings.length > 0 && !warningsAcknowledged;

  // Determine checkout route.
  // Products (digital, physical, or mixed) all flow through the unified /checkout.
  // Events keep their own flow because of the attendee-details step + QR generation.
  const getCheckoutRoute = () => {
    const itemTypes = new Set(items.map(i => i.itemType));
    if (itemTypes.size === 1 && itemTypes.has('EVENT_TICKET')) return '/checkout/event';
    return '/checkout';
  };

  // Cart empty path: show the splash empty-state. If there are also pending
  // reservations, render the secondary widget UNDER the splash so the seeker
  // still sees what they need to act on. Wrapped in the same outer container
  // as the populated-cart return so spacing matches.
  if (items.length === 0) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px clamp(16px, 5vw, 48px) 80px' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '60px 0', textAlign: 'center' }}>
          <span style={{ fontSize: 64, display: 'block', marginBottom: 24 }}>🛍️</span>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 400, color: '#3A3530', marginBottom: 10 }}>
            Your cart is empty
          </h1>
          <p style={{ fontSize: 14, color: '#8A8278', marginBottom: 32 }}>
            Discover curated spiritual tools, digital resources, and experiences from verified practitioners.
          </p>
          <Link href="/shop" style={{
            display: 'inline-block', padding: '14px 32px', borderRadius: 8,
            background: '#F07814', color: '#3A3530',
            fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
            textDecoration: 'none',
          }}>
            Browse the Shop
          </Link>
        </div>

        {pendingCount > 0 && (
          <div
            style={{
              marginTop: 32,
              paddingTop: 32,
              borderTop: '1px solid rgba(138,130,120,0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
              <h2
                style={{
                  fontFamily: 'var(--font-inter), sans-serif',
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: '#8A8278',
                  margin: 0,
                }}
              >
                Needs your attention
              </h2>
              <span
                style={{
                  fontSize: 11,
                  color: '#8A8278',
                  background: 'rgba(138,130,120,0.12)',
                  padding: '2px 10px',
                  borderRadius: 10,
                  fontWeight: 500,
                }}
              >
                {pendingCount}
              </span>
            </div>
            <p style={{ fontSize: 12, color: '#8A8278', marginBottom: 18, maxWidth: 640 }}>
              Reservations awaiting payment from earlier sessions. Each has its
              own checkout — complete them before they expire.
            </p>
            {pendingTours.map((tour) => {
              const deadline = formatHoldDeadline(tour.holdHoursLeft);
              return (
                <PendingRow
                  key={`tour-${tour.id}`}
                  badge="Tour · Deposit due"
                  badgeColor="rgba(240,120,20,0.18)"
                  icon="🌍"
                  coverUrl={tour.coverImageUrl}
                  title={tour.title}
                  subtitle={`${tour.travelers} traveller${tour.travelers > 1 ? 's' : ''} · Deposit due ${fmtMoney(tour.depositDue)} of ${fmtMoney(tour.totalAmount)}`}
                  deadline={deadline}
                  primaryHref={`/seeker/dashboard/tours/${tour.id}`}
                  primaryLabel="Pay Deposit →"
                />
              );
            })}
            {pendingBookings.map((booking) => (
              <PendingRow
                key={`booking-${booking.id}`}
                badge="Session · Awaiting payment"
                badgeColor="rgba(90,138,106,0.18)"
                icon="📅"
                coverUrl={booking.guideAvatar}
                title={booking.serviceName}
                subtitle={`With ${booking.guideName} · ${fmtSlot(booking.slotStart)} · ${fmtMoney(booking.totalAmount)}`}
                deadline={null}
                primaryHref={`/seeker/dashboard/bookings/${booking.id}`}
                primaryLabel="Complete Payment →"
              />
            ))}
            {pendingTickets.map((ticket) => (
              <PendingRow
                key={`ticket-${ticket.id}`}
                badge="Ticket reservation · Awaiting payment"
                badgeColor="rgba(240,120,32,0.15)"
                icon="🎫"
                coverUrl={ticket.coverImageUrl}
                title={ticket.eventTitle}
                subtitle={`${ticket.quantity} × ${ticket.tierName} · ${fmtMoney(ticket.totalAmount)} · ${fmtSlot(ticket.eventStart)}`}
                deadline={null}
                primaryHref={`/events/${ticket.eventId}/checkout`}
                primaryLabel="Complete Purchase →"
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px clamp(16px, 5vw, 48px) 80px' }}>
      <h1 style={{
        fontFamily: "'Playfair Display', serif",
        fontSize: 32, fontWeight: 400, color: '#3A3530', marginBottom: 6,
      }}>
        Your Cart
      </h1>
      <p style={{ fontSize: 13, color: '#8A8278', marginBottom: 32 }}>{itemCount} item{itemCount !== 1 ? 's' : ''}</p>

      {/* Warnings banner — pricing changes + stock issues. Blocks checkout until acknowledged. */}
      {blockingWarnings.length > 0 && (
        <div style={{
          background: '#FEF7F0',
          border: '1.5px solid #F07814',
          borderRadius: 12,
          padding: '16px 20px',
          marginBottom: 28,
          display: 'flex',
          gap: 14,
          alignItems: 'flex-start',
        }}>
          <div style={{ fontSize: 20, lineHeight: 1 }}>⚠️</div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 17, color: '#3A3530', marginBottom: 8, fontWeight: 500,
            }}>
              Some items in your cart changed while you were away
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#3A3530', lineHeight: 1.7 }}>
              {blockingWarnings.map((w, i) => (
                <li key={i}>{w.message}</li>
              ))}
            </ul>
            {!warningsAcknowledged && (
              <button
                onClick={() => acknowledgeWarnings()}
                style={{
                  marginTop: 12,
                  padding: '8px 18px',
                  borderRadius: 6,
                  background: '#3A3530',
                  color: '#F07814',
                  border: 'none',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                Acknowledge &amp; continue
              </button>
            )}
          </div>
        </div>
      )}

      <div className="sc-stack-lg" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 48 }}>
        {/* Left: Cart items */}
        <div>
          {/* Group by type */}
          {[
            { label: 'Physical Items', filter: (i: typeof items[0]) => i.productType === 'PHYSICAL', note: 'Ships within 3-5 business days' },
            { label: 'Digital Products', filter: (i: typeof items[0]) => i.productType === 'DIGITAL', note: 'Instant delivery after purchase' },
            { label: 'Event Tickets', filter: (i: typeof items[0]) => i.itemType === 'EVENT_TICKET', note: 'E-tickets sent to your email' },
            { label: 'Soul Tours', filter: (i: typeof items[0]) => i.itemType === 'SOUL_TOUR', note: 'Confirmation sent within 24 hours' },
          ].map((section) => {
            const sectionItems = items.filter(section.filter);
            if (sectionItems.length === 0) return null;
            return (
              <div key={section.label} style={{ marginBottom: 32 }}>
                <div style={{
                  background: '#3A3530', color: '#F07814', padding: '10px 18px', borderRadius: '8px 8px 0 0',
                  fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                  display: 'flex', justifyContent: 'space-between',
                }}>
                  <span>{section.label} ({sectionItems.length})</span>
                  <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.5)' }}>{section.note}</span>
                </div>
                <div style={{ border: '1px solid rgba(240,120,20,0.1)', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
                  {sectionItems.map((item, i) => (
                    <div key={item.id} style={{
                      display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px',
                      borderBottom: i < sectionItems.length - 1 ? '1px solid rgba(240,120,20,0.08)' : 'none',
                    }}>
                      <div style={{
                        width: 80, height: 80, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
                        background: '#FEF7F0', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: 28 }}>{item.productType === 'DIGITAL' ? '🎵' : item.itemType === 'EVENT_TICKET' ? '🎫' : '📦'}</span>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 14, fontWeight: 500, color: '#3A3530' }}>{item.name}</span>
                          {typeBadge(item.productType === 'DIGITAL' ? 'DIGITAL' : item.itemType)}
                        </div>
                        {item.variantName && <div style={{ fontSize: 12, color: '#8A8278', marginBottom: 2 }}>Size: {item.variantName}</div>}
                        {item.guideName && <div style={{ fontSize: 11, color: '#8A8278' }}>by {item.guideName}</div>}
                      </div>
                      {/* Qty controls */}
                      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid rgba(240,120,20,0.2)', borderRadius: 6 }}>
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)} style={{ padding: '6px 10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#3A3530' }}>−</button>
                        <span style={{ padding: '6px 12px', fontSize: 13, fontWeight: 500, minWidth: 30, textAlign: 'center' }}>{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)} style={{ padding: '6px 10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#3A3530' }}>+</button>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: '#3A3530', minWidth: 70, textAlign: 'right' }}>
                        ${(item.price * item.quantity).toFixed(2)}
                      </div>
                      <button onClick={() => removeItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#8A8278', padding: 4 }}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Summary
            Cart-empty case is handled by an earlier early-return, so by the
            time we're here items.length is guaranteed > 0 and the summary
            always renders. */}
        <div>
          <div style={{ background: '#fff', border: '1px solid rgba(240,120,20,0.15)', borderRadius: 12, position: 'sticky', top: 100, padding: 24 }}>
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 500, color: '#3A3530', marginBottom: 20 }}>
              Order Summary
            </h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, color: '#8A8278' }}>
              <span>Subtotal ({itemCount} items)</span><span>${subtotal.toFixed(2)}</span>
            </div>
            {hasPhysical && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, color: '#8A8278' }}>
                <span>Shipping</span><span>Calculated at checkout</span>
              </div>
            )}
            <div style={{
              display: 'flex', justifyContent: 'space-between', paddingTop: 16, marginTop: 8,
              borderTop: '2px solid #F07814',
            }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#3A3530' }}>Estimated Total</span>
              <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 500, color: '#3A3530' }}>
                ${subtotal.toFixed(2)}
              </span>
            </div>

            {mustAcknowledge ? (
              <div
                title="Please review and acknowledge the warnings above first"
                style={{
                  display: 'block', width: '100%', padding: 16, borderRadius: 8, marginTop: 20,
                  background: 'rgba(58,53,48,0.35)', color: 'rgba(240,120,20,0.7)', textAlign: 'center',
                  fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                  cursor: 'not-allowed',
                }}
              >
                Review changes above to continue
              </div>
            ) : (
              <Link href={getCheckoutRoute()} style={{
                display: 'block', width: '100%', padding: 16, borderRadius: 8, marginTop: 20,
                background: '#3A3530', color: '#F07814', textAlign: 'center',
                fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                textDecoration: 'none',
              }}>
                Proceed to Checkout
              </Link>
            )}
            <Link href="/shop" style={{
              display: 'block', width: '100%', padding: 14, borderRadius: 8, marginTop: 10,
              border: '1.5px solid rgba(240,120,20,0.3)', color: '#3A3530', textAlign: 'center',
              fontSize: 12, fontWeight: 500, letterSpacing: '0.06em',
              textDecoration: 'none',
            }}>
              Continue Shopping
            </Link>

            {/* Notes */}
            {hasDigital && (
              <div style={{ background: '#FEF7F0', borderRadius: 6, padding: '10px 14px', marginTop: 14, fontSize: 11, color: '#3A3530', display: 'flex', gap: 8 }}>
                <span>⚡</span> Digital items will be available for instant download after purchase.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────
          Pending reservations widget — placed BELOW the active cart so it
          doesn't compete with the primary "Proceed to Checkout" CTA. These
          are tour deposits / service bookings / event ticket holds from
          prior flows that the seeker still needs to act on. Each item has
          its own dedicated checkout — the Order Summary above deliberately
          ignores them because they don't share a Stripe intent with the
          cart's bulk-checkout flow.

          Styled less prominently than the cart sections: smaller cards,
          muted heading, outline CTAs. Visible but secondary.
          ─────────────────────────────────────────────────────────────── */}
      {pendingCount > 0 && (
        <div
          style={{
            marginTop: 56,
            paddingTop: 32,
            borderTop: '1px solid rgba(138,130,120,0.2)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 12,
              marginBottom: 6,
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-inter), sans-serif',
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#8A8278',
                margin: 0,
              }}
            >
              Needs your attention
            </h2>
            <span
              style={{
                fontSize: 11,
                color: '#8A8278',
                background: 'rgba(138,130,120,0.12)',
                padding: '2px 10px',
                borderRadius: 10,
                fontWeight: 500,
              }}
            >
              {pendingCount}
            </span>
          </div>
          <p style={{ fontSize: 12, color: '#8A8278', marginBottom: 18, maxWidth: 640 }}>
            Reservations awaiting payment from earlier sessions. Each has its
            own checkout — complete them before they expire.
          </p>

          {/* Tour deposits */}
          {pendingTours.map((tour) => {
            const deadline = formatHoldDeadline(tour.holdHoursLeft);
            return (
              <PendingRow
                key={`tour-${tour.id}`}
                badge="Tour · Deposit due"
                badgeColor="rgba(240,120,20,0.18)"
                icon="🌍"
                coverUrl={tour.coverImageUrl}
                title={tour.title}
                subtitle={`${tour.travelers} traveller${tour.travelers > 1 ? 's' : ''} · Deposit due ${fmtMoney(tour.depositDue)} of ${fmtMoney(tour.totalAmount)}`}
                deadline={deadline}
                primaryHref={`/seeker/dashboard/tours/${tour.id}`}
                primaryLabel="Pay Deposit →"
              />
            );
          })}

          {/* Service bookings */}
          {pendingBookings.map((booking) => (
            <PendingRow
              key={`booking-${booking.id}`}
              badge="Session · Awaiting payment"
              badgeColor="rgba(90,138,106,0.18)"
              icon="📅"
              coverUrl={booking.guideAvatar}
              title={booking.serviceName}
              subtitle={`With ${booking.guideName} · ${fmtSlot(booking.slotStart)} · ${fmtMoney(booking.totalAmount)}`}
              deadline={null}
              primaryHref={`/seeker/dashboard/bookings/${booking.id}`}
              primaryLabel="Complete Payment →"
            />
          ))}

          {/* Event ticket reservations */}
          {pendingTickets.map((ticket) => (
            <PendingRow
              key={`ticket-${ticket.id}`}
              badge="Ticket reservation · Awaiting payment"
              badgeColor="rgba(240,120,32,0.15)"
              icon="🎫"
              coverUrl={ticket.coverImageUrl}
              title={ticket.eventTitle}
              subtitle={`${ticket.quantity} × ${ticket.tierName} · ${fmtMoney(ticket.totalAmount)} · ${fmtSlot(ticket.eventStart)}`}
              deadline={null}
              primaryHref={`/events/${ticket.eventId}/checkout`}
              primaryLabel="Complete Purchase →"
            />
          ))}
        </div>
      )}
    </div>
  );
}
