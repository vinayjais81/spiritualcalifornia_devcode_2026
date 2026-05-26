/**
 * Per-document version tags captured into the booking consent record
 * alongside the clickwrap acceptance.
 *
 * Bump the matching key whenever the substantive content of a legal
 * document changes (new client copy, statutory text edit, etc.). The
 * values are persisted in `BookingConsent.docVersions` so we can later
 * tell exactly which version of each policy a given customer agreed to.
 *
 * Cosmetic edits (typo fixes, link rewrites, anchor additions) do NOT
 * require a bump — only content changes that materially alter what the
 * customer is agreeing to.
 *
 * Format: ISO date (`YYYY-MM-DD`) matching the policy text's "Last
 * updated" line.
 */
export const LEGAL_DOC_VERSIONS = {
  terms: '2026-05-22',
  privacy: '2026-05-22',
  refund: '2026-05-22',
  disclosures: '2026-05-22',
} as const;

/** Verbatim clickwrap checkbox copy from the compliance spec Task 4d. */
export const CLICKWRAP_CONSENT_TEXT =
  'I have read and agree to the Terms of Service, Cancellation Policy, Privacy Policy, and Travel Disclosures.';
