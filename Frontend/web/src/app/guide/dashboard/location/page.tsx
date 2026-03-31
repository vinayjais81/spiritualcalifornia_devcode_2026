'use client';

import { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { C, font, PageHeader, Panel, Btn, FormGroup, Input, FormActions } from '@/components/guide/dashboard-ui';

export default function LocationPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    studioName: '',
    streetAddress: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'United States',
  });

  // Load existing data
  useEffect(() => {
    api.get('/guides/me')
      .then((res) => {
        const p = res.data;
        setForm({
          studioName: p.studioName || '',
          streetAddress: p.streetAddress || '',
          city: p.city || '',
          state: p.state || '',
          zipCode: p.zipCode || '',
          country: p.country || 'United States',
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Build full address for map embed
  const fullAddress = useMemo(() => {
    const parts = [form.streetAddress, form.city, form.state, form.zipCode, form.country].filter(Boolean);
    return parts.join(', ');
  }, [form.streetAddress, form.city, form.state, form.zipCode, form.country]);

  // Also compute the `location` summary field (e.g. "Los Angeles, California")
  const locationSummary = useMemo(() => {
    const parts = [form.city, form.state].filter(Boolean);
    return parts.join(', ');
  }, [form.city, form.state]);

  const saveLocation = async () => {
    if (!form.city) {
      toast.error('Please enter at least a city');
      return;
    }

    setSaving(true);
    try {
      await api.put('/guides/onboarding/profile', {
        studioName: form.studioName || undefined,
        streetAddress: form.streetAddress || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        zipCode: form.zipCode || undefined,
        country: form.country || undefined,
        // Also update the summary `location` field used in public profile
        location: locationSummary || undefined,
      });
      toast.success('Location saved');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save location');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ fontFamily: font, fontSize: '13px', color: C.warmGray, padding: '40px' }}>Loading...</div>;
  }

  const hasAddress = form.city || form.streetAddress;

  return (
    <div>
      <PageHeader title="Location" subtitle="Your location helps seekers find practitioners near them." />

      <Panel title="Practice Location" icon="📍">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <FormGroup label="Studio / Practice Name (optional)" full>
            <Input
              value={form.studioName}
              onChange={e => setForm(f => ({ ...f, studioName: e.target.value }))}
              placeholder="The Healing Space"
            />
          </FormGroup>
          <FormGroup label="Street Address" full>
            <Input
              value={form.streetAddress}
              onChange={e => setForm(f => ({ ...f, streetAddress: e.target.value }))}
              placeholder="1234 Sunset Blvd"
            />
          </FormGroup>
          <FormGroup label="City">
            <Input
              value={form.city}
              onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
              placeholder="Los Angeles"
            />
          </FormGroup>
          <FormGroup label="State">
            <Input
              value={form.state}
              onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
              placeholder="California"
            />
          </FormGroup>
          <FormGroup label="ZIP Code">
            <Input
              value={form.zipCode}
              onChange={e => setForm(f => ({ ...f, zipCode: e.target.value }))}
              placeholder="90028"
            />
          </FormGroup>
          <FormGroup label="Country">
            <Input
              value={form.country}
              onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
              placeholder="United States"
            />
          </FormGroup>
        </div>

        {/* Map Preview */}
        <div style={{
          height: '280px', background: C.offWhite,
          border: '1.5px solid rgba(232,184,75,0.3)',
          borderRadius: '10px', overflow: 'hidden',
          marginTop: '20px', position: 'relative',
        }}>
          {hasAddress ? (
            <iframe
              width="100%"
              height="100%"
              style={{ border: 'none' }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://www.google.com/maps?q=${encodeURIComponent(fullAddress)}&output=embed`}
              title="Practice Location Map"
            />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: '8px',
              color: C.warmGray, fontFamily: font, fontSize: '13px',
            }}>
              <div style={{ fontSize: '32px' }}>🗺️</div>
              <div>Map preview will appear here after entering your address.</div>
              <div style={{ fontSize: '11px', color: C.warmGray }}>Powered by Google Maps</div>
            </div>
          )}
        </div>
      </Panel>

      <FormActions>
        <Btn onClick={saveLocation} style={saving ? { opacity: 0.6 } : {}}>
          {saving ? 'Saving...' : 'Save Location'}
        </Btn>
      </FormActions>
    </div>
  );
}
