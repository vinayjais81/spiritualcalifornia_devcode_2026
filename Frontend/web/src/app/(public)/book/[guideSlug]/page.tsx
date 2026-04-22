'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth.store';
import { StripeProvider } from '@/components/public/checkout/StripeProvider';
import { StripePaymentForm } from '@/components/public/checkout/StripePaymentForm';
import { useSiteConfigOrFallback } from '@/lib/siteConfig';

const BOOKING_STATE_KEY = 'sc-booking-state';

// ─── Design tokens (matching client design + project palette) ────────────────
const C = {
  gold: '#E8B84B', goldLight: '#F5D98A', goldPale: '#FDF6E3',
  charcoal: '#3A3530', warmGray: '#8A8278', offWhite: '#FAFAF7', white: '#FFFFFF',
  green: '#5A8A6A', red: '#C0392B',
};
const font = "'Inter', sans-serif";
const serif = "'Cormorant Garamond', serif";

// ─── Types ──────────────────────────────────────────────────────────────────
interface GuideInfo {
  slug: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean;
  averageRating: number;
  totalReviews: number;
  calendlyConnected: boolean;
  calendarLink: string | null;
}

interface ServiceInfo {
  id: string;
  name: string;
  description: string | null;
  type: string;
  price: number | string;
  currency: string;
  durationMin: number;
}

interface CalendlyEventData {
  uri: string;
  inviteeUri: string;
  startTime: string;
  endTime: string;
  eventName: string;
}

interface SeekerDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  sessionNotes: string;
  experienceLevel: string;
  healthConditions: string;
  referralSource: string;
}

// ─── Format Helpers ─────────────────────────────────────────────────────────
function formatPrice(p: number | string) {
  const n = typeof p === 'string' ? parseFloat(p) : p;
  return n === 0 ? 'Free' : `$${n.toFixed(0)}`;
}

function formatDuration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h} hour${h > 1 ? 's' : ''}`;
}

function formatDateTime(iso: string) {
  if (!iso) return 'Time pending...';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Time pending...';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' });
}

function formatTypeBadge(type: string) {
  switch (type) {
    case 'VIRTUAL': return { label: 'Online', bg: '#E8F5E9', color: '#2E7D32', border: '#A5D6A7' };
    case 'IN_PERSON': return { label: 'In-Person', bg: '#FFF3E0', color: '#E65100', border: '#FFCC80' };
    default: return { label: 'Online & In-Person', bg: C.goldPale, color: C.charcoal, border: 'rgba(232,184,75,0.4)' };
  }
}

// ─── Service Icon ───────────────────────────────────────────────────────────
function ServiceIcon({ index }: { index: number }) {
  const icons = ['🧘', '☯️', '📖', '🔮', '⭐', '💆', '🌿', '🕉️'];
  return <span style={{ fontSize: '24px' }}>{icons[index % icons.length]}</span>;
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function BookPractitionerPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.guideSlug as string;
  const { isAuthenticated, user } = useAuthStore();
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const siteConfig = useSiteConfigOrFallback();

  // ─── State ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [guide, setGuide] = useState<GuideInfo | null>(null);
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [selectedService, setSelectedService] = useState<ServiceInfo | null>(null);
  const [calendlyEvent, setCalendlyEvent] = useState<CalendlyEventData | null>(null);
  const [details, setDetails] = useState<SeekerDetails>({
    firstName: '', lastName: '', email: '', phone: '',
    sessionNotes: '', experienceLevel: '', healthConditions: '', referralSource: '',
  });
  const [bookingResult, setBookingResult] = useState<any>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [creatingBooking, setCreatingBooking] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [bookingRef, setBookingRef] = useState('');

  // ─── Auto-fill seeker details from logged-in profile ─────────────────────
  useEffect(() => {
    if (isAuthenticated && user) {
      setDetails(prev => ({
        ...prev,
        firstName: prev.firstName || user.firstName || '',
        lastName: prev.lastName || user.lastName || '',
        email: prev.email || user.email || '',
      }));
    }
  }, [isAuthenticated, user]);

  // ─── Save booking state to sessionStorage (survives login redirect) ────
  const saveBookingState = useCallback(() => {
    try {
      sessionStorage.setItem(BOOKING_STATE_KEY, JSON.stringify({
        step, selectedServiceId: selectedService?.id, calendlyEvent, details,
      }));
    } catch {}
  }, [step, selectedService, calendlyEvent, details]);

  // ─── Restore booking state from sessionStorage after login redirect ────
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(BOOKING_STATE_KEY);
      if (!saved) return;
      const state = JSON.parse(saved);
      if (state.calendlyEvent) setCalendlyEvent(state.calendlyEvent);
      if (state.details) setDetails(state.details);
      if (state.step) setStep(state.step);
      // selectedServiceId will be matched after services load
      sessionStorage.removeItem(BOOKING_STATE_KEY);
    } catch {}
  }, []);

  // ─── Load guide + services ──────────────────────────────────────────────
  useEffect(() => {
    if (!slug) return;
    api.get(`/calendly/book/${slug}`)
      .then(r => {
        setGuide(r.data.guide);
        const svcList = r.data.services || [];
        setServices(svcList);

        // Restore selected service from sessionStorage if available
        try {
          const saved = sessionStorage.getItem(BOOKING_STATE_KEY);
          if (saved) {
            const state = JSON.parse(saved);
            const match = svcList.find((s: ServiceInfo) => s.id === state.selectedServiceId);
            if (match) { setSelectedService(match); return; }
          }
        } catch {}

        if (svcList.length > 0) setSelectedService(svcList[0]);
      })
      .catch(() => toast.error('Guide not found'))
      .finally(() => setLoading(false));
  }, [slug]);

  // ─── Listen for Calendly postMessage events ─────────────────────────────
  // Track selected date/time from date_and_time_selected, confirm on event_scheduled
  const pendingTimeRef = React.useRef<{ startTime: string; endTime: string } | null>(null);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const data = e.data;
      if (!data) return;

      // Log all Calendly messages for debugging
      if (typeof data === 'object' && data.event && String(data.event).startsWith('calendly.')) {
        console.log('[Calendly postMessage]', data.event, JSON.stringify(data.payload, null, 2));
      }

      if (typeof data !== 'object') return;

      // calendly.date_and_time_selected — capture selected slot time
      if (data.event === 'calendly.date_and_time_selected') {
        const p = data.payload || {};
        // Try multiple known payload paths
        const startTime = p.start_time || p.startTime || p.date_time || p.spot?.start_time || '';
        if (startTime) {
          const start = new Date(startTime);
          const duration = selectedService?.durationMin || 30;
          const end = new Date(start.getTime() + duration * 60 * 1000);
          pendingTimeRef.current = { startTime: start.toISOString(), endTime: end.toISOString() };
        }
        return;
      }

      // calendly.event_scheduled — booking confirmed
      if (data.event === 'calendly.event_scheduled') {
        const p = data.payload || {};
        const eventUri = p.event?.uri || '';
        const inviteeUri = p.invitee?.uri || '';

        // Try all known payload paths for time
        let startTime = p.event?.start_time || p.event?.startTime || '';
        let endTime = p.event?.end_time || p.event?.endTime || '';

        // Fall back to the time captured from date_and_time_selected
        if (!startTime && pendingTimeRef.current) {
          startTime = pendingTimeRef.current.startTime;
          endTime = pendingTimeRef.current.endTime;
        }

        // Only set calendlyEvent if we have a valid time
        if (startTime) {
          setCalendlyEvent({
            uri: eventUri,
            inviteeUri,
            startTime,
            endTime,
            eventName: p.event_type?.name || '',
          });
          pendingTimeRef.current = null;
          toast.success('Time confirmed!');
        } else {
          // Calendly confirmed but no time data — store URIs for reference,
          // user will confirm time manually
          pendingTimeRef.current = null;
          toast.info('Booking confirmed in Calendly! Please enter the date and time below.');
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [selectedService?.durationMin]);

  // ─── Step Navigation ────────────────────────────────────────────────────
  const goToStep = useCallback((n: number) => {
    setStep(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // ─── Create Booking + PaymentIntent (Step 3 → Step 4) ──────────────────
  const handleCreateBooking = async () => {
    if (!selectedService) {
      toast.error('Please select a service first');
      return;
    }
    if (!calendlyEvent || !calendlyEvent.startTime) {
      toast.error('Please go back and select a time slot first');
      return;
    }
    if (!details.firstName.trim() || !details.lastName.trim() || !details.email.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    // ─── Auth gate: must be logged in as SEEKER to create booking ─────
    if (!hasHydrated) return; // Wait for Zustand to rehydrate
    if (!isAuthenticated || !user) {
      toast.error('Please sign in to complete your booking');
      saveBookingState();
      router.push(`/signin?redirect=/book/${slug}`);
      return;
    }
    if (!user.roles?.includes('SEEKER')) {
      toast.error('Please sign in with a seeker account to book');
      saveBookingState();
      router.push(`/signin?redirect=/book/${slug}`);
      return;
    }

    setCreatingBooking(true);
    try {
      const res = await api.post('/bookings/service-checkout', {
        serviceId: selectedService.id,
        startTime: calendlyEvent.startTime,
        endTime: calendlyEvent.endTime,
        calendlyEventUri: calendlyEvent.uri,
        calendlyInviteeUri: calendlyEvent.inviteeUri,
        firstName: details.firstName.trim(),
        lastName: details.lastName.trim(),
        email: details.email.trim(),
        phone: details.phone.trim() || undefined,
        sessionNotes: details.sessionNotes.trim() || undefined,
        experienceLevel: details.experienceLevel || undefined,
        healthConditions: details.healthConditions.trim() || undefined,
        referralSource: details.referralSource || undefined,
      });

      setBookingResult(res.data);
      setClientSecret(res.data.clientSecret);
      setBookingRef(res.data.bookingId?.slice(-8)?.toUpperCase() || '');
      goToStep(4);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create booking');
    } finally {
      setCreatingBooking(false);
    }
  };

  // ─── Payment Success ───────────────────────────────────────────────────
  const handlePaymentSuccess = (paymentIntentId: string) => {
    // Confirm payment in our backend (updates status to SUCCEEDED + booking to CONFIRMED)
    api.post('/payments/confirm-payment', { paymentIntentId }).catch(() => {});
    setShowSuccess(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ─── Loading / Error States ─────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: font, fontSize: '14px', color: C.warmGray }}>
        Loading booking page...
      </div>
    );
  }

  if (!guide || services.length === 0) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: font, fontSize: '14px', color: C.warmGray, flexDirection: 'column', gap: '12px' }}>
        <span style={{ fontSize: '40px' }}>🔍</span>
        <span>This practitioner is not available for booking right now.</span>
      </div>
    );
  }

  // ─── Success Screen ─────────────────────────────────────────────────────
  if (showSuccess) {
    return (
      <div style={{ minHeight: '100vh', background: C.offWhite }}>
        <nav style={{ padding: '14px 48px', background: 'rgba(250,250,247,0.97)', borderBottom: '1px solid rgba(232,184,75,0.15)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontFamily: serif, fontSize: '18px', fontWeight: 500, color: C.charcoal }}>Spiritual California</span>
        </nav>

        <div style={{ textAlign: 'center', padding: '60px 32px', maxWidth: '560px', margin: '0 auto' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(232,184,75,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '32px', color: C.gold }}>
            ✓
          </div>
          <div style={{ fontFamily: serif, fontSize: '36px', fontWeight: 400, color: C.charcoal, marginBottom: '10px' }}>
            Your Session is Confirmed
          </div>
          <p style={{ fontFamily: font, fontSize: '14px', color: C.warmGray, maxWidth: '420px', margin: '0 auto 28px', lineHeight: 1.7 }}>
            A confirmation email has been sent to your inbox with the Zoom link and everything you need to prepare for your session with {guide.displayName}.
          </p>

          <div style={{ background: C.white, border: '1px solid rgba(232,184,75,0.2)', borderRadius: '8px', padding: '24px', maxWidth: '440px', margin: '0 auto 24px', textAlign: 'left' }}>
            {[
              { label: 'Service', value: selectedService?.name },
              { label: 'Practitioner', value: guide.displayName },
              { label: 'Date & Time', value: calendlyEvent ? formatDateTime(calendlyEvent.startTime) : '—' },
              { label: 'Format', value: selectedService?.type === 'IN_PERSON' ? 'In-Person' : 'Online via Zoom' },
              { label: 'Amount Paid', value: formatPrice(selectedService?.price || 0), highlight: true },
              { label: 'Booking Reference', value: `SC-${bookingRef}`, mono: true },
            ].map((row, i, arr) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', fontFamily: font, fontSize: '12px',
                padding: '7px 0', borderBottom: i < arr.length - 1 ? '1px solid rgba(232,184,75,0.08)' : 'none',
              }}>
                <span style={{ color: C.warmGray }}>{row.label}</span>
                <span style={{
                  color: row.highlight ? C.gold : C.charcoal,
                  fontWeight: row.highlight ? 500 : 400,
                  fontFamily: row.mono ? 'monospace' : font,
                  fontSize: row.mono ? '11px' : '12px',
                }}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <a href={`/guides/${guide.slug}`} style={{
              padding: '12px 24px', border: '1px solid rgba(232,184,75,0.3)', borderRadius: '4px',
              fontFamily: font, fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase' as const,
              color: C.charcoal, textDecoration: 'none',
            }}>
              View {guide.displayName.split(' ')[0]}&apos;s Profile
            </a>
            <a href="/" style={{
              padding: '12px 24px', background: C.charcoal, borderRadius: '4px', border: 'none',
              fontFamily: font, fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase' as const,
              color: C.gold, textDecoration: 'none',
            }}>
              Back to Home
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main Booking Flow ──────────────────────────────────────────────────
  const price = selectedService ? Number(typeof selectedService.price === 'string' ? parseFloat(selectedService.price as string) : selectedService.price) : 0;

  return (
    <div style={{ minHeight: '100vh', background: C.offWhite }}>

      {/* ── Top Nav ──────────────────────────────────────────────── */}
      <nav style={{
        padding: '14px 48px', background: 'rgba(250,250,247,0.97)',
        borderBottom: '1px solid rgba(232,184,75,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <a href="/" style={{ fontFamily: serif, fontSize: '18px', fontWeight: 500, color: C.charcoal, textDecoration: 'none' }}>
          Spiritual California
        </a>
        <a href={`/guides/${guide.slug}`} style={{ fontFamily: font, fontSize: '12px', color: C.warmGray, textDecoration: 'none' }}>
          ← Back to {guide.displayName.split(' ')[0]}&apos;s Profile
        </a>
      </nav>

      {/* ── Step Indicator ───────────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: '0',
        padding: '20px 32px', background: C.white, borderBottom: '1px solid rgba(232,184,75,0.1)',
      }}>
        {['Choose Service', 'Select Time', 'Your Details', 'Payment'].map((label, i) => {
          const stepNum = i + 1;
          const isActive = step === stepNum;
          const isDone = step > stepNum;
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 20px',
              cursor: isDone ? 'pointer' : 'default',
            }} onClick={() => isDone && goToStep(stepNum)}>
              <div style={{
                width: '24px', height: '24px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: 600, fontFamily: font,
                background: isActive ? C.gold : isDone ? C.green : 'transparent',
                color: isActive || isDone ? C.white : C.warmGray,
                border: isActive || isDone ? 'none' : '1.5px solid rgba(138,130,120,0.3)',
              }}>
                {isDone ? '✓' : stepNum}
              </div>
              <span style={{
                fontFamily: font, fontSize: '12px', fontWeight: isActive ? 500 : 400,
                color: isActive ? C.charcoal : isDone ? C.green : C.warmGray,
              }}>
                {label}
              </span>
              {i < 3 && <div style={{ width: '32px', height: '1px', background: isDone ? C.green : 'rgba(232,184,75,0.2)', marginLeft: '12px' }} />}
            </div>
          );
        })}
      </div>

      {/* ── Main Content Grid ────────────────────────────────────── */}
      <div style={{
        maxWidth: '1060px', margin: '32px auto', padding: '0 32px',
        display: 'grid', gridTemplateColumns: '1fr 320px', gap: '48px', alignItems: 'start',
      }}>

        {/* ── LEFT: Step Content ─────────────────────────────────── */}
        <div>

          {/* ═══ STEP 1: Choose Service ═══ */}
          {step === 1 && (
            <div>
              <h2 style={{ fontFamily: serif, fontSize: '28px', fontWeight: 400, color: C.charcoal, marginBottom: '6px' }}>
                Choose a Service
              </h2>
              <p style={{ fontFamily: font, fontSize: '13px', color: C.warmGray, marginBottom: '24px', lineHeight: 1.6 }}>
                {guide.displayName} offers the following services. Select the one that best fits your needs.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {services.map((svc, i) => {
                  const selected = selectedService?.id === svc.id;
                  const badge = formatTypeBadge(svc.type);
                  return (
                    <label
                      key={svc.id}
                      onClick={() => setSelectedService(svc)}
                      style={{
                        display: 'grid', gridTemplateColumns: '40px 1fr auto',
                        gap: '16px', alignItems: 'center', padding: '18px 20px',
                        borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s',
                        border: selected ? `2px solid ${C.gold}` : '1px solid rgba(232,184,75,0.15)',
                        background: selected ? C.goldPale : C.white,
                      }}
                    >
                      <ServiceIcon index={i} />
                      <div>
                        <div style={{ fontFamily: font, fontSize: '14px', fontWeight: 500, color: C.charcoal }}>{svc.name}</div>
                        {svc.description && (
                          <div style={{ fontFamily: font, fontSize: '12px', color: C.warmGray, marginTop: '3px', lineHeight: 1.4 }}>{svc.description}</div>
                        )}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontFamily: font, background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                            {badge.label}
                          </span>
                          <span style={{ fontFamily: font, fontSize: '11px', color: C.warmGray }}>{formatDuration(svc.durationMin)}</span>
                        </div>
                      </div>
                      <div style={{ fontFamily: serif, fontSize: '20px', fontWeight: 500, color: C.charcoal }}>{formatPrice(svc.price)}</div>
                    </label>
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '28px' }}>
                <button onClick={() => goToStep(2)} style={btnPrimary}>Continue to Choose Time →</button>
              </div>
            </div>
          )}

          {/* ═══ STEP 2: Select Time (Calendly) ═══ */}
          {step === 2 && (
            <div>
              <h2 style={{ fontFamily: serif, fontSize: '28px', fontWeight: 400, color: C.charcoal, marginBottom: '6px' }}>Choose a Time</h2>
              <p style={{ fontFamily: font, fontSize: '13px', color: C.warmGray, marginBottom: '24px', lineHeight: 1.6 }}>
                {guide.displayName}&apos;s calendar is managed through Calendly. Select a time that works for you — your spot is held for 15 minutes while you complete the booking.
              </p>

              {/* Step A: Book in Calendly */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: C.gold, color: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: font, fontSize: '13px', fontWeight: 600 }}>1</div>
                  <span style={{ fontFamily: font, fontSize: '14px', fontWeight: 500, color: C.charcoal }}>Book a slot in Calendly</span>
                </div>
                <div style={{ border: '1px solid rgba(232,184,75,0.2)', borderRadius: '8px', overflow: 'hidden', background: C.white }}>
                  <div style={{ padding: '12px 18px', background: C.offWhite, borderBottom: '1px solid rgba(232,184,75,0.1)', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: font, fontSize: '13px', color: C.charcoal }}>
                    📅 {guide.displayName} — Calendly Booking
                  </div>
                  {guide.calendarLink ? (
                    <CalendlyEmbed url={guide.calendarLink} prefill={isAuthenticated && user ? { name: `${user.firstName} ${user.lastName}`, email: user.email } : undefined} />
                  ) : (
                    <div style={{ height: '500px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', fontFamily: font, fontSize: '13px', color: C.warmGray }}>
                      <span style={{ fontSize: '48px' }}>📆</span>
                      <span>Calendar not available. Please contact the practitioner directly.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Step B: Confirm selected date/time */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: calendlyEvent ? C.green : C.gold, color: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: font, fontSize: '13px', fontWeight: 600 }}>
                    {calendlyEvent ? '✓' : '2'}
                  </div>
                  <span style={{ fontFamily: font, fontSize: '14px', fontWeight: 500, color: C.charcoal }}>Confirm your selected date & time</span>
                </div>

                {calendlyEvent ? (
                  <div style={{ padding: '16px 20px', background: '#E8F5E9', border: '1px solid #A5D6A7', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: font, fontSize: '13px', color: '#2E7D32' }}>
                      ✅ <strong>{formatDateTime(calendlyEvent.startTime)}</strong>
                    </div>
                    <button onClick={() => setCalendlyEvent(null)} style={{ fontFamily: font, fontSize: '11px', color: C.warmGray, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                      Change
                    </button>
                  </div>
                ) : (
                  <div style={{ padding: '20px', background: C.white, border: '1px solid rgba(232,184,75,0.2)', borderRadius: '8px' }}>
                    <p style={{ fontFamily: font, fontSize: '12px', color: C.warmGray, marginBottom: '14px', lineHeight: 1.5 }}>
                      After scheduling in Calendly above, enter the date and time you booked:
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <label style={{ fontFamily: font, fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: C.warmGray, fontWeight: 500 }}>Date *</label>
                        <input type="date" id="manual-date" min={new Date().toISOString().split('T')[0]} style={{ fontFamily: font, fontSize: '13px', color: C.charcoal, background: C.offWhite, border: '1px solid rgba(232,184,75,0.25)', borderRadius: '6px', padding: '11px 14px', outline: 'none', width: '100%' }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <label style={{ fontFamily: font, fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: C.warmGray, fontWeight: 500 }}>Time *</label>
                        <input type="time" id="manual-time" style={{ fontFamily: font, fontSize: '13px', color: C.charcoal, background: C.offWhite, border: '1px solid rgba(232,184,75,0.25)', borderRadius: '6px', padding: '11px 14px', outline: 'none', width: '100%' }} />
                      </div>
                    </div>
                    <button onClick={() => {
                      const dateInput = document.getElementById('manual-date') as HTMLInputElement;
                      const timeInput = document.getElementById('manual-time') as HTMLInputElement;
                      if (!dateInput?.value || !timeInput?.value) { toast.error('Please enter the date and time you booked'); return; }
                      const start = new Date(`${dateInput.value}T${timeInput.value}:00`);
                      if (isNaN(start.getTime()) || start <= new Date()) { toast.error('Please enter a valid future date and time'); return; }
                      const duration = selectedService?.durationMin || 60;
                      const end = new Date(start.getTime() + duration * 60 * 1000);
                      setCalendlyEvent({ uri: '', inviteeUri: '', startTime: start.toISOString(), endTime: end.toISOString(), eventName: selectedService?.name || '' });
                      toast.success('Time confirmed!');
                    }} style={{ marginTop: '14px', padding: '10px 24px', borderRadius: '6px', border: 'none', background: C.gold, color: C.white, fontFamily: font, fontSize: '12px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' as const, cursor: 'pointer' }}>
                      Confirm Time
                    </button>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button onClick={() => goToStep(1)} style={btnSecondary}>← Back</button>
                <button onClick={() => {
                  if (calendlyEvent && calendlyEvent.startTime) { goToStep(3); }
                  else { toast.error('Please confirm your selected date and time above'); }
                }} style={{ ...btnPrimary, opacity: calendlyEvent ? 1 : 0.5 }}>
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* ═══ STEP 3: Your Details ═══ */}
          {step === 3 && (
            <div>
              <h2 style={{ fontFamily: serif, fontSize: '28px', fontWeight: 400, color: C.charcoal, marginBottom: '6px' }}>Your Details</h2>
              <p style={{ fontFamily: font, fontSize: '13px', color: C.warmGray, marginBottom: '24px', lineHeight: 1.6 }}>
                Please share your contact information and a bit about what brings you to this session.
              </p>

              <div style={{ marginBottom: '28px' }}>
                <h3 style={{ fontFamily: font, fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: C.warmGray, marginBottom: '14px', fontWeight: 500 }}>Contact Information</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <FormField label="First Name *" value={details.firstName} onChange={v => setDetails(d => ({ ...d, firstName: v }))} placeholder="Your first name" />
                  <FormField label="Last Name *" value={details.lastName} onChange={v => setDetails(d => ({ ...d, lastName: v }))} placeholder="Your last name" />
                  <FormField label="Email *" value={details.email} onChange={v => setDetails(d => ({ ...d, email: v }))} type="email" placeholder="you@example.com" />
                  <FormField label="Phone (optional)" value={details.phone} onChange={v => setDetails(d => ({ ...d, phone: v }))} type="tel" placeholder="+1 (415) 000-0000" />
                </div>
              </div>

              <div>
                <h3 style={{ fontFamily: font, fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: C.warmGray, marginBottom: '14px', fontWeight: 500 }}>About Your Session</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <FormField label="What brings you to this session?" value={details.sessionNotes} onChange={v => setDetails(d => ({ ...d, sessionNotes: v }))} multiline placeholder="e.g. I've been dealing with chronic stress and sleep issues..." />
                  <FormField
                    label={`Have you practiced ${selectedService?.name?.includes('Tai Chi') ? 'Tai Chi' : 'energy work'} before?`}
                    value={details.experienceLevel} onChange={v => setDetails(d => ({ ...d, experienceLevel: v }))} select
                    options={[
                      { value: '', label: 'Select...' },
                      { value: 'No, this is my first time', label: 'No, this is my first time' },
                      { value: "I've tried it a few times", label: "I've tried it a few times" },
                      { value: 'I have a regular practice', label: 'I have a regular practice' },
                      { value: "I'm an experienced practitioner", label: "I'm an experienced practitioner" },
                    ]}
                  />
                  <FormField label={`Any health conditions ${guide.displayName.split(' ')[0]} should be aware of?`} value={details.healthConditions} onChange={v => setDetails(d => ({ ...d, healthConditions: v }))} multiline placeholder="e.g. heart condition, recent surgery, pregnancy..." />
                  <FormField
                    label="How did you find Spiritual California?"
                    value={details.referralSource} onChange={v => setDetails(d => ({ ...d, referralSource: v }))} select
                    options={[
                      { value: '', label: 'Select...' },
                      { value: 'Search engine', label: 'Search engine' },
                      { value: 'Social media', label: 'Social media' },
                      { value: 'Friend or colleague', label: 'Friend or colleague' },
                      { value: 'YouTube', label: 'YouTube' },
                      { value: 'Other', label: 'Other' },
                    ]}
                  />
                </div>
              </div>

              <p style={{ fontFamily: font, fontSize: '11px', color: C.warmGray, marginTop: '16px' }}>
                Your information is shared only with {guide.displayName} to personalize your session.
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '28px' }}>
                <button onClick={() => goToStep(2)} style={btnSecondary}>← Back</button>
                <button onClick={handleCreateBooking} disabled={creatingBooking} style={{ ...btnPrimary, opacity: creatingBooking ? 0.6 : 1 }}>
                  {creatingBooking ? 'Processing...' : 'Continue to Payment →'}
                </button>
              </div>
            </div>
          )}

          {/* ═══ STEP 4: Payment ═══ */}
          {step === 4 && clientSecret && (
            <div>
              <h2 style={{ fontFamily: serif, fontSize: '28px', fontWeight: 400, color: C.charcoal, marginBottom: '6px' }}>Complete Your Booking</h2>
              <p style={{ fontFamily: font, fontSize: '13px', color: C.warmGray, marginBottom: '24px', lineHeight: 1.6 }}>
                Review your booking details and enter your payment information.
              </p>

              <div style={{ background: C.white, border: '1px solid rgba(232,184,75,0.2)', borderRadius: '8px', padding: '24px', marginBottom: '28px' }}>
                {[
                  { label: 'Service', value: selectedService?.name },
                  { label: 'Practitioner', value: guide.displayName },
                  { label: 'Date & Time', value: calendlyEvent ? formatDateTime(calendlyEvent.startTime) : '—' },
                  { label: 'Duration', value: selectedService ? formatDuration(selectedService.durationMin) : '—' },
                  { label: 'Format', value: selectedService?.type === 'IN_PERSON' ? 'In-Person' : 'Online via Zoom' },
                  { label: 'Total', value: formatPrice(price), highlight: true },
                ].map((row, i, arr) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', fontFamily: font, fontSize: '13px',
                    padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid rgba(232,184,75,0.08)' : 'none',
                  }}>
                    <span style={{ color: C.warmGray }}>{row.label}</span>
                    <span style={{ color: row.highlight ? C.gold : C.charcoal, fontWeight: row.highlight ? 600 : 400, fontSize: row.highlight ? '15px' : '13px' }}>{row.value}</span>
                  </div>
                ))}
              </div>

              <div>
                <h3 style={{ fontFamily: font, fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: C.warmGray, marginBottom: '14px', fontWeight: 500 }}>Payment</h3>
                <StripeProvider clientSecret={clientSecret}>
                  <StripePaymentForm
                    submitLabel={`Confirm & Pay ${formatPrice(price)}`}
                    onSuccess={handlePaymentSuccess}
                    returnUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/book/${slug}`}
                    cancellationNote={siteConfig.cancellationPolicies.service.text}
                  />
                </StripeProvider>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '20px' }}>
                <button onClick={() => goToStep(3)} style={btnSecondary}>← Back</button>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Practitioner Sidebar ─────────────────────────── */}
        <aside style={{ position: 'sticky', top: '24px', background: C.white, border: '1px solid rgba(232,184,75,0.15)', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(232,184,75,0.1)', display: 'flex', gap: '14px', alignItems: 'center' }}>
            {guide.avatarUrl ? (
              <img src={guide.avatarUrl} alt={guide.displayName} style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(232,184,75,0.3)' }} />
            ) : (
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: C.goldPale, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: C.gold, border: '2px solid rgba(232,184,75,0.3)' }}>
                {guide.displayName[0]}
              </div>
            )}
            <div>
              <div style={{ fontFamily: serif, fontSize: '18px', fontWeight: 500, color: C.charcoal }}>{guide.displayName}</div>
              {guide.isVerified && (
                <div style={{ fontFamily: font, fontSize: '10px', color: C.gold, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>✓ Verified Practitioner</div>
              )}
            </div>
          </div>

          <div style={{ padding: '20px 24px' }}>
            {guide.totalReviews > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontFamily: font, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: C.warmGray, marginBottom: '6px' }}>Rating</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: C.gold, fontSize: '14px', letterSpacing: '1px' }}>{'★'.repeat(Math.round(guide.averageRating))}</span>
                  <span style={{ fontFamily: font, fontSize: '13px', fontWeight: 500, color: C.charcoal }}>{guide.averageRating.toFixed(1)}</span>
                  <span style={{ fontFamily: font, fontSize: '11px', color: C.warmGray }}>({guide.totalReviews} reviews)</span>
                </div>
              </div>
            )}

            {selectedService && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontFamily: font, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: C.warmGray, marginBottom: '8px' }}>Selected Service</div>
                <div style={{ background: C.goldPale, borderRadius: '6px', padding: '14px', fontFamily: font, fontSize: '12px', color: C.charcoal }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>{selectedService.name}</div>
                  <div style={{ color: C.warmGray }}>{formatDuration(selectedService.durationMin)} · {formatTypeBadge(selectedService.type).label}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(232,184,75,0.2)' }}>
                    <span>Total</span>
                    <span style={{ color: C.gold, fontWeight: 500 }}>{formatPrice(selectedService.price)}</span>
                  </div>
                </div>
              </div>
            )}

            {calendlyEvent && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontFamily: font, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: C.warmGray, marginBottom: '6px' }}>Selected Time</div>
                <div style={{ fontFamily: font, fontSize: '12px', color: C.charcoal, lineHeight: 1.5 }}>{formatDateTime(calendlyEvent.startTime)}</div>
              </div>
            )}

            <div style={{ fontFamily: font, fontSize: '11px', color: C.warmGray, lineHeight: 1.7, marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(232,184,75,0.1)' }}>
              Booking is not confirmed until payment is complete. You will receive a Zoom link or location details by email within 1 hour of booking.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═════════════════════════════════════════════════════════════════════════════

function CalendlyEmbed({ url, prefill }: { url: string; prefill?: { name: string; email: string } }) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    // Load Calendly widget CSS
    const link = document.createElement('link');
    link.href = 'https://assets.calendly.com/assets/external/widget.css';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    // Load Calendly widget SDK
    const script = document.createElement('script');
    script.src = 'https://assets.calendly.com/assets/external/widget.js';
    script.async = true;
    script.onload = () => {
      if (containerRef.current && (window as any).Calendly) {
        containerRef.current.innerHTML = '';
        (window as any).Calendly.initInlineWidget({
          url: prefill
            ? `${url}?hide_gdpr_banner=1&name=${encodeURIComponent(prefill.name)}&email=${encodeURIComponent(prefill.email)}`
            : `${url}?hide_gdpr_banner=1`,
          parentElement: containerRef.current,
        });
      }
    };
    document.head.appendChild(script);

    return () => {
      try { document.head.removeChild(script); } catch {}
      try { document.head.removeChild(link); } catch {}
    };
  }, [url, prefill]);

  return (
    <div
      ref={containerRef}
      style={{ minWidth: '320px', height: '660px' }}
    />
  );
}

function FormField({ label, value, onChange, placeholder, type, multiline, select, options }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; multiline?: boolean; select?: boolean; options?: { value: string; label: string }[];
}) {
  const baseStyle: React.CSSProperties = {
    fontFamily: font, fontSize: '13px', color: C.charcoal,
    background: C.white, border: '1px solid rgba(232,184,75,0.25)',
    borderRadius: '4px', padding: '11px 14px', outline: 'none', width: '100%',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={{ fontFamily: font, fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: C.warmGray, fontWeight: 500 }}>{label}</label>
      {select ? (
        <select value={value} onChange={e => onChange(e.target.value)} style={baseStyle}>
          {options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : multiline ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ ...baseStyle, resize: 'vertical', minHeight: '80px' }} />
      ) : (
        <input type={type || 'text'} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={baseStyle} />
      )}
    </div>
  );
}

// ─── Button Styles ──────────────────────────────────────────────────────────
const btnPrimary: React.CSSProperties = {
  fontFamily: font, fontSize: '12px', fontWeight: 500,
  letterSpacing: '0.08em', textTransform: 'uppercase',
  padding: '12px 28px', borderRadius: '4px', border: 'none',
  background: C.charcoal, color: C.gold, cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
  fontFamily: font, fontSize: '12px', fontWeight: 500,
  letterSpacing: '0.08em', textTransform: 'uppercase',
  padding: '12px 28px', borderRadius: '4px',
  background: 'transparent', color: C.charcoal,
  border: '1px solid rgba(232,184,75,0.3)', cursor: 'pointer',
};
