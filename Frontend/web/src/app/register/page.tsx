'use client';

import { useState, useEffect, FormEvent,Suspense  } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { LocationAutocomplete } from '@/components/shared/LocationAutocomplete';
import { useAuthStore } from '@/store/auth.store';

// ─── Design tokens ────────────────────────────────────────────────────────────
const G = {
  gold:      '#E8B84B',
  goldLight: '#F5D98A',
  goldPale:  '#FDF6E3',
  charcoal:  '#3A3530',
  warmGray:  '#8A8278',
  offWhite:  '#FAFAF7',
  white:     '#FFFFFF',
  green:     '#5A8A6A',
  red:       '#C0392B',
};

// ─── Interest tags ────────────────────────────────────────────────────────────
const ALL_INTERESTS = [
  '🌿 Herbalism','🧘 Meditation','💆 Massage','🪡 Acupuncture','🔮 Energy Healing',
  '🌀 Reiki','🌬️ Breathwork','🌙 Astrology','🌺 Ayurveda','☯️ TCM','🏔️ Retreats',
  '✈️ Soul Travels','🎉 Meetups','📚 Classes','🗣️ Life Coaching','🎨 Art Therapy',
  '🎵 Sound Healing','🌊 Somatic Work','🌱 Plant Medicine','🕯️ Shamanism',
  '🧬 Tibetan Medicine','🏃 Yoga','🥗 Nutrition','💫 Human Design',
];

const EXPERIENCE_CARDS = [
  { icon: '🌱', subtitle: 'Just Curious', title: 'I want to explore',        desc: "I'm new to spiritual and wellness practices and want to discover what resonates with me." },
  { icon: '🌿', subtitle: 'Beginner · 1–3 Years', title: "I've started my practice", desc: "I've tried meditation, yoga, or other practices and want to deepen my understanding." },
  { icon: '🌳', subtitle: 'Intermediate · 3–7 Years', title: 'I have a regular practice', desc: 'I meditate, work with a teacher, or follow a dedicated path and am looking to expand.' },
  { icon: '🏔️', subtitle: 'Advanced · 7+ Years', title: 'I walk a dedicated path', desc: 'Spiritual practice is central to my life. I seek advanced teachings and transformative experiences.' },
];

const PRACTICES = [
  '🧘 Meditation','🙏 Affirmations','🌬️ Breathwork / Pranayama','📖 Journaling',
  '🏃 Yoga','🔮 Energy Work / Reiki','🌙 Dream Work','🎵 Sound / Music Healing',
  '🌿 Plant Medicine','🌊 Somatic Practices','🕯️ Ritual / Ceremony','💫 Astrology / Human Design',
];

const LANGUAGES = [
  { flag: '🇺🇸', label: 'English', code: 'en' },
  { flag: '🇨🇳', label: 'Chinese (Mandarin)', code: 'zh-cn' },
  { flag: '🇭🇰', label: 'Chinese (Cantonese)', code: 'zh-hk' },
  { flag: '🇪🇸', label: 'Spanish', code: 'es' },
  { flag: '🇷🇺', label: 'Russian', code: 'ru' },
];

const AI_CHIPS = [
  'Burnout & exhaustion','Anxiety & overwhelm','Feeling stuck or lost',
  'Chronic pain / low energy','Deepen meditation','Relationship challenges',
  'New to spirituality','Food & body relationship','AI & career uncertainty','Transformative travel',
];

// ─── Progress stepper ─────────────────────────────────────────────────────────
const STEPS = ['Create Account','Verify Email','Your Interests','Experience','Your Journey'];

function ProgressBar({ step }: { step: number }) {
  return (
    <div style={{
      position: 'fixed', top: 73, left: 0, right: 0, zIndex: 99,
      background: G.white, borderBottom: `1px solid rgba(232,184,75,0.15)`,
      padding: '12px 48px', display: 'flex', alignItems: 'center',
    }}>
      {STEPS.map((label, i) => {
        const num = i + 1;
        const done = step > num;
        const active = step === num;
        return (
          <div key={num} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                border: `1.5px solid ${done ? G.charcoal : active ? G.gold : G.goldLight}`,
                background: done ? G.charcoal : active ? G.gold : G.white,
                color: done || active ? G.white : G.warmGray,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 500, transition: 'all 0.3s',
                fontFamily: `var(--font-inter), sans-serif`,
              }}>
                {done ? '✓' : i === STEPS.length - 1 ? '✦' : num}
              </div>
              <span style={{
                fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
                color: active ? G.charcoal : G.warmGray, fontWeight: active ? 500 : 400,
                whiteSpace: 'nowrap', fontFamily: `var(--font-inter), sans-serif`,
              }}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 1, background: done ? G.charcoal : G.goldLight, margin: '0 12px',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Shared button styles ─────────────────────────────────────────────────────
const btnPrimary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 10,
  background: G.charcoal, color: G.white,
  fontFamily: `var(--font-inter), sans-serif`, fontSize: 11, fontWeight: 500,
  letterSpacing: '0.14em', textTransform: 'uppercase',
  border: 'none', borderRadius: 4, padding: '16px 36px',
  cursor: 'pointer', textDecoration: 'none',
};

// ─── Main component ───────────────────────────────────────────────────────────
function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth, user, isAuthenticated } = useAuthStore();

  // Is this a Google OAuth continuation?
  const fromGoogle = searchParams.get('from') === 'google';
  const isGoogleUser = isAuthenticated && fromGoogle;

  // Wizard state
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 form — pre-filled from Google profile if available
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [email, setEmail]         = useState('');
  const [phone, setPhone]         = useState('');
  const [location, setLocation]   = useState('');
  const [languages, setLanguages] = useState<string[]>(['en']);
  const [password, setPassword]   = useState('');
  const [newsletter, setNewsletter] = useState(true);
  const [terms, setTerms]         = useState(false);

  // Step 2 interests
  const [interests, setInterests]       = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Step 3 experience
  const [expIndex, setExpIndex]       = useState<number | null>(null);
  const [practices, setPractices]     = useState<string[]>([]);

  // Step 4 AI
  const [aiInput, setAiInput]     = useState('');
  const [aiShown, setAiShown]     = useState(false);
  const [disclaimerShown, setDisclaimerShown] = useState(false);

  // ─── On mount: pre-fill / resume ───────────────────────────────────────────
  useEffect(() => {
    if (isGoogleUser && user) {
      setFirstName(user.firstName ?? '');
      setLastName(user.lastName ?? '');
      setEmail(user.email ?? '');
      // Honour ?step=N if returning Google user was mid-registration, otherwise start at 2
      const stepParam = searchParams.get('step');
      const resumeStep = stepParam ? Math.max(2, parseInt(stepParam, 10)) : 2;
      setStep(resumeStep);
      return;
    }
    // Resume for email-registered users returning to finish registration
    if (isAuthenticated && !fromGoogle) {
      api.get('/seekers/onboarding/status')
        .then(({ data }) => {
          if (data.completed) { router.replace('/'); return; }
          // If step is 1 but user is already authenticated, they have an account — start at 2
          setStep(data.step > 1 ? data.step : 2);
        })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Step 1: Register (email path only) ────────────────────────────────────
  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    if (!terms) { setError('Please accept the Terms of Service to continue.'); return; }
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post('/auth/register', {
        firstName,
        lastName,
        email,
        password,
        ...(phone ? { phone } : {}),
        ...(location ? { location } : {}),
        newsletterOptIn: newsletter,
      });
      setAuth(data.user, data.accessToken);
      // Persist step so returning users resume here
      api.patch('/seekers/onboarding/step', { step: 2 }).catch(() => {});
      setStep(2);
    } catch (err: any) {
      const msg = err.response?.data?.message ?? 'Registration failed. Please try again.';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  // ─── AI response ───────────────────────────────────────────────────────────
  const triggerAI = (text?: string) => {
    if (text) setAiInput(text);
    setDisclaimerShown(true);
    setAiShown(true);
  };

  // ─── Save interests then advance ───────────────────────────────────────────
  const saveInterestsAndContinue = async () => {
    if (interests.length > 0) {
      try {
        await api.patch('/users/seeker/profile', { interests });
      } catch {
        // non-blocking
      }
    }
    api.patch('/seekers/onboarding/step', { step: 3 }).catch(() => {});
    setStep(3);
  };

  // ─── Final step: mark complete then redirect ───────────────────────────────
  const finish = () => {
    api.patch('/seekers/onboarding/step', { step: 4, completed: true }).catch(() => {});
    router.push(searchParams.get('redirect') ?? '/');
  };

  // ─── Toggle helpers ────────────────────────────────────────────────────────
  const toggleLang = (code: string) =>
    setLanguages((l) => l.includes(code) ? l.filter((x) => x !== code) : [...l, code]);
  const toggleInterest = (tag: string) =>
    setInterests((t) => t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag]);
  const togglePractice = (p: string) =>
    setPractices((arr) => arr.includes(p) ? arr.filter((x) => x !== p) : [...arr, p]);

  // ─── Nav ──────────────────────────────────────────────────────────────────
  const Nav = () => (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 48px',
      background: 'rgba(250,250,247,0.94)', backdropFilter: 'blur(14px)',
      borderBottom: 'rgba(232,184,75,0.15) 1px solid',
    }}>
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
        <Image src="/images/logo.jpg" alt="Spiritual California" width={44} height={44}
          style={{ borderRadius: '50%', objectFit: 'cover' }} />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span style={{ fontFamily: 'var(--font-cormorant-garamond), serif', fontSize: 18, fontWeight: 500, color: G.charcoal }}>
            Spiritual California
          </span>
          <span style={{ fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: G.warmGray, marginTop: 3 }}>
            mind · body · soul
          </span>
        </div>
      </Link>
      <ul style={{ display: 'flex', gap: 36, listStyle: 'none' }}>
        {['Practitioners','Shop','Soul Travels','Events'].map((l) => (
          <li key={l}>
            <Link href="/" style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: G.warmGray, textDecoration: 'none' }}>
              {l}
            </Link>
          </li>
        ))}
      </ul>
      {!isAuthenticated && (
        <Link href="/signin" style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: G.charcoal, textDecoration: 'none', borderBottom: `1.5px solid ${G.gold}`, paddingBottom: 2 }}>
          Sign In
        </Link>
      )}
    </nav>
  );

  // ─── Botanical SVG bg ──────────────────────────────────────────────────────
  const BotanicalBg = () => (
    <svg style={{ position: 'fixed', top: 0, right: 0, width: 320, height: '100vh', pointerEvents: 'none', zIndex: 0, opacity: 0.04 }}
      viewBox="0 0 320 800" fill="none">
      <ellipse cx="260" cy="200" rx="120" ry="180" stroke="#E8B84B" strokeWidth="1.5" transform="rotate(-20 260 200)" />
      <ellipse cx="200" cy="400" rx="90" ry="140" stroke="#E8B84B" strokeWidth="1" transform="rotate(15 200 400)" />
      <line x1="260" y1="380" x2="260" y2="800" stroke="#E8B84B" strokeWidth="1" />
      <ellipse cx="180" cy="600" rx="70" ry="110" stroke="#E8B84B" strokeWidth="1" transform="rotate(-10 180 600)" />
    </svg>
  );

  const inputStyle: React.CSSProperties = {
    background: G.white, border: `1px solid rgba(232,184,75,0.3)`,
    borderRadius: 4, padding: '12px 16px',
    fontFamily: 'var(--font-inter), sans-serif', fontSize: 14, color: G.charcoal,
    outline: 'none', width: '100%',
  };
  const inputReadOnly: React.CSSProperties = {
    ...inputStyle,
    background: G.goldPale,
    color: G.warmGray,
    cursor: 'default',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase',
    color: G.warmGray, fontWeight: 500, fontFamily: 'var(--font-inter), sans-serif',
  };
  const eyebrowStyle: React.CSSProperties = {
    fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
    color: G.gold, marginBottom: 10, fontFamily: 'var(--font-inter), sans-serif',
  };
  const titleStyle: React.CSSProperties = {
    fontFamily: 'var(--font-cormorant-garamond), serif', fontSize: 42, fontWeight: 400,
    lineHeight: 1.15, color: G.charcoal, marginBottom: 8,
  };
  const subtitleStyle: React.CSSProperties = {
    fontSize: 14, color: G.warmGray, lineHeight: 1.6, marginBottom: 40,
    fontFamily: 'var(--font-inter), sans-serif',
  };

  return (
    <div className="public-site" style={{ minHeight: '100vh', position: 'relative' }}>
      <BotanicalBg />
      <Nav />
      <ProgressBar step={step} />

      <div style={{ paddingTop: 140, paddingBottom: 80, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* ══ STEP 1: CREATE ACCOUNT ══════════════════════════════════════════ */}
        {step === 1 && (
          <div style={{ width: '100%', maxWidth: 600, padding: '0 24px', position: 'relative', zIndex: 1 }}>
            <p style={eyebrowStyle}>Welcome</p>
            <h1 style={titleStyle}>
              Begin your<br /><em style={{ fontStyle: 'italic', color: G.gold }}>journey</em> with us
            </h1>
            <p style={subtitleStyle}>
              Create your free account to connect with verified guides, discover healing practices, and explore your path.
            </p>


            {/* Google user notice */}
            {isGoogleUser && (
              <div style={{ background: G.goldPale, border: `1px solid ${G.goldLight}`, borderRadius: 8, padding: '14px 18px', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20 }}>✓</span>
                <div>
                  <div style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 13, fontWeight: 500, color: G.charcoal }}>
                    Signed in with Google
                  </div>
                  <div style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 12, color: G.warmGray, marginTop: 2 }}>
                    Your account has been created. Complete the steps below to personalise your journey.
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={isGoogleUser ? (e) => { e.preventDefault(); setStep(2); } : handleRegister}>
              {error && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#DC2626', marginBottom: 20, fontFamily: 'var(--font-inter), sans-serif' }}>
                  {error}
                </div>
              )}

              {/* Name row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={labelStyle}>First Name</label>
                  <input
                    style={isGoogleUser ? inputReadOnly : inputStyle}
                    type="text" placeholder="Maya"
                    value={firstName} onChange={(e) => setFirstName(e.target.value)}
                    readOnly={isGoogleUser} required
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={labelStyle}>Last Name</label>
                  <input
                    style={isGoogleUser ? inputReadOnly : inputStyle}
                    type="text" placeholder="Rosenberg"
                    value={lastName} onChange={(e) => setLastName(e.target.value)}
                    readOnly={isGoogleUser} required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                <label style={labelStyle}>Email Address</label>
                <input
                  style={isGoogleUser ? inputReadOnly : inputStyle}
                  type="email" placeholder="maya@example.com"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  readOnly={isGoogleUser} required
                />
              </div>

              {!isGoogleUser && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                    <label style={labelStyle}>Phone Number <span style={{ fontSize: 9, color: G.goldLight, textTransform: 'none', marginLeft: 4 }}>optional</span></label>
                    <input style={inputStyle} type="tel" placeholder="+1 (415) 000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                    <label style={labelStyle}>Location</label>
                    <LocationAutocomplete
                      value={location}
                      onChange={setLocation}
                      placeholder="Start typing a city or country…"
                      inputStyle={inputStyle}
                    />
                  </div>

                  {/* Languages */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                    <label style={labelStyle}>Preferred Language(s) <span style={{ fontSize: 11, color: G.warmGray, fontWeight: 400, textTransform: 'none' }}>Select all that apply</span></label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 6 }}>
                      {LANGUAGES.map(({ flag, label, code }) => (
                        <div key={code} onClick={() => toggleLang(code)} style={{
                          cursor: 'pointer', padding: '8px 18px', borderRadius: 24, userSelect: 'none',
                          border: `1.5px solid ${languages.includes(code) ? G.gold : '#ddd'}`,
                          background: languages.includes(code) ? G.goldPale : G.white,
                          fontSize: 13, color: G.charcoal, fontFamily: 'var(--font-inter), sans-serif',
                        }}>
                          {flag} {label}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                    <label style={labelStyle}>Password</label>
                    <input style={inputStyle} type="password" placeholder="Create a secure password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
                  </div>

                  {/* Checkboxes */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20, cursor: 'pointer' }}>
                    <input type="checkbox" checked={newsletter} onChange={(e) => setNewsletter(e.target.checked)}
                      style={{ width: 18, height: 18, flexShrink: 0, marginTop: 2, accentColor: G.gold }} />
                    <span style={{ fontSize: 13, color: G.warmGray, lineHeight: 1.5, fontFamily: 'var(--font-inter), sans-serif' }}>
                      I'd like to receive the Spiritual California newsletter — curated guides, practitioner spotlights, and upcoming events.{' '}
                      <a
                        href="#"
                        onClick={(e) => { e.preventDefault(); setNewsletter(false); }}
                        title="Clicking this will uncheck the newsletter opt-in above. You can also update this at any time from Account Settings."
                        style={{ color: G.gold, textDecoration: 'none', borderBottom: `1px dashed ${G.gold}` }}
                      >
                        Unsubscribe anytime.
                      </a>
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 32, cursor: 'pointer' }}>
                    <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)}
                      style={{ width: 18, height: 18, flexShrink: 0, marginTop: 2, accentColor: G.gold }} required />
                    <span style={{ fontSize: 13, color: G.warmGray, lineHeight: 1.5, fontFamily: 'var(--font-inter), sans-serif' }}>
                      I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: G.gold, textDecoration: 'none' }}>Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: G.gold, textDecoration: 'none' }}>Privacy Policy</a>.
                    </span>
                  </div>
                </>
              )}

              <button type="submit" style={{ ...btnPrimary, marginTop: isGoogleUser ? 8 : 0 }} disabled={loading}>
                {isGoogleUser
                  ? <>Continue <span style={{ fontSize: 16 }}>→</span></>
                  : loading ? 'Creating Account…' : <>Create Account <span style={{ fontSize: 16 }}>→</span></>
                }
              </button>
            </form>

            {!isAuthenticated && (
              <>
                <p style={{ textAlign: 'center', fontSize: 13, color: G.warmGray, marginTop: 24, fontFamily: 'var(--font-inter), sans-serif' }}>
                  Already have an account? <Link href="/signin" style={{ color: G.gold, textDecoration: 'none' }}>Sign in</Link>
                </p>
                <p style={{ textAlign: 'center', fontSize: 12, color: G.warmGray, marginTop: 16, fontFamily: 'var(--font-inter), sans-serif' }}>
                  Are you a practitioner?{' '}
                  <Link href="/onboarding/guide" style={{ color: G.gold, textDecoration: 'none' }}>List your practice →</Link>
                </p>
              </>
            )}
          </div>
        )}

        {/* ══ STEP 2: VERIFY EMAIL + INTERESTS ════════════════════════════════ */}
        {step === 2 && (
          <div style={{ width: '100%', maxWidth: 600, padding: '0 24px', position: 'relative', zIndex: 1 }}>

            {/* Email verified notice — only shown for email-registered users */}
            {!isGoogleUser && (
              <>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: G.goldPale, border: `2px solid ${G.goldLight}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, marginBottom: 28 }}>
                  ✉️
                </div>
                <p style={eyebrowStyle}>Almost there</p>
                <h1 style={titleStyle}>Check your<br /><em style={{ fontStyle: 'italic', color: G.gold }}>inbox</em></h1>
                <p style={{ ...subtitleStyle, marginBottom: 8 }}>We've sent a verification link to:</p>
                <div style={{ display: 'inline-block', background: G.goldPale, border: `1px solid ${G.goldLight}`, borderRadius: 4, padding: '8px 18px', fontSize: 14, color: G.charcoal, margin: '12px 0 20px', fontWeight: 500, fontFamily: 'var(--font-inter), sans-serif' }}>
                  {email}
                </div>
                <p style={{ ...subtitleStyle, marginBottom: 32 }}>Click the link in the email to verify. While you wait, tell us what calls to you.</p>
                <div style={{ height: 1, background: 'rgba(232,184,75,0.2)', margin: '0 0 32px' }} />
              </>
            )}

            {/* Google user: show personalisation header directly */}
            {isGoogleUser && (
              <div style={{ marginBottom: 32 }}>
                <p style={eyebrowStyle}>Personalise your journey</p>
                <h1 style={titleStyle}>What calls to<br /><em style={{ fontStyle: 'italic', color: G.gold }}>your curiosity?</em></h1>
                <p style={subtitleStyle}>
                  Select what resonates with you — we'll use this to suggest the right practitioners and experiences.
                </p>
              </div>
            )}

            {!isGoogleUser && (
              <p style={eyebrowStyle}>Your Interests</p>
            )}
            {!isGoogleUser && (
              <h2 style={{ fontFamily: 'var(--font-cormorant-garamond), serif', fontSize: 28, fontWeight: 400, marginBottom: 8, color: G.charcoal }}>
                What draws <em style={{ fontStyle: 'italic', color: G.gold }}>your curiosity?</em>
              </h2>
            )}
            <p style={{ ...subtitleStyle }}>Select all that resonate. You can always update these later.</p>

            {/* Tag cloud */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 36 }}>
              {ALL_INTERESTS.map((tag) => (
                <div key={tag} onClick={() => toggleInterest(tag)} style={{
                  padding: '8px 18px', border: `1.5px solid ${interests.includes(tag) ? G.gold : 'rgba(232,184,75,0.35)'}`,
                  borderRadius: 100, fontSize: 13, cursor: 'pointer', userSelect: 'none',
                  background: interests.includes(tag) ? G.gold : G.white,
                  color: interests.includes(tag) ? G.white : G.warmGray,
                  fontWeight: interests.includes(tag) ? 500 : 400,
                  fontFamily: 'var(--font-inter), sans-serif',
                }}>
                  {tag}
                </div>
              ))}
              {customInterest && (
                <div onClick={() => toggleInterest(customInterest)} style={{
                  padding: '8px 18px', border: `1.5px solid ${interests.includes(customInterest) ? G.gold : 'rgba(232,184,75,0.35)'}`,
                  borderRadius: 100, fontSize: 13, cursor: 'pointer', userSelect: 'none',
                  background: interests.includes(customInterest) ? G.gold : G.white,
                  color: interests.includes(customInterest) ? G.white : G.warmGray,
                  fontFamily: 'var(--font-inter), sans-serif',
                }}>
                  {customInterest}
                </div>
              )}
              {!showCustomInput ? (
                <div onClick={() => setShowCustomInput(true)} style={{
                  padding: '8px 18px', border: `1.5px dashed rgba(232,184,75,0.4)`,
                  borderRadius: 100, fontSize: 13, color: G.gold, cursor: 'pointer',
                  background: 'transparent', fontFamily: 'var(--font-inter), sans-serif',
                }}>
                  + Add your own
                </div>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); if (customInterest.trim()) { toggleInterest(customInterest.trim()); setShowCustomInput(false); } }}
                  style={{ display: 'flex', gap: 8 }}>
                  <input autoFocus value={customInterest} onChange={(e) => setCustomInterest(e.target.value)}
                    placeholder="Your interest…"
                    style={{ ...inputStyle, width: 180, padding: '8px 14px', fontSize: 13 }} />
                  <button type="submit" style={{ ...btnPrimary, padding: '8px 16px', fontSize: 11 }}>Add</button>
                </form>
              )}
            </div>

            <button style={btnPrimary} onClick={saveInterestsAndContinue}>
              Continue <span style={{ fontSize: 16 }}>→</span>
            </button>

            {!isGoogleUser && (
              <p style={{ fontSize: 12, color: G.warmGray, marginTop: 20, fontFamily: 'var(--font-inter), sans-serif' }}>
                Didn't receive the email?{' '}
                <span onClick={() => alert('Verification email resent!')} style={{ color: G.gold, cursor: 'pointer' }}>Resend it</span>
              </p>
            )}
          </div>
        )}

        {/* ══ STEP 3: EXPERIENCE LEVEL ════════════════════════════════════════ */}
        {step === 3 && (
          <div style={{ width: '100%', maxWidth: 600, padding: '0 24px', position: 'relative', zIndex: 1 }}>
            <p style={eyebrowStyle}>Your Path</p>
            <h1 style={titleStyle}>Where are you<br />on your <em style={{ fontStyle: 'italic', color: G.gold }}>journey?</em></h1>
            <p style={subtitleStyle}>This helps us match you with the right practitioners. There is no wrong answer.</p>

            {/* Experience cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 40 }}>
              {EXPERIENCE_CARDS.map((card, i) => (
                <div key={i} onClick={() => setExpIndex(i)} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 20,
                  padding: '24px 28px',
                  border: `1.5px solid ${expIndex === i ? G.gold : 'rgba(232,184,75,0.25)'}`,
                  borderRadius: 8, background: expIndex === i ? G.goldPale : G.white,
                  cursor: 'pointer', transition: 'all 0.3s',
                }}>
                  <div style={{ fontSize: 32, flexShrink: 0, marginTop: 2 }}>{card.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: G.gold, marginBottom: 4, fontFamily: 'var(--font-inter), sans-serif' }}>
                      {card.subtitle}
                    </div>
                    <div style={{ fontFamily: 'var(--font-cormorant-garamond), serif', fontSize: 22, fontWeight: 500, color: G.charcoal, marginBottom: 4 }}>
                      {card.title}
                    </div>
                    <div style={{ fontSize: 13, color: G.warmGray, lineHeight: 1.5, fontFamily: 'var(--font-inter), sans-serif' }}>
                      {card.desc}
                    </div>
                  </div>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    border: `1.5px solid ${expIndex === i ? G.gold : G.goldLight}`,
                    background: expIndex === i ? G.gold : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, color: expIndex === i ? G.white : 'transparent',
                  }}>✓</div>
                </div>
              ))}
            </div>

            <p style={{ fontSize: 13, color: G.warmGray, marginBottom: 20, fontStyle: 'italic', fontFamily: 'var(--font-inter), sans-serif' }}>
              Which practices have you explored?{' '}
              <button
                type="button"
                onClick={() => setPractices(practices.length === PRACTICES.length ? [] : [...PRACTICES])}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: G.gold, fontStyle: 'italic', fontSize: 13, fontFamily: 'var(--font-inter), sans-serif', textDecoration: 'underline' }}
              >
                {practices.length === PRACTICES.length ? 'Deselect all.' : 'Select all that apply.'}
              </button>
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 32 }}>
              {PRACTICES.map((p) => (
                <div key={p} onClick={() => togglePractice(p)} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '14px 16px',
                  border: `1px solid ${practices.includes(p) ? G.gold : 'rgba(232,184,75,0.25)'}`,
                  borderRadius: 6, background: practices.includes(p) ? G.goldPale : G.white,
                  cursor: 'pointer', transition: 'all 0.25s',
                }}>
                  <input type="checkbox" readOnly checked={practices.includes(p)} style={{ accentColor: G.gold }} />
                  <span style={{ fontSize: 13, color: G.charcoal, fontFamily: 'var(--font-inter), sans-serif' }}>{p}</span>
                </div>
              ))}
            </div>

            <button style={btnPrimary} onClick={() => {
              api.patch('/seekers/onboarding/step', { step: 4 }).catch(() => {});
              setStep(4);
            }}>
              Continue <span style={{ fontSize: 16 }}>→</span>
            </button>
          </div>
        )}

        {/* ══ STEP 4: AI GUIDE ════════════════════════════════════════════════ */}
        {step === 4 && (
          <div style={{ width: '100%', maxWidth: 680, padding: '0 24px', position: 'relative', zIndex: 1 }}>
            <p style={eyebrowStyle}>Your Guide</p>
            <h1 style={titleStyle}>What brings you<br /><em style={{ fontStyle: 'italic', color: G.gold }}>here today?</em></h1>
            <p style={subtitleStyle}>
              Share what's on your mind — our AI guide will suggest practitioners, events, and resources that may help. This is completely private.
            </p>

            {/* Disclaimer (shown after AI response) */}
            {disclaimerShown && (
              <div style={{ background: '#FFF8F6', border: `1px solid rgba(192,57,43,0.2)`, borderLeft: `3px solid ${G.red}`, borderRadius: 6, padding: '20px 24px', marginBottom: 28 }}>
                <div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: G.red, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-inter), sans-serif' }}>
                  ⚠️ Important Notice
                </div>
                <div style={{ fontSize: 12, color: G.charcoal, lineHeight: 1.7, fontFamily: 'var(--font-inter), sans-serif' }}>
                  <strong style={{ color: G.red }}>Spiritual California is not a medical or mental health service provider.</strong> Content and practitioners are for general wellness and personal growth only — not medical advice, diagnosis, or treatment.
                  <br /><br />
                  <strong style={{ color: G.red }}>If you are in a mental health emergency, please contact:</strong>
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[['🆘 Emergency:', '911', 'tel:911'],['📞 988 Suicide & Crisis Lifeline:', 'Call or text 988', 'tel:988'],['💬 Crisis Text Line:', 'Text HOME to 741741', 'sms:741741'],['🌿 CA Warm Line:', '1-855-845-7415', 'tel:18558457415']].map(([label, link, href]) => (
                      <div key={href} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: G.charcoal, fontFamily: 'var(--font-inter), sans-serif' }}>
                        <strong>{label}</strong> <a href={href} style={{ color: G.red, fontWeight: 600, textDecoration: 'none' }}>{link}</a>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* AI input */}
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <textarea
                value={aiInput} onChange={(e) => setAiInput(e.target.value)}
                placeholder="Tell us what's on your mind… e.g. I've been feeling burnt out and disconnected from myself."
                rows={3}
                style={{ width: '100%', padding: '18px 56px 18px 20px', border: `1.5px solid rgba(232,184,75,0.4)`, borderRadius: 8, background: G.white, fontFamily: 'var(--font-inter), sans-serif', fontSize: 15, color: G.charcoal, outline: 'none', resize: 'none', minHeight: 80 }}
              />
              <button onClick={() => triggerAI()} style={{ position: 'absolute', bottom: 14, right: 14, background: G.gold, border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                →
              </button>
            </div>

            <p style={{ fontSize: 11, color: G.warmGray, marginBottom: 16, letterSpacing: '0.05em', fontFamily: 'var(--font-inter), sans-serif' }}>
              Or choose a starting point:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
              {AI_CHIPS.map((chip) => (
                <div key={chip} onClick={() => triggerAI(chip)} style={{
                  padding: '7px 14px', border: `1px solid rgba(232,184,75,0.3)`,
                  borderRadius: 100, fontSize: 12, color: G.warmGray, cursor: 'pointer',
                  background: G.white, fontFamily: 'var(--font-inter), sans-serif',
                }}>
                  {chip}
                </div>
              ))}
            </div>

            {/* AI Response */}
            {aiShown && (
              <div style={{ marginTop: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: G.goldPale, border: `1.5px solid ${G.goldLight}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                    ✦
                  </div>
                  <div>
                    <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: G.gold, fontFamily: 'var(--font-inter), sans-serif' }}>Your Guide</div>
                    <div style={{ fontSize: 13, color: G.charcoal, fontWeight: 500, fontFamily: 'var(--font-inter), sans-serif' }}>Spiritual California AI</div>
                  </div>
                </div>
                <p style={{ fontSize: 14, color: G.charcoal, lineHeight: 1.7, fontStyle: 'italic', marginBottom: 28, fontFamily: 'var(--font-inter), sans-serif' }}>
                  "I hear you. What you're describing — that deep fatigue that goes beyond physical tiredness — is something many people on this path have felt. It often signals that your body and spirit are asking for a different kind of nourishment. Here are some practitioners and experiences that may offer you a gentle starting point."
                </p>

                <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: G.warmGray, marginBottom: 14, marginTop: 24, fontFamily: 'var(--font-inter), sans-serif' }}>
                  Practitioners who may help
                </div>
                <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8, marginBottom: 8 }}>
                  {[{ icon: '🌿', tag: '✦ Verified · Somatic Therapy', name: 'Dr. Priya Nair', meta: 'San Francisco · $120/session' },
                    { icon: '🧘', tag: '✦ Verified · Meditation Guide', name: 'Lena Kovacs', meta: 'Online · $85/session' },
                    { icon: '🌀', tag: '✦ Verified · Energy Healing', name: 'Marcus Webb', meta: 'Los Angeles · $95/session' }].map((c) => (
                    <div key={c.name} style={{ flexShrink: 0, width: 180, border: `1px solid rgba(232,184,75,0.25)`, borderRadius: 8, overflow: 'hidden', background: G.white }}>
                      <div style={{ width: '100%', height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, background: `linear-gradient(135deg, ${G.goldPale}, ${G.goldLight})` }}>
                        {c.icon}
                      </div>
                      <div style={{ padding: 12 }}>
                        <div style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: G.gold, marginBottom: 4, fontFamily: 'var(--font-inter), sans-serif' }}>{c.tag}</div>
                        <div style={{ fontFamily: 'var(--font-cormorant-garamond), serif', fontSize: 15, color: G.charcoal, lineHeight: 1.3 }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: G.warmGray, marginTop: 4, fontFamily: 'var(--font-inter), sans-serif' }}>{c.meta}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 40 }}>
              <button style={btnPrimary} onClick={finish}>
                Explore your path <span style={{ fontSize: 16 }}>→</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading…</div>}>
      <RegisterContent />
    </Suspense>
  );
}
