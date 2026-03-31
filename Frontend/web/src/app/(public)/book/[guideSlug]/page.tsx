'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { StepNav } from '@/components/public/booking/StepNav';
import { PaymentForm } from '@/components/public/booking/PaymentForm';
import { BookingSuccess } from '@/components/public/booking/BookingSuccess';

interface Service {
  id: string;
  name: string;
  description: string | null;
  type: 'IN_PERSON' | 'VIRTUAL' | 'HYBRID';
  price: number;
  durationMin: number;
}

interface Guide {
  id: string;
  slug: string;
  displayName: string;
  tagline: string | null;
  averageRating: number;
  totalReviews: number;
  calendarLink: string | null;
  user: { avatarUrl: string | null };
}

const steps = ['Choose Service', 'Select Time', 'Your Details', 'Payment'];

const fallbackServices: Service[] = [
  { id: 's1', name: '60-Minute Session', description: 'Full one-on-one session — in person or online.', type: 'HYBRID', price: 85, durationMin: 60 },
  { id: 's2', name: '90-Minute Deep Dive', description: 'Extended session for complex issues or first-time clients.', type: 'HYBRID', price: 120, durationMin: 90 },
  { id: 's3', name: 'Discovery Call (Free)', description: 'A 15-minute intro call to see if we\'re a good fit.', type: 'VIRTUAL', price: 0, durationMin: 15 },
  { id: 's4', name: '4-Session Package', description: 'Four 60-minute sessions at a discounted rate.', type: 'HYBRID', price: 300, durationMin: 60 },
];

const typeBadge = (type: string) => {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    VIRTUAL: { label: 'Online', bg: 'rgba(90,138,106,0.12)', color: '#5A8A6A' },
    IN_PERSON: { label: 'In-Person', bg: 'rgba(240,120,32,0.1)', color: '#F07820' },
    HYBRID: { label: 'Online & In-Person', bg: 'rgba(232,184,75,0.1)', color: '#B8960F' },
  };
  const b = map[type] || map.HYBRID;
  return <span style={{ padding: '3px 10px', borderRadius: 12, background: b.bg, color: b.color, fontSize: 10, fontWeight: 600 }}>{b.label}</span>;
};

export default function BookPractitionerPage() {
  const params = useParams();
  const guideSlug = params.guideSlug as string;
  const [step, setStep] = useState(0);
  const [guide, setGuide] = useState<Guide | null>(null);
  const [services, setServices] = useState<Service[]>(fallbackServices);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [booked, setBooked] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', sessionType: 'online', notes: '' });

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get(`/guides/profile/${guideSlug}`);
        setGuide(res.data);
        if (res.data.services?.length) setServices(res.data.services);
      } catch {
        setGuide({
          id: 'g1', slug: guideSlug, displayName: 'Maya Rosenberg',
          tagline: 'Sound Healer & Reiki Master', averageRating: 4.9, totalReviews: 127,
          calendarLink: null, user: { avatarUrl: null },
        });
      } finally { setLoading(false); }
    };
    fetch();
  }, [guideSlug]);

  const selected = services.find(s => s.id === selectedService);

  if (booked) {
    return (
      <BookingSuccess
        title="Your Session is Confirmed"
        subtitle="A confirmation email has been sent. You can manage your booking from your dashboard."
        details={[
          { label: 'Practitioner', value: guide?.displayName || '' },
          { label: 'Service', value: selected?.name || '' },
          { label: 'Duration', value: `${selected?.durationMin} min` },
          { label: 'Amount', value: `$${selected?.price || 0}` },
        ]}
        primaryAction={{ label: 'View My Bookings', href: '/guide/dashboard' }}
        secondaryAction={{ label: 'Back to Profile', href: `/guides/${guideSlug}` }}
      />
    );
  }

  return (
    <>
      {/* Checkout nav */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '16px 48px', background: '#fff', borderBottom: '1px solid rgba(232,184,75,0.15)' }}>
        <Link href={`/guides/${guideSlug}`} style={{ fontSize: 12, color: '#8A8278', textDecoration: 'none' }}>
          ← Back to profile
        </Link>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontWeight: 500, color: '#3A3530' }}>
            Book a Session
          </span>
        </div>
        <div style={{ width: 80 }} />
      </div>

      <StepNav steps={steps} current={step} onChange={setStep} />

      <div style={{ maxWidth: 1060, margin: '0 auto', padding: '40px 32px 80px', display: 'grid', gridTemplateColumns: '1fr 320px', gap: 48 }}>
        {/* Left Content */}
        <div>
          {/* Step 1: Choose Service */}
          {step === 0 && (
            <div>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 400, color: '#3A3530', marginBottom: 6 }}>
                Choose a Service
              </h2>
              <p style={{ fontSize: 13, color: '#8A8278', marginBottom: 24 }}>Select the type of session you&apos;d like to book.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {services.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedService(s.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px',
                      background: selectedService === s.id ? '#FDF6E3' : '#fff',
                      border: selectedService === s.id ? '1.5px solid #E8B84B' : '1.5px solid rgba(232,184,75,0.15)',
                      borderRadius: 8, cursor: 'pointer', textAlign: 'left', width: '100%',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%',
                      background: selectedService === s.id ? '#E8B84B' : '#FDF6E3',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, flexShrink: 0,
                      color: selectedService === s.id ? '#3A3530' : '#E8B84B',
                    }}>
                      {s.durationMin <= 15 ? '📞' : s.durationMin <= 60 ? '🧘' : s.durationMin <= 90 ? '✨' : '📦'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 500, color: '#3A3530', marginBottom: 2 }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: '#8A8278', marginBottom: 4 }}>{s.description}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: '#8A8278' }}>{s.durationMin} min</span>
                        {typeBadge(s.type)}
                      </div>
                    </div>
                    <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: '#3A3530', flexShrink: 0 }}>
                      {s.price === 0 ? 'Free' : `$${s.price}`}
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => selectedService && setStep(1)}
                disabled={!selectedService}
                style={{
                  marginTop: 24, padding: '14px 32px', borderRadius: 8,
                  background: selectedService ? '#E8B84B' : 'rgba(232,184,75,0.3)',
                  color: '#3A3530', border: 'none', cursor: selectedService ? 'pointer' : 'not-allowed',
                  fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                }}
              >
                Continue to Choose Time
              </button>
            </div>
          )}

          {/* Step 2: Select Time (Calendly) */}
          {step === 1 && (
            <div>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 400, color: '#3A3530', marginBottom: 6 }}>
                Select a Time
              </h2>
              <p style={{ fontSize: 13, color: '#8A8278', marginBottom: 24 }}>Choose a date and time that works for you.</p>
              <div style={{
                border: '1px solid rgba(232,184,75,0.15)', borderRadius: 8, overflow: 'hidden',
              }}>
                <div style={{ padding: '14px 18px', background: '#FAFAF7', borderBottom: '1px solid rgba(232,184,75,0.1)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>📅</span>
                  <span style={{ fontSize: 12, color: '#8A8278' }}>Timezone: Pacific Time (PT)</span>
                </div>
                {guide?.calendarLink ? (
                  <iframe src={guide.calendarLink} style={{ width: '100%', height: 500, border: 'none' }} />
                ) : (
                  <div style={{ height: 500, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#8A8278' }}>
                    <span style={{ fontSize: 48, marginBottom: 16 }}>📅</span>
                    <p style={{ fontSize: 14, marginBottom: 4 }}>Calendar scheduling will be available here</p>
                    <p style={{ fontSize: 12 }}>Calendly integration loading...</p>
                  </div>
                )}
              </div>
              <div style={{
                background: '#FDF6E3', border: '1px solid rgba(232,184,75,0.2)',
                borderRadius: 8, padding: '12px 16px', marginTop: 16, fontSize: 12, color: '#3A3530',
              }}>
                Free cancellation up to 24 hours before your session.
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button onClick={() => setStep(0)} style={{ padding: '12px 24px', borderRadius: 8, border: '1.5px solid rgba(232,184,75,0.3)', background: 'transparent', fontSize: 12, fontWeight: 500, color: '#3A3530', cursor: 'pointer' }}>
                  ← Back
                </button>
                <button onClick={() => setStep(2)} style={{ padding: '12px 24px', borderRadius: 8, background: '#E8B84B', color: '#3A3530', border: 'none', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Your Details */}
          {step === 2 && (
            <div>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 400, color: '#3A3530', marginBottom: 6 }}>
                Your Details
              </h2>
              <p style={{ fontSize: 13, color: '#8A8278', marginBottom: 24 }}>We&apos;ll share these with your practitioner.</p>
              <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A8278', marginBottom: 12 }}>Contact Information</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                {[
                  { label: 'First Name', key: 'firstName', placeholder: 'Jane' },
                  { label: 'Last Name', key: 'lastName', placeholder: 'Doe' },
                  { label: 'Email', key: 'email', placeholder: 'jane@example.com', type: 'email' },
                  { label: 'Phone', key: 'phone', placeholder: '(555) 123-4567', type: 'tel' },
                ].map(f => (
                  <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A8278' }}>{f.label}</label>
                    <input
                      value={(form as any)[f.key]}
                      onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                      placeholder={f.placeholder}
                      type={f.type || 'text'}
                      style={{ padding: '12px 14px', borderRadius: 6, border: '1.5px solid rgba(232,184,75,0.2)', background: '#FAFAF7', fontSize: 13, outline: 'none', fontFamily: "'Inter', sans-serif" }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A8278', marginBottom: 12 }}>About Your Session</div>
              <textarea
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Is there anything you'd like your practitioner to know beforehand?"
                rows={4}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 6, border: '1.5px solid rgba(232,184,75,0.2)', background: '#FAFAF7', fontSize: 13, outline: 'none', fontFamily: "'Inter', sans-serif", resize: 'vertical', marginBottom: 24 }}
              />
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setStep(1)} style={{ padding: '12px 24px', borderRadius: 8, border: '1.5px solid rgba(232,184,75,0.3)', background: 'transparent', fontSize: 12, fontWeight: 500, color: '#3A3530', cursor: 'pointer' }}>
                  ← Back
                </button>
                <button onClick={() => setStep(3)} style={{ padding: '12px 24px', borderRadius: 8, background: '#E8B84B', color: '#3A3530', border: 'none', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Continue to Payment
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Payment */}
          {step === 3 && (
            <div>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 400, color: '#3A3530', marginBottom: 6 }}>
                Confirm &amp; Pay
              </h2>
              <p style={{ fontSize: 13, color: '#8A8278', marginBottom: 24 }}>Review your booking details and complete payment.</p>
              {/* Confirmation summary */}
              <div style={{ background: '#fff', border: '1px solid rgba(232,184,75,0.15)', borderRadius: 8, padding: 24, marginBottom: 32 }}>
                {[
                  { label: 'Service', value: selected?.name || '' },
                  { label: 'Duration', value: `${selected?.durationMin} minutes` },
                  { label: 'Format', value: selected?.type === 'VIRTUAL' ? 'Online' : selected?.type === 'IN_PERSON' ? 'In-Person' : 'Online or In-Person' },
                  { label: 'Client', value: `${form.firstName} ${form.lastName}` },
                  { label: 'Email', value: form.email },
                ].map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < 4 ? '1px solid rgba(232,184,75,0.1)' : 'none' }}>
                    <span style={{ fontSize: 12, color: '#8A8278' }}>{r.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#3A3530' }}>{r.value}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0', marginTop: 8, borderTop: '1px solid rgba(232,184,75,0.15)' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#3A3530' }}>Total</span>
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 500, color: '#E8B84B' }}>
                    {selected?.price === 0 ? 'Free' : `$${selected?.price}`}
                  </span>
                </div>
              </div>
              <PaymentForm
                submitLabel={selected?.price === 0 ? 'Confirm Booking' : `Pay $${selected?.price}`}
                onSubmit={() => setBooked(true)}
                cancellationNote="Free cancellation up to 24 hours before your session. After that, a 50% fee applies."
              />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div>
          <div style={{
            background: '#fff', border: '1px solid rgba(232,184,75,0.15)',
            borderRadius: 8, position: 'sticky', top: 24, overflow: 'hidden',
          }}>
            {/* Guide info */}
            <div style={{ padding: 24, borderBottom: '1px solid rgba(232,184,75,0.1)', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%', border: '2px solid #E8B84B',
                background: '#FDF6E3', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, fontWeight: 600, color: '#E8B84B', overflow: 'hidden', flexShrink: 0,
              }}>
                {guide?.user.avatarUrl ? (
                  <img src={guide.user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  (guide?.displayName || 'G').split(' ').map(w => w[0]).join('').slice(0, 2)
                )}
              </div>
              <div>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 500, color: '#3A3530' }}>
                  {guide?.displayName}
                </div>
                {guide?.tagline && <div style={{ fontSize: 12, color: '#8A8278' }}>{guide.tagline}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ color: '#E8B84B', fontSize: 12 }}>★★★★★</span>
                  <span style={{ fontSize: 11, color: '#8A8278' }}>{guide?.averageRating} ({guide?.totalReviews} reviews)</span>
                </div>
              </div>
            </div>

            {/* Selected service summary */}
            {selected && (
              <div style={{ padding: '16px 24px' }}>
                <div style={{
                  background: '#FDF6E3', borderRadius: 6, padding: 14,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#3A3530', marginBottom: 4 }}>{selected.name}</div>
                  <div style={{ fontSize: 11, color: '#8A8278', marginBottom: 4 }}>{selected.durationMin} min · {selected.type === 'VIRTUAL' ? 'Online' : selected.type === 'IN_PERSON' ? 'In-Person' : 'Flexible'}</div>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: '#3A3530' }}>
                    {selected.price === 0 ? 'Free' : `$${selected.price}`}
                  </div>
                </div>
              </div>
            )}

            <div style={{ padding: '12px 24px 20px', fontSize: 11, color: '#8A8278', lineHeight: 1.6 }}>
              You&apos;ll receive a confirmation email with session details and any preparation instructions from your practitioner.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
