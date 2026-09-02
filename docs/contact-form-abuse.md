# Contact form abuse — investigation and mitigation

Reported 2026-09-02 as *"spammers trying to register, suspicious activity"* from
the admin Users list. The registrations are real, but they are the smaller half.
**The contact form was the primary target, and it was an open email relay.**

## What was found

`POST /contact` is public, which is correct. It also had **no rate limit of any
kind** — `ThrottlerModule` is configured in `app.module.ts` but its guard is
applied per-endpoint, and only the auth and AI controllers had opted in. And
`ContactService.sendEmails` sent a "we received your message" auto-reply
**`to: dto.email`** — an address the caller supplies and nobody verifies.

Unauthenticated + unthrottled + attacker-chosen recipient = anyone could make
`noreply@spiritualcalifornia.com` send mail to anyone.

### Scale

| | Contact leads | Registrations |
|---|---|---|
| Before 31 Aug (all time) | **2** | ~1/day |
| 31 Aug | 9 | 8 |
| 1 Sep | **162** | 36 |
| 2 Sep (to 12:35) | **258** | 22 |

432 leads total, **430 of them after 31 Aug**, sustained at 20–30/hour for over
24 hours across 200 distinct recipient addresses. Every one sent two emails, so
roughly **860 emails, about 430 of them to strangers.**

### It is not ordinary link spam

Of the 430 abusive submissions: **357** have a message that is a pure random
alphanumeric blob, **73** are a bare 10-digit phone number, and **zero contain a
link**. Nobody is trying to sell anything or improve their SEO.

That shape matters. With no payload to deliver, *the email itself is the point* —
this is list-bombing or reputation-burning, using our domain as the sender. Single
addresses were hit repeatedly: `owen.tennis@gmail.com` 25 times,
`tolittledcdd@yahoo.com` 22, `rare1one@gmail.com` 19.

The recipients are harvested real addresses across unrelated corporate,
government and consumer domains — `nhsbt.nhs.uk`, `state.gov`, `c3.ai`,
`seccsda.org`, plus Gmail/Yahoo/AOL. **68 addresses appear as both a contact lead
and a registration**, so the same list is being fed to both forms.

### Why some bot accounts show "Active / SEEKER"

30 of 76 users are email-verified, which looks impossible for a bot using
someone else's address. The likely explanation is **corporate link-scanning**:
Proofpoint, Mimecast and Defender fetch every URL in an inbound email to check
it, and our verification link verifies on GET. The verified accounts skew to
exactly the domains that run such scanners. Treat "verified" as weak evidence of
a human, here and generally.

### Damage so far

Unknown, and **we currently cannot measure it**. `email_suppressions` is empty,
but nothing populates it — there is no Resend bounce/complaint webhook. An empty
suppression table is evidence of missing instrumentation, not of a healthy
domain. The sending domain is also unwarmed and pre-launch, which is the worst
possible time to mail hundreds of strangers.

## What was changed

**1. The endpoint is throttled.** New `PublicFormThrottle()` — 5 requests per
hour per IP, applied to `POST /contact`. The window is an hour, not a minute,
because a human contacts a marketplace once; a per-minute cap would still permit
thousands a day from one address.

**2. The auto-reply has its own brakes.** A per-IP throttle stops one attacker
and does nothing about a distributed one, and the damage here is not load — it
is our domain mailing strangers. So `confirmationIsSafe()` applies two
independent limits, both from data already stored:

- **Per address** — one courtesy reply per address per 24h. This is what stops
  the form being aimed at a single person's inbox.
- **Site-wide circuit breaker** — above 20 submissions/hour across the whole
  site, auto-replies stop until it subsides. Genuine volume was one or two a
  *day*. Modelled on the `InviteSenderService` breaker, for the same reason: the
  cost of pausing is a missing courtesy email; the cost of not pausing is the
  domain.

**The support notification is never suppressed.** It goes to our own inbox, so
it carries no reputation risk, and it is how abuse stays visible instead of
being silently dropped. The lead is always persisted too.

Covered by `contact-abuse-guard.spec.ts` (7 tests), including the distributed
case where the per-address brake can never fire.

## Still open — these need a decision

1. **A CAPTCHA on the public forms is the real fix.** Throttling and breakers
   limit the blast radius; only a challenge stops the submissions. Cloudflare
   Turnstile is free and needs a site key plus a frontend field. Recommended
   before launch.
2. **AWS WAF is currently disabled** (`enable_waf` in `infra/prod/compute`).
   Turning it on with a rate-based rule blocks this at the edge **without a code
   deploy** — the fastest available lever if the abuse escalates.
3. **No Resend bounce/complaint webhook**, so `email_suppressions` never fills
   and reputation damage is invisible. Worth wiring up regardless of this
   incident.
4. **Registration has the same auto-email shape.** `POST /auth/register` is
   throttled (`@StrictThrottle`, 5/min) but still emails an unverified
   third-party address on demand. The per-minute window is generous; consider
   the same hourly treatment.
5. **Clean-up decision** for the 430 junk leads and ~58 bot accounts. None hold
   payment data. `purge-demo-data.ts` is not the right tool — these are ordinary
   rows, and a targeted delete by `createdAt` window plus the message-shape
   signature above would be safer.

---

## Follow-up, same day: what the live data proved

**The source is distributed.** The per-IP throttle was verified enforcing
against production — five requests pass, the sixth returns `429` — yet
submissions carried on at ~19/hour after it went live at 13:48 UTC. No single
IP can do both. That rules out *any* per-IP defence, including WAF's
rate-based rule.

**So the auto-reply brakes are the load-bearing defence,** and the site-wide cap
of 20/hour sat directly on top of the attack's own rate. The breaker flapped —
open at 22/hour, closed again on the next dip — leaking auto-replies each time.
Lowered to **8/hour**, still ~100x the genuine baseline of one or two a day.

**The client IP is now logged** on every submission. There is no column for it
and no ALB access logging, so during this incident there was no way to tell one
attacker from a botnet — the fact that decides whether blocking can work at all.
A log line answers it without a migration.

**WAF is enabled and associated with the ALB** (`sc-prod-waf`), all three rules
in COUNT mode per the design note. Be clear about what it does and does not buy:
it will **not** stop this abuse — everything is counting rather than blocking,
and the rate rule's threshold is 2000 per 5 minutes against an attack running at
roughly 2 per 5 minutes. Its value is sampled requests and CloudWatch metrics,
plus baseline coverage once the rules are switched to block after the 48-hour
observation window.

It was applied with `-target` on the two WAF resources only. A full apply would
have carried an unrelated AMI bump into the launch template, and with the ASG on
`version = "$Latest"` and a rolling `instance_refresh`, that is not something to
smuggle into a security change. **That AMI drift is still pending** and will
appear in the next plan — worth applying deliberately, when someone can watch a
replacement come up, because a fresh instance boots with no application code.

`enable_waf` now defaults to `true`. It was applied via `-var` while the default
still read `false`, which left the live Web ACL one default-valued
`terraform apply` away from being destroyed by someone not intending to touch it.
