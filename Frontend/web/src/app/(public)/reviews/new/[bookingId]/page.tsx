'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Eligibility {
  eligible: boolean;
  reason: string | null;
  booking: {
    id: string;
    status: string;
    guideName: string;
    guideUserId: string;
    alreadyReviewed: boolean;
  };
}

export default function WriteReviewPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = params.bookingId as string;

  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    const check = async () => {
      try {
        const res = await api.get(`/reviews/eligibility/${bookingId}`);
        setEligibility(res.data);
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Unable to verify booking');
      } finally {
        setLoading(false);
      }
    };
    check();
  }, [bookingId]);

  const handleSubmit = async () => {
    if (rating === 0) { setError('Please select a rating'); return; }
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/reviews', { bookingId, rating, title: title || undefined, body: body || undefined });
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '80px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: '#8A8278' }}>Checking eligibility...</div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '80px 32px', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', margin: '0 auto 24px', background: '#FDF6E3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
          ⭐
        </div>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 400, color: '#3A3530', marginBottom: 10 }}>
          Thank You for Your Review!
        </h1>
        <p style={{ fontSize: 14, color: '#8A8278', marginBottom: 32 }}>
          Your feedback helps other seekers find the right practitioner and helps {eligibility?.booking.guideName} improve their practice.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Link href="/bookings" style={{
            padding: '12px 24px', borderRadius: 8, border: '1.5px solid rgba(232,184,75,0.3)',
            background: 'transparent', fontSize: 12, fontWeight: 500, color: '#3A3530', textDecoration: 'none',
          }}>
            My Bookings
          </Link>
          <Link href="/shop" style={{
            padding: '12px 24px', borderRadius: 8, background: '#E8B84B', color: '#3A3530',
            fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none',
          }}>
            Continue Exploring
          </Link>
        </div>
      </div>
    );
  }

  if (!eligibility?.eligible) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '80px 32px', textAlign: 'center' }}>
        <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>🚫</span>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 400, color: '#3A3530', marginBottom: 10 }}>
          Unable to Review
        </h1>
        <p style={{ fontSize: 14, color: '#8A8278', marginBottom: 24 }}>
          {eligibility?.reason || error || 'This booking is not eligible for review.'}
        </p>
        <Link href="/" style={{ fontSize: 12, color: '#E8B84B', textDecoration: 'none' }}>← Back to home</Link>
      </div>
    );
  }

  const guideName = eligibility.booking.guideName;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 32px 80px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#E8B84B', marginBottom: 10 }}>
          ✦ Share Your Experience
        </div>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 400, color: '#3A3530', marginBottom: 8 }}>
          How was your session?
        </h1>
        <p style={{ fontSize: 14, color: '#8A8278' }}>
          Your review of <strong>{guideName}</strong> will help other seekers on their journey.
        </p>
      </div>

      {/* Rating Stars */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A8278', marginBottom: 12 }}>
          Your Rating
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              style={{
                fontSize: 36, background: 'none', border: 'none', cursor: 'pointer',
                color: star <= (hoverRating || rating) ? '#E8B84B' : '#E0DDD8',
                transition: 'color 0.15s, transform 0.15s',
                transform: star <= (hoverRating || rating) ? 'scale(1.1)' : 'scale(1)',
              }}
            >
              ★
            </button>
          ))}
        </div>
        {rating > 0 && (
          <div style={{ marginTop: 8, fontSize: 13, color: '#3A3530', fontWeight: 500 }}>
            {['', 'Needs improvement', 'Fair', 'Good', 'Great', 'Exceptional'][rating]}
          </div>
        )}
      </div>

      {/* Review Form */}
      <div style={{
        background: '#fff', border: '1px solid rgba(232,184,75,0.15)',
        borderRadius: 12, padding: 28,
      }}>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A8278', marginBottom: 8, display: 'block' }}>
            Review Title (optional)
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder='e.g. "Transformative experience" or "Exactly what I needed"'
            maxLength={100}
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 6,
              border: '1.5px solid rgba(232,184,75,0.2)', background: '#FAFAF7',
              fontSize: 14, outline: 'none', fontFamily: "'Inter', sans-serif",
            }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A8278', marginBottom: 8, display: 'block' }}>
            Your Experience
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What was your session like? What did you appreciate most? Would you recommend this practitioner to others?"
            rows={6}
            maxLength={2000}
            style={{
              width: '100%', padding: '14px', borderRadius: 6,
              border: '1.5px solid rgba(232,184,75,0.2)', background: '#FAFAF7',
              fontSize: 14, lineHeight: 1.7, outline: 'none', fontFamily: "'Inter', sans-serif",
              resize: 'vertical',
            }}
          />
          <div style={{ textAlign: 'right', fontSize: 11, color: '#8A8278', marginTop: 4 }}>
            {body.length}/2000
          </div>
        </div>

        {error && (
          <div style={{
            padding: '10px 14px', borderRadius: 6, marginBottom: 16,
            background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.2)',
            fontSize: 13, color: '#C0392B',
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={rating === 0 || submitting}
          style={{
            width: '100%', padding: 16, borderRadius: 8,
            background: rating === 0 ? 'rgba(232,184,75,0.3)' : '#E8B84B',
            color: '#3A3530',
            fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
            border: 'none', cursor: rating === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Submitting...' : 'Submit Review'}
        </button>
      </div>

      {/* Guidelines */}
      <div style={{
        marginTop: 24, padding: '16px 20px', borderRadius: 8,
        background: '#FDF6E3', border: '1px solid rgba(232,184,75,0.2)',
        fontSize: 12, color: '#3A3530', lineHeight: 1.7,
      }}>
        <strong style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Review Guidelines</strong>
        <ul style={{ marginTop: 8, paddingLeft: 16 }}>
          <li>Be honest and specific about your experience</li>
          <li>Focus on the session quality, not personal matters</li>
          <li>Reviews are moderated — abusive content will be removed</li>
          <li>Your name will be shown with your review</li>
        </ul>
      </div>
    </div>
  );
}
