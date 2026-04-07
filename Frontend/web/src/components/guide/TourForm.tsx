'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import {
  C, font, serif, Panel, Btn, FormGroup, Input, TextArea, Select,
} from '@/components/guide/dashboard-ui';
import { RichTextEditor } from '@/components/guide/RichTextEditor';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RoomTypeForm {
  id?: string;            // present if persisted (edit)
  name: string;
  description: string;
  pricePerNight: string;
  totalPrice: string;
  capacity: string;
  amenities: string;      // comma-separated in UI
}

export interface DepartureForm {
  id?: string;
  startDate: string;
  endDate: string;
  capacity: string;
  priceOverride: string;  // empty = no override
  notes: string;
}

export interface ItineraryDayForm {
  id?: string;
  dayNumber: string;
  title: string;
  description: string;
  location: string;
  meals: string;          // comma-separated
  accommodation: string;
  activities: string;     // comma-separated
  imageUrl: string;
}

export interface TourFormState {
  // Basics
  title: string;
  shortDesc: string;
  description: string;       // rich HTML
  coverImageUrl: string;
  imageUrls: string[];       // gallery
  // Location
  location: string;
  city: string;
  state: string;
  country: string;
  meetingPoint: string;
  // Dates (primary range — used for back-compat sorting)
  startDate: string;
  endDate: string;
  timezone: string;
  // Pricing & capacity
  basePrice: string;
  capacity: string;
  minDepositPerPerson: string;
  // Tour metadata
  difficultyLevel: string;
  languages: string;         // comma-separated
  // Inclusions
  highlights: string;        // newline-separated
  included: string;
  notIncluded: string;
  requirements: string;
  // Policy
  balanceDueDaysBefore: string;
  fullRefundDaysBefore: string;
  halfRefundDaysBefore: string;
  // Children
  roomTypes: RoomTypeForm[];
  departures: DepartureForm[];
  itinerary: ItineraryDayForm[];
  // Publish
  isPublished: boolean;
}

export const emptyTourForm: TourFormState = {
  title: '', shortDesc: '', description: '', coverImageUrl: '', imageUrls: [],
  location: '', city: '', state: '', country: 'United States', meetingPoint: '',
  startDate: '', endDate: '', timezone: 'America/Los_Angeles',
  basePrice: '', capacity: '12', minDepositPerPerson: '500',
  difficultyLevel: 'MODERATE', languages: 'English',
  highlights: '', included: '', notIncluded: '', requirements: '',
  balanceDueDaysBefore: '60', fullRefundDaysBefore: '90', halfRefundDaysBefore: '60',
  roomTypes: [],
  departures: [],
  itinerary: [],
  isPublished: false,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function toIsoDate(localDate: string): string | null {
  if (!localDate) return null;
  const d = new Date(localDate);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function toLocalDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toISOString().slice(0, 10);
}

function linesToArray(s: string): string[] {
  return s.split('\n').map((x) => x.trim()).filter(Boolean);
}

function csvToArray(s: string): string[] {
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

// ─── Hydration helper: server tour → form state ────────────────────────────

export function hydrateTourForm(tour: any): TourFormState {
  return {
    title: tour.title || '',
    shortDesc: tour.shortDesc || '',
    description: tour.description || '',
    coverImageUrl: tour.coverImageUrl || '',
    imageUrls: tour.imageUrls || [],
    location: tour.location || '',
    city: tour.city || '',
    state: tour.state || '',
    country: tour.country || 'United States',
    meetingPoint: tour.meetingPoint || '',
    startDate: toLocalDate(tour.startDate),
    endDate: toLocalDate(tour.endDate),
    timezone: tour.timezone || 'America/Los_Angeles',
    basePrice: tour.basePrice ? String(tour.basePrice) : '',
    capacity: tour.capacity ? String(tour.capacity) : '12',
    minDepositPerPerson: tour.minDepositPerPerson ? String(tour.minDepositPerPerson) : '500',
    difficultyLevel: tour.difficultyLevel || 'MODERATE',
    languages: (tour.languages || ['English']).join(', '),
    highlights: (tour.highlights || []).join('\n'),
    included: (tour.included || []).join('\n'),
    notIncluded: (tour.notIncluded || []).join('\n'),
    requirements: tour.requirements || '',
    balanceDueDaysBefore: String(tour.balanceDueDaysBefore || 60),
    fullRefundDaysBefore: String(tour.cancellationPolicy?.fullRefundDaysBefore || 90),
    halfRefundDaysBefore: String(tour.cancellationPolicy?.halfRefundDaysBefore || 60),
    roomTypes: (tour.roomTypes || []).map((rt: any) => ({
      id: rt.id,
      name: rt.name || '',
      description: rt.description || '',
      pricePerNight: String(rt.pricePerNight || ''),
      totalPrice: String(rt.totalPrice || ''),
      capacity: String(rt.capacity || ''),
      amenities: (rt.amenities || []).join(', '),
    })),
    departures: (tour.departures || []).map((d: any) => ({
      id: d.id,
      startDate: toLocalDate(d.startDate),
      endDate: toLocalDate(d.endDate),
      capacity: String(d.capacity || ''),
      priceOverride: d.priceOverride ? String(d.priceOverride) : '',
      notes: d.notes || '',
    })),
    itinerary: (tour.itinerary || []).map((day: any) => ({
      id: day.id,
      dayNumber: String(day.dayNumber || ''),
      title: day.title || '',
      description: day.description || '',
      location: day.location || '',
      meals: (day.meals || []).join(', '),
      accommodation: day.accommodation || '',
      activities: (day.activities || []).join(', '),
      imageUrl: day.imageUrl || '',
    })),
    isPublished: !!tour.isPublished,
  };
}

// ─── Section header ─────────────────────────────────────────────────────────

function SectionTitle({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: serif, fontSize: 22, fontWeight: 500, color: C.charcoal,
      marginBottom: 16, paddingBottom: 12,
      borderBottom: '1px solid rgba(232,184,75,0.15)',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ fontSize: 20 }}>{icon}</span> {children}
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

interface Props {
  initial?: TourFormState;
  tourId?: string; // present in edit mode
}

export function TourForm({ initial, tourId }: Props) {
  const router = useRouter();
  const isEdit = !!tourId;
  const [form, setForm] = useState<TourFormState>(initial || emptyTourForm);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof TourFormState>(k: K, v: TourFormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // ─── Image upload (FileReader → base64; S3 wired later) ─────────────────
  const handleCoverImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Cover image must be under 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => set('coverImageUrl', ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleGalleryImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 5MB`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        set('imageUrls', [...form.imageUrls, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeGalleryImage = (idx: number) => {
    set('imageUrls', form.imageUrls.filter((_, i) => i !== idx));
  };

  // ─── Room types ───────────────────────────────────────────────────────────
  const addRoomType = () => set('roomTypes', [...form.roomTypes, {
    name: '', description: '', pricePerNight: '', totalPrice: '', capacity: '2', amenities: '',
  }]);
  const updateRoomType = (i: number, patch: Partial<RoomTypeForm>) =>
    set('roomTypes', form.roomTypes.map((rt, idx) => (idx === i ? { ...rt, ...patch } : rt)));
  const removeRoomType = (i: number) =>
    set('roomTypes', form.roomTypes.filter((_, idx) => idx !== i));

  // ─── Departures ───────────────────────────────────────────────────────────
  const addDeparture = () => set('departures', [...form.departures, {
    startDate: '', endDate: '', capacity: form.capacity || '12', priceOverride: '', notes: '',
  }]);
  const updateDeparture = (i: number, patch: Partial<DepartureForm>) =>
    set('departures', form.departures.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  const removeDeparture = (i: number) =>
    set('departures', form.departures.filter((_, idx) => idx !== i));

  // ─── Itinerary ────────────────────────────────────────────────────────────
  const addItineraryDay = () => set('itinerary', [...form.itinerary, {
    dayNumber: String(form.itinerary.length + 1),
    title: '', description: '', location: '', meals: '', accommodation: '', activities: '', imageUrl: '',
  }]);
  const updateItineraryDay = (i: number, patch: Partial<ItineraryDayForm>) =>
    set('itinerary', form.itinerary.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  const removeItineraryDay = (i: number) =>
    set('itinerary', form.itinerary.filter((_, idx) => idx !== i));

  // ─── Validation ───────────────────────────────────────────────────────────
  const validate = (): string | null => {
    if (!form.title.trim()) return 'Title is required';
    if (!form.startDate || !form.endDate) return 'Primary date range is required';
    if (new Date(form.endDate) < new Date(form.startDate)) return 'End date must be after start date';
    if (!form.basePrice || Number(form.basePrice) < 0) return 'Base price is required';
    if (!form.capacity || Number(form.capacity) < 1) return 'Capacity must be at least 1';
    if (form.isPublished && form.departures.length === 0) {
      return 'You must add at least one departure before publishing';
    }
    if (form.isPublished && form.roomTypes.length === 0) {
      return 'You must add at least one room type before publishing';
    }
    for (const [i, rt] of form.roomTypes.entries()) {
      if (!rt.name.trim()) return `Room type #${i + 1} needs a name`;
      if (!rt.totalPrice || Number(rt.totalPrice) < 0) return `Room type #${i + 1} needs a valid total price`;
      if (!rt.capacity || Number(rt.capacity) < 1) return `Room type #${i + 1} needs a capacity ≥ 1`;
    }
    for (const [i, d] of form.departures.entries()) {
      if (!d.startDate || !d.endDate) return `Departure #${i + 1} needs both dates`;
      if (new Date(d.endDate) < new Date(d.startDate)) return `Departure #${i + 1} end date must be after start`;
      if (!d.capacity || Number(d.capacity) < 1) return `Departure #${i + 1} needs a capacity`;
    }
    for (const [i, day] of form.itinerary.entries()) {
      if (!day.title.trim()) return `Itinerary day #${i + 1} needs a title`;
      if (!day.description.trim()) return `Itinerary day #${i + 1} needs a description`;
    }
    return null;
  };

  // ─── Build payload for backend ────────────────────────────────────────────
  const buildPayload = () => {
    return {
      title: form.title.trim(),
      shortDesc: form.shortDesc.trim() || undefined,
      description: form.description || undefined,
      coverImageUrl: form.coverImageUrl || undefined,
      imageUrls: form.imageUrls,
      location: form.location || undefined,
      city: form.city || undefined,
      state: form.state || undefined,
      country: form.country || undefined,
      meetingPoint: form.meetingPoint || undefined,
      startDate: toIsoDate(form.startDate),
      endDate: toIsoDate(form.endDate),
      timezone: form.timezone || undefined,
      basePrice: Number(form.basePrice),
      capacity: Number(form.capacity),
      minDepositPerPerson: form.minDepositPerPerson ? Number(form.minDepositPerPerson) : undefined,
      difficultyLevel: form.difficultyLevel || undefined,
      languages: csvToArray(form.languages),
      highlights: linesToArray(form.highlights),
      included: linesToArray(form.included),
      notIncluded: linesToArray(form.notIncluded),
      requirements: form.requirements || undefined,
      balanceDueDaysBefore: form.balanceDueDaysBefore ? Number(form.balanceDueDaysBefore) : undefined,
      cancellationPolicy: {
        fullRefundDaysBefore: Number(form.fullRefundDaysBefore) || 90,
        halfRefundDaysBefore: Number(form.halfRefundDaysBefore) || 60,
      },
      isPublished: form.isPublished,
      // For CREATE only, pass nested children. For EDIT, the backend update()
      // currently ignores nested children — those are managed via dedicated
      // sub-endpoints (POST /:id/departures, POST /:id/itinerary).
      ...(isEdit ? {} : {
        roomTypes: form.roomTypes.map((rt) => ({
          name: rt.name.trim(),
          description: rt.description || undefined,
          pricePerNight: Number(rt.pricePerNight) || 0,
          totalPrice: Number(rt.totalPrice),
          capacity: Number(rt.capacity),
          amenities: csvToArray(rt.amenities),
        })),
        departures: form.departures.map((d) => ({
          startDate: toIsoDate(d.startDate),
          endDate: toIsoDate(d.endDate),
          capacity: Number(d.capacity),
          priceOverride: d.priceOverride ? Number(d.priceOverride) : undefined,
          notes: d.notes || undefined,
        })),
        itinerary: form.itinerary.map((day) => ({
          dayNumber: Number(day.dayNumber),
          title: day.title.trim(),
          description: day.description,
          location: day.location || undefined,
          meals: csvToArray(day.meals),
          accommodation: day.accommodation || undefined,
          activities: csvToArray(day.activities),
          imageUrl: day.imageUrl || undefined,
        })),
      }),
    };
  };

  // ─── Save ─────────────────────────────────────────────────────────────────
  const save = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (isEdit) {
        await api.put(`/soul-tours/${tourId}`, payload);
        // For edit mode: also sync itinerary via dedicated endpoint
        await api.post(`/soul-tours/${tourId}/itinerary`, {
          days: form.itinerary.map((day) => ({
            dayNumber: Number(day.dayNumber),
            title: day.title.trim(),
            description: day.description,
            location: day.location || undefined,
            meals: csvToArray(day.meals),
            accommodation: day.accommodation || undefined,
            activities: csvToArray(day.activities),
            imageUrl: day.imageUrl || undefined,
          })),
        });
        toast.success('Tour updated');
      } else {
        const res = await api.post('/soul-tours', payload);
        toast.success('Tour created');
        router.push(`/guide/dashboard/tours/${res.data.id}`);
        return;
      }
      router.push('/guide/dashboard/tours');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save tour');
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ─── BASICS ───────────────────────────────────────────────────────── */}
      <Panel title="Basics" icon="📝">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <FormGroup label="Tour Title" full>
            <Input
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Nepal — Himalayan Awakening"
            />
          </FormGroup>
          <FormGroup label="Short Description (≤300 chars)" full>
            <TextArea
              value={form.shortDesc}
              onChange={(e) => set('shortDesc', e.target.value)}
              maxLength={300}
              rows={2}
              placeholder="A one-line tagline shown in listings and search results"
              style={{ minHeight: 60 }}
            />
          </FormGroup>
          <FormGroup label="Full Description" full>
            <RichTextEditor
              value={form.description}
              onChange={(html) => set('description', html)}
              placeholder="Tell seekers what makes this journey transformative..."
            />
          </FormGroup>
        </div>
      </Panel>

      {/* ─── MEDIA ────────────────────────────────────────────────────────── */}
      <Panel title="Media" icon="📷">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <div style={{ fontFamily: font, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.warmGray, fontWeight: 500, marginBottom: 8 }}>
              Cover Image
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {form.coverImageUrl ? (
                <div style={{ position: 'relative' }}>
                  <img
                    src={form.coverImageUrl}
                    alt="cover"
                    style={{ width: 160, height: 100, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(232,184,75,0.3)' }}
                  />
                  <button
                    onClick={() => set('coverImageUrl', '')}
                    style={{
                      position: 'absolute', top: -8, right: -8,
                      width: 24, height: 24, borderRadius: '50%',
                      background: C.red, color: 'white', border: 'none', cursor: 'pointer',
                      fontSize: 14,
                    }}
                  >×</button>
                </div>
              ) : (
                <div style={{
                  width: 160, height: 100, borderRadius: 8,
                  background: C.goldPale, border: '1px dashed rgba(232,184,75,0.5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 32,
                }}>🏔️</div>
              )}
              <label style={{
                padding: '10px 18px', fontFamily: font, fontSize: 12, fontWeight: 500,
                background: C.goldPale, border: '1.5px solid rgba(232,184,75,0.5)',
                borderRadius: 6, cursor: 'pointer', color: C.charcoal,
              }}>
                📁 Upload Cover
                <input type="file" accept="image/*" onChange={handleCoverImage} style={{ display: 'none' }} />
              </label>
            </div>
          </div>

          <div>
            <div style={{ fontFamily: font, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.warmGray, fontWeight: 500, marginBottom: 8 }}>
              Gallery ({form.imageUrls.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
              {form.imageUrls.map((url, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={url} alt="" style={{ width: 100, height: 70, objectFit: 'cover', borderRadius: 6, border: '1px solid rgba(232,184,75,0.2)' }} />
                  <button
                    onClick={() => removeGalleryImage(i)}
                    style={{
                      position: 'absolute', top: -6, right: -6, width: 20, height: 20,
                      borderRadius: '50%', background: C.red, color: 'white', border: 'none',
                      cursor: 'pointer', fontSize: 12,
                    }}
                  >×</button>
                </div>
              ))}
              <label style={{
                width: 100, height: 70, borderRadius: 6,
                background: C.offWhite, border: '1.5px dashed rgba(232,184,75,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: 24, color: C.warmGray,
              }}>
                +
                <input type="file" accept="image/*" multiple onChange={handleGalleryImage} style={{ display: 'none' }} />
              </label>
            </div>
          </div>
        </div>
      </Panel>

      {/* ─── LOCATION & TIMING ──────────────────────────────────────────────── */}
      <Panel title="Location & Primary Dates" icon="📍">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <FormGroup label="Location (display name)">
            <Input value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Kathmandu · Pokhara · Lumbini" />
          </FormGroup>
          <FormGroup label="Country">
            <Input value={form.country} onChange={(e) => set('country', e.target.value)} />
          </FormGroup>
          <FormGroup label="City">
            <Input value={form.city} onChange={(e) => set('city', e.target.value)} />
          </FormGroup>
          <FormGroup label="State / Region">
            <Input value={form.state} onChange={(e) => set('state', e.target.value)} />
          </FormGroup>
          <FormGroup label="Meeting Point" full>
            <Input value={form.meetingPoint} onChange={(e) => set('meetingPoint', e.target.value)} placeholder="e.g. Tribhuvan International Airport (KTM), Day 1 at 14:00" />
          </FormGroup>
          <FormGroup label="Primary Start Date">
            <Input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
          </FormGroup>
          <FormGroup label="Primary End Date">
            <Input type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
          </FormGroup>
          <FormGroup label="Timezone" full>
            <Input value={form.timezone} onChange={(e) => set('timezone', e.target.value)} />
          </FormGroup>
        </div>
        <p style={{ fontFamily: font, fontSize: 11, color: C.warmGray, marginTop: 12 }}>
          The primary dates represent your default departure. Add more departures below to allow seekers to choose alternative dates.
        </p>
      </Panel>

      {/* ─── DEPARTURES ──────────────────────────────────────────────────── */}
      <Panel title="Departures" icon="🗓️">
        <p style={{ fontFamily: font, fontSize: 12, color: C.warmGray, marginBottom: 16 }}>
          Each departure is a separately bookable instance with its own date range, capacity, and (optionally) pricing.
        </p>
        {form.departures.map((d, i) => (
          <div key={i} style={{
            background: C.offWhite, border: '1px solid rgba(232,184,75,0.15)', borderRadius: 8,
            padding: 16, marginBottom: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontFamily: serif, fontSize: 16, fontWeight: 500, color: C.charcoal }}>
                Departure #{i + 1}
              </div>
              <Btn variant="danger" size="sm" onClick={() => removeDeparture(i)}>Remove</Btn>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
              <FormGroup label="Start">
                <Input type="date" value={d.startDate} onChange={(e) => updateDeparture(i, { startDate: e.target.value })} />
              </FormGroup>
              <FormGroup label="End">
                <Input type="date" value={d.endDate} onChange={(e) => updateDeparture(i, { endDate: e.target.value })} />
              </FormGroup>
              <FormGroup label="Capacity">
                <Input type="number" min={1} value={d.capacity} onChange={(e) => updateDeparture(i, { capacity: e.target.value })} />
              </FormGroup>
              <FormGroup label="Price Override">
                <Input type="number" min={0} value={d.priceOverride} onChange={(e) => updateDeparture(i, { priceOverride: e.target.value })} placeholder="Optional" />
              </FormGroup>
              <FormGroup label="Notes" full>
                <Input value={d.notes} onChange={(e) => updateDeparture(i, { notes: e.target.value })} placeholder="e.g. monsoon-friendly route" />
              </FormGroup>
            </div>
          </div>
        ))}
        <Btn variant="secondary" size="sm" onClick={addDeparture}>+ Add Departure</Btn>
        {isEdit && (
          <p style={{ fontFamily: font, fontSize: 11, color: C.warmGray, marginTop: 12 }}>
            Note: in edit mode, new/removed departures are not synced via this form yet. Use the dedicated departures management endpoint or recreate the tour for now.
          </p>
        )}
      </Panel>

      {/* ─── ROOM TYPES ──────────────────────────────────────────────────── */}
      <Panel title="Room Types & Pricing" icon="🛏️">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18, marginBottom: 18 }}>
          <FormGroup label="Base Price (per person, USD)">
            <Input type="number" min={0} value={form.basePrice} onChange={(e) => set('basePrice', e.target.value)} />
          </FormGroup>
          <FormGroup label="Total Capacity (max travelers per departure)">
            <Input type="number" min={1} value={form.capacity} onChange={(e) => set('capacity', e.target.value)} />
          </FormGroup>
          <FormGroup label="Min Deposit (per person, USD)">
            <Input type="number" min={0} value={form.minDepositPerPerson} onChange={(e) => set('minDepositPerPerson', e.target.value)} />
          </FormGroup>
        </div>

        {form.roomTypes.map((rt, i) => (
          <div key={i} style={{
            background: C.offWhite, border: '1px solid rgba(232,184,75,0.15)', borderRadius: 8,
            padding: 16, marginBottom: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontFamily: serif, fontSize: 16, fontWeight: 500, color: C.charcoal }}>
                Room Type #{i + 1}
              </div>
              <Btn variant="danger" size="sm" onClick={() => removeRoomType(i)}>Remove</Btn>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormGroup label="Name">
                <Input value={rt.name} onChange={(e) => updateRoomType(i, { name: e.target.value })} placeholder="e.g. Shared Double Room" />
              </FormGroup>
              <FormGroup label="Capacity (travelers per room)">
                <Input type="number" min={1} value={rt.capacity} onChange={(e) => updateRoomType(i, { capacity: e.target.value })} />
              </FormGroup>
              <FormGroup label="Price per night">
                <Input type="number" min={0} value={rt.pricePerNight} onChange={(e) => updateRoomType(i, { pricePerNight: e.target.value })} />
              </FormGroup>
              <FormGroup label="Total price (full stay, per person)">
                <Input type="number" min={0} value={rt.totalPrice} onChange={(e) => updateRoomType(i, { totalPrice: e.target.value })} />
              </FormGroup>
              <FormGroup label="Description" full>
                <TextArea
                  value={rt.description}
                  onChange={(e) => updateRoomType(i, { description: e.target.value })}
                  rows={2}
                  style={{ minHeight: 50 }}
                  placeholder="Comfortable twin beds · Shared with another traveler"
                />
              </FormGroup>
              <FormGroup label="Amenities (comma-separated)" full>
                <Input value={rt.amenities} onChange={(e) => updateRoomType(i, { amenities: e.target.value })} placeholder="ensuite bathroom, mountain view, daily housekeeping" />
              </FormGroup>
            </div>
          </div>
        ))}
        <Btn variant="secondary" size="sm" onClick={addRoomType}>+ Add Room Type</Btn>
      </Panel>

      {/* ─── ITINERARY ────────────────────────────────────────────────────── */}
      <Panel title="Day-by-Day Itinerary" icon="🗺️">
        {form.itinerary.map((day, i) => (
          <div key={i} style={{
            background: C.offWhite, border: '1px solid rgba(232,184,75,0.15)', borderRadius: 8,
            padding: 16, marginBottom: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontFamily: serif, fontSize: 16, fontWeight: 500, color: C.charcoal }}>
                Day {day.dayNumber || i + 1}
              </div>
              <Btn variant="danger" size="sm" onClick={() => removeItineraryDay(i)}>Remove</Btn>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: 12 }}>
              <FormGroup label="Day #">
                <Input type="number" min={1} value={day.dayNumber} onChange={(e) => updateItineraryDay(i, { dayNumber: e.target.value })} />
              </FormGroup>
              <FormGroup label="Title">
                <Input value={day.title} onChange={(e) => updateItineraryDay(i, { title: e.target.value })} placeholder="Arrival in Kathmandu" />
              </FormGroup>
              <FormGroup label="Location">
                <Input value={day.location} onChange={(e) => updateItineraryDay(i, { location: e.target.value })} placeholder="Kathmandu" />
              </FormGroup>
              <FormGroup label="Description" full>
                <TextArea
                  value={day.description}
                  onChange={(e) => updateItineraryDay(i, { description: e.target.value })}
                  rows={3}
                  style={{ minHeight: 70 }}
                  placeholder="What seekers will experience this day..."
                />
              </FormGroup>
              <FormGroup label="Meals (comma-separated)">
                <Input value={day.meals} onChange={(e) => updateItineraryDay(i, { meals: e.target.value })} placeholder="breakfast, dinner" />
              </FormGroup>
              <FormGroup label="Accommodation">
                <Input value={day.accommodation} onChange={(e) => updateItineraryDay(i, { accommodation: e.target.value })} placeholder="Hotel Yak & Yeti" />
              </FormGroup>
              <FormGroup label="Activities (comma-separated)">
                <Input value={day.activities} onChange={(e) => updateItineraryDay(i, { activities: e.target.value })} placeholder="Welcome ceremony, group meditation" />
              </FormGroup>
            </div>
          </div>
        ))}
        <Btn variant="secondary" size="sm" onClick={addItineraryDay}>+ Add Day</Btn>
      </Panel>

      {/* ─── INCLUSIONS ──────────────────────────────────────────────────── */}
      <Panel title="Inclusions & Requirements" icon="✓">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <FormGroup label="Highlights (one per line)">
            <TextArea
              value={form.highlights}
              onChange={(e) => set('highlights', e.target.value)}
              rows={5}
              style={{ minHeight: 110 }}
              placeholder="Daily group meditation&#10;Private monastery visits&#10;Sunrise on the Annapurna range"
            />
          </FormGroup>
          <FormGroup label="Requirements">
            <TextArea
              value={form.requirements}
              onChange={(e) => set('requirements', e.target.value)}
              rows={5}
              style={{ minHeight: 110 }}
              placeholder="Moderate fitness · ability to walk 5km/day · valid passport with 6 months remaining"
            />
          </FormGroup>
          <FormGroup label="What's Included (one per line)">
            <TextArea
              value={form.included}
              onChange={(e) => set('included', e.target.value)}
              rows={6}
              style={{ minHeight: 130 }}
              placeholder="All accommodation&#10;Daily breakfast&#10;Local transport&#10;Guided meditation sessions"
            />
          </FormGroup>
          <FormGroup label="What's NOT Included (one per line)">
            <TextArea
              value={form.notIncluded}
              onChange={(e) => set('notIncluded', e.target.value)}
              rows={6}
              style={{ minHeight: 130 }}
              placeholder="International flights&#10;Travel insurance&#10;Personal expenses"
            />
          </FormGroup>
        </div>
      </Panel>

      {/* ─── METADATA & POLICY ────────────────────────────────────────────── */}
      <Panel title="Metadata & Cancellation Policy" icon="⚙️">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <FormGroup label="Difficulty Level">
            <Select value={form.difficultyLevel} onChange={(e) => set('difficultyLevel', e.target.value)}>
              <option value="EASY">Easy</option>
              <option value="MODERATE">Moderate</option>
              <option value="CHALLENGING">Challenging</option>
            </Select>
          </FormGroup>
          <FormGroup label="Languages Spoken (comma-separated)">
            <Input value={form.languages} onChange={(e) => set('languages', e.target.value)} placeholder="English, Spanish, Nepali" />
          </FormGroup>
          <FormGroup label="Balance Due (days before departure)">
            <Input type="number" min={0} value={form.balanceDueDaysBefore} onChange={(e) => set('balanceDueDaysBefore', e.target.value)} />
          </FormGroup>
          <FormGroup label="Full Refund (days before)">
            <Input type="number" min={0} value={form.fullRefundDaysBefore} onChange={(e) => set('fullRefundDaysBefore', e.target.value)} />
          </FormGroup>
          <FormGroup label="50% Refund (days before)">
            <Input type="number" min={0} value={form.halfRefundDaysBefore} onChange={(e) => set('halfRefundDaysBefore', e.target.value)} />
          </FormGroup>
        </div>
        <p style={{ fontFamily: font, fontSize: 11, color: C.warmGray, marginTop: 12 }}>
          Default policy: full refund 90+ days before departure, 50% refund 60–89 days before, no refund within 60 days.
        </p>
      </Panel>

      {/* ─── PUBLISH ──────────────────────────────────────────────────────── */}
      <Panel title="Publish" icon="🚀">
        <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={form.isPublished}
            onChange={(e) => set('isPublished', e.target.checked)}
            style={{ width: 18, height: 18, accentColor: C.gold }}
          />
          <span style={{ fontFamily: font, fontSize: 14, color: C.charcoal }}>
            Publish this tour — make it visible to seekers and bookable
          </span>
        </label>
        <p style={{ fontFamily: font, fontSize: 11, color: C.warmGray, marginTop: 8 }}>
          You can save as draft and publish later. Tours need at least one departure and one room type before they can be published.
        </p>
      </Panel>

      {/* ─── ACTIONS ──────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '24px 0', borderTop: '1px solid rgba(232,184,75,0.12)',
      }}>
        <Btn variant="secondary" onClick={() => router.push('/guide/dashboard/tours')}>← Cancel</Btn>
        <Btn
          variant="primary"
          onClick={save}
          style={saving ? { opacity: 0.6, pointerEvents: 'none' } : {}}
        >
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Tour'}
        </Btn>
      </div>
    </div>
  );
}
