# Promo "Apply" — Dead First Click

Fixes the QA defect *"Promo code Apply button silently no-ops on the first
click"* (severity: normal) —
[SpiritualCalifornia-playwright-testing#5](https://github.com/SvetlanaZap/SpiritualCalifornia-playwright-testing/issues/5).

## Root cause: a stale closure, not a race

`Frontend/web/src/app/(public)/checkout/page.tsx`:

```tsx
// caller
onApplyPromo={async (code) => { setPromoCode(code); setTimeout(() => applyPromo(), 0); }}

// handler
const applyPromo = async () => {
  if (!promoCode.trim()) return;        // ← silent exit on every first click
  …
};
```

`applyPromo` read `promoCode` from state, and the caller tried to bridge the
gap with `setTimeout(…, 0)`.

That doesn't work, and it's worth being precise about why: `setTimeout` defers
**when** the call happens, but the `applyPromo` reference it captures still
belongs to the render that scheduled it. That closure sees the pre-update
`promoCode` — `''` on the first click — hits the empty-string guard, and
returns. No request, no error, no UI change, exactly as reported.

The second click worked because the component had re-rendered by then, so the
newly-created `applyPromo` closed over the populated state.

Deferring to a macrotask gives you a later *time*, never fresher *state*. Only
a re-render does that.

## The fix

Pass the value instead of reading it back out of state:

```tsx
const applyPromo = async (codeArg?: string) => {
  const code = (codeArg ?? promoCode).trim();
  if (!code) { toast.error('Enter a promo code first.'); return; }
  …
};

onApplyPromo={async (code) => { setPromoCode(code); await applyPromo(code); }}
```

`OrderSummary` already passed the code as an argument, so the state round-trip
was never needed. Removing it removes the render-timing dependency entirely
rather than trying to out-wait it.

The empty-code path also now toasts instead of returning silently — the same
rule as [form-validation-feedback.md](form-validation-feedback.md): a refused
action must always say so.

## The audit the report asked for

> *"May be the same underlying pattern seen elsewhere — worth a quick audit of
> other primary CTA buttons."*

Two searches were run across `Frontend/web/src`.

**1. The exact `setState` → `setTimeout` → stale-handler pattern:**

```bash
rg -n 'set[A-Z]\w*\([^)]*\);\s*setTimeout' Frontend/web/src
rg -n 'setTimeout\(\s*\(\)\s*=>\s*\w+\(\s*\)\s*,\s*0\s*\)' Frontend/web/src
```

No other occurrences. This one was unique to the promo button.

**2. The broader class — handlers that refuse without feedback.** This is the
recurring defect, and it found one more genuine dead CTA:

`app/(public)/events/[id]/checkout/page.tsx`, `goToAttendees`:

```tsx
if (!selectedTier) return;                                              // silent
if (quantity > remaining) { setError(`Only ${remaining} tickets remaining`); return; }  // speaks
```

Two refusals, side by side, behaving differently for no reason. Clicking
Continue without picking a ticket type did nothing at all. Now sets
`'Select a ticket type to continue'`.

Everything else the search surfaced was a legitimate guard rather than a dead
CTA — `useEffect` bail-outs (draft restore, data not loaded yet), drag-and-drop
`onDragOver` handlers, and in-flight/loading locks. Those are correct as bare
returns.

One minor case left alone: `app/(admin)/admin/guides/page.tsx` returns silently
when a `window.prompt` is cancelled (correct — cancelling should be silent) and
also when the entered email is whitespace-only (mildly poor, admin-only, not
worth widening this change for).

## Not reproducible in the existing test suite

There is no frontend test runner configured in `Frontend/web`, so this is
covered by the QA Playwright suite rather than a unit test. Verified by
inspection and typecheck.

## Note for the QA suite

`tests/ui/user/shop.spec.ts` → *"Seeker sees the checkout promo code validation
endpoint fail for an invalid code"* deliberately clicks Apply **twice** to work
around this bug. Remove the second click — a single click now fires the request.
Leaving it in will still pass (the second click re-validates), so it won't fail
loudly like the other regression tests; it just needs cleaning up, and a
single-click assertion is what actually guards the fix.
