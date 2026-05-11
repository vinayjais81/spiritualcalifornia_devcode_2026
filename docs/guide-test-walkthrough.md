# Guide Workflow — Test Walkthrough

A step-by-step guide for testing the practitioner (Guide) experience on the QA environment, end-to-end: from sign-up through publishing paid services, events, products, and tours.

> **Environment:** [https://spiritualcalifornia.nityo.in](https://spiritualcalifornia.nityo.in)
> **Estimated time:** ~30–45 minutes for the full walkthrough
> **What you'll achieve:** a fully verified Guide account with Stripe Connect active, four paid offerings published, and a complete public profile

---

## Before you start

You'll need three browser sessions (or three different browsers / a regular + two incognito windows) so you can switch between roles without signing in and out:

| Role | What it's for |
|---|---|
| **Guide** | The main practitioner account you're setting up |
| **Admin** | To approve the new Guide after they submit for verification |
| **Seeker** | (Optional, for the booking smoke-test at the end) |

You'll also want a [Mailinator](https://www.mailinator.com/v4/public/inboxes.jsp) tab open — that's where verification emails will arrive. Any address ending in `@mailinator.com` works and the inbox is public, so you can read mail without logging in.

---

## Step 1 — Sign up as a Guide

1. Open [https://spiritualcalifornia.nityo.in/guide/register](https://spiritualcalifornia.nityo.in/guide/register)
2. Fill in the form:
   - **First name:** `Test`
   - **Last name:** `Guide01`
   - **Email:** `test-guide-001@mailinator.com`
   - **Password:** `Sun$hine-Path7`
3. Watch the password strength meter — all seven rules should turn green ✓.
4. Click **Create Account & Continue**.

**Expected:** Page redirects to the onboarding area. A verification email is sent to the Mailinator inbox within ~30 seconds.

---

## Step 2 — Verify your email

1. Open the Mailinator inbox: [https://www.mailinator.com/v4/public/inboxes.jsp?to=test-guide-001](https://www.mailinator.com/v4/public/inboxes.jsp?to=test-guide-001)
2. Open the Spiritual California verification email.
3. Click the verification link.

**Expected:** Lands on the Guide dashboard at `/guide/dashboard`. The account now has the Guide role assigned.

---

## Step 3 — Complete your profile

The dashboard shows a *"Finish setting up your practice"* panel with chips for each missing section. Click through them in order.

### 3.1 Categories — `/guide/dashboard/categories`

- Pick at least one Practice Category (e.g. **Mind Healing**)
- Pick 3–5 Modalities you practice (e.g. Yoga, Meditation, Breathwork)
- Pick 3–5 Issues you help with (e.g. Burnout, Anxiety, Stress)
- Click **Save Categories**

### 3.2 Profile & Bio — `/guide/dashboard/profile`

| Field | Suggested value |
|---|---|
| Display Name | `Test Guide 01` |
| Tagline | `Helping seekers find balance through breathwork.` |
| Bio | A paragraph of ~150 words about your practice |
| Years of experience | `5` |
| Languages | `English` |

Click **Save**.

### 3.3 Location — `/guide/dashboard/location`

| Field | Suggested value |
|---|---|
| Studio Name | `Test Studio` |
| Street | `123 Main St` |
| City | `Los Angeles` |
| State | `California` |
| ZIP | `90001` |

Click **Save**.

### 3.4 Verification — `/guide/dashboard/verification`

- Click **Upload Certificate (PDF or JPG)** to add a credential.
  - Title: `Yoga Teacher Training 200hr`
  - Institution: `Yoga Alliance`
  - Year: `2023`
  - Upload any sample PDF or image
- Click **Submit for Review** at the bottom.

> The "Verify My Identity" button currently routes through a sandbox-only Persona check. You can skip this step for QA — credentials + admin approval are sufficient to publish the profile.

---

## Step 4 — Approve the Guide as Admin

Switch to your **Admin** browser session.

1. Sign in as an Admin user.
2. Go to `/admin/verification`.
3. Find the row for `test-guide-001@mailinator.com`.
4. Open the credential by clicking **View doc** — should open the uploaded file in a new tab.
5. Click **Approve Guide**.

**Expected:**
- The Guide's status flips to APPROVED.
- All uploaded credentials are marked Verified.
- The public profile becomes visible at `https://spiritualcalifornia.nityo.in/guides/test-guide-01`
- The Guide receives an "Application approved" email.

---

## Step 5 — Connect Stripe (payment processing)

Switch back to the **Guide** browser session.

1. Go to `/guide/dashboard/settings`.
2. Click **Set up Stripe Connect**.
3. You'll be redirected to Stripe's secure onboarding form. Use these **sandbox test values exactly** (Stripe rejects random/real data in test mode):

| Field | Test value |
|---|---|
| Email | (already pre-filled) |
| Phone | `+1 415 555 0100` |
| Phone OTP code | `000000` |
| First name | `Test` |
| Last name | `Guide01` |
| Date of birth | `01/01/1990` (any date ≥18 years ago) |
| Social Security Number | `000-00-0000` |
| Address | `123 Main St, Los Angeles, CA 90001` |
| Bank routing number | `110000000` |
| Bank account number | `000123456789` |

4. Click **Submit** at the end of the form.

**Expected:** Stripe redirects you back to `/guide/dashboard/earnings?stripe=success`. Within 30 seconds, all four status cards turn green:

- Connected ✅ Yes
- Charges Enabled ✅ Yes
- Payouts Enabled ✅ Yes
- Details Submitted ✅ Yes

> If a card still shows "No" after a minute, refresh the Settings page once — the system self-corrects on the next visit.

---

## Step 6 — Create paid offerings

Now that Stripe is connected, the Guide can publish paid offerings. The dashboard supports four types:

### 6.1 Service

`/guide/dashboard/services` → **+ Add Service**

| Field | Suggested value |
|---|---|
| Name | `60-min Energy Healing Session` |
| Description | `One-on-one session for clearing blockages and restoring flow.` |
| Format | Online |
| Duration | `60` minutes |
| Price | `$120` |

Save → the service appears as Active and is immediately visible on the public profile.

### 6.2 Product

`/guide/dashboard/products` → **+ Add Product**

| Field | Suggested value |
|---|---|
| Name | `Sound Healing Audio Pack` |
| Type | Digital |
| Category | Audio |
| Price | `$25` |
| Cover image | Upload any sample image |

Save → product is published.

### 6.3 Event

`/guide/dashboard/events` → **+ Create Event**

| Field | Suggested value |
|---|---|
| Title | `Morning Breathwork Circle` |
| Type | Online |
| Start | A date one week out, 9:00 AM |
| End | Same date, 10:00 AM |
| Timezone | America/Los_Angeles |
| Ticket name | `General Admission` |
| Ticket price | `$30` |
| Capacity | `20` |
| Cover image | Upload any sample image |

Save as draft, then click **Publish** to make it live.

### 6.4 Soul Tour

`/guide/dashboard/tours` → **+ Create Tour**

| Field | Suggested value |
|---|---|
| Title | `7-Day Sedona Vortex Retreat` |
| Short description | `A week of guided meditation at Sedona's sacred sites.` |
| Location | `Sedona, AZ` |
| Difficulty | Easy |
| Start date | One month out |
| End date | Start + 7 days |
| Base price | `$1500` |

Add a Room Type (e.g. `Single Occupancy, $1500`) and a Departure date, then **Publish**.

---

## Step 7 — Verify the public profile

Open in an **incognito** window (so you're not signed in as the Guide):

`https://spiritualcalifornia.nityo.in/guides/test-guide-01`

The profile should display:

- ✅ Photo, name, tagline, bio
- ✅ Category tags (Mind Healing, etc.)
- ✅ Credentials with green "Verified" badges
- ✅ Services section listing the $120 session
- ✅ Events section listing the breathwork circle
- ✅ Soul Tours section listing the Sedona retreat
- ✅ Products section listing the audio pack

---

## Step 8 (Optional) — Smoke-test the booking + payment flow

Switch to your **Seeker** browser session.

1. Register a Seeker at `/register`:
   - Email: `test-seeker-001@mailinator.com`
   - Password: `Moon$Light-Path9`
2. Verify the email via Mailinator.
3. Visit the Guide's public profile and click **Book this service** on the $120 session.
4. Pick a date/time, continue to payment.
5. Pay using Stripe's test card:

| Field | Value |
|---|---|
| Card number | `4242 4242 4242 4242` |
| Expiry | Any future MM/YY |
| CVC | Any 3 digits |
| ZIP | `42424` |

**Expected:**
- Payment succeeds
- Booking appears in the Seeker's `/dashboard/bookings`
- Booking appears in the Guide's `/guide/dashboard/bookings`
- The transaction shows up in `/guide/dashboard/earnings`

To test a declined payment, use card `4000 0000 0000 0002` instead.

---

## Test Data — Quick Reference

Keep this section handy if you're running the walkthrough multiple times.

```
EMAILS              anything @mailinator.com (read inbox at mailinator.com)

PASSWORDS
  Guide             Sun$hine-Path7
  Seeker            Moon$Light-Path9

STRIPE CONNECT (sandbox onboarding)
  SSN               000-00-0000
  Phone OTP         000000
  Bank routing      110000000
  Bank account      000123456789

STRIPE CHECKOUT (test cards)
  Card success      4242 4242 4242 4242
  Card declined     4000 0000 0000 0002
  Card 3DS required 4000 0027 6000 3184
  Expiry            any future date
  CVC               any 3 digits
  ZIP               42424

LOCATION (US-only at launch)
  Address           123 Main St, Los Angeles, CA 90001
```

---

## Need help?

If anything blocks you during the walkthrough, take a screenshot of the page and the browser's developer-tools Network tab if visible, and share with the development team. Most issues are resolved within minutes once we can see what's happening.

Common things that aren't bugs:
- **A red "client_secret does not match" message at checkout** — happens briefly right after a Stripe key rotation. Try again 5 minutes later.
- **A status card stays "No" after Stripe onboarding** — refresh the Settings page once; the system self-corrects on the next visit.
- **Verification email doesn't arrive within 30 seconds** — Mailinator can lag; refresh the inbox.

---

*Last updated: 2026-05-11 — applies to the QA environment at spiritualcalifornia.nityo.in*
