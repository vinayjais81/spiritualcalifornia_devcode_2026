'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { C, font, PageHeader, Panel, Btn, FormGroup, Input, TextArea, FormActions } from '@/components/guide/dashboard-ui';

export default function SeekerProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ bio: '', location: '', timezone: '', interests: '' });

  useEffect(() => {
    api.get('/seekers/me')
      .then(r => {
        setProfile(r.data);
        setForm({
          bio: r.data.bio || '',
          location: r.data.location || '',
          timezone: r.data.timezone || '',
          interests: (r.data.interests || []).join(', '),
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch('/seekers/me', {
        bio: form.bio.trim() || undefined,
        location: form.location.trim() || undefined,
        timezone: form.timezone.trim() || undefined,
        interests: form.interests ? form.interests.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      });
      toast.success('Profile updated');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ fontFamily: font, fontSize: '13px', color: C.warmGray, padding: '40px' }}>Loading...</div>;

  return (
    <div>
      <PageHeader title="My Profile" subtitle="Manage your account details and preferences." />

      <Panel title="Account" icon="👤">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {[
            { label: 'Name', value: `${profile?.user?.firstName || ''} ${profile?.user?.lastName || ''}`.trim() },
            { label: 'Email', value: profile?.user?.email || '' },
            { label: 'Phone', value: profile?.user?.phone || 'Not set' },
            { label: 'Member Since', value: profile?.user?.createdAt ? new Date(profile.user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '' },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontFamily: font, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.warmGray, marginBottom: '4px' }}>{label}</div>
              <div style={{ fontFamily: font, fontSize: '14px', color: C.charcoal }}>{value}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="About You" icon="✨">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <FormGroup label="Location" full>
            <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. San Francisco, CA" />
          </FormGroup>
          <FormGroup label="Timezone" full>
            <Input value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))} placeholder="e.g. America/Los_Angeles" />
          </FormGroup>
          <FormGroup label="Interests (comma-separated)" full>
            <Input value={form.interests} onChange={e => setForm(f => ({ ...f, interests: e.target.value }))} placeholder="e.g. Meditation, Yoga, Breathwork, Energy Healing" />
          </FormGroup>
          <FormGroup label="Bio" full>
            <TextArea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="Tell practitioners a bit about yourself and your wellness journey..." />
          </FormGroup>
        </div>
        <FormActions>
          <Btn onClick={handleSave} style={saving ? { opacity: 0.6 } : {}}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Btn>
        </FormActions>
      </Panel>
    </div>
  );
}
