# Failing live webhook: the Connect endpoint's signing secret

**Status:** diagnosed 2026-09-02, awaiting one value from the Stripe Dashboard.
**Deadline:** Stripe disables the endpoint on **8 September 2026, 03:28 UTC**.

## Symptom

Stripe emailed that deliveries to

    https://spiritualcalifornia.com/api/v1/payments/webhook/stripe

have failed **144 times since 30 August 2026, 03:28 UTC**.

## Root cause

There are **two live endpoints on that one URL**, and they do not share a signing
secret:

| Endpoint | Created | `application` | Events | Secret in prod config? |
| --- | --- | --- | --- | --- |
| `we_1U6kRR3CFXADax9rYojcJaIF` | 2026-08-21 | `null` → **account** | 9 (payments, checkout, subscriptions, disputes) | yes — `STRIPE_WEBHOOK_SECRET` |
| `we_1U8usY3CFXADax9r0XfDOHuy` | 2026-08-27 | `ca_V9Cq…` → **Connect** | `account.updated` only | **no** |

The Connect endpoint was added on 2026-08-27, the day live Connect was enabled.
Its signing secret was never added to `/sc/prod/api/dotenv`, so
`STRIPE_CONNECT_WEBHOOK_SECRET` is **absent** there.

`StripeService.constructEvent` tries the primary secret, then the Connect one —
but only if the Connect one is configured:

```ts
try {
  return this.stripe.webhooks.constructEvent(payload, signature, primary);
} catch (err) {
  if (!connect) throw err;          // ← taken on every delivery
  return this.stripe.webhooks.constructEvent(payload, signature, connect);
}
```

With it unset the throw is unconditional, so every Connect delivery returns
`400 Invalid webhook signature`. The first connected-account `account.updated`
after 2026-08-27 was on 2026-08-30 03:28 — the reported first failure.

This is **configuration only**. The deployed code (`ead65d3`) already contains
the dual-secret support (`b44fea8`), and `STRIPE_CONNECT_WEBHOOK_SECRET` is
already declared in `src/config/env.validation.ts`, so the value will be read
rather than stripped by the Zod schema.

## Impact

Confined to `account.updated`. Payments, checkout, subscriptions and disputes
ride the 2026-08-21 endpoint, whose secret is correct — those are unaffected.

What is broken is the guide payout-ready path: a guide finishes Stripe
onboarding, the platform never hears about it, `stripeOnboardingDone` and
`payoutAccount.payoutsEnabled` stay stale, and their gate-drafted paid Services
and Products are never republished by `reactivateBlockedPaidOfferings`.

The `payouts-tasks` reconcile sweep re-reads Connect account state on a schedule
and will heal rows whose webhook was dropped, so this is a delay rather than
permanent data loss.

## Fix

1. **Dashboard → Developers → Webhooks → `we_1U8usY3CFXADax9r0XfDOHuy`**
   (the one listing only `account.updated`) → **Reveal** the signing secret.

2. Set it — the script prompts with hidden input, so the secret never reaches
   shell history or scrollback. Run from **Git Bash**, not PowerShell:

   ```bash
   cd /d/Development/htdocs/Spiritual_California_Marketplace_Platform
   bash infra/scripts/set-prod-env-var.sh api STRIPE_CONNECT_WEBHOOK_SECRET
   ```

3. Restart the API so it re-reads Parameter Store (a redeploy also works —
   config is pulled fresh on every run).

4. In the Stripe Dashboard, use **Resend** on the failed `account.updated`
   attempts, or wait for the reconcile sweep.

### Verifying

A bogus signature should still be rejected — that is the endpoint working:

```bash
curl -s -X POST https://spiritualcalifornia.com/api/v1/payments/webhook/stripe \
  -H 'Stripe-Signature: t=1,v1=deadbeef' -d '{}'
# {"message":"Invalid webhook signature",...}  ← expected
```

The real check is the Dashboard: the Connect endpoint's recent deliveries should
turn `200`, and the API log should show `Webhook received: account.updated`
instead of `Webhook signature verification failed`.

## Why it could have silently come back

`compose-prod-env.sh` had **no slot for this variable at all**. It rewrites the
whole config from a template and carries forward only the keys it knows about,
so a correct manual fix would have been erased by the next run — most likely at
go-live, when the script is the tool for swapping in live keys.

Fixed on 2026-09-02: the script now preserves `STRIPE_CONNECT_WEBHOOK_SECRET`
when a real value exists, and otherwise emits a comment naming the command that
sets it. It is deliberately *not* defaulted to `PLACEHOLDER`, because the code
branches on presence — an unset variable reports the genuine primary-secret
failure, while a placeholder would report a second bogus failure and misdirect
whoever investigates next. `set-prod-env-var.sh` now also shape-checks it for
the `whsec_` prefix.

## Diagnostic note

`aws ssm get-parameter --name /sc/prod/api/dotenv` returns **`ParameterNotFound`**
under Git Bash on Windows even though `describe-parameters` lists it: MSYS
rewrites the leading `/sc/...` into a Windows path before the CLI sees it. Export
`MSYS_NO_PATHCONV=1` first. Both scripts in `infra/scripts/` already do.

See also `docs/stripe-connect-live-enablement.md` §Step 4, which predicted this
failure mode.
