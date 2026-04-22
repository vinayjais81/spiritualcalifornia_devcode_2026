'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { StripeProvider } from '@/components/public/checkout/StripeProvider';
import { StripePaymentForm } from '@/components/public/checkout/StripePaymentForm';
import { useSiteConfigOrFallback } from '@/lib/siteConfig';

// ─── Design tokens (match site palette) ─────────────────────────────────────

const C = {
  gold: '#E8B84B', goldLight: '#F5D98A', goldPale: '#FDF6E3',
  charcoal: '#3A3530', warmGray: '#8A8278', offWhite: '#FAFAF7', white: '#FFFFFF',
};
const serif = "'Cormorant Garamond', serif";
const sans = "'Inter', sans-serif";

// ─── Types ──────────────────────────────────────────────────────────────────

interface TicketTier {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  capacity: number;
  sold: number;
  isActive: boolean;
}

interface EventDetail {
  id: string;
  title: string;
  description: string | null;
  type: string;
  startTime: string;
  endTime: string;
  timezone: string;
  location: string | null;
  coverImageUrl: string | null;
  guide: {
    displayName: string | null;
    user: { firstName: string; lastName: string; avatarUrl: string | null };
  };
  ticketTiers: TicketTier[];
}

interface AttendeeForm {
  firstName: string;
  lastName: string;
  email: string;
  dietaryNeeds: string;
  accessibilityNeeds: string;
}

interface ConfirmedTicket {
  id: string;
  attendeeName: string | null;
  attendeeEmail: string | null;
  qrCode: string | null;
  status: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}
function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
}
function fmtMoney(v: number) {
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STEPS = ['Select Tickets', 'Attendee Details', 'Payment', 'Your Tickets'];

// ─── Page ───────────────────────────────────────────────────────────────────

export default function EventCheckoutPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const siteConfig = useSiteConfigOrFallback();
  const bookingFeeRate = siteConfig.fees.eventBookingFeePercent / 100;

  // State
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  // Step 0: Ticket selection
  const [selectedTierId, setSelectedTierId] = useState('');
  const [quantity, setQuantity] = useState(1);

  // Step 1: Attendee forms
  const [attendees, setAttendees] = useState<AttendeeForm[]>([]);

  // Step 2: Payment
  const [clientSecret, setClientSecret] = useState('');
  const [purchaseGroupId, setPurchaseGroupId] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [summary, setSummary] = useState<{ subtotal: number; bookingFee: number; total: number } | null>(null);

  // Step 3: Confirmation
  const [confirmedTickets, setConfirmedTickets] = useState<ConfirmedTicket[]>([]);

  // ─── Load event ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!eventId) return;
    api.get(`/events/${eventId}`)
      .then(({ data }) => {
        setEvent(data);
        const activeTiers = (data.ticketTiers || []).filter((t: TicketTier) => t.isActive);
        if (activeTiers.length > 0) setSelectedTierId(activeTiers[0].id);
      })
      .catch(() => setError('Event not found'))
      .finally(() => setLoading(false));
  }, [eventId]);

  // ─── Computed ───────────────────────────────────────────────────────────

  const selectedTier = event?.ticketTiers.find((t) => t.id === selectedTierId) ?? null;
  const remaining = selectedTier ? selectedTier.capacity - selectedTier.sold : 0;
  const subtotal = selectedTier ? selectedTier.price * quantity : 0;
  const bookingFee = Math.round(subtotal * bookingFeeRate * 100) / 100;
  const total = subtotal + bookingFee;
  const guideName = event?.guide.displayName || `${event?.guide.user.firstName} ${event?.guide.user.lastName}`;

  // ─── Step transitions ──────────────────────────────────────────────────

  const goToAttendees = () => {
    if (!selectedTier) return;
    if (quantity > remaining) { setError(`Only ${remaining} tickets remaining`); return; }
    // Initialize attendee forms
    const forms: AttendeeForm[] = Array.from({ length: quantity }, (_, i) => ({
      firstName: i === 0 && user ? user.firstName : '',
      lastName: i === 0 && user ? user.lastName : '',
      email: i === 0 && user ? user.email : '',
      dietaryNeeds: '',
      accessibilityNeeds: '',
    }));
    setAttendees(forms);
    setError(null);
    setStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const validateAttendees = (): string | null => {
    for (let i = 0; i < attendees.length; i++) {
      const a = attendees[i];
      if (!a.firstName.trim()) return `Attendee ${i + 1}: first name is required`;
      if (!a.lastName.trim()) return `Attendee ${i + 1}: last name is required`;
      if (!a.email.trim()) return `Attendee ${i + 1}: email is required`;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email)) return `Attendee ${i + 1}: invalid email`;
    }
    return null;
  };

  const goToPayment = async () => {
    if (!isAuthenticated) {
      router.push(`/signin?redirect=/events/${eventId}/checkout`);
      return;
    }
    const err = validateAttendees();
    if (err) { setError(err); return; }
    setError(null);
    setCheckoutLoading(true);

    try {
      const { data } = await api.post('/tickets/event-checkout', {
        eventId,
        tierId: selectedTierId,
        quantity,
        attendees: attendees.map((a) => ({
          firstName: a.firstName.trim(),
          lastName: a.lastName.trim(),
          email: a.email.trim(),
          dietaryNeeds: a.dietaryNeeds.trim() || undefined,
          accessibilityNeeds: a.accessibilityNeeds.trim() || undefined,
        })),
      });
      setClientSecret(data.clientSecret);
      setPurchaseGroupId(data.purchaseGroupId);
      setSummary(data.summary);
      setStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      const msg = err.response?.data?.message ?? 'Checkout failed. Please try again.';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handlePaymentSuccess = useCallback(async (paymentIntentId: string) => {
    // Tell backend to confirm (idempotent — webhook also does this)
    api.post('/payments/confirm-payment', { paymentIntentId }).catch(() => {});
    // Fetch confirmed tickets with QR codes (with retry for QR generation)
    let retries = 0;
    const fetchTickets = async () => {
      try {
        const { data } = await api.get(`/tickets/purchase-group/${purchaseGroupId}`);
        if (data.tickets?.[0]?.qrCode || retries >= 5) {
          setConfirmedTickets(data.tickets);
          setStep(3);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          retries++;
          setTimeout(fetchTickets, 1500);
        }
      } catch {
        setStep(3);
      }
    };
    setTimeout(fetchTickets, 2000);
  }, [purchaseGroupId]);

  // ─── Render helpers ────────────────────────────────────────────────────

  const updateAttendee = (index: number, field: keyof AttendeeForm, value: string) => {
    setAttendees((prev) => prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  };

  if (loading) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 14, color: C.warmGray, fontFamily: sans }}>Loading event...</div>
    </div>
  );

  if (error && !event) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 14, color: '#C0392B', fontFamily: sans }}>{error}</div>
      <Link href="/events" style={{ fontSize: 13, color: C.gold, fontFamily: sans }}>← Back to events</Link>
    </div>
  );

  if (!event) return null;

  // ─── Layout ────────────────────────────────────────────────────────────

  return (
    <div style={{ background: C.offWhite, minHeight: '100vh' }}>
      {/* Nav bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 48px', background: C.white, borderBottom: '1px solid rgba(232,184,75,0.15)' }}>
        <Link href={`/events`} style={{ fontSize: 12, color: C.warmGray, textDecoration: 'none', letterSpacing: '0.08em' }}>← Back to Events</Link>
        <Link href="/" style={{ fontFamily: serif, fontSize: 18, fontWeight: 500, color: C.charcoal, textDecoration: 'none' }}>Spiritual California</Link>
        <div style={{ width: 100 }} />
      </div>

      {/* Progress bar */}
      <div style={{ background: C.white, borderBottom: '1px solid rgba(232,184,75,0.1)', padding: '14px 48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {STEPS.map((label, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
            {i > 0 && <div style={{ width: 60, height: 1, background: 'rgba(232,184,75,0.2)', margin: '0 12px' }} />}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: i < step ? C.gold : i === step ? C.charcoal : C.warmGray, fontWeight: i === step ? 500 : 400 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: i <= step ? C.gold : 'rgba(232,184,75,0.3)' }} />
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 32px 80px', display: 'grid', gridTemplateColumns: step === 3 ? '1fr' : '1fr 360px', gap: 48, alignItems: 'start' }}>
        <div>
          {/* Event card */}
          <div style={{ background: C.charcoal, borderRadius: 10, padding: 24, marginBottom: 28, display: 'flex', gap: 20, alignItems: 'center' }}>
            {event.coverImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={event.coverImageUrl} alt={event.title} style={{ width: 80, height: 80, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
            )}
            <div>
              <h2 style={{ fontFamily: serif, fontSize: 20, fontWeight: 500, color: C.goldLight, marginBottom: 6 }}>{event.title}</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <MetaItem icon="calendar">{fmtDate(event.startTime)}</MetaItem>
                <MetaItem icon="clock">{fmtTime(event.startTime)} – {fmtTime(event.endTime)}</MetaItem>
                {event.location && <MetaItem icon="pin">{event.location}</MetaItem>}
                <MetaItem icon="user">Hosted by {guideName}</MetaItem>
              </div>
            </div>
          </div>

          {error && (
            <div style={{ background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.2)', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#C0392B', fontFamily: sans, marginBottom: 20 }}>
              {error}
            </div>
          )}

          {/* ── STEP 0: Select Tickets ────────────────────────────────── */}
          {step === 0 && (
            <>
              <SectionTitle>Select Ticket Type</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                {event.ticketTiers.filter((t) => t.isActive).map((tier) => {
                  const left = tier.capacity - tier.sold;
                  const sel = selectedTierId === tier.id;
                  return (
                    <label
                      key={tier.id}
                      onClick={() => { setSelectedTierId(tier.id); setError(null); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                        border: `1px solid ${sel ? C.gold : 'rgba(232,184,75,0.2)'}`,
                        borderRadius: 6, cursor: 'pointer', background: sel ? C.goldPale : C.white,
                        transition: 'all 0.2s',
                      }}
                    >
                      <input type="radio" name="ticket-tier" checked={sel} readOnly style={{ accentColor: C.gold, width: 16, height: 16 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: C.charcoal }}>{tier.name}</div>
                        {tier.description && <div style={{ fontSize: 11, color: C.warmGray }}>{tier.description}</div>}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: C.charcoal }}>${Number(tier.price).toFixed(0)}</div>
                        {left <= 10 && left > 0 && <div style={{ fontSize: 10, color: '#e67e22' }}>{left} spots left</div>}
                        {left === 0 && <div style={{ fontSize: 10, color: '#C0392B' }}>Sold out</div>}
                      </div>
                    </label>
                  );
                })}
              </div>

              <SectionTitle>Number of Tickets</SectionTitle>
              <div style={{ maxWidth: 280, marginBottom: 28 }}>
                <Label>Quantity</Label>
                <select
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  style={inputStyle}
                >
                  {Array.from({ length: Math.min(10, remaining || 1) }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n} ticket{n > 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>

              <button onClick={goToAttendees} disabled={!selectedTier || remaining === 0} style={btnStyle(remaining === 0)}>
                Continue → Attendee Details
              </button>
            </>
          )}

          {/* ── STEP 1: Attendee Details ──────────────────────────────── */}
          {step === 1 && (
            <>
              <SectionTitle>Attendee Information</SectionTitle>
              {attendees.map((a, i) => (
                <div key={i} style={{ border: '1px solid rgba(232,184,75,0.2)', borderRadius: 8, padding: 20, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: C.charcoal }}>
                      <div style={{ width: 24, height: 24, background: C.gold, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: C.charcoal }}>{i + 1}</div>
                      Ticket Holder {i + 1} {i === 0 && '(Primary)'}
                    </div>
                    <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 3, background: 'rgba(232,184,75,0.12)', color: C.gold }}>
                      {selectedTier?.name}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                    <div><Label>First Name</Label><input style={inputStyle} type="text" placeholder="First name" value={a.firstName} onChange={(e) => updateAttendee(i, 'firstName', e.target.value)} /></div>
                    <div><Label>Last Name</Label><input style={inputStyle} type="text" placeholder="Last name" value={a.lastName} onChange={(e) => updateAttendee(i, 'lastName', e.target.value)} /></div>
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <Label>Email — Ticket sent here</Label>
                    <input style={inputStyle} type="email" placeholder="attendee@email.com" value={a.email} onChange={(e) => updateAttendee(i, 'email', e.target.value)} />
                  </div>
                  <div>
                    <Label>Any dietary requirements or accessibility needs?</Label>
                    <input style={inputStyle} type="text" placeholder="e.g. vegetarian, wheelchair access" value={a.dietaryNeeds || a.accessibilityNeeds} onChange={(e) => updateAttendee(i, 'dietaryNeeds', e.target.value)} />
                  </div>
                </div>
              ))}

              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => { setStep(0); setError(null); }} style={{ ...btnSecondaryStyle, flex: 1 }}>← Back</button>
                <button onClick={goToPayment} disabled={checkoutLoading} style={{ ...btnStyle(checkoutLoading), flex: 2 }}>
                  {checkoutLoading ? 'Setting up payment...' : 'Continue → Payment'}
                </button>
              </div>
            </>
          )}

          {/* ── STEP 2: Payment ───────────────────────────────────────── */}
          {step === 2 && clientSecret && (
            <>
              <SectionTitle>Payment</SectionTitle>
              <StripeProvider clientSecret={clientSecret}>
                <StripePaymentForm
                  submitLabel={`Confirm & Pay — ${fmtMoney(summary?.total ?? total)} (${quantity} ticket${quantity > 1 ? 's' : ''})`}
                  onSuccess={handlePaymentSuccess}
                  returnUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/events/${eventId}/checkout`}
                  cancellationNote={siteConfig.cancellationPolicies.event.text}
                />
              </StripeProvider>
            </>
          )}

          {/* ── STEP 3: Confirmation / Your Tickets ───────────────────── */}
          {step === 3 && (
            <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#E8F5E9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28 }}>✓</div>
              <h2 style={{ fontFamily: serif, fontSize: 32, fontWeight: 400, color: C.charcoal, marginBottom: 8 }}>Tickets Confirmed!</h2>
              <p style={{ fontSize: 14, color: C.warmGray, fontFamily: sans, marginBottom: 32 }}>
                E-tickets with QR codes have been prepared for each attendee. Show the QR code at the door.
              </p>

              {confirmedTickets.map((ticket, i) => (
                <div key={ticket.id} style={{
                  border: '1px solid rgba(232,184,75,0.2)', borderRadius: 10, padding: 24,
                  marginBottom: 16, background: C.white, textAlign: 'left',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 11, color: C.warmGray, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Ticket {i + 1}</div>
                      <div style={{ fontSize: 15, fontWeight: 500, color: C.charcoal, marginTop: 4 }}>{ticket.attendeeName}</div>
                      <div style={{ fontSize: 12, color: C.warmGray }}>{ticket.attendeeEmail}</div>
                    </div>
                    <div style={{ padding: '4px 10px', borderRadius: 4, background: '#E8F5E9', fontSize: 11, fontWeight: 600, color: '#2E7D32', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      {ticket.status}
                    </div>
                  </div>
                  {ticket.qrCode && (
                    <div style={{ textAlign: 'center', padding: 16, background: C.goldPale, borderRadius: 6 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ticket.qrCode} alt="QR Code" style={{ width: 160, height: 160 }} />
                      <div style={{ fontSize: 11, color: C.warmGray, marginTop: 8 }}>Show this QR code at the door</div>
                    </div>
                  )}
                </div>
              ))}

              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24 }}>
                <Link href="/events" style={{ ...btnSecondaryStyle, textDecoration: 'none', textAlign: 'center', padding: '14px 28px' }}>Browse More Events</Link>
                <Link href="/" style={{ ...btnStyle(false) as any, textDecoration: 'none', textAlign: 'center', padding: '14px 28px' }}>Go Home</Link>
              </div>
            </div>
          )}
        </div>

        {/* ── Sidebar: Ticket Summary ─────────────────────────────── */}
        {step < 3 && (
          <div style={{ background: C.white, border: '1px solid rgba(232,184,75,0.2)', borderRadius: 8, padding: 28, position: 'sticky', top: 24 }}>
            <div style={{ fontFamily: serif, fontSize: 20, fontWeight: 500, marginBottom: 20 }}>Ticket Summary</div>

            {selectedTier && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(232,184,75,0.08)', fontSize: 13 }}>
                <div>
                  <div style={{ color: C.charcoal }}>{selectedTier.name} × {quantity}</div>
                  <div style={{ fontSize: 11, color: C.warmGray }}>{event.title}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{fmtMoney(subtotal)}</div>
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              <SummaryRow label="Subtotal" value={fmtMoney(subtotal)} />
              <SummaryRow label="Booking fee (5%)" value={fmtMoney(bookingFee)} />
              <SummaryRow label="Tax" value="$0.00" />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0 0', marginTop: 8, borderTop: `2px solid ${C.gold}` }}>
              <span style={{ fontFamily: serif, fontSize: 18 }}>Total</span>
              <span style={{ fontFamily: serif, fontSize: 22, fontWeight: 500 }}>{fmtMoney(total)}</span>
            </div>

            {/* QR preview */}
            <div style={{ marginTop: 20, padding: 16, background: C.goldPale, borderRadius: 6, textAlign: 'center', border: '1px solid rgba(232,184,75,0.2)' }}>
              <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.warmGray, marginBottom: 10 }}>Your tickets after payment</div>
              <div style={{ width: 80, height: 80, margin: '0 auto 8px', background: C.charcoal, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.5">
                  <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                  <path d="M14 14h1v1h-1zM16 14h1v1h-1zM14 16h1v1h-1zM16 16h1v1h-1zM18 14h3v3h-3zM14 18h3v3h-3z" />
                </svg>
              </div>
              <div style={{ fontSize: 11, color: C.warmGray, lineHeight: 1.5 }}>
                Each attendee receives a unique QR code ticket by email. Show it at the door on your phone or print it.
              </div>
            </div>

            <div style={{ marginTop: 16, padding: 12, background: C.goldPale, borderRadius: 4, fontSize: 11, color: C.warmGray, lineHeight: 1.6 }}>
              <strong style={{ color: C.charcoal }}>Cancellation policy:</strong> {siteConfig.cancellationPolicies.event.text}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shared sub-components ──────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: serif, fontSize: 20, fontWeight: 500, color: C.charcoal, marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid rgba(232,184,75,0.15)' }}>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ display: 'block', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.warmGray, marginBottom: 5 }}>{children}</label>;
}

function MetaItem({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.warmGray }}>
      <span style={{ width: 12, height: 12, opacity: 0.6 }}>
        {icon === 'calendar' && '📅'}
        {icon === 'clock' && '🕐'}
        {icon === 'pin' && '📍'}
        {icon === 'user' && '👤'}
      </span>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13, borderBottom: '1px solid rgba(232,184,75,0.08)' }}>
      <span style={{ color: C.warmGray }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  borderWidth: '1px', borderStyle: 'solid', borderColor: 'rgba(232,184,75,0.25)',
  borderRadius: 4, padding: '11px 14px', fontSize: 13, fontFamily: sans,
  background: C.white, color: C.charcoal, outline: 'none', width: '100%',
  boxSizing: 'border-box', transition: 'border-color 0.2s',
};

function btnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: '100%', padding: 16, background: disabled ? '#C4BDB5' : C.charcoal, color: disabled ? '#fff' : C.gold,
    border: 'none', borderRadius: 4, fontFamily: sans, fontSize: 13, fontWeight: 500,
    letterSpacing: '0.1em', textTransform: 'uppercase', cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.25s',
  };
}

const btnSecondaryStyle: React.CSSProperties = {
  padding: '14px 24px', background: C.white, color: C.charcoal,
  border: `1px solid rgba(232,184,75,0.3)`, borderRadius: 4,
  fontFamily: sans, fontSize: 13, fontWeight: 500, letterSpacing: '0.08em',
  textTransform: 'uppercase', cursor: 'pointer',
};
