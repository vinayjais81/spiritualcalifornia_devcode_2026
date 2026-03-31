'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { C, font, formatPrice, PageHeader, Panel, Btn, EmptyState, EventDateBox, Modal, FormGroup, Input, Select } from '@/components/guide/dashboard-ui';
import { RichTextEditor } from '@/components/guide/RichTextEditor';

interface TicketTier { price: number | string; capacity: number; sold: number; }
interface GuideEvent {
  id: string; title: string; description: string | null; type: string;
  startTime: string; endTime: string; timezone: string;
  location: string | null; coverImageUrl: string | null;
  isPublished: boolean; isCancelled: boolean;
  ticketTiers: TicketTier[];
}

const emptyForm = {
  title: '', type: 'IN_PERSON', startTime: '', endTime: '',
  location: '', description: '', ticketPrice: '', coverImageUrl: '',
};

// Convert ISO datetime to datetime-local input format
function toLocalInput(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EventsPage() {
  const [events, setEvents] = useState<GuideEvent[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const load = () => api.get('/events/mine').then(r => setEvents(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setImagePreview(null);
    setShowModal(true);
  };

  const openEdit = (ev: GuideEvent) => {
    setEditingId(ev.id);
    const tier = ev.ticketTiers?.[0];
    setForm({
      title: ev.title,
      type: ev.type,
      startTime: toLocalInput(ev.startTime),
      endTime: toLocalInput(ev.endTime),
      location: ev.location || '',
      description: ev.description || '',
      ticketPrice: tier ? String(typeof tier.price === 'string' ? parseFloat(tier.price) : tier.price) : '',
      coverImageUrl: ev.coverImageUrl || '',
    });
    setImagePreview(ev.coverImageUrl || null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm({ ...emptyForm });
    setImagePreview(null);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    toast.info('Image selected. S3 upload will be wired when AWS keys are configured.');
  };

  const save = async () => {
    try {
      if (editingId) {
        // Update existing event
        await api.put(`/events/${editingId}`, {
          title: form.title || undefined,
          type: form.type || undefined,
          startTime: form.startTime ? new Date(form.startTime).toISOString() : undefined,
          endTime: form.endTime ? new Date(form.endTime).toISOString() : undefined,
          location: form.location || undefined,
          description: form.description || undefined,
          coverImageUrl: form.coverImageUrl || undefined,
        });
        toast.success('Event updated');
      } else {
        // Create new event
        await api.post('/events', {
          title: form.title,
          type: form.type,
          startTime: form.startTime,
          endTime: form.endTime || undefined,
          location: form.location || undefined,
          description: form.description || undefined,
          ticketPrice: form.ticketPrice ? parseFloat(form.ticketPrice) : 0,
        });
        toast.success('Event created');
      }
      closeModal();
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || `Failed to ${editingId ? 'update' : 'create'} event`);
    }
  };

  const remove = async (id: string) => {
    try {
      await api.delete(`/events/${id}`);
      setEvents(e => e.filter(x => x.id !== id));
      toast.success('Event deleted');
    } catch { toast.error('Failed to delete'); }
  };

  return (
    <div>
      <PageHeader title="Events" subtitle="Create and manage public events that appear on your profile and the events directory.">
        <Btn onClick={openCreate}>+ Add Event</Btn>
      </PageHeader>
      <Panel title="Your Events" icon="📅">
        {events.length === 0 ? <EmptyState message="No events yet." /> : events.map(ev => (
          <div key={ev.id} style={{ display: 'grid', gridTemplateColumns: '80px 1fr auto 36px', gap: '14px', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid rgba(232,184,75,0.1)' }}>
            <EventDateBox startTime={ev.startTime} />
            <div>
              <div style={{ fontFamily: font, fontSize: '14px', fontWeight: 500, color: C.charcoal }}>{ev.title}</div>
              <div style={{ fontFamily: font, fontSize: '12px', color: C.warmGray, marginTop: '2px' }}>
                {ev.location || 'Location TBD'} · {ev.ticketTiers?.[0] ? `${formatPrice(ev.ticketTiers[0].price)}/person` : 'Free'}
                {ev.isCancelled && <span style={{ color: C.red, marginLeft: '8px' }}>· Cancelled</span>}
              </div>
            </div>
            <Btn variant="secondary" size="sm" onClick={() => openEdit(ev)}>Edit</Btn>
            <button onClick={() => remove(ev.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.warmGray, fontSize: '18px' }}>×</button>
          </div>
        ))}
      </Panel>

      {/* Create / Edit Modal */}
      <Modal open={showModal} onClose={closeModal} title={editingId ? 'Edit Event' : 'Add New Event'}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <FormGroup label="Event Title" full>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Spring Equinox Meditation Retreat" />
          </FormGroup>
          <FormGroup label="Date & Start Time">
            <Input type="datetime-local" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
          </FormGroup>
          <FormGroup label="End Time">
            <Input type="datetime-local" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
          </FormGroup>
          {!editingId && (
            <FormGroup label="Price (USD, 0 for free)">
              <Input type="number" value={form.ticketPrice} onChange={e => setForm(f => ({ ...f, ticketPrice: e.target.value }))} placeholder="45" min="0" />
            </FormGroup>
          )}
          <FormGroup label="Event Type">
            <Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="IN_PERSON">In-Person</option>
              <option value="VIRTUAL">Virtual</option>
              <option value="SOUL_TRAVEL">Soul Travel</option>
            </Select>
          </FormGroup>
          <FormGroup label="Location" full>
            <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. The Healing Space, 1234 Sunset Blvd, Los Angeles" />
          </FormGroup>

          {/* Rich Text Description */}
          <FormGroup label="Description" full>
            <RichTextEditor
              value={form.description}
              onChange={(html) => setForm(f => ({ ...f, description: html }))}
              placeholder="Describe your event..."
            />
          </FormGroup>

          {/* Event Image Upload */}
          <FormGroup label="Event Image" full>
            {imagePreview && imagePreview.startsWith('data:') && (
              <div style={{ marginBottom: '10px', borderRadius: '8px', overflow: 'hidden', maxHeight: '160px' }}>
                <img src={imagePreview} alt="Preview" style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: '8px' }} />
              </div>
            )}
            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', fontFamily: font, fontSize: '12px', fontWeight: 500,
              background: C.goldPale, border: '1.5px solid rgba(232,184,75,0.5)',
              borderRadius: '6px', cursor: 'pointer', color: C.charcoal,
              transition: 'all 0.2s',
            }}>
              📁 {imagePreview ? 'Change Image' : 'Upload Image'}
              <input type="file" accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} />
            </label>
          </FormGroup>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
          <Btn variant="secondary" onClick={closeModal}>Cancel</Btn>
          <Btn onClick={save}>{editingId ? 'Save Changes' : 'Create Event'}</Btn>
        </div>
      </Modal>
    </div>
  );
}
