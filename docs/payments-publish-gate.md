# Payments Publish Gate — Stripe Connect required before publishing paid offerings

**Status:** Proposal (locked decisions, ready for implementation)
**Drafted:** 2026-05-01
**Owner:** Payments / Marketplace Ops
**Companion to:** [`guide-payouts-v2.md`](./guide-payouts-v2.md), [`guide-deferred-onboarding.md`](./guide-deferred-onboarding.md), [`seeker-guide-role-mutex.md`](./seeker-guide-role-mutex.md)

---

## 1. Why this is needed

Spiritual California has three independent identity / capability gates a guide passes through:

| Gate | Question | Owned by | DB flag |
|---|---|---|---|
| **Identity verification** | Is this person real? | Persona API | `verificationStatus = APPROVED` |
| **Credential verification** | Are they qualified? | Internal admin queue (Textract + Claude) | `isVerified = true` |
| **Payment receipt capability** | Can they receive money? | Stripe Connect Express | `stripeOnboardingDone = true` AND `payoutAccount.payoutsEnabled = true` |

Today the **third gate is decoupled from publishing.** A guide can be `isVerified=true` and publish paid services / events / tours / products without ever onboarding to Stripe Connect. When a seeker pays, `confirmPayment` falls through to a non-Connect path — money lands in the platform's Stripe balance with the guide's cached `availableBalance` incrementing, but the guide can't withdraw until they set Connect up.

This causes four real problems:

1. **Frustrating post-earning friction.** Guides see "$X available" on their dashboard but can't claim it. They had to discover Stripe Connect *after* earning, which feels punitive.
2. **Stranded liability.** If a guide never sets up Stripe, their balance accrues forever as platform liability. We currently have no mechanism to unwind it.
3. **Tax compliance gap.** Stripe issues 1099-NEC at year-end based on the connected account's earnings — but only for guides who had Connect set up *during* the year. A guide who earns in March and onboards in November may not get a clean 1099 for their March earnings.
4. **Marketplace trust signal is wrong.** A "verified" guide on the public profile page implies bookings will be smooth — but the guide may not even be able to receive payment yet.

**Option B** (per the Stripe Connect onboarding analysis) closes the loop: build the verified profile freely, but require Stripe Connect before publishing anything that takes a payment.

---

## 2. Locked decisions

| # | Decision | Value |
|---|---|---|
| 1 | Free offerings are exempt | Services / events with `price = 0` (and event tiers all `price = 0`) bypass the gate |
| 2 | Already-published paid offerings are NOT retroactively unpublished | The gate fires on **transition to published**, not on existing published state. Stripe disabling payouts mid-flight does not auto-unpublish. |
| 3 | Blog posts and free-tier content (chat, profile page) are exempt | They don't take payment |
| 4 | The check is two-prong | `stripeOnboardingDone = true` AND `payoutAccount.payoutsEnabled = true`. Both required. (Stripe can disable `payouts_enabled` post-onboarding.) |
| 5 | Single source of truth | One backend helper `canPublishPaidOffering(guideId)` used by every publish endpoint |
| 6 | Friendly UX, not 403 | Publish action returns a structured response the UI can render as a modal with a CTA, not a generic error toast |
| 7 | Completeness widget surfaces it | "Payments" chip on `/guide/dashboard` next to Identity, Credentials, etc. — same shape as those |

---

## 3. Three-state model

```
       ┌───────────────────────────────────────────────────┐
       │  STATE 1 — Just registered                        │
       │  ── browse, build profile draft                   │
       │  ── CAN'T publish anything (verification gate)    │
       └────────────────────────┬──────────────────────────┘
                                │  Persona + admin verify credentials
                                ▼
       ┌───────────────────────────────────────────────────┐
       │  STATE 2 — Verified (isVerified=true)             │
       │  ── PUBLIC PROFILE goes live                      │
       │  ── publish FREE services, free events, blog      │
       │  ── CAN'T publish paid offerings   ★ NEW GATE     │
       └────────────────────────┬──────────────────────────┘
                                │  + Stripe Connect Express
                                ▼
       ┌───────────────────────────────────────────────────┐
       │  STATE 3 — Fully onboarded                        │
       │  ── publish PAID services / events / tours / prod │
       │  ── earnings flow into ledger                     │
       │  ── claim payouts ($50 min, manual)               │
       └───────────────────────────────────────────────────┘
```

State 2 → State 3 is what this spec adds.

---

## 4. The gate, per offering type

Each publish action evaluates in two steps:

**Step 1: Is this a paid offering?**

| Offering | Schema | "Paid" if |
|---|---|---|
| `Service` | `Service.price Decimal` | `price > 0` |
| `Event` | `EventTicketTier[].price` | any **active** tier has `price > 0` |
| `SoulTour` | `SoulTour.basePrice Decimal` | `basePrice > 0` |
| `Product` | `Product.price Decimal` (variants can override) | `price > 0` (variant override considered if set) |

**Step 2: If paid, does the guide pass the payment-receipt gate?**

```ts
canPublishPaidOffering(guideId): {
  allowed: boolean;
  reason?: 'no-stripe-account' | 'onboarding-incomplete' | 'payouts-disabled';
  stripeOnboardingDone: boolean;
  payoutsEnabled: boolean;
  ctaUrl: '/guide/dashboard/earnings';   // where to send the guide
}
```

Endpoints called when a guide flips an offering from unpublished → published (or creates a new offering with `isPublished=true` / `isActive=true`):

| Action | Endpoint | New behavior |
|---|---|---|
| Publish a service | `PATCH /services/:id` (when `isActive: true → true` is being **set** for the first time, or on creation) | Call `canPublishPaidOffering` if `price > 0`; reject 403 with structured payload if blocked |
| Publish an event | `PATCH /events/:id/publish` | Same |
| Publish a tour | `PATCH /soul-tours/:id` (or dedicated `/publish` route) | Same |
| Publish a product | `PATCH /products/:id` | Same |

The gate is at the **publish boundary**, not the read boundary. Reading offerings, drafting them, editing pricing — all unaffected.

### What "publishing" means per type

- **Service**: `isActive = true`. The marketplace search query already filters by `isActive`, so this is equivalent to "visible to seekers."
- **Event**: `isPublished = true`. Same.
- **SoulTour**: `isPublished = true`. Same.
- **Product**: `isActive = true`. Note: products default to `isActive = true` at creation — the gate must fire on **create** as well as on the rare "republish a previously deactivated product" transition.

---

## 5. Backend design

### 5.1 The helper

```ts
// PaymentsService.canPublishPaidOffering
async canPublishPaidOffering(guideId: string): Promise<{
  allowed: boolean;
  reason?: 'no-stripe-account' | 'onboarding-incomplete' | 'payouts-disabled';
  stripeOnboardingDone: boolean;
  payoutsEnabled: boolean;
  ctaUrl: string;
}> {
  const guide = await this.prisma.guideProfile.findUnique({
    where: { id: guideId },
    select: { stripeAccountId: true, stripeOnboardingDone: true },
  });
  const account = await this.prisma.payoutAccount.findUnique({
    where: { guideId },
    select: { payoutsEnabled: true },
  });

  const ctaUrl = `${this.config.get('FRONTEND_URL')}/guide/dashboard/earnings`;
  const stripeOnboardingDone = !!guide?.stripeOnboardingDone;
  const payoutsEnabled = !!account?.payoutsEnabled;

  if (!guide?.stripeAccountId) {
    return { allowed: false, reason: 'no-stripe-account', stripeOnboardingDone, payoutsEnabled, ctaUrl };
  }
  if (!stripeOnboardingDone) {
    return { allowed: false, reason: 'onboarding-incomplete', stripeOnboardingDone, payoutsEnabled, ctaUrl };
  }
  if (!payoutsEnabled) {
    return { allowed: false, reason: 'payouts-disabled', stripeOnboardingDone, payoutsEnabled, ctaUrl };
  }
  return { allowed: true, stripeOnboardingDone: true, payoutsEnabled: true, ctaUrl };
}
```

### 5.2 The structured 403 response

When a publish action is blocked, the backend throws a `ForbiddenException` with a structured body:

```json
{
  "statusCode": 403,
  "error": "PAYMENT_GATE_BLOCKED",
  "message": "Set up payment receipt before publishing a paid offering.",
  "reason": "onboarding-incomplete",
  "ctaUrl": "https://spiritualcalifornia.nityo.in/guide/dashboard/earnings",
  "ctaLabel": "Set Up Payments"
}
```

The frontend's axios interceptor catches `error === 'PAYMENT_GATE_BLOCKED'` and shows a modal instead of a generic toast. (Falls back to a toast if the modal can't render.)

### 5.3 Wiring per service

Each service-layer publish method runs this check before flipping the flag:

```ts
// Pattern, applied across services/events/tours/products:
async publish(input: { id: string; userId: string }) {
  const guideId = await this.resolveGuideId(input.userId);
  const offering = await this.prisma.X.findUnique({ where: { id: input.id } });
  if (!offering || offering.guideId !== guideId) throw new NotFoundException();

  const isPaid = await this.isPaidOffering(offering); // type-specific
  if (isPaid) {
    const gate = await this.payments.canPublishPaidOffering(guideId);
    if (!gate.allowed) {
      throw new ForbiddenException({
        error: 'PAYMENT_GATE_BLOCKED',
        message: 'Set up payment receipt before publishing a paid offering.',
        reason: gate.reason,
        ctaUrl: gate.ctaUrl,
        ctaLabel: 'Set Up Payments',
      });
    }
  }
  return this.prisma.X.update({ where: { id: input.id }, data: { isPublished: true } });
}
```

---

## 6. Frontend design

### 6.1 Payments chip on the completeness widget

`GuideProfileCompletenessWidget` already exists with chips for Profile / Identity / Credentials / Services. Adding a 5th chip:

| State | Visual | CTA |
|---|---|---|
| Not started (`stripeAccountId` is null) | Gray dot + "Payments — Not started" | "Set Up Payments" → `/guide/dashboard/earnings` |
| In progress (`stripeAccountId` set, `stripeOnboardingDone = false`) | Amber dot + "Payments — Continue Stripe onboarding" | "Resume" → triggers `connect/onboard` (which creates a fresh link for the existing account) |
| Stripe disabled payouts (`stripeOnboardingDone = true`, `payoutsEnabled = false`) | Amber dot + "Payments — Action required by Stripe" | "Open Stripe Dashboard" → deep-link |
| Complete (both flags true) | Green dot + "Payments — Complete" | none / "Manage" deep-link |

Data source: existing `GET /payments/connect/status` already returns `connected/chargesEnabled/payoutsEnabled/detailsSubmitted`. Widget reads that.

### 6.2 The publish-blocked modal

When a publish API call returns `403 { error: 'PAYMENT_GATE_BLOCKED' }`, show a modal:

```
┌────────────────────────────────────────────────┐
│   Payments setup needed                        │
│                                                │
│   Before you can publish a paid offering,      │
│   you need to set up how you'll receive        │
│   payments.                                    │
│                                                │
│   This is a one-time, ~5-minute step that      │
│   collects your bank account and tax info      │
│   securely through Stripe.                     │
│                                                │
│   Your offering is saved as a draft.           │
│   Come back to publish it after Stripe         │
│   onboarding finishes.                         │
│                                                │
│        [ Maybe later ]   [ Set Up Payments ]   │
└────────────────────────────────────────────────┘
```

[Set Up Payments] navigates to `/guide/dashboard/earnings`.

The modal is a shared component, used by every publish action that can hit this gate.

### 6.3 Where the modal mounts

| UI | File (existing) | Where the publish action lives |
|---|---|---|
| Service editor | `Frontend/web/src/app/guide/dashboard/services/...` | "Publish" toggle / save button |
| Event editor | `Frontend/web/src/app/guide/dashboard/events/...` | "Publish" button |
| Tour editor | `Frontend/web/src/app/guide/dashboard/tours/...` | "Publish" button |
| Product editor | `Frontend/web/src/app/guide/dashboard/products/...` | Save (since products auto-active) |

Each catch-block on the publish mutation calls the shared `PaymentsGateModal.open(error)` helper.

---

## 7. Edge cases & how they're handled

| Case | v1 behavior | v2 (this spec) behavior |
|---|---|---|
| Free service (`price = 0`) | publishable | publishable, gate skipped |
| Event with mix of free + paid tiers | publishable | gate fires (any tier > 0 → paid) |
| Guide already has paid offering published, then Stripe disables `payouts_enabled` | nothing happens | offering stays published; new bookings still flow through `confirmPayment`'s non-Connect fallback into platform balance; guide can't claim until they fix Stripe — same as today, no auto-unpublish |
| Guide tries to publish service with `price = 0`, then later raises price | first publish succeeds; later edit doesn't re-gate | first publish succeeds (free); raising price on a published service triggers the gate via the same publish helper, applied to PATCH endpoints (the gate fires on the *update* if it would result in a published+paid state) |
| Guide creates a paid product (auto-active) without Stripe | product is live, takes payments to platform balance | create endpoint returns 403 PAYMENT_GATE_BLOCKED; product saves as `isActive = false` (draft) so the guide can fix and retry |
| Admin force-publishes on guide's behalf | not differentiated | admin endpoints bypass the gate (RBAC: ADMIN/SUPER_ADMIN), with audit log entry |
| Existing published offerings before this gate was added | stay published | stay published — gate is on transition only |
| Guide deletes their Stripe account | impossible (Stripe Connect doesn't permit destructive deletion of a connected account with history) | not handled |

---

## 8. Implementation phases

| Phase | Scope | Effort |
|---|---|---|
| **G1** | `canPublishPaidOffering(guideId)` helper in `PaymentsService`; export from module | 0.5h |
| **G2** | Wire helper into Service publish path (`isActive` flip) + per-type "isPaid" detection | 1h |
| **G3** | Wire into Event publish path | 0.5h |
| **G4** | Wire into Tour publish path | 0.5h |
| **G5** | Wire into Product create / publish path (since products default active) | 1h |
| **G6** | Frontend: `PaymentsGateModal` shared component + axios interceptor for `PAYMENT_GATE_BLOCKED` | 2h |
| **G7** | Frontend: Payments chip on `GuideProfileCompletenessWidget` (4 states) | 1.5h |
| **G8** | Frontend: hook the modal into Service / Event / Tour / Product publish UIs | 1h |
| **G9** | Manual smoke test in dev: free service publishes, paid service blocks, modal renders, after Stripe completes paid service publishes | 1h |

**Total:** ~9 hours of focused dev. Ship as a single PR — internally cohesive, no external dependency.

---

## 9. Files to be created or modified

### Backend new
- (none — all changes are additions to existing services)

### Backend modified
- `src/modules/payments/payments.service.ts` — add `canPublishPaidOffering(guideId)` method
- `src/modules/services/services.service.ts` — gate `isActive=true` transition on publish/create
- `src/modules/events/events.service.ts` — gate `isPublished=true` transition (any tier paid → paid)
- `src/modules/soul-tours/soul-tours.service.ts` — gate `isPublished=true` transition
- `src/modules/products/products.service.ts` — gate `isActive=true` on create (default true) + on update

### Frontend new
- `Frontend/web/src/components/payments/PaymentsGateModal.tsx`

### Frontend modified
- `Frontend/web/src/lib/api.ts` (or interceptor file) — recognize `error === 'PAYMENT_GATE_BLOCKED'` and dispatch the modal
- `Frontend/web/src/components/guide/GuideProfileCompletenessWidget.tsx` — add Payments chip
- Service / Event / Tour / Product publish action handlers — handle the structured 403 by opening the modal

---

## 10. Acceptance criteria

- [ ] Free service (`price = 0`) publishes for guide without Stripe → succeeds
- [ ] Paid service (`price > 0`) publish for guide without Stripe → returns 403 `PAYMENT_GATE_BLOCKED` with `reason: 'no-stripe-account'`
- [ ] Same after Stripe link issued but onboarding incomplete → reason: `onboarding-incomplete`
- [ ] Same after onboarding done but Stripe disables payouts (`payoutsEnabled = false`) → reason: `payouts-disabled`
- [ ] Same after `stripeOnboardingDone = true` AND `payoutsEnabled = true` → succeeds
- [ ] Event with all-free tiers publishes; event with one paid tier blocks
- [ ] Tour publish blocks for guide without Stripe; succeeds when complete
- [ ] Product create returns 403 with `PAYMENT_GATE_BLOCKED` for paid product without Stripe; product still saves as draft (`isActive = false`)
- [ ] `PaymentsGateModal` renders in the UI when 403 hits, with [Set Up Payments] CTA pointing at `/guide/dashboard/earnings`
- [ ] Payments chip on `/guide/dashboard` shows correct of-4 states based on `connect/status`
- [ ] Admin user (RBAC: ADMIN / SUPER_ADMIN) calling the same endpoint bypasses the gate (no 403)
- [ ] Already-published paid offerings stay published when Stripe `payouts_enabled` flips false (no auto-unpublish)
- [ ] After this ships, `/guide/dashboard` widget reflects the Payments chip and the chip's CTA reaches the existing earnings page
- [ ] Both repos type-check clean

---

## 11. Out of scope (explicitly deferred)

- **Auto-unpublish** when Stripe disables payouts. v2 ledger already handles "Stripe disabled mid-flight" gracefully (`payoutsEnabled` flag, hold mechanism). Forcing an unpublish would surprise the guide and seekers with disappearing offerings; status-quo (block new bookings, keep existing live) is friendlier.
- **Retroactive backfill** for existing guides with paid offerings + no Stripe Connect. They keep working as today (platform balance accrues, withdrawal blocked). The gate fires only on the *next* publish action.
- **Pricing enforcement** — we don't validate "price ≥ Stripe minimum charge of $0.50" here. That's a separate concern.
- **Per-offering Stripe account override** (a guide using different bank accounts per service) — not supported.
- **Subscription billing for guides** ($50/mo platform fee) — separate roadmap track.

---

## 12. Open questions

None blocking. Decisions are locked by stakeholder direction (Option B). Implementation can begin immediately.

---

**Next step:** with this doc approved, G1 (helper) is the first commit. The full set ships as one PR.
