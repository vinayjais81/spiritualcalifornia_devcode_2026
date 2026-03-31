'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { StepNav } from '@/components/public/booking/StepNav';
import { PaymentForm } from '@/components/public/booking/PaymentForm';
import { BookingSuccess } from '@/components/public/booking/BookingSuccess';

interface RoomType { id: string; name: string; description: string | null; totalPrice: number; capacity: number; available: number; }
interface Tour {
  id: string; title: string; slug: string; startDate: string; endDate: string;
  location: string | null; basePrice: number; capacity: number; spotsRemaining: number;
  coverImageUrl: string | null; depositMin: number | null; included: string[];
  roomTypes: RoomType[];
  guide: { displayName: string; slug: string; user: { avatarUrl: string | null } };
}

const steps = ['Choose Dates', 'Travelers & Room', 'Your Details', 'Deposit & Pay'];

const fallbackTour: Tour = {
  id: 't1', title: 'Nepal — Himalayan Awakening', slug: 'nepal-himalayan-awakening',
  startDate: '2026-05-09', endDate: '2026-05-18', location: 'Kathmandu, Pokhara, Lumbini',
  basePrice: 3800, capacity: 12, spotsRemaining: 5, coverImageUrl: null, depositMin: 1000,
  included: ['All accommodation', 'Daily breakfast & lunch', 'Guided meditation sessions', 'Monastery visits', 'Local transport', '24/7 trip support'],
  roomTypes: [
    { id: 'r1', name: 'Shared Double', description: 'Share a room with another traveler', totalPrice: 3800, capacity: 6, available: 4 },
    { id: 'r2', name: 'Private Single', description: 'Your own private room', totalPrice: 4600, capacity: 4, available: 2 },
    { id: 'r3', name: 'Couples / Partner', description: 'Private double room for couples', totalPrice: 4200, capacity: 3, available: 1 },
  ],
  guide: { displayName: 'Luna Rivera', slug: 'luna-rivera', user: { avatarUrl: null } },
};

function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
function daysBetween(a: string, b: string) { return Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86400000); }

export default function BookTourPage() {
  const params = useParams();
  const tourSlug = params.slug as string;
  const [step, setStep] = useState(0);
  const [tour, setTour] = useState<Tour | null>(null);
  const [loading, setLoading] = useState(true);
  const [booked, setBooked] = useState(false);

  const [travelers, setTravelers] = useState(2);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [selectedDeposit, setSelectedDeposit] = useState<number | null>(null);
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', dob: '', nationality: '',
    passportNumber: '', passportExpiry: '', dietary: '', healthConditions: '', intentions: '',
  });

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get(`/soul-tours/${tourSlug}`);
        setTour(res.data);
      } catch {
        setTour(fallbackTour);
      } finally { setLoading(false); }
    };
    fetch();
  }, [tourSlug]);

  if (loading || !tour) return <div style={{ padding: 100, textAlign: 'center', color: '#8A8278' }}>Loading tour...</div>;

  const room = tour.roomTypes.find(r => r.id === selectedRoom);
  const totalAmount = room ? room.totalPrice * travelers : tour.basePrice * travelers;
  const days = daysBetween(tour.startDate, tour.endDate);

  const depositOptions = [
    { amount: tour.depositMin || 1000, label: 'Minimum deposit' },
    { amount: Math.round(totalAmount * 0.25), label: '25% deposit' },
    { amount: Math.round(totalAmount * 0.5), label: '50% deposit' },
    { amount: totalAmount, label: 'Pay in full' },
  ];

  if (booked) {
    return (
      <BookingSuccess
        title="Your Tour is Reserved!"
        subtitle="We've sent a confirmation to your email with full trip details, packing list, and preparation guide."
        details={[
          { label: 'Tour', value: tour.title },
          { label: 'Dates', value: `${fmtDate(tour.startDate)} – ${fmtDate(tour.endDate)}` },
          { label: 'Travelers', value: `${travelers}` },
          { label: 'Room', value: room?.name || 'Standard' },
          { label: 'Total', value: `$${totalAmount.toLocaleString()}` },
          { label: 'Deposit Paid', value: `$${(selectedDeposit || 0).toLocaleString()}` },
        ]}
        primaryAction={{ label: 'View My Trips', href: '/' }}
        secondaryAction={{ label: 'Browse More Tours', href: '/travels' }}
      />
    );
  }

  return (
    <>
      {/* Hero */}
      <div style={{
        height: 280, position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, #2C2420, #3A3530)',
      }}>
        {tour.coverImageUrl && (
          <img src={tour.coverImageUrl} alt={tour.title} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', opacity: 0.5 }} />
        )}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to right, rgba(44,36,32,0.85), rgba(58,53,48,0.6))',
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '32px 48px',
        }}>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 38, fontWeight: 400, color: '#fff', marginBottom: 12 }}>
            {tour.title}
          </h1>
          <div style={{ display: 'flex', gap: 24 }}>
            {[
              { icon: '📅', text: `${days} days` },
              { icon: '👥', text: `Max ${tour.capacity} travelers` },
              { icon: '💰', text: `From $${tour.basePrice.toLocaleString()}/person` },
            ].map((m, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
                {m.icon} {m.text}
              </span>
            ))}
          </div>
        </div>
      </div>

      <StepNav steps={steps} current={step} onChange={setStep} />

      <div style={{ maxWidth: 1060, margin: '0 auto', padding: '40px 32px 80px', display: 'grid', gridTemplateColumns: '1fr 340px', gap: 48 }}>
        {/* Left Content */}
        <div>
          {/* Step 1: Dates */}
          {step === 0 && (
            <div>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 400, color: '#3A3530', marginBottom: 6 }}>Choose Your Dates</h2>
              <p style={{ fontSize: 13, color: '#8A8278', marginBottom: 24 }}>Select when you&apos;d like to join this journey.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <button style={{
                  padding: '20px 18px', borderRadius: 8, textAlign: 'left',
                  background: '#FDF6E3', border: '1.5px solid #E8B84B', cursor: 'pointer',
                }}>
                  <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#E8B84B', marginBottom: 4 }}>
                    {new Date(tour.startDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </div>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: '#3A3530', marginBottom: 6 }}>
                    {fmtDate(tour.startDate)} – {fmtDate(tour.endDate)}
                  </div>
                  <div style={{ fontSize: 12, color: tour.spotsRemaining <= 3 ? '#C0392B' : '#5A8A6A' }}>
                    {tour.spotsRemaining} spots remaining
                  </div>
                </button>
              </div>
              <button onClick={() => setStep(1)} style={{ marginTop: 24, padding: '14px 32px', borderRadius: 8, background: '#E8B84B', color: '#3A3530', border: 'none', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
                Continue to Travelers
              </button>
            </div>
          )}

          {/* Step 2: Travelers & Room */}
          {step === 1 && (
            <div>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 400, color: '#3A3530', marginBottom: 6 }}>Travelers &amp; Accommodation</h2>
              <p style={{ fontSize: 13, color: '#8A8278', marginBottom: 24 }}>How many are joining and what type of room?</p>

              <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A8278', marginBottom: 12 }}>Number of Travelers</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 32 }}>
                <button onClick={() => setTravelers(Math.max(1, travelers - 1))} style={{
                  width: 36, height: 36, borderRadius: '50%', background: '#FDF6E3', border: '1px solid rgba(232,184,75,0.3)',
                  fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3A3530',
                }}>−</button>
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 500, color: '#3A3530', minWidth: 60, textAlign: 'center' }}>
                  {travelers}
                </span>
                <button onClick={() => setTravelers(Math.min(tour.spotsRemaining, travelers + 1))} style={{
                  width: 36, height: 36, borderRadius: '50%', background: '#FDF6E3', border: '1px solid rgba(232,184,75,0.3)',
                  fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3A3530',
                }}>+</button>
                <span style={{ fontSize: 13, color: '#8A8278' }}>travelers</span>
              </div>

              <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A8278', marginBottom: 12 }}>Room Preference</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                {tour.roomTypes.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRoom(r.id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '16px 18px', borderRadius: 8, textAlign: 'left', width: '100%',
                      background: selectedRoom === r.id ? '#FDF6E3' : '#fff',
                      border: selectedRoom === r.id ? '1.5px solid #E8B84B' : '1.5px solid rgba(232,184,75,0.15)',
                      cursor: r.available > 0 ? 'pointer' : 'not-allowed', opacity: r.available > 0 ? 1 : 0.5,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 500, color: '#3A3530', marginBottom: 2 }}>{r.name}</div>
                      <div style={{ fontSize: 12, color: '#8A8278' }}>{r.description}</div>
                      {r.available <= 2 && r.available > 0 && (
                        <div style={{ fontSize: 11, color: '#C0392B', marginTop: 4 }}>Only {r.available} left</div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
                      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: '#3A3530' }}>
                        ${r.totalPrice.toLocaleString()}
                      </div>
                      <div style={{ fontSize: 11, color: '#8A8278' }}>per person</div>
                    </div>
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setStep(0)} style={{ padding: '12px 24px', borderRadius: 8, border: '1.5px solid rgba(232,184,75,0.3)', background: 'transparent', fontSize: 12, color: '#3A3530', cursor: 'pointer' }}>← Back</button>
                <button onClick={() => selectedRoom && setStep(2)} disabled={!selectedRoom} style={{ padding: '12px 24px', borderRadius: 8, background: selectedRoom ? '#E8B84B' : 'rgba(232,184,75,0.3)', color: '#3A3530', border: 'none', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: selectedRoom ? 'pointer' : 'not-allowed' }}>
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Details */}
          {step === 2 && (
            <div>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 400, color: '#3A3530', marginBottom: 6 }}>Traveler Details</h2>
              <p style={{ fontSize: 13, color: '#8A8278', marginBottom: 24 }}>We need these details for travel arrangements and accommodations.</p>

              <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A8278', marginBottom: 12 }}>Primary Traveler</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
                {[
                  { label: 'First Name', key: 'firstName' },
                  { label: 'Last Name', key: 'lastName' },
                  { label: 'Email', key: 'email', type: 'email' },
                  { label: 'Phone', key: 'phone', type: 'tel' },
                  { label: 'Date of Birth', key: 'dob', type: 'date' },
                  { label: 'Nationality', key: 'nationality' },
                ].map(f => (
                  <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A8278' }}>{f.label}</label>
                    <input
                      value={(form as any)[f.key]}
                      onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                      type={f.type || 'text'}
                      style={{ padding: '12px 14px', borderRadius: 6, border: '1.5px solid rgba(232,184,75,0.2)', background: '#FAFAF7', fontSize: 13, outline: 'none', fontFamily: "'Inter', sans-serif" }}
                    />
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A8278', marginBottom: 12 }}>Health &amp; Preferences</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
                <div>
                  <label style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A8278', marginBottom: 6, display: 'block' }}>Dietary Requirements</label>
                  <select value={form.dietary} onChange={e => setForm({ ...form, dietary: e.target.value })} style={{ width: '100%', padding: '12px 14px', borderRadius: 6, border: '1.5px solid rgba(232,184,75,0.2)', background: '#FAFAF7', fontSize: 13, fontFamily: "'Inter', sans-serif" }}>
                    <option value="">No restrictions</option>
                    <option value="vegetarian">Vegetarian</option>
                    <option value="vegan">Vegan</option>
                    <option value="gluten-free">Gluten-free</option>
                    <option value="other">Other (specify below)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A8278', marginBottom: 6, display: 'block' }}>Health conditions or concerns</label>
                  <textarea value={form.healthConditions} onChange={e => setForm({ ...form, healthConditions: e.target.value })} rows={3} style={{ width: '100%', padding: '12px 14px', borderRadius: 6, border: '1.5px solid rgba(232,184,75,0.2)', background: '#FAFAF7', fontSize: 13, fontFamily: "'Inter', sans-serif", resize: 'vertical' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setStep(1)} style={{ padding: '12px 24px', borderRadius: 8, border: '1.5px solid rgba(232,184,75,0.3)', background: 'transparent', fontSize: 12, color: '#3A3530', cursor: 'pointer' }}>← Back</button>
                <button onClick={() => setStep(3)} style={{ padding: '12px 24px', borderRadius: 8, background: '#E8B84B', color: '#3A3530', border: 'none', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Continue to Payment
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Deposit & Pay */}
          {step === 3 && (
            <div>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 400, color: '#3A3530', marginBottom: 6 }}>Deposit &amp; Payment</h2>
              <p style={{ fontSize: 13, color: '#8A8278', marginBottom: 24 }}>Secure your spot with a deposit. The balance is due 60 days before departure.</p>

              {/* Deposit selector */}
              <div style={{
                background: 'linear-gradient(135deg, #2C2420, #3A3530)',
                borderRadius: 12, padding: 24, marginBottom: 32,
              }}>
                <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, color: '#F5D98A', marginBottom: 8 }}>
                  Choose Your Deposit Amount
                </h3>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>
                  A minimum deposit of ${(tour.depositMin || 1000).toLocaleString()} is required to reserve your spot.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {depositOptions.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedDeposit(opt.amount)}
                      style={{
                        padding: '16px 14px', borderRadius: 8, textAlign: 'center',
                        background: selectedDeposit === opt.amount ? 'rgba(232,184,75,0.15)' : 'rgba(255,255,255,0.05)',
                        border: selectedDeposit === opt.amount ? '1.5px solid #E8B84B' : '1.5px solid rgba(255,255,255,0.1)',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: '#F5D98A', marginBottom: 2 }}>
                        ${opt.amount.toLocaleString()}
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {opt.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <PaymentForm
                tabs={['Credit / Debit', 'Bank Transfer', 'Crypto']}
                submitLabel={`Pay Deposit — $${(selectedDeposit || tour.depositMin || 1000).toLocaleString()}`}
                onSubmit={() => setBooked(true)}
                cancellationNote="Full refund if cancelled 90+ days before departure. 50% refund 60-89 days. No refund within 60 days."
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
            {/* Tour image */}
            <div style={{ height: 160, background: 'linear-gradient(135deg, #2C2420, #3A3530)', overflow: 'hidden' }}>
              {tour.coverImageUrl ? (
                <img src={tour.coverImageUrl} alt={tour.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>🏔️</div>
              )}
            </div>

            <div style={{ padding: '20px 24px' }}>
              <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 500, color: '#3A3530', marginBottom: 14 }}>
                {tour.title}
              </h3>

              {/* Tour details */}
              {[
                { icon: '📅', text: `${fmtDate(tour.startDate)} – ${fmtDate(tour.endDate)} (${days} days)` },
                { icon: '📍', text: tour.location || 'Location TBD' },
                { icon: '👥', text: `${travelers} traveler${travelers > 1 ? 's' : ''}${room ? `, ${room.name}` : ''}` },
              ].map((d, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, fontSize: 12, color: '#3A3530' }}>
                  <span style={{ flexShrink: 0 }}>{d.icon}</span>
                  <span>{d.text}</span>
                </div>
              ))}

              {/* What's included */}
              <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A8278', marginTop: 16, marginBottom: 10 }}>
                What&apos;s Included
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {tour.included.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#3A3530' }}>
                    <span style={{ color: '#E8B84B' }}>✓</span> {item}
                  </div>
                ))}
              </div>

              {/* Price breakdown */}
              <div style={{ borderTop: '1px solid rgba(232,184,75,0.1)', marginTop: 16, paddingTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12, color: '#8A8278' }}>
                  <span>{travelers} × {room?.name || 'Standard'}</span>
                  <span>${totalAmount.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 12, color: '#8A8278' }}>
                  <span>Taxes & fees</span>
                  <span>$0</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid rgba(232,184,75,0.15)' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#3A3530' }}>Total</span>
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 500, color: '#3A3530' }}>
                    ${totalAmount.toLocaleString()}
                  </span>
                </div>
                {selectedDeposit && selectedDeposit < totalAmount && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: '#E8B84B' }}>
                      <span>Deposit due today</span>
                      <span style={{ fontWeight: 600 }}>${selectedDeposit.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: '#8A8278' }}>
                      <span>Balance due 60 days before</span>
                      <span>${(totalAmount - selectedDeposit).toLocaleString()}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
