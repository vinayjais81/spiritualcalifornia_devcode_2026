# Form Validation Feedback — "Submit does nothing" convention

**Status:** Implemented
**Dates:** 2026-07-08 (initial toast fix) · 2026-07-29 (hardened)
**Applies to:** every form where submit can be refused client-side

---

## 1. The rule

**A refused submit must always produce visible feedback.** A click that does
nothing reads as a broken button, and users retry, then give up.

Three failure modes have produced that symptom on this codebase. All three are
now banned:

| Anti-pattern | Why it silently fails |
|---|---|
| `disabled={!isValid}` on the submit button | The click never fires, so no handler runs and no message appears. |
| `setError(...)` only, on a tall form | The banner renders at the top, far above the button the user just clicked. They never see it. |
| `required` / `minLength` doing the validating | The browser intercepts submit, so your handler never runs. The native bubble varies per engine, and **Chrome shows nothing at all** when the invalid control isn't focusable. |

### The convention

1. **Never gate the submit button on field validity.** Only on in-flight state
   (`disabled={loading}`). Let the click through; the handler reports the problem.
2. **Always `toast.error()`** in addition to any inline banner. The toast is
   the only feedback guaranteed visible regardless of scroll position.
3. **Own your validation.** Put `noValidate` on the form and check explicitly,
   so feedback is consistent instead of delegating to native browser bubbles.
4. **Move focus to the offending control**, and mark it `aria-invalid` with an
   inline message tied via `aria-describedby`.

Reference implementations: `app/signin/page.tsx`, `(public)/checkout/page.tsx`,
and `components/onboarding/steps/Step1Profile.tsx`.

---

## 2. History

### 2026-07-08 — password errors swallowed
Submit buttons on seeker + guide register were `disabled` while the password
failed policy, so clicking did nothing. Fixed by ungating the button and
reporting from the handler. See `register-password-error-feedback-fix.md`.

### 2026-07-08 — List Your Practice terms (`9e816ba`)
Same class, different field: submitting Step 1 of the guide wizard with Terms
unchecked showed nothing. `failValidation()` was added to set the banner **and**
toast.

### 2026-07-29 — hardened (this change)
The toast alone left real gaps, so `Step1Profile` now:

- **`noValidate` on the form.** Previously `required` on first name, last name,
  bio (`minLength={30}`), email and password meant the browser could intercept
  submit before `handleSubmit` ran — the one remaining way to get a genuinely
  silent click. All those fields are now validated explicitly, in order, each
  with its own message.
- **Focus + scroll to the offending control.** `failValidation(msg, fieldId)`
  scrolls the field into view and focuses it once the smooth scroll settles
  (`preventScroll: true`, so focus doesn't fight the animation).
- **Inline error on the Terms checkbox.** Because it sits directly above the
  submit button, an unchecked box is the most likely refusal. It now gets a red
  outline, a tinted container, `aria-invalid`, and *"You need to accept these
  before continuing."* wired up via `aria-describedby` + `role="alert"`. The
  error clears the moment the box is ticked.

Also fixed on seeker `/register`: terms + password failures now toast, and
`required` was **removed from the Terms checkbox**. That `required` meant native
validation blocked submit and `handleRegister` never ran — so the `setError`
banner it sets could never appear. `aria-required="true"` is kept for assistive
tech.

---

## 3. Note on repeat reports

Both the July 8 fixes above, and the Shop-checkout account gate of the same
date (`docs/checkout-account-gate.md`), were re-reported by the client weeks
later with descriptions matching the *pre-fix* behaviour.

**Before re-investigating a "still broken" report, confirm which build QA is
running.** Deploys go out via `.github/workflows/deploy.yml` on push to `main`;
check the Actions run and the PM2 restart on the EC2 box. A stale QA build has
now cost two investigation cycles.

---

## 4. Files touched (2026-07-29)

- `Frontend/web/src/components/onboarding/steps/Step1Profile.tsx` — `noValidate`,
  full up-front validation, focus-on-error, inline Terms error
- `Frontend/web/src/app/register/page.tsx` — toast on terms/password failure,
  `required` removed from the Terms checkbox

**Related:** `register-password-error-feedback-fix.md` ·
`checkout-account-gate.md` · `required-field-convention` (see project memory)
