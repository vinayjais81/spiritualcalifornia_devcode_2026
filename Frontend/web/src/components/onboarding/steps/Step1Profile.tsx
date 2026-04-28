'use client';

import { useRef, ChangeEvent, useState, useEffect } from 'react';
import { useOnboardingStore } from '@/store/onboarding.store';
import { useAuthStore } from '@/store/auth.store';
import { api } from '@/lib/api';
import { refreshAuthWithLatestRoles } from '@/lib/refreshAuth';
import { LocationAutocomplete } from '@/components/shared/LocationAutocomplete';


const LANGUAGES = [
  { flag: '🇺🇸', label: 'English' },
  { flag: '🇨🇳', label: 'Chinese (Mandarin)' },
  { flag: '🇭🇰', label: 'Chinese (Cantonese)' },
  { flag: '🇪🇸', label: 'Spanish' },
  { flag: '🇷🇺', label: 'Russian' },
];

const iBase: React.CSSProperties = {
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'rgba(138,130,120,0.25)',
  borderRadius: '8px',
  padding: '12px 16px',
  fontFamily: 'var(--font-inter), sans-serif',
  fontSize: '14px',
  color: '#3A3530',
  background: '#FFFFFF',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box' as const,
  transition: 'border-color 0.3s, box-shadow 0.3s',
};

const lbl: React.CSSProperties = {
  fontSize: '11px', letterSpacing: '0.12em',
  textTransform: 'uppercase' as const, color: '#8A8278',
  fontWeight: 500, fontFamily: 'var(--font-inter), sans-serif',
  display: 'block', marginBottom: '6px',
};

export function Step1Profile() {
  const { step1, setStep1, setLoading, isLoading, setError, error, nextStep } = useOnboardingStore();
  const { user, isAuthenticated, setAuth } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingFile = useRef<File | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [terms, setTerms] = useState(false);

  // Pre-fill name from auth store on first load
  useEffect(() => {
    if (!step1.firstName && user?.firstName) setStep1({ firstName: user.firstName });
    if (!step1.lastName && user?.lastName) setStep1({ lastName: user.lastName });
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const iStyle = (f: string): React.CSSProperties =>
    focused === f ? { ...iBase, borderColor: '#E8B84B', boxShadow: '0 0 0 3px rgba(232,184,75,0.1)' } : iBase;

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStep1({ avatarPreviewUrl: URL.createObjectURL(file) });
    if (!isAuthenticated) {
      pendingFile.current = file; // defer S3 upload until after account creation
      return;
    }
    try {
      const { data } = await api.get('/upload/presigned-url', {
        params: { folder: 'avatars', fileName: file.name, contentType: file.type },
      });
      await fetch(data.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      setStep1({ avatarS3Key: data.key });
    } catch {
      setError('Avatar upload failed. Please try again.');
      setStep1({ avatarPreviewUrl: '', avatarS3Key: '' });
    }
  };

  const toggleLanguage = (lang: string) => {
    const langs = step1.languages ?? ['English'];
    setStep1({ languages: langs.includes(lang) ? langs.filter((l) => l !== lang) : [...langs, lang] });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!step1.bio || step1.bio.length < 30) { setError('Bio must be at least 30 characters.'); return; }
    if (!isAuthenticated && !terms) { setError('Please accept the Terms of Service and Privacy Policy to continue.'); return; }
    setLoading(true); setError(null);
    try {
      // For new (unauthenticated) users: create account first, then start onboarding
      if (!isAuthenticated) {
        if (!email || !password) { setError('Email and password are required.'); setLoading(false); return; }
        // intent='guide' tells the backend to NOT assign SEEKER / create a
        // SeekerProfile — guides and seekers are mutually exclusive on the
        // same email. The GUIDE role is assigned by /guides/onboarding/start
        // immediately below.
        const { data: authData } = await api.post('/auth/register', {
          firstName: step1.firstName,
          lastName: step1.lastName,
          email,
          password,
          intent: 'guide',
        });
        setAuth(authData.user, authData.accessToken);
        await api.post('/guides/onboarding/start');
        // GUIDE role just got added in the DB — rotate the JWT so later calls
        // (profile update, avatar upload, submit) pass @Roles(GUIDE) guards.
        await refreshAuthWithLatestRoles();
        // Upload deferred avatar if user selected one before creating account
        if (pendingFile.current) {
          const f = pendingFile.current;
          const { data: upData } = await api.get('/upload/presigned-url', {
            params: { folder: 'avatars', fileName: f.name, contentType: f.type },
          });
          await fetch(upData.uploadUrl, { method: 'PUT', body: f, headers: { 'Content-Type': f.type } });
          setStep1({ avatarS3Key: upData.key });
          pendingFile.current = null;
        }
      }

      const displayName = `${step1.firstName} ${step1.lastName}`.trim();
      await api.put('/guides/onboarding/profile', {
        displayName,
        tagline: step1.tagline || undefined,
        bio: step1.bio || undefined,
        phone: step1.phone || undefined,
        location: step1.location || undefined,
        timezone: step1.timezone || undefined,
        websiteUrl: step1.websiteUrl || undefined,
        avatarS3Key: step1.avatarS3Key || undefined,
        languages: step1.languages ?? ['English'],
      });
      nextStep();
    } catch (err: any) {
      const msg = err.response?.data?.message ?? 'Failed to save profile.';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: '44px' }}>
        <div style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#E8B84B', marginBottom: '10px', fontFamily: 'var(--font-inter), sans-serif' }}>Step 1 of 6</div>
        <h1 className="font-cormorant" style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 300, lineHeight: 1.1, color: '#3A3530', marginBottom: '10px' }}>
          Your <em style={{ fontStyle: 'italic', color: '#E8B84B' }}>profile</em>
        </h1>
        <p style={{ fontSize: '14px', color: '#8A8278', lineHeight: 1.7, maxWidth: '560px', fontFamily: 'var(--font-inter), sans-serif', margin: 0 }}>
          This is the first thing seekers will see. Make it authentic — your story, your presence, your invitation.
        </p>
      </div>
      {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: '#DC2626', fontFamily: 'var(--font-inter), sans-serif', marginBottom: '20px' }}>{error}</div>}

      {/* Avatar */}
      <div style={{ marginBottom: '20px' }}>
        <label style={lbl}>Profile Photo</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginTop: '6px' }}>
          <button type="button" onClick={() => fileInputRef.current?.click()} style={{ width: '140px', height: '140px', borderRadius: '50%', border: '2px dashed rgba(232,184,75,0.5)', background: step1.avatarPreviewUrl ? 'transparent' : '#FDF6E3', cursor: 'pointer', overflow: 'hidden', padding: 0, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {step1.avatarPreviewUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={step1.avatarPreviewUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ textAlign: 'center' }}><div style={{ fontSize: '28px', marginBottom: '6px' }}>🌸</div><div style={{ fontSize: '11px', color: '#8A8278', fontFamily: 'var(--font-inter), sans-serif' }}>Upload photo</div></div>
            }
          </button>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} style={{ display: 'none' }} />
          <div style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '13px', color: '#8A8278', lineHeight: 1.7 }}>
            A warm, clear headshot works best.<br />Minimum 400×400px · JPG or PNG<br /><span style={{ color: '#E8B84B' }}>Tip:</span> Natural light, genuine smile.
          </div>
        </div>
      </div>

      {/* Name row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        <div><label style={lbl}>First Name</label><input style={iStyle('fn')} type="text" placeholder="Maya" value={step1.firstName} onChange={(e) => setStep1({ firstName: e.target.value })} onFocus={() => setFocused('fn')} onBlur={() => setFocused(null)} required /></div>
        <div><label style={lbl}>Last Name</label><input style={iStyle('ln')} type="text" placeholder="Rosenberg" value={step1.lastName} onChange={(e) => setStep1({ lastName: e.target.value })} onFocus={() => setFocused('ln')} onBlur={() => setFocused(null)} required /></div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={lbl}>Tagline <span style={{ textTransform: 'none', letterSpacing: 0, fontSize: '11px', fontWeight: 400 }}>— your one-line introduction (like LinkedIn)</span></label>
        <input style={iStyle('tg')} type="text" placeholder="Ayurvedic practitioner & meditation guide · helping you return to balance" maxLength={100} value={step1.tagline} onChange={(e) => setStep1({ tagline: e.target.value })} onFocus={() => setFocused('tg')} onBlur={() => setFocused(null)} />
        <div style={{ fontSize: '11px', color: '#8A8278', textAlign: 'right', marginTop: '4px', fontFamily: 'var(--font-inter), sans-serif' }}>{step1.tagline.length}/100</div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={lbl}>About You <span style={{ textTransform: 'none', letterSpacing: 0, fontSize: '11px', fontWeight: 400 }}>— your story, approach, and what makes you unique</span></label>
        <textarea style={{ ...iStyle('bio'), resize: 'vertical', minHeight: '130px' } as React.CSSProperties} placeholder="Share your journey — what led you to this work, what you believe in, and how you guide others…" rows={5} maxLength={800} value={step1.bio} onChange={(e) => setStep1({ bio: e.target.value })} onFocus={() => setFocused('bio')} onBlur={() => setFocused(null)} />
        <div style={{ fontSize: '11px', color: '#8A8278', textAlign: 'right', marginTop: '4px', fontFamily: 'var(--font-inter), sans-serif' }}>{step1.bio.length}/800</div>
      </div>

      {/* Email + Phone row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        <div>
          <label style={lbl}>Email Address</label>
          {isAuthenticated
            ? <input style={{ ...iBase, background: '#FAFAF7', color: '#8A8278' }} type="email" value={user?.email ?? ''} readOnly />
            : <input style={iStyle('em')} type="email" placeholder="maya@example.com" value={email} onChange={(e) => setEmail(e.target.value)} onFocus={() => setFocused('em')} onBlur={() => setFocused(null)} required autoComplete="email" />
          }
        </div>
        <div>
          <label style={lbl}>Phone Number <span style={{ textTransform: 'none', letterSpacing: 0, fontSize: '11px', fontWeight: 400 }}>(optional)</span></label>
          <input style={iStyle('ph')} type="tel" placeholder="+1 (415) 000-0000" value={step1.phone} onChange={(e) => setStep1({ phone: e.target.value })} onFocus={() => setFocused('ph')} onBlur={() => setFocused(null)} />
        </div>
      </div>

      {/* Password — only for new (unauthenticated) users */}
      {!isAuthenticated && (
        <div style={{ marginBottom: '20px' }}>
          <label style={lbl}>Password</label>
          <div style={{ position: 'relative' }}>
            <input
              style={{ ...iStyle('pw'), paddingRight: '52px' }}
              type={showPass ? 'text' : 'password'}
              placeholder="Create a secure password (min 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setFocused('pw')}
              onBlur={() => setFocused(null)}
              required
              minLength={8}
              autoComplete="new-password"
            />
            <button type="button" onClick={() => setShowPass((p) => !p)} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 500, color: '#8A8278', fontFamily: 'var(--font-inter), sans-serif' }}>
              {showPass ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <label style={lbl}>Location / City</label>
        <LocationAutocomplete
          value={step1.location}
          onChange={(v) => setStep1({ location: v })}
          placeholder="Start typing a city or country…"
          inputStyle={iStyle('loc')}
          onFocus={() => setFocused('loc')}
          onBlur={() => setFocused(null)}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={lbl}>Preferred Language(s) <span style={{ textTransform: 'none', letterSpacing: 0, fontSize: '11px', fontWeight: 400 }}>— select all that apply</span></label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '6px' }}>
          {LANGUAGES.map(({ flag, label }) => {
            const sel = (step1.languages ?? ['English']).includes(label);
            return (
              <button key={label} type="button" onClick={() => toggleLanguage(label)} style={{ cursor: 'pointer', padding: '8px 18px', borderRadius: '24px', border: sel ? '1.5px solid #E8B84B' : '1.5px solid #ddd', background: sel ? '#FDF6E3' : '#FFFFFF', fontFamily: 'var(--font-inter), sans-serif', fontSize: '13px', color: '#3A3530', transition: 'all 0.2s' }}>
                {flag} {label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={lbl}>Website or Social Link <span style={{ textTransform: 'none', letterSpacing: 0, fontSize: '11px', fontWeight: 400 }}>(optional)</span></label>
        <input style={iStyle('web')} type="url" placeholder="https://your-website.com or instagram.com/yourhandle" value={step1.websiteUrl} onChange={(e) => setStep1({ websiteUrl: e.target.value })} onFocus={() => setFocused('web')} onBlur={() => setFocused(null)} />
      </div>

      {/* Terms — only shown for new (unauthenticated) users */}
      {!isAuthenticated && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginTop: 24 }}>
          <input
            type="checkbox"
            id="guide-terms"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            style={{ width: 18, height: 18, flexShrink: 0, marginTop: 2, accentColor: '#E8B84B', cursor: 'pointer' }}
          />
          <label htmlFor="guide-terms" style={{ fontSize: 13, color: '#8A8278', lineHeight: 1.5, fontFamily: 'var(--font-inter), sans-serif', cursor: 'pointer' }}>
            I agree to the{' '}
            <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: '#E8B84B', textDecoration: 'none' }}>Terms of Service</a>
            {' '}and{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#E8B84B', textDecoration: 'none' }}>Privacy Policy</a>.
          </label>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '40px', paddingTop: '28px', borderTop: '1px solid rgba(232,184,75,0.15)' }}>
        <button type="submit" disabled={isLoading} style={{ padding: '14px 36px', borderRadius: '8px', background: isLoading ? '#C4BDB5' : '#3A3530', color: '#FFFFFF', fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-inter), sans-serif', transition: 'background 0.3s' }}>
          {isLoading ? 'Saving…' : 'Continue → Services'}
        </button>
      </div>
    </form>
  );
}
