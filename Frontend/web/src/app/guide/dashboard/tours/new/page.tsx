'use client';

import Link from 'next/link';
import { C, font, serif } from '@/components/guide/dashboard-ui';
import { TourForm } from '@/components/guide/TourForm';

export default function NewTourPage() {
  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <Link
          href="/guide/dashboard/tours"
          style={{
            fontFamily: font, fontSize: 12, color: C.warmGray,
            textDecoration: 'none', letterSpacing: '0.06em',
          }}
        >
          ← Back to Soul Tours
        </Link>
      </div>
      <h1 style={{
        fontFamily: serif, fontSize: 36, fontWeight: 400, color: C.charcoal, marginBottom: 6,
      }}>
        Create a Soul Tour
      </h1>
      <p style={{
        fontFamily: font, fontSize: 13, color: C.warmGray, marginBottom: 32,
      }}>
        Design a multi-day spiritual journey. Add departure dates, day-by-day itinerary, room types, and inclusions.
      </p>

      <TourForm />
    </>
  );
}
