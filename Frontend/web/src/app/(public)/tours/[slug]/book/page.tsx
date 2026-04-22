'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { StepNav } from '@/components/public/booking/StepNav';
import { BookingSuccess } from '@/components/public/booking/BookingSuccess';
import { StripeProvider } from '@/components/public/checkout/StripeProvider';
import { StripePaymentForm } from '@/components/public/checkout/StripePaymentForm';
import { useAuthStore } from '@/store/auth.store';
import { useSiteConfigOrFallback } from '@/lib/siteConfig';

// ─── Types ──────────────────────────────────────────────────────────────────

interface RoomType {
  id: string;
  name: string;
  description: string | null;
  totalPrice: number | string;
  capacity: number;
  available: number;
}

interface Departure {
  id: string;
  startDate: string;
  endDate: string;
  capacity: number;
  spotsRemaining: number;
  status: string;
  priceOverride: number | string | null;
}

interface Tour {
  id: string;
  title: string;
  slug: string;
  startDate: string;
  endDate: string;
  location: string | null;
  basePrice: number | string;
  currency: string;
  capacity: number;
  spotsRemaining: number;
  coverImageUrl: string | null;
  included: string[];
  minDepositPerPerson: number | string | null;
  depositMin: number | string | null;
  balanceDueDaysBefore: number;
  cancellationPolicy: { fullRefundDaysBefore: number; halfRefundDaysBefore: number } | null;
  roomTypes: RoomType[];
  departures: Departure[];
  guide: { displayName: string; slug: string; user: { avatarUrl: string | null } };
}

interface TravelerForm {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  email: string;
  phone: string;
}

interface CreatedBooking {
  id: string;
  bookingReference: string | null;
  totalAmount: number | string;
  depositAmount: number | string | null;
  balanceAmount: number | string | null;
  balanceDueAt: string | null;
}

// ─── Constants & helpers ────────────────────────────────────────────────────

const STEPS = ['Choose Departure', 'Travelers & Room', 'Your Details', 'Deposit & Pay'];

const C = {
  gold: '#E8B84B',
  goldLight: '#F5D98A',
  goldPale: '#FDF6E3',
  charcoal: '#3A3530',
  warmGray: '#8A8278',
  offWhite: '#FAFAF7',
  white: '#FFFFFF',
  red: '#C0392B',
  green: '#5A8A6A',
};
const serif = "'Cormorant Garamond', serif";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtMonthYear(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
function daysBetween(a: string, b: string) {
  return Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

const emptyTraveler = (): TravelerForm => ({
  firstName: '', lastName: '', dateOfBirth: '', nationality: '',
  email: '', phone: '',
});

// ─── Form input atoms (matched to public site styling) ──────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
      color: C.warmGray, fontWeight: 500,
    }}>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '12px 14px', borderRadius: 6,
  border: '1.5px solid rgba(232,184,75,0.2)',
  background: C.offWhite, fontSize: 13, outline: 'none',
  fontFamily: "'Inter', sans-serif", color: C.charcoal,
};

function FormField({
  label, value, onChange, type = 'text', placeholder, required, full,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  full?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...(full ? { gridColumn: '1 / -1' } : {}) }}>
      <FieldLabel>{label}{required && ' *'}</FieldLabel>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
    </div>
  );
}

// ─── Page component ─────────────────────────────────────────────────────────

export default function BookTourPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params?.slug as string;
  const departureFromUrl = searchParams?.get('departure') || null;

  const { isAuthenticated, user } = useAuthStore();
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const siteConfig = useSiteConfigOrFallback();

  // ─── State ────────────────────────────────────────────────────────────────
  const [tour, setTour] = useState<Tour | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [step, setStep] = useState(0);

  // Step 1: departure
  const [selectedDeparture, setSelectedDeparture] = useState<string | null>(null);
  // Step 2: travelers + room
  const [travelersCount, setTravelersCount] = useState(2);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  // Step 3: per-traveler manifest + booking-level fields
  const [travelers, setTravelers] = useState<TravelerForm[]>([emptyTraveler(), emptyTraveler()]);
  const [dietaryRequirements, setDietaryRequirements] = useState('none');
  const [dietaryNotes, setDietaryNotes] = useState('');
  const [healthConditions, setHealthConditions] = useState('');
  const [intentions, setIntentions] = useState('');
  // Step 4: deposit + payment
  const [chosenDeposit, setChosenDeposit] = useState<number | null>(null);
  const [createdBooking, setCreatedBooking] = useState<CreatedBooking | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [creatingBooking, setCreatingBooking] = useState(false);
  // Final
  const [showSuccess, setShowSuccess] = useState(false);

  // ─── Load tour ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!slug) return;
    api.get(`/soul-tours/${slug}`)
      .then((res) => {
        const t: Tour = res.data;
        setTour(t);
        // Pre-select departure (from URL or first upcoming)
        const upcoming = (t.departures || []).filter(
          (d) => d.status === 'SCHEDULED' && new Date(d.startDate) >= new Date(),
        );
        const initial = upcoming.find((d) => d.id === departureFromUrl) || upcoming[0];
        if (initial) setSelectedDeparture(initial.id);
        // Pre-select first available room
        const firstRoom = (t.roomTypes || []).find((r) => r.available > 0);
        if (firstRoom) setSelectedRoomId(firstRoom.id);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug, departureFromUrl]);

  // ─── Pre-fill primary traveler from logged-in user ───────────────────────
  useEffect(() => {
    if (isAuthenticated && user) {
      setTravelers((prev) => {
        const next = [...prev];
        // Only fill if primary traveler is empty (don't overwrite user edits)
        if (next[0] && !next[0].firstName && !next[0].lastName && !next[0].email) {
          next[0] = {
            ...next[0],
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            email: user.email || '',
          };
        }
        return next;
      });
    }
  }, [isAuthenticated, user]);

  // ─── Resize traveler array when count changes ────────────────────────────
  useEffect(() => {
    setTravelers((prev) => {
      if (prev.length === travelersCount) return prev;
      if (prev.length < travelersCount) {
        // Grow
        return [...prev, ...Array(travelersCount - prev.length).fill(0).map(emptyTraveler)];
      }
      // Shrink
      return prev.slice(0, travelersCount);
    });
  }, [travelersCount]);

  // ─── Computed values ─────────────────────────────────────────────────────
  const departure = useMemo(
    () => tour?.departures.find((d) => d.id === selectedDeparture) || null,
    [tour, selectedDeparture],
  );
  const room = useMemo(
    () => tour?.roomTypes.find((r) => r.id === selectedRoomId) || null,
    [tour, selectedRoomId],
  );
  const upcomingDepartures = useMemo(
    () => (tour?.departures || []).filter(
      (d) => d.status === 'SCHEDULED' && new Date(d.startDate) >= new Date(),
    ),
    [tour],
  );
  const perPerson = room
    ? Number(departure?.priceOverride || room.totalPrice)
    : Number(tour?.basePrice || 0);
  const totalAmount = perPerson * travelersCount;
  const minDepositPerPerson = Number(tour?.minDepositPerPerson || 500);
  const minDepositTotal = Math.max(
    minDepositPerPerson * travelersCount,
    Number(tour?.depositMin || 0),
  );

  const depositOptions = useMemo(() => {
    return [
      { amount: minDepositTotal, label: `Minimum deposit ($${minDepositPerPerson}/person)` },
      { amount: Math.round(totalAmount * 0.25), label: '25% of total' },
      { amount: Math.round(totalAmount * 0.5), label: '50% of total' },
      { amount: totalAmount, label: 'Pay in full' },
    ].filter((opt) => opt.amount >= minDepositTotal && opt.amount <= totalAmount);
  }, [minDepositTotal, minDepositPerPerson, totalAmount]);

  // Auto-pick deposit when arriving at step 4
  useEffect(() => {
    if (step === 3 && chosenDeposit === null && depositOptions.length > 0) {
      setChosenDeposit(depositOptions[0].amount);
    }
  }, [step, chosenDeposit, depositOptions]);

  // ─── Step navigation guards ──────────────────────────────────────────────

  const canGoToStep2 = !!departure;
  const canGoToStep3 = !!departure && !!room && travelersCount > 0
    && (departure?.spotsRemaining ?? 0) >= travelersCount
    && (room?.available ?? 0) >= travelersCount;

  const validateTravelers = (): string | null => {
    if (travelers.length !== travelersCount) {
      return 'Traveler form mismatch — please refresh';
    }
    for (let i = 0; i < travelers.length; i++) {
      const t = travelers[i];
      const labelN = `Traveler ${i + 1}`;
      if (!t.firstName.trim()) return `${labelN}: first name is required`;
      if (!t.lastName.trim()) return `${labelN}: last name is required`;
      if (!t.dateOfBirth) return `${labelN}: date of birth is required`;
      if (!t.nationality.trim()) return `${labelN}: nationality is required`;
      if (i === 0) {
        if (!t.email.trim()) return 'Primary traveler email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t.email)) return 'Primary traveler email is invalid';
      }
    }
    return null;
  };

  // ─── Save form to sessionStorage (for auth round-trip) ───────────────────
  const saveFormState = () => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(`pendingTourBooking:${slug}`, JSON.stringify({
      step, selectedDeparture, travelersCount, selectedRoomId,
      travelers, dietaryRequirements, dietaryNotes, healthConditions, intentions, chosenDeposit,
    }));
  };
  const loadFormState = () => {
    if (typeof window === 'undefined') return;
    const raw = sessionStorage.getItem(`pendingTourBooking:${slug}`);
    if (!raw) return;
    try {
      const s = JSON.parse(raw);
      if (s.selectedDeparture) setSelectedDeparture(s.selectedDeparture);
      if (typeof s.travelersCount === 'number') setTravelersCount(s.travelersCount);
      if (s.selectedRoomId) setSelectedRoomId(s.selectedRoomId);
      if (Array.isArray(s.travelers)) setTravelers(s.travelers);
      if (s.dietaryRequirements) setDietaryRequirements(s.dietaryRequirements);
      if (s.dietaryNotes) setDietaryNotes(s.dietaryNotes);
      if (s.healthConditions) setHealthConditions(s.healthConditions);
      if (s.intentions) setIntentions(s.intentions);
      if (s.chosenDeposit) setChosenDeposit(s.chosenDeposit);
      if (typeof s.step === 'number') setStep(s.step);
      sessionStorage.removeItem(`pendingTourBooking:${slug}`);
    } catch { /* ignore */ }
  };

  // Restore form state on mount (after tour loads)
  useEffect(() => {
    if (tour && !loading) loadFormState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour, loading]);

  // ─── Auth gate + booking creation ────────────────────────────────────────
  const handleCreateBooking = async () => {
    if (!hasHydrated) return;

    if (!isAuthenticated || !user) {
      toast.error('Please sign in to complete your booking');
      saveFormState();
      router.push(`/signin?redirect=/tours/${slug}/book`);
      return;
    }
    if (!user.roles?.includes('SEEKER')) {
      toast.error('Please sign in with a seeker account to book a tour');
      saveFormState();
      router.push(`/signin?redirect=/tours/${slug}/book`);
      return;
    }
    if (!tour || !departure || !room) {
      toast.error('Missing tour or room selection');
      return;
    }
    if (chosenDeposit === null || chosenDeposit < minDepositTotal) {
      toast.error(`Minimum deposit is $${minDepositTotal.toLocaleString()}`);
      return;
    }
    if (chosenDeposit > totalAmount) {
      toast.error('Deposit cannot exceed total amount');
      return;
    }
    const validationErr = validateTravelers();
    if (validationErr) {
      toast.error(validationErr);
      setStep(2);
      return;
    }

    setCreatingBooking(true);
    try {
      // 1. Create the tour booking
      const bookingRes = await api.post('/soul-tours/book', {
        tourId: tour.id,
        departureId: departure.id,
        roomTypeId: room.id,
        travelers: travelersCount,
        travelersDetails: travelers.map((t, i) => ({
          isPrimary: i === 0,
          firstName: t.firstName.trim(),
          lastName: t.lastName.trim(),
          dateOfBirth: new Date(t.dateOfBirth).toISOString(),
          nationality: t.nationality.trim(),
          email: t.email.trim() || undefined,
          phone: t.phone.trim() || undefined,
        })),
        chosenDepositAmount: chosenDeposit,
        dietaryRequirements: dietaryRequirements !== 'none' ? dietaryRequirements : undefined,
        dietaryNotes: dietaryNotes.trim() || undefined,
        healthConditions: healthConditions.trim() || undefined,
        intentions: intentions.trim() || undefined,
        paymentMethod: 'STRIPE_CARD',
      });

      const booking: CreatedBooking = bookingRes.data;
      setCreatedBooking(booking);

      // 2. Create the Stripe PaymentIntent for the deposit
      const isPayingInFull = chosenDeposit >= totalAmount;
      const intentRes = await api.post('/payments/create-intent', {
        amount: chosenDeposit,
        tourBookingId: booking.id,
        paymentType: isPayingInFull ? 'FULL' : 'DEPOSIT',
      });
      setClientSecret(intentRes.data.clientSecret);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create booking');
      setCreatedBooking(null);
      setClientSecret(null);
    } finally {
      setCreatingBooking(false);
    }
  };

  // ─── Payment success handler ─────────────────────────────────────────────
  const handlePaymentSuccess = async (paymentIntentId: string) => {
    // Synchronously confirm so the booking flips to DEPOSIT_PAID immediately.
    // Webhook is the fallback if this call fails — it's idempotent.
    api.post('/payments/confirm-payment', { paymentIntentId }).catch(() => {});
    setShowSuccess(true);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // ─── Render guards ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: '120px 24px', textAlign: 'center', color: C.warmGray, fontFamily: 'Inter, sans-serif' }}>
        Loading tour…
      </div>
    );
  }
  if (notFound || !tour) {
    return (
      <div style={{ padding: '120px 24px', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🏔️</div>
        <h1 style={{ fontFamily: serif, fontSize: 32, color: C.charcoal, marginBottom: 12 }}>
          Tour not found
        </h1>
        <Link href="/travels" style={{
          display: 'inline-block', padding: '12px 28px', background: C.gold, color: C.charcoal,
          textDecoration: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13,
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          ← Browse Tours
        </Link>
      </div>
    );
  }
  if (showSuccess && createdBooking) {
    return (
      <BookingSuccess
        title="Your Spot is Reserved!"
        subtitle={`We've sent a confirmation to ${travelers[0].email} with full trip details, packing list, and preparation guide. Your guide ${tour.guide.displayName} will be in touch soon.`}
        details={[
          { label: 'Tour', value: tour.title },
          { label: 'Reference', value: createdBooking.bookingReference || createdBooking.id.slice(-8).toUpperCase() },
          { label: 'Departure', value: departure ? `${fmtDate(departure.startDate)} – ${fmtDate(departure.endDate)}` : '—' },
          { label: 'Travelers', value: `${travelersCount}` },
          { label: 'Room', value: room?.name || '—' },
          { label: 'Total', value: `$${totalAmount.toLocaleString()}` },
          { label: 'Deposit Paid', value: `$${(chosenDeposit || 0).toLocaleString()}` },
          ...(createdBooking.balanceAmount && Number(createdBooking.balanceAmount) > 0
            ? [{
                label: 'Balance Due',
                value: `$${Number(createdBooking.balanceAmount).toLocaleString()}${createdBooking.balanceDueAt ? ` by ${fmtDate(createdBooking.balanceDueAt)}` : ''}`,
              }]
            : []),
        ]}
        primaryAction={{ label: 'View My Bookings', href: '/seeker/dashboard/bookings' }}
        secondaryAction={{ label: 'Browse More Tours', href: '/travels' }}
      />
    );
  }

  // ─── Page UI ─────────────────────────────────────────────────────────────
  return (
    <>
      {/* ─── Hero ──────────────────────────────────────────────────────── */}
      <div style={{
        height: 280, position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, #2C2420, #3A3530)',
      }}>
        {tour.coverImageUrl && (
          <img
            src={tour.coverImageUrl}
            alt={tour.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', opacity: 0.5 }}
          />
        )}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to right, rgba(44,36,32,0.85), rgba(58,53,48,0.6))',
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '32px 48px',
        }}>
          <Link href={`/tours/${slug}`} style={{
            color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: 12,
            letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14,
          }}>
            ← Back to tour
          </Link>
          <h1 style={{
            fontFamily: serif, fontSize: 38, fontWeight: 400, color: '#fff', marginBottom: 12,
          }}>
            {tour.title}
          </h1>
          <div style={{ display: 'flex', gap: 24 }}>
            {departure && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
                📅 {fmtDate(departure.startDate)} – {fmtDate(departure.endDate)}
              </span>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
              👥 Max {tour.capacity} travelers
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
              💰 From ${Number(tour.basePrice).toLocaleString()}/person
            </span>
          </div>
        </div>
      </div>

      <StepNav steps={STEPS} current={step} onChange={(s) => s < step && setStep(s)} />

      <div style={{
        maxWidth: 1060, margin: '0 auto', padding: '40px 32px 80px',
        display: 'grid', gridTemplateColumns: '1fr 340px', gap: 48,
      }}>
        {/* ─── LEFT: step content ─────────────────────────────────────── */}
        <div>
          {/* ── STEP 1: Choose Departure ───────────────────────────────── */}
          {step === 0 && (
            <div>
              <h2 style={{ fontFamily: serif, fontSize: 28, fontWeight: 400, color: C.charcoal, marginBottom: 6 }}>
                Choose Your Departure
              </h2>
              <p style={{ fontSize: 13, color: C.warmGray, marginBottom: 24 }}>
                Select when you'd like to join this journey. All deposits are fully refundable up to {tour.cancellationPolicy?.fullRefundDaysBefore || 90} days before departure.
              </p>

              {upcomingDepartures.length === 0 ? (
                <div style={{
                  padding: 24, background: '#FFEBEE', border: '1px solid #FFCDD2', borderRadius: 8,
                  fontSize: 13, color: C.red,
                }}>
                  No upcoming departures available. Please check back soon or contact the guide for private group bookings.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {upcomingDepartures.map((d) => {
                    const isSelected = selectedDeparture === d.id;
                    const fewSpots = d.spotsRemaining <= 3 && d.spotsRemaining > 0;
                    return (
                      <button
                        key={d.id}
                        onClick={() => setSelectedDeparture(d.id)}
                        disabled={d.spotsRemaining === 0}
                        style={{
                          padding: '20px 18px', borderRadius: 8, textAlign: 'left',
                          background: isSelected ? C.goldPale : C.white,
                          border: isSelected ? `1.5px solid ${C.gold}` : '1.5px solid rgba(232,184,75,0.2)',
                          cursor: d.spotsRemaining === 0 ? 'not-allowed' : 'pointer',
                          opacity: d.spotsRemaining === 0 ? 0.5 : 1,
                          fontFamily: 'Inter, sans-serif',
                        }}
                      >
                        <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: isSelected ? C.gold : C.warmGray, marginBottom: 4 }}>
                          {fmtMonthYear(d.startDate)}
                        </div>
                        <div style={{ fontFamily: serif, fontSize: 20, fontWeight: 500, color: C.charcoal, marginBottom: 6 }}>
                          {fmtDate(d.startDate)} – {fmtDate(d.endDate)}
                        </div>
                        <div style={{ fontSize: 12, color: d.spotsRemaining === 0 ? C.red : fewSpots ? C.red : C.green }}>
                          {d.spotsRemaining === 0 ? 'Sold out' : `${d.spotsRemaining} spots remaining`}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button
                  onClick={() => canGoToStep2 && setStep(1)}
                  disabled={!canGoToStep2}
                  style={{
                    padding: '14px 32px', borderRadius: 8,
                    background: canGoToStep2 ? C.gold : 'rgba(232,184,75,0.3)',
                    color: C.charcoal, border: 'none',
                    fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                    cursor: canGoToStep2 ? 'pointer' : 'not-allowed',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  Continue to Travelers →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Travelers & Room ───────────────────────────────── */}
          {step === 1 && (
            <div>
              <h2 style={{ fontFamily: serif, fontSize: 28, fontWeight: 400, color: C.charcoal, marginBottom: 6 }}>
                Travelers &amp; Accommodation
              </h2>
              <p style={{ fontSize: 13, color: C.warmGray, marginBottom: 24 }}>
                How many are joining and what type of room?
              </p>

              <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.warmGray, marginBottom: 12 }}>
                Number of Travelers
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 32 }}>
                <button
                  onClick={() => setTravelersCount((c) => Math.max(1, c - 1))}
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: C.goldPale, border: '1px solid rgba(232,184,75,0.3)',
                    fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: C.charcoal,
                  }}
                >−</button>
                <span style={{ fontFamily: serif, fontSize: 28, fontWeight: 500, color: C.charcoal, minWidth: 60, textAlign: 'center' }}>
                  {travelersCount}
                </span>
                <button
                  onClick={() => {
                    const max = Math.min(departure?.spotsRemaining || 8, 8);
                    setTravelersCount((c) => Math.min(max, c + 1));
                  }}
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: C.goldPale, border: '1px solid rgba(232,184,75,0.3)',
                    fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: C.charcoal,
                  }}
                >+</button>
                <span style={{ fontSize: 13, color: C.warmGray }}>travelers</span>
              </div>

              <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.warmGray, marginBottom: 12 }}>
                Room Preference
              </div>
              {tour.roomTypes.length === 0 ? (
                <div style={{ padding: 16, background: '#FFEBEE', border: '1px solid #FFCDD2', borderRadius: 8, fontSize: 13, color: C.red, marginBottom: 24 }}>
                  No room types defined for this tour yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                  {tour.roomTypes.map((r) => {
                    const isSelected = selectedRoomId === r.id;
                    const insufficient = r.available < travelersCount;
                    return (
                      <button
                        key={r.id}
                        onClick={() => !insufficient && setSelectedRoomId(r.id)}
                        disabled={insufficient}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '16px 18px', borderRadius: 8, textAlign: 'left', width: '100%',
                          background: isSelected ? C.goldPale : C.white,
                          border: isSelected ? `1.5px solid ${C.gold}` : '1.5px solid rgba(232,184,75,0.15)',
                          cursor: insufficient ? 'not-allowed' : 'pointer',
                          opacity: insufficient ? 0.5 : 1,
                          fontFamily: 'Inter, sans-serif',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 500, color: C.charcoal, marginBottom: 2 }}>{r.name}</div>
                          {r.description && <div style={{ fontSize: 12, color: C.warmGray }}>{r.description}</div>}
                          {r.available <= 2 && r.available > 0 && (
                            <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>Only {r.available} left</div>
                          )}
                          {insufficient && (
                            <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>
                              Not enough rooms ({r.available} available for {travelersCount} travelers)
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
                          <div style={{ fontFamily: serif, fontSize: 20, fontWeight: 500, color: C.charcoal }}>
                            ${Number(r.totalPrice).toLocaleString()}
                          </div>
                          <div style={{ fontSize: 11, color: C.warmGray }}>per person</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setStep(0)} style={btnSecondary}>← Back</button>
                <button
                  onClick={() => canGoToStep3 && setStep(2)}
                  disabled={!canGoToStep3}
                  style={{
                    padding: '12px 24px', borderRadius: 8,
                    background: canGoToStep3 ? C.gold : 'rgba(232,184,75,0.3)',
                    color: C.charcoal, border: 'none',
                    fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                    cursor: canGoToStep3 ? 'pointer' : 'not-allowed',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  Continue to Your Details →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Your Details ───────────────────────────────────── */}
          {step === 2 && (
            <div>
              <h2 style={{ fontFamily: serif, fontSize: 28, fontWeight: 400, color: C.charcoal, marginBottom: 6 }}>
                Your Travel Details
              </h2>
              <p style={{ fontSize: 13, color: C.warmGray, marginBottom: 24 }}>
                Please provide details for each traveler. Names should match official identification.
              </p>

              {!isAuthenticated && hasHydrated && (
                <div style={{
                  padding: '14px 18px', background: C.goldPale, border: '1px solid rgba(232,184,75,0.3)',
                  borderRadius: 8, marginBottom: 20, fontSize: 13, color: C.charcoal,
                }}>
                  💡 <strong>Tip:</strong> <Link href={`/signin?redirect=/tours/${slug}/book`} style={{ color: C.gold, textDecoration: 'underline' }}>Sign in</Link> to pre-fill your details and access your bookings later.
                </div>
              )}

              {/* Per-traveler forms */}
              {travelers.map((t, i) => (
                <div key={i} style={{
                  background: C.white, border: '1px solid rgba(232,184,75,0.15)', borderRadius: 12,
                  padding: 24, marginBottom: 20,
                }}>
                  <div style={{ fontFamily: serif, fontSize: 18, fontWeight: 500, color: C.charcoal, marginBottom: 4, paddingBottom: 12, borderBottom: '1px solid rgba(232,184,75,0.15)' }}>
                    {i === 0 ? 'Primary Traveler' : `Traveler ${i + 1}`}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16 }}>
                    <FormField
                      label="First Name"
                      value={t.firstName}
                      onChange={(v) => setTravelers((arr) => arr.map((x, idx) => (idx === i ? { ...x, firstName: v } : x)))}
                      required
                    />
                    <FormField
                      label="Last Name"
                      value={t.lastName}
                      onChange={(v) => setTravelers((arr) => arr.map((x, idx) => (idx === i ? { ...x, lastName: v } : x)))}
                      required
                    />
                    <FormField
                      label="Date of Birth"
                      type="date"
                      value={t.dateOfBirth}
                      onChange={(v) => setTravelers((arr) => arr.map((x, idx) => (idx === i ? { ...x, dateOfBirth: v } : x)))}
                      required
                    />
                    <FormField
                      label="Nationality"
                      value={t.nationality}
                      onChange={(v) => setTravelers((arr) => arr.map((x, idx) => (idx === i ? { ...x, nationality: v } : x)))}
                      placeholder="United States"
                      required
                    />
                    <FormField
                      label={i === 0 ? 'Email Address' : 'Email Address (optional)'}
                      type="email"
                      value={t.email}
                      onChange={(v) => setTravelers((arr) => arr.map((x, idx) => (idx === i ? { ...x, email: v } : x)))}
                      placeholder="you@example.com"
                      required={i === 0}
                    />
                    <FormField
                      label={i === 0 ? 'Phone (WhatsApp preferred)' : 'Phone (optional)'}
                      type="tel"
                      value={t.phone}
                      onChange={(v) => setTravelers((arr) => arr.map((x, idx) => (idx === i ? { ...x, phone: v } : x)))}
                      placeholder="+1 (415) 000-0000"
                    />
                  </div>
                </div>
              ))}

              {/* Health & preferences (booking-level) */}
              <div style={{
                background: C.white, border: '1px solid rgba(232,184,75,0.15)', borderRadius: 12,
                padding: 24, marginBottom: 20,
              }}>
                <div style={{ fontFamily: serif, fontSize: 18, fontWeight: 500, color: C.charcoal, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid rgba(232,184,75,0.15)' }}>
                  Health &amp; Preferences
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <FieldLabel>Dietary Requirements</FieldLabel>
                    <select
                      value={dietaryRequirements}
                      onChange={(e) => setDietaryRequirements(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="none">No restrictions</option>
                      <option value="vegetarian">Vegetarian</option>
                      <option value="vegan">Vegan</option>
                      <option value="gluten-free">Gluten-free</option>
                      <option value="other">Other (specify below)</option>
                    </select>
                  </div>
                  <FormField
                    label="Dietary Notes (optional)"
                    value={dietaryNotes}
                    onChange={setDietaryNotes}
                    placeholder="e.g. nut allergy, kosher, etc."
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: '1 / -1' }}>
                    <FieldLabel>Health conditions we should know about (optional)</FieldLabel>
                    <textarea
                      value={healthConditions}
                      onChange={(e) => setHealthConditions(e.target.value)}
                      rows={3}
                      style={{ ...inputStyle, resize: 'vertical', minHeight: 70 }}
                      placeholder="e.g. altitude sickness history, mobility limitations, heart conditions…"
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: '1 / -1' }}>
                    <FieldLabel>What are you hoping to experience or transform on this journey?</FieldLabel>
                    <textarea
                      value={intentions}
                      onChange={(e) => setIntentions(e.target.value)}
                      rows={3}
                      style={{ ...inputStyle, resize: 'vertical', minHeight: 70 }}
                      placeholder="Share as much or as little as you'd like — this helps us personalize your experience…"
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setStep(1)} style={btnSecondary}>← Back</button>
                <button
                  onClick={() => {
                    const err = validateTravelers();
                    if (err) {
                      toast.error(err);
                      return;
                    }
                    setStep(3);
                  }}
                  style={{
                    padding: '12px 24px', borderRadius: 8, background: C.gold, color: C.charcoal,
                    border: 'none', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em',
                    textTransform: 'uppercase', cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  Continue to Deposit →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 4: Deposit & Pay ───────────────────────────────────── */}
          {step === 3 && (
            <div>
              <h2 style={{ fontFamily: serif, fontSize: 28, fontWeight: 400, color: C.charcoal, marginBottom: 6 }}>
                Secure Your Spot
              </h2>
              <p style={{ fontSize: 13, color: C.warmGray, marginBottom: 24, lineHeight: 1.6 }}>
                A deposit holds your place on the tour. The remaining balance is due {tour.balanceDueDaysBefore} days before departure.
                Deposits are fully refundable up to {tour.cancellationPolicy?.fullRefundDaysBefore || 90} days before departure.
              </p>

              {/* Deposit selector — disabled after booking is created */}
              <div style={{
                background: 'linear-gradient(135deg, #2C2420, #3A3530)',
                borderRadius: 12, padding: 24, marginBottom: 24,
                opacity: clientSecret ? 0.6 : 1, pointerEvents: clientSecret ? 'none' : 'auto',
              }}>
                <h3 style={{ fontFamily: serif, fontSize: 20, color: C.goldLight, marginBottom: 8 }}>
                  Choose Your Deposit Amount
                </h3>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>
                  Minimum deposit ${minDepositTotal.toLocaleString()} (${minDepositPerPerson}/person × {travelersCount})
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {depositOptions.map((opt, i) => {
                    const isSelected = chosenDeposit === opt.amount;
                    return (
                      <button
                        key={i}
                        onClick={() => setChosenDeposit(opt.amount)}
                        style={{
                          padding: '16px 14px', borderRadius: 8, textAlign: 'center',
                          background: isSelected ? 'rgba(232,184,75,0.15)' : 'rgba(255,255,255,0.05)',
                          border: isSelected ? `1.5px solid ${C.gold}` : '1.5px solid rgba(255,255,255,0.1)',
                          cursor: 'pointer',
                          fontFamily: 'Inter, sans-serif',
                        }}
                      >
                        <div style={{ fontFamily: serif, fontSize: 22, color: C.goldLight, marginBottom: 2 }}>
                          ${opt.amount.toLocaleString()}
                        </div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {opt.label}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Either: button to create booking + intent, OR Stripe form */}
              {!clientSecret && (
                <>
                  {/* Auth status banner */}
                  {hasHydrated && !isAuthenticated && (
                    <div style={{
                      padding: '14px 18px', background: '#FFFAF0',
                      border: '1px solid rgba(232,184,75,0.3)', borderRadius: 8,
                      marginBottom: 20, fontSize: 13, color: C.charcoal,
                    }}>
                      🔒 You'll be asked to sign in (or create an account) before completing payment. Your form data will be preserved.
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 12 }}>
                    <button onClick={() => setStep(2)} style={btnSecondary}>← Back</button>
                    <button
                      onClick={handleCreateBooking}
                      disabled={creatingBooking || chosenDeposit === null}
                      style={{
                        flex: 1, padding: '15px', borderRadius: 8,
                        background: creatingBooking ? 'rgba(232,184,75,0.5)' : C.charcoal,
                        color: C.gold, border: 'none',
                        fontFamily: 'Inter, sans-serif',
                        fontSize: 13, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase',
                        cursor: creatingBooking ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {creatingBooking ? 'Reserving your spot…' : `Continue to Payment — $${(chosenDeposit || 0).toLocaleString()}`}
                    </button>
                  </div>
                </>
              )}

              {/* Stripe Elements form (after booking + intent created) */}
              {clientSecret && createdBooking && (
                <div>
                  <div style={{
                    background: C.goldPale, border: `1px solid rgba(232,184,75,0.3)`, borderRadius: 8,
                    padding: '12px 16px', marginBottom: 20, fontSize: 12, color: C.charcoal,
                  }}>
                    ✓ Spot reserved. Reference: <strong>{createdBooking.bookingReference || createdBooking.id.slice(-8).toUpperCase()}</strong>. Complete payment below to confirm.
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <h3 style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.warmGray, marginBottom: 14, fontWeight: 500 }}>
                      Payment Details
                    </h3>
                    <StripeProvider clientSecret={clientSecret}>
                      <StripePaymentForm
                        submitLabel={`Pay $${(chosenDeposit || 0).toLocaleString()} & Reserve My Spot`}
                        onSuccess={handlePaymentSuccess}
                        returnUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/tours/${slug}/book`}
                        cancellationNote={(() => {
                          // Prefer per-tour policy, fall back to the platform default from /config/public.
                          const full = tour.cancellationPolicy?.fullRefundDaysBefore ?? siteConfig.cancellationPolicies.tourDefault.fullRefundDaysBefore;
                          const half = tour.cancellationPolicy?.halfRefundDaysBefore ?? siteConfig.cancellationPolicies.tourDefault.halfRefundDaysBefore;
                          return `Full refund of deposit if cancelled ${full}+ days before departure. 50% refund ${half}–${full - 1} days before. No refund within ${half} days. Travel insurance is strongly recommended.`;
                        })()}
                      />
                    </StripeProvider>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── RIGHT: sticky summary sidebar ──────────────────────────── */}
        <aside style={{
          background: C.white, border: '1px solid rgba(232,184,75,0.2)',
          borderRadius: 12, position: 'sticky', top: 24, overflow: 'hidden',
        }}>
          <div style={{ height: 160, background: 'linear-gradient(135deg, #2C2420, #3A3530)', overflow: 'hidden' }}>
            {tour.coverImageUrl ? (
              <img src={tour.coverImageUrl} alt={tour.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>🏔️</div>
            )}
          </div>

          <div style={{ padding: '20px 24px' }}>
            <h3 style={{ fontFamily: serif, fontSize: 18, fontWeight: 500, color: C.charcoal, marginBottom: 14 }}>
              {tour.title}
            </h3>

            {[
              { icon: '📅', text: departure
                ? `${fmtDate(departure.startDate)} – ${fmtDate(departure.endDate)} (${daysBetween(departure.startDate, departure.endDate)} days)`
                : 'Pick a departure date',
              },
              { icon: '📍', text: tour.location || 'Location TBD' },
              { icon: '👥', text: `${travelersCount} traveler${travelersCount > 1 ? 's' : ''}${room ? `, ${room.name}` : ''}` },
            ].map((d, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, fontSize: 12, color: C.charcoal }}>
                <span style={{ flexShrink: 0 }}>{d.icon}</span>
                <span>{d.text}</span>
              </div>
            ))}

            {tour.included.length > 0 && (
              <>
                <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.warmGray, marginTop: 16, marginBottom: 10 }}>
                  What&apos;s Included
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {tour.included.slice(0, 6).map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.charcoal }}>
                      <span style={{ color: C.gold }}>✓</span> {item}
                    </div>
                  ))}
                </div>
              </>
            )}

            <div style={{ borderTop: '1px solid rgba(232,184,75,0.1)', marginTop: 16, paddingTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12, color: C.warmGray }}>
                <span>{travelersCount} × {room?.name || 'Standard'}</span>
                <span>${totalAmount.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 12, color: C.warmGray }}>
                <span>Taxes &amp; fees</span>
                <span>$0</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid rgba(232,184,75,0.15)' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.charcoal }}>Total</span>
                <span style={{ fontFamily: serif, fontSize: 22, fontWeight: 500, color: C.charcoal }}>
                  ${totalAmount.toLocaleString()}
                </span>
              </div>
              {chosenDeposit !== null && chosenDeposit < totalAmount && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: C.gold }}>
                    <span>Deposit due today</span>
                    <span style={{ fontWeight: 600 }}>${chosenDeposit.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: C.warmGray }}>
                    <span>Balance due {tour.balanceDueDaysBefore}d before</span>
                    <span>${(totalAmount - chosenDeposit).toLocaleString()}</span>
                  </div>
                </>
              )}
              {chosenDeposit !== null && chosenDeposit >= totalAmount && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: C.gold }}>
                  <span>Paying in full today</span>
                  <span style={{ fontWeight: 600 }}>${chosenDeposit.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

// ─── Local style for secondary back button ─────────────────────────────────
const btnSecondary: React.CSSProperties = {
  padding: '12px 24px', borderRadius: 8,
  border: '1.5px solid rgba(232,184,75,0.3)', background: 'transparent',
  fontSize: 12, color: C.charcoal, cursor: 'pointer',
  fontFamily: "'Inter', sans-serif",
};
