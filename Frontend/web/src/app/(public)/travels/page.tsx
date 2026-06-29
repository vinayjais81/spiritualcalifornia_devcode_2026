'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { TourImageCarousel } from '@/components/public/shared/TourImageCarousel';
import { SearchResultsList, SearchResultRow } from '@/components/public/shared/SearchResultsList';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Departure {
  id: string;
  startDate: string;
  endDate: string;
  capacity: number;
  spotsRemaining: number;
  status: string;
}

interface Tour {
  id: string;
  title: string;
  slug: string;
  startDate: string;
  endDate: string;
  location: string | null;
  country: string | null;
  basePrice: number | string;
  capacity: number;
  spotsRemaining: number;
  coverImageUrl: string | null;
  imageUrls: string[];
  shortDesc: string | null;
  highlights: string[];
  difficultyLevel: string | null;
  trackType: 'ADVENTURE' | 'HEALING' | null;
  latestUpdate: string | null;
  languages: string[];
  guide: {
    displayName: string;
    slug: string;
    user: { avatarUrl: string | null };
  };
  roomTypes: Array<{ name: string; totalPrice: number | string }>;
  departures: Departure[];
}

interface Stats {
  totalJourneys: number;
  countries: number;
  // Lowercased country slugs returned by /soul-tours/stats. Drives the
  // destination filter pill set — pills for countries with no live tour
  // are hidden (spec Task 7).
  countrySlugs: string[];
  travelers: number;
}

// ─── Country configuration ──────────────────────────────────────────────────

const COUNTRY_FILTERS = [
  { slug: 'all', flag: '', label: 'All Countries' },
  { slug: 'nepal', flag: '🇳🇵', label: 'Nepal' },
  { slug: 'india', flag: '🇮🇳', label: 'India' },
  { slug: 'cambodia', flag: '🇰🇭', label: 'Cambodia' },
  { slug: 'sri lanka', flag: '🇱🇰', label: 'Sri Lanka' },
  { slug: 'peru', flag: '🇵🇪', label: 'Peru' },
  { slug: 'japan', flag: '🇯🇵', label: 'Japan' },
  { slug: 'morocco', flag: '🇲🇦', label: 'Morocco' },
  { slug: 'indonesia', flag: '🇮🇩', label: 'Indonesia' },
];

function countryFlag(country: string | null | undefined): string {
  if (!country) return '';
  const match = COUNTRY_FILTERS.find(
    (c) => c.slug.toLowerCase() === country.toLowerCase()
  );
  return match?.flag ?? '';
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];

function monthKey(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function daysBetween(a: string, b: string): number {
  return Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════

function adaptTourSearchHit(hit: any): SearchResultRow {
  const start = new Date(hit.startDate);
  const priceNum = typeof hit.basePrice === 'string' ? parseFloat(hit.basePrice) : Number(hit.basePrice);
  return {
    id: hit.id,
    slug: hit.slug,
    title: hit.title,
    excerpt: hit.shortDesc,
    coverImageUrl: hit.coverImageUrl,
    locationLabel: hit.location || hit.country || null,
    dateLabel: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    priceLabel: Number.isFinite(priceNum) ? `From $${priceNum.toLocaleString()}` : null,
    badge: null,
    guide: {
      slug: hit.guideSlug,
      displayName: hit.guideName,
      avatarUrl: hit.guideAvatarUrl ?? null,
    },
    href: `/tours/${hit.slug}`,
  };
}

export default function TravelsPage() {
  const [tours, setTours] = useState<Tour[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTrack, setActiveTrack] = useState<'adventures' | 'healing'>('adventures');
  const [activeCountry, setActiveCountry] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultRow[]>([]);
  const [searching, setSearching] = useState(false);
  const isSearchMode = searchQuery.trim().length > 0;

  // Debounced FTS lookup against /search/tours. Swaps the main pane into
  // a search-results view; the existing track/country tabs above remain
  // visible but are ignored while search is active (intentional — typing
  // a query is a stronger signal than a category filter).
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length === 0) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const res = await api.get('/search/tours', { params: { q, page: 0 } });
        const hits = (res.data?.hits ?? []) as any[];
        if (!cancelled) setSearchResults(hits.map(adaptTourSearchHit));
      } catch {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [searchQuery]);

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    params.track = activeTrack === 'adventures' ? 'ADVENTURE' : 'HEALING';
    if (activeCountry !== 'all') params.country = activeCountry;

    Promise.all([
      api.get('/soul-tours', { params }).catch(() => ({ data: { tours: [] } })),
      api.get('/soul-tours/stats').catch(() => ({ data: null })),
    ])
      .then(([toursRes, statsRes]) => {
        setTours(toursRes.data?.tours || []);
        setStats(statsRes.data);
      })
      .finally(() => setLoading(false));
  }, [activeTrack, activeCountry]);

  // Group tours by month based on next scheduled departure
  const toursByMonth = useMemo(() => {
    const groups: Record<string, Tour[]> = {};
    for (const tour of tours) {
      const nextDep = (tour.departures || [])
        .filter((d) => d.status === 'SCHEDULED' && new Date(d.startDate) >= new Date())
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0];
      const dateForGrouping = nextDep?.startDate || tour.startDate;
      const key = monthKey(dateForGrouping);
      (groups[key] = groups[key] || []).push(tour);
    }
    return Object.entries(groups).sort(
      (a, b) => new Date(a[1][0].startDate).getTime() - new Date(b[1][0].startDate).getTime(),
    );
  }, [tours]);

  return (
    <>
      {/* ── HERO ────────────────────────────────────────────────────── */}
      <div style={{
        marginTop: 69, position: 'relative', overflow: 'hidden',
        minHeight: 'clamp(340px, 60vh, 520px)', display: 'flex', alignItems: 'flex-end',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, #F5F2EB 0%, #FDE8D0 100%)',
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 60% 40%, rgba(240,120,20,0.08) 0%, transparent 70%)',
        }} />
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.04,
          backgroundImage: 'repeating-linear-gradient(45deg, #F07814 0, #F07814 1px, transparent 0, transparent 50%)',
          backgroundSize: '20px 20px',
        }} />
        <div style={{
          position: 'relative', zIndex: 2, width: '100%',
          padding: '60px clamp(16px, 5vw, 48px) 56px', maxWidth: 1280, margin: '0 auto',
        }}>
          <div style={{
            fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase',
            color: '#F07814', marginBottom: 14,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ flex: '0 0 40px', height: 1, background: 'rgba(240,120,20,0.4)' }} />
            Soul Travels
            <span style={{ flex: '0 0 40px', height: 1, background: 'rgba(240,120,20,0.4)' }} />
          </div>
          <h1 style={{
            fontFamily: "'Playfair Display', serif", fontSize: 'clamp(34px, 8vw, 64px)', fontWeight: 300,
            color: '#3A3530', lineHeight: 1.05, marginBottom: 16,
          }}>
            Journey to the<br />
            <em style={{ fontStyle: 'italic', color: '#F07814' }}>Sacred Places</em>
          </h1>
          <p style={{
            fontSize: 15, color: 'rgba(58,53,48,0.6)',
            maxWidth: 560, lineHeight: 1.7, marginBottom: 32,
          }}>
            Curated pilgrimages and healing journeys led by verified guides. From ancient temples in Nepal
            to Ayurvedic retreats in Kerala — every journey is designed to transform.
          </p>
          {stats && (
            <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
              <Stat value={stats.totalJourneys.toString()} label="Active Journeys" />
              <Stat value={stats.countries.toString()} label="Countries" />
              <Stat value={`${stats.travelers}+`} label="Travelers" />
              {/* "Avg Rating" tile removed per compliance spec Task 7 —
                  tour reviews aren't wired yet, so any rating would be
                  synthetic. Re-add when tour reviews land, including
                  the sample size ("4.9 · based on N reviews"). */}
            </div>
          )}
        </div>
      </div>

      {/* ── CONTROLS (tabs + country filter) ────────────────────────── */}
      <div style={{
        position: 'sticky', top: 69, zIndex: 50,
        background: 'rgba(250,250,247,0.97)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(240,120,20,0.12)',
      }}>
        <div style={{
          maxWidth: 1280, margin: '0 auto',
          display: 'flex', alignItems: 'stretch', padding: '0 48px',
          borderBottom: '1px solid rgba(240,120,20,0.1)',
          overflowX: 'auto',
        }}>
          <TabBtn
            active={activeTrack === 'adventures'}
            onClick={() => { setActiveTrack('adventures'); setActiveCountry('all'); }}
            icon="🌏"
            label="Soul Adventures"
          />
          <TabBtn
            active={activeTrack === 'healing'}
            onClick={() => { setActiveTrack('healing'); setActiveCountry('all'); }}
            icon="🌿"
            label="Healing Body"
          />
        </div>
        <div style={{
          maxWidth: 1280, margin: '0 auto',
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 48px',
          flexWrap: 'wrap',
        }}>
          <div style={{ position: 'relative', flex: '0 0 260px', minWidth: 220 }}>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search journeys…"
              aria-label="Search soul tours"
              style={{
                width: '100%', padding: '8px 32px 8px 14px', borderRadius: 24,
                background: '#fff', border: '1px solid rgba(240,120,20,0.25)',
                fontSize: 13, color: '#3A3530', outline: 'none',
              }}
            />
            <span style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              fontSize: 13, color: '#8A8278', pointerEvents: 'none',
            }}>🔍</span>
          </div>
          <span style={{
            fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase',
            color: '#8A8278', marginRight: 4,
          }}>Destination</span>
          {/* Filter pills to the countries that actually have a published
              tour right now (spec Task 7 — don't advertise destinations
              we don't sell). "All Countries" is always shown so the
              full-list reset is always available. */}
          {COUNTRY_FILTERS.filter(
            (c) => c.slug === 'all' || (stats?.countrySlugs ?? []).includes(c.slug),
          ).map((c) => (
            <CountryTag
              key={c.slug}
              active={activeCountry === c.slug}
              onClick={() => setActiveCountry(c.slug)}
              flag={c.flag}
              label={c.label}
            />
          ))}
        </div>
      </div>

      {/* ── MAIN ─────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '48px 48px 80px' }}>
        {isSearchMode ? (
          <SearchResultsList rows={searchResults} query={searchQuery.trim()} loading={searching} />
        ) : (
        <>
        {loading && (
          <div style={{ textAlign: 'center', padding: 80, color: '#8A8278', fontSize: 14 }}>
            Loading journeys…
          </div>
        )}

        {!loading && tours.length === 0 && (
          <div style={{
            textAlign: 'center', padding: 80,
            background: '#fff', border: '1px dashed rgba(240,120,20,0.3)', borderRadius: 16,
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏔️</div>
            <h2 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 28, color: '#3A3530', marginBottom: 8,
            }}>
              No journeys found
            </h2>
            <p style={{ color: '#8A8278', fontSize: 14, maxWidth: 480, margin: '0 auto' }}>
              Try another destination or track — new {activeTrack === 'adventures' ? 'adventures' : 'healing retreats'} are added every month.
            </p>
          </div>
        )}

        {!loading && toursByMonth.map(([month, monthTours]) => (
          <div key={month} style={{ marginBottom: 64 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 32 }}>
              <div style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 13, letterSpacing: '0.2em', textTransform: 'uppercase',
                color: '#8A8278', whiteSpace: 'nowrap',
              }}>{month}</div>
              <div style={{
                flex: 1, height: 1,
                background: 'linear-gradient(to right, rgba(240,120,20,0.3), transparent)',
              }} />
            </div>

            {monthTours.map((tour) => (
              <TourCard key={tour.id} tour={tour} />
            ))}
          </div>
        ))}
        </>
        )}
      </div>

      <style jsx global>{`
        @media (max-width: 860px) {
          .tour-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div style={{
        fontFamily: "'Playfair Display', serif",
        fontSize: 32, color: '#F07814',
      }}>{value}</div>
      <div style={{
        fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
        color: 'rgba(58,53,48,0.6)', marginTop: 2,
      }}>{label}</div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '18px 28px',
        fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase',
        color: active ? '#3A3530' : '#8A8278',
        cursor: 'pointer',
        background: 'none',
        border: 'none',
        borderBottom: `2px solid ${active ? '#F07814' : 'transparent'}`,
        marginBottom: -1,
        fontWeight: active ? 500 : 400,
        transition: 'all 0.25s',
        display: 'flex', alignItems: 'center', gap: 8,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      {label}
    </button>
  );
}

function CountryTag({ active, onClick, flag, label }: {
  active: boolean;
  onClick: () => void;
  flag: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 14px',
        borderRadius: 20,
        border: `1px solid ${active ? '#F07814' : 'rgba(138,130,120,0.25)'}`,
        fontSize: 12,
        color: active ? '#3A3530' : '#8A8278',
        cursor: 'pointer',
        background: active ? '#F07814' : 'transparent',
        fontWeight: active ? 500 : 400,
        transition: 'all 0.2s',
        whiteSpace: 'nowrap',
      }}
    >
      {flag ? `${flag} ${label}` : label}
    </button>
  );
}

function TourCard({ tour }: { tour: Tour }) {
  const nextDeparture = (tour.departures || [])
    .filter((d) => d.status === 'SCHEDULED' && new Date(d.startDate) >= new Date())
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0];

  const depStart = nextDeparture?.startDate || tour.startDate;
  const depEnd = nextDeparture?.endDate || tour.endDate;
  const days = daysBetween(depStart, depEnd);
  const nights = Math.max(0, days - 1);
  const spotsLeft = nextDeparture?.spotsRemaining ?? tour.spotsRemaining;
  const depCapacity = nextDeparture?.capacity ?? tour.capacity;

  const images: string[] = [
    ...(tour.coverImageUrl ? [tour.coverImageUrl] : []),
    ...(tour.imageUrls || []),
  ].filter((v, i, arr) => !!v && arr.indexOf(v) === i);
  const imgs = images.length > 0 ? images : ['/images/hero3.jpg'];

  const trackLabel = tour.trackType === 'ADVENTURE'
    ? 'Soul Adventure'
    : tour.trackType === 'HEALING'
    ? 'Healing Body'
    : 'Sacred Journey';

  return (
    <div style={{
      background: '#fff', borderRadius: 20, overflow: 'hidden',
      boxShadow: '0 4px 32px rgba(58,53,48,0.09)',
      marginBottom: 40, transition: 'transform 0.4s, box-shadow 0.4s',
    }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 12px 48px rgba(58,53,48,0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 4px 32px rgba(58,53,48,0.09)';
      }}
    >
      <div className="tour-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        <TourImageCarousel
          images={imgs}
          alt={tour.title}
          countryFlag={countryFlag(tour.country)}
          countryName={tour.country || undefined}
          priceFrom={Number(tour.basePrice)}
          ratio="3 / 2"
        />

        <div style={{ padding: '36px 40px', display: 'flex', flexDirection: 'column' }}>
          <div style={{
            fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
            color: '#F07814', marginBottom: 10,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>✦</span> {trackLabel}
            {tour.difficultyLevel && (
              <> · <span style={{ textTransform: 'capitalize' }}>{tour.difficultyLevel.toLowerCase()}</span></>
            )}
          </div>
          <h2 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 28, fontWeight: 400, color: '#3A3530',
            lineHeight: 1.2, marginBottom: 14,
          }}>
            {tour.title}
          </h2>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            marginBottom: 18, paddingBottom: 18,
            borderBottom: '1px solid rgba(240,120,20,0.15)',
          }}>
            <Link href={`/guides/${tour.guide.slug}`} style={{ flexShrink: 0 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                overflow: 'hidden',
                background: '#FEF7F0', border: '2px solid #F07814',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 600, color: '#F07814',
              }}>
                {tour.guide.user.avatarUrl ? (
                  <img src={tour.guide.user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  tour.guide.displayName.split(' ').map((w) => w[0]).join('').slice(0, 2)
                )}
              </div>
            </Link>
            <div>
              <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A8278' }}>
                Led by
              </div>
              <Link
                href={`/guides/${tour.guide.slug}`}
                style={{ fontSize: 13, fontWeight: 500, color: '#3A3530', textDecoration: 'none' }}
              >
                {tour.guide.displayName}
              </Link>
            </div>
          </div>

          {tour.shortDesc && (
            <p style={{ fontSize: 13, color: '#8A8278', lineHeight: 1.7, marginBottom: 18 }}>
              {tour.shortDesc}
            </p>
          )}

          {tour.latestUpdate && (
            <div style={{
              background: 'rgba(240,120,20,0.07)',
              borderLeft: '3px solid #F07814',
              padding: '12px 16px',
              borderRadius: '0 8px 8px 0',
              marginBottom: 20,
            }}>
              <div style={{
                fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase',
                color: '#F07814', marginBottom: 4,
              }}>
                ✦ Latest Update from {tour.guide.displayName.split(' ')[0]}
              </div>
              <div style={{ fontSize: 12, color: '#3A3530', lineHeight: 1.6 }}>
                &ldquo;{tour.latestUpdate}&rdquo;
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
            <Detail label="Dates" value={`${fmtDate(depStart)} – ${fmtDate(depEnd)}, ${new Date(depStart).getFullYear()}`} />
            <Detail label="Duration" value={`${days} days · ${nights} nights`} />
            <Detail label="Group Size" value={`Max ${depCapacity} travelers`} />
            <Detail label="Languages" value={(tour.languages || ['English']).slice(0, 2).join(', ')} />
          </div>

          {tour.highlights && tour.highlights.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 24 }}>
              {tour.highlights.slice(0, 5).map((h) => (
                <span
                  key={h}
                  style={{
                    fontSize: 11, padding: '4px 12px', borderRadius: 12,
                    background: 'rgba(240,120,20,0.1)', color: '#8A8278',
                  }}
                >
                  {h}
                </span>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 'auto' }}>
            <Link
              href={`/tours/${tour.slug}/book`}
              style={{
                flex: 1, padding: '16px 24px',
                background: '#3A3530', color: '#fff',
                fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
                borderRadius: 10, textDecoration: 'none', textAlign: 'center',
                transition: 'all 0.3s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#F07814';
                e.currentTarget.style.color = '#3A3530';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#3A3530';
                e.currentTarget.style.color = '#fff';
              }}
            >
              Book This Journey
            </Link>
            <Link
              href={`/tours/${tour.slug}`}
              style={{
                padding: '16px 20px',
                border: '1.5px solid rgba(138,130,120,0.3)',
                color: '#8A8278',
                fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase',
                borderRadius: 10, textDecoration: 'none',
                transition: 'all 0.2s', whiteSpace: 'nowrap',
              }}
            >
              Learn More
            </Link>
          </div>
          {spotsLeft > 0 && spotsLeft <= 8 && (
            <div style={{
              fontSize: 11, color: '#E57373', fontWeight: 500,
              textAlign: 'center', marginTop: 10,
            }}>
              ⚡ Only {spotsLeft} spots remaining
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{
        fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase',
        color: '#8A8278', marginBottom: 3,
      }}>{label}</div>
      <div style={{ fontSize: 13, color: '#3A3530', fontWeight: 500 }}>{value}</div>
    </div>
  );
}
