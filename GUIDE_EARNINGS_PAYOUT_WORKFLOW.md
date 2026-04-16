# Guide Earnings & Payout System — Implementation Document

**Date:** April 13, 2026
**Status:** Implemented (end-to-end)

---

## 1. Overview

Complete guide earnings visibility and payout system. Guides can track their income from services, tours, and events, request payouts to their bank accounts via Stripe Connect, and view full transaction history. Admins can view all guide balances, manage payout requests, and trigger real Stripe transfers.

---

## 2. Balance Flow

### How Guides Earn Money

```
Seeker pays for service/tour/event
  → Stripe PaymentIntent succeeds
  → Webhook fires payment_intent.succeeded
  → confirmPayment() runs:
      1. Payment status → SUCCEEDED
      2. Related entity status updated (Booking → CONFIRMED, etc.)
      3. resolveGuideIdFromPayment() finds the guide:
         - Service booking → booking.service.guideId
         - Tour booking → tourBooking.tour.guideId
         - Event ticket → ticketPurchase.tier.event.guideId
      4. updateGuideBalance() credits guideAmount to guide's availableBalance
         (funds are immediately available — platform holds money, not Stripe)
```

### Platform Commission

| Item | Value |
|------|-------|
| Commission rate | 15% (configurable via `STRIPE_PLATFORM_COMMISSION_PERCENT` env var) |
| Guide receives | 85% of payment amount (`guideAmount = amount × 0.85`) |
| Platform keeps | 15% (`platformFee = amount × 0.15`) |

### PayoutAccount Balance Fields

| Field | Description |
|-------|-------------|
| `availableBalance` | Funds ready for withdrawal — incremented when payment succeeds |
| `pendingBalance` | Reserved for future use (settlement delays, dispute windows) — currently unused |
| `totalEarned` | Lifetime earnings (only goes up) |
| `totalPaidOut` | Lifetime payouts (incremented when admin processes transfer) |

---

## 3. Payout Request Flow

### Guide Requests Payout

```
Guide visits /guide/dashboard/earnings
  → Sees available balance
  → Clicks "Request Payout"
  → Enters amount ($10 minimum, capped at available balance)
  → Submits request
  → Backend:
      1. Validates amount >= $10
      2. Validates availableBalance >= amount
      3. Creates PayoutRequest (status: PENDING)
      4. Decrements availableBalance by amount
  → Guide sees request in Payout History table (status: PENDING)
```

### Admin Processes Payout

```
Admin visits /payouts
  → Sees pending payout requests
  → Clicks "Process" button on a request
  → Confirms via dialog
  → Backend processPayout():
      1. Validates request is PENDING
      2. Validates guide has Stripe Connect onboarded
      3. Updates status → PROCESSING
      4. Calls stripeService.createTransfer():
         - Creates real Stripe transfer to guide's connected account
         - Amount converted to cents for Stripe API
      5. On success:
         - Status → COMPLETED
         - Stores Stripe transfer ID
         - Sets processedAt timestamp
         - Increments totalPaidOut on PayoutAccount
      6. On failure:
         - Status → FAILED
         - Refunds availableBalance (re-increments the amount)
         - Logs error
  → Admin sees updated status in table
  → Guide sees COMPLETED in their payout history
```

### Payout Status State Machine

```
PENDING → PROCESSING → COMPLETED
                    ↘ FAILED (balance refunded)
```

---

## 4. Stripe Connect Integration

### Onboarding Flow

1. Guide clicks "Set Up Stripe Connect" on earnings page
2. Backend creates Stripe Express account (`type: 'express'`)
3. Returns onboarding URL → guide redirected to Stripe's hosted onboarding
4. Guide completes identity verification + bank account setup on Stripe
5. Stripe webhook `account.updated` fires → backend sets `stripeOnboardingDone = true`
6. Guide returns to earnings page → sees "Connected" status

### Connect Status Checks

| Field | Meaning |
|-------|---------|
| `connected` | Stripe account ID exists and is not 'pending-setup' |
| `chargesEnabled` | Can receive charges (identity verified) |
| `payoutsEnabled` | Can receive payouts (bank account linked) |
| `detailsSubmitted` | Onboarding form completed |

---

## 5. API Endpoints

### Guide Endpoints (GUIDE role required)

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/payments/earnings` | Balance summary + last 20 transactions |
| `POST` | `/payments/payout` | Request a payout (body: `{ amount: number }`) |
| `GET` | `/payments/payout-history` | List of all payout requests (last 50) |
| `POST` | `/payments/connect/onboard` | Start/resume Stripe Connect onboarding |
| `GET` | `/payments/connect/status` | Check Connect account status |

### Admin Endpoints (ADMIN/SUPER_ADMIN role required)

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/admin/payout-requests` | All payout requests with status filter + pagination |
| `GET` | `/admin/guide-balances` | All guide payout accounts with search + pagination |
| `POST` | `/admin/payout-requests/:id/process` | Trigger real Stripe transfer for a pending request |

### Endpoint Response Shapes

#### GET /payments/earnings
```json
{
  "balance": {
    "available": 425.00,
    "pending": 0,
    "totalEarned": 1250.00,
    "totalPaidOut": 825.00
  },
  "recentPayments": [
    {
      "id": "pay_xxx",
      "amount": 100.00,
      "guideAmount": 85.00,
      "platformFee": 15.00,
      "paymentType": "FULL",
      "paymentMethod": "card",
      "createdAt": "2026-04-12T...",
      "status": "SUCCEEDED"
    }
  ],
  "stripeConnected": true
}
```

#### POST /payments/payout
```json
// Request
{ "amount": 200.00 }

// Response
{
  "id": "payout_xxx",
  "guideId": "guide_xxx",
  "payoutAccountId": "pa_xxx",
  "amount": 200.00,
  "status": "PENDING",
  "createdAt": "2026-04-13T..."
}
```

#### GET /admin/payout-requests
```json
{
  "requests": [
    {
      "id": "payout_xxx",
      "amount": 200.00,
      "currency": "USD",
      "status": "PENDING",
      "stripePayoutId": null,
      "processedAt": null,
      "createdAt": "2026-04-13T...",
      "guide": {
        "id": "guide_xxx",
        "displayName": "Maya Williams",
        "name": "Maya Williams",
        "email": "maya@example.com",
        "avatarUrl": "https://...",
        "stripeConnected": true
      },
      "balance": {
        "available": 225.00,
        "totalEarned": 1250.00,
        "totalPaidOut": 825.00
      }
    }
  ],
  "total": 15,
  "page": 1,
  "limit": 15,
  "totalPages": 1,
  "statusCounts": { "PENDING": 3, "COMPLETED": 10, "FAILED": 2 }
}
```

#### POST /admin/payout-requests/:id/process
```json
// Success
{ "status": "COMPLETED", "transferId": "tr_xxx" }

// Failure (400)
{ "message": "Stripe transfer failed: Insufficient funds in platform account" }
```

---

## 6. Frontend Pages

### Guide Earnings Dashboard

**Route:** `/guide/dashboard/earnings`
**File:** `Frontend/web/src/app/guide/dashboard/earnings/page.tsx`

**Sections:**
1. **Balance Hero Card** (dark gradient background)
   - Available Balance (large gold text, 48px)
   - Total Earned + Total Paid Out (side-by-side, 32px)
   - "Request Payout" button → opens inline payout form
   - "Stripe Dashboard" button → opens Stripe Express dashboard
   - OR "Set Up Stripe Connect" button (if not connected)
   
2. **Payout Request Form** (inline, below hero)
   - Dollar amount input with $ prefix
   - "Max" button (fills available balance)
   - "Submit Request" button
   - Validation: minimum $10, max = available balance

3. **Stripe Connect Status** (3-card row)
   - Connected / Charges Enabled / Payouts Enabled (green/orange badges)

4. **Recent Transactions Table**
   - Date, Type (FULL/DEPOSIT/BALANCE), Total, Your Earnings, Platform Fee, Method, Status

5. **Payout History Table**
   - Date Requested, Amount, Status (badge), Processed Date, Stripe Transfer ID

6. **How Payouts Work** (info panel)
   - Step-by-step explanation of the payout flow

### Admin Payouts Page

**Route:** `/payouts`
**File:** `Frontend/web/src/app/(admin)/payouts/page.tsx`

**Two Tabs:**

**Tab 1: Payout Requests**
- Status filter cards (All / Pending / Processing / Completed / Failed) with counts
- Table: Guide (avatar + name + email), Amount, Status badge, Balance snapshot, Stripe connection status, Date requested, Action
- "Process" button on PENDING requests (with confirm dialog)
- Shows Stripe transfer ID for completed payouts
- Shows "Stripe needed" warning for guides without Connect

**Tab 2: Guide Balances**
- Searchable by guide name/email
- Table: Guide, Available Balance, Pending Balance, Total Earned, Total Paid Out, Request Count, Stripe Status
- Sorted by total earned (highest first)

### Admin Sidebar
Added "Payouts" item (Wallet icon) between Service Bookings and Financials.

---

## 7. Database Models

### PayoutAccount (unchanged schema, updated logic)

```prisma
model PayoutAccount {
  id               String    @id @default(cuid())
  guideId          String    @unique
  stripeAccountId  String    @unique
  availableBalance Decimal   @db.Decimal(10, 2)  // Credited on payment success
  pendingBalance   Decimal   @db.Decimal(10, 2)  // Reserved for future settlement delays
  totalEarned      Decimal   @db.Decimal(10, 2)  // Lifetime (only increments)
  totalPaidOut     Decimal   @db.Decimal(10, 2)  // Incremented on successful Stripe transfer
  currency         String    @default("USD")
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
}
```

### PayoutRequest (unchanged schema, status now fully used)

```prisma
model PayoutRequest {
  id              String       @id @default(cuid())
  guideId         String
  payoutAccountId String
  amount          Decimal      @db.Decimal(10, 2)
  currency        String       @default("USD")
  status          PayoutStatus // PENDING → PROCESSING → COMPLETED | FAILED
  stripePayoutId  String?      // Stripe transfer ID (set on COMPLETED)
  processedAt     DateTime?    // Timestamp (set on COMPLETED)
  createdAt       DateTime     @default(now())
}

enum PayoutStatus {
  PENDING      // Guide requested, awaiting admin action
  PROCESSING   // Admin triggered Stripe transfer, in progress
  COMPLETED    // Stripe transfer succeeded
  FAILED       // Stripe transfer failed (balance refunded to guide)
}
```

---

## 8. File Manifest

### Backend (Modified)

| File | Changes |
|------|---------|
| `src/modules/payments/payments.service.ts` | Fixed `updateGuideBalance()` to credit `availableBalance` directly; added `resolveGuideIdFromPayment()` supporting event tickets; added `processPayout()` with real Stripe transfer; added `getGuidePayoutHistory()` |
| `src/modules/payments/payments.controller.ts` | Added `GET /payout-history` endpoint |
| `src/modules/admin/admin.service.ts` | Added `getPayoutRequests()` and `getGuideBalances()` methods |
| `src/modules/admin/admin.controller.ts` | Added `GET /payout-requests`, `GET /guide-balances`, `POST /payout-requests/:id/process` endpoints; injected `PaymentsService` |
| `src/modules/admin/admin.module.ts` | Added `PaymentsModule` to imports |

### Frontend (Created/Modified)

| File | Action |
|------|--------|
| `src/app/guide/dashboard/earnings/page.tsx` | **Rewritten** — full earnings dashboard with API integration |
| `src/app/(admin)/payouts/page.tsx` | **Created** — admin payout management with two tabs |
| `src/components/admin/sidebar.tsx` | **Modified** — added Payouts nav item |

---

## 9. Security & Edge Cases

| Scenario | Handling |
|----------|----------|
| Guide requests more than available balance | Backend validates and throws `BadRequestException` |
| Guide requests less than $10 | Backend validates minimum amount |
| Payout processed but Stripe transfer fails | Status set to FAILED, balance refunded to guide |
| Admin processes already-processed payout | Backend checks status, rejects if not PENDING |
| Guide without Stripe Connect requests payout | `requestPayout()` throws "No payout account found" |
| Admin processes payout for guide without Stripe | `processPayout()` throws "Guide has not completed Stripe Connect onboarding" |
| Double-click on Process button | Frontend disables button during mutation; backend idempotent check on status |
| Payment for entity without guide (e.g., product order) | `resolveGuideIdFromPayment()` returns undefined, balance update skipped |
