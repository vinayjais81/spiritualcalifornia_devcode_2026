'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { C, font, formatPrice, PageHeader, Panel, Btn, EmptyState, ServiceTypeBadge, Modal, FormGroup, Input, TextArea, Select } from '@/components/guide/dashboard-ui';

interface Service { id: string; name: string; description: string | null; type: string; price: number | string; durationMin: number; }

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', type: 'HYBRID', price: '', durationMin: '60' });

  const load = () => api.get('/services/mine').then(r => setServices(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const create = async () => {
    try {
      await api.post('/services', { name: form.name, description: form.description || undefined, type: form.type, price: parseFloat(form.price), durationMin: parseInt(form.durationMin) });
      toast.success('Service created'); setShowModal(false); setForm({ name: '', description: '', type: 'HYBRID', price: '', durationMin: '60' }); load();
    } catch { toast.error('Failed to create service'); }
  };

  const remove = async (id: string) => {
    try { await api.delete(`/services/${id}`); setServices(s => s.filter(x => x.id !== id)); toast.success('Service deleted'); } catch { toast.error('Failed to delete'); }
  };

  return (
    <div>
      <PageHeader title="Services & Prices" subtitle="Define what you offer, how much it costs, and availability type.">
        <Btn onClick={() => setShowModal(true)}>+ Add Service</Btn>
      </PageHeader>
      <Panel title="Your Services" icon="✨">
        {services.length === 0 ? <EmptyState message="No services yet. Add your first service offering." /> : services.map(s => (
          <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px 100px 36px', gap: '10px', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(232,184,75,0.1)' }}>
            <div>
              <div style={{ fontFamily: font, fontSize: '14px', fontWeight: 500, color: C.charcoal }}>{s.name}</div>
              {s.description && <div style={{ fontFamily: font, fontSize: '11px', color: C.warmGray, marginTop: '2px' }}>{s.description}</div>}
            </div>
            <div><ServiceTypeBadge type={s.type} /></div>
            <div style={{ fontFamily: font, fontSize: '13px', color: C.warmGray }}>{s.durationMin} min</div>
            <div style={{ fontFamily: font, fontSize: '14px', fontWeight: 500, color: C.charcoal }}>{formatPrice(s.price)}</div>
            <button onClick={() => remove(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.warmGray, fontSize: '18px' }}>×</button>
          </div>
        ))}
      </Panel>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add New Service">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <FormGroup label="Service Name" full><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. 1:1 Reiki Session" /></FormGroup>
          <FormGroup label="Description" full><TextArea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe what this service includes..." /></FormGroup>
          <FormGroup label="Duration"><Select value={form.durationMin} onChange={e => setForm(f => ({ ...f, durationMin: e.target.value }))}><option value="30">30 min</option><option value="45">45 min</option><option value="60">60 min</option><option value="90">90 min</option><option value="120">2 hours</option></Select></FormGroup>
          <FormGroup label="Price (USD)"><Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="150" min="0" /></FormGroup>
          <FormGroup label="Availability" full><Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}><option value="VIRTUAL">Online Only</option><option value="IN_PERSON">In-Person Only</option><option value="HYBRID">Online & In-Person</option></Select></FormGroup>
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
          <Btn variant="secondary" onClick={() => setShowModal(false)}>Cancel</Btn>
          <Btn onClick={create}>Add Service</Btn>
        </div>
      </Modal>
    </div>
  );
}
