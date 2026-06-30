import Image from 'next/image';
import Link from 'next/link';

interface PractitionerCardProps {
  href?: string;
  image: string;
  name: string;
  specialty: string;
  verified?: boolean;
}

export function PractitionerCard({
  href = '#',
  image,
  name,
  specialty,
  verified = false,
}: PractitionerCardProps) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-center text-center"
      style={{ width: 'clamp(140px, 42vw, 180px)', flex: '0 0 clamp(140px, 42vw, 180px)', textDecoration: 'none', color: 'inherit' }}
    >
      {/* Avatar */}
      <div
        style={{
          width: '130px',
          height: '130px',
          borderRadius: '50%',
          overflow: 'hidden',
          border: '2px solid rgba(240,120,20,0.5)',
          marginBottom: '14px',
          position: 'relative',
          transition: 'border-color 0.3s, transform 0.3s',
          flexShrink: 0,
        }}
        className="group-hover:[border-color:#F07814] group-hover:scale-[1.04]"
      >
        <Image
          src={image}
          alt={name}
          fill
          sizes="130px"
          className="object-cover object-top"
        />
        {verified && (
          // Spec Task 7: hover tooltip explaining what Verified actually
          // means. Kept as a plain <div> with a `title` attribute so this
          // component can stay a Server Component (no React event
          // handlers). Nested anchors aren't valid HTML anyway — the card
          // itself is already wrapped in <Link>, and the full explanation
          // lives at /about#verified-meaning for anyone curious enough to
          // read it.
          <div
            title="Verified: identity confirmed, credentials checked, ethics-interviewed, and reviewed on an ongoing basis. See /about#verified-meaning for details."
            style={{
              // Centered along the bottom arc so the circular `overflow:
              // hidden` on the avatar doesn't clip the pill's edge (it did
              // when pinned bottom-right — showed "Verifi…").
              position: 'absolute',
              bottom: '10px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#FFFFFF',
              borderRadius: '50px',
              padding: '3px 7px',
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: '8px',
              fontWeight: 600,
              color: '#F07814',
              letterSpacing: '0.06em',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            }}
          >
            ✦ Verified
          </div>
        )}
      </div>

      <div
        className="font-playfair"
        style={{ fontSize: '17px', fontWeight: 500, color: '#3A3530', marginBottom: '3px' }}
      >
        {name}
      </div>

      <div
        style={{
          fontFamily: 'var(--font-inter), sans-serif',
          fontSize: '10px',
          fontWeight: 400,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#8A8278',
        }}
      >
        {specialty}
      </div>
    </Link>
  );
}
