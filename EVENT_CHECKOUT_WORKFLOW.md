# Event Ticket Checkout — Implementation Document

**Date:** April 13, 2026
**Status:** Implemented (end-to-end)
**Design Reference:** `spiritual_california_new_pages/checkout-event.html` (client-provided HTML mockup)

---

## 1. Overview

Complete end-to-end event ticket purchasing flow for seekers. A seeker can browse events, select a ticket tier, specify quantity, fill attendee details, pay via Stripe, and receive unique QR code tickets per attendee.

**Flow:** Browse Events → Select Tickets → Attendee Details → Stripe Payment → QR Code Tickets Confirmed

---

## 2. Database Schema Changes

### TicketPurchase Model (Updated)

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (cuid) | Primary key |
| `purchaseGroupId` | String | Groups all tickets from one checkout session |
| `seekerId` | String (FK) | Links to SeekerProfile |
| `tierId` | String (FK) | Links to EventTicketTier |
| `quantity` | Int | Always 1 (one record per attendee) |
| `totalAmount` | Decimal(10,2) | Ticket price for this attendee |
| `bookingFee` | Decimal(10,2) | 5% booking fee (split evenly across tickets) |
| `status` | TicketStatus enum | PENDING → CONFIRMED → CANCELLED/REFUNDED |
| `qrCode` | String (unique, nullable) | Data URL of QR code image (generated on payment confirmation) |
| `attendeeName` | String (nullable) | Full name of this attendee |
| `attendeeEmail` | String (nullable) | Email — ticket sent here |
| `dietaryNeeds` | String (nullable) | Dietary requirements |
| `accessibilityNeeds` | String (nullable) | Accessibility needs |
| `createdAt` | DateTime | |

**TicketStatus Enum:** `PENDING | CONFIRMED | CANCELLED | REFUNDED`

**Indexes:** `[purchaseGroupId]`, `[seekerId]`

### EventTicketTier Model (Unchanged)

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (cuid) | Primary key |
| `eventId` | String (FK) | Links to Event |
| `name` | String | e.g. "General Admission", "VIP — Inner Circle" |
| `description` | String (nullable) | Tier benefits description |
| `price` | Decimal(10,2) | Price per ticket |
| `currency` | String | Default "USD" |
| `capacity` | Int | Max tickets for this tier |
| `sold` | Int | Incremented on payment confirmation |
| `isActive` | Boolean | |

### Payment Model (Existing — used as-is)

The `Payment` model already has a `ticketPurchaseId` field linking to the primary (first) TicketPurchase in the group. The `purchaseGroupId` stored in metadata allows finding all tickets in the group.

---

## 3. Backend API

### Module: `TicketsModule`

**Location:** `Backend/api/src/modules/tickets/`

**Files:**
- `tickets.module.ts` — NestJS module (imports PaymentsModule)
- `tickets.controller.ts` — Route handlers
- `tickets.service.ts` — Business logic + QR generation
- `dto/event-checkout.dto.ts` — Request validation

**Registered in:** `app.module.ts`

### Endpoints

#### `POST /tickets/event-checkout` (Authenticated, SEEKER role)

**Request Body:**
```json
{
  "eventId": "string",
  "tierId": "string",
  "quantity": 2,
  "attendees": [
    {
      "firstName": "Svitlana",
      "lastName": "Rahimova",
      "email": "svitlana@example.com",
      "dietaryNeeds": "vegetarian",
      "accessibilityNeeds": ""
    },
    {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com"
    }
  ]
}
```

**Validation Rules:**
- `eventId`: required string
- `tierId`: required string
- `quantity`: required integer, 1–10, must equal `attendees.length`
- `attendees[].firstName`: required string
- `attendees[].lastName`: required string
- `attendees[].email`: required, valid email
- `attendees[].dietaryNeeds`: optional string
- `attendees[].accessibilityNeeds`: optional string

**Business Logic:**
1. Validates seeker profile exists
2. Loads event + ticket tiers, checks event is published and not cancelled
3. Checks tier is active and has enough remaining capacity
4. Calculates: `subtotal = price × quantity`, `bookingFee = subtotal × 5%`, `total = subtotal + bookingFee`
5. Generates `purchaseGroupId` (32-char hex)
6. In a **transaction**: re-checks availability (race protection), creates N `TicketPurchase` records (one per attendee, status: PENDING)
7. Creates Stripe PaymentIntent via `PaymentsService.createPaymentIntent()` (links to primary ticket via `ticketPurchaseId`)
8. Returns `clientSecret` for Stripe Elements

**Response:**
```json
{
  "purchaseGroupId": "abc123...",
  "ticketPurchaseIds": ["id1", "id2"],
  "clientSecret": "pi_xxx_secret_yyy",
  "paymentIntentId": "pi_xxx",
  "event": { "id", "title", "startTime", "endTime", "location", "type" },
  "tier": { "id", "name", "price", "currency" },
  "summary": { "quantity": 2, "subtotal": 370, "bookingFee": 18.5, "total": 388.5 }
}
```

#### `GET /tickets/purchase-group/:groupId` (Authenticated, SEEKER role)

Returns all tickets in a purchase group with QR codes (used for confirmation page).

**Response:**
```json
{
  "purchaseGroupId": "abc123...",
  "status": "CONFIRMED",
  "event": { "id", "title", "startTime", "endTime", "location", "type", "coverImageUrl", "guide": {...} },
  "tier": { "id", "name", "price" },
  "tickets": [
    {
      "id": "ticket1",
      "attendeeName": "Svitlana Rahimova",
      "attendeeEmail": "svitlana@example.com",
      "dietaryNeeds": "vegetarian",
      "accessibilityNeeds": null,
      "qrCode": "data:image/png;base64,...",
      "status": "CONFIRMED"
    }
  ],
  "summary": { "quantity": 2, "subtotal": 370, "bookingFee": 18.5, "total": 388.5 }
}
```

### Payment Confirmation Flow

**Location:** `Backend/api/src/modules/payments/payments.service.ts`

When Stripe webhook fires `payment_intent.succeeded`:

1. `confirmPayment()` finds the Payment record by `stripePaymentIntentId`
2. Updates Payment status to `SUCCEEDED`
3. Detects `ticketPurchaseId` is set → looks up `purchaseGroupId` from that ticket
4. Calls `confirmEventTickets(purchaseGroupId)`:
   - Loads all tickets in the group
   - For each ticket: generates unique QR code via `qrcode` npm package (encodes ticketId, eventId, eventTitle, tierName, attendeeName)
   - Updates each ticket status to `CONFIRMED` and stores `qrCode` data URL
   - Increments `sold` count on the `EventTicketTier`
5. Updates guide's payout account balance

**QR Code Contents:**
```json
{
  "ticketId": "cuid...",
  "eventId": "cuid...",
  "eventTitle": "Qigong & Sound Healing Immersion",
  "tierName": "General Admission",
  "attendeeName": "Svitlana Rahimova"
}
```

---

## 4. Frontend Implementation

### Event Checkout Page

**Route:** `/events/[id]/checkout`
**File:** `Frontend/web/src/app/(public)/events/[id]/checkout/page.tsx`

**4-Step Wizard:**

#### Step 0 — Select Tickets
- Displays event card header (dark background with title, date, time, location, host name)
- Radio card list of ticket tiers (name, description, price, spots remaining)
- Quantity dropdown (1–10, capped at remaining spots)
- "Continue → Attendee Details" button

#### Step 1 — Attendee Details
- One card per ticket with attendee number badge and tier name badge
- Fields per attendee: First Name, Last Name, Email, Dietary/Accessibility needs
- Primary attendee (first) auto-filled from auth store (user name + email)
- Back button + "Continue → Payment" button
- On submit: calls `POST /tickets/event-checkout` to create purchases and get Stripe clientSecret

#### Step 2 — Payment
- Uses existing `StripeProvider` + `StripePaymentForm` components (same as service/tour booking)
- Stripe Elements with tabs: Credit/Debit Card, Apple Pay, Google Pay
- Submit button shows total: "Confirm & Pay — $388.50 (2 tickets)"
- Cancellation policy note below payment form
- On Stripe success: calls `POST /payments/confirm-payment` (idempotent), then fetches purchase group with QR codes

#### Step 3 — Your Tickets (Confirmation)
- Green checkmark + "Tickets Confirmed!" heading
- Per-ticket cards showing: attendee name, email, status badge, QR code image
- QR code displayed in gold-pale background with "Show this QR code at the door" instruction
- Navigation: "Browse More Events" + "Go Home"

### Sticky Sidebar (Steps 0–2)
- Ticket Summary: tier name × quantity, event title
- Subtotal, Booking fee (5%), Tax ($0), Total (gold-bordered)
- QR preview illustration with explanation text
- Cancellation policy box

### Progress Bar
All 4 steps shown: Select Tickets → Attendee Details → Payment → Your Tickets
Active step highlighted, completed steps shown in gold.

### Design Tokens
Matches site palette: `--gold: #E8B84B`, `--charcoal: #3A3530`, `--warm-gray: #8A8278`, `--off-white: #FAFAF7`
Fonts: Cormorant Garamond (headings), Inter (body)

### Events Listing Page Update

**File:** `Frontend/web/src/app/(public)/events/page.tsx`

Added "Get Tickets" button on each event card linking to `/events/{id}/checkout`. Button shows price (e.g., "Get Tickets · $185") or "Register — Free" for free events.

---

## 5. Dependencies

### Backend
- `qrcode` + `@types/qrcode` — QR code generation (data URL output)
- Existing: `@stripe/stripe-js`, `PaymentsService`, `PrismaService`

### Frontend
- Existing: `@stripe/react-stripe-js`, `StripeProvider`, `StripePaymentForm`
- No new packages required

---

## 6. Booking Fee Calculation

| Item | Value |
|------|-------|
| Booking fee rate | 5% of subtotal |
| Example: 2 × $185 General Admission | Subtotal: $370, Fee: $18.50, Total: $388.50 |
| Fee split | Evenly across tickets (e.g., $9.25 per ticket for 2 tickets) |
| Platform commission | 15% of total (configured in `STRIPE_PLATFORM_COMMISSION_PERCENT`) |

---

## 7. Cancellation Policy

As shown in client design:
- **7+ days before event:** Full refund (100%)
- **Within 7 days:** 50% refund
- **Within 48 hours:** No refund (0%)

> Note: Cancellation logic (refund processing) is displayed as policy text but not yet implemented as automated backend logic. Admin can process refunds manually via `POST /payments/:id/refund`.

---

## 8. File Manifest

### Backend (Created/Modified)

| File | Action |
|------|--------|
| `prisma/schema.prisma` | Modified — added `purchaseGroupId`, `bookingFee`, `status`, `TicketStatus` enum, indexes |
| `src/modules/tickets/tickets.module.ts` | Created |
| `src/modules/tickets/tickets.controller.ts` | Created |
| `src/modules/tickets/tickets.service.ts` | Created |
| `src/modules/tickets/dto/event-checkout.dto.ts` | Created |
| `src/modules/payments/payments.service.ts` | Modified — added `confirmEventTickets()` in payment confirmation flow |
| `src/app.module.ts` | Modified — registered `TicketsModule` |

### Frontend (Created/Modified)

| File | Action |
|------|--------|
| `src/app/(public)/events/[id]/checkout/page.tsx` | Created — full 4-step checkout page |
| `src/app/(public)/events/page.tsx` | Modified — added "Get Tickets" buttons |

---

## 9. End-to-End Flow Summary

```
Seeker visits /events
  → Clicks "Get Tickets · $185" on an event
  → Arrives at /events/{id}/checkout (Step 0)
  → Selects tier (General Admission, VIP, Online)
  → Chooses quantity (1-10)
  → Clicks "Continue → Attendee Details" (Step 1)
  → Fills attendee forms (name, email, dietary/access needs per ticket)
  → Clicks "Continue → Payment"
    → Frontend calls POST /tickets/event-checkout
    → Backend creates N TicketPurchase records (PENDING) + Stripe PaymentIntent
    → Returns clientSecret
  → Stripe Elements render (Step 2)
  → Seeker enters card / uses Apple Pay / Google Pay
  → Stripe confirms payment
    → Stripe webhook fires payment_intent.succeeded
    → Backend confirms payment, generates QR codes, increments sold count
    → Frontend calls POST /payments/confirm-payment (idempotent)
  → Frontend fetches GET /tickets/purchase-group/{groupId}
  → Displays confirmation screen (Step 3) with QR code per attendee
```
