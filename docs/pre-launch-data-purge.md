# Pre-Launch Data Purge — Implementation Strategy

**Status:** Tooling shipped, awaiting execution on QA
**Target environment:** `spiritualcalifornia.nityo.in` (QA/demo) — *not* production
**Author:** Engineering, 2026-08-04
**Script:** `Backend/api/scripts/purge-demo-data.ts`

---

## 1. Objective

Reduce the demo database to a clean skeleton so production-ready data can be
loaded into it ahead of the `spiritualcalifornia.com` launch.

**Removed:** every seeker and practitioner account, and everything attached to
them — services, products, soul tours, events, journal posts, credentials,
media, plus all bookings, orders, ticket purchases, tour bookings, payments,
ledger entries and payout records.

**Kept:** admin accounts, the category taxonomy, legal/CMS pages, and platform
configuration (commission rates, clearance rules, tax rates, shipping methods,
institution references, email suppression list).

---

## 2. The Stripe question, answered precisely

The premise in the original request — *"corresponding Stripe payment gateway
customer transactions also would be removed from Stripe"* — needs correcting on
two counts.

### 2.1 Stripe transactions cannot be deleted. Ever.

Charges, PaymentIntents, Refunds, Balance Transactions, Transfers, Payouts and
Application Fees are **immutable** in Stripe. There is no delete endpoint for
them in test mode or live mode, and the dashboard offers no per-object delete.
This is deliberate on Stripe's part — they are financial records.

What *can* be removed:

| Object | Removable? | How |
| --- | --- | --- |
| Charge / PaymentIntent / Refund | **No** | Immutable, permanently |
| Balance transaction / Transfer / Payout | **No** | Immutable, permanently |
| Connect account | Yes | `DELETE /v1/accounts/:id`, else `reject` |
| Subscription | Yes (cancel) | `subscriptions.cancel` |
| Customer | Yes (test mode) | `DELETE /v1/customers/:id` |
| **All test-mode data at once** | Yes | Dashboard → Developers → *Delete all test data* |

### 2.2 It does not matter, because production starts empty

The demo runs on **sandbox keys** (Connect platform `acct_1TAIXy3pl7sqZPMV`).
Production will run on **live keys**. Test-mode and live-mode data are entirely
separate namespaces inside Stripe — live mode has never seen a single one of
these demo transactions.

> **The production Stripe account starts clean on its own. No Stripe cleanup is
> required for launch.**

Cleaning the sandbox is therefore *hygiene, not a launch dependency*. It is
still worth doing so that stale Connect accounts don't clutter the sandbox and
confuse later testing — hence the script's `--stripe` mode. If you want a
genuinely exhaustive sandbox reset, the dashboard's **Delete all test data** is
more thorough than any API sweep and takes one click.

### 2.3 The one scenario that would change this

If any live key was ever configured against the demo environment, real money
moved and those charges are permanent. They would need **refunding**, not
deleting, and the Connect accounts would need rejecting rather than deletion.
The script detects this: it prints the key mode and **refuses all Stripe writes
against an `sk_live` key** unless `--allow-live-stripe` is passed explicitly.

---

## 3. Why a naive delete fails

The obvious approach — `DELETE FROM users` and let cascades handle it — errors
out on the first row.

Prisma's default referential action for a **required** relation is `Restrict`,
not `Cascade`. Across the 61-model schema, roughly a dozen tables actively
block their parent until they are empty:

| Blocked table | Blocked by | Column |
| --- | --- | --- |
| `User` | `Review` | `authorId`, `guideId` |
| `User` | `Testimonial` | `authorId` |
| `User` | `ImportBatch` | `uploadedById` |
| `SeekerProfile` | `Booking`, `Order`, `TicketPurchase`, `TourBooking` | `seekerId` |
| `GuideProfile` | `LedgerEntry`, `PayoutRequest` | `guideId` |
| `Service` | `Booking` | `serviceId` |
| `Product` | `OrderItem` | `productId` |
| `EventTicketTier` | `TicketPurchase` | `tierId` |
| `SoulTour` / `TourRoomType` | `TourBooking` | `tourId`, `roomTypeId` |
| `Payment` | `LedgerEntry` | `paymentId` |
| `PayoutAccount` | `PayoutRequest` | `payoutAccountId` |

The purge therefore deletes **leaf-first**, in a fixed order encoded in
`purge()`. Money tables go first (ledger → payment → payout), then
transactions, then the catalogue, then profiles, then users.

### 3.1 The orphan trap — columns with no foreign key

Five columns reference other rows **without a foreign key constraint**. Nothing
cascades to them, and no error is raised when their target disappears. Left
alone they become permanent orphans pointing at users who no longer exist:

- `IdentityVerification.userId` — no relation block at all
- `Cart.userId` — no relation to `User`
- `Favorite.guideId` — only `seekerId` is a real FK
- `Testimonial.targetGuideId` — only `authorId` is a real FK
- `ScraperJob.guideProfileId`

Polymorphic columns have the same property by design and are handled by
deleting the tables wholesale: `CartItem.itemId`, `Review.targetEntityId`,
`ReconciliationMismatch.paymentId`, `PayoutAuditLog.guideId`.

The script deletes all of these explicitly. This is the single easiest thing to
get wrong, and the failure is silent.

### 3.2 The preservation traps

Two tables look like transactional debris but must **not** be emptied.

**`CommissionRate` — rows where `guideId IS NULL` are the platform defaults**
(20%, 10% on Products). Per-guide overrides are the rows with a `guideId`. A
blanket `deleteMany({})` would wipe the platform rates, and the guide-facing fee
display would silently fall back to the `STRIPE_PLATFORM_COMMISSION_PERCENT` env
var — which has historically read 15% while payouts actually charged 20%. See
[commission-display-truth.md](commission-display-truth.md).
→ Script deletes `{ guideId: { not: null } }` only, and the report warns loudly
if the platform-default count is zero.

**`EmailSuppression` — the "never contact this address again" tombstone.**
Deleting it means a future re-import of the same practitioner spreadsheet would
email people who already unsubscribed. That is a CAN-SPAM exposure, and the
table stores only an HMAC of the address, so keeping it retains no personal
data. → Preserved unconditionally.

`ClearanceRule`, `Category`/`Subcategory`, `StaticPage`, `PlatformSetting`,
`TaxRate`, `ShippingMethod` and `InstitutionReference` are likewise preserved
as configuration.

### 3.3 Who survives

Survival is keyed on **holding `ADMIN` or `SUPER_ADMIN`**, not on "isn't a
seeker". The SEEKER/GUIDE mutex exempts admins, so one user can hold `ADMIN`
*and* `SEEKER` at once — anything keyed off the marketplace role would delete
staff accounts. Extra accounts can be spared with `--keep-emails=`.

The script **refuses to run** if that query returns zero users, since the result
would be an empty `users` table and no way back into the admin panel.

Note that admins may hold a lazily-created **shell `GuideProfile`** used as the
FK target for editorial blog posts (`resolveAuthorToGuideId`). These are
unpublished and unverified, so they never surface publicly, and they survive the
purge. Their blog posts do not — all content is purged regardless of author.

---

## 4. The command-line trigger

Three modes, each strictly more dangerous than the last.

```bash
cd /var/www/spiritual-california/Backend/api

npm run purge:report     # read-only census — counts, survivors, Stripe preview
npm run purge:trial      # full delete inside a transaction, then ROLLS BACK
npm run purge:execute -- --confirm=<database-name>
```

### `--mode=report` (default)
Read-only. Prints the surviving accounts by email and role, per-table row counts
with the scope that will be applied, the preserved-table counts, the Stripe
objects that would be orphaned, and the S3 object count. Touches nothing.

### `--mode=trial`
Runs the **entire delete against real data inside a transaction**, reports
per-table deleted counts, then throws a sentinel to force a rollback. This
proves the foreign-key ordering holds against the actual dataset without
committing a single row. **Always run this before execute.**

### `--mode=execute`
The same transaction, committed, followed by verification and Stripe cleanup.
Requires `--confirm=<database-name>` matching the database in `DATABASE_URL` —
a guard so a command copied between environments cannot run against the wrong
database.

### Flags

| Flag | Effect |
| --- | --- |
| `--keep-emails=a@x.com,b@y.com` | Preserve these accounts on top of admins |
| `--keep-promos` | Keep `PromoCode` rows (default: purged) |
| `--purge-all-audit` | Purge admin audit logs too (default: only purged users') |
| `--stripe=off\|report\|execute` | Stripe-side cleanup (default: `report`) |
| `--allow-live-stripe` | Required before any write against an `sk_live` key |

### Ordering: database first, Stripe second

Stripe cleanup runs **after** the database commits, driven by a manifest written
to `scripts/.purge-artifacts/purge-<timestamp>.json` **before** the transaction
opens. The manifest has to outlive the rows because once a `GuideProfile` is
gone its `stripeAccountId` is unrecoverable. This ordering means a Stripe
failure is retryable from the manifest and never leaves the database
half-purged.

---

## 5. Runbook

Execute in order. Do not skip step 1.

**1 — Back up.** Non-negotiable. This is the only real rollback.
```bash
pg_dump "$DATABASE_URL" -Fc -f ~/backup-pre-purge-$(date +%Y%m%d-%H%M).dump
```
Verify the dump is non-trivial in size before continuing.

**2 — Quiesce the API** so nothing writes between the manifest and the commit.
```bash
pm2 stop sc-api
```

**3 — Census.**
```bash
npm run purge:report
```
Read the survivor list carefully. Confirm every account you expect to keep is
listed `KEEP`. Confirm the platform-default commission count is non-zero.

**4 — Rehearse.**
```bash
npm run purge:trial
```
Expect `Trial complete — transaction rolled back, database unchanged.` Any FK
error here is a real ordering defect — fix `purge()` and re-run. Do not proceed
past a failing trial.

**5 — Execute.**
```bash
npm run purge:execute -- --confirm=<database-name>
```
Built-in verification runs automatically and asserts that transactional tables
are at zero while configuration tables are intact. A non-zero exit means a check
failed.

**6 — Flush the job queues.** Redis holds BullMQ jobs referencing rows that no
longer exist; they will throw on their next attempt. Six queues:
`document-analysis`, `identity-reconcile`, `invite-tasks`, `order-tasks`,
`payouts-tasks`, `tour-tasks`.
```bash
redis-cli --scan --pattern 'bull:*' | xargs -r redis-cli DEL
```

**7 — Restart.**
```bash
pm2 restart sc-api && pm2 restart sc-web && pm2 save
```

**8 — Smoke test.** `/practitioners`, `/shop`, `/events`, `/travels` and
`/journal` should all render empty states rather than error. Admin sign-in
should work — note that all refresh tokens were revoked, so **every admin must
sign in again**. Search should return nothing without erroring (the FTS
`tsvector` columns are generated and maintained by the database, so they empty
themselves along with their rows).

**9 — Stripe sandbox reset** *(optional)*. If you want the sandbox genuinely
clean rather than just detached, use Dashboard → Developers → **Delete all test
data**. Do this only after step 8 passes.

---

## 6. Rollback

The transaction is atomic — any failure mid-run leaves the database untouched
and requires no action.

Once `execute` commits, **the only rollback is the step-1 dump**:
```bash
pg_restore -d "$DATABASE_URL" --clean --if-exists ~/backup-pre-purge-<stamp>.dump
```
Stripe-side deletions are **not reversible**. A deleted Connect account cannot
be restored, which is a further reason the sandbox reset is sequenced last and
gated behind `--allow-live-stripe` in live mode.

---

## 7. Deliberately out of scope

**S3 objects.** Avatars, credential documents, product images, tour and event
covers and digital-download files are *not* deleted. The script counts them and
writes the full list into the purge manifest so storage can be reclaimed
separately once the purge is confirmed good. Deleting them in the same pass
would make a restore from the step-1 dump produce a database full of broken
image links — the dump restores rows, not S3 objects.

**Production.** This procedure targets QA only. Production launches on a fresh
database and a fresh live Stripe account; there will be nothing there to purge.

---

## 8. Verification checklist

Built into `--mode=execute`, reproducible by re-running `--mode=report`:

| Assertion | Expected |
| --- | --- |
| `users` | equals the surviving admin count |
| `seekerProfiles` | 0 |
| `orders`, `bookings`, `ticketPurchases`, `tourBookings` | 0 |
| `payments`, `ledgerEntries`, `payoutRequests` | 0 |
| `products`, `events`, `soulTours`, `services`, `blogPosts` | 0 |
| `categories`, `staticPages`, `clearanceRules` | unchanged, non-zero |
| `commissionRate WHERE guideId IS NULL` | unchanged, non-zero |
| `emailSuppressions` | unchanged |

---

## 9. Related

- [commission-display-truth.md](commission-display-truth.md) — why the platform-default commission rows must survive
- [practitioner-import-invite-strategy.md](practitioner-import-invite-strategy.md) — the suppression-list contract
- [guide-payouts-v2.md](guide-payouts-v2.md) — ledger and payout model
- [public-visibility-gate.md](public-visibility-gate.md) — what makes a guide publicly visible
