/**
 * Pull the human-readable message out of an API failure.
 *
 * NestJS returns `{ message: string | string[] }`; class-validator returns the
 * array form, which renders as "[object Object]" or a comma-soup if handed
 * straight to a toast. Typed against `unknown` so callers don't need `any`.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const response = (error as { response?: { data?: { message?: unknown } } })?.response;
  const message = response?.data?.message;

  if (typeof message === 'string' && message.trim()) return message;
  if (Array.isArray(message)) {
    const parts = message.filter((m): m is string => typeof m === 'string' && !!m.trim());
    if (parts.length) return parts.join(', ');
  }

  const plain = (error as { message?: unknown })?.message;
  if (typeof plain === 'string' && plain.trim()) return plain;

  return fallback;
}
