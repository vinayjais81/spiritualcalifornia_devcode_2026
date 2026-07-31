# Practitioner Invites — Phase 3 (sending)

Implements Phase 3 of `docs/practitioner-import-invite-strategy.md`: the invite
email itself, and the throttled, self-policing machinery that delivers it.

This is the first phase capable of contacting a practitioner. Everything below
is built around that fact.

## The safety default

```
INVITE_EMAIL_MODE=redirect     # redirect | live — defaults to redirect IN CODE
INVITE_EMAIL_REDIRECT_TO=vinay.jaiswal@nityo.com
```

`InviteSenderService.isLive` returns false unless the value is exactly `live`,
so **an environment where nobody set the variable cannot mail anyone**. Going
live is an explicit act on production, not the absence of a config.

In redirect mode every invite goes to the test address with the real recipient
named in the subject (`[TEST → maya@example.com] …`) and a banner at the top of
the body. The claim and unsubscribe links are real and work, so the whole
journey is testable end to end. Redirected sends are flagged `redirected` and
**excluded from every deliverability statistic** — test traffic must not be
able to trip or placate the circuit breaker.

The admin panel shows the mode as a red badge in live mode and an amber one
otherwise, above the queue controls.

## What the invite says, and why

`invite-email.template.ts`. Every element is a legal requirement or a decision
recorded in the strategy doc §8a:

| Element | Why |
| --- | --- |
| From a named person — Lana Rafaella | A brand-sent cold email converts worse and reads as bulk |
| **Where we found them** | The first thing they'll wonder; CCPA notice at collection |
| "Reserved, **not published**" | Removes the "you made a page about me" reaction, which is the most likely angry reply |
| The three steps, verification included | The honest answer to "how much work is this?" converts better than implying one click |
| 20% commission, no listing fee | The commission **is** charged today; silence means they meet it at their first payout. The $50 plan is not enforced, so it is not mentioned |
| Removal link, in ordinary type | Burying an opt-out is unlawful and earns a spam complaint instead of a quiet unsubscribe |
| Physical postal address | CAN-SPAM |
| `List-Unsubscribe` + one-click headers | Gmail and Outlook surface them natively; a recipient who uses them never files a complaint instead |
| Plain-text alternative | Measurably better inbox placement, and some people read mail as text |

The commission figure is read from the live `CommissionRate` rows the ledger
charges against — never a literal. We already shipped that mistake once on the
guide dashboard (`docs/commission-display-truth.md`).

## Sending in waves

`POST /invites/batches/:id/queue` with `segment: personal | role-inbox | all`
writes a QUEUED `EmailSend` per eligible recipient. It sends nothing itself.

**Personal addresses go first.** Early engagement is what teaches mailbox
providers to trust a new domain, and role inboxes (`info@`, `office@`) reach a
front desk — worse engagement, higher complaint risk. They are a separate,
later wave.

### Eligibility is checked twice

At queue time *and* again in the worker immediately before sending. Days pass
between the two, and in that window someone can unsubscribe, claim their
account, be deactivated or be deleted — each of which must stop the email. The
send-time check is the one that matters; the queue-time check just avoids
enqueuing obvious no-ops.

### The worker

`invite-tasks` drains every 2 minutes, at most 5 per pass:

- **Daily cap** (`INVITE_SEND_PER_DAY`, default 40) counted across *all* waves
  and *all* restarts, by querying sends in the last 24h. Deliberately not
  BullMQ's rate limiter: the constraint belongs to the sending domain, not to a
  queue instance.
- **Send window** — weekdays 09:00–16:00 Pacific in live mode. Mail arriving at
  03:00 reads as bulk to filters and to people. Redirect mode ignores the
  window, so a developer can press the button on a Sunday.
- A **paused wave** is simply not picked up; its queued jobs wait.

## The circuit breaker

A pause button nobody is watching at 2am is not a safety mechanism, so the
queue policices itself. Over the last 50 real sends for a batch:

| Signal | Limit | Meaning |
| --- | --- | --- |
| Hard bounces | **5%** | The address quality is bad — stop before the domain is scored on it |
| Spam complaints | **0.1%** | The copy or the targeting is wrong — do not push through |

Below 10 sends it declines to judge: one bad address in three is a 33% bounce
rate and nothing to conclude from. A tripped breaker sets `PAUSED` with the
reason and **requires a human to clear it** — both thresholds describe the list
or the message, not a transient error worth retrying.

It runs after every send *and* every inbound webhook, so a wave that is already
over the line stops on the next pass even if a webhook is delayed or never
arrives.

## Delivery webhooks

`POST /invites/webhook/resend`, signed by Svix and verified over the raw bytes
(the path is registered for raw-body handling in `main.ts` alongside the Stripe
webhooks — parsing first would change the bytes and fail every check).

- `delivered` → status
- `bounced` / `complained` → status, **plus an immediate suppression tombstone
  and `marketingEmails = false`**. A second email to someone who pressed "spam"
  is how a domain gets blocklisted.
- Unrecognised events return 200 rather than a 4xx, so Resend doesn't retry
  something we will never understand.

**With no `RESEND_WEBHOOK_SECRET` the endpoint refuses everything.** An
unverified endpoint that mutates suppression state would let anyone who found
the URL suppress arbitrary addresses.

## The send log

`EmailSend` — one row per attempt. Before this, `EmailService` sent inline and
kept nothing, so "did this practitioner get their invite?" had no answer.

It stores a **hash** of the recipient, never the address: someone who later asks
to be removed must not be left behind in the send log. The address is resolved
from the `User` row at send time. That also makes the webhook path clean — the
suppression table is keyed on the same hash, so a bounce suppresses without
touching personal data.

## Verified

26 tests in `invite-sender.spec.ts`, aimed at what cannot be undone:

- redirect is the default; live mode requires the exact value; redirected sends
  are flagged and excluded from stats
- send-time refusal for claimed, deactivated, opted-out, suppressed and
  paused-wave cases, and never sending the same invite twice
- the message carries the one-click headers, the text part, the removal link and
  the postal address, and takes commission from the rate row
- breaker maths at both thresholds, plus the small-sample abstention
- bounces and complaints suppress; deliveries don't; unknown messages are ignored
- the cap ignores redirected traffic and never goes negative; the window holds
  live mail outside business hours but never blocks a test

Full backend suite green at 168. `tsc` clean both sides; `next build` clean.

## Before wave one

1. **DNS** — SPF, DKIM and DMARC on the outreach subdomain, verified in Resend.
   Days of lead time; nothing else here matters without it.
2. **`RESEND_WEBHOOK_SECRET`** set, and the endpoint registered in Resend.
3. **Seed test** to Gmail, Outlook and Yahoo addresses we control — inbox, not
   Promotions.
4. **Walk the whole flow in redirect mode**: claim link, unsubscribe link,
   suppression, counters.
5. **Verification API keys.** The invite promises "get verified and listed" and
   that pipeline is still stubbed. Inviting 136 practitioners into a funnel that
   dead-ends is worse than not inviting them.
6. Confirm someone owns `hello@spiritualcalifornia.com` for the duration —
   cold outreach generates replies.

## Not built

The day-7 reminder to non-openers and the 90-day retention purge (Phase 5), and
the enrichment crawl (§4.3, optional).
