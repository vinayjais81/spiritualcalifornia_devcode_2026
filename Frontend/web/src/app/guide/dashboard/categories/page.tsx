'use client';

import { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  C, font, serif, PageHeader, Panel, Btn,
} from '@/components/guide/dashboard-ui';

// Constants kept in sync with `Frontend/web/src/components/onboarding/steps/Step2Services.tsx`.
// If you add a category/modality/issue here, mirror it there (or extract to
// a shared constants file). Until then, treat both as a single source of truth.
const CATEGORY_CARDS = [
  { icon: '🧘', name: 'Mind Healing', desc: 'Meditation, breathwork, mindfulness, somatic therapy' },
  { icon: '🌿', name: 'Body Healing', desc: 'Acupuncture, massage, Ayurveda, TCM, energy healing' },
  { icon: '✨', name: 'Soul & Spirit', desc: 'Shamanism, astrology, human design, ritual, ceremony' },
  { icon: '🧭', name: 'Life Coaching', desc: 'Purpose, career, relationships, personal transformation' },
  { icon: '🌍', name: 'Soul Travels', desc: 'Spiritual retreats, sacred site journeys, immersive travel' },
  { icon: '🎨', name: 'Creative Arts', desc: 'Art therapy, music healing, expressive dance, writing' },
  { icon: '🥗', name: 'Nutrition & Food', desc: 'Ayurvedic nutrition, herbal medicine, functional food' },
  { icon: '🧬', name: 'Integrative Health', desc: 'Naturopathy, functional medicine, holistic wellness' },
  { icon: '👶', name: 'Family & Children', desc: "Parenting guidance, children's wellness, family healing" },
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

interface ApiCategory {
  id: string;
  name: string;
  slug?: string;
}

interface SavedCategory {
  categoryId: string;
  category: { id: string; name: string };
}

export default function CategoriesPage() {
  // Server-side category catalog (id ↔ name mapping). Falls back to using
  // names as IDs if the catalog endpoint isn't reachable, matching the
  // wizard's fallback behavior at Step2Services.tsx:73.
  const [apiCategories, setApiCategories] = useState<ApiCategory[]>([]);
  const [selectedCatNames, setSelectedCatNames] = useState<string[]>([]);
  const [modalities, setModalities] = useState<string[]>([]);
  const [issues, setIssues] = useState<string[]>([]);
  const [extraModalities, setExtraModalities] = useState<string[]>([]);
  const [customModalityInput, setCustomModalityInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load both the catalog and the guide's existing selections in parallel.
  useEffect(() => {
    Promise.all([
      api.get<ApiCategory[]>('/guides/categories').catch(() => ({ data: [] as ApiCategory[] })),
      api.get('/guides/me'),
    ])
      .then(([catRes, meRes]) => {
        setApiCategories(catRes.data ?? []);
        const me = meRes.data;
        const savedCats: SavedCategory[] = me.categories ?? [];
        // De-duplicate by category name — a guide row can have multiple
        // (category, subcategory) pairs for the same category, but the
        // visual grid only cares whether the category is selected at all.
        const names = Array.from(new Set(savedCats.map((c) => c.category?.name).filter(Boolean) as string[]));
        setSelectedCatNames(names);
        setModalities(me.modalities ?? []);
        setIssues(me.issuesHelped ?? []);
        // Surface any modality the guide already saved that isn't in our
        // static MODALITIES list, so it stays visible in the chip cloud.
        const extras = (me.modalities ?? []).filter((m: string) => !MODALITIES.includes(m));
        setExtraModalities(extras);
      })
      .catch(() => toast.error('Failed to load categories'))
      .finally(() => setLoading(false));
  }, []);

  const allModalities = useMemo(() => [...MODALITIES, ...extraModalities], [extraModalities]);

  const toggleCategory = (catName: string) => {
    setSelectedCatNames((prev) =>
      prev.includes(catName) ? prev.filter((n) => n !== catName) : [...prev, catName],
    );
  };

  const toggleModality = (m: string) => {
    setModalities((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  };

  const toggleIssue = (issue: string) => {
    setIssues((prev) => (prev.includes(issue) ? prev.filter((x) => x !== issue) : [...prev, issue]));
  };

  const addCustomModality = () => {
    const val = customModalityInput.trim();
    if (!val) return;
    if (!modalities.includes(val)) setModalities((prev) => [...prev, val]);
    if (!extraModalities.includes(val) && !MODALITIES.includes(val)) {
      setExtraModalities((prev) => [...prev, val]);
    }
    setCustomModalityInput('');
    setShowCustomInput(false);
  };

  const save = async () => {
    if (selectedCatNames.length === 0) {
      toast.error('Please select at least one practice category.');
      return;
    }
    setSaving(true);
    try {
      // Map each selected name to its API id. If the catalog isn't loaded
      // (offline / endpoint failed), fall back to using the name itself —
      // the backend tolerates that for the static category list.
      const selections = selectedCatNames.map((name) => {
        const apiCat = apiCategories.find((c) => c.name === name);
        return {
          categoryId: apiCat?.id ?? name,
          subcategoryIds: [],
          customSubcategoryNames: [],
        };
      });
      await api.put('/guides/onboarding/categories', {
        categories: selections,
        modalities,
        issuesHelped: issues,
      });
      toast.success('Categories saved');
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Failed to save categories';
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Categories of Practice" subtitle="Tell seekers what you offer." />
        <div style={{ fontFamily: font, fontSize: 13, color: C.warmGray, padding: 40, textAlign: 'center' }}>
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Categories of Practice"
        subtitle="Tell seekers what you offer. Pick one or more categories, the modalities you practice, and the issues you help with — these power search, AI matching, and your public profile tags."
      />

      <Panel title="Practice Categories" icon="✨">
        <p style={{ fontFamily: font, fontSize: 13, color: C.warmGray, marginBottom: 20, lineHeight: 1.6 }}>
          Many practitioners work across body, mind, and soul. Pick all that apply.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {CATEGORY_CARDS.map(({ icon, name, desc }) => {
            const sel = selectedCatNames.includes(name);
            return (
              <div
                key={name}
                onClick={() => toggleCategory(name)}
                style={{
                  border: sel ? `1.5px solid ${C.gold}` : '1.5px solid #E0DBD4',
                  borderRadius: 12,
                  padding: '20px 16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.25s',
                  background: sel ? C.goldPale : C.white,
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
                <div style={{ fontFamily: serif, fontSize: 17, fontWeight: 500, color: C.charcoal, marginBottom: 4 }}>
                  {name}
                </div>
                <div style={{ fontFamily: font, fontSize: 11, color: C.warmGray, lineHeight: 1.5 }}>
                  {desc}
                </div>
                {sel && (
                  <div style={{ fontFamily: font, fontSize: 12, color: C.gold, marginTop: 8 }}>✦ Selected</div>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Specific Modalities" icon="🌀">
        <p style={{ fontFamily: font, fontSize: 13, color: C.warmGray, marginBottom: 16, lineHeight: 1.6 }}>
          These tags help seekers find you through search and the AI guide. Add your own if it's not listed.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          {allModalities.map((m) => {
            const sel = modalities.includes(m);
            return (
              <button
                key={m}
                type="button"
                onClick={() => toggleModality(m)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 24,
                  border: sel ? `1.5px solid ${C.gold}` : '1.5px solid #E0DBD4',
                  background: sel ? C.goldPale : C.white,
                  fontFamily: font,
                  fontSize: 13,
                  color: C.charcoal,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
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
              style={{
                padding: '8px 16px',
                borderRadius: 24,
                border: '1.5px dashed rgba(232,184,75,0.5)',
                background: 'transparent',
                fontFamily: font,
                fontSize: 13,
                color: C.warmGray,
                cursor: 'pointer',
              }}
            >
              + Add your modality
            </button>
          )}
        </div>
        {showCustomInput && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              type="text"
              value={customModalityInput}
              onChange={(e) => setCustomModalityInput(e.target.value)}
              placeholder="e.g. Pranic Healing"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomModality();
                }
              }}
              autoFocus
              style={{
                flex: 1,
                border: '1px solid rgba(232,184,75,0.4)',
                borderRadius: 24,
                padding: '8px 16px',
                fontFamily: font,
                fontSize: 13,
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={addCustomModality}
              style={{
                padding: '8px 18px',
                borderRadius: 24,
                background: C.gold,
                color: C.white,
                border: 'none',
                fontFamily: font,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Add
            </button>
          </div>
        )}
      </Panel>

      <Panel title="Issues You Help With" icon="💡">
        <p style={{ fontFamily: font, fontSize: 13, color: C.warmGray, marginBottom: 16, lineHeight: 1.6 }}>
          Select all that apply — this helps the AI guide route the right seekers to you.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {ISSUES.map((issue) => {
            const sel = issues.includes(issue);
            return (
              <div
                key={issue}
                onClick={() => toggleIssue(issue)}
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: sel ? `1.5px solid ${C.gold}` : '1.5px solid #E0DBD4',
                  background: sel ? C.goldPale : C.white,
                  fontFamily: font,
                  fontSize: 13,
                  color: C.charcoal,
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {issue}
              </div>
            );
          })}
        </div>
      </Panel>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 32 }}>
        <Btn onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Categories'}
        </Btn>
      </div>
    </div>
  );
}
