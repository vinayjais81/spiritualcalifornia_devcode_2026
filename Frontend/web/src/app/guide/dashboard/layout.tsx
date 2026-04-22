'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth.store';
import { C, font, serif } from '@/components/guide/dashboard-ui';

function NavAvatar({ src, name, size }: { src: string; name: string; size: number }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        border: `2px solid ${C.gold}`, background: C.goldPale,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.45, color: C.gold, flexShrink: 0,
      }}>
        {name[0]?.toUpperCase() || '👤'}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      style={{
        width: size, height: size, borderRadius: '50%',
        objectFit: 'cover', border: `2px solid ${C.gold}`,
      }}
    />
  );
}

const sidebarSections = [
  { label: 'Overview', items: [{ href: '/guide/dashboard', icon: '🏠', name: 'Dashboard' }] },
  { label: 'My Profile', items: [
    { href: '/guide/dashboard/profile', icon: '👤', name: 'Profile & Bio' },
    { href: '/guide/dashboard/verification', icon: '✅', name: 'Verification' },
    { href: '/guide/dashboard/location', icon: '📍', name: 'Location' },
  ]},
  { label: 'Offerings', items: [
    { href: '/guide/dashboard/services', icon: '✨', name: 'Services & Prices' },
    { href: '/guide/dashboard/bookings', icon: '📋', name: 'Client Bookings' },
    { href: '/guide/dashboard/availability', icon: '🕐', name: 'Availability' },
    { href: '/guide/dashboard/calendar', icon: '🗓️', name: 'Calendar / Booking' },
    { href: '/guide/dashboard/products', icon: '🛍️', name: 'Products' },
    { href: '/guide/dashboard/events', icon: '📅', name: 'Events' },
    { href: '/guide/dashboard/tours', icon: '🌍', name: 'Soul Tours' },
  ]},
  { label: 'Content', items: [
    { href: '/guide/dashboard/blog', icon: '✍️', name: 'My Blog' },
  ]},
  { label: 'Business', items: [
    { href: '/guide/dashboard/earnings', icon: '💰', name: 'Earnings & Payouts' },
    { href: '/guide/dashboard/subscription', icon: '⭐', name: 'Subscription Plan' },
    { href: '/guide/dashboard/reviews', icon: '💬', name: 'Reviews' },
    { href: '/guide/dashboard/settings', icon: '⚙️', name: 'Account Settings' },
  ]},
];

export default function GuideDashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const [checked, setChecked] = useState(false);
  const [guideSlug, setGuideSlug] = useState<string>('');

  useEffect(() => {
    if (!hasHydrated) return; // Don't check auth until Zustand has rehydrated from localStorage

    if (!isAuthenticated || !user) {
      router.replace('/signin?redirect=/guide/dashboard');
      return;
    }
    if (!user.roles.includes('GUIDE')) {
      router.replace('/onboarding/guide');
      return;
    }
    setChecked(true);

    // Load guide slug for "Preview My Profile" link
    import('@/lib/api').then(({ api }) => {
      api.get('/guides/me').then(r => {
        if (r.data?.slug) setGuideSlug(r.data.slug);
      }).catch(() => {});
    });
  }, [hasHydrated, isAuthenticated, user, router]);

  if (!checked) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: font, fontSize: '13px', color: C.warmGray }}>
        Loading...
      </div>
    );
  }

  const displayName = user?.firstName || 'Guide';
  const avatar = user?.avatarUrl || '';

  const isActive = (href: string) => {
    if (href === '/guide/dashboard') return pathname === '/guide/dashboard';
    return pathname.startsWith(href);
  };

  return (
    <div style={{ background: C.offWhite, minHeight: '100vh' }}>

      {/* ── TOP NAV ──────────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 48px', background: 'rgba(250,250,247,0.97)',
        backdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(232,184,75,0.15)',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
          <Image src="/images/logo.jpg" alt="Spiritual California" width={40} height={40} style={{ borderRadius: '50%', objectFit: 'cover' }} />
          <div>
            <div style={{ fontFamily: serif, fontSize: '18px', fontWeight: 500, color: C.charcoal }}>Spiritual California</div>
            <div style={{ fontFamily: font, fontSize: '9px', letterSpacing: '0.22em', textTransform: 'uppercase', color: C.warmGray, marginTop: '2px' }}>Find Your Guide. Begin Your Journey.</div>
          </div>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <NavAvatar src={avatar} name={displayName} size={36} />
            <span style={{ fontFamily: font, fontSize: '13px', fontWeight: 500, color: C.charcoal }}>{displayName}</span>
          </div>
          <button onClick={() => { logout(); }} style={{ fontFamily: font, fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.warmGray, background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid rgba(138,130,120,0.4)', paddingBottom: '1px' }}>
            Sign Out
          </button>
        </div>
      </nav>

      {/* ── LAYOUT ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', minHeight: '100vh', paddingTop: '69px' }}>

        {/* ── SIDEBAR ──────────────────────────────────────────── */}
        <aside style={{
          width: '240px', height: 'calc(100vh - 69px)', background: C.white,
          borderRight: '1px solid rgba(232,184,75,0.12)', position: 'fixed',
          top: '69px', left: 0, overflowY: 'auto', zIndex: 100,
        }}>
          {sidebarSections.map((sec, si) => (
            <div key={si}>
              <div style={{ padding: '28px 0 8px' }}>
                <div style={{ fontFamily: font, fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: C.warmGray, padding: '0 24px', marginBottom: '6px' }}>{sec.label}</div>
                {sec.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link key={item.href} href={item.href}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 24px',
                        fontFamily: font, fontSize: '13px', fontWeight: active ? 500 : 400,
                        color: active ? C.charcoal : C.warmGray,
                        background: active ? C.goldPale : 'transparent',
                        borderTop: 'none', borderBottom: 'none', borderLeft: 'none',
                        borderRight: active ? `3px solid ${C.gold}` : '3px solid transparent',
                        textDecoration: 'none', transition: 'background 0.2s, color 0.2s',
                      }}>
                      <span style={{ fontSize: '16px', width: '20px', textAlign: 'center' }}>{item.icon}</span> {item.name}
                    </Link>
                  );
                })}
              </div>
              {si < sidebarSections.length - 1 && <div style={{ height: '1px', background: 'rgba(232,184,75,0.12)', margin: '8px 0' }} />}
            </div>
          ))}
          <div style={{ height: '1px', background: 'rgba(232,184,75,0.12)', margin: '8px 0' }} />
          <div style={{ padding: '8px 0' }}>
            <Link href={guideSlug ? `/guides/${guideSlug}` : '#'} target="_blank"
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 24px', fontFamily: font, fontSize: '13px', color: C.warmGray, textDecoration: 'none' }}>
              <span style={{ fontSize: '16px', width: '20px', textAlign: 'center' }}>👁️</span> Preview My Profile
            </Link>
          </div>
        </aside>

        {/* ── MAIN CONTENT ─────────────────────────────────────── */}
        <main style={{ marginLeft: '240px', flex: 1, padding: '40px 48px', maxWidth: 'calc(100% - 240px)' }}>
          {children}
        </main>
      </div>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <footer style={{ marginLeft: '240px', padding: '24px 48px', borderTop: '1px solid rgba(232,184,75,0.12)', fontFamily: font, fontSize: '11px', color: C.warmGray, letterSpacing: '0.08em', textAlign: 'center' }}>
        © {new Date().getFullYear()} Spiritual California LLC · All rights reserved
      </footer>
    </div>
  );
}
