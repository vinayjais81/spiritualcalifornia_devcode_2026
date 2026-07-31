# Commission — What Guides Are Shown vs What They Are Charged

Fixes a live fee misstatement found while drafting the practitioner invite copy
(`docs/practitioner-import-invite-strategy.md` §4.5): the guide dashboard told
practitioners the platform takes **15%**, while the ledger was charging **20%**.

## What was true

Three different numbers, one of which was the money:

| Surface | Said | Source |
| --- | --- | --- |
| **Ledger (actual payouts)** | **20%** services/events/tours, 10% products | `CommissionRate` rows inserted by `20260624000000_payouts_v2_1_policy` |
| `/config/public` → guide dashboard | 15% | `STRIPE_PLATFORM_COMMISSION_PERCENT` |
| Earnings page copy | "events 12%, tours 15%, products 10%" | Typed into the JSX by hand, pre-v2.1 |

`LedgerService.resolveCommissionPercent` looks for a per-guide rate, then a
platform-default rate row, and only falls back to the env var when neither
exists (logging a warning when it does). The v2.1 migration effective-dates the
old defaults and inserts 20% rows, so the fallback never fires in practice —
which is exactly why nobody noticed the config endpoint was reporting it.

The frontend fallback constants were stale in the same direction:
`platformCommissionPercent: 15` and `payouts.minUsd: 50` (the policy minimum is
$100). Those render on every page load before `/config/public` resolves, so
they were briefly shown to real guides.

## The fix

`/config/public` reads the live rate rows instead of the env var, and returns
them per category:

```jsonc
"fees": {
  "platformCommissionPercent": 20,          // sessions, events, tours
  "commissionByCategory": { "SERVICE": 20, "EVENT": 20, "TOUR": 20, "PRODUCT": 10 },
  "eventBookingFeePercent": 5
}
```

- Platform defaults only (`guideId IS NULL`) — per-guide overrides are nobody
  else's business, and this endpoint is public.
- Newest effective-dated row per category wins, matching the ledger's own
  resolution order.
- `STRIPE_PLATFORM_COMMISSION_PERCENT` survives as the last-resort fallback for
  a category with no row, and now logs when it is used — same behaviour the
  ledger has, so the two can't disagree.
- The earnings page renders each category from `commissionByCategory` rather
  than hardcoded numbers, and the frontend fallbacks were corrected to 20 / 10
  and $100.

## The rule this establishes

**A fee shown to a guide must be read from the same row the ledger charges
against.** Not an env var that happens to hold a similar number, and never a
literal in copy. Any new surface that quotes commission — the practitioner
invite email especially, since it goes to people deciding whether to join —
uses `fees.commissionByCategory`.

Note the asymmetry that made this survive: the number was wrong in the
guide's favour, so nobody reading it would complain. The complaint arrives
later, from someone reconciling their first payout.
