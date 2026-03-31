import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Public website routes — always accessible, no auth required
const PUBLIC_SITE_PATHS = ['/', '/practitioners', '/shop', '/travels', '/events', '/about', '/mission', '/blog', '/journal', '/contact', '/onboarding', '/register', '/guide', '/signin', '/forgot-password', '/guides', '/verify-email', '/reset-password', '/terms', '/privacy'];

// Admin-only paths — protected by client-side AuthGuard
const ADMIN_PATHS = ['/dashboard', '/users', '/guides', '/verification', '/financials', '/settings'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public website routes pass through without any redirect
  const isPublicSite = PUBLIC_SITE_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
  if (isPublicSite) {
    return NextResponse.next();
  }

  // Admin paths: client-side AuthGuard in (admin)/layout.tsx handles auth redirect
  const isAdminPath = ADMIN_PATHS.some((p) => pathname.startsWith(p));
  if (isAdminPath) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
