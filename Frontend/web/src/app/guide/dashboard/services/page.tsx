'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { parsePaymentsGateError } from '@/lib/payments-gate';
import { toast } from 'sonner';
import {
  C, font, formatPrice, PageHeader, Panel, Btn, EmptyState,
  ServiceTypeBadge, Modal, FormGroup, Input, TextArea, Select,
} from '@/components/guide/dashboard-ui';

interface Service {
  id: string;
  name: string;
  description: string | null;
  type: string;
  price: number | string;
  durationMin: number;
  isActive: boolean;
}

const EMPTY_FORM = { name: '', description: '', type: 'HYBRID', price: '', durationMin: '60' };

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get('/services/mine')
      .then(r => setServices(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (s: Service) => {
    setEditingId(s.id);
    setForm({
      name: s.name,
      description: s.description || '',
      type: s.type,
      price: String(typeof s.price === 'string' ? parseFloat(s.price) : s.price),
      durationMin: String(s.durationMin),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Service name is required'); return; }
    if (!form.price || parseFloat(form.price) < 0) { toast.error('Please enter a valid price'); return; }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      type: form.type,
      price: parseFloat(form.price),
      durationMin: parseInt(form.durationMin),
    };

    try {
      if (editingId) {
        await api.put(`/services/${editingId}`, payload);
        toast.success('Service updated');
      } else {
        await api.post('/services', payload);
        toast.success('Service created — saved as draft. Publish from your service list once payments are set up.');
      }
      setShowModal(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      load();
    } catch (err: unknown) {
      // The Payments Publish Gate (paid offering + no Stripe Connect)
      // surfaces as a structured 403; the global axios interceptor opens
      // the PaymentsGateModal automatically. Suppress the generic toast
      // in that case so the user only sees the modal.
      if (parsePaymentsGateError(err)) {
        // For create: the server still saves the service as a draft, so
        // refresh the list and clear the form like a happy-path save.
        if (!editingId) {
          setShowModal(false);
          setForm(EMPTY_FORM);
          load();
        }
      } else {
        toast.error(editingId ? 'Failed to update service' : 'Failed to create service');
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/services/${id}`);
      setServices(s => s.filter(x => x.id !== id));
      toast.success('Service deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  if (loading) {
    return <div style={{ fontFamily: font, fontSize: '13px', color: C.warmGray, padding: '40px' }}>Loading...</div>;
  }

  return (
    <div>
      <PageHeader title="Services & Prices" subtitle="Define what you offer, pricing, and session format.">
        <Btn onClick={openCreate}>+ Add Service</Btn>
      </PageHeader>

      <Panel title="Your Services" icon="✨">
        {services.length === 0 ? (
          <EmptyState message="No services yet. Add your first service offering to start accepting bookings." />
        ) : (
          <div>
            {/* Header row */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 100px 80px 90px 70px',
              gap: '10px', padding: '0 0 10px', borderBottom: '1px solid rgba(232,184,75,0.15)',
            }}>
              {['Service', 'Format', 'Duration', 'Price', ''].map(h => (
                <div key={h} style={{
                  fontFamily: font, fontSize: '10px', letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: C.warmGray, fontWeight: 500,
                }}>
                  {h}
                </div>
              ))}
            </div>

            {/* Service rows */}
            {services.map(s => (
              <div key={s.id} style={{
                display: 'grid', gridTemplateColumns: '1fr 100px 80px 90px 70px',
                gap: '10px', alignItems: 'center', padding: '14px 0',
                borderBottom: '1px solid rgba(232,184,75,0.08)',
              }}>
                <div>
                  <div style={{ fontFamily: font, fontSize: '14px', fontWeight: 500, color: C.charcoal }}>
                    {s.name}
                  </div>
                  {s.description && (
                    <div style={{
                      fontFamily: font, fontSize: '11px', color: C.warmGray, marginTop: '2px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px',
                    }}>
                      {s.description}
                    </div>
                  )}
                </div>
                <div><ServiceTypeBadge type={s.type} /></div>
                <div style={{ fontFamily: font, fontSize: '13px', color: C.warmGray }}>{s.durationMin} min</div>
                <div style={{ fontFamily: font, fontSize: '14px', fontWeight: 500, color: C.charcoal }}>
                  {formatPrice(s.price)}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => openEdit(s)}
                    title="Edit"
                    style={{
                      background: 'none', border: '1px solid rgba(232,184,75,0.3)',
                      borderRadius: '4px', padding: '4px 8px', cursor: 'pointer',
                      fontFamily: font, fontSize: '11px', color: C.warmGray,
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => remove(s.id, s.name)}
                    title="Delete"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: C.warmGray, fontSize: '16px', padding: '4px',
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Info */}
      <div style={{
        fontFamily: font, fontSize: '13px', color: C.warmGray, lineHeight: 1.6,
        padding: '16px', background: C.offWhite, borderRadius: '8px', borderLeft: `3px solid ${C.gold}`,
      }}>
        <strong style={{ color: C.charcoal }}>Tip:</strong> Create your services first, then set your
        <a href="/guide/dashboard/availability" style={{ color: C.gold, marginLeft: '4px' }}>weekly availability</a> and
        <a href="/guide/dashboard/calendar" style={{ color: C.gold, marginLeft: '4px' }}>connect Calendly</a> to start accepting bookings.
      </div>

      {/* Create / Edit Modal */}
      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); setEditingId(null); }}
        title={editingId ? 'Edit Service' : 'Add New Service'}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <FormGroup label="Service Name" full>
            <Input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. 1:1 Reiki Session"
              maxLength={120}
            />
          </FormGroup>
          <FormGroup label="Description" full>
            <TextArea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Describe what this service includes..."
              maxLength={1000}
            />
          </FormGroup>
          <FormGroup label="Duration">
            <Select value={form.durationMin} onChange={e => setForm(f => ({ ...f, durationMin: e.target.value }))}>
              <option value="30">30 min</option>
              <option value="45">45 min</option>
              <option value="60">60 min</option>
              <option value="90">90 min</option>
              <option value="120">2 hours</option>
            </Select>
          </FormGroup>
          <FormGroup label="Price (USD)">
            <Input
              type="number"
              value={form.price}
              onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
              placeholder="150"
              min="0"
              step="0.01"
            />
          </FormGroup>
          <FormGroup label="Session Format" full>
            <Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="VIRTUAL">Online Only</option>
              <option value="IN_PERSON">In-Person Only</option>
              <option value="HYBRID">Online & In-Person</option>
            </Select>
          </FormGroup>
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
          <Btn variant="secondary" onClick={() => { setShowModal(false); setEditingId(null); }}>Cancel</Btn>
          <Btn onClick={handleSave} style={saving ? { opacity: 0.6 } : {}}>
            {saving ? 'Saving...' : (editingId ? 'Update Service' : 'Add Service')}
          </Btn>
        </div>
      </Modal>
    </div>
  );
}
