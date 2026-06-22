# Persona → Stripe Identity Migration Plan

**Goal:** Replace the **Persona identity-proofing track** (gov ID + selfie) with **Stripe Identity**, for a production-ready system.
**Scope:** Identity proofing ONLY. The credential-verification track (Textract OCR + Claude NLP + admin review) is **untouched**.
**Status:** ✅ **IMPLEMENTED 2026-06-22** (branch `feat-stripe-identity`) — behind stub mode (stays stub until `STRIPE_IDENTITY_WEBHOOK_SECRET` is set + Identity enabled in Stripe). Owner tasks remain: §5 (enable Identity + webhook), §7 step 3–4 (test→live). The §10 compliance answer (sanctions/watchlist) does not block the swap.
**Decided:** Stripe Identity is recommended for production (vendor consolidation with existing Stripe Connect; near 1:1 code mapping; cheaper).

---

## 1. Why this is low-risk here (prerequisites already in place)

| Prerequisite | Status |
|---|---|
| `stripe` SDK | ✅ installed (`^20.4.1`) |
| Stripe client wrapper | ✅ `StripeService` (`new Stripe(...)`, `constructEvent()`) |
| Raw-body webhook handling | ✅ `main.ts` → `{ rawBody: true }`; payments webhook proves the pattern |
| Webhook idempotency store | ✅ `stripeWebhookEvent` table (reuse for identity events) |
| Stripe account | ✅ Connect platform `acct_1TAIXy3pl7sqZPMV` (enable Identity in same account) |

So Identity reuses the existing Stripe plumbing — no new vendor, SDK, or webhook infrastructure.

---

## 2. Locked design decisions

1. **Reuse `StripeService`** — add `createIdentityVerificationSession()` + an identity webhook verifier. One shared `stripe` client.
2. **Separate webhook endpoint with its own secret** — `POST /verification/stripe-identity/webhook`, secret `STRIPE_IDENTITY_WEBHOOK_SECRET`. Keeps identity isolated from the payments webhook; Stripe lets you subscribe only `identity.*` events on that endpoint. Reuse the `stripeWebhookEvent` idempotency table.
3. **Rename `PersonaVerification` → `IdentityVerification`** — `inquiryId` → `verificationSessionId`. The table currently holds only stub rows (Persona was never live — keys were pending), so the migration can drop+recreate cleanly.
4. **Keep the credential pipeline + admin queue exactly as-is** — only the identity step changes. `reviewGuide`, `getPendingReviews`, Textract/Claude all unchanged.
5. **Preserve stub-mode behavior** — `isIdentityStub` gates real calls so dev/CI without keys still works (mirrors `isPersonaStub`).
6. **Hosted redirect flow** (not embedded modal) — least frontend change; session create returns a hosted `url` + `return_url` back to the dashboard. The frontend already consumes a `verifyUrl`, so churn is minimal.

---

## 3. File-by-file changes

### 3.1 Environment (`Backend/api/.env`, `.env.example`, deploy env)
```diff
- PERSONA_API_KEY=persona_...
- PERSONA_WEBHOOK_SECRET=persona_webhook_...
- PERSONA_TEMPLATE_ID=itmpl_...
+ # Stripe Identity reuses STRIPE_SECRET_KEY (already set).
+ STRIPE_IDENTITY_WEBHOOK_SECRET=whsec_...   # from the Identity webhook endpoint
```
(Leave `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` as-is — payments keep their own webhook secret.)

### 3.2 Prisma schema (`Backend/api/prisma/schema.prisma`)
```diff
- model PersonaVerification {
-   id          String    @id @default(cuid())
-   userId      String    @unique
-   inquiryId   String    @unique
-   status      String
-   referenceId String?
-   completedAt DateTime?
-   createdAt   DateTime  @default(now())
-   updatedAt   DateTime  @updatedAt
-   @@map("persona_verifications")
- }
+ model IdentityVerification {
+   id                    String    @id @default(cuid())
+   userId                String    @unique
+   verificationSessionId String    @unique          // Stripe "vs_..."
+   status                String                      // see §4 mapping
+   referenceId           String?                     // guideId
+   lastError             String?                     // Stripe last_error.reason on requires_input
+   completedAt           DateTime?
+   createdAt             DateTime  @default(now())
+   updatedAt             DateTime  @updatedAt
+   @@map("identity_verifications")
+ }
```
**Migration** `2026XXXX_persona_to_stripe_identity`: drop `persona_verifications`, create `identity_verifications`. (Safe — only stub rows exist. If any real rows existed, copy `inquiryId`→`verificationSessionId` first.)

### 3.3 `StripeService` (`Backend/api/src/modules/payments/stripe.service.ts`)
Add two methods:
```ts
async createIdentityVerificationSession(userId: string, guideId: string, returnUrl: string) {
  return this.stripe.identity.verificationSessions.create({
    type: 'document',
    metadata: { userId, guideId },
    options: { document: { require_matching_selfie: true, require_live_capture: true } },
    return_url: returnUrl,
  });
}
constructIdentityEvent(payload: Buffer, signature: string): Stripe.Event {
  const secret = this.config.get<string>('STRIPE_IDENTITY_WEBHOOK_SECRET')!;
  return this.stripe.webhooks.constructEvent(payload, signature, secret);
}
```

### 3.4 `verification.service.ts`
- Replace Persona config (`personaApiKey`, `personaTemplateId`, `isPersonaStub`) with `isIdentityStub` (gated on `STRIPE_SECRET_KEY` placeholder check). Inject `StripeService`.
- `initiatePersonaCheck()` → `initiateIdentityCheck(userId, guideId)`: stub returns mock `vs_stub_...`; real calls `stripe.createIdentityVerificationSession(...)`, upserts `identityVerification` with `status: 'requires_input'`. (Pipeline step 3 — unchanged position.)
- `startIdentityVerification(userId)` → returns `{ verificationSessionId, verifyUrl: session.url, stub }`. Look up `guideId` from the user; build `return_url` = `${APP_URL}/guide/dashboard/verification`.
- `handlePersonaWebhook()` → `handleIdentityWebhook({ verificationSessionId, status, lastError })`: update row; on `verified` set guide `verificationStatus = IN_REVIEW` (same as today). Delete the two `withpersona.com` fetch calls (this also closes the pending Persona-URL bug).
- Drop the `Persona-Version` header / inquiry-template logic entirely.

### 3.5 `verification.controller.ts`
- Replace `POST /verification/persona/webhook` with `POST /verification/stripe-identity/webhook`:
  - Read `req.rawBody` + `stripe-signature` header → `stripeService.constructIdentityEvent(...)` (Stripe SDK does HMAC + replay protection — **deletes** the hand-rolled HMAC/timestamp code, lines 54–92).
  - Idempotency: check/insert `stripeWebhookEvent` by `event.id` before processing.
  - Map `event.type` → status (§4), extract `event.data.object.id` (the `vs_...`) and `last_error.reason`, call `handleIdentityWebhook(...)`.
- `POST /verification/identity/start` — unchanged route; now returns the Stripe session fields.
- Admin queue/approve/reject — unchanged.

### 3.6 Webhook raw-body wiring
`main.ts` already has `rawBody: true`. Confirm the new route is reachable with `req.rawBody` populated (same as `/payments/webhook/stripe`). No global change needed.

### 3.7 Frontend
- `components/onboarding/steps/Step4Identity.tsx`: `data.inquiryId` → `data.verificationSessionId`; keep using `data.verifyUrl` (now the Stripe hosted URL). Prefer **same-tab redirect** (`window.location.href = verifyUrl`) over `window.open` so Stripe's `return_url` lands back cleanly — optional but recommended.
- `store/onboarding.store.ts`: rename `inquiryId` field on step4 state → `verificationSessionId`.
- `app/guide/dashboard/verification/page.tsx`: relabel "Government ID (Persona)" → "Government ID (Stripe Identity)"; same `/verification/identity/start` call; status checks already cover `'verified'`-style values (confirm `identityDone` includes `'verified'`).
- `app/(admin)/admin/settings/page.tsx`: if it surfaces a Persona key/status indicator, relabel to Stripe Identity.

### 3.8 Module wiring
- `VerificationModule` must import the module that provides `StripeService` (or move `StripeService` to a shared module). Verify no circular dep with `PaymentsModule`; if so, extract `StripeService` into a small `StripeModule`.

---

## 4. Webhook event → status mapping

| Stripe event | `identity_verifications.status` | Side effect |
|---|---|---|
| `identity.verification_session.created` | `requires_input` | — |
| `identity.verification_session.processing` | `processing` | — |
| `identity.verification_session.verified` | `verified` | guide → `IN_REVIEW` (admin still does final approve) |
| `identity.verification_session.requires_input` | `requires_input` | store `last_error.reason` for the dashboard |
| `identity.verification_session.canceled` | `canceled` | — |

Frontend "identity done" = `status === 'verified'` (plus the existing stub value).

---

## 5. Stripe Dashboard config (owner task)
1. **Enable Identity** on `acct_1TAIXy3pl7sqZPMV` (Settings → Identity; accept terms).
2. **Create a webhook endpoint** → `https://<api-host>/verification/stripe-identity/webhook`, subscribe only `identity.verification_session.*`. Copy its signing secret → `STRIPE_IDENTITY_WEBHOOK_SECRET`.
3. (Optional) Enable **verified outputs** access if you want to read/store verified name/DOB.
4. Confirm **supported countries** for your guide base.

---

## 6. Testing plan
- **Stub mode:** no keys → mock `vs_stub_...`, pipeline completes inline (CI/dev unaffected).
- **Test mode:** use Stripe test VerificationSessions; Stripe provides test document flows that resolve to `verified` / `requires_input`. Trigger webhooks via Stripe CLI (`stripe listen --forward-to localhost:3001/verification/stripe-identity/webhook` + `stripe trigger identity.verification_session.verified`).
- Assert: row upserts, status transitions, guide → IN_REVIEW on verified, idempotency (replayed event id is a no-op), signature rejection on bad secret.

---

## 7. Rollout steps
1. Land code behind stub mode (no behavior change until keys set).
2. Run migration on QA DB.
3. Enable Identity + webhook in Stripe **test** mode; set test keys on QA; run the §6 flow end-to-end.
4. Flip to **live** Stripe keys + live webhook secret in prod env; smoke-test one real verification.
5. Remove dead Persona env vars from all environments.

---

## 8. Effort estimate
~**2–3 days**: schema+migration (S), StripeService methods (S), service rewrite (M), controller/webhook (S — SDK removes hand-rolled HMAC), frontend relabel/redirect (S), module wiring (S), testing (M).

---

## 9. What is explicitly NOT changing
Credential OCR/NLP (Textract + Claude), `CredentialVerification` audit trail, admin verification queue + approve/reject, the `isPublished AND isVerified` publish gate, deferred onboarding, role-mutex. Identity is one isolated step in the pipeline.

---

## 10. The one gating question for the client
**Does compliance require AML / sanctions / watchlist screening, or is identity proofing (ID + selfie) sufficient?**
Stripe Identity does document + selfie + ID-number checks only — **no** ongoing monitoring or sanctions screening (Persona didn't either, out of the box). If screening is ever required, that's a *separate* provider regardless of Persona vs Stripe — it does **not** block this swap.

---

*Plan authored 2026-06-22. Grounded in the current verification.service.ts / .controller.ts, PersonaVerification schema, and Step4Identity/dashboard frontend touchpoints.*
