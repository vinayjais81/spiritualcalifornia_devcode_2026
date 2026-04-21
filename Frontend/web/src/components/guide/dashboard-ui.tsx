'use client';

import React from 'react';
import Image from 'next/image';

// ─── Design tokens ───────────────────────────────────────────────────────────
export const C = {
  gold: '#E8B84B', goldLight: '#F5D98A', goldPale: '#FDF6E3',
  charcoal: '#3A3530', warmGray: '#8A8278', offWhite: '#FAFAF7',
  white: '#FFFFFF', green: '#5A8A6A', red: '#C0392B',
};
export const font = "var(--font-inter), 'Inter', sans-serif";
export const serif = "var(--font-cormorant-garamond), 'Cormorant Garamond', serif";

// ─── Helpers ─────────────────────────────────────────────────────────────────
export function formatPrice(p: number | string) { const n = typeof p === 'string' ? parseFloat(p) : p; return n === 0 ? 'Free' : `$${n.toFixed(0)}`; }
export function formatDate(iso: string) { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
export function formatMonth(iso: string) { return new Date(iso).toLocaleDateString('en-US', { month: 'short' }); }
export function formatDay(iso: string) { return new Date(iso).getDate(); }

// ─── Page Header ─────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '36px' }}>
      <div>
        <h1 style={{ fontFamily: serif, fontSize: '36px', fontWeight: 400, color: C.charcoal }}>{title}</h1>
        {subtitle && <p style={{ fontFamily: font, fontSize: '13px', color: C.warmGray, marginTop: '4px' }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ─── Panel ───────────────────────────────────────────────────────────────────
export function Panel({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.white, border: '1px solid rgba(232,184,75,0.12)', borderRadius: '12px', padding: '32px', marginBottom: '28px' }}>
      <div style={{ fontFamily: serif, fontSize: '22px', fontWeight: 500, color: C.charcoal, marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid rgba(232,184,75,0.15)', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '20px' }}>{icon}</span> {title}
      </div>
      {children}
    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────
export function StatCard({ value, label, accent }: { value: string | number; label: string; accent?: boolean }) {
  return (
    <div style={{ background: accent ? C.goldPale : C.white, border: `1px solid ${accent ? C.gold : 'rgba(232,184,75,0.15)'}`, borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
      <div style={{ fontFamily: serif, fontSize: '36px', fontWeight: 500, color: accent ? C.gold : C.charcoal, marginBottom: '4px' }}>{value}</div>
      <div style={{ fontFamily: font, fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.warmGray }}>{label}</div>
    </div>
  );
}

// ─── Button ──────────────────────────────────────────────────────────────────
export function Btn({ children, variant = 'primary', size = 'md', onClick, style: extraStyle, disabled }: { children: React.ReactNode; variant?: 'primary' | 'secondary' | 'danger' | 'green'; size?: 'sm' | 'md'; onClick?: () => void; style?: React.CSSProperties; disabled?: boolean }) {
  const base: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '8px', fontFamily: font, fontSize: size === 'sm' ? '11px' : '12px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', borderRadius: '6px', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 0.3s', textDecoration: 'none', padding: size === 'sm' ? '7px 14px' : '10px 22px', opacity: disabled ? 0.55 : 1 };
  const styles: Record<string, React.CSSProperties> = {
    primary: { ...base, background: C.gold, color: C.white },
    secondary: { ...base, background: 'transparent', color: C.charcoal, border: '1.5px solid rgba(232,184,75,0.5)' },
    danger: { ...base, background: 'transparent', color: C.red, border: `1.5px solid rgba(192,57,43,0.3)` },
    green: { ...base, background: C.green, color: C.white },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...styles[variant], ...extraStyle }}>{children}</button>;
}

// ─── Form Components ─────────────────────────────────────────────────────────
export function FormGroup({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', ...(full ? { gridColumn: '1 / -1' } : {}) }}>
      <label style={{ fontFamily: font, fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.warmGray, fontWeight: 500 }}>{label}</label>
      {children}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ fontFamily: font, fontSize: '13px', color: C.charcoal, background: C.offWhite, border: '1.5px solid rgba(232,184,75,0.3)', borderRadius: '8px', padding: '10px 14px', outline: 'none', width: '100%', ...props.style }} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} style={{ fontFamily: font, fontSize: '13px', color: C.charcoal, background: C.offWhite, border: '1.5px solid rgba(232,184,75,0.3)', borderRadius: '8px', padding: '10px 14px', outline: 'none', width: '100%', resize: 'vertical', minHeight: '100px', ...props.style }} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return <select {...props} style={{ fontFamily: font, fontSize: '13px', color: C.charcoal, background: C.offWhite, border: '1.5px solid rgba(232,184,75,0.3)', borderRadius: '8px', padding: '10px 14px', outline: 'none', width: '100%', ...props.style }}>{props.children}</select>;
}

// ─── Modal ───────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, maxWidth }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; maxWidth?: string }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(58,53,48,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.white, borderRadius: '16px', padding: '36px', width: '90%', maxWidth: maxWidth || '600px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ fontFamily: serif, fontSize: '26px', fontWeight: 500, color: C.charcoal }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: C.warmGray }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Event Date Box ──────────────────────────────────────────────────────────
export function EventDateBox({ startTime }: { startTime: string }) {
  return (
    <div style={{ background: C.goldPale, border: '1px solid rgba(232,184,75,0.4)', borderRadius: '8px', textAlign: 'center', padding: '8px' }}>
      <div style={{ fontFamily: font, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.warmGray }}>{formatMonth(startTime)}</div>
      <div style={{ fontFamily: serif, fontSize: '28px', fontWeight: 500, color: C.charcoal, lineHeight: 1 }}>{formatDay(startTime)}</div>
    </div>
  );
}

// ─── Status Badge ────────────────────────────────────────────────────────────
export function StatusBadge({ published }: { published: boolean }) {
  return (
    <span style={{ padding: '3px 10px', borderRadius: '20px', fontFamily: font, fontSize: '11px', ...(published ? { background: '#E8F5E9', color: '#2E7D32', border: '1px solid #A5D6A7' } : { background: '#F5F5F5', color: '#757575', border: '1px solid #E0E0E0' }) }}>
      {published ? 'Published' : 'Draft'}
    </span>
  );
}

// ─── Service Type Badge ──────────────────────────────────────────────────────
export function ServiceTypeBadge({ type }: { type: string }) {
  const styles: Record<string, { bg: string; color: string; border: string; label: string }> = {
    VIRTUAL: { bg: '#E8F5E9', color: '#2E7D32', border: '1px solid #A5D6A7', label: 'Online' },
    IN_PERSON: { bg: '#FFF3E0', color: '#E65100', border: '1px solid #FFCC80', label: 'In-Person' },
    HYBRID: { bg: C.goldPale, color: C.charcoal, border: '1px solid rgba(232,184,75,0.4)', label: 'Both' },
  };
  const s = styles[type] || styles.HYBRID;
  return <span style={{ padding: '3px 10px', borderRadius: '20px', fontFamily: font, fontSize: '11px', background: s.bg, color: s.color, border: s.border }}>{s.label}</span>;
}

// ─── Form Actions (bottom-center save button) ───────────────────────────────
export function FormActions({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'center', gap: '12px',
      padding: '32px 0 8px', marginTop: '12px',
      borderTop: '1px solid rgba(232,184,75,0.12)',
    }}>
      {children}
    </div>
  );
}

// ─── Product Thumbnail ───────────────────────────────────────────────────────
export function ProductThumb({ imageUrls, type, size = 60 }: { imageUrls: string[]; type: string; size?: number }) {
  const src = imageUrls?.[0];
  const isBase64 = src && src.startsWith('data:');
  const isUrl = src && src.startsWith('http');
  return (
    <div style={{ width: size, height: size, borderRadius: '8px', background: C.goldPale, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', overflow: 'hidden', flexShrink: 0 }}>
      {isBase64
        ? <img src={src} alt="" style={{ width: size, height: size, objectFit: 'cover' }} />
        : isUrl
          ? <Image src={src} alt="" width={size} height={size} className="object-cover" />
          : (type === 'DIGITAL' ? '🎵' : '📦')}
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────
export function EmptyState({ message }: { message: string }) {
  return <p style={{ fontFamily: font, fontSize: '13px', color: C.warmGray }}>{message}</p>;
}
