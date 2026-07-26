'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

/**
 * The practitioners listing renders one button per card, and there is no
 * per-guide status endpoint — so without sharing, every card would fire its
 * own identical `GET /seekers/favorites`. Instances share a single in-flight
 * request; mutations clear it so the next mount refetches.
 */
let favoritesRequest: Promise<Set<string>> | null = null;

function loadFavoriteIds(): Promise<Set<string>> {
  if (!favoritesRequest) {
    favoritesRequest = api.get('/seekers/favorites')
      .then((r) => {
        const list: { guideId: string }[] = Array.isArray(r.data) ? r.data : [];
        return new Set(list.map((f) => f.guideId));
      })
      .catch(() => {
        favoritesRequest = null; // don't cache a failure
        return new Set<string>();
      });
  }
  return favoritesRequest;
}

/** Drop the cache after a save/unsave so other cards re-read fresh state. */
function invalidateFavorites() {
  favoritesRequest = null;
}

interface FavoriteGuideButtonProps {
  /** GuideProfile.id — the favorites API keys on the profile id, not the slug. */
  guideId: string;
  /** 'full' = labelled CTA (profile page). 'icon' = heart only (listing cards). */
  variant?: 'full' | 'icon';
}

/**
 * Save/unsave a guide to the seeker's Favorite Guides.
 *
 * The favorites API (`/seekers/favorites`) is `@Roles(Role.SEEKER)`, so this
 * only renders for seekers: guides and admins have no seeker profile and would
 * just get a 403. Anonymous visitors see the button and are sent to sign-in.
 */
export function FavoriteGuideButton({ guideId, variant = 'full' }: FavoriteGuideButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const roles = useAuthStore((s) => s.user?.roles);

  const isSeeker = !!roles?.includes('SEEKER');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  // Seed state from the seeker's existing favorites (shared across instances).
  useEffect(() => {
    // Signed out (or switched account) — drop the cache so the next seeker in
    // this tab doesn't inherit the previous one's saved set.
    if (!isAuthenticated || !isSeeker) { invalidateFavorites(); setSaved(false); return; }
    let cancelled = false;
    loadFavoriteIds().then((ids) => {
      if (!cancelled) setSaved(ids.has(guideId));
    });
    return () => { cancelled = true; };
  }, [guideId, isAuthenticated, isSeeker]);

  // Signed in as a guide/admin: favorites aren't theirs to have.
  if (isAuthenticated && !isSeeker) return null;

  const handleToggle = async () => {
    if (!isAuthenticated) {
      toast.error('Sign in to save this practitioner.');
      router.push(`/signin?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    if (busy) return;
    setBusy(true);
    const next = !saved;
    setSaved(next); // optimistic
    try {
      if (next) await api.post(`/seekers/favorites/${guideId}`);
      else await api.delete(`/seekers/favorites/${guideId}`);
      invalidateFavorites();
      toast.success(next ? 'Saved to your favorites' : 'Removed from favorites');
    } catch (err: unknown) {
      // 409 = already favorited (e.g. saved in another tab). The intent was to
      // save and it is saved, so keep the optimistic state instead of reverting.
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (next && status === 409) {
        invalidateFavorites();
        toast.success('Already in your favorites');
      } else {
        setSaved(!next);
        toast.error('Could not update favorites — please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  if (variant === 'icon') {
    return (
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleToggle(); }}
        disabled={busy}
        aria-pressed={saved}
        aria-label={saved ? 'Remove from favorites' : 'Save to favorites'}
        title={saved ? 'Remove from favorites' : 'Save to favorites'}
        style={{
          width: 34, height: 34, borderRadius: '50%',
          background: 'rgba(255,255,255,0.9)', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, lineHeight: 1, color: saved ? '#F07814' : '#3A3530',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          cursor: busy ? 'default' : 'pointer',
        }}
      >
        {saved ? '♥' : '♡'}
      </button>
    );
  }

  return (
    <button
      onClick={handleToggle}
      disabled={busy}
      aria-pressed={saved}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '14px 28px',
        background: saved ? '#FEF7F0' : 'transparent',
        color: '#3A3530',
        fontFamily: "'Inter', sans-serif",
        fontSize: 12, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase',
        border: `1.5px solid ${saved ? '#F07814' : 'rgba(240,120,20,0.35)'}`,
        borderRadius: 8,
        cursor: busy ? 'default' : 'pointer',
        transition: 'background 0.3s, border-color 0.3s',
      }}
    >
      <span aria-hidden style={{ color: '#F07814', fontSize: 14 }}>{saved ? '♥' : '♡'}</span>
      {saved ? 'Saved' : 'Save to Favorites'}
    </button>
  );
}
