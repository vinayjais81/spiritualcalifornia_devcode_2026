import Link from 'next/link';

/**
 * Legal-receipt block rendered on every tour-booking receipt surface —
 * the post-payment success view AND the seeker's dashboard tour-detail
 * page. Required by the compliance implementation spec (2026-05-22,
 * Task 5) and by California Business & Professions Code §17550.13.
 *
 * Contains the cancellation summary + the four statutory verbatim
 * paragraphs (Refund commitment / Trust account / TCRF California /
 * TCRF non-California) + the entity identity block + links to the
 * full disclosures and privacy policy.
 *
 * Statutory text is verbatim — do not paraphrase. Cancellation summary
 * uses the global Refund Policy defaults (60 / 30 / 29 days); link to
 * /refund-policy is the canonical source. Per-tour overrides on the
 * booking page take precedence at booking time and are shown by the
 * booking flow itself.
 */
export function LegalReceiptBlock() {
  return (
    <section
      aria-label="Legal receipt — California Seller of Travel disclosures"
      style={{
        marginTop: 32,
        padding: 24,
        background: '#F5F2EB',
        border: '1px solid rgba(240,120,20,0.18)',
        borderRadius: 12,
        fontFamily: "'Inter', sans-serif",
        fontSize: 12.5,
        lineHeight: 1.6,
        color: '#3A3530',
        textAlign: 'left',
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: '#F07814',
          marginBottom: 16,
        }}
      >
        Legal Receipt
      </p>

      <H>Cancellation terms</H>
      <p style={para}>
        60+ days before departure: refund of sums paid, less the non-refundable deposit and any non-recoverable
        third-party costs. 30–59 days: 50% non-refundable. 29 days or fewer: 100% non-refundable. Full terms:{' '}
        <Link href="/refund-policy" style={link}>
          Cancellation &amp; Refund Policy
        </Link>
        .
      </p>

      <H>Refund commitment</H>
      <p style={para}>
        Upon cancellation of the travel or travel services, when the passenger is not at fault and has not
        cancelled in violation of any terms and conditions previously clearly and conspicuously disclosed and
        agreed to by the passenger, all sums paid to Spiritual California Inc. for services not provided to the
        passenger will be promptly paid to the passenger, unless the passenger advises Spiritual California Inc.
        otherwise in writing.
      </p>

      <H>Trust account</H>
      <p style={para}>
        California law requires certain sellers of travel to have a trust account or bond. This business has a
        trust account.
      </p>

      <H>Travel Consumer Restitution Fund — California residents</H>
      <p style={para}>
        This transaction is covered by the California Travel Consumer Restitution Fund (TCRF) if the passenger is
        located in California at the time of payment. Eligible passengers may file a claim with the TCRF if they
        are owed a refund of more than $50 for transportation or travel services that the seller of travel failed
        to forward to the proper provider, or that were not refunded to the passenger when required. The maximum
        amount that may be paid by the TCRF to any one passenger is the total amount paid to the seller of travel
        on behalf of the passenger, to a maximum of $15,000. A claim must be filed with the TCRF within 12 months
        after the scheduled completion date of the travel. A claim must include sufficient documentation to prove
        the claim and a $35 processing fee. Claimants must agree to waive their right to other civil remedies
        against a registered participating seller of travel for matters arising out of the transaction. Claims
        may be filed with the Travel Consumer Restitution Corporation at P.O. Box 6001, Larkspur, CA 94977-6001,
        or online at{' '}
        <a href="https://www.tcrcinfo.org" target="_blank" rel="noopener noreferrer" style={link}>
          www.tcrcinfo.org
        </a>
        .
      </p>

      <H>Travel Consumer Restitution Fund — passengers residing outside California</H>
      <p style={para}>
        The California Travel Consumer Restitution Fund does not cover passengers who reside outside the State of
        California. If you are not a California resident, this transaction is not covered by the California
        Travel Consumer Restitution Fund.
      </p>

      <div
        style={{
          marginTop: 20,
          paddingTop: 16,
          borderTop: '1px solid rgba(240,120,20,0.18)',
          fontSize: 12,
          lineHeight: 1.65,
          color: '#3A3530',
        }}
      >
        <p style={{ margin: 0, fontWeight: 600 }}>Spiritual California Inc.</p>
        <p style={{ margin: '2px 0 0' }}>631 E El Camino Real, Sunnyvale, CA 94087</p>
        <p style={{ margin: '2px 0 0' }}>
          (408) 780-4722 · California Seller of Travel <strong>CST #2171340-40</strong>
        </p>
        <p style={{ margin: '8px 0 0', fontSize: 11, color: '#8A8278' }}>
          Registration as a seller of travel does not constitute approval by the State of California.
        </p>
      </div>

      <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 18 }}>
        <Link href="/disclosures" style={link}>
          Travel Disclosures →
        </Link>
        <Link href="/privacy" style={link}>
          Privacy Policy →
        </Link>
      </div>
    </section>
  );
}

// ─── Local style helpers ────────────────────────────────────────────────

const H = ({ children }: { children: React.ReactNode }) => (
  <h3
    style={{
      fontFamily: "'Playfair Display', serif",
      fontSize: 15,
      fontWeight: 500,
      color: '#3A3530',
      margin: '14px 0 6px',
      lineHeight: 1.3,
    }}
  >
    {children}
  </h3>
);

const para: React.CSSProperties = {
  margin: '0 0 10px',
};

const link: React.CSSProperties = {
  color: '#F07814',
  textDecoration: 'underline',
  fontWeight: 500,
};
