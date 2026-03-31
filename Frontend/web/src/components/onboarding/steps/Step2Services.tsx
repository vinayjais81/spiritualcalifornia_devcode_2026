'use client';

import { useState } from 'react';
import { useOnboardingStore } from '@/store/onboarding.store';
import { api } from '@/lib/api';

const CATEGORY_CARDS = [
  { icon: '🧘', name: 'Mind Healing', desc: 'Meditation, breathwork, mindfulness, somatic therapy' },
  { icon: '🌿', name: 'Body Healing', desc: 'Acupuncture, massage, Ayurveda, TCM, energy healing' },
  { icon: '✨', name: 'Soul & Spirit', desc: 'Shamanism, astrology, human design, ritual, ceremony' },
  { icon: '🧭', name: 'Life Coaching', desc: 'Purpose, career, relationships, personal transformation' },
  { icon: '🌍', name: 'Soul Travels', desc: 'Spiritual retreats, sacred site journeys, immersive travel' },
  { icon: '🎨', name: 'Creative Arts', desc: 'Art therapy, music healing, expressive dance, writing' },
  { icon: '🥗', name: 'Nutrition & Food', desc: 'Ayurvedic nutrition, herbal medicine, functional food' },
  { icon: '🧬', name: 'Integrative Health', desc: 'Naturopathy, functional medicine, holistic wellness' },
  { icon: '👶', name: 'Family & Children', desc: 'Parenting guidance, children\'s wellness, family healing' },
];

const MODALITIES = [
  'Somatic Healing', 'Acupuncture', 'Breathwork', 'Reiki', 'Ayurveda',
  'Chinese Medicine (TCM)', 'QiGong', 'Tibetan Medicine', 'Tibetan Meditation',
  'Hindu Meditation', 'Walking Meditation', 'Mindfulness', 'Tai Chi', 'Yoga',
  'Kundalini Yoga', 'Sound Healing', 'Crystal Healing', 'Shamanism', 'Herbalism',
  'Nutrition Coaching', 'Human Design', 'Astrology', 'Tarot & Oracle',
  'Hypnotherapy', 'EFT / Tapping', 'NLP', 'Trauma-Informed Therapy',
  'Grief Support', 'Life Coaching', 'Relationship Coaching', 'Art Therapy',
  'Music Therapy', 'Dance / Movement', 'Naturopathy', 'Homeopathy',
];

const ISSUES = [
  'Burnout', 'Anxiety', 'Depression (non-clinical)', 'Chronic Pain', 'Back Pain',
  'Low Energy', 'Sleep Issues', 'Stress', 'Grief & Loss', 'Trauma',
  'Relationship Issues', 'Food & Nutrition Disorders', 'Lack of Purpose',
  'Feeling Stuck', 'Life Transitions', 'AI & Career Anxiety', 'Loneliness',
  'Spiritual Awakening', 'Addiction Recovery', 'Energetic Imbalance',
  'Digestive Issues', 'Hormonal Imbalance', 'Parenting Challenges', 'Autoimmune Conditions',
];

const lbl: React.CSSProperties = { fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#8A8278', fontWeight: 500, fontFamily: 'var(--font-inter), sans-serif' };

function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '32px 0 24px' }}>
      <div style={{ flex: 1, height: '1px', background: 'rgba(232,184,75,0.2)' }} />
      <div style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#8A8278', whiteSpace: 'nowrap', fontFamily: 'var(--font-inter), sans-serif' }}>{label}</div>
      <div style={{ flex: 1, height: '1px', background: 'rgba(232,184,75,0.2)' }} />
    </div>
  );
}

export function Step2Services() {
  const { step2, setStep2, setLoading, isLoading, setError, error, nextStep, prevStep, categories } = useOnboardingStore();
  const [customModality, setCustomModality] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [extraModalities, setExtraModalities] = useState<string[]>([]);

  // Selected category names (we use names as IDs in the simple UI version)
  const selectedCats = step2.selections.map((s) => {
    // Find the matching category from the API OR fall back to the static name
    const cat = categories.find((c) => c.id === s.categoryId);
    return cat?.name ?? s.categoryId;
  });

  const toggleCategory = (catName: string) => {
    const existing = step2.selections.find((s) => {
      const cat = categories.find((c) => c.id === s.categoryId);
      return (cat?.name ?? s.categoryId) === catName;
    });
    if (existing) {
      setStep2({ selections: step2.selections.filter((s) => s !== existing) });
    } else {
      // Find the real category ID if we have it from API
      const apiCat = categories.find((c) => c.name === catName);
      const catId = apiCat?.id ?? catName;
      setStep2({ selections: [...step2.selections, { categoryId: catId, subcategoryIds: [], customSubcategoryNames: [] }] });
    }
  };

  const toggleModality = (m: string) => {
    const mods = step2.modalities ?? [];
    setStep2({ modalities: mods.includes(m) ? mods.filter((x) => x !== m) : [...mods, m] });
  };

  const addCustomModality = () => {
    const val = customModality.trim();
    if (!val) return;
    const mods = step2.modalities ?? [];
    setStep2({ modalities: [...mods, val] });
    setExtraModalities((prev) => [...prev, val]);
    setCustomModality('');
    setShowCustomInput(false);
  };

  const toggleIssue = (issue: string) => {
    const issues = step2.issuesHelped ?? [];
    setStep2({ issuesHelped: issues.includes(issue) ? issues.filter((x) => x !== issue) : [...issues, issue] });
  };

  const handleContinue = async () => {
    if (step2.selections.length === 0) { setError('Please select at least one practice category.'); return; }
    setLoading(true); setError(null);
    try {
      await api.put('/guides/onboarding/categories', {
        categories: step2.selections,
        modalities: step2.modalities ?? [],
        issuesHelped: step2.issuesHelped ?? [],
      });
      nextStep();
    } catch (err: any) {
      const msg = err.response?.data?.message ?? 'Failed to save services.';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally { setLoading(false); }
  };

  const allModalities = [...MODALITIES, ...extraModalities];

  return (
    <div>
      <div style={{ marginBottom: '44px' }}>
        <div style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#E8B84B', marginBottom: '10px', fontFamily: 'var(--font-inter), sans-serif' }}>Step 2 of 6</div>
        <h1 className="font-cormorant" style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 300, lineHeight: 1.1, color: '#3A3530', marginBottom: '10px' }}>
          Your <em style={{ fontStyle: 'italic', color: '#E8B84B' }}>services</em>
        </h1>
        <p style={{ fontSize: '14px', color: '#8A8278', lineHeight: 1.7, maxWidth: '560px', fontFamily: 'var(--font-inter), sans-serif', margin: 0 }}>
          Tell us what you offer. You can select multiple categories — many practitioners work across body, mind, and soul.
        </p>
      </div>
      {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: '#DC2626', fontFamily: 'var(--font-inter), sans-serif', marginBottom: '20px' }}>{error}</div>}

      <SectionDivider label="Categories of Practice" />

      {/* Category grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '20px' }}>
        {CATEGORY_CARDS.map(({ icon, name, desc }) => {
          const sel = selectedCats.includes(name);
          return (
            <div
              key={name}
              onClick={() => toggleCategory(name)}
              style={{
                border: sel ? '1.5px solid #E8B84B' : '1.5px solid #E0DBD4',
                borderRadius: '12px', padding: '20px 16px', textAlign: 'center',
                cursor: 'pointer', transition: 'all 0.25s',
                background: sel ? '#FDF6E3' : '#FFFFFF',
              }}
            >
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>{icon}</div>
              <div className="font-cormorant" style={{ fontSize: '17px', fontWeight: 500, color: '#3A3530', marginBottom: '4px' }}>{name}</div>
              <div style={{ fontSize: '11px', color: '#8A8278', lineHeight: 1.5, fontFamily: 'var(--font-inter), sans-serif' }}>{desc}</div>
              {sel && <div style={{ fontSize: '14px', color: '#E8B84B', marginTop: '8px', fontFamily: 'var(--font-inter), sans-serif' }}>✦ Selected</div>}
            </div>
          );
        })}
      </div>

      <SectionDivider label="Specific Modalities" />
      <p style={{ fontSize: '13px', color: '#8A8278', marginBottom: '16px', lineHeight: 1.6, fontFamily: 'var(--font-inter), sans-serif' }}>Select all that apply. These tags help seekers find you through our AI guide and search.</p>

      {/* Modalities tag cloud */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
        {allModalities.map((m) => {
          const sel = (step2.modalities ?? []).includes(m);
          return (
            <button
              key={m}
              type="button"
              onClick={() => toggleModality(m)}
              style={{
                padding: '8px 16px', borderRadius: '24px',
                border: sel ? '1.5px solid #E8B84B' : '1.5px solid #E0DBD4',
                background: sel ? '#FDF6E3' : '#FFFFFF',
                fontSize: '13px', color: '#3A3530', cursor: 'pointer',
                fontFamily: 'var(--font-inter), sans-serif', transition: 'all 0.2s',
              }}
            >
              {m}
            </button>
          );
        })}
        {!showCustomInput && (
          <button
            type="button"
            onClick={() => setShowCustomInput(true)}
            style={{ padding: '8px 16px', borderRadius: '24px', border: '1.5px dashed rgba(232,184,75,0.5)', background: 'transparent', fontSize: '13px', color: '#8A8278', cursor: 'pointer', fontFamily: 'var(--font-inter), sans-serif', transition: 'all 0.2s' }}
          >
            + Add your modality
          </button>
        )}
      </div>
      {showCustomInput && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input
            type="text"
            value={customModality}
            onChange={(e) => setCustomModality(e.target.value)}
            placeholder="e.g. Pranic Healing"
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomModality())}
            style={{ flex: 1, border: '1px solid rgba(232,184,75,0.4)', borderRadius: '24px', padding: '8px 16px', fontSize: '13px', outline: 'none', fontFamily: 'var(--font-inter), sans-serif' }}
            autoFocus
          />
          <button onClick={addCustomModality} type="button" style={{ padding: '8px 18px', borderRadius: '24px', background: '#E8B84B', color: '#FFFFFF', border: 'none', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-inter), sans-serif' }}>Add</button>
        </div>
      )}

      <SectionDivider label="Issues You Help With" />
      <p style={{ fontSize: '13px', color: '#8A8278', marginBottom: '16px', lineHeight: 1.6, fontFamily: 'var(--font-inter), sans-serif' }}>This helps our AI guide connect the right seekers with you. Select all that apply.</p>

      {/* Issues grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
        {ISSUES.map((issue) => {
          const sel = (step2.issuesHelped ?? []).includes(issue);
          return (
            <div
              key={issue}
              onClick={() => toggleIssue(issue)}
              style={{
                padding: '10px 14px', borderRadius: '10px',
                border: sel ? '1.5px solid #E8B84B' : '1.5px solid #E0DBD4',
                background: sel ? '#FDF6E3' : '#FFFFFF',
                fontSize: '13px', color: '#3A3530', cursor: 'pointer',
                textAlign: 'center', transition: 'all 0.2s',
                fontFamily: 'var(--font-inter), sans-serif',
              }}
            >
              {issue}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '40px', paddingTop: '28px', borderTop: '1px solid rgba(232,184,75,0.15)' }}>
        <button type="button" onClick={prevStep} style={{ fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A8278', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-inter), sans-serif', display: 'flex', alignItems: 'center', gap: '6px' }}>← Back</button>
        <button type="button" onClick={handleContinue} disabled={isLoading} style={{ padding: '14px 36px', borderRadius: '8px', background: isLoading ? '#C4BDB5' : '#3A3530', color: '#FFFFFF', fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-inter), sans-serif', transition: 'background 0.3s' }}>
          {isLoading ? 'Saving…' : 'Continue → Credentials'}
        </button>
      </div>
    </div>
  );
}
