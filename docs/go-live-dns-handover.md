# Going Live: `spiritualcalifornia.com`

**DNS handover and cutover plan**
**Date:** 2026-08-21
**Audience:** client + engineering
**Status:** platform built and running; waiting on the domain

---

## 1. Where things stand

**The production platform is built, deployed and serving.** It runs on AWS in
N. California, on the client's own AWS account, completely separate from the QA
environment used for review.

You can see it right now at the temporary address:

```
http://sc-prod-alb-1970810811.us-west-1.elb.amazonaws.com
```

Everything below is already done and verified:

| | |
|---|---|
| Application | Running, healthy, auto-restarting if it fails |
| Database | PostgreSQL, encrypted, automatic daily backups with 7-day point-in-time recovery |
| Payments | Live Stripe keys configured (secret, publishable, both webhook signing secrets, subscription prices) |
| Email | Live Resend key configured |
| Verification | Live Anthropic key configured for credential document analysis |
| Integrations | Zoom, Calendly and Google credentials configured |
| Security | Private network, no SSH access, encrypted storage, audit logging |
| Deployment | One-click, approval-gated, with an automatic database snapshot before every release |
| Admin | Super-admin account created; categories and commission rates seeded |

**The one thing missing is the domain.** Until `spiritualcalifornia.com` points at
this infrastructure, the site is only reachable at that temporary address, and
HTTPS cannot be enabled.

---

## 2. What we need, in one sentence

**Change the nameservers for `spiritualcalifornia.com` at GoDaddy to four
addresses we will provide.**

That is the entire ask. Everything else — certificates, HTTPS, redirects,
rebuilds — is on our side and needs no client involvement.

---

## 3. ⚠️ Read this before changing anything: your email is on this domain

Our DNS audit on 2026-08-21 found **live mail service** on
`spiritualcalifornia.com`:

| Record | Current value | What it does |
|---|---|---|
| `MX` | `smtp.google.com` (priority 1) | **Delivers all @spiritualcalifornia.com email** (Google Workspace) |
| `TXT` (SPF) | `v=spf1 include:secureserver.net -all` | Stops your outbound mail being marked as spam |
| `TXT` | `NETORGFT20341802.onmicrosoft.com` | Microsoft 365 domain verification |
| `TXT` | `google-site-verification=ztOzh4qm…` | Google service verification |
| `CNAME` `autodiscover` | `autodiscover.outlook.com` | Outlook client auto-configuration |
| `CNAME` `www` | points to the main domain | |
| `TXT` `_dmarc` | present | Email authentication policy |

**If the nameservers are changed before these records are recreated, company
email stops arriving — immediately and completely.** Mail sent to
`@spiritualcalifornia.com` would bounce.

This is entirely avoidable, and Step 1 below exists solely to prevent it.

> Note the records above look like a part-finished migration: mail is delivered
> by Google, the SPF record authorises GoDaddy's servers, and `autodiscover`
> points at Microsoft. We will replicate them **exactly as they are** — a DNS
> move is the wrong moment to also tidy up mail configuration. Anything that
> needs correcting can be done afterwards, one change at a time.

---

## 4. Why nameservers, rather than just adding a record

The reasonable question is: why not simply point the domain at the new server
and leave DNS where it is?

Because of a limitation in how DNS works. Our load balancer has a *name*
(`sc-prod-alb-…elb.amazonaws.com`), not a fixed IP address — AWS changes the
underlying addresses as it scales and replaces hardware. Pointing a **bare
domain** (`spiritualcalifornia.com`, with no `www`) at a name requires an
`ALIAS` record, which GoDaddy does not support. Only the DNS provider hosting
the domain can do it — in this case, AWS Route 53.

We could point `www.spiritualcalifornia.com` at the site while leaving the bare
domain behind, but the platform is configured to serve from the bare domain
(a security setting that permits exactly one address), so that is not a real
option.

**Moving DNS to Route 53 also brings a benefit:** every future DNS change becomes
part of the same reviewed, version-controlled process as the rest of the
infrastructure, rather than a manual edit in a separate control panel.

---

## 5. The plan, step by step

### Step 1 — Export the current DNS records *(client, 5 minutes)*

**Before anything changes.** In GoDaddy:

1. Sign in → **My Products** → find `spiritualcalifornia.com` → **DNS**
2. The full record list appears
3. **Export** if the option is available; otherwise **take clear screenshots of
   every record**, scrolling to capture all of them
4. Send those to us

This is the safety net. Our audit found the records above from the public
internet, but some record types are not publicly visible, and we would rather
work from your actual list than from what we can infer.

### Step 2 — We prepare the new DNS *(us, ~1 hour, no client involvement)*

We create the hosted zone in AWS and **recreate every record from Step 1
exactly**, including all mail records. We also add the records that point the
website at the new infrastructure, and request the HTTPS certificate.

Nothing is live yet — this zone sits alongside the existing one, unused.

### Step 3 — We verify before the switch *(us)*

We query the new zone directly and confirm, record by record, that it returns
identical answers to GoDaddy for mail. **We will confirm this in writing before
asking for Step 4.**

### Step 4 — Lower the TTL *(client, 2 minutes)*

In GoDaddy DNS, set the TTL on existing records to **600 seconds** (10 minutes),
and wait for whatever the previous TTL was — usually an hour.

This is what makes the change quickly reversible. TTL is how long the rest of
the internet caches an answer; lowering it first means a rollback takes minutes
rather than a day.

### Step 5 — Change the nameservers *(client, 2 minutes)*

In GoDaddy: `spiritualcalifornia.com` → **Nameservers** → **Change** → **Enter my
own nameservers**, and enter the four addresses we provide (they look like
`ns-123.awsdns-45.com`).

**This is the switch.** From here, AWS answers DNS for the domain.

### Step 6 — We complete the cutover *(us, ~1 hour)*

- Verify the certificate is issued and enable **HTTPS**
- Set up the automatic redirect from `http://` to `https://`, and `www` to the
  main domain
- Rebuild the site so it uses the live address
- Register the live URLs with Stripe, Google and Calendly
- Verify email is still flowing

### Step 7 — Joint verification *(both, ~30 minutes)*

We walk through the site together: registration, a real test payment, the admin
panel. And we confirm mail by sending a message to an
`@spiritualcalifornia.com` address from outside.

---

## 6. Timing and impact

| | |
|---|---|
| Client effort | **~10 minutes total**, across Steps 1, 4 and 5 |
| Our work | ~2 hours, spread either side |
| Best time | Weekday morning — DNS propagates while people are around to notice anything odd |
| Website downtime | **None.** The site is not live on this domain yet, so there is nothing to interrupt |
| Email downtime | **None expected**, provided Step 1 is done first. Records are replicated before the switch |
| Propagation | Usually minutes; occasionally up to 24 hours for some networks |

---

## 7. If something goes wrong

**Change the nameservers back to `ns33.domaincontrol.com` and
`ns34.domaincontrol.com` in GoDaddy.** Everything returns to exactly as it is
today.

That is why Step 4 (lowering the TTL) matters: with a 10-minute TTL, a rollback
takes effect in about ten minutes instead of up to a day.

We will be monitoring throughout and will roll back ourselves if mail delivery
shows any problem.

---

## 8. Two related items, same DNS visit

Worth batching, since both need DNS records and someone in the console anyway:

**Email sending for the platform.** The site sends transactional email —
account verification, password resets, order confirmations. That requires
verifying `spiritualcalifornia.com` with our email provider, which needs a few
DNS records. **Until this is done, those emails will not be delivered**, and new
users will not be able to complete registration. We will add these records
ourselves once DNS has moved.

**Website firewall.** A managed firewall in front of the site (blocking common
attacks and abusive traffic) is available for roughly **$12/month**. It is
currently switched off to keep running costs down. We recommend enabling it
before real customer traffic — your call.

---

## 9. What happens after go-live

Once the domain is live and verified, the remaining items are ours:

1. Confirm Stripe webhooks are being delivered (they cannot reach the site until
   the domain resolves)
2. Confirm transactional email is arriving
3. Watch error and performance monitoring for the first week
4. Practise a database restore, to prove the backups work rather than assume it

Guides will need to complete Stripe onboarding in live mode before they can
publish paid offerings — sandbox accounts from testing do not carry over. That
is expected, and applies to every guide regardless of DNS.

---

## 10. Summary — what we need from you

1. **GoDaddy DNS export or screenshots** *(Step 1)* — the important one
2. **Lower the TTL** when we ask *(Step 4)*
3. **Change the nameservers** to the four we provide *(Step 5)*
4. **Confirm** whether to enable the website firewall (~$12/month)

Total client effort: about ten minutes, plus the joint verification.

Send us the DNS export whenever convenient and we will prepare everything else
in advance, so the switch itself is a two-minute change on an agreed morning.
