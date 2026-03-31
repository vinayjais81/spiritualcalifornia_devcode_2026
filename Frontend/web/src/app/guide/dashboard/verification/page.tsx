'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { C, font, PageHeader, Panel, Btn, FormGroup, Input, Modal } from '@/components/guide/dashboard-ui';

interface Credential {
  id: string;
  title: string;
  institution: string | null;
  issuedYear: number | null;
  documentUrl: string | null;
  verificationStatus: string;
  verifiedAt: string | null;
}

interface IdentityVerification {
  status: string;
  completedAt: string | null;
}

export default function VerificationPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [emailVerified, setEmailVerified] = useState(false);
  const [identity, setIdentity] = useState<IdentityVerification | null>(null);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [verificationStatus, setVerificationStatus] = useState('PENDING');

  // Add credential modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [credForm, setCredForm] = useState({ title: '', institution: '', issuedYear: '' });
  const [certFile, setCertFile] = useState<File | null>(null);

  // Identity verification loading
  const [startingIdentity, setStartingIdentity] = useState(false);

  useEffect(() => {
    api.get('/guides/me')
      .then((res) => {
        const p = res.data;
        setEmailVerified(user?.isEmailVerified ?? false);
        setCredentials(p.credentials || []);
        setVerificationStatus(p.verificationStatus || 'PENDING');
        setIdentity(p.identityVerification || null);
      })
      .catch(() => toast.error('Failed to load verification data'))
      .finally(() => setLoading(false));
  }, [user]);

  // Start Persona identity verification
  const startIdentityVerification = async () => {
    setStartingIdentity(true);
    try {
      const res = await api.post('/verification/identity/start');
      setIdentity({ status: res.data.status || 'pending', completedAt: null });
      toast.success('Identity verification initiated');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to start identity verification');
    } finally {
      setStartingIdentity(false);
    }
  };

  // Add new credential
  const addCredential = async () => {
    try {
      await api.post('/guides/onboarding/credentials', {
        title: credForm.title,
        institution: credForm.institution || undefined,
        issuedYear: credForm.issuedYear ? parseInt(credForm.issuedYear) : undefined,
        // documentS3Key would be set after S3 upload
      });
      toast.success('Certification added');
      setShowAddModal(false);
      setCredForm({ title: '', institution: '', issuedYear: '' });
      setCertFile(null);
      // Reload credentials
      const res = await api.get('/guides/me');
      setCredentials(res.data.credentials || []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add certification');
    }
  };

  // Delete credential
  const deleteCredential = async (id: string) => {
    try {
      await api.delete(`/guides/onboarding/credentials/${id}`);
      setCredentials(c => c.filter(x => x.id !== id));
      toast.success('Certification removed');
    } catch {
      toast.error('Failed to remove');
    }
  };

  const identityDone = identity?.status === 'completed' || identity?.status === 'approved' || identity?.status === 'stub_completed';
  const identityPending = identity && !identityDone;

  if (loading) {
    return <div style={{ fontFamily: font, fontSize: '13px', color: C.warmGray, padding: '40px' }}>Loading...</div>;
  }

  return (
    <div>
      <PageHeader title="Verification" subtitle="Verified practitioners receive a badge on their profile and rank higher in search results." />

      <Panel title="Identity & Credentials" icon="🛡️">

        {/* ── Step 1: Email Verified ─────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', padding: '16px 0', borderBottom: '1px solid rgba(232,184,75,0.1)' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0, background: emailVerified ? '#E8F5E9' : C.goldPale }}>
            {emailVerified ? '✅' : '⏳'}
          </div>
          <div>
            <div style={{ fontFamily: font, fontSize: '14px', fontWeight: 500, color: C.charcoal, marginBottom: '3px' }}>Email Verified</div>
            <div style={{ fontFamily: font, fontSize: '12px', color: C.warmGray, lineHeight: 1.5 }}>
              {user?.email} — {emailVerified ? 'verified' : 'pending verification'}
            </div>
          </div>
        </div>

        {/* ── Step 2: Government ID (Persona) ────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', padding: '16px 0', borderBottom: '1px solid rgba(232,184,75,0.1)' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0, background: identityDone ? '#E8F5E9' : identityPending ? C.goldPale : '#FFF3E0' }}>
            {identityDone ? '✅' : identityPending ? '⏳' : '🪪'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: font, fontSize: '14px', fontWeight: 500, color: C.charcoal, marginBottom: '3px' }}>
              Government ID {identityDone ? '' : identityPending ? '— Pending Verification' : '— Required'}
            </div>
            <div style={{ fontFamily: font, fontSize: '12px', color: C.warmGray, lineHeight: 1.5, marginBottom: identityDone ? 0 : '12px' }}>
              {identityDone
                ? 'Identity verified. Your ID is stored securely and is not displayed publicly.'
                : identityPending
                  ? 'Your identity verification is being processed. This usually takes a few minutes.'
                  : 'Verify your identity with a government-issued photo ID. This is required for the Verified badge.'}
            </div>
            {!identityDone && !identityPending && (
              <Btn size="sm" onClick={startIdentityVerification} style={startingIdentity ? { opacity: 0.6, pointerEvents: 'none' as const } : {}}>
                {startingIdentity ? 'Starting...' : '🪪 Verify My Identity'}
              </Btn>
            )}
          </div>
        </div>

        {/* ── Step 3: Professional Certification — Upload ─────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', padding: '16px 0', borderBottom: '1px solid rgba(232,184,75,0.1)' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0, background: credentials.some(c => c.verificationStatus === 'PENDING') ? C.goldPale : credentials.length > 0 ? '#E8F5E9' : '#FFF3E0' }}>
            {credentials.some(c => c.verificationStatus === 'APPROVED') ? '✅' : credentials.length > 0 ? '⏳' : '📋'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: font, fontSize: '14px', fontWeight: 500, color: C.charcoal, marginBottom: '3px' }}>
              Professional Certification {credentials.some(c => c.verificationStatus === 'PENDING') ? '— Pending Review' : ''}
            </div>
            <div style={{ fontFamily: font, fontSize: '12px', color: C.warmGray, lineHeight: 1.5, marginBottom: '12px' }}>
              Upload your certification documents. Our team reviews submissions within 3–5 business days.
            </div>
            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', fontFamily: font, fontSize: '12px', fontWeight: 500,
              background: C.goldPale, border: '1.5px solid rgba(232,184,75,0.5)',
              borderRadius: '6px', cursor: 'pointer', color: C.charcoal,
              letterSpacing: '0.08em', textTransform: 'uppercase' as const,
            }}>
              📎 Upload Certificate (PDF or JPG)
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setCertFile(file);
                  setShowAddModal(true);
                  toast.info(`Selected: ${file.name}`);
                }
              }} />
            </label>
          </div>
        </div>

        {/* ── Step 4: Additional Certifications List ──────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', padding: '16px 0' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0, background: '#FFF3E0' }}>
            📋
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: font, fontSize: '14px', fontWeight: 500, color: C.charcoal, marginBottom: '3px' }}>
              Additional Certifications
            </div>
            <div style={{ fontFamily: font, fontSize: '12px', color: C.warmGray, lineHeight: 1.5, marginBottom: '12px' }}>
              You can upload multiple certifications. Each will be displayed on your public profile with the issuing organization and date.
            </div>

            {/* Existing credentials list */}
            {credentials.length > 0 && (
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                {credentials.map((cred) => (
                  <div key={cred.id} style={{
                    padding: '10px 16px', background: C.goldPale,
                    border: '1px solid rgba(232,184,75,0.4)', borderRadius: '8px',
                    fontFamily: font, fontSize: '12px', color: C.charcoal,
                    display: 'flex', alignItems: 'center', gap: '8px',
                  }}>
                    <span>🎓</span>
                    <span>{cred.title}{cred.institution ? ` — ${cred.institution}` : ''}{cred.issuedYear ? `, ${cred.issuedYear}` : ''}</span>
                    {cred.verificationStatus === 'APPROVED' && (
                      <span style={{ color: C.green, fontSize: '11px' }}>✓</span>
                    )}
                    {cred.verificationStatus === 'PENDING' && (
                      <span style={{ color: C.warmGray, fontSize: '11px' }}>⏳</span>
                    )}
                    <span
                      onClick={() => deleteCredential(cred.id)}
                      style={{ cursor: 'pointer', color: C.warmGray, fontSize: '14px', marginLeft: '4px' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#C0392B')}
                      onMouseLeave={e => (e.currentTarget.style.color = C.warmGray)}
                    >
                      ×
                    </span>
                  </div>
                ))}
              </div>
            )}

            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', fontFamily: font, fontSize: '12px', fontWeight: 500,
              background: C.goldPale, border: '1.5px solid rgba(232,184,75,0.5)',
              borderRadius: '6px', cursor: 'pointer', color: C.charcoal,
              letterSpacing: '0.08em', textTransform: 'uppercase' as const,
            }}>
              📎 Add Another Certification
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setCertFile(file);
                  setShowAddModal(true);
                  toast.info(`Selected: ${file.name}`);
                }
              }} />
            </label>
          </div>
        </div>
      </Panel>

      {/* ── Add Credential Modal ─────────────────────────────────── */}
      <Modal open={showAddModal} onClose={() => { setShowAddModal(false); setCertFile(null); }} title="Add Certification">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {certFile && (
            <div style={{
              padding: '10px 14px', background: C.offWhite, borderRadius: '8px',
              fontFamily: font, fontSize: '12px', color: C.charcoal,
              display: 'flex', alignItems: 'center', gap: '8px',
              border: '1px solid rgba(232,184,75,0.3)',
            }}>
              📄 <strong>{certFile.name}</strong> ({(certFile.size / 1024).toFixed(0)} KB)
            </div>
          )}
          <FormGroup label="Certification Title">
            <Input
              value={credForm.title}
              onChange={e => setCredForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Reiki Master Certification"
            />
          </FormGroup>
          <FormGroup label="Issuing Organization">
            <Input
              value={credForm.institution}
              onChange={e => setCredForm(f => ({ ...f, institution: e.target.value }))}
              placeholder="e.g. International Association of Reiki Professionals"
            />
          </FormGroup>
          <FormGroup label="Year Issued">
            <Input
              type="number"
              value={credForm.issuedYear}
              onChange={e => setCredForm(f => ({ ...f, issuedYear: e.target.value }))}
              placeholder="2021"
              min="1950"
              max={new Date().getFullYear().toString()}
            />
          </FormGroup>
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
          <Btn variant="secondary" onClick={() => { setShowAddModal(false); setCertFile(null); }}>Cancel</Btn>
          <Btn onClick={addCredential}>Add Certification</Btn>
        </div>
      </Modal>
    </div>
  );
}
