'use client';

import { useState } from 'react';
import Link from 'next/link';

/**
 * Disclosures accordion shown on tour-booking Step 4 above the clickwrap
 * checkbox. Required by the compliance implementation spec
 * (2026-05-22, Task 4c).
 *
 * Contents are statutory + verbatim where quoted. The accordion is
 * collapsed by default but the content lives on the page — the spec
 * requires it to be openable in place, not behind a link to another
 * route.
 *
 * `operator` is optional. The spec says "until real tours with named
 * operators exist, omit that single line (don't show a placeholder to
 * customers)." Pass an operator name + country when the journey record
 * has one; omit otherwise.
 */
export function DisclosuresAccordion({
  operator,
}: {
  operator?: { name: string; country: string };
}) {
  const [open, setOpen] = useState(false);

  return (
    <section
      style={{
        border: '1px solid rgba(240,120,20,0.3)',
        borderRadius: 10,
        background: '#FFFFFF',
        marginBottom: 16,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="disclosures-content"
        style={{
          width: '100%',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: "'Inter', sans-serif",
          fontSize: 13,
          fontWeight: 600,
          color: '#3A3530',
          letterSpacing: '0.02em',
        }}
      >
        <span>Travel Disclosures &amp; Cancellation Terms</span>
        <span
          style={{
            fontSize: 12,
            color: '#8A8278',
            transition: 'transform 0.2s',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          id="disclosures-content"
          style={{
            padding: '0 18px 16px',
            borderTop: '1px solid rgba(240,120,20,0.15)',
            fontFamily: "'Inter', sans-serif",
            fontSize: 12.5,
            lineHeight: 1.65,
            color: '#3A3530',
          }}
        >
          <DLabel>Cancellation summary</DLabel>
          <DText>
            Cancel 60+ days before departure: refund of sums paid, less the non-refundable deposit and any
            non-recoverable third-party costs. 30–59 days: 50% non-refundable. 29 days or fewer: 100% non-refundable.
            Full terms:{' '}
            <DLink href="/refund-policy">Cancellation &amp; Refund Policy</DLink>.
          </DText>

          <DLabel>Refund commitment</DLabel>
          <DText>
            Upon cancellation of the travel or travel services, when the passenger is not at fault and has not
            cancelled in violation of any terms previously clearly and conspicuously disclosed and agreed to by the
            passenger, all sums paid to Spiritual California Inc. for services not provided to the passenger will be
            promptly paid to the passenger, unless the passenger advises Spiritual California Inc. otherwise in
            writing.
          </DText>

          <DLabel>Trust account</DLabel>
          <DText>
            California law requires certain sellers of travel to have a trust account or bond. This business has a
            trust account.
          </DText>

          <DLabel>Travel Consumer Restitution Fund</DLabel>
          <DText>
            This transaction is covered by the California Travel Consumer Restitution Fund (TCRF) if the passenger
            is located in California at the time of payment. The TCRF does not cover passengers who reside outside
            California. Full text:{' '}
            <DLink href="/disclosures">Travel Disclosures</DLink>.
          </DText>

          <DLabel>Travel insurance</DLabel>
          <DText>
            We strongly recommend trip cancellation and medical insurance. Spiritual California does not sell
            insurance and is not a licensed insurance agent.
          </DText>

          {operator && (
            <>
              <DLabel>Operator</DLabel>
              <DText>
                This journey is operated by <strong>{operator.name}</strong> ({operator.country}). Spiritual
                California Inc. acts as agent and is not responsible for the operator's conduct; see the{' '}
                <DLink href="/terms">Terms of Service</DLink>.
              </DText>
            </>
          )}
        </div>
      )}
    </section>
  );
}

// ─── Local style helpers ────────────────────────────────────────────────

function DLabel({ children }: { children: React.ReactNode }) {
  return (
    <h4
      style={{
        fontFamily: "'Playfair Display', serif",
        fontSize: 14,
        fontWeight: 600,
        color: '#3A3530',
        margin: '14px 0 4px',
        lineHeight: 1.3,
      }}
    >
      {children}
    </h4>
  );
}

function DText({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: '0 0 6px' }}>{children}</p>;
}

function DLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: '#F07814', textDecoration: 'underline' }}
    >
      {children}
    </Link>
  );
}
