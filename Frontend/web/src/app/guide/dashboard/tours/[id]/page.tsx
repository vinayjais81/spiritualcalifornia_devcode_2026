'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { C, font, serif } from '@/components/guide/dashboard-ui';
import { TourForm, TourFormState, hydrateTourForm } from '@/components/guide/TourForm';

export default function EditTourPage() {
  const params = useParams();
  const tourId = params?.id as string;
  const [initial, setInitial] = useState<TourFormState | null>(null);
  const [tourTitle, setTourTitle] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!tourId) return;
    // Fetch the guide's own tour list and find this one — we use /mine instead of
    // /:slugOrId because the public endpoint hides unpublished tours and we need
    // the full nested data (departures + itinerary).
    api.get('/soul-tours/mine')
      .then((r) => {
        const tour = r.data.find((t: any) => t.id === tourId);
        if (!tour) {
          setNotFound(true);
          return;
        }
        setTourTitle(tour.title);
        setInitial(hydrateTourForm(tour));
      })
      .catch((err) => toast.error(err?.response?.data?.message || 'Failed to load tour'))
      .finally(() => setLoading(false));
  }, [tourId]);

  if (loading) {
    return <div style={{ fontFamily: font, fontSize: 13, color: C.warmGray, padding: 40 }}>Loading tour…</div>;
  }
  if (notFound || !initial) {
    return (
      <div style={{ fontFamily: font, fontSize: 14, color: C.charcoal, padding: 40 }}>
        Tour not found.{' '}
        <Link href="/guide/dashboard/tours" style={{ color: C.gold }}>← Back to Soul Tours</Link>
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link
          href="/guide/dashboard/tours"
          style={{ fontFamily: font, fontSize: 12, color: C.warmGray, textDecoration: 'none', letterSpacing: '0.06em' }}
        >
          ← Back to Soul Tours
        </Link>
        <Link
          href={`/guide/dashboard/tours/${tourId}/bookings`}
          style={{
            fontFamily: font, fontSize: 12, color: C.gold, textDecoration: 'none',
            padding: '8px 14px', border: `1px solid ${C.gold}`, borderRadius: 6,
          }}
        >
          View Bookings & Manifest →
        </Link>
      </div>
      <h1 style={{ fontFamily: serif, fontSize: 36, fontWeight: 400, color: C.charcoal, marginBottom: 6 }}>
        Edit Tour
      </h1>
      <p style={{ fontFamily: font, fontSize: 13, color: C.warmGray, marginBottom: 32 }}>
        {tourTitle}
      </p>

      <TourForm initial={initial} tourId={tourId} />
    </>
  );
}
