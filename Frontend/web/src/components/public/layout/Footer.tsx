'use client';

import Image from 'next/image';
import Link from 'next/link';

const exploreLinks = [
  { label: 'Practitioners', href: '/practitioners' },
  { label: 'Shop', href: '/shop' },
  { label: 'Soul Travels', href: '/travels' },
  { label: 'Events', href: '/events' },
];

const guidesLinks = [
  { label: 'List Your Practice', href: '/onboarding/guide' },
  { label: 'Verification', href: '/guides/verification' },
  { label: 'Guide Dashboard', href: '/dashboard' },
  { label: 'Community', href: '/community' },
];

const companyLinks = [
  { label: 'About', href: '/about' },
  { label: 'Our Mission', href: '/mission' },
  { label: 'Blog', href: '/blog' },
  { label: 'Contact', href: '/contact' },
];

const linkStyle: React.CSSProperties = {
  fontFamily: 'var(--font-inter), sans-serif',
  fontSize: '13px',
  fontWeight: 300,
  color: 'rgba(255,255,255,0.45)',
  textDecoration: 'none',
  transition: 'color 0.3s',
};

function FooterLinkList({ links }: { links: { label: string; href: string }[] }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '9px' }}>
      {links.map(({ label, href }) => (
        <li key={href}>
          <Link
            href={href}
            style={linkStyle}
            onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = '#F5D98A')}
            onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.45)')}
          >
            {label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

const colTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-inter), sans-serif',
  fontSize: '9px',
  fontWeight: 500,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: '#F5D98A',
  marginBottom: '14px',
};

export function Footer() {
  return (
    <footer style={{ background: '#3A3530', color: 'rgba(255,255,255,0.6)', padding: '56px 60px 36px' }}>
      {/* Top grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 1fr',
          gap: '48px',
          marginBottom: '44px',
        }}
        className="footer-grid"
      >
        {/* Brand col */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            <Image
              src="/images/logo.jpg"
              alt="Spiritual California"
              width={38}
              height={38}
              style={{ borderRadius: '50%', objectFit: 'cover' }}
            />
            <div>
              <span
                className="font-cormorant block"
                style={{ fontSize: '20px', fontWeight: 400, color: '#FFFFFF' }}
              >
                Spiritual California
              </span>
              <span
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-inter), sans-serif',
                  fontSize: '9px',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: '#F5D98A',
                  marginTop: '2px',
                }}
              >
                mind · body · soul
              </span>
            </div>
          </div>
          <p
            style={{
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: '13px',
              fontWeight: 300,
              lineHeight: 1.7,
              color: 'rgba(255,255,255,0.45)',
              margin: 0,
            }}
          >
            A trusted marketplace connecting seekers with verified guides — across coaching, therapy, traditional
            medicine, and spiritual practice.
          </p>
        </div>

        {/* Explore */}
        <div>
          <div style={colTitleStyle}>Explore</div>
          <FooterLinkList links={exploreLinks} />
        </div>

        {/* For Guides */}
        <div>
          <div style={colTitleStyle}>For Guides</div>
          <FooterLinkList links={guidesLinks} />
        </div>

        {/* Company */}
        <div>
          <div style={colTitleStyle}>Company</div>
          <FooterLinkList links={companyLinks} />
        </div>
      </div>

      {/* Bottom bar */}
      <div
        style={{
          borderTop: '1px solid rgba(255,255,255,0.1)',
          paddingTop: '22px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
        className="footer-bottom"
      >
        <span
          style={{
            fontFamily: 'var(--font-inter), sans-serif',
            fontSize: '11px',
            fontWeight: 300,
            color: 'rgba(255,255,255,0.3)',
          }}
        >
          © {new Date().getFullYear()} Spiritual California. All rights reserved.
        </span>
        <span
          style={{
            fontFamily: 'var(--font-inter), sans-serif',
            fontSize: '11px',
            fontWeight: 300,
            color: 'rgba(255,255,255,0.3)',
          }}
        >
          Built with conscious intention.
        </span>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .footer-grid { grid-template-columns: 2fr 1fr 1fr !important; }
          .footer-grid > div:last-child { grid-column: 2; }
        }
        @media (max-width: 768px) {
          .footer-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
          .footer-grid > div:last-child { grid-column: 1 !important; }
          .footer-bottom { flex-direction: column !important; gap: 8px !important; text-align: center !important; }
          footer { padding: 40px 20px 28px !important; }
        }
      `}</style>
    </footer>
  );
}
