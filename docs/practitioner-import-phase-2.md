# Practitioner Invites — Phase 2 (claim, or leave)

Implements Phase 2 of `docs/practitioner-import-invite-strategy.md`: the two
things a practitioner can do with an account someone created for them — take
ownership of it, or remove themselves entirely.

**Still no sending.** `practitioner-invites` mints and honours the links; Phase 3
adds the queue that puts them in an email. Building in this order means the
first real invite goes out into a system where both outcomes are already tested,
rather than testing the exit path on live recipients.

Nothing here depended on the open commercial decisions (sender identity,
pricing), which is why it could be built while those are still being settled.

## 1. Claiming an invited account

`AuthService.claimAccount` refused any token whose user wasn't `isTestAccount`:

```ts
if (!user.isTestAccount) throw new BadRequestException('This token is not valid for the claim flow.');
```

That guard is correct and stays — a real user with a stray `emailVerifyToken`
must be sent down verify-email or reset-password, never the claim path. It now
recognises **two** legitimate origins instead of one:

| Origin | Flag |
| --- | --- |
| Pre-launch admin convert workflow | `user.isTestAccount` |
| Spreadsheet import | `guideProfile.onboardingPath === PROACTIVE_INVITE` |

An imported account carries a real email from the start, so it is never flagged
`isTestAccount` — which is exactly why the old guard would have rejected every
practitioner we invited.

### Token lifetime: 30 days, not 24 hours

The existing claim token lasts a day. That fits a pre-arranged handover where
admin tells the guide to expect it; it does not fit a cold email opened the
following Tuesday. `issueClaimToken()` mints a 30-day token, reusing
`emailVerifyToken` so `/guide/claim` and `POST /auth/claim-account` work
unchanged — only the lifetime differs.

### The claim page checks the link first

`/guide/claim` previously revealed a dead link only *after* the practitioner
chose a password and submitted. The old copy then told them to "ask your
Spiritual California contact" — advice that means nothing to someone who
received a cold email.

It now calls `GET /invites/claim/:token` on mount (read-only; describing a token
never consumes it) and renders the right thing before asking for anything:

- **valid** → greets them by name, which also reassures a cold recipient that
  the link is genuinely about them
- **expired** → says so, with the support address, and confirms the profile is
  still reserved
- **already claimed** → sends them to sign in
- **unrecognised** → falls through to the form, because pre-launch test accounts
  use this same page and aren't described by this endpoint

## 2. Removing yourself

Nothing existed for this before: `User.marketingEmails` was captured at
registration and honoured by nothing, and no unsubscribe route existed anywhere.

### The token is stateless on purpose

`<userId>.<hmac>`, signed with `EMAIL_HASH_SECRET`. A stored token would be
deleted by the very action it authorises — the link's whole job is to destroy
the row it refers to. Replay after deletion simply finds nothing and reports
"already removed", which is the honest answer.

Signature comparison is constant-time. A fast-fail compare leaks the signature
byte by byte to anyone willing to time it.

### GET describes, POST destroys

`GET /invites/unsubscribe/:token` changes nothing and returns only what the
confirmation page needs, with the address masked (`m***@example.com`) rather
than echoed back.

This split is the single most important detail on the page. Corporate mail
scanners and link-preview bots follow **every** URL in an email; a delete-on-GET
would silently remove practitioners who never clicked, and we would have no way
of knowing it had happened.

### What removal actually does

In one transaction, in this order:

1. **Suppression tombstone first.** If we deleted the account and then failed to
   write the tombstone, the next import of the same spreadsheet would recreate
   the person and email them again — the worst outcome this feature can produce.
2. **Scrub the prospect row**, keeping only its fingerprint. That hash of sheet
   + name + city is what lets a future import recognise and skip them even when
   the file's email column is blank.
3. **Remove the account.** Hard delete for an untouched invited account.
   Services, events and ledger entries do **not** cascade from a guide profile,
   so an account with any history is deactivated, suppressed and anonymised
   instead of failing on a foreign key halfway through a removal.
4. **Audit without the address.** Logging the email here would preserve exactly
   the data the practitioner just asked us to erase, so the record holds the
   hash, the outcome, and the IP.

## Funnel timestamps

`User.invitedAt` / `inviteClaimedAt` (migration
`20260731160000_invite_funnel_timestamps`). `claimAccount` stamps
`inviteClaimedAt` only for invited accounts and only once, so a re-claim can't
overwrite the original conversion date.

## Verified

18 tests in `practitioner-invites.spec.ts`, weighted toward the things that
would be expensive to get wrong:

- a tampered signature, another user's id pasted onto a valid signature, and
  malformed input are all rejected — and rejection happens **before** any
  transaction opens
- describing a link performs no writes at all
- the suppression tombstone is written for both the delete and the deactivate
  path
- the audit log never contains the address (the first version of this test
  passed against a mock whose "hash" embedded the email — the mock now uses a
  real one-way hash, so the assertion means something)
- an account with activity is deactivated rather than deleted
- claim tokens: 30-day expiry, refused for self-registered or already-claimed
  accounts

Full backend suite green at 142. `tsc` clean both sides, `next build` clean.

## Not in this phase

The invite email itself, the send queue and throttling, bounce/complaint
webhooks, the day-7 reminder, and the 90-day retention purge. Those need the
sender's reply-to address and the copy decisions — see the strategy doc.
