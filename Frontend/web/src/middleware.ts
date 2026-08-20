import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Public website routes — always accessible, no auth required.
const PUBLIC_SITE_PATHS = ['/', '/practitioners', '/shop', '/travels', '/tours', '/events', '/about', '/mission', '/blog', '/journal', '/book', '/cart', '/checkout', '/downloads', '/reviews', '/seeker', '/contact', '/onboarding', '/register', '/guide', '/signin', '/forgot-password', '/guides', '/verify-email', '/reset-password', '/verify-ticket', '/terms', '/privacy', '/refund-policy', '/disclosures', '/travel-disclosures', '/p'];

// All admin pages live under /admin/* (since 2026-05-19 — see the
// (admin)/admin/<segment> folder structure). Listing this one prefix keeps
// the admin namespace cleanly separated from the public namespace; no more
// per-segment "is this admin or public" decisions in this file.
const ADMIN_PATHS = ['/admin'];

/**
 * Content-Security-Policy for the pages themselves.
 *
 * Helmet sets a CSP on the NestJS side, but that header rides on API *JSON*
 * responses — the browser applies a policy from the document response, which
 * Next.js serves. So until now the pages a customer types card details into
 * had no CSP at all.
 *
 * Hosts here were taken from what the code actually loads, not from a
 * template. Note `next/font/google` self-hosts its files at build time, so
 * fonts are 'self' and no Google font host is needed.
 */
const CSP_DIRECTIVES: Record<string, string[]> = {
  'default-src': ["'self'"],

  // 'unsafe-inline' / 'unsafe-eval' are here because Next.js injects inline
  // bootstrap and hydration scripts. This is the weakest part of the policy
  // and the reason a nonce-based script-src is the follow-up hardening step —
  // with 'unsafe-inline' present, script-src stops being an XSS control.
  'script-src': [
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    'https://js.stripe.com',
    'https://assets.calendly.com',
  ],

  // Tailwind plus a large amount of inline `style=` in this codebase.
  'style-src': ["'self'", "'unsafe-inline'"],

  // Uploads land on CloudFront/S3, editorial art on Unsplash, avatars on
  // Google — the same set already allow-listed in next.config.ts.
  'img-src': ["'self'", 'data:', 'blob:', 'https:'],

  'font-src': ["'self'", 'data:'],

  // Same-origin API, plus Stripe's tokenisation endpoint.
  'connect-src': ["'self'", 'https://api.stripe.com', 'https://maps.googleapis.com'],

  // Stripe payment element + 3DS, Calendly booking, Google Maps, and YouTube
  // embeds inserted through the Tiptap editor.
  'frame-src': [
    "'self'",
    'https://js.stripe.com',
    'https://hooks.stripe.com',
    'https://calendly.com',
    'https://*.calendly.com',
    'https://www.google.com',
    'https://www.youtube.com',
    'https://www.youtube-nocookie.com',
  ],

  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'self'"],
};

function buildCsp(): string {
  return Object.entries(CSP_DIRECTIVES)
    .map(([directive, values]) => `${directive} ${values.join(' ')}`)
    .join('; ');
}

/**
 * Report-only by default so a wrong allow-list can never break checkout.
 * Set CSP_MODE=enforce once the reports on a real environment come back
 * clean; CSP_MODE=off disables it entirely.
 */
function applySecurityHeaders(response: NextResponse): NextResponse {
  const mode = process.env.CSP_MODE ?? 'report-only';
  if (mode === 'off') return response;

  const header =
    mode === 'enforce'
      ? 'Content-Security-Policy'
      : 'Content-Security-Policy-Report-Only';

  // Collector sits at /csp-report, deliberately NOT under /api — that prefix
  // is routed to NestJS by the load balancer and the report would 404.
  response.headers.set(header, `${buildCsp()}; report-uri /csp-report`);

  // Cheap wins the API already sets on its own responses but the pages did not.
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');

  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public website routes pass through without any redirect
  const isPublicSite = PUBLIC_SITE_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
  if (isPublicSite) {
    return applySecurityHeaders(NextResponse.next());
  }

  // Admin paths: client-side AuthGuard in (admin)/layout.tsx handles auth redirect
  const isAdminPath = ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
  if (isAdminPath) {
    return applySecurityHeaders(NextResponse.next());
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
