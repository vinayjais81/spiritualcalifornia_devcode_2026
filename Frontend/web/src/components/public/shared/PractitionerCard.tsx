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
      style={{ flex: '0 0 180px', textDecoration: 'none', color: 'inherit' }}
    >
      {/* Avatar */}
      <div
        style={{
          width: '130px',
          height: '130px',
          borderRadius: '50%',
          overflow: 'hidden',
          border: '2px solid rgba(232,184,75,0.5)',
          marginBottom: '14px',
          position: 'relative',
          transition: 'border-color 0.3s, transform 0.3s',
          flexShrink: 0,
        }}
        className="group-hover:[border-color:#E8B84B] group-hover:scale-[1.04]"
      >
        <Image
          src={image}
          alt={name}
          fill
          sizes="130px"
          className="object-cover object-top"
        />
        {verified && (
          <div
            style={{
              position: 'absolute',
              bottom: '6px',
              right: '6px',
              background: '#FFFFFF',
              borderRadius: '50px',
              padding: '3px 7px',
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              fontFamily: 'var(--font-inter), sans-serif',
              fontSize: '8px',
              fontWeight: 600,
              color: '#E8B84B',
              letterSpacing: '0.06em',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            }}
          >
            ✦ Verified
          </div>
        )}
      </div>

      <div
        className="font-cormorant"
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
