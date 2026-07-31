# Practitioner Import & Proactive Invite — Strategy

Status: **proposal, nothing built yet.** Written 2026-07-31 after auditing
`Bay_Area_Practitioners.xlsx` (client-supplied) against the current platform.

The ask, restated:

1. Admin uploads the practitioner spreadsheet and the system creates guide
   accounts from bare-minimum details, **not fully active**.
2. Each imported practitioner gets an invite email — platform benefits plus
   how to activate their account.
3. The same email carries an **unsubscribe link that deletes their information**
   from the platform immediately.
4. Imported accounts must be **clearly separable** from self-onboarded ones.
5. Import and invite should both run as **bulk operations**.
6. During testing, **no real practitioner receives mail** — everything goes to
   `vinay.jaiswal@nityo.com`.

All six are achievable. The audit changed my recommendation on *how*, in ways
that matter commercially, so the data comes first.

---

## 1. What is actually in the file

15 sheets, one per modality, **324 data rows**.

| Sheet | Rows | Rows with an email |
| --- | ---: | ---: |
| Somatic Healers | 108 | 32 |
| Life Coaches | 43 | 4 |
| Herbalists & Nutritionists | 37 | 20 |
| Energy Healers | 26 | 22 |
| Alternative Medicine | 14 | 10 |
| Indigenous & Shamanic Medicine | 14 | 5 |
| Yoga & Meditation Teachers | 14 | 9 |
| Doulas (Birth & Death) | 14 | 11 |
| Hypnotherapists | 11 | 6 |
| Traditional Chinese Medicine | 10 | 5 |
| Plant Medicine & Integration | 8 | 2 |
| Ayurvedic Practitioners | 7 | 5 |
| Sound Healing & Breathwork | 7 | 6 |
| Massage & Bodywork | 7 | 4 |
| Tibetan Medicine | 4 | 1 |

### The five findings that shape the design

**a) Only 142 of 324 rows (44%) have an email address.** An account cannot be
created without one — `User.email` is unique and required, and an account with
no email can never be claimed or contacted. **56% of this file is not
importable as accounts.** They are still valuable as a research list, which the
design accounts for (§5.1), but they are not wave-one invites.

**b) Of those 142, six are duplicates** — one inbox shared by several
practitioners. `info@sfreikicenter.com` appears on **five** rows.
Sending five near-identical "claim your account" emails to one front desk is
the fastest way to earn a spam complaint. Unique mailable addresses: **~136**.

**c) 32 are role inboxes** (`info@`, `contact@`, `office@`) and 48 are freemail
(gmail/yahoo). A role inbox reaches a receptionist, not the practitioner —
lower conversion, higher complaint risk. These need different copy and should
be a separate send wave, not mixed in.

**d) The list was assembled by scraping.** Each sheet ends with a "Sources:"
row naming Psychology Today, Noomii, the American Herbalists Guild directory,
HealthProfs, and East Bay Meditation Center's public teacher roster. Two direct
consequences:

- These people **never gave us their address or asked to hear from us.** That
  is legal to email in the US with the right controls, and it is exactly what
  §3 is about — but it must be designed for deliberately, not assumed.
- Those "Sources:" rows are **data rows in the file** and will be parsed as
  practitioners named *"Source: Psychology Today directory, filtered by…"*
  unless the importer explicitly drops them. So will 18 rows whose Name is an
  organisation (`Energy Matters Acupuncture & Qigong`), and 25 rows carrying
  credentials inside the name cell (`Aisha Nouh, ND`).

**e) The file has 11 different column layouts across 15 sheets.** Column 4 is
"Contact (Psychology Today profile)" on one sheet, "Email" on another,
"City" on a third. **Positional parsing will silently corrupt the import.**
Mapping must be by header name, per sheet, with anything unrecognised surfaced
to the admin rather than guessed.

Supporting detail: 43 distinct city spellings including "Bay Area",
"California" and 15 blanks; 267 rows carry a URL, but **145 of those point at a
third-party directory profile, not the practitioner's own site.**

---

## 2. What the platform already gives us

This feature is substantially a matter of connecting existing parts. That is
the main reason to keep the scope tight.

| Need | Already exists | Gap |
| --- | --- | --- |
| Mark an account as invited, not self-registered | `GuideProfile.onboardingPath` enum, with a `PROACTIVE_INVITE` value | The value exists in the schema and **is used nowhere in code** — it was designed for exactly this |
| Account that can't log in or be found | Public gate is `isVerified && isPublished && user.isActive`; a fresh profile fails all three | None — invited profiles are invisible by default |
| "Set your password and take ownership" flow | `/guide/claim` page + `POST /auth/claim-account` + `sendGuideClaimInvite`, one-time token, 24h TTL | `claimAccount` hard-requires `user.isTestAccount`; must widen to accept invited accounts |
| Admin action history | `AuditLog` (actor, entity, old/new value) | None |
| Transactional email | `EmailService` → Resend | Sends **inline, one at a time, no queue, no retry, no bounce handling, no record of what was sent** |
| Marketing opt-out | `User.marketingEmails` column | Captured at registration and **honoured by nothing** — no unsubscribe endpoint, no suppression check, no link in any email |

Two of those gaps — synchronous sending and an opt-out flag nothing reads — are
the load-bearing pieces of work, and neither is visible from the requirement as
written.

---

## 3. Posture: this is cold outreach, so build it like cold outreach

### 3.1 Legal

Not legal advice; this is the engineering posture I recommend and what it costs
to build.

- **CAN-SPAM.** Commercial email to a scraped list is lawful in the US provided
  the sender is honest, a working opt-out is present, and opt-outs are honoured
  within 10 business days. We do better: the unsubscribe link acts immediately.
  Required in the footer: **a real physical postal address** for Spiritual
  California, a truthful `From` and subject line, and no obscured opt-out.
- **CCPA.** These are California residents and we are holding personal
  information collected from public sources without notice. The client's
  "unsubscribe deletes my data" instinct is exactly right and doubles as a
  standing right-to-delete mechanism. The email must also link to the privacy
  policy and say plainly where we got their details.
- **Right of publicity / reputational risk.** Do **not** publish a page
  carrying a real practitioner's name, credentials and city before they claim
  it. An unclaimed profile that is public and wrong is a takedown demand, and
  worse, an indexed one. The existing visibility gate already prevents this —
  the design's job is not to add an exception to it.
- **Source terms.** Psychology Today and similar directories prohibit scraping
  in their terms. That exposure sits with the list's provenance, not with our
  import, but it argues for **not storing the source URLs or the scrape notes**
  in our database. Import the practitioner's own details; leave the audit trail
  in the spreadsheet.

### 3.2 Deliverability — the biggest operational risk

136 cold emails from a domain with no sending reputation can get
`spiritualcalifornia.com` blocklisted. If that happens, **the outbound that
stops working is the transactional mail** — email verification, receipts,
booking confirmations, payout notices. The invite campaign would take the
platform's core email down with it.

Mitigations, all cheap if done now:

1. **Split the sending identity.** Transactional stays on the main domain;
   outreach moves to a subdomain (e.g. `outreach.spiritualcalifornia.com`) with
   its own SPF/DKIM/DMARC. A reputation hit is then contained.
2. **Warm up.** ~20 emails on day one, roughly doubling daily, capped at 50/day
   until complaint and bounce rates are known. 136 addresses over ~5 sending
   days, not one afternoon. The queue makes this a config value, not a manual
   chore.
3. **Verify before sending.** Syntax + MX check at minimum, so obvious dead
   addresses never leave the building. Hard bounces above ~5% damage the
   domain.
4. **Consume Resend's bounce and complaint webhooks** and suppress
   automatically. Right now nothing records that a send happened at all.
5. **One reminder, maximum.** A single nudge ~7 days later to people who never
   opened, then stop. Repeated chasing of a cold list is what generates
   complaints.

---

## 4. Target design

### 4.1 Data model

Three new tables plus two small column additions. Nothing about the existing
guide model changes.

```
ImportBatch          one spreadsheet upload
  id, filename, uploadedBy, sourceLabel ("Bay Area list, Jul 2026")
  status: DRAFT → PREVIEWED → COMMITTED → ARCHIVED
  counts: rowsTotal, rowsImportable, accountsCreated, invitesSent,
          claimed, unsubscribed
  createdAt, committedAt

ImportedProspect     one spreadsheet row, kept whether or not it became a user
  id, batchId, sheetName, rowNumber
  rawJson              (exactly what the row said, for audit + re-run)
  name, email, city, modality, websiteUrl   (normalised)
  status: PENDING | SKIPPED_NO_EMAIL | SKIPPED_DUPLICATE | SKIPPED_SUPPRESSED
        | ACCOUNT_CREATED | INVITED | CLAIMED | BOUNCED | UNSUBSCRIBED
  skipReason, userId (nullable)

EmailSuppression     the tombstone that makes deletion stick
  id, emailHash (HMAC-SHA256, never the plaintext address)
  reason: UNSUBSCRIBED | DELETED | BOUNCED | COMPLAINED | MANUAL
  createdAt
```

Column additions:

- `GuideProfile.importBatchId` — which upload produced this profile.
- `User.invitedAt` / `User.inviteClaimedAt` — funnel timestamps without a join.

**`EmailSuppression` is the piece that is easy to omit and expensive to add
later.** If unsubscribing hard-deletes the row and nothing else, the next
import of the same spreadsheet **recreates the person and emails them again** —
which is both a legal problem and the single most damaging thing we could do to
a practitioner relationship. Storing a one-way hash lets a future import
recognise "this address asked us never to come back" while retaining no
personal data. It is the only reason to keep anything at all after a deletion.

**Prospects without an email are still stored** (`SKIPPED_NO_EMAIL`). That is
182 rows of genuinely useful market research — names, modality, city — that
the client can work through by other channels. They just never become accounts
and never receive mail.

### 4.2 Import pipeline

Deliberately **two-phase: preview, then commit.** A bulk operation that writes
324 rows on the strength of one click is how a bad file becomes a bad database.

```
Upload .xlsx
   ↓  parse per sheet, map columns BY HEADER NAME
   ↓  drop non-practitioner rows (the "Sources:" footers)
   ↓  normalise: split name / strip trailing credentials / title-case city /
   ↓             canonicalise Bay Area city spellings / lowercase email
   ↓  classify each row → importable | skipped (with a reason)
   ↓  dedupe: within the file, against existing users, against suppression
   ↓
PREVIEW  ── admin sees exactly what will happen, per row, and can
   ↓         exclude rows or fix a cell before committing
   ↓
COMMIT   ── create User + GuideProfile + category links, in batches,
             inside a transaction per row (one bad row can't fail the batch)
```

Rules worth stating explicitly:

- **A row with no email never becomes an account.** No placeholder addresses,
  no `@scprelaunch.test` stand-ins for real people — that would create accounts
  nobody can claim and mail nobody can receive.
- **Duplicate email → one account, the first row wins,** the rest are recorded
  as `SKIPPED_DUPLICATE` and linked to the winner. For the five shared inboxes,
  the admin decides in preview which named practitioner owns the address.
- **Organisation-shaped names** (18 rows) are flagged in preview for the admin
  to confirm or edit — a studio is a legitimate guide, but `displayName` and
  the claim email should address it as one.
- **The imported profile is minimal on purpose:** display name, city, one
  modality, website if it is their own domain. No bio, no credentials, no
  scraped notes, no third-party directory links. Less to be wrong about, and
  the practitioner fills it in themselves at claim time — which is also the
  moment they take responsibility for its accuracy.

### 4.3 What an imported account is

| Field | Value | Why |
| --- | --- | --- |
| `passwordHash` | `null` | Cannot be logged into by anyone, including us |
| `isEmailVerified` | `false` | They haven't confirmed anything yet |
| `isActive` | `true` | Deactivation is an admin sanction; this isn't one |
| `roles` | `GUIDE` | So the claim lands them in the right dashboard |
| `GuideProfile.onboardingPath` | `PROACTIVE_INVITE` | **The segregation flag (§5)** |
| `isPublished` / `isVerified` | `false` / `false` | Invisible to the public site and to search |
| `verificationStatus` | `PENDING` | They still go through normal verification |
| `slug` | reserved, not routable | Held so their preferred URL is available at claim |

State machine:

```
IMPORTED ──invite sent──▶ INVITED ──clicks claim──▶ CLAIMED ──▶ (normal guide onboarding)
    │                        │
    │                        ├──clicks unsubscribe──▶ DELETED  (+ suppression tombstone)
    │                        ├──bounce/complaint────▶ SUPPRESSED
    │                        └──90 days, no action──▶ EXPIRED  (purged, §4.6)
    └──admin excludes────────────────────────────────▶ ARCHIVED
```

**Claim-flow change required:** `AuthService.claimAccount` currently rejects any
token whose user isn't `isTestAccount`. It must also accept accounts whose
profile is `PROACTIVE_INVITE`. The guard stays — it just recognises two
legitimate origins instead of one.

**Token TTL:** the existing claim token is 24 hours, which is right for a
pre-arranged handover and wrong for a cold invite that may be read a week
later. Invited accounts get a **30-day token**, and an expired link lands on a
page offering a fresh one rather than a dead end.

### 4.4 The invite email

Content requirements, each mapping to a real obligation:

| Element | Why |
| --- | --- |
| Honest subject and From — no fake "Re:" | CAN-SPAM |
| **Say where we got their details** ("we found your practice listed on …") | CCPA notice at collection; also disarms the "how did you get this?" reaction |
| What Spiritual California is and the benefit to *them* | Conversion |
| That a profile is **reserved but not public** until they claim it | Removes the "you published a page about me" alarm — the single most likely angry reply |
| One primary CTA → `/guide/claim?token=…` | The activation path |
| **"Remove my information" link** — one click, no login, immediate | The client's requirement; also CCPA delete + CAN-SPAM opt-out |
| Physical postal address + privacy-policy link | CAN-SPAM |

Copy should also state the three steps to going live (claim → complete profile
→ verification), because the honest answer to "how much work is this?" converts
better than implying it is one click.

**Unsubscribe behaviour** — signed token in the URL, so no login and no
guessable ids:

1. Land on a plain page: *"Remove your information from Spiritual California?"*
   with a single confirm button. **Never delete on a bare GET** — mail scanners
   and link-preview bots follow every URL in an email and would silently delete
   people who never clicked.
2. On confirm: delete the `User` + `GuideProfile` + prospect PII, write the
   `EmailSuppression` tombstone, audit-log it, and show a confirmation with a
   support address.
3. If they later change their mind, the suppression entry is removable by an
   admin on request — deliberately a manual, logged act.

### 4.5 Sending infrastructure

The invite is not one more `EmailService` call. Bulk needs its own queue —
mirroring `order-tasks` / `tour-tasks`, so it is a familiar shape in this
codebase:

- **`invite-tasks` BullMQ queue.** One job per recipient, so a failure retries
  one person rather than a batch; concurrency 1–2; a token-bucket rate limit
  driven by `INVITE_SEND_PER_DAY`.
- **`EmailSend` record per recipient** — status, provider message id,
  timestamps. Today we cannot answer "did this person get their invite?" at
  all.
- **Resend webhooks** for `delivered` / `bounced` / `complained`, feeding
  status and auto-suppression.
- **Pre-send checks on every job**, not just at enqueue: still exists, still
  unclaimed, not suppressed, batch not paused. A batch must be **pausable
  mid-flight** — 500 queued emails with no stop button is an incident waiting
  to happen.

### 4.6 Retention

Unclaimed invited accounts are personal data we hold for someone who never
responded. Keeping them indefinitely is the thing that makes a future data
request awkward:

- **Day 7:** one reminder, to non-openers only.
- **Day 30:** invite marked EXPIRED. Account remains, still invisible.
- **Day 90:** automatic purge of the unclaimed account and its PII, with a
  suppression tombstone. Runs as a scheduled job on the same queue — the same
  pattern as the tour health-info purge, which already implements a retention
  promise.

### 4.7 Test-mode interlock

The client's requirement is a testing convenience; treated properly it is a
safety mechanism, and the default must be safe.

```
INVITE_EMAIL_MODE=redirect          # redirect | live   (default: redirect)
INVITE_EMAIL_REDIRECT_TO=vinay.jaiswal@nityo.com
```

- In `redirect` mode every invite goes to the redirect address, with the real
  recipient in the subject (`[TEST → maya@example.com] Claim your…`) and a
  banner at the top of the body. Links carry real tokens so the whole flow is
  testable end to end.
- **The default is `redirect`.** Going live is an explicit act on the
  production environment, so a config that was never set cannot mail 136 real
  practitioners.
- Admin UI shows a persistent banner naming the current mode and, in live mode,
  requires typing the batch name to confirm the send — the same friction
  pattern GitHub uses for destructive actions.
- Both settings must be declared in `src/config/env.validation.ts`, or they are
  stripped before the app reads them (see `docs/order-hold-expiry.md` for the
  version of that mistake we already made).

---

## 5. Segregating imported accounts

Requirement 4, concretely:

- **Source of truth:** `GuideProfile.onboardingPath` — `SELF_REGISTRATION` vs
  `PROACTIVE_INVITE`. Already in the schema, currently unused.
- **Provenance:** `importBatchId` → which upload, which file, which admin.
- **Admin UI:** a source column and filter on `/admin/guides`; an "Invited"
  badge on the row; the import batch page as the drill-down.
- **Reporting:** per-batch funnel — imported → invited → delivered → opened →
  claimed → published → **first booking**. That last column is the one that
  tells the client whether the campaign was worth running.
- **Analytics hygiene:** guide-count metrics should be able to exclude invited-
  but-unclaimed accounts, so the platform never reports 136 practitioners it
  doesn't actually have.

---

## 6. Category mapping

The 15 sheets don't map cleanly onto the current taxonomy. Ten do; five have no
home:

| Sheet | Maps to | |
| --- | --- | --- |
| Energy Healers | Body Healing → Energy Healing / Reiki | ✅ |
| Hypnotherapists | Mind Healing → Hypnotherapy | ✅ |
| Traditional Chinese Medicine | Body Healing → Acupuncture | ✅ |
| Herbalists & Nutritionists | Nutrition & Food → Herbal Medicine / Functional Nutrition | ✅ |
| Ayurvedic Practitioners | Nutrition & Food → Ayurvedic Nutrition | ⚠️ narrow — Ayurveda is more than nutrition |
| Indigenous & Shamanic Medicine | Soul & Spirit → Shamanism | ✅ |
| Life Coaches | Life Coaching → Career / Purpose / Executive / Relationship | ⚠️ needs a per-row choice |
| Alternative Medicine | Integrative Health → Naturopathy | ✅ |
| Yoga & Meditation Teachers | Body Healing → Yoga **and** Mind Healing → Meditation | ⚠️ one sheet, two homes |
| Sound Healing & Breathwork | Body Healing → Sound Healing **and** Mind Healing → Breathwork | ⚠️ one sheet, two homes |
| **Somatic Healers (108 rows)** | — | ❌ **no subcategory exists** |
| **Massage & Bodywork** | — | ❌ none |
| **Doulas (Birth & Death)** | — | ❌ none |
| **Plant Medicine & Integration** | — | ❌ none |
| **Tibetan Medicine** | — | ❌ none |

The largest sheet in the file has nowhere to go. **Five subcategories need
adding before import** — Somatic Therapy, Massage & Bodywork, Doula Support,
Plant Medicine Integration, Tibetan Medicine — added to `prisma/seed.ts` the
same way the four missing categories were, and applied through the admin
categories screen. Cheap to do now; doing it after the import means
re-categorising 130+ profiles by hand.

---

## 7. Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Sending domain blocklisted | **Transactional email stops** — verification, receipts, payouts | Separate outreach subdomain; warm-up; 50/day cap; bounce+complaint suppression |
| A practitioner sees an unrequested public page with their name | Takedown demand, reputational harm | Invited profiles fail the public gate; no indexable page until claimed |
| Re-import resurrects someone who opted out | Legal exposure, worst possible relationship outcome | `EmailSuppression` hash checked at import **and** at send |
| Delete-on-GET from a mail scanner | Silent data loss, angry practitioner | Confirmation page + POST |
| Bad column mapping corrupts 324 rows | Junk database, junk emails | Header-name mapping, mandatory preview, per-row transaction |
| Test send escapes to real addresses | Irreversible; the list gets one first impression | `redirect` is the default; live mode requires typed confirmation |
| Low claim rate makes the platform look empty | Sunk effort | Measure to first booking, not to account count; refine copy on wave 2 |

---

## 8. Phasing

Sequenced so each phase is independently useful and nothing can send mail until
the safety work is done.

| Phase | Scope | Est. |
| --- | --- | --- |
| **0 — Taxonomy** | Add the 5 missing subcategories; agree the sheet→category map | 0.5 d |
| **1 — Import (no email at all)** | Schema + parser + normaliser + dedupe + preview + commit; `/admin/practitioner-import` | 3–4 d |
| **2 — Claim + unsubscribe** | Widen `claimAccount`; 30-day invite token; unsubscribe/delete page + endpoint; suppression | 2–3 d |
| **3 — Sending** | `invite-tasks` queue, throttle, `EmailSend` records, Resend webhooks, pause/resume, redirect mode | 3 d |
| **4 — Invite email + admin console** | Final copy, both templates (personal / role inbox), batch dashboard + funnel | 2–3 d |
| **5 — Hardening** | Retention purge job, reminder job, audit coverage, QA pass, DNS + warm-up run | 2 d |
| | | **≈ 13–15 dev-days** |

Phase 1 is genuinely useful on its own: it turns the spreadsheet into
structured, deduplicated, categorised prospect data with zero outreach risk.

---

## 9. Decisions needed from the client

1. **Who is the sender?** A named person converts far better than a brand on
   cold outreach. Name and reply-to address, please.
2. **Physical postal address** for the email footer — legally required.
3. **The 182 rows with no email** — leave as prospect data, or should someone
   work the directory links by hand to find addresses before we import?
4. **The five shared inboxes** — one invite naming the practice, or drop them?
5. **Free or paid framing?** The invite should be honest about the $50/month
   listing plan and any launch offer. Getting this wrong on first contact is
   expensive to walk back.
6. **Go-live approval** — who flips `INVITE_EMAIL_MODE=live`, and after which
   test?

## 10. Explicitly not in scope

- Scraping or enriching data ourselves — we import what the client supplies.
- Publishing unclaimed profiles publicly in any form.
- Importing bios, credentials or third-party directory links.
- SMS or LinkedIn outreach.
- Auto-verifying imported practitioners — they go through the same verification
  as everyone else, because that is the platform's entire differentiator.
