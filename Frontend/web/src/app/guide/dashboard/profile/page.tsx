'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { C, font, PageHeader, Panel, Btn, FormGroup, Input, TextArea, FormActions } from '@/components/guide/dashboard-ui';

export default function ProfilePage() {
  const [avatar, setAvatar] = useState('/images/hero1.jpg');
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    displayName: '',
    tagline: '',
    bio: '',
    websiteUrl: '',
    instagramUrl: '',
    languages: '',
    phone: '',
    yearsExperience: '',
  });
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  // Load existing profile data on mount
  useEffect(() => {
    api.get('/guides/me')
      .then((res) => {
        const p = res.data;
        setForm({
          displayName: p.displayName || '',
          tagline: p.tagline || '',
          bio: p.bio || '',
          websiteUrl: p.websiteUrl || '',
          instagramUrl: p.instagramUrl || '',
          languages: (p.languages || []).join(', '),
          phone: p.phone || '',
          yearsExperience: p.yearsExperience != null ? String(p.yearsExperience) : '',
        });
        if (p.avatarUrl) setAvatar(p.avatarUrl);
        if (p.modalities?.length) setTags(p.modalities);
      })
      .catch(() => { toast.error('Failed to load profile'); })
      .finally(() => setLoading(false));
  }, []);

  const saveProfile = async () => {
    try {
      const payload: Record<string, unknown> = {};

      if (form.displayName) payload.displayName = form.displayName;
      if (form.tagline) payload.tagline = form.tagline;
      if (form.bio) payload.bio = form.bio;
      if (form.websiteUrl) payload.websiteUrl = form.websiteUrl;
      if (form.instagramUrl) payload.instagramUrl = form.instagramUrl;
      if (form.phone) payload.phone = form.phone;
      if (form.yearsExperience) payload.yearsExperience = parseInt(form.yearsExperience);
      if (form.languages) {
        payload.languages = form.languages.split(',').map(l => l.trim()).filter(Boolean);
      }
      if (tags.length > 0) {
        payload.modalities = tags;
      }

      if (Object.keys(payload).length === 0) {
        toast.error('Please fill in at least one field');
        return;
      }

      await api.put('/guides/onboarding/profile', payload);
      toast.success('Profile saved successfully');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save profile');
    }
  };

  if (loading) {
    return <div style={{ fontFamily: font, fontSize: '13px', color: C.warmGray, padding: '40px' }}>Loading profile...</div>;
  }

  return (
    <div>
      <PageHeader title="Profile & Bio" subtitle="This information appears on your public practitioner profile." />

      <Panel title="Profile Photo" icon="📷">
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          {avatar && avatar.startsWith('data:') ? (
            // Local preview from file picker
            <img src={avatar} alt="Profile" width={100} height={100} style={{ borderRadius: '50%', objectFit: 'cover', border: `3px solid ${C.gold}`, width: '100px', height: '100px' }} />
          ) : avatar && avatar.startsWith('http') ? (
            // Remote URL
            <Image src={avatar} alt="Profile" width={100} height={100} style={{ borderRadius: '50%', objectFit: 'cover', border: `3px solid ${C.gold}` }} onError={() => setAvatar('')} />
          ) : (
            // Default placeholder
            <div style={{
              width: '100px', height: '100px', borderRadius: '50%',
              border: `3px solid ${C.gold}`, background: C.goldPale,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '36px', color: C.gold, flexShrink: 0,
            }}>
              👤
            </div>
          )}
          <div>
            <p style={{ fontFamily: font, fontSize: '12px', color: C.warmGray, lineHeight: 1.5, marginBottom: '8px' }}>Upload a clear, professional photo.<br />Recommended: square, at least 400×400px.</p>
            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '7px 14px', fontFamily: font, fontSize: '11px', fontWeight: 500,
              letterSpacing: '0.08em', textTransform: 'uppercase' as const,
              background: 'transparent', border: '1.5px solid rgba(232,184,75,0.5)',
              borderRadius: '6px', cursor: 'pointer', color: C.charcoal,
              transition: 'all 0.2s',
            }}>
              📁 Choose Photo
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 5 * 1024 * 1024) {
                    toast.error('Image must be under 5MB');
                    return;
                  }
                  // Optimistic local preview while the S3 upload completes.
                  const localUrl = URL.createObjectURL(file);
                  setAvatar(localUrl);
                  try {
                    const { data } = await api.get('/upload/presigned-url', {
                      params: { folder: 'avatars', fileName: file.name, contentType: file.type },
                    });
                    const putRes = await fetch(data.uploadUrl, {
                      method: 'PUT',
                      body: file,
                      headers: { 'Content-Type': file.type },
                    });
                    if (!putRes.ok) throw new Error(`S3 PUT failed (${putRes.status})`);
                    // Server resolves the S3 key → User.avatarUrl (CDN URL).
                    await api.put('/guides/onboarding/profile', { avatarS3Key: data.key });
                    setAvatar(data.fileUrl);
                    toast.success('Profile photo updated');
                  } catch (err: any) {
                    toast.error(err?.response?.data?.message || 'Avatar upload failed');
                    setAvatar('/images/hero1.jpg');
                  }
                }}
              />
            </label>
          </div>
        </div>
      </Panel>

      <Panel title="Basic Information" icon="📝">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <FormGroup label="Display Name">
            <Input value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} placeholder="Your display name" />
          </FormGroup>
          <FormGroup label="Phone">
            <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 (415) 000-0000" />
          </FormGroup>
          <FormGroup label="Tagline" full>
            <Input value={form.tagline} onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))} placeholder="Sound Healer · Reiki Master · Breathwork Guide" />
          </FormGroup>
          <FormGroup label="Bio" full>
            <TextArea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="Tell seekers about your practice, training, and approach..." rows={5} />
          </FormGroup>
        </div>

        {/* Specialties / Tags */}
        <div style={{ marginTop: '20px', marginBottom: '20px' }}>
          <label style={{ fontFamily: font, fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.warmGray, fontWeight: 500 }}>
            Specialties / Tags
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
            {tags.map((tag, i) => (
              <span key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '5px 12px', borderRadius: '20px',
                background: C.goldPale, border: '1px solid rgba(232,184,75,0.4)',
                fontFamily: font, fontSize: '12px', color: C.charcoal,
              }}>
                {tag}
                <span
                  onClick={() => setTags(t => t.filter((_, idx) => idx !== i))}
                  style={{ cursor: 'pointer', color: C.warmGray, fontSize: '14px', lineHeight: 1 }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#C0392B')}
                  onMouseLeave={e => (e.currentTarget.style.color = C.warmGray)}
                >
                  ×
                </span>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <Input
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              placeholder="Add a specialty..."
              style={{ maxWidth: '240px' }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const trimmed = newTag.trim();
                  if (trimmed && !tags.includes(trimmed)) {
                    setTags(t => [...t, trimmed]);
                    setNewTag('');
                  }
                }
              }}
            />
            <Btn variant="secondary" size="sm" onClick={() => {
              const trimmed = newTag.trim();
              if (trimmed && !tags.includes(trimmed)) {
                setTags(t => [...t, trimmed]);
                setNewTag('');
              }
            }}>Add</Btn>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <FormGroup label="Website">
            <Input value={form.websiteUrl} onChange={e => setForm(f => ({ ...f, websiteUrl: e.target.value }))} placeholder="https://yourwebsite.com" />
          </FormGroup>
          <FormGroup label="Instagram Handle">
            <Input value={form.instagramUrl} onChange={e => setForm(f => ({ ...f, instagramUrl: e.target.value }))} placeholder="@yourhandle" />
          </FormGroup>
          <FormGroup label="Years of Experience">
            <Input type="number" value={form.yearsExperience} onChange={e => setForm(f => ({ ...f, yearsExperience: e.target.value }))} placeholder="12" min="0" />
          </FormGroup>
          <FormGroup label="Languages">
            <Input value={form.languages} onChange={e => setForm(f => ({ ...f, languages: e.target.value }))} placeholder="English, Hebrew" />
          </FormGroup>
        </div>
      </Panel>

      <FormActions>
        <Btn onClick={saveProfile}>Save Changes</Btn>
      </FormActions>
    </div>
  );
}
