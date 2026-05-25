import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Public website routes — always accessible, no auth required.
const PUBLIC_SITE_PATHS = ['/', '/practitioners', '/shop', '/travels', '/tours', '/events', '/about', '/mission', '/blog', '/journal', '/book', '/cart', '/checkout', '/downloads', '/reviews', '/seeker', '/contact', '/onboarding', '/register', '/guide', '/signin', '/forgot-password', '/guides', '/verify-email', '/reset-password', '/verify-ticket', '/terms', '/privacy', '/refund-policy', '/travel-disclosures', '/p'];

// All admin pages live under /admin/* (since 2026-05-19 — see the
// (admin)/admin/<segment> folder structure). Listing this one prefix keeps
// the admin namespace cleanly separated from the public namespace; no more
// per-segment "is this admin or public" decisions in this file.
const ADMIN_PATHS = ['/admin'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public website routes pass through without any redirect
  const isPublicSite = PUBLIC_SITE_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
  if (isPublicSite) {
    return NextResponse.next();
  }

  // Admin paths: client-side AuthGuard in (admin)/layout.tsx handles auth redirect
  const isAdminPath = ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
  if (isAdminPath) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
