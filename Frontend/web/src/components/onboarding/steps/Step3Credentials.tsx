'use client';

import { useRef, ChangeEvent } from 'react';
import { useOnboardingStore } from '@/store/onboarding.store';
import { api } from '@/lib/api';
import type { CredentialEntry } from '@/types/onboarding';

const CURRENT_YEAR = new Date().getFullYear();

const iBase: React.CSSProperties = {
  border: '1px solid rgba(138,130,120,0.25)',
  borderRadius: '8px',
  padding: '12px 16px',
  fontFamily: 'var(--font-inter), sans-serif',
  fontSize: '14px',
  color: '#3A3530',
  background: '#FFFFFF',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box' as const,
};

const lbl: React.CSSProperties = {
  fontSize: '11px', letterSpacing: '0.12em',
  textTransform: 'uppercase' as const, color: '#8A8278',
  fontWeight: 500, fontFamily: 'var(--font-inter), sans-serif',
  display: 'block', marginBottom: '6px',
};

function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '32px 0 24px' }}>
      <div style={{ flex: 1, height: '1px', background: 'rgba(232,184,75,0.2)' }} />
      <div style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#8A8278', whiteSpace: 'nowrap', fontFamily: 'var(--font-inter), sans-serif' }}>{label}</div>
      <div style={{ flex: 1, height: '1px', background: 'rgba(232,184,75,0.2)' }} />
    </div>
  );
}

export function Step3Credentials() {
  const { step3, setStep3, setLoading, isLoading, setError, error, nextStep, prevStep } = useOnboardingStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeLocalId = useRef<string | null>(null);
  const credentials = step3.credentials;

  const addBlankCredential = () => {
    setStep3({ credentials: [...credentials, { localId: crypto.randomUUID(), title: '', institution: '', issuedYear: '', documentS3Key: '', documentFileName: '', persisted: false }] });
  };

  const updateCredential = (localId: string, patch: Partial<CredentialEntry>) => {
    setStep3({ credentials: credentials.map((c) => (c.localId === localId ? { ...c, ...patch } : c)) });
  };

  const removeCredential = async (entry: CredentialEntry) => {
    if (entry.persisted && entry.persistedId) {
      try { await api.delete(`/guides/onboarding/credentials/${entry.persistedId}`); } catch {}
    }
    setStep3({ credentials: credentials.filter((c) => c.localId !== entry.localId) });
  };

  const triggerDocumentUpload = (localId: string) => {
    activeLocalId.current = localId;
    fileInputRef.current?.click();
  };

  const handleDocumentChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const localId = activeLocalId.current;
    if (!file || !localId) return;
    e.target.value = '';
    updateCredential(localId, { documentFileName: file.name + ' (uploading…)' });
    try {
      const { data } = await api.get('/upload/presigned-url', {
        params: { folder: 'credentials', fileName: file.name, contentType: file.type },
      });
      await fetch(data.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      updateCredential(localId, { documentS3Key: data.key, documentFileName: file.name });
    } catch {
      updateCredential(localId, { documentFileName: '', documentS3Key: '' });
      setError('Document upload failed. Please try again.');
    }
  };

  const persistCredential = async (entry: CredentialEntry): Promise<boolean> => {
    if (!entry.title.trim()) return false;
    try {
      const payload: Record<string, unknown> = { title: entry.title };
      if (entry.institution) payload.institution = entry.institution;
      if (entry.issuedYear) payload.issuedYear = parseInt(entry.issuedYear, 10);
      if (entry.documentS3Key) payload.documentS3Key = entry.documentS3Key;
      const { data } = await api.post('/guides/onboarding/credentials', payload);
      updateCredential(entry.localId, { persisted: true, persistedId: data.id });
      return true;
    } catch { return false; }
  };

  const handleContinue = async () => {
    const unpersisted = credentials.filter((c) => !c.persisted && c.title.trim());
    setLoading(true); setError(null);
    let anyFailed = false;
    for (const entry of unpersisted) {
      if (!(await persistCredential(entry))) anyFailed = true;
    }
    setLoading(false);
    if (anyFailed) { setError('Some credentials could not be saved. Check the fields and try again.'); return; }
    nextStep();
  };

  return (
    <div>
      <div style={{ marginBottom: '44px' }}>
        <div style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#E8B84B', marginBottom: '10px', fontFamily: 'var(--font-inter), sans-serif' }}>Step 3 of 6</div>
        <h1 className="font-cormorant" style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 300, lineHeight: 1.1, color: '#3A3530', marginBottom: '10px' }}>
          Your <em style={{ fontStyle: 'italic', color: '#E8B84B' }}>credentials</em>
        </h1>
        <p style={{ fontSize: '14px', color: '#8A8278', lineHeight: 1.7, maxWidth: '560px', fontFamily: 'var(--font-inter), sans-serif', margin: 0 }}>
          Upload your certificates, diplomas, or letters from your teachers. Our AI will verify that the name matches and the institution is recognized.
        </p>
      </div>

      {/* Trust box */}
      <div style={{ borderLeft: '3px solid #E8B84B', padding: '16px 20px', background: '#FDF6E3', borderRadius: '0 10px 10px 0', marginBottom: '28px' }}>
        <div style={{ fontSize: '12px', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#E8B84B', marginBottom: '6px', fontFamily: 'var(--font-inter), sans-serif' }}>✦ Why this matters</div>
        <p style={{ fontSize: '13px', color: '#8A8278', lineHeight: 1.6, fontFamily: 'var(--font-inter), sans-serif', margin: 0 }}>Verified credentials earn you a <strong>✦ Verified Modality</strong> badge on each practice you have proven training in. Seekers trust verified practitioners 3× more and are significantly more likely to book. You can skip this step and complete it later from your dashboard.</p>
      </div>

      {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: '#DC2626', fontFamily: 'var(--font-inter), sans-serif', marginBottom: '20px' }}>{error}</div>}

      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,application/pdf" onChange={handleDocumentChange} style={{ display: 'none' }} />

      {/* Upload zone */}
      <div
        onClick={() => { addBlankCredential(); setTimeout(() => triggerDocumentUpload(credentials[credentials.length] ? credentials[credentials.length - 1]?.localId ?? '' : ''), 100); }}
        style={{ border: '2px dashed rgba(232,184,75,0.4)', borderRadius: '12px', padding: '36px 24px', textAlign: 'center', background: '#FDF6E3', cursor: 'pointer', transition: 'all 0.3s', marginBottom: '16px' }}
      >
        <div style={{ fontSize: '36px', marginBottom: '10px' }}>📜</div>
        <div className="font-cormorant" style={{ fontSize: '20px', fontWeight: 400, color: '#3A3530', marginBottom: '6px' }}>Upload Certificates & Diplomas</div>
        <div style={{ fontSize: '13px', color: '#8A8278', lineHeight: 1.6, fontFamily: 'var(--font-inter), sans-serif' }}>PDF, JPG, or PNG · Up to 10 files · Max 10MB each<br />Accepted: Certificates, diplomas, official letters from teachers</div>
      </div>

      {/* Credential entries */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
        {credentials.map((entry) => (
          <div key={entry.localId} style={{ border: entry.persisted ? '1.5px solid #86EFAC' : '1.5px solid #EDE8E1', borderRadius: '12px', padding: '20px', background: entry.persisted ? '#F0FDF4' : '#FFFFFF', position: 'relative' }}>
            <button onClick={() => removeCredential(entry)} style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#B5AFA8', lineHeight: 1 }}>×</button>
            {entry.persisted && <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#22C55E', color: '#FFFFFF', fontSize: '10px', fontFamily: 'var(--font-inter), sans-serif', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', borderRadius: '50px', padding: '3px 10px', marginBottom: '12px' }}>✓ Saved</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div><label style={lbl}>Credential Title</label><input style={iBase} type="text" placeholder="e.g. 500hr Yoga Teacher Training" value={entry.title} onChange={(e) => updateCredential(entry.localId, { title: e.target.value })} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div><label style={lbl}>Issuing Institution</label><input style={iBase} type="text" placeholder="e.g. Yoga Alliance" value={entry.institution} onChange={(e) => updateCredential(entry.localId, { institution: e.target.value })} /></div>
                <div><label style={lbl}>Year Issued</label><input style={iBase} type="number" placeholder={String(CURRENT_YEAR)} value={entry.issuedYear} onChange={(e) => updateCredential(entry.localId, { issuedYear: e.target.value })} /></div>
              </div>
              <div>
                <label style={lbl}>Certificate Document</label>
                <button type="button" onClick={() => triggerDocumentUpload(entry.localId)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', width: '100%', border: '1.5px dashed #D5CFC8', borderRadius: '10px', background: entry.documentS3Key ? '#F0FDF4' : '#FAFAF7', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ fontSize: '20px' }}>{entry.documentS3Key ? '📄' : '⬆️'}</span>
                  <span style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: '13px', color: '#3A3530' }}>{entry.documentFileName || 'Upload certificate (PDF or image)'}</span>
                </button>
              </div>
              {!entry.persisted && entry.title.trim() && (
                <button type="button" onClick={() => persistCredential(entry)} style={{ padding: '8px 16px', background: 'none', border: '1.5px solid #E8B84B', borderRadius: '8px', color: '#E8B84B', fontFamily: 'var(--font-inter), sans-serif', fontSize: '12px', fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' }}>Save credential</button>
              )}
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={addBlankCredential} style={{ width: '100%', padding: '14px', border: '1.5px dashed #E8B84B', borderRadius: '12px', background: 'transparent', color: '#E8B84B', fontFamily: 'var(--font-inter), sans-serif', fontSize: '13px', fontWeight: 600, cursor: 'pointer', marginBottom: '32px', transition: 'background 0.2s' }}>+ Add credential</button>

      <SectionDivider label="Teacher Attestation" />
      <p style={{ fontSize: '13px', color: '#8A8278', marginBottom: '20px', lineHeight: 1.6, fontFamily: 'var(--font-inter), sans-serif' }}>For traditional lineage-based practices (Tibetan medicine, Shamanism, etc.), you may provide your teacher's contact for attestation instead of a formal certificate.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        <div><label style={lbl}>Teacher / Lineage Holder Name</label><input style={iBase} type="text" placeholder="e.g. Lama Tenzin Dorje" value={step3.teacherName} onChange={(e) => setStep3({ teacherName: e.target.value })} /></div>
        <div><label style={lbl}>Teacher's Email or Website</label><input style={iBase} type="text" placeholder="teacher@example.com" value={step3.teacherContact} onChange={(e) => setStep3({ teacherContact: e.target.value })} /></div>
      </div>
      <div style={{ marginBottom: '20px' }}>
        <label style={lbl}>Allowance to Teach or Guide Others <span style={{ textTransform: 'none', letterSpacing: 0, fontSize: '11px', fontWeight: 400 }}>— does your teacher authorize you to teach?</span></label>
        <select style={iBase} value={step3.authorization} onChange={(e) => setStep3({ authorization: e.target.value })}>
          <option value="">Select…</option>
          <option value="formal">Yes — I have formal authorization to teach</option>
          <option value="oral">Yes — my teacher has given me oral permission</option>
          <option value="training">I am still in training / apprenticeship</option>
          <option value="none">This practice does not require formal authorization</option>
        </select>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '40px', paddingTop: '28px', borderTop: '1px solid rgba(232,184,75,0.15)' }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <button type="button" onClick={prevStep} style={{ fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A8278', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-inter), sans-serif' }}>← Back</button>
          <button type="button" onClick={() => nextStep()} style={{ fontSize: '12px', color: '#8A8278', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'var(--font-inter), sans-serif' }}>Skip for now</button>
        </div>
        <button type="button" onClick={handleContinue} disabled={isLoading} style={{ padding: '14px 36px', borderRadius: '8px', background: isLoading ? '#C4BDB5' : '#3A3530', color: '#FFFFFF', fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-inter), sans-serif', transition: 'background 0.3s' }}>
          {isLoading ? 'Saving…' : 'Continue → Verify Identity'}
        </button>
      </div>
    </div>
  );
}
