'use client';

import { useRef, useState } from 'react';
import { useOnboardingStore } from '@/store/onboarding.store';
import { api } from '@/lib/api';
import type { PhysicalProduct } from '@/types/onboarding';

// ─── Design tokens ─────────────────────────────────────────────────────────
const gold     = '#E8B84B';
const charcoal = '#3A3530';
const warmGray = '#8A8278';
const white    = '#FFFFFF';
const goldPale = '#FDF6E3';

const iBase: React.CSSProperties = {
  border: '1px solid rgba(138,130,120,0.25)',
  borderRadius: '8px',
  padding: '11px 14px',
  fontFamily: 'var(--font-inter), sans-serif',
  fontSize: '14px',
  color: charcoal,
  background: white,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box' as const,
};

const lbl: React.CSSProperties = {
  fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase' as const,
  color: warmGray, fontWeight: 500, fontFamily: 'var(--font-inter), sans-serif',
  display: 'block', marginBottom: '5px',
};

const sectionLabel: React.CSSProperties = {
  textAlign: 'center' as const,
  fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase' as const,
  color: warmGray, fontFamily: 'var(--font-inter), sans-serif',
  margin: '32px 0 16px',
  display: 'flex', alignItems: 'center', gap: '16px',
};

const dividerLine: React.CSSProperties = {
  flex: 1, height: '1px', background: 'rgba(232,184,75,0.2)',
};

const addBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase' as const,
  color: gold, fontFamily: 'var(--font-inter), sans-serif', fontWeight: 500,
  padding: '8px 0', display: 'flex', alignItems: 'center', gap: '6px',
};

const removeBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: '11px', color: '#C0392B', fontFamily: 'var(--font-inter), sans-serif',
  padding: '0', lineHeight: 1,
};

// ─── Upload helpers ─────────────────────────────────────────────────────────

async function uploadToS3(file: File, folder: string): Promise<{ key: string; url: string }> {
  const { data } = await api.get('/upload/presigned-url', {
    params: { folder, fileName: file.name, contentType: file.type },
  });
  await fetch(data.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
  return { key: data.key, url: data.uploadUrl.split('?')[0] };
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Reusable upload zone ───────────────────────────────────────────────────

function UploadZone({
  icon, title, subtitle, accept, onChange, uploading, uploaded,
}: {
  icon: string;
  title: string;
  subtitle: string;
  accept: string;
  onChange: (file: File) => void;
  uploading?: boolean;
  uploaded?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div
      onClick={() => ref.current?.click()}
      style={{
        border: `1.5px dashed rgba(232,184,75,0.5)`,
        borderRadius: '10px', background: goldPale,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '28px 20px', cursor: 'pointer', textAlign: 'center',
        marginBottom: '16px',
      }}
    >
      <span style={{ fontSize: '32px', marginBottom: '8px' }}>{icon}</span>
      <div style={{ fontSize: '13px', fontWeight: 500, color: charcoal, fontFamily: 'var(--font-inter), sans-serif', marginBottom: '4px' }}>
        {uploading ? 'Uploading…' : uploaded ? uploaded : title}
      </div>
      <div style={{ fontSize: '11px', color: warmGray, fontFamily: 'var(--font-inter), sans-serif' }}>
        {subtitle}
      </div>
      <input ref={ref} type="file" accept={accept} style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onChange(f); }} />
    </div>
  );
}

// ─── Photo thumbnails ───────────────────────────────────────────────────────

function PhotoStrip({
  previews, onRemove, onAdd, uploading,
}: {
  previews: string[];
  onRemove: (i: number) => void;
  onAdd: (file: File) => void;
  uploading: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginTop: '8px' }}>
      {previews.map((src, i) => (
        <div key={i} style={{ position: 'relative' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: '8px', border: `1px solid rgba(232,184,75,0.3)` }} />
          <button onClick={() => onRemove(i)} style={{ position: 'absolute', top: -6, right: -6, background: '#C0392B', border: 'none', borderRadius: '50%', width: 18, height: 18, color: white, fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>×</button>
          {i === 0 && <div style={{ position: 'absolute', bottom: 3, left: 3, fontSize: '8px', background: 'rgba(0,0,0,0.55)', color: white, borderRadius: '3px', padding: '1px 4px', fontFamily: 'var(--font-inter), sans-serif', letterSpacing: '0.05em' }}>COVER</div>}
        </div>
      ))}
      {previews.length < 5 && (
        <button onClick={() => ref.current?.click()} disabled={uploading} style={{ width: 70, height: 70, borderRadius: '8px', border: `1.5px dashed rgba(232,184,75,0.5)`, background: goldPale, cursor: 'pointer', fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: gold }}>
          {uploading ? '…' : '+'}
          <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onAdd(f); }} />
        </button>
      )}
    </div>
  );
}

// ─── Shared price/currency input ────────────────────────────────────────────

function PriceInput({ value, onChange, placeholder = '0' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--font-inter), sans-serif', fontSize: '13px', color: warmGray }}>$</span>
      <input style={{ ...iBase, paddingLeft: '26px' }} type="number" min="0" step="0.01" placeholder={placeholder} value={value}
        onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

// ─── Card wrapper for each item ─────────────────────────────────────────────

function ItemCard({ children, onRemove, canRemove }: { children: React.ReactNode; onRemove: () => void; canRemove?: boolean }) {
  return (
    <div style={{ border: '1px solid rgba(232,184,75,0.2)', borderRadius: '12px', padding: '20px', background: white, marginBottom: '12px', position: 'relative' }}>
      {canRemove && (
        <button onClick={onRemove} style={{ ...removeBtn, position: 'absolute', top: '14px', right: '14px', fontSize: '14px' }} title="Remove">
          ✕
        </button>
      )}
      {children}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export function Step6Products() {
  const { step6, setStep6, isLoading, setLoading, setError, error, nextStep, prevStep } = useOnboardingStore();

  const [digitalUploading, setDigitalUploading] = useState<Record<string, boolean>>({});
  const [photoUploading, setPhotoUploading]   = useState<Record<string, boolean>>({});

  // Defensive fallbacks — guard against stale persisted state missing arrays
  const digitalProducts = step6.digitalProducts ?? [];
  const physicalProducts = step6.physicalProducts ?? [];
  const events = step6.events ?? [];

  // ── Digital products ────────────────────────────────────────────────────

  const addDigital = () => setStep6({
    digitalProducts: [...digitalProducts, { localId: uid(), name: '', price: '', fileS3Key: '', fileName: '' }],
  });

  const updateDigital = (id: string, patch: Partial<typeof digitalProducts[0]>) =>
    setStep6({ digitalProducts: digitalProducts.map((p) => p.localId === id ? { ...p, ...patch } : p) });

  const removeDigital = (id: string) =>
    setStep6({ digitalProducts: digitalProducts.filter((p) => p.localId !== id) });

  const handleDigitalFile = async (id: string, file: File) => {
    setDigitalUploading((s) => ({ ...s, [id]: true }));
    try {
      const { key } = await uploadToS3(file, 'products');
      updateDigital(id, { fileS3Key: key, fileName: file.name });
    } catch {
      setError('File upload failed. Please try again.');
    } finally {
      setDigitalUploading((s) => ({ ...s, [id]: false }));
    }
  };

  // ── Physical products ───────────────────────────────────────────────────

  const addPhysical = () => setStep6({
    physicalProducts: [...physicalProducts, { localId: uid(), name: '', price: '', description: '', imageS3Keys: [], imagePreviews: [] }],
  });

  const updatePhysical = (id: string, patch: Partial<typeof physicalProducts[0]>) =>
    setStep6({ physicalProducts: physicalProducts.map((p) => p.localId === id ? { ...p, ...patch } : p) });

  const removePhysical = (id: string) =>
    setStep6({ physicalProducts: physicalProducts.filter((p) => p.localId !== id) });

  const handlePhotoAdd = async (id: string, file: File, product: PhysicalProduct) => {
    if (product.imageS3Keys.length >= 5) return;
    setPhotoUploading((s) => ({ ...s, [id]: true }));
    try {
      const preview = URL.createObjectURL(file);
      const { key } = await uploadToS3(file, 'products');
      updatePhysical(id, {
        imageS3Keys: [...product.imageS3Keys, key],
        imagePreviews: [...product.imagePreviews, preview],
      });
    } catch {
      setError('Photo upload failed. Please try again.');
    } finally {
      setPhotoUploading((s) => ({ ...s, [id]: false }));
    }
  };

  const handlePhotoRemove = (id: string, idx: number, product: PhysicalProduct) => {
    updatePhysical(id, {
      imageS3Keys: product.imageS3Keys.filter((_, i) => i !== idx),
      imagePreviews: product.imagePreviews.filter((_, i) => i !== idx),
    });
  };

  // ── Events ─────────────────────────────────────────────────────────────

  const addEvent = () => setStep6({
    events: [...events, { localId: uid(), name: '', type: 'VIRTUAL', startDateTime: '', ticketPrice: '', ticketCapacity: '', location: '', description: '' }],
  });

  const updateEvent = (id: string, patch: Partial<typeof events[0]>) =>
    setStep6({ events: events.map((e) => e.localId === id ? { ...e, ...patch } : e) });

  const removeEvent = (id: string) =>
    setStep6({ events: events.filter((e) => e.localId !== id) });

  // ── Submit ──────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      // Save digital products
      for (const dp of digitalProducts) {
        if (!dp.name.trim()) continue;
        const { data } = await api.post('/products', {
          type: 'DIGITAL',
          name: dp.name,
          price: parseFloat(dp.price) || 0,
          fileS3Key: dp.fileS3Key || undefined,
        });
        updateDigital(dp.localId, { persistedId: data.id });
      }

      // Save physical products
      for (const pp of physicalProducts) {
        if (!pp.name.trim()) continue;
        const { data } = await api.post('/products', {
          type: 'PHYSICAL',
          name: pp.name,
          price: parseFloat(pp.price) || 0,
          description: pp.description || undefined,
          imageUrls: pp.imageS3Keys,
        });
        updatePhysical(pp.localId, { persistedId: data.id });
      }

      // Save events
      for (const ev of events) {
        if (!ev.name.trim() || !ev.startDateTime) continue;
        const { data } = await api.post('/events', {
          title: ev.name,
          type: ev.type,
          startTime: new Date(ev.startDateTime).toISOString(),
          ticketPrice: parseFloat(ev.ticketPrice) || 0,
          ticketCapacity: parseInt(ev.ticketCapacity) || undefined,
          location: ev.location || undefined,
          description: ev.description || undefined,
        });
        updateEvent(ev.localId, { persistedId: data.id });
      }

      setStep6({ skipped: false });
      nextStep();
    } catch (err: any) {
      const msg = err.response?.data?.message ?? 'Failed to save. Please try again.';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    setStep6({ skipped: true });
    nextStep();
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '36px' }}>
        <div style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: gold, marginBottom: '10px', fontFamily: 'var(--font-inter), sans-serif' }}>Step 6 of 6</div>
        <h1 className="font-cormorant" style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 300, lineHeight: 1.1, color: charcoal, marginBottom: '10px' }}>
          Products &amp; <em style={{ fontStyle: 'italic', color: gold }}>events</em>
        </h1>
        <p style={{ fontSize: '14px', color: warmGray, lineHeight: 1.7, maxWidth: '560px', fontFamily: 'var(--font-inter), sans-serif', margin: 0 }}>
          Expand your income beyond 1:1 sessions. Sell digital downloads, handmade products, and host events — all from your Spiritual California profile.
        </p>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: '#DC2626', fontFamily: 'var(--font-inter), sans-serif', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {/* ═══ DIGITAL PRODUCTS ═════════════════════════════════════════════ */}
      <div style={sectionLabel}>
        <span style={dividerLine} />
        Digital Products
        <span style={dividerLine} />
      </div>

      {digitalProducts.map((dp) => (
        <ItemCard key={dp.localId} onRemove={() => removeDigital(dp.localId)} canRemove>
          <UploadZone
            icon="💾"
            title="Upload Digital Product"
            subtitle="PDFs, audio files, video courses, guided meditations, e-books · Customers receive an instant download link after purchase"
            accept=".pdf,.mp3,.mp4,.m4a,.epub,.zip"
            onChange={(f) => handleDigitalFile(dp.localId, f)}
            uploading={digitalUploading[dp.localId]}
            uploaded={dp.fileName || undefined}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '14px' }}>
            <div>
              <label style={lbl}>Product Name</label>
              <input style={iBase} type="text" placeholder="e.g. 30-Day Awareness Training"
                value={dp.name} onChange={(e) => updateDigital(dp.localId, { name: e.target.value })} />
            </div>
            <div>
              <label style={lbl}>Price</label>
              <PriceInput value={dp.price} onChange={(v) => updateDigital(dp.localId, { price: v })} placeholder="29" />
            </div>
          </div>
        </ItemCard>
      ))}

      <button style={addBtn} onClick={addDigital}>
        <span style={{ fontSize: '16px' }}>+</span> Add a digital product
      </button>

      {/* ═══ PHYSICAL PRODUCTS ════════════════════════════════════════════ */}
      <div style={sectionLabel}>
        <span style={dividerLine} />
        Physical Products
        <span style={dividerLine} />
      </div>

      {physicalProducts.map((pp) => (
        <ItemCard key={pp.localId} onRemove={() => removePhysical(pp.localId)} canRemove>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '14px', marginBottom: '14px' }}>
            <div>
              <label style={lbl}>Product Name</label>
              <input style={iBase} type="text" placeholder="e.g. Ayurvedic Herbal Tea Blend"
                value={pp.name} onChange={(e) => updatePhysical(pp.localId, { name: e.target.value })} />
            </div>
            <div>
              <label style={lbl}>Price</label>
              <PriceInput value={pp.price} onChange={(v) => updatePhysical(pp.localId, { price: v })} placeholder="38" />
            </div>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={lbl}>Product Description</label>
            <textarea style={{ ...iBase, resize: 'vertical', minHeight: '80px' } as React.CSSProperties}
              placeholder="Describe what makes this product special — ingredients, intention, how it's made…"
              value={pp.description} onChange={(e) => updatePhysical(pp.localId, { description: e.target.value })} />
          </div>
          <div>
            <label style={lbl}>Product Photos <span style={{ textTransform: 'none', letterSpacing: 0, fontSize: '11px', fontWeight: 400 }}>— JPG or PNG · Up to 5 photos · First image is the cover</span></label>
            <PhotoStrip
              previews={pp.imagePreviews}
              onRemove={(i) => handlePhotoRemove(pp.localId, i, pp)}
              onAdd={(f) => handlePhotoAdd(pp.localId, f, pp)}
              uploading={photoUploading[pp.localId] ?? false}
            />
          </div>
        </ItemCard>
      ))}

      <button style={addBtn} onClick={addPhysical}>
        <span style={{ fontSize: '16px' }}>+</span> Add a physical product
      </button>

      {/* ═══ EVENTS ═══════════════════════════════════════════════════════ */}
      <div style={sectionLabel}>
        <span style={dividerLine} />
        Create a Public Event
        <span style={dividerLine} />
      </div>

      {events.map((ev) => (
        <ItemCard key={ev.localId} onRemove={() => removeEvent(ev.localId)} canRemove>
          {/* Row 1: name + type */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: '14px', marginBottom: '14px' }}>
            <div>
              <label style={lbl}>Event Name</label>
              <input style={iBase} type="text" placeholder="e.g. New Moon Meditation Circle"
                value={ev.name} onChange={(e) => updateEvent(ev.localId, { name: e.target.value })} />
            </div>
            <div>
              <label style={lbl}>Event Type</label>
              <select style={iBase} value={ev.type} onChange={(e) => updateEvent(ev.localId, { type: e.target.value as 'VIRTUAL' | 'IN_PERSON' })}>
                <option value="VIRTUAL">Virtual Event</option>
                <option value="IN_PERSON">In-Person</option>
              </select>
            </div>
          </div>

          {/* Row 2: date/time + ticket price */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: '14px', marginBottom: '14px' }}>
            <div>
              <label style={lbl}>Date &amp; Time</label>
              <input style={iBase} type="datetime-local"
                value={ev.startDateTime} onChange={(e) => updateEvent(ev.localId, { startDateTime: e.target.value })} />
            </div>
            <div>
              <label style={lbl}>Ticket Price (per person)</label>
              <PriceInput value={ev.ticketPrice} onChange={(v) => updateEvent(ev.localId, { ticketPrice: v })} placeholder="45" />
            </div>
          </div>

          {/* Location (in-person only) */}
          {ev.type === 'IN_PERSON' && (
            <div style={{ marginBottom: '14px' }}>
              <label style={lbl}>Location <span style={{ textTransform: 'none', letterSpacing: 0, fontSize: '11px', fontWeight: 400 }}>(for in-person events)</span></label>
              <input style={iBase} type="text" placeholder="Full address or venue name, city, state"
                value={ev.location} onChange={(e) => updateEvent(ev.localId, { location: e.target.value })} />
            </div>
          )}

          {/* Event description */}
          <div>
            <label style={lbl}>Event Description</label>
            <textarea style={{ ...iBase, resize: 'vertical', minHeight: '90px' } as React.CSSProperties}
              placeholder="What will participants experience? What should they bring? What is the intention of this gathering?"
              value={ev.description} onChange={(e) => updateEvent(ev.localId, { description: e.target.value })} />
          </div>
        </ItemCard>
      ))}

      <button style={addBtn} onClick={addEvent}>
        <span style={{ fontSize: '16px' }}>+</span> Add an event
      </button>

      {/* ═══ FOOTER ═══════════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '48px', paddingTop: '28px', borderTop: '1px solid rgba(232,184,75,0.15)' }}>
        <button type="button" onClick={prevStep} style={{ fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', color: warmGray, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-inter), sans-serif' }}>
          ← Back
        </button>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button type="button" onClick={handleSkip} style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: warmGray, background: 'none', border: '1px solid rgba(138,130,120,0.3)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'var(--font-inter), sans-serif', padding: '12px 20px' }}>
            Skip for now
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading}
            style={{ padding: '14px 32px', borderRadius: '8px', background: isLoading ? '#C4BDB5' : charcoal, color: white, fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-inter), sans-serif', transition: 'background 0.3s' }}
          >
            {isLoading ? 'Saving…' : 'Publish My Profile →'}
          </button>
        </div>
      </div>
    </div>
  );
}
