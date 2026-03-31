'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { C, font, serif, PageHeader, Panel, Btn, Modal, FormGroup, Input } from '@/components/guide/dashboard-ui';

export default function CalendarPage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [newLink, setNewLink] = useState('');
  const [saving, setSaving] = useState(false);

  const loadProfile = () => {
    api.get('/guides/me')
      .then(r => setProfile(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadProfile(); }, []);

  const connected = profile?.calendlyConnected || !!profile?.calendarLink;
  const calendarLink = profile?.calendarLink || '';

  const handleChangeLink = async () => {
    if (!newLink.trim()) {
      toast.error('Please enter a Calendly link');
      return;
    }
    setSaving(true);
    try {
      await api.put('/guides/onboarding/calendar', {
        calendarType: 'Calendly',
        calendarLink: newLink.trim(),
      });
      toast.success('Calendly link updated');
      setShowChangeModal(false);
      setNewLink('');
      loadProfile();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Calendly? Seekers will no longer be able to book through your profile.')) {
      return;
    }
    setSaving(true);
    try {
      await api.put('/guides/onboarding/calendar', {
        calendarType: null,
        calendarLink: null,
      });
      // Also clear calendlyConnected flag via profile update
      await api.put('/guides/onboarding/profile', {});
      toast.success('Calendly disconnected');
      loadProfile();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to disconnect');
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = () => {
    setNewLink('');
    setShowChangeModal(true);
  };

  if (loading) {
    return <div style={{ fontFamily: font, fontSize: '13px', color: C.warmGray, padding: '40px' }}>Loading...</div>;
  }

  return (
    <div>
      <PageHeader title="Calendar & Booking" subtitle="Manage your available times for sessions." />
      <Panel title="Calendly Integration" icon="🗓️">
        <div style={{ background: C.offWhite, border: '1.5px solid rgba(232,184,75,0.3)', borderRadius: '10px', padding: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📆</div>
          <div style={{ fontFamily: serif, fontSize: '20px', color: C.charcoal, marginBottom: '8px' }}>
            {connected ? 'Calendly Connected' : 'Connect Your Calendly Account'}
          </div>
          <p style={{ fontFamily: font, fontSize: '13px', color: C.warmGray, lineHeight: 1.6, marginBottom: '18px' }}>
            {connected
              ? 'Your Calendly is connected. Seekers can view your availability and book directly from your public profile.'
              : 'Spiritual California uses Calendly to manage bookings. Enter your Calendly scheduling link to get started.'}
          </p>
          {connected ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 16px', borderRadius: '20px', background: '#E8F5E9', border: '1px solid #A5D6A7', fontFamily: font, fontSize: '12px', color: '#2E7D32' }}>
                ✅ Connected: {calendarLink}
              </span>
              <div style={{ display: 'flex', gap: '12px' }}>
                <Btn variant="secondary" size="sm" onClick={() => { setNewLink(calendarLink); setShowChangeModal(true); }}>
                  Change Calendly Link
                </Btn>
                <Btn variant="danger" size="sm" onClick={handleDisconnect} style={saving ? { opacity: 0.6 } : {}}>
                  {saving ? 'Disconnecting...' : 'Disconnect'}
                </Btn>
              </div>
            </div>
          ) : (
            <Btn onClick={handleConnect}>Connect Calendly</Btn>
          )}
        </div>
        <div style={{ marginTop: '24px', fontFamily: font, fontSize: '13px', color: C.warmGray, lineHeight: 1.6, padding: '16px', background: C.offWhite, borderRadius: '8px', borderLeft: `3px solid ${C.gold}` }}>
          <strong style={{ color: C.charcoal }}>How it works:</strong> Once connected, your Calendly scheduling page is embedded on your public profile. Seekers can view your availability and book sessions without leaving Spiritual California.
        </div>
      </Panel>

      {/* Change / Connect Calendly Link Modal */}
      <Modal open={showChangeModal} onClose={() => setShowChangeModal(false)} title={connected ? 'Change Calendly Link' : 'Connect Calendly'} maxWidth="500px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <FormGroup label="Calendly Scheduling URL">
            <Input
              value={newLink}
              onChange={e => setNewLink(e.target.value)}
              placeholder="https://calendly.com/your-name/30min"
            />
          </FormGroup>
          <div style={{ fontFamily: font, fontSize: '12px', color: C.warmGray, lineHeight: 1.5, padding: '10px 14px', background: C.offWhite, borderRadius: '6px' }}>
            You can find your scheduling link in your Calendly dashboard under <strong>Event Types</strong>. Copy the link for the event type you want seekers to book.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
          <Btn variant="secondary" onClick={() => setShowChangeModal(false)}>Cancel</Btn>
          <Btn onClick={handleChangeLink} style={saving ? { opacity: 0.6 } : {}}>
            {saving ? 'Saving...' : (connected ? 'Update Link' : 'Connect')}
          </Btn>
        </div>
      </Modal>
    </div>
  );
}
