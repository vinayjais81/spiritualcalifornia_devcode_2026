interface Review {
  id: string;
  authorName: string;
  rating: number;
  body: string;
  date: string;
  verified?: boolean;
}

interface ReviewsSectionProps {
  reviews: Review[];
  averageRating: number;
  totalReviews: number;
  columns?: 2 | 3;
}

export function ReviewsSection({ reviews, averageRating, totalReviews, columns = 3 }: ReviewsSectionProps) {
  const stars = (rating: number) => '★'.repeat(rating) + '☆'.repeat(5 - rating);

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto', padding: '0 60px 80px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <div style={{
            fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase',
            color: '#E8B84B', marginBottom: 12,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            Reviews
            <span style={{ flex: 1, height: 1, background: 'rgba(232,184,75,0.25)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            {columns === 2 && (
              <span style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 64, fontWeight: 300, color: '#3A3530',
              }}>
                {averageRating.toFixed(1)}
              </span>
            )}
            <div>
              <div style={{ color: '#E8B84B', fontSize: columns === 2 ? 20 : 14, marginBottom: 4 }}>
                {stars(Math.round(averageRating))}
              </div>
              <span style={{ fontSize: 13, color: '#8A8278' }}>
                {totalReviews} review{totalReviews !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Review grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: columns === 2 ? 28 : 24,
      }}>
        {reviews.map((review) => (
          <div key={review.id} style={{
            background: '#fff', border: '1px solid rgba(232,184,75,0.1)',
            borderRadius: 12, padding: 24,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: '#FDF6E3', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontWeight: 600, color: '#E8B84B',
              }}>
                {review.authorName.split(' ').map(w => w[0]).join('').slice(0, 2)}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#3A3530' }}>{review.authorName}</div>
                <div style={{ fontSize: 11, color: '#8A8278' }}>
                  {review.verified && 'Verified purchase · '}{review.date}
                </div>
              </div>
            </div>
            <div style={{ color: '#E8B84B', fontSize: 12, marginBottom: 8 }}>
              {stars(review.rating)}
            </div>
            <p style={{ fontSize: 13, color: '#3A3530', lineHeight: 1.7, fontStyle: 'italic' }}>
              &ldquo;{review.body}&rdquo;
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
