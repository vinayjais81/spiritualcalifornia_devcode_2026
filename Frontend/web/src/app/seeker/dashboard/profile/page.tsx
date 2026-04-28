'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { C, font, PageHeader, Panel, Btn, FormGroup, Input, TextArea, FormActions } from '@/components/guide/dashboard-ui';

// Mirrors the wizard's experience step. Stored as plain strings on the
// SeekerProfile so admins can extend without a schema change.
const EXPERIENCE_LEVELS: Array<{ value: string; label: string; sub: string }> = [
  { value: 'beginner', label: 'Beginner', sub: "I'm just starting to explore" },
  { value: 'explorer', label: 'Explorer', sub: 'I dabble across modalities' },
  { value: 'practitioner', label: 'Practitioner', sub: 'I have a consistent practice' },
  { value: 'teacher', label: 'Teacher', sub: 'I share these practices with others' },
];

// Same options as the wizard's "practices" multi-select.
const PRACTICE_OPTIONS = [
  'Meditation',
  'Yoga',
  'Breathwork',
  'Reiki',
  'Sound Healing',
  'Energy Work',
  'QiGong',
  'Tai Chi',
  'Hypnotherapy',
  'Plant Medicine',
  'Astrology',
  'Tarot',
];

interface SeekerProfile {
  bio: string | null;
  location: string | null;
  timezone: string | null;
  interests: string[];
  experienceLevel: string | null;
  practices: string[];
  journeyText: string | null;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    createdAt: string;
  };
  completeness?: {
    sections: Array<{ key: string; filled: boolean; label: string }>;
    filledCount: number;
    totalSections: number;
    percent: number;
    isComplete: boolean;
  };
}

export default function SeekerProfilePage() {
  const [profile, setProfile] = useState<SeekerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    bio: '',
    location: '',
    timezone: '',
    interests: '',
    experienceLevel: '',
    practices: [] as string[],
    journeyText: '',
  });

  useEffect(() => {
    api
      .get('/seekers/me')
      .then((r) => {
        setProfile(r.data);
        setForm({
          bio: r.data.bio || '',
          location: r.data.location || '',
          timezone: r.data.timezone || '',
          interests: (r.data.interests || []).join(', '),
          experienceLevel: r.data.experienceLevel || '',
          practices: r.data.practices || [],
          journeyText: r.data.journeyText || '',
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const togglePractice = (p: string) => {
    setForm((f) => ({
      ...f,
      practices: f.practices.includes(p)
        ? f.practices.filter((x) => x !== p)
        : [...f.practices, p],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch('/seekers/me', {
        bio: form.bio.trim() || undefined,
        location: form.location.trim() || undefined,
        timezone: form.timezone.trim() || undefined,
        interests: form.interests
          ? form.interests
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
        // Three deferred-from-wizard fields. `null` clears them server-side
        // when the user empties the input; `undefined` would skip the column.
        experienceLevel: form.experienceLevel || null,
        practices: form.practices,
        journeyText: form.journeyText.trim() || null,
      });
      toast.success('Profile updated');
      // Refresh so the completeness widget on the dashboard updates next nav.
      const { data } = await api.get('/seekers/me');
      setProfile(data);
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ fontFamily: font, fontSize: '13px', color: C.warmGray, padding: '40px' }}>
        Loading...
      </div>
    );
  }

  const pct = profile?.completeness?.percent ?? 0;

  return (
    <div>
      <PageHeader title="My Profile" subtitle="Manage your account details and preferences." />

      {/* Completeness summary — mirrors the dashboard widget so the user
          sees the same percent here while editing. */}
      {profile?.completeness && !profile.completeness.isComplete && (
        <div
          style={{
            marginBottom: '20px',
            padding: '14px 18px',
            background: '#FDF6E3',
            border: '1px solid rgba(232,184,75,0.25)',
            borderRadius: 8,
            fontFamily: font,
            fontSize: 13,
            color: C.charcoal,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span>
              Profile <strong>{pct}% complete</strong> — fill the remaining sections to get
              better practitioner matches.
            </span>
            <span style={{ fontSize: 11, color: C.warmGray }}>
              {profile.completeness.filledCount}/{profile.completeness.totalSections}
            </span>
          </div>
          <div
            style={{
              width: '100%',
              height: 6,
              background: 'rgba(232,184,75,0.15)',
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                background: '#E8B84B',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>
      )}

      <Panel title="Account" icon="👤">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {[
            {
              label: 'Name',
              value: `${profile?.user?.firstName || ''} ${profile?.user?.lastName || ''}`.trim(),
            },
            { label: 'Email', value: profile?.user?.email || '' },
            { label: 'Phone', value: profile?.user?.phone || 'Not set' },
            {
              label: 'Member Since',
              value: profile?.user?.createdAt
                ? new Date(profile.user.createdAt).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })
                : '',
            },
          ].map(({ label, value }) => (
            <div key={label}>
              <div
                style={{
                  fontFamily: font,
                  fontSize: '10px',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: C.warmGray,
                  marginBottom: '4px',
                }}
              >
                {label}
              </div>
              <div style={{ fontFamily: font, fontSize: '14px', color: C.charcoal }}>{value}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="About You" icon="✨">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <FormGroup label="Location" full>
            <Input
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="e.g. San Francisco, CA"
            />
          </FormGroup>
          <FormGroup label="Timezone" full>
            <Input
              value={form.timezone}
              onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
              placeholder="e.g. America/Los_Angeles"
            />
          </FormGroup>
          <FormGroup label="Interests (comma-separated)" full>
            <Input
              value={form.interests}
              onChange={(e) => setForm((f) => ({ ...f, interests: e.target.value }))}
              placeholder="e.g. Meditation, Yoga, Breathwork, Energy Healing"
            />
          </FormGroup>
          <FormGroup label="Bio" full>
            <TextArea
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              placeholder="Tell practitioners a bit about yourself and your wellness journey..."
            />
          </FormGroup>
        </div>
      </Panel>

      <Panel title="Your Practice" icon="🌿">
        <FormGroup label="Experience level" full>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {EXPERIENCE_LEVELS.map((opt) => {
              const selected = form.experienceLevel === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      experienceLevel: f.experienceLevel === opt.value ? '' : opt.value,
                    }))
                  }
                  style={{
                    textAlign: 'left',
                    padding: '12px 14px',
                    border: `1.5px solid ${selected ? '#E8B84B' : 'rgba(232,184,75,0.25)'}`,
                    borderRadius: 8,
                    background: selected ? '#FDF6E3' : '#fff',
                    cursor: 'pointer',
                    fontFamily: font,
                    color: C.charcoal,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{opt.label}</div>
                  <div style={{ fontSize: 11, color: C.warmGray }}>{opt.sub}</div>
                </button>
              );
            })}
          </div>
        </FormGroup>

        <FormGroup label="Practices you've explored" full>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {PRACTICE_OPTIONS.map((p) => {
              const selected = form.practices.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePractice(p)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 100,
                    border: `1.5px solid ${selected ? '#E8B84B' : 'rgba(232,184,75,0.3)'}`,
                    background: selected ? '#E8B84B' : '#fff',
                    color: selected ? '#fff' : C.warmGray,
                    fontFamily: font,
                    fontSize: 12,
                    cursor: 'pointer',
                    fontWeight: selected ? 500 : 400,
                  }}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </FormGroup>

        <FormGroup label="What brings you here?" full>
          <TextArea
            value={form.journeyText}
            onChange={(e) => setForm((f) => ({ ...f, journeyText: e.target.value }))}
            placeholder="A short note about what you're seeking — burnout recovery, creative block, life transition. Helps the AI guide match you to the right practitioners."
          />
        </FormGroup>
      </Panel>

      <FormActions>
        <Btn onClick={handleSave} style={saving ? { opacity: 0.6 } : {}}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Btn>
      </FormActions>
    </div>
  );
}
