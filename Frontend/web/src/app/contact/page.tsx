'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/public/layout/Navbar';
import { Footer } from '@/components/public/layout/Footer';
import { api } from '@/lib/api';

const G = {
  gold:     '#E8B84B',
  charcoal: '#3A3530',
  warmGray: '#8A8278',
  offWhite: '#FAFAF7',
  white:    '#FFFFFF',
  red:      '#C0392B',
};

const INQUIRY_TYPES = [
  { value: 'general',     label: 'General Inquiry' },
  { value: 'guide',       label: 'Become a Guide' },
  { value: 'partnership', label: 'Partnership Opportunity' },
  { value: 'support',     label: 'Technical Support' },
  { value: 'media',       label: 'Media & Press' },
  { value: 'feedback',    label: 'Feedback' },
];

const INFO_ITEMS = [
  {
    icon: '📍',
    title: 'Based in',
    body: 'California, United States',
  },
  {
    icon: '📧',
    title: 'Email',
    body: 'hello@spiritualcalifornia.com',
    href: 'mailto:hello@spiritualcalifornia.com',
  },
  {
    icon: '🛡️',
    title: 'Support',
    body: 'support@spiritualcalifornia.com',
    href: 'mailto:support@spiritualcalifornia.com',
  },
  {
    icon: '🤝',
    title: 'Partnerships',
    body: 'partners@spiritualcalifornia.com',
    href: 'mailto:partners@spiritualcalifornia.com',
  },
];

const iBase: React.CSSProperties = {
  border: '1px solid rgba(138,130,120,0.25)',
  borderRadius: 8,
  padding: '12px 16px',
  fontFamily: 'var(--font-inter), sans-serif',
  fontSize: 14,
  color: G.charcoal,
  background: G.white,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s, box-shadow 0.2s',
};

const iFocus: React.CSSProperties = {
  ...iBase,
  borderColor: G.gold,
  boxShadow: '0 0 0 3px rgba(232,184,75,0.1)',
};

const lbl: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: G.warmGray,
  fontWeight: 500,
  fontFamily: 'var(--font-inter), sans-serif',
  display: 'block',
  marginBottom: 6,
};

export default function ContactPage() {
  const [focused, setFocused] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [phone, setPhone]     = useState('');
  const [type, setType]       = useState('general');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const iStyle = (f: string) => focused === f ? iFocus : iBase;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post('/contact', {
        name,
        email,
        ...(phone ? { phone } : {}),
        type,
        subject,
        message,
      });
      setSuccess(true);
    } catch (err: any) {
      const msg = err.response?.data?.message ?? 'Failed to send your message. Please try again.';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: G.offWhite, display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{ flex: 1, maxWidth: 1100, margin: '0 auto', width: '100%', padding: '120px 32px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 56 }}>
          <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase', color: G.gold, marginBottom: 14 }}>
            Get in Touch
          </p>
          <h1 style={{ fontFamily: 'var(--font-cormorant-garamond), serif', fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: 400, color: G.charcoal, lineHeight: 1.1, marginBottom: 14 }}>
            We&apos;d love to <em style={{ fontStyle: 'italic', color: G.gold }}>hear from you</em>
          </h1>
          <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 15, color: G.warmGray, lineHeight: 1.7, maxWidth: 520 }}>
            Whether you have a question about becoming a Guide, a partnership idea, or just want to say hello — our team is here and will respond within 24–48 hours.
          </p>
        </div>

        {/* Two-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 64, alignItems: 'start' }}>

          {/* ── FORM COLUMN ─────────────────────────────────────────────── */}
          <div>
            {success ? (
              /* Success state */
              <div style={{ background: G.white, border: '1px solid rgba(232,184,75,0.25)', borderRadius: 16, padding: 56, textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 20 }}>🌸</div>
                <h2 style={{ fontFamily: 'var(--font-cormorant-garamond), serif', fontSize: 36, fontWeight: 400, color: G.charcoal, marginBottom: 12 }}>
                  Message received
                </h2>
                <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 14, color: G.warmGray, lineHeight: 1.7, marginBottom: 8 }}>
                  Thank you for reaching out, <strong style={{ color: G.charcoal }}>{name}</strong>.
                </p>
                <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 14, color: G.warmGray, lineHeight: 1.7, marginBottom: 32 }}>
                  A confirmation has been sent to <strong style={{ color: G.charcoal }}>{email}</strong>. Our team will be in touch within 24–48 hours.
                </p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <Link href="/" style={{ background: G.charcoal, color: G.white, padding: '12px 28px', borderRadius: 6, fontFamily: 'var(--font-inter), sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', textDecoration: 'none' }}>
                    Back to Home
                  </Link>
                  <button onClick={() => { setSuccess(false); setName(''); setEmail(''); setPhone(''); setSubject(''); setMessage(''); setType('general'); }} style={{ border: `1px solid ${G.warmGray}`, color: G.warmGray, background: 'none', padding: '12px 28px', borderRadius: 6, fontFamily: 'var(--font-inter), sans-serif', fontSize: 11, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    Send Another
                  </button>
                </div>
              </div>
            ) : (
              /* Contact form */
              <form onSubmit={handleSubmit} style={{ background: G.white, border: '1px solid rgba(232,184,75,0.15)', borderRadius: 16, padding: 40 }}>

                {error && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#DC2626', fontFamily: 'var(--font-inter), sans-serif', marginBottom: 24 }}>
                    {error}
                  </div>
                )}

                {/* Name + Email */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                  <div>
                    <label style={lbl}>Your Name</label>
                    <input style={iStyle('name')} type="text" placeholder="Maya Rosenberg" value={name} onChange={e => setName(e.target.value)} onFocus={() => setFocused('name')} onBlur={() => setFocused(null)} required />
                  </div>
                  <div>
                    <label style={lbl}>Email Address</label>
                    <input style={iStyle('email')} type="email" placeholder="maya@example.com" value={email} onChange={e => setEmail(e.target.value)} onFocus={() => setFocused('email')} onBlur={() => setFocused(null)} required autoComplete="email" />
                  </div>
                </div>

                {/* Phone + Type */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                  <div>
                    <label style={lbl}>Phone <span style={{ textTransform: 'none', letterSpacing: 0, fontSize: 11, fontWeight: 400 }}>(optional)</span></label>
                    <input style={iStyle('phone')} type="tel" placeholder="+1 (415) 000-0000" value={phone} onChange={e => setPhone(e.target.value)} onFocus={() => setFocused('phone')} onBlur={() => setFocused(null)} />
                  </div>
                  <div>
                    <label style={lbl}>Inquiry Type</label>
                    <select
                      value={type}
                      onChange={e => setType(e.target.value)}
                      onFocus={() => setFocused('type')}
                      onBlur={() => setFocused(null)}
                      style={{ ...iStyle('type'), appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238A8278' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', paddingRight: 40 }}
                    >
                      {INQUIRY_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Subject */}
                <div style={{ marginBottom: 20 }}>
                  <label style={lbl}>Subject</label>
                  <input style={iStyle('subject')} type="text" placeholder="How can we help?" value={subject} onChange={e => setSubject(e.target.value)} onFocus={() => setFocused('subject')} onBlur={() => setFocused(null)} required maxLength={150} />
                </div>

                {/* Message */}
                <div style={{ marginBottom: 28 }}>
                  <label style={lbl}>Message</label>
                  <textarea
                    style={{ ...iStyle('msg'), resize: 'vertical', minHeight: 140 } as React.CSSProperties}
                    placeholder="Tell us more about your inquiry, question, or idea…"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    onFocus={() => setFocused('msg')}
                    onBlur={() => setFocused(null)}
                    required
                    minLength={10}
                    maxLength={2000}
                    rows={6}
                  />
                  <div style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 11, color: G.warmGray, textAlign: 'right', marginTop: 4 }}>
                    {message.length}/2000
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{ width: '100%', background: loading ? '#B5AFA8' : G.charcoal, color: G.white, border: 'none', borderRadius: 8, padding: '16px 36px', fontFamily: 'var(--font-inter), sans-serif', fontSize: 12, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, transition: 'background 0.3s' }}
                >
                  {loading && (
                    <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                  )}
                  {loading ? 'Sending…' : 'Send Message →'}
                </button>

                <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 12, color: G.warmGray, textAlign: 'center', marginTop: 16, lineHeight: 1.5 }}>
                  We typically respond within 24–48 hours. By submitting, you agree to our{' '}
                  <Link href="/terms" target="_blank" style={{ color: G.gold, textDecoration: 'none' }}>Terms</Link>
                  {' '}and{' '}
                  <Link href="/privacy" target="_blank" style={{ color: G.gold, textDecoration: 'none' }}>Privacy Policy</Link>.
                </p>

                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </form>
            )}
          </div>

          {/* ── INFO COLUMN ─────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Contact info card */}
            <div style={{ background: G.white, border: '1px solid rgba(232,184,75,0.15)', borderRadius: 16, padding: 32 }}>
              <h3 style={{ fontFamily: 'var(--font-cormorant-garamond), serif', fontSize: 22, fontWeight: 400, color: G.charcoal, marginBottom: 24 }}>
                Contact information
              </h3>
              {INFO_ITEMS.map((item) => (
                <div key={item.title} style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                  <span style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>{item.icon}</span>
                  <div>
                    <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: G.warmGray, marginBottom: 4 }}>
                      {item.title}
                    </p>
                    {item.href ? (
                      <a href={item.href} style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 14, color: G.gold, textDecoration: 'none' }}>{item.body}</a>
                    ) : (
                      <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 14, color: G.charcoal }}>{item.body}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Response time card */}
            <div style={{ background: G.charcoal, borderRadius: 16, padding: 32 }}>
              <div style={{ fontSize: 28, marginBottom: 16 }}>⏱️</div>
              <h3 style={{ fontFamily: 'var(--font-cormorant-garamond), serif', fontSize: 22, fontWeight: 400, color: G.white, marginBottom: 12 }}>
                Response time
              </h3>
              <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, marginBottom: 16 }}>
                Our team responds to all inquiries within <strong style={{ color: G.gold }}>24–48 business hours</strong>. For urgent technical issues, please include "URGENT" in your subject line.
              </p>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 16 }}>
                <p style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>
                  Mon – Fri · 9 AM – 6 PM PST
                </p>
              </div>
            </div>

            {/* Quick links */}
            <div style={{ background: 'rgba(232,184,75,0.06)', border: '1px solid rgba(232,184,75,0.15)', borderRadius: 16, padding: 28 }}>
              <h3 style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: G.warmGray, marginBottom: 16 }}>
                Helpful links
              </h3>
              {[
                { label: 'Become a Guide', href: '/onboarding/guide' },
                { label: 'Find a Practitioner', href: '/practitioners' },
                { label: 'Our Mission', href: '/mission' },
                { label: 'About Us', href: '/about' },
                { label: 'Terms of Service', href: '/terms' },
                { label: 'Privacy Policy', href: '/privacy' },
              ].map(({ label, href }) => (
                <Link key={href} href={href} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(232,184,75,0.1)', textDecoration: 'none', fontFamily: 'var(--font-inter), sans-serif', fontSize: 13, color: G.charcoal }}>
                  {label}
                  <span style={{ color: G.gold, fontSize: 14 }}>→</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
