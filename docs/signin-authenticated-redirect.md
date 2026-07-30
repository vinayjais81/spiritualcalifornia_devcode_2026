# /signin — Redirect an Already-Authenticated Visitor

Fixes the QA defect *"/signin does not redirect an already-authenticated seeker
(unlike /register)"* (severity: normal) —
[SpiritualCalifornia-playwright-testing#4](https://github.com/SvetlanaZap/SpiritualCalifornia-playwright-testing/issues/4).

## The gap

`/register` has always had a mount effect that bounces a signed-in user
(`Frontend/web/src/app/register/page.tsx`): it calls
`/seekers/onboarding/status` and, once the email is verified, `router.replace`s
to `/seeker/dashboard` (or `?redirect=`).

`/signin` had **no auth-state effect at all**. It read only `setAuth` off the
store:

```tsx
const { setAuth } = useAuthStore();
```

`isAuthenticated` was never consulted, so the page rendered the full sign-in
form to someone who was already signed in — exactly as reported. Nothing was
broken beyond that (submitting just re-authenticated them), but the two auth
pages behaved differently for no reason, and a live session sitting behind a
"Welcome Back" form is a confusing dead end.

## The fix

`Frontend/web/src/app/signin/page.tsx` now runs the same shape of guard the
seeker/guide dashboard layouts use:

```tsx
useEffect(() => {
  if (!hasHydrated) return;
  if (searchParams.get('reason') === 'session-expired') { … }   // see below
  if (isAuthenticated && user) {
    router.replace(signedInDestination(user.roles ?? [], safeRedirect(searchParams.get('redirect'))));
    return;
  }
  setAuthChecked(true);
}, [hasHydrated, isAuthenticated, user, clearAuth, router, searchParams]);
```

Three details carry the weight:

**1. Wait for the zustand rehydration.** `_hasHydrated` gates the check. Before
persist has replayed `localStorage`, `isAuthenticated` is still `false` and the
guard would wave a signed-in user straight through to the form. This is why the
QA report notes the behaviour "verified twice with an extra wait" — any check
that doesn't wait for rehydration is a coin flip.

**2. The form is gated on `authChecked`,** not rendered-then-replaced, so a
signed-in user never sees a flash of the sign-in form before the redirect. A
3-second `setTimeout` fallback flips `authChecked` regardless: `/signin` is the
recovery path for every auth failure on the site, so the one thing it must never
do is get stuck on a loading state. Worst case it falls back to the old
behaviour instead of stranding the user.

**3. Destination mirrors the post-login routing** in `handleSubmit`, kept in a
`signedInDestination()` helper right next to it so the two can't drift:

| Role | Destination |
| --- | --- |
| `ADMIN` / `SUPER_ADMIN` | `/admin/dashboard` (wins over `?redirect=`, as at login) |
| any role with `?redirect=` | the redirect target |
| `GUIDE` | `/guide/dashboard` |
| `SEEKER` | `/seeker/dashboard` |
| none of the above | `/` |

## The session-expired trap

This is the part that would have turned a cosmetic fix into an outage.

The 401 interceptor in `lib/api.ts` sends a user whose refresh failed to
`/signin?redirect=…&reason=session-expired`. It removes `access_token` from
`localStorage` — but it does **not** call `clearAuth()`, so the persisted
zustand state still says `isAuthenticated: true`.

A naive guard therefore reads "signed in", `router.replace`s the user back to
the page that just 401'd, that page's first API call 401s again, the interceptor
sends them back to `/signin`… an infinite bounce, on the one page that exists to
get them out of it.

So `reason=session-expired` is handled first and explicitly: the stale session
is cleared (`clearAuth()`) and the form is shown with its existing "your session
timed out" notice. That also leaves the store honest, which is what the notice
already implied to the user.

## Drive-by: `?redirect=` is now sanitised

The raw query value went straight into `router.push`, which follows absolute
URLs — so `/signin?redirect=https://evil.example` was an open redirect off the
back of a real sign-in. Adding a second consumer of that param made it worth
closing:

```tsx
function safeRedirect(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null;
  if (/^\/(signin|register|forgot-password|reset-password)/.test(raw)) return null;
  return raw;
}
```

Same-origin paths only, and never back into an auth page (that loops). Applied
to all three readers on the page: the new guard, the post-login push, and the
value the Google button stashes in `sessionStorage` for
`/auth/google/success` to consume. `buildSessionExpiredUrl()` in `lib/api.ts`
already applied the auth-page half of this rule to values it generated; this
covers the values it doesn't generate.

## Pages deliberately left alone

- **`/guide/register`** — reads only `setAuth`, same as `/signin` did. Not
  changed here: it is not part of the reported defect and the guide funnel entry
  point is `/onboarding/guide`, whose wizard already resumes from server-side
  status. Worth a follow-up if QA wants funnel-wide consistency.
- **`/login`** (`app/(auth)/login`) — the separate admin-panel login. Same
  missing guard, but it is admin-only and outside the seeker funnel this report
  covers.
- **`/reset-password`** — arrives with a token from an email. A signed-in user
  following that link genuinely wants to reset their password; redirecting them
  would break the flow.
- **`/forgot-password`** — harmless while signed in, and a plausible way to
  reach a reset.

## Verification

Typecheck (`tsc --noEmit`) and `next build` clean. `Frontend/web` has no
frontend test runner, so behavioural coverage lives in the QA Playwright suite.

## Note for the QA suite

`tests/ui/user/dashboard.spec.ts` → *"Already-authenticated seeker visiting Sign
In directly still sees the sign-in form"* asserts the **bug** (tagged
`known-bug` / normal). It will now fail, which is the intended signal. Flip it
to the fixed expectation: an authenticated seeker visiting `/signin` lands on
`/seeker/dashboard` and the email/password form is not present.

Two cases worth adding while that test is being rewritten, because both are
load-bearing above and neither is currently covered:

1. `/signin?redirect=/cart` while authenticated → lands on `/cart`.
2. `/signin?redirect=/seeker/dashboard&reason=session-expired` with a dead
   session → **stays** on `/signin`, shows the timeout notice and the form. This
   is the anti-loop guard; a regression here is far worse than the original bug.
