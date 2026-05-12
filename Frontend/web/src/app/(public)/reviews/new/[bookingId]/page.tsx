// Legacy route: old "review request" emails sent before reviews-v2 contained
// /reviews/new/<bookingId> (service-only). Redirect those to the polymorphic
// /reviews/new?targetType=SERVICE&transactionId=… so existing tabs still work.

import { redirect } from 'next/navigation';

export default function LegacyReviewRedirect({ params }: { params: { bookingId: string } }) {
  redirect(`/reviews/new?targetType=SERVICE&transactionId=${params.bookingId}`);
}
