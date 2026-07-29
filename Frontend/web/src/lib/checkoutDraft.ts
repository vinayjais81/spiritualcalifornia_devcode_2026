// ═══════════════════════════════════════════════════════════════════════════
// Checkout draft persistence
// ═══════════════════════════════════════════════════════════════════════════
// Keeps a checkout form alive across an auth round-trip or a mid-form session
// expiry. Without it, anything that navigates away from a checkout page (the
// api.ts 401 interceptor, a manual sign-in detour) silently destroys whatever
// the buyer typed — the original client-reported bug.
//
// sessionStorage, not localStorage: a checkout draft is scoped to the tab and
// should not outlive the browsing session. It can contain a name, email and
// postal address, so we deliberately avoid persisting it to disk indefinitely.
//
// Every helper is a no-op on the server and swallows storage errors (Safari
// private mode throws on write, quota can be exceeded) — a draft is a nicety,
// never a reason to break checkout.

const PREFIX = 'sc-checkout-draft:';

export function saveCheckoutDraft(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* private mode / quota — drafts are best-effort */
  }
}

export function loadCheckoutDraft<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function clearCheckoutDraft(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}
