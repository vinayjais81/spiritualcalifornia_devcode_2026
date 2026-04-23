import Link from 'next/link';
import Image from 'next/image';
import type { StaticPageContent } from '@/lib/staticPages';
import { Navbar } from '@/components/public/layout/Navbar';
import { Footer } from '@/components/public/layout/Footer';

const G = {
  gold: '#E8B84B',
  charcoal: '#3A3530',
  warmGray: '#8A8278',
  offWhite: '#FAFAF7',
};

interface Props {
  page: StaticPageContent;
  /**
   * Which site chrome to wrap the content in:
   *   - 'legal'     — minimal logo + "Back to Home" (Privacy, Terms)
   *   - 'marketing' — full public Navbar + Footer (About, Mission)
   * Defaults to 'legal' to preserve the historical behaviour for the
   * original privacy/terms callers.
   */
  layout?: 'legal' | 'marketing';
  /** Optional cross-link to another legal page (e.g. Terms → Privacy). */
  crossLink?: { href: string; label: string };
  /** Display date for "Last updated". Falls back to page.updatedAt. */
  lastUpdatedISO?: string;
  /** Hide the "Last updated" line (marketing pages generally don't show it). */
  hideLastUpdated?: boolean;
}

/**
 * Server component that renders a CMS-fetched static page (title, eyebrow,
 * optional subtitle, rich-text body) inside either the minimal legal frame
 * or the full public marketing frame. The body is trusted HTML — the admin
 * rich-text editor produces sanitised Tiptap markup.
 */
export function StaticPageRenderer({
  page,
  layout = 'legal',
  crossLink,
  lastUpdatedISO,
  hideLastUpdated,
}: Props) {
  const iso = lastUpdatedISO ?? page.updatedAt;
  const lastUpdated = new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const isMarketing = layout === 'marketing';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: G.offWhite,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Chrome — marketing pages use the full public Navbar; legal pages
          use the minimal logo + Back-to-Home bar. */}
      {isMarketing ? (
        <Navbar />
      ) : (
        <nav
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 48px',
            background: 'rgba(250,250,247,0.95)',
            backdropFilter: 'blur(14px)',
            borderBottom: '1px solid rgba(232,184,75,0.15)',
          }}
        >
          <Link
            href="/"
            style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}
          >
            <Image
              src="/images/logo.jpg"
              alt="Spiritual California"
              width={36}
              height={36}
              style={{ borderRadius: '50%', objectFit: 'cover' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
              <span
                style={{
                  fontFamily: 'var(--font-cormorant-garamond), serif',
                  fontSize: 17,
                  fontWeight: 500,
                  color: G.charcoal,
                }}
              >
                Spiritual California
              </span>
              <span
                style={{
                  fontSize: 9,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: G.warmGray,
                  marginTop: 2,
                }}
              >
                mind · body · soul
              </span>
            </div>
          </Link>
          <Link
            href="/"
            style={{
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: 12,
              color: G.charcoal,
              textDecoration: 'none',
              letterSpacing: '0.08em',
            }}
          >
            ← Back to Home
          </Link>
        </nav>
      )}

      {/* Content — marketing pages get a wider reading column and a top
          padding that clears the sticky public Navbar; legal pages keep
          the slim reading width. */}
      <main
        style={{
          flex: 1,
          maxWidth: isMarketing ? 900 : 780,
          margin: '0 auto',
          padding: isMarketing ? '140px 24px 96px' : '64px 24px 96px',
          width: '100%',
          textAlign: isMarketing ? 'left' : undefined,
        }}
      >
        {page.eyebrow && (
          <p
            style={{
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: 11,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: G.gold,
              marginBottom: 12,
            }}
          >
            {page.eyebrow}
          </p>
        )}
        <h1
          style={{
            fontFamily: 'var(--font-cormorant-garamond), serif',
            fontSize: isMarketing ? 'clamp(40px, 6vw, 64px)' : 'clamp(36px, 5vw, 56px)',
            fontWeight: 400,
            color: G.charcoal,
            lineHeight: 1.1,
            marginBottom: 8,
          }}
        >
          {page.title}
        </h1>
        {page.subtitle && (
          <p
            style={{
              fontFamily: 'var(--font-cormorant-garamond), serif',
              fontSize: isMarketing ? 22 : 20,
              fontStyle: 'italic',
              color: G.warmGray,
              lineHeight: 1.5,
              marginBottom: 16,
            }}
          >
            {page.subtitle}
          </p>
        )}
        {!hideLastUpdated && !isMarketing && (
          <p
            style={{
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: 13,
              color: G.warmGray,
              marginBottom: 48,
            }}
          >
            Last updated: {lastUpdated}
          </p>
        )}
        {isMarketing && <div style={{ marginBottom: 40 }} />}

        {/* Body — HTML produced by the Tiptap rich-text editor in the admin
            panel. Typography is applied via scoped styles below so admins
            don't have to worry about inline styling. */}
        <div
          className="static-page-body"
          dangerouslySetInnerHTML={{ __html: page.body }}
        />
        <style>{`
          .static-page-body {
            font-family: 'Inter', sans-serif;
            font-size: 15px;
            line-height: 1.8;
            color: ${G.charcoal};
          }
          .static-page-body h2 {
            font-family: 'Cormorant Garamond', serif;
            font-size: 22px;
            font-weight: 500;
            color: ${G.charcoal};
            line-height: 1.3;
            margin: 40px 0 12px;
          }
          .static-page-body h3 {
            font-family: 'Cormorant Garamond', serif;
            font-size: 18px;
            font-weight: 500;
            color: ${G.charcoal};
            line-height: 1.3;
            margin: 32px 0 10px;
          }
          .static-page-body p { margin-bottom: 16px; }
          .static-page-body ul, .static-page-body ol {
            padding-left: 20px;
            margin: 8px 0 16px;
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .static-page-body a {
            color: ${G.gold};
            text-decoration: none;
          }
          .static-page-body a:hover { text-decoration: underline; }
          .static-page-body strong { font-weight: 600; }
          .static-page-body blockquote {
            border-left: 3px solid ${G.gold};
            padding-left: 16px;
            margin: 16px 0;
            font-style: italic;
            color: ${G.warmGray};
          }
        `}</style>

        {/* Footer links (legal layout only) — marketing layout gets the
            real public Footer at the bottom of the page instead. */}
        {!isMarketing && (
          <div
            style={{
              marginTop: 64,
              paddingTop: 32,
              borderTop: '1px solid rgba(232,184,75,0.2)',
              display: 'flex',
              gap: 24,
            }}
          >
            {crossLink && (
              <Link
                href={crossLink.href}
                style={{
                  fontFamily: 'var(--font-inter), sans-serif',
                  fontSize: 13,
                  color: G.gold,
                  textDecoration: 'none',
                }}
              >
                {crossLink.label} →
              </Link>
            )}
            <Link
              href="/"
              style={{
                fontFamily: 'var(--font-inter), sans-serif',
                fontSize: 13,
                color: G.warmGray,
                textDecoration: 'none',
              }}
            >
              Back to Home
            </Link>
          </div>
        )}
      </main>

      {isMarketing && <Footer />}
    </div>
  );
}
