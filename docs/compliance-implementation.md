# Compliance Implementation — Spiritual California

Tracks the work done against the **Developer Implementation Spec —
Spiritual California Compliance Wiring** (v.2026-05-22), and the
remaining items required to move the site to a live-payments production
environment.

Source spec: `docs/Spiritual California Compliance Implementation Spec _ Claude.pdf`.

## What ships in code (closed)

| Spec § | What it does | Where | Commit |
|---|---|---|---|
| 1 | Four legal pages live at `/terms`, `/privacy`, `/refund-policy`, `/disclosures` (URL renamed from `/travel-disclosures`; legacy 301-redirected). Each is CMS-backed via the `StaticPage` model and seeded from migrations. | `Backend/api/prisma/migrations/2026052[01234]*_*`, `Frontend/web/src/app/{terms,privacy,refund-policy,disclosures}/page.tsx` | seed migrations + `77e2fa3` |
| 1 | `id="dnsmpi"` anchor on Privacy §7 — survives admin edits via the `HeadingWithId` Tiptap extension. | `Frontend/web/src/components/guide/richtext/staticPageBlocks.ts`, `20260526160000_legal_quick_wins` migration | `77e2fa3` |
| 2 | Global footer compliance block: CST identity line + 6 spec-verbatim legal links (`Terms of Service / Privacy Policy / Cancellation & Refund / Travel Disclosures / Do Not Sell or Share My Personal Information / Contact`). No address / phone / email per spec. | `Frontend/web/src/components/public/layout/Footer.tsx` | `77e2fa3` |
| 3a | "Notice at Collection" panel above the personal-info form on tour booking Step 3. Always visible, not dismissible. | `Frontend/web/src/app/(public)/tours/[slug]/book/page.tsx` | `3d4c7bb` |
| 3b | "Sensitive personal information" consent block above the `healthConditions` textarea. Always visible, distinct from the field label, names the 90-day retention promise and the `privacy@` deletion address. | same | `3d4c7bb` |
| 4a | Cost-breakdown wording — replaces the misleading `Taxes & fees $0` line with `Tour package — $X · Includes all applicable taxes and fees`. | tour booking page | `92a18c5` |
| 4b | Persistent `Spiritual California Inc. · CST #2171340-40` seller-identifier line in the sticky sidebar (visible across all four booking steps). | same | `92a18c5` |
| 4c | Collapsible disclosures accordion above the clickwrap. Verbatim cancellation summary, refund commitment, trust account, TCRF, travel insurance text. Operator line is conditional — omitted when the journey record has no operator set, per spec. | `Frontend/web/src/components/public/booking/DisclosuresAccordion.tsx` | `92a18c5` |
| 4d | Single combined acceptance checkbox: `I have read and agree to the Terms of Service, Cancellation Policy, Privacy Policy, and Travel Disclosures.` Each link opens in a new tab. Pay button disabled until checked. | tour booking page | `92a18c5` |
| 4e | **The load-bearing piece.** Consent record persisted before Stripe redirect; payment intent creation gated server-side on the consent existing. Captures `acceptedAt` (server), `ip` (X-Forwarded-For with `req.ip` fallback, server), `consentText` (verbatim), `docVersions` (per-doc tags from `Frontend/web/src/lib/legalDocVersions.ts`). | `Backend/api/src/modules/soul-tours/{soul-tours.controller,soul-tours.service}.ts`, `Backend/api/src/modules/payments/payments.service.ts` (gate), `20260526170000_booking_consent` migration | `92a18c5` |
| 5 | Legal-receipt block (cancellation summary + refund commitment + trust account + TCRF California + TCRF non-California + identity block + `/disclosures` / `/privacy` links) on three surfaces: the post-payment success view, the seeker dashboard tour-detail page, and the deposit + balance receipt emails. | `Frontend/web/src/components/public/booking/LegalReceiptBlock.tsx`; `EmailService.legalReceiptHtml()` injected into `tourEmailShell` when `legalReceipt: true` | `073efc8` |
| 6 | AI Guide non-advice footer + crisis detection. Footer is verbatim from spec, on home hero / shop AI finder / `/practitioners` panel. Crisis detection runs **server-side** in `AiService` so all consumers are protected; matches return `{ crisis: true, reply: "..." }` and the frontend swaps the usual product/practitioner card for a `CrisisResourcesCard` with 988 + 911 + 741741. System prompt also strengthened with explicit "STRICT BOUNDARIES" (not a counselor/therapist/physician, does not diagnose/treat, refers crisis to 988). | `Backend/api/src/modules/ai/ai.service.ts`; `Frontend/web/src/components/public/ai/{AINonAdviceFooter,CrisisResourcesCard}.tsx` | `0a324ea` |
| 7 | Truth-in-advertising cleanups: destination filter pills now filtered to countries with ≥1 published future-departure tour (backend stats endpoint returns `countrySlugs[]`); hardcoded "4.9 Avg Rating" tile removed from `/travels` (tour reviews aren't wired yet, so any rating would be synthetic); `✦ Verified` badge is now a tooltip-bearing `<a>` linking to `/about#verified-meaning`; new "What 'Verified' means" section added to `/about` describing the 4-step verification pipeline. `Only X spots remaining` labels audited — already wired correctly to live `spotsRemaining` and properly gated. | `Backend/api/src/modules/soul-tours/soul-tours.service.ts`; `Frontend/web/src/app/(public)/travels/page.tsx`; `Frontend/web/src/components/public/shared/PractitionerCard.tsx`; `20260526180000_about_verified_meaning` migration | `5551d01` |
| §9 retention | 90-day health-field auto-purge cron. Daily 03:30 UTC. Nulls `healthConditions` + `dietaryNotes` on `TourBooking` rows whose departure ended 90+ days ago. Honored by `TOUR_TASKS_ENABLED` kill switch. | `Backend/api/src/modules/soul-tours/tour-tasks.queue.ts` | `57b990b` |

## Architectural notes worth carrying forward

### The consent record + payment gate (the legal heart)

This is what makes the cancellation policy, liability terms, and
arbitration clause enforceable against the customer.

- **Schema**: `BookingConsent` model, 1:1 with `TourBooking` (unique
  on `tourBookingId`), `onDelete: CASCADE`.
- **Capture endpoint**: `POST /soul-tours/bookings/:id/consent` —
  SEEKER role, owner-only. Idempotent upsert (re-saves on retry).
- **Frontend flow**: `handleCreateBooking` → POST `/soul-tours/book` →
  POST `/soul-tours/bookings/:id/consent` → POST
  `/payments/create-intent`. Checkbox is required to enable the
  Continue button.
- **Server-side gate**: `PaymentsService.createPaymentIntent` refuses
  to mint a Stripe intent for a `tourBookingId` with no recorded
  consent (unless `paymentType: 'BALANCE'` — balance payments act on
  an already-consented booking).
- **Why it's the legal heart**: even if the frontend is bypassed,
  Stripe payment intents cannot be minted without the consent row.

### Per-document version tags

Lives at `Frontend/web/src/lib/legalDocVersions.ts`:

```ts
export const LEGAL_DOC_VERSIONS = {
  terms: '2026-05-22',
  privacy: '2026-05-22',
  refund: '2026-05-22',
  disclosures: '2026-05-22',
} as const;
```

Bump the relevant string whenever the **substantive** content of a
legal document changes. Cosmetic edits (typo fixes, link rewrites,
anchor additions) do NOT require a bump.

### Tour-only scope (deliberate)

The clickwrap consent capture and the legal-receipt block are
**tour-only** in v1. Per the spec — only tour bookings invoke the
California Seller-of-Travel statutory text. Event ticket purchases
and shop product orders are not subject to those rules and have
their own (lighter) consent surface today (Terms accepted at
account creation).

If the policy team later decides events/shop purchases also need
explicit clickwrap, the model and gate generalize: pass
`{ orderId | ticketPurchaseId }` to the consent endpoint and adapt
the payment-intent gate.

### Crisis detection is server-side

`CRISIS_PATTERNS` lives in `AiService`. Any consumer of `/ai/chat`,
`/ai/product-finder`, or `/ai/practitioner-match` — current frontend,
future mobile app, third-party — gets the same protection.

To expand coverage, **add patterns** to the array. Don't relax
existing ones. False positives are inconvenient; false negatives
are not.

### Tiptap can preserve custom markup

The admin static-page editor (`/admin/static-pages`) ships with
custom Tiptap nodes for the `.pillar` and `.steps-box` card layouts
used by `/mission`, plus a `HeadingWithId` extension that preserves
`id="…"` on headings — both ride the same `staticPageBlocks` flag.
Editing those pages and saving will **not** strip the rich markup.
See `Frontend/web/src/components/guide/richtext/staticPageBlocks.ts`
and `docs/legal-pages-cms.md`.

## Deferrals (intentional, not gaps)

| Item | Why deferred | Trigger to revisit |
|---|---|---|
| Spec Task 8 — provider line / advisory block / visa note on tour pages | No real tours published yet | When the first real journey is published |
| Non-English tour page labels | No published tours, no `language` field on `SoulTour` | When the first non-English journey is published — add `language String? @default('en')` and surface "Conducted in {language}" |
| Reinstate "Avg Rating" tile on `/travels` | No tour-review system yet | When tour reviews wire up — return `avgRating + reviewCount` from stats endpoint, render inline sample size ("4.9 · based on N reviews") |
| Clickwrap for event ticket / shop product purchases | Spec is tour-only per CST law | If owner/legal team determines wider scope is needed |

---

# 🚀 Production launch checklist

Run through this before flipping live payments on.

## Owner-side (manual — cannot be done in code)

- [ ] **Set the `$[ADMIN FEE]` per-person non-refundable administrative
  fee** in Refund Policy §2. Open `/admin/static-pages` → Cancellation
  & Refund Policy → find `$[ADMIN FEE]` in the body → replace with the
  real number (industry norm is $150–300/person per the spec). Save.
  ISR refreshes within 5 minutes.
- [ ] **Confirm the `privacy@spiritualcalifornia.com` mailbox**
  exists, is monitored, and routes to the responsible person. Send a
  test email from outside the org and confirm receipt.
- [ ] **California travel-industry attorney review** of the five
  documents (Terms, Privacy, Refund, Disclosures, plus any per-tour
  Participant Agreement when those land). Capture sign-off.
- [ ] **Update `LEGAL_DOC_VERSIONS`** at
  `Frontend/web/src/lib/legalDocVersions.ts` to whatever date the
  attorney-approved versions carry, then redeploy. This ensures
  consent records reference the legally reviewed versions.
- [ ] **Verify CST registration is current and the public-facing
  number `CST #2171340-40`** is what the State has on file.
- [ ] **Confirm the trust-account claim** is accurate at the time of
  launch. The legal-receipt block + footer assert *"This business has
  a trust account"* — that must be true.

## Production environment configuration

- [ ] `DATABASE_URL` points to the production Postgres
- [ ] `STRIPE_SECRET_KEY` is a **live** key (not `sk_test_…`)
- [ ] `STRIPE_WEBHOOK_SECRET` matches the live webhook endpoint
- [ ] `STRIPE_PLATFORM_COMMISSION_PERCENT` is the agreed live rate
- [ ] `RESEND_API_KEY` is the live key and `EMAIL_FROM` is verified
- [ ] `FRONTEND_URL` matches the production domain (used in receipt
  emails for `/disclosures`, `/privacy`, `/refund-policy` links and
  in claim-invite emails for `/guide/claim`)
- [ ] `JWT_ACCESS_SECRET` + `JWT_REFRESH_SECRET` are unique 32+ char
  secrets (not the dev defaults)
- [ ] `TOUR_TASKS_ENABLED` is unset or `true` (so the 90-day
  health-info purge job actually runs)
- [ ] `LEDGER_V2_ENABLED` — verify against the payouts v2 cutover
  plan in `docs/guide-payouts-v2.md`
- [ ] `TEST_ACCOUNT_EMAIL_DOMAIN` — only set if you want a different
  test domain from `scprelaunch.test`; otherwise leave unset
- [ ] Redis is reachable from the API host (`REDIS_HOST`, `REDIS_PORT`,
  optional `REDIS_PASSWORD`) — BullMQ won't start otherwise and the
  health-info purge won't run
- [ ] All Prisma migrations applied (`npx prisma migrate deploy`)
- [ ] CMS rows present for: `terms`, `privacy`, `refund-policy`,
  `travel-disclosures` (the disclosures slug stays `travel-disclosures`
  even though the public URL is `/disclosures`), `about`, `mission`
- [ ] `BookingConsent` table exists (`booking_consents`)
- [ ] `booking_consents_tourBookingId_key` unique index exists

## End-to-end pre-launch verification

Do all of these on a non-prod tour before flipping live payments:

- [ ] **Footer**: every public page shows the CST identity line + 6
  legal links. Address / phone / email do NOT appear.
- [ ] **`/privacy#dnsmpi`**: clicking the "Do Not Sell or Share"
  footer link scrolls to §7. (Test in Chrome + Safari.)
- [ ] **`/travel-disclosures`** returns a 301 redirect to
  `/disclosures` (curl `-I` to verify).
- [ ] **Booking Step 3**: load the tour booking page, advance to
  step 3 → both the "Notice at Collection" panel and the "Sensitive
  personal information" consent block render above the relevant
  fields.
- [ ] **Booking Step 4 — cost breakdown**: no `$0 taxes` line.
  Tour package shows `Includes all applicable taxes and fees`.
- [ ] **Booking Step 4 — sidebar**: `Spiritual California Inc. ·
  CST #2171340-40` appears at the bottom of the sticky sidebar.
- [ ] **Booking Step 4 — disclosures**: accordion opens in-place
  with all six blocks (cancellation summary / refund commitment /
  trust account / TCRF / travel insurance / operator-when-set).
- [ ] **Booking Step 4 — clickwrap**: button stays disabled until
  the checkbox is ticked. Each link opens in a new tab.
- [ ] **Consent record persisted**: after clicking Continue, query
  `SELECT * FROM booking_consents WHERE "tourBookingId" = '…'` →
  verify `acceptedAt`, `ip`, `consentText`, `docVersions` are all
  populated.
- [ ] **Payment gate (server-side)**: with a real `tourBookingId`,
  curl `POST /payments/create-intent` for that booking BEFORE
  posting consent → expect 400 with message "Booking has no
  recorded consent…". Then post the consent and retry → success.
- [ ] **Receipt email**: complete a test deposit payment → confirm
  the deposit-confirmation email arrives → confirm it carries the
  legal-receipt block (entity / address / phone / CST # / refund
  commitment / trust account / TCRF California / TCRF non-California
  / `/disclosures` + `/privacy` links).
- [ ] **Confirmation page**: same as above renders on the post-payment
  success view in the browser.
- [ ] **Dashboard tour detail**: revisit
  `/seeker/dashboard/tours/[id]` later → legal-receipt block
  still renders below the booking summary.
- [ ] **AI Guide footer**: home hero, shop AI finder, and
  `/practitioners` AI panel all show the persistent non-advice
  disclaimer.
- [ ] **Crisis detection**: type `"I want to kill myself"` in the
  home hero → arrives on `/practitioners` → instead of practitioner
  matches, the **Crisis Support** card renders with 988 / 911 /
  741741 links. Test with `"feeling overwhelmed"` (non-crisis) →
  normal AI response. Logs show `[crisis-detect]` warn line for the
  positive case only.
- [ ] **Verified badge**: hover the `✦ Verified` badge on a guide
  card → tooltip text appears → clicking opens
  `/about#verified-meaning` and scrolls to the section.
- [ ] **Destination pills**: `/travels` only shows pills for
  countries that have a published, future-departure tour. "All
  Countries" always shown.
- [ ] **Health-info purge**: insert a test row with
  `departure.endDate` 100 days ago and `healthConditions = 'test'`
  → wait for 03:30 UTC or trigger manually → confirm field is
  nulled and the log line `[Queue] health-info-purge:` appears.

## Stripe go-live

Flip live payments on **only after** every item above is checked.

- [ ] Stripe Connect onboarding link works for new guides
- [ ] Test a real $1 deposit on a non-public tour to verify the
  end-to-end Stripe flow with live keys
- [ ] Confirm webhook delivery: a real payment fires
  `payment_intent.succeeded` and the booking transitions to
  `DEPOSIT_PAID` automatically
- [ ] Confirm payouts: a paid booking eventually settles into the
  guide's connected account per the configured commission rate

## Post-launch monitoring (first 30 days)

- [ ] Watch for `[crisis-detect]` warn lines in API logs — any spike
  warrants human review of what triggered (false positives →
  tighten patterns; misses → add patterns)
- [ ] Watch for `[Queue] health-info-purge: nulled …` lines —
  expected daily, zero is fine but a sudden spike suggests an
  upstream change
- [ ] Watch for any 400 from `POST /payments/create-intent` with
  "Booking has no recorded consent" — should be zero in normal
  flow; non-zero means the frontend is bypassing the consent step
- [ ] Monitor admin edits to `/admin/static-pages` for the legal
  pages — any change that materially alters what customers agreed
  to should be paired with a `LEGAL_DOC_VERSIONS` bump

---

## Reference

- Source spec: `docs/Spiritual California Compliance Implementation Spec _ Claude.pdf`
- Related: `docs/legal-pages-cms.md` (CMS pattern for legal pages)
- Related: `docs/test-account-conversion.md` (admin → real-email conversion)
- Schema reference: `Backend/api/prisma/schema.prisma` (search for
  `BookingConsent` and `StaticPage`)
- All compliance migrations: `Backend/api/prisma/migrations/2026052*`
