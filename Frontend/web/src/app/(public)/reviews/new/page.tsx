'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { FieldLabel, FormLegend } from '@/components/forms';

type TargetType = 'SERVICE' | 'EVENT' | 'TOUR' | 'PRODUCT';

interface Eligibility {
  eligible: boolean;
  reason: string | null;
  targetType: TargetType;
  transactionId: string;
  targetEntityId: string | null;
  targetEntityName: string | null;
  guideUserId: string | null;
  guideName: string | null;
  alreadyReviewed: boolean;
}

const LABEL_BY_TYPE: Record<TargetType, { offering: string; verb: string }> = {
  SERVICE: { offering: 'session', verb: 'session' },
  EVENT: { offering: 'event', verb: 'experience' },
  TOUR: { offering: 'tour', verb: 'journey' },
  PRODUCT: { offering: 'product', verb: 'purchase' },
};

function WriteReviewInner() {
  const search = useSearchParams();
  const router = useRouter();
  const targetType = (search.get('targetType') || '').toUpperCase() as TargetType;
  const transactionId = search.get('transactionId') || '';

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
    if (!targetType || !transactionId) {
      setError('Missing review target. Please use the link from your email or dashboard.');
      setLoading(false);
      return;
    }
    api
      .get('/reviews/eligibility', { params: { targetType, transactionId } })
      .then((res) => setEligibility(res.data))
      .catch((err) => setError(err?.response?.data?.message || 'Unable to verify this purchase'))
      .finally(() => setLoading(false));
  }, [targetType, transactionId]);

  const handleSubmit = async () => {
    if (rating === 0) { setError('Please select a rating'); return; }
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/reviews', {
        targetType,
        transactionId,
        rating,
        title: title || undefined,
        body: body || undefined,
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '80px clamp(16px, 5vw, 32px)', textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: '#8A8278' }}>Checking eligibility…</div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '80px 32px', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', margin: '0 auto 24px', background: '#FEF7F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>★</div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 400, color: '#3A3530', marginBottom: 10 }}>
          Thank You for Your Review!
        </h1>
        <p style={{ fontSize: 14, color: '#8A8278', marginBottom: 32 }}>
          Your feedback helps other seekers find the right practitioner and helps {eligibility?.guideName ?? 'this guide'} improve their practice.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Link href="/seeker/dashboard" style={{ padding: '12px 24px', borderRadius: 8, border: '1.5px solid rgba(240,120,20,0.3)', background: 'transparent', fontSize: 12, fontWeight: 500, color: '#3A3530', textDecoration: 'none' }}>
            My Dashboard
          </Link>
          <Link href="/practitioners" style={{ padding: '12px 24px', borderRadius: 8, background: '#F07814', color: '#3A3530', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none' }}>
            Continue Exploring
          </Link>
        </div>
      </div>
    );
  }

  if (!eligibility?.eligible) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '80px 32px', textAlign: 'center' }}>
        <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>✦</span>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 400, color: '#3A3530', marginBottom: 10 }}>
          Unable to Review
        </h1>
        <p style={{ fontSize: 14, color: '#8A8278', marginBottom: 24 }}>
          {eligibility?.reason || error || 'This purchase is not eligible for review yet.'}
        </p>
        <button onClick={() => router.push('/seeker/dashboard')} style={{ fontSize: 12, color: '#F07814', textDecoration: 'none', background: 'none', border: 'none', cursor: 'pointer' }}>← Back to dashboard</button>
      </div>
    );
  }

  const labels = LABEL_BY_TYPE[targetType];
  const offeringName = eligibility.targetEntityName ?? labels.offering;
  const guideName = eligibility.guideName ?? 'your guide';

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px clamp(16px, 5vw, 32px) 80px' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#F07814', marginBottom: 10 }}>
          ✦ Share Your Experience
        </div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 400, color: '#3A3530', marginBottom: 8 }}>
          How was your {labels.verb}?
        </h1>
        <p style={{ fontSize: 14, color: '#8A8278' }}>
          Your review of <strong>{offeringName}</strong>{targetType !== 'PRODUCT' ? <> with <strong>{guideName}</strong></> : null} will help other seekers on their journey.
        </p>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <FormLegend />
      </div>

      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div role="group" aria-required="true" style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A8278', marginBottom: 12 }}>
          Your Rating <span aria-hidden="true" style={{ color: 'var(--color-error)' }}>*</span>
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
                color: star <= (hoverRating || rating) ? '#F07814' : '#E0DDD8',
                transition: 'color 0.15s, transform 0.15s',
                transform: star <= (hoverRating || rating) ? 'scale(1.1)' : 'scale(1)',
              }}
            >★</button>
          ))}
        </div>
        {rating > 0 && (
          <div style={{ marginTop: 8, fontSize: 13, color: '#3A3530', fontWeight: 500 }}>
            {['', 'Needs improvement', 'Fair', 'Good', 'Great', 'Exceptional'][rating]}
          </div>
        )}
      </div>

      <div style={{ background: '#fff', border: '1px solid rgba(240,120,20,0.15)', borderRadius: 12, padding: 28 }}>
        <div style={{ marginBottom: 20 }}>
          <FieldLabel htmlFor="review-title" style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A8278', marginBottom: 8, display: 'block' }}>
            Review Title
          </FieldLabel>
          <input
            id="review-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder='e.g. "Transformative experience" or "Exactly what I needed"'
            maxLength={100}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 6, border: '1.5px solid rgba(240,120,20,0.2)', background: '#F5F2EB', fontSize: 14, outline: 'none', fontFamily: "'Inter', sans-serif" }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <FieldLabel htmlFor="review-body" style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A8278', marginBottom: 8, display: 'block' }}>
            Your Experience
          </FieldLabel>
          <textarea
            id="review-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              targetType === 'PRODUCT'
                ? 'What did you think of the product? Quality, packaging, value?'
                : `What was your ${labels.verb} like? What did you appreciate most? Would you recommend ${guideName} to others?`
            }
            rows={6}
            maxLength={2000}
            style={{ width: '100%', padding: '14px', borderRadius: 6, border: '1.5px solid rgba(240,120,20,0.2)', background: '#F5F2EB', fontSize: 14, lineHeight: 1.7, outline: 'none', fontFamily: "'Inter', sans-serif", resize: 'vertical' }}
          />
          <div style={{ textAlign: 'right', fontSize: 11, color: '#8A8278', marginTop: 4 }}>
            {body.length}/2000
          </div>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 6, marginBottom: 16, background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.2)', fontSize: 13, color: '#C0392B' }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={rating === 0 || submitting}
          style={{ width: '100%', padding: 16, borderRadius: 8, background: rating === 0 ? 'rgba(240,120,20,0.3)' : '#F07814', color: '#3A3530', fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', border: 'none', cursor: rating === 0 ? 'not-allowed' : 'pointer' }}
        >
          {submitting ? 'Submitting…' : 'Submit Review'}
        </button>
      </div>

      <div style={{ marginTop: 24, padding: '16px 20px', borderRadius: 8, background: '#FEF7F0', border: '1px solid rgba(240,120,20,0.2)', fontSize: 12, color: '#3A3530', lineHeight: 1.7 }}>
        <strong style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Review Guidelines</strong>
        <ul style={{ marginTop: 8, paddingLeft: 16 }}>
          <li>Be honest and specific about your experience</li>
          <li>Focus on the {labels.verb} quality, not personal matters</li>
          <li>Reviews are moderated — abusive content will be removed</li>
          <li>Your first name and last initial will be shown</li>
        </ul>
      </div>
    </div>
  );
}

export default function WriteReviewPage() {
  return (
    <Suspense fallback={<div style={{ padding: 80, textAlign: 'center', color: '#8A8278' }}>Loading…</div>}>
      <WriteReviewInner />
    </Suspense>
  );
}
