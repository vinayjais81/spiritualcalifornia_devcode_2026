import Link from 'next/link';

interface AuthorBioCardProps {
  slug: string;
  name: string;
  tagline?: string;
  bio?: string;
  avatarUrl?: string;
  /** Follow state + handler, owned by the page so this card stays in sync
   *  with the Follow button in the article header. Omit to hide the button. */
  isFollowing?: boolean;
  followBusy?: boolean;
  onFollow?: () => void;
}

export function AuthorBioCard({
  slug, name, tagline, bio, avatarUrl,
  isFollowing = false, followBusy = false, onFollow,
}: AuthorBioCardProps) {
  return (
    <div style={{
      maxWidth: 680, margin: '48px auto', padding: 32,
      background: '#fff', border: '1px solid rgba(240,120,20,0.15)',
      borderRadius: 16, display: 'flex', gap: 24,
    }}>
      {/* Avatar */}
      <div style={{
        width: 80, height: 80, borderRadius: '50%', flexShrink: 0,
        border: '3px solid #F07814', overflow: 'hidden', background: '#FEF7F0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 28, fontWeight: 600, color: '#F07814',
          }}>
            {name.split(' ').map(w => w[0]).join('').slice(0, 2)}
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#8A8278', marginBottom: 4 }}>
          Written by
        </div>
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 22, fontWeight: 500, color: '#3A3530', marginBottom: 4,
        }}>
          {name}
        </div>
        {tagline && <div style={{ fontSize: 13, color: '#8A8278', marginBottom: 10 }}>{tagline}</div>}
        {bio && <p style={{ fontSize: 14, color: '#3A3530', lineHeight: 1.7, marginBottom: 16 }}>{bio}</p>}
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href={`/guides/${slug}`} style={{
            padding: '8px 18px', borderRadius: 6,
            background: '#3A3530', color: '#F07814',
            fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
            textDecoration: 'none',
          }}>
            View Profile
          </Link>
          {onFollow && (
            <button
              onClick={onFollow}
              disabled={followBusy}
              style={{
                padding: '7px 18px', borderRadius: 6,
                background: isFollowing ? '#F07814' : 'transparent',
                color: isFollowing ? '#fff' : '#3A3530',
                fontSize: 11, fontWeight: 500, letterSpacing: '0.08em',
                border: `1.5px solid ${isFollowing ? '#F07814' : 'rgba(240,120,20,0.3)'}`,
                cursor: followBusy ? 'default' : 'pointer',
              }}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
