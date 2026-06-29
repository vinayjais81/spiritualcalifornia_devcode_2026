# Register: Show Error When Password Is Empty/Weak

**Status:** Shipped 2026-06-29 (bug fix — client report)
**Surface:** Seeker register (`/register`) and Guide register (`/guide/register`)
**Files:** `Frontend/web/src/app/register/page.tsx`,
`Frontend/web/src/app/guide/register/page.tsx`

## Symptom (client report)

> Open seeker register page, fill all required fields **but** password. Click
> Sign Up. Expected: an error asking the user to enter a password. Actual: no
> error message at all — nothing happens.

## Root cause

The submit button was **disabled** whenever the password failed validation
(an empty password fails every rule):

```tsx
// seeker — register/page.tsx (before)
disabled={loading || (!isGoogleUser && !pwdStrength.allPassed)}
// guide — guide/register/page.tsx (before)
disabled={loading || !pwdStrength.allPassed}
```

A disabled button **silently swallows the click**: the form's `onSubmit` never
fires, and native HTML5 `required` validation never runs either (both need a
real submit attempt). So the password-validation error path inside the submit
handler was **dead code** for the empty/weak-password case:

```tsx
// handler already had this — but the disabled button never let the click reach it
const pwdResult = evaluatePassword(password, { email, firstName, lastName });
if (!pwdResult.allPassed) {
  const firstFailing = pwdResult.rules.find((r) => !r.passed);
  setError(firstFailing ? `Password: ${firstFailing.label}` : 'Password does not meet the requirements.');
  return;
}
```

This is the classic **disable-submit-instead-of-validate** anti-pattern: the
user gets no explanation of *why* they can't proceed.

## Fix

Make the button clickable; gate only on an in-flight submit:

```tsx
disabled={loading}
```

(The guide page also tied `cursor`/`opacity` to `!pwdStrength.allPassed`; those
now key off `loading` only so the button no longer *looks* disabled.)

On click the existing handler now runs and the user gets feedback:

| Password state | Feedback shown |
|----------------|----------------|
| Empty | Native `required` prompt on the field ("Please fill out this field") |
| < 10 chars | Native `minLength` prompt |
| ≥ 10 chars but fails composition | Red error banner: `Password: <first failing rule>` |

The live `PasswordStrengthMeter` and `aria-invalid` signaling are unchanged.

## Scope / not affected

- **Onboarding wizard `Step0Account.tsx`** does **not** have this bug — its
  submit button (`WizardButton`) was never disabled on password validity; it
  relies on native `required` + backend error display. Left as-is.
- No backend change. `/auth/register` still enforces `IsStrongPassword`
  server-side (see [password complexity policy](../docs)).

## Commit

`<filled at commit>` — `fix(register): surface password error instead of silently disabling submit`.
