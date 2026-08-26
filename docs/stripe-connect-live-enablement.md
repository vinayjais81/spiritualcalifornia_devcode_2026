# Enabling Stripe Connect for Spiritual California — Live Mode

**Audience:** whoever owns the Spiritual California Stripe account
**Prepared by:** Nityo · 26 August 2026
**Status:** blocked, waiting on the account owner

---

## What is blocked right now

Guides who click **Set up Stripe Connect** on their earnings page cannot connect a
payout account. Stripe rejects every attempt with:

> You can only create new accounts if you've signed up for Connect, which you can
> do at https://dashboard.stripe.com/connect

Until this is resolved, **no guide can be paid**. Customers can still be charged —
money reaches the platform account normally — but it cannot be transferred onward.

## What is *not* the problem

We verified each of these against the live Stripe API before writing this document,
so they can be ruled out without further investigation:

- **The API keys are correct.** Stripe's own response headers identify the request
  as `livemode`, so a valid live secret key is loaded and authenticating.
- **The integration code is correct.** The request Stripe received contains exactly
  the right fields — Express account type, both required capabilities, the guide's
  details. Stripe refused it before looking at any of that.
- **The server is healthy.** The API and website are running normally with no
  restarts.

The only missing piece is a **setting inside the Stripe account**, and only the
account owner can change it. Nothing in the software needs to change.

---

## What needs to be done

### Step 1 — Complete the Connect platform profile

**Dashboard → Settings (gear, top right) → Connect → Platform profile**
`https://dashboard.stripe.com/settings/connect/platform-profile`

This form is what Stripe means by "signed up for Connect". Stripe uses it to
underwrite the platform, so the answers carry real commercial weight — they should
be read and answered deliberately, not accepted as defaults.

It asks for:

| Question | Suggested answer for Spiritual California |
| --- | --- |
| What does your platform do? | An online marketplace connecting people seeking wellness services with verified independent practitioners. |
| Who are your sellers? | Independent wellness practitioners ("guides") offering sessions, events, tours and products. |
| Where are they located? | United States (primarily California). |
| How do sellers get paid? | The platform collects payment from the customer, then pays the practitioner separately after a clearance period. |
| Expected volume | The account owner's own estimate. |

Two questions are **business decisions and must be answered by the client, not by
Nityo**:

- **Who bears loss liability** — the platform, or the individual practitioners.
  This decides who absorbs chargebacks and negative balances.
- **Who handles seller support and disputes** — the platform, or Stripe.

These affect the platform's financial exposure and its obligations to
practitioners. Please answer them according to how the business actually intends
to operate.

### Step 2 — Confirm the integration choices

When Stripe asks how the platform is built, these answers must match the software
as it is already written. Choosing differently will cause Stripe's tooling and
guidance to conflict with the live implementation.

| Stripe asks | Answer |
| --- | --- |
| Account type | **Express** |
| Charge type | **Separate charges and transfers** |
| Merchant of record | **The platform** |

For context: the platform charges the customer and holds the funds, then sends the
practitioner their share later as a separate transfer once the clearance period
passes. That two-stage flow is what "separate charges and transfers" means, and it
is what the payout system and ledger are built around.

### Step 3 — Activate the account

**Dashboard → Setup guide → Go live → Verify your identity**

Connect cannot go live inside an account that is not itself activated. This
requires the business details, the account representative's identity, and a bank
account.

You can safely ignore **"Create a live customer"** and **"Create a live invoice"**
in that same checklist. They belong to Stripe Invoicing, which this platform does
not use.

### Step 4 — Set up the webhook

Once Connect is enabled, Stripe must notify the platform when a practitioner
finishes onboarding. **Without this, guides will complete Stripe's forms and the
website will still show them as not connected** — with nothing on screen to explain
why. It is the single most likely thing to be forgotten.

**Dashboard → Developers → Webhooks → Add endpoint**

- **Endpoint URL:** `https://spiritualcalifornia.com/api/v1/payments/webhook/stripe`
- **Events to send:**

| Event | Why it is needed |
| --- | --- |
| `account.updated` | Marks a practitioner as payout-ready; also republishes paid listings that were held back while they were unconnected |
| `payment_intent.succeeded` | Confirms a customer payment |
| `payment_intent.payment_failed` | Records a failed payment |
| `checkout.session.completed` | Completes shop and subscription checkouts |
| `customer.subscription.created` / `.updated` / `.deleted` | Guide subscription status |
| `charge.dispute.created` / `charge.dispute.funds_withdrawn` | Chargeback handling |

**Important:** Stripe treats *events on your account* and *events on connected
accounts* as two different endpoint types. `account.updated` is a connected-account
event. If Stripe issues a **second** endpoint for connected accounts, that endpoint
gets its **own signing secret**, and both secrets must be given to Nityo — the
platform now accepts both, but only if it is told about them.

After creating each endpoint, click **Reveal** on its signing secret (`whsec_…`)
and send it to Nityo through a secure channel. **Do not paste signing secrets or
API keys into email or chat.**

### Step 5 — Set the Connect branding (recommended)

**Dashboard → Settings → Connect → Branding**

The business name, icon and brand colour set here appear on the Stripe-hosted
pages practitioners see while onboarding. Without them, guides are sent to an
unbranded Stripe page partway through signing up for Spiritual California, which
tends to read as a phishing attempt and costs completions.

---

## If the platform profile page is not available

Some accounts do not expose that page until Connect has been requested. Rather than
searching the dashboard further, contact Stripe directly:

**https://support.stripe.com/contact**

Tell them:

> I need Connect enabled in live mode for a marketplace using **Express accounts**
> with **separate charges and transfers**.

Stripe support can enable it directly, and this is usually faster than working
through the dashboard.

---

## How to confirm it worked

1. Ask any guide with a completed profile to open **Guide Dashboard → Earnings**.
2. Click **Set up Stripe Connect**.
3. They should be redirected to a Stripe-hosted onboarding form.

If it still fails, the on-screen message now names the reason rather than saying
"Failed to start Stripe onboarding" — please send a screenshot of that message,
which tells us immediately whether the profile is still under Stripe review or
something else is wrong.

---

## Division of responsibility

| Task | Owner |
| --- | --- |
| Connect platform profile, liability answers | **Client** |
| Account activation and identity verification | **Client** |
| Creating webhook endpoints in Stripe | **Client** |
| Connect branding | **Client** |
| Providing the signing secrets securely | **Client → Nityo** |
| Applying secrets to the production server | **Nityo** |
| Integration code, payout logic, ledger | **Nityo — already complete** |

There is no development work outstanding. Once the steps above are done and the
signing secrets are handed over, payouts work.

---

## For the record — how this was diagnosed

Captured from the production API log on 26 August 2026:

```
StripeInvalidRequestError: You can only create new accounts if you've signed up
for Connect, which you can do at https://dashboard.stripe.com/connect
    type: 'StripeInvalidRequestError'
    x-stripe-routing-context-priority-tier: 'livemode'
```

The `livemode` marker is the important detail: it proves the live key was accepted
and the request reached Stripe's live environment. The rejection is a setting on
the account, not a credential, network or code fault.
