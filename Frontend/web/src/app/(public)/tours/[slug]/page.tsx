'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

// ─── Types ──────────────────────────────────────────────────────────────────

interface RoomType {
  id: string;
  name: string;
  description: string | null;
  totalPrice: number | string;
  pricePerNight: number | string;
  capacity: number;
  available: number;
  amenities: string[];
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

interface ItineraryDay {
  id: string;
  dayNumber: number;
  title: string;
  description: string;
  location: string | null;
  meals: string[];
  accommodation: string | null;
  activities: string[];
  imageUrl: string | null;
}

interface Tour {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  shortDesc: string | null;
  startDate: string;
  endDate: string;
  location: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  meetingPoint: string | null;
  basePrice: number | string;
  currency: string;
  capacity: number;
  spotsRemaining: number;
  coverImageUrl: string | null;
  imageUrls: string[];
  highlights: string[];
  included: string[];
  notIncluded: string[];
  requirements: string | null;
  difficultyLevel: string | null;
  languages: string[];
  minDepositPerPerson: number | string | null;
  balanceDueDaysBefore: number;
  cancellationPolicy: { fullRefundDaysBefore: number; halfRefundDaysBefore: number } | null;
  roomTypes: RoomType[];
  departures: Departure[];
  itinerary: ItineraryDay[];
  guide: {
    id: string;
    slug: string;
    displayName: string;
    isVerified: boolean;
    averageRating: number | null;
    user: { avatarUrl: string | null };
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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
function fmtDateShort(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function fmtMonthYear(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
function daysBetween(a: string, b: string) {
  return Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}
function spotColor(spots: number) {
  if (spots <= 2) return C.red;
  if (spots <= 5) return '#E67E22';
  return C.green;
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function TourDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const [tour, setTour] = useState<Tour | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [selectedDeparture, setSelectedDeparture] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    api.get(`/soul-tours/${slug}`)
      .then((res) => {
        setTour(res.data);
        setActiveImage(res.data.coverImageUrl || res.data.imageUrls?.[0] || null);
        // Pre-select first upcoming departure
        const firstUpcoming = (res.data.departures || []).find(
          (d: Departure) => d.status === 'SCHEDULED' && new Date(d.startDate) >= new Date(),
        );
        if (firstUpcoming) setSelectedDeparture(firstUpcoming.id);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div style={{ padding: '120px 24px', textAlign: 'center', color: C.warmGray, fontFamily: 'Inter, sans-serif' }}>
        Loading journey…
      </div>
    );
  }
  if (error || !tour) {
    return (
      <div style={{ padding: '120px 24px', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🏔️</div>
        <h1 style={{ fontFamily: serif, fontSize: 32, color: C.charcoal, marginBottom: 12 }}>
          Tour not found
        </h1>
        <p style={{ color: C.warmGray, marginBottom: 24 }}>
          This journey may have been removed or is no longer available.
        </p>
        <Link href="/travels" style={{
          display: 'inline-block', padding: '12px 28px', background: C.gold, color: C.charcoal,
          textDecoration: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13,
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          ← Browse All Tours
        </Link>
      </div>
    );
  }

  // ─── Computed values ──────────────────────────────────────────────────────
  const upcomingDepartures = tour.departures.filter(
    (d) => d.status === 'SCHEDULED' && new Date(d.startDate) >= new Date(),
  );
  const totalUpcomingSpots = upcomingDepartures.reduce((s, d) => s + d.spotsRemaining, 0);
  const days = daysBetween(tour.startDate, tour.endDate);
  const cheapestRoom = tour.roomTypes.length
    ? tour.roomTypes.reduce((min, r) => (Number(r.totalPrice) < Number(min.totalPrice) ? r : min))
    : null;
  const fromPrice = cheapestRoom ? Number(cheapestRoom.totalPrice) : Number(tour.basePrice);
  const policy = tour.cancellationPolicy || { fullRefundDaysBefore: 90, halfRefundDaysBefore: 60 };

  const handleBookNow = () => {
    const url = selectedDeparture
      ? `/tours/${tour.slug}/book?departure=${selectedDeparture}`
      : `/tours/${tour.slug}/book`;
    router.push(url);
  };

  return (
    <div style={{ background: C.offWhite, minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      {/* ─── HERO ───────────────────────────────────────────────────────── */}
      <section style={{ position: 'relative', height: 540, overflow: 'hidden', background: 'linear-gradient(135deg, #2C2420, #3A3530)' }}>
        {activeImage && (
          <img
            src={activeImage}
            alt={tour.title}
            style={{
              width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0, opacity: 0.55,
            }}
          />
        )}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(44,36,32,0.4) 0%, rgba(44,36,32,0.85) 100%)',
        }} />
        <div style={{
          position: 'relative', maxWidth: 1200, margin: '0 auto', padding: '48px 48px',
          height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 16,
        }}>
          <Link href="/travels" style={{
            color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: 12,
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            ← Soul Travels
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <span style={{
              padding: '5px 14px', borderRadius: 20,
              background: 'rgba(232,184,75,0.2)', border: '1px solid rgba(232,184,75,0.5)',
              color: C.goldLight, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              {days} day journey
            </span>
            {tour.difficultyLevel && (
              <span style={{
                padding: '5px 14px', borderRadius: 20, background: 'rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>
                {tour.difficultyLevel}
              </span>
            )}
            {tour.guide.isVerified && (
              <span style={{
                padding: '5px 14px', borderRadius: 20, background: 'rgba(90,138,106,0.25)',
                color: '#A8D8B6', fontSize: 11, fontWeight: 500,
              }}>
                ✓ Verified Guide
              </span>
            )}
          </div>
          <h1 style={{
            fontFamily: serif, fontSize: 56, fontWeight: 400,
            color: C.white, lineHeight: 1.05, maxWidth: 900,
          }}>
            {tour.title}
          </h1>
          {tour.shortDesc && (
            <p style={{
              fontSize: 17, color: 'rgba(255,255,255,0.85)', maxWidth: 720, lineHeight: 1.55,
            }}>
              {tour.shortDesc}
            </p>
          )}
          <div style={{ display: 'flex', gap: 28, fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 8 }}>
            {tour.location && <span>📍 {tour.location}</span>}
            <span>👥 Max {tour.capacity} travelers</span>
            <span>💰 From ${fromPrice.toLocaleString()}</span>
          </div>
        </div>
      </section>

      {/* ─── BODY ──────────────────────────────────────────────────────── */}
      <section style={{
        maxWidth: 1200, margin: '0 auto', padding: '64px 48px',
        display: 'grid', gridTemplateColumns: '1fr 380px', gap: 56, alignItems: 'start',
      }}>
        {/* ─── LEFT: content ───────────────────────────────────────────── */}
        <div>
          {/* Gallery */}
          {tour.imageUrls.length > 0 && (
            <div style={{ marginBottom: 56 }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {(tour.coverImageUrl ? [tour.coverImageUrl, ...tour.imageUrls] : tour.imageUrls).map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(url)}
                    style={{
                      width: 90, height: 70, borderRadius: 6, overflow: 'hidden',
                      border: activeImage === url ? `2px solid ${C.gold}` : '2px solid transparent',
                      cursor: 'pointer', padding: 0, background: 'none',
                    }}
                  >
                    <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* About */}
          {tour.description && (
            <div style={{ marginBottom: 56 }}>
              <SectionHeader>About this journey</SectionHeader>
              <div
                style={{ fontSize: 15, color: C.charcoal, lineHeight: 1.75 }}
                dangerouslySetInnerHTML={{ __html: tour.description }}
              />
            </div>
          )}

          {/* Highlights */}
          {tour.highlights.length > 0 && (
            <div style={{ marginBottom: 56 }}>
              <SectionHeader>Highlights</SectionHeader>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {tour.highlights.map((h, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '14px 18px', background: C.goldPale,
                      border: '1px solid rgba(232,184,75,0.2)', borderRadius: 8,
                    }}
                  >
                    <span style={{ color: C.gold, fontSize: 16, lineHeight: 1.4 }}>✦</span>
                    <span style={{ fontSize: 14, color: C.charcoal, lineHeight: 1.5 }}>{h}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Itinerary */}
          {tour.itinerary.length > 0 && (
            <div style={{ marginBottom: 56 }}>
              <SectionHeader>Day-by-day itinerary</SectionHeader>
              <div style={{ position: 'relative' }}>
                {/* Vertical timeline line */}
                <div style={{
                  position: 'absolute', left: 23, top: 16, bottom: 16,
                  width: 2, background: 'rgba(232,184,75,0.25)',
                }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {tour.itinerary
                    .sort((a, b) => a.dayNumber - b.dayNumber)
                    .map((day) => (
                    <div key={day.id} style={{ position: 'relative', paddingLeft: 64 }}>
                      <div style={{
                        position: 'absolute', left: 0, top: 0,
                        width: 48, height: 48, borderRadius: '50%',
                        background: C.gold, color: C.white,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: serif, fontSize: 18, fontWeight: 500,
                        boxShadow: '0 2px 8px rgba(232,184,75,0.4)',
                      }}>
                        {day.dayNumber}
                      </div>
                      <div style={{
                        background: C.white, border: '1px solid rgba(232,184,75,0.15)',
                        borderRadius: 12, padding: 24,
                      }}>
                        <h3 style={{
                          fontFamily: serif, fontSize: 22, fontWeight: 500, color: C.charcoal, marginBottom: 6,
                        }}>
                          Day {day.dayNumber} — {day.title}
                        </h3>
                        {day.location && (
                          <div style={{ fontSize: 12, color: C.warmGray, marginBottom: 12 }}>
                            📍 {day.location}
                          </div>
                        )}
                        <p style={{ fontSize: 14, color: C.charcoal, lineHeight: 1.7, marginBottom: 12 }}>
                          {day.description}
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                          {day.activities.map((a, i) => (
                            <span key={`a-${i}`} style={{
                              padding: '4px 10px', borderRadius: 16,
                              background: C.goldPale, fontSize: 11, color: C.charcoal,
                              border: '1px solid rgba(232,184,75,0.2)',
                            }}>
                              {a}
                            </span>
                          ))}
                          {day.meals.map((m, i) => (
                            <span key={`m-${i}`} style={{
                              padding: '4px 10px', borderRadius: 16,
                              background: 'rgba(90,138,106,0.1)', fontSize: 11, color: '#3D6249',
                              border: '1px solid rgba(90,138,106,0.2)',
                            }}>
                              🍽 {m}
                            </span>
                          ))}
                        </div>
                        {day.accommodation && (
                          <div style={{ fontSize: 12, color: C.warmGray, marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(232,184,75,0.1)' }}>
                            🏨 {day.accommodation}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Room types */}
          {tour.roomTypes.length > 0 && (
            <div style={{ marginBottom: 56 }}>
              <SectionHeader>Accommodation options</SectionHeader>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {tour.roomTypes.map((rt) => (
                  <div key={rt.id} style={{
                    background: C.white, border: '1px solid rgba(232,184,75,0.15)', borderRadius: 12,
                    padding: 24, display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'center',
                  }}>
                    <div>
                      <h3 style={{ fontFamily: serif, fontSize: 20, fontWeight: 500, color: C.charcoal, marginBottom: 4 }}>
                        {rt.name}
                      </h3>
                      {rt.description && (
                        <p style={{ fontSize: 13, color: C.warmGray, lineHeight: 1.5, marginBottom: 8 }}>
                          {rt.description}
                        </p>
                      )}
                      {rt.amenities.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {rt.amenities.map((a, i) => (
                            <span key={i} style={{
                              fontSize: 11, color: C.warmGray,
                              padding: '2px 8px', background: C.offWhite, borderRadius: 12,
                              border: '1px solid rgba(232,184,75,0.15)',
                            }}>
                              ✓ {a}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: serif, fontSize: 26, fontWeight: 500, color: C.charcoal }}>
                        ${Number(rt.totalPrice).toLocaleString()}
                      </div>
                      <div style={{ fontSize: 11, color: C.warmGray }}>per person</div>
                      {rt.available <= 2 && rt.available > 0 && (
                        <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>Only {rt.available} left</div>
                      )}
                      {rt.available === 0 && (
                        <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>Sold out</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* What's included / not included */}
          {(tour.included.length > 0 || tour.notIncluded.length > 0) && (
            <div style={{ marginBottom: 56 }}>
              <SectionHeader>What's included</SectionHeader>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
                {tour.included.length > 0 && (
                  <div>
                    <div style={{
                      fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.green,
                      fontWeight: 600, marginBottom: 12,
                    }}>
                      ✓ Included
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {tour.included.map((item, i) => (
                        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: C.charcoal }}>
                          <span style={{ color: C.green, fontWeight: 600 }}>✓</span> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {tour.notIncluded.length > 0 && (
                  <div>
                    <div style={{
                      fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.red,
                      fontWeight: 600, marginBottom: 12,
                    }}>
                      ✗ Not included
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {tour.notIncluded.map((item, i) => (
                        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: C.warmGray }}>
                          <span style={{ color: C.red, fontWeight: 600 }}>✗</span> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Requirements */}
          {tour.requirements && (
            <div style={{ marginBottom: 56 }}>
              <SectionHeader>Requirements</SectionHeader>
              <div style={{
                background: '#FFFAF0', border: '1px solid rgba(232,184,75,0.25)', borderRadius: 12,
                padding: 24, fontSize: 14, color: C.charcoal, lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
              }}>
                {tour.requirements}
              </div>
            </div>
          )}

          {/* Guide bio */}
          <div style={{ marginBottom: 56 }}>
            <SectionHeader>Your trip leader</SectionHeader>
            <Link href={`/practitioners/${tour.guide.slug}`} style={{ textDecoration: 'none' }}>
              <div style={{
                background: C.white, border: '1px solid rgba(232,184,75,0.15)', borderRadius: 12,
                padding: 24, display: 'flex', alignItems: 'center', gap: 20,
                cursor: 'pointer', transition: 'box-shadow 0.2s',
              }}>
                <div style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: C.goldPale, border: `2px solid ${C.gold}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: serif, fontSize: 28, color: C.gold, flexShrink: 0,
                  overflow: 'hidden',
                }}>
                  {tour.guide.user.avatarUrl ? (
                    <img src={tour.guide.user.avatarUrl} alt={tour.guide.displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    tour.guide.displayName.split(' ').map((w) => w[0]).slice(0, 2).join('')
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <h3 style={{ fontFamily: serif, fontSize: 22, fontWeight: 500, color: C.charcoal }}>
                      {tour.guide.displayName}
                    </h3>
                    {tour.guide.isVerified && (
                      <span style={{ color: C.green, fontSize: 14 }}>✓</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: C.warmGray }}>
                    {tour.guide.averageRating ? `★ ${tour.guide.averageRating.toFixed(1)} · ` : ''}
                    Trip leader on this journey
                  </div>
                </div>
                <div style={{ color: C.gold, fontSize: 13 }}>View profile →</div>
              </div>
            </Link>
          </div>

          {/* Cancellation policy */}
          <div style={{ marginBottom: 56 }}>
            <SectionHeader>Cancellation policy</SectionHeader>
            <div style={{
              background: C.goldPale, border: '1px solid rgba(232,184,75,0.25)', borderRadius: 12,
              padding: 24, fontSize: 14, color: C.charcoal, lineHeight: 1.8,
            }}>
              <p style={{ marginBottom: 8 }}>
                <strong>Full refund</strong> if cancelled <strong>{policy.fullRefundDaysBefore}+ days</strong> before departure.
              </p>
              <p style={{ marginBottom: 8 }}>
                <strong>50% refund</strong> if cancelled between <strong>{policy.halfRefundDaysBefore}–{policy.fullRefundDaysBefore - 1} days</strong> before departure.
              </p>
              <p style={{ marginBottom: 8 }}>
                <strong>No refund</strong> for cancellations within <strong>{policy.halfRefundDaysBefore} days</strong> of departure.
              </p>
              <p style={{ fontSize: 12, color: C.warmGray, marginTop: 12 }}>
                Travel insurance is strongly recommended. Balance is due {tour.balanceDueDaysBefore} days before your departure date.
              </p>
            </div>
          </div>
        </div>

        {/* ─── RIGHT: sticky booking sidebar ───────────────────────────── */}
        <aside style={{
          position: 'sticky', top: 100,
          background: C.white, border: '1px solid rgba(232,184,75,0.2)',
          borderRadius: 16, padding: 28, boxShadow: '0 4px 24px rgba(58,53,48,0.06)',
        }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.warmGray, marginBottom: 6 }}>
              Starting from
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontFamily: serif, fontSize: 36, fontWeight: 500, color: C.charcoal }}>
                ${fromPrice.toLocaleString()}
              </span>
              <span style={{ fontSize: 13, color: C.warmGray }}>per person</span>
            </div>
          </div>

          {/* Departures */}
          {upcomingDepartures.length > 0 ? (
            <div style={{ marginBottom: 20 }}>
              <div style={{
                fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.warmGray,
                fontWeight: 600, marginBottom: 12,
              }}>
                Choose Departure
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {upcomingDepartures.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDeparture(d.id)}
                    style={{
                      textAlign: 'left', padding: '12px 14px', borderRadius: 8,
                      background: selectedDeparture === d.id ? C.goldPale : C.white,
                      border: selectedDeparture === d.id
                        ? `1.5px solid ${C.gold}`
                        : '1.5px solid rgba(232,184,75,0.2)',
                      cursor: 'pointer', transition: 'all 0.15s',
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.warmGray, marginBottom: 2 }}>
                      {fmtMonthYear(d.startDate)}
                    </div>
                    <div style={{ fontFamily: serif, fontSize: 17, fontWeight: 500, color: C.charcoal, marginBottom: 4 }}>
                      {fmtDateShort(d.startDate)} – {fmtDateShort(d.endDate)}
                    </div>
                    <div style={{ fontSize: 11, color: spotColor(d.spotsRemaining), fontWeight: 500 }}>
                      {d.spotsRemaining > 0 ? `${d.spotsRemaining} spots remaining` : 'Sold out'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{
              padding: 16, background: '#FFEBEE', border: '1px solid #FFCDD2',
              borderRadius: 8, marginBottom: 20,
            }}>
              <div style={{ fontSize: 13, color: C.red, fontWeight: 500, marginBottom: 4 }}>
                No upcoming departures
              </div>
              <div style={{ fontSize: 11, color: C.warmGray }}>
                Check back soon — new dates are added regularly.
              </div>
            </div>
          )}

          {/* Quick facts */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20,
            paddingTop: 16, borderTop: '1px solid rgba(232,184,75,0.15)',
          }}>
            {tour.location && (
              <FactRow icon="📍" text={tour.location} />
            )}
            {tour.meetingPoint && (
              <FactRow icon="✈️" text={tour.meetingPoint} />
            )}
            <FactRow icon="👥" text={`Max ${tour.capacity} travelers`} />
            <FactRow icon="🗓" text={`${days} days`} />
            {tour.languages.length > 0 && (
              <FactRow icon="🗣" text={tour.languages.join(', ')} />
            )}
            {tour.minDepositPerPerson && (
              <FactRow icon="💳" text={`Deposit from $${Number(tour.minDepositPerPerson).toLocaleString()} per person`} />
            )}
          </div>

          {/* CTA */}
          <button
            onClick={handleBookNow}
            disabled={upcomingDepartures.length === 0}
            style={{
              width: '100%', padding: 16, borderRadius: 8,
              background: upcomingDepartures.length === 0 ? '#ccc' : C.charcoal,
              color: upcomingDepartures.length === 0 ? '#888' : C.gold,
              border: 'none', cursor: upcomingDepartures.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
              fontFamily: 'Inter, sans-serif',
              transition: 'background 0.25s',
            }}
          >
            {upcomingDepartures.length === 0 ? 'Currently Unavailable' : 'Book This Journey →'}
          </button>
          <p style={{
            fontSize: 11, color: C.warmGray, textAlign: 'center', marginTop: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            🔒 Secured by Stripe · Reserve with a deposit
          </p>
        </aside>
      </section>
    </div>
  );
}

// ─── Tiny presentational helpers ────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontFamily: serif, fontSize: 30, fontWeight: 400, color: C.charcoal,
      marginBottom: 24, paddingBottom: 12, borderBottom: '1px solid rgba(232,184,75,0.2)',
    }}>
      {children}
    </h2>
  );
}

function FactRow({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12, color: C.charcoal }}>
      <span style={{ flexShrink: 0 }}>{icon}</span>
      <span>{text}</span>
    </div>
  );
}
