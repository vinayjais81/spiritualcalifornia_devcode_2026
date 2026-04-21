'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useCartStore } from '@/store/cart.store';

const navLinks = [
  { label: 'Practitioners', href: '/practitioners' },
  { label: 'Events', href: '/events' },
  { label: 'Journal', href: '/journal' },
  { label: 'Soul Travels', href: '/travels' },
  { label: 'Shop', href: '/shop' },
];

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  // Cart count comes from a localStorage-persisted Zustand store, so it's 0 during
  // SSR and non-zero on the client. Gating the rendered count behind a `mounted`
  // flag keeps the server and first client render identical, avoiding hydration errors.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const storedCartCount = useCartStore((s) => s.getItemCount());
  const cartItemCount = mounted ? storedCartCount : 0;

  // Hide "List Your Practice" for authenticated seekers (no GUIDE / ADMIN role)
  const isGuide = (user?.roles ?? []).includes('GUIDE');
  const showListYourPractice =
    !isAuthenticated || isGuide ||
    (user?.roles ?? []).some(r => r === 'ADMIN' || r === 'SUPER_ADMIN');
  const practiceCtaLabel = isGuide ? 'My Dashboard' : 'List Your Practice';
  const practiceCtaHref = isGuide ? '/guide/dashboard' : '/onboarding/guide';

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const handleLogout = async () => {
    await logout();
    setUserMenuOpen(false);
    router.push('/');
  };

  function toggleMenu() {
    setMenuOpen(prev => !prev);
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <>
      {/* ── DESKTOP NAV ───────────────────────────────────────── */}
      <nav
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0,
          zIndex: 100,
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          padding: '14px 48px',
          background: 'rgba(250,250,247,0.96)',
          backdropFilter: 'blur(14px)',
          borderBottom: '1px solid rgba(232,184,75,0.12)',
        }}
      >
        {/* Left — Desktop nav links */}
        <ul
          className="hidden md:flex"
          style={{ gridColumn: 1, gap: '36px', listStyle: 'none', margin: 0, padding: 0 }}
        >
          {navLinks.map(({ label, href }) => (
            <li key={href}>
              <Link
                href={href}
                style={{
                  fontFamily: 'var(--font-inter), sans-serif',
                  fontSize: '12px',
                  fontWeight: 400,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: '#8A8278',
                  textDecoration: 'none',
                  transition: 'color 0.3s',
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#E8B84B')}
                onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#8A8278')}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Center — Brand */}
        <Link
          href="/"
          style={{ gridColumn: 2, display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}
        >
          <Image
            src="/images/logo.jpg"
            alt="Spiritual California Logo"
            width={44}
            height={44}
            style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
            <span
              className="font-cormorant"
              style={{ fontSize: '18px', fontWeight: 500, letterSpacing: '0.04em', color: '#3A3530' }}
            >
              Spiritual California
            </span>
            <span
              style={{
                fontFamily: 'var(--font-inter), sans-serif',
                fontSize: '9px',
                fontWeight: 400,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: '#8A8278',
                marginTop: '3px',
              }}
            >
              mind · body · soul
            </span>
          </div>
        </Link>

        {/* Right — Desktop CTAs */}
        <div
          className="hidden md:flex"
          style={{ gridColumn: 3, justifySelf: 'end', alignItems: 'center', gap: '24px' }}
        >
          {/* Cart icon with live item count */}
          <Link
            href="/cart"
            aria-label={`Cart${cartItemCount > 0 ? ` (${cartItemCount} item${cartItemCount !== 1 ? 's' : ''})` : ''}`}
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              color: '#3A3530',
              textDecoration: 'none',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.background = 'rgba(232,184,75,0.12)')}
            onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.background = 'transparent')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            {cartItemCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  minWidth: '18px',
                  height: '18px',
                  padding: '0 5px',
                  background: '#E8B84B',
                  color: '#3A3530',
                  fontFamily: 'var(--font-inter), sans-serif',
                  fontSize: '10px',
                  fontWeight: 700,
                  borderRadius: '9px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1.5px solid rgba(250,250,247,0.96)',
                }}
              >
                {cartItemCount > 99 ? '99+' : cartItemCount}
              </span>
            )}
          </Link>

          {isAuthenticated && user ? (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setUserMenuOpen(o => !o)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: '#E8B84B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-inter), sans-serif',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#3A3530',
                  flexShrink: 0,
                }}>
                  {user.firstName?.[0]?.toUpperCase() ?? '?'}
                </div>
                <span style={{
                  fontFamily: 'var(--font-inter), sans-serif',
                  fontSize: '11px',
                  fontWeight: 500,
                  letterSpacing: '0.06em',
                  color: '#3A3530',
                }}>
                  {user.firstName}
                </span>
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ color: '#8A8278' }}>
                  <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {userMenuOpen && (
                <>
                  {/* Backdrop */}
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                    onClick={() => setUserMenuOpen(false)}
                  />
                  {/* Dropdown */}
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 12px)',
                    right: 0,
                    minWidth: '180px',
                    background: '#FFFFFF',
                    border: '1px solid rgba(232,184,75,0.2)',
                    borderRadius: '8px',
                    boxShadow: '0 8px 24px rgba(58,53,48,0.12)',
                    zIndex: 20,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid rgba(232,184,75,0.12)',
                    }}>
                      <div style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '12px', fontWeight: 500, color: '#3A3530' }}>
                        {user.firstName} {user.lastName}
                      </div>
                      <div style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '11px', color: '#8A8278', marginTop: '2px' }}>
                        {user.email}
                      </div>
                    </div>
                    <Link
                      href={(user?.roles ?? []).includes('GUIDE') ? '/guide/dashboard' : '/seeker/dashboard'}
                      onClick={() => setUserMenuOpen(false)}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '11px 16px',
                        fontFamily: 'var(--font-inter), sans-serif',
                        fontSize: '11px',
                        fontWeight: 500,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: '#3A3530',
                        background: 'none',
                        textDecoration: 'none',
                        borderBottom: '1px solid rgba(232,184,75,0.08)',
                      }}
                    >
                      My Dashboard
                    </Link>
                    <button
                      onClick={handleLogout}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '11px 16px',
                        fontFamily: 'var(--font-inter), sans-serif',
                        fontSize: '11px',
                        fontWeight: 500,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: '#8A8278',
                        background: 'none',
                        border: 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#FAFAF7'; (e.currentTarget as HTMLButtonElement).style.color = '#C0392B'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = '#8A8278'; }}
                    >
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link
              href="/signin"
              style={{
                fontFamily: 'var(--font-inter), sans-serif',
                fontSize: '11px',
                fontWeight: 500,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#8A8278',
                textDecoration: 'none',
                transition: 'color 0.3s',
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#E8B84B')}
              onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#8A8278')}
            >
              Sign In
            </Link>
          )}
          {showListYourPractice && (
            <Link
              href={practiceCtaHref}
              style={{
                fontFamily: 'var(--font-inter), sans-serif',
                fontSize: '11px',
                fontWeight: 500,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#3A3530',
                textDecoration: 'none',
                borderBottom: '1.5px solid #E8B84B',
                paddingBottom: '2px',
                transition: 'color 0.3s',
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#E8B84B')}
              onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#3A3530')}
            >
              {practiceCtaLabel}
            </Link>
          )}
        </div>

        {/* Hamburger — visible on mobile, spans last column */}
        <button
          className="flex md:hidden flex-col gap-[5px] cursor-pointer bg-transparent border-0 p-1"
          style={{ gridColumn: 3, justifySelf: 'end', zIndex: 200 }}
          aria-label="Open menu"
          onClick={toggleMenu}
        >
          <span
            style={{
              display: 'block', width: '24px', height: '1.5px', background: '#3A3530',
              transition: 'all 0.3s ease',
              transform: menuOpen ? 'translateY(6.5px) rotate(45deg)' : 'none',
            }}
          />
          <span
            style={{
              display: 'block', width: '24px', height: '1.5px', background: '#3A3530',
              transition: 'all 0.3s ease',
              opacity: menuOpen ? 0 : 1,
            }}
          />
          <span
            style={{
              display: 'block', width: '24px', height: '1.5px', background: '#3A3530',
              transition: 'all 0.3s ease',
              transform: menuOpen ? 'translateY(-6.5px) rotate(-45deg)' : 'none',
            }}
          />
        </button>
      </nav>

      {/* ── MOBILE FULL-SCREEN MENU ───────────────────────────── */}
      {menuOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(250,250,247,0.98)',
            backdropFilter: 'blur(20px)',
            zIndex: 150,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '36px',
          }}
        >
          {navLinks.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              onClick={closeMenu}
              className="font-cormorant"
              style={{
                fontSize: '32px',
                fontWeight: 400,
                fontStyle: 'italic',
                color: '#3A3530',
                textDecoration: 'none',
                letterSpacing: '0.02em',
                transition: 'color 0.3s',
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#E8B84B')}
              onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#3A3530')}
            >
              {label}
            </Link>
          ))}
          {showListYourPractice && (
            <Link
              href={practiceCtaHref}
              onClick={closeMenu}
              style={{
                fontFamily: 'var(--font-inter), sans-serif',
                fontSize: '12px',
                fontWeight: 500,
                fontStyle: 'normal',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#3A3530',
                textDecoration: 'none',
                borderBottom: '1.5px solid #E8B84B',
                paddingBottom: '2px',
              }}
            >
              {practiceCtaLabel}
            </Link>
          )}
          {/* Cart icon */}
          <Link
            href="/cart"
            style={{
              position: 'relative',
              fontSize: '20px',
              color: '#3A3530',
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            🛍️
            {cartItemCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-8px',
                  background: '#E8B84B',
                  color: '#fff',
                  fontSize: '10px',
                  fontWeight: 600,
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {cartItemCount}
              </span>
            )}
          </Link>

          {isAuthenticated ? (
            <button
              onClick={() => { closeMenu(); handleLogout(); }}
              style={{
                fontFamily: 'var(--font-inter), sans-serif',
                fontSize: '12px',
                fontWeight: 500,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#8A8278',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Sign Out
            </button>
          ) : (
            <Link
              href="/signin"
              onClick={closeMenu}
              style={{
                fontFamily: 'var(--font-inter), sans-serif',
                fontSize: '12px',
                fontWeight: 500,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#8A8278',
                textDecoration: 'none',
              }}
            >
              Sign In
            </Link>
          )}
        </div>
      )}
    </>
  );
}
