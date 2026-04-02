'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  C, font, serif, PageHeader, Panel, Btn, Modal, FormGroup, Input, EmptyState,
} from '@/components/guide/dashboard-ui';

interface CalendlyEvent {
  uri: string;
  name: string;
  startTime: string;
  endTime: string;
  status: string;
  inviteesCounter: { total: number; active: number };
}

export default function CalendarPage() {
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [newLink, setNewLink] = useState('');
  const [saving, setSaving] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendlyEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  const loadProfile = useCallback(() => {
    api.get('/guides/me')
      .then(r => setProfile(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadEvents = useCallback(() => {
    setEventsLoading(true);
    api.get('/calendly/events')
      .then(r => setUpcomingEvents(r.data || []))
      .catch(() => {}) // Silently fail if Calendly not connected via OAuth
      .finally(() => setEventsLoading(false));
  }, []);

  useEffect(() => {
    loadProfile();

    // Check for OAuth callback result
    const calendlyResult = searchParams.get('calendly');
    if (calendlyResult === 'connected') {
      toast.success('Calendly connected successfully!');
    } else if (calendlyResult === 'error') {
      toast.error('Failed to connect Calendly. Please try again.');
    }
  }, [loadProfile, searchParams]);

  useEffect(() => {
    if (profile?.calendlyConnected) {
      loadEvents();
    }
  }, [profile?.calendlyConnected, loadEvents]);

  const connected = profile?.calendlyConnected || !!profile?.calendarLink;
  const oauthConnected = profile?.calendlyConnected && !!profile?.calendlyUserUri;
  const calendarLink = profile?.calendarLink || '';

  // Connect via OAuth (full API access)
  const handleOAuthConnect = async () => {
    try {
      const res = await api.get('/auth/calendly/auth-url?redirectTo=/guide/dashboard/calendar');
      window.location.href = res.data.url;
    } catch {
      toast.error('Failed to start Calendly connection');
    }
  };

  // Connect via manual link (simple embed only)
  const handleSaveLink = async () => {
    if (!newLink.trim()) {
      toast.error('Please enter a Calendly link');
      return;
    }
    if (!newLink.includes('calendly.com')) {
      toast.error('Please enter a valid Calendly URL');
      return;
    }
    setSaving(true);
    try {
      await api.put('/guides/onboarding/calendar', {
        calendarType: 'Calendly',
        calendarLink: newLink.trim(),
      });
      toast.success('Calendly link saved');
      setShowLinkModal(false);
      setNewLink('');
      loadProfile();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Calendly? Seekers will no longer be able to book through your profile.')) return;
    setSaving(true);
    try {
      await api.post('/calendly/disconnect');
      toast.success('Calendly disconnected');
      setUpcomingEvents([]);
      loadProfile();
    } catch {
      toast.error('Failed to disconnect');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ fontFamily: font, fontSize: '13px', color: C.warmGray, padding: '40px' }}>Loading...</div>;
  }

  return (
    <div>
      <PageHeader title="Calendar & Booking" subtitle="Connect Calendly so seekers can book sessions directly." />

      {/* Connection Status */}
      <Panel title="Calendly Integration" icon="🗓️">
        <div style={{
          background: C.offWhite, border: '1.5px solid rgba(232,184,75,0.3)',
          borderRadius: '10px', padding: '28px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>
            {connected ? '✅' : '📆'}
          </div>
          <div style={{ fontFamily: serif, fontSize: '20px', color: C.charcoal, marginBottom: '8px' }}>
            {connected ? 'Calendly Connected' : 'Connect Your Calendly Account'}
          </div>
          <p style={{
            fontFamily: font, fontSize: '13px', color: C.warmGray, lineHeight: 1.6,
            marginBottom: '18px', maxWidth: '480px', margin: '0 auto 18px',
          }}>
            {connected
              ? 'Seekers can view your availability and book sessions directly from your profile.'
              : 'Connect Calendly to let seekers schedule sessions with you. We recommend using OAuth for the best experience.'}
          </p>

          {connected ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              {/* Connection type badge */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '6px 16px', borderRadius: '20px',
                  background: oauthConnected ? '#E8F5E9' : '#FFF3E0',
                  border: oauthConnected ? '1px solid #A5D6A7' : '1px solid #FFCC80',
                  fontFamily: font, fontSize: '12px',
                  color: oauthConnected ? '#2E7D32' : '#E65100',
                }}>
                  {oauthConnected ? '🔗 OAuth Connected' : '🔗 Manual Link'}
                </span>
                {calendarLink && (
                  <span style={{
                    padding: '6px 16px', borderRadius: '20px',
                    background: C.offWhite, border: '1px solid rgba(232,184,75,0.3)',
                    fontFamily: font, fontSize: '11px', color: C.warmGray,
                    maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {calendarLink}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {!oauthConnected && (
                  <Btn variant="primary" size="sm" onClick={handleOAuthConnect}>
                    Upgrade to OAuth
                  </Btn>
                )}
                <Btn variant="secondary" size="sm" onClick={() => { setNewLink(calendarLink); setShowLinkModal(true); }}>
                  Change Link
                </Btn>
                <Btn variant="danger" size="sm" onClick={handleDisconnect} style={saving ? { opacity: 0.6 } : {}}>
                  {saving ? 'Disconnecting...' : 'Disconnect'}
                </Btn>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Btn onClick={handleOAuthConnect}>
                Connect with Calendly
              </Btn>
              <Btn variant="secondary" onClick={() => { setNewLink(''); setShowLinkModal(true); }}>
                Enter Link Manually
              </Btn>
            </div>
          )}
        </div>

        {/* How it works */}
        <div style={{
          marginTop: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px',
        }}>
          <div style={{
            fontFamily: font, fontSize: '12px', color: C.warmGray, lineHeight: 1.6,
            padding: '16px', background: C.offWhite, borderRadius: '8px', borderLeft: `3px solid ${C.gold}`,
          }}>
            <strong style={{ color: C.charcoal }}>OAuth (Recommended):</strong> Full integration — we can read your availability, show upcoming events, and sync bookings automatically.
          </div>
          <div style={{
            fontFamily: font, fontSize: '12px', color: C.warmGray, lineHeight: 1.6,
            padding: '16px', background: C.offWhite, borderRadius: '8px', borderLeft: `3px solid rgba(138,130,120,0.3)`,
          }}>
            <strong style={{ color: C.charcoal }}>Manual Link:</strong> We embed your Calendly scheduling page on your profile. Simpler setup, but no event sync.
          </div>
        </div>
      </Panel>

      {/* Upcoming Events (OAuth only) */}
      {oauthConnected && (
        <Panel title="Upcoming Sessions" icon="📋">
          {eventsLoading ? (
            <p style={{ fontFamily: font, fontSize: '13px', color: C.warmGray }}>Loading events...</p>
          ) : upcomingEvents.length === 0 ? (
            <EmptyState message="No upcoming sessions. When seekers book through your Calendly, they'll appear here." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {upcomingEvents.map((ev, i) => {
                const start = new Date(ev.startTime);
                const end = new Date(ev.endTime);
                const timeStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                const endTimeStr = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                const dateStr = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

                return (
                  <div key={ev.uri || i} style={{
                    display: 'grid', gridTemplateColumns: '140px 1fr 100px',
                    gap: '16px', alignItems: 'center', padding: '14px 0',
                    borderBottom: i < upcomingEvents.length - 1 ? '1px solid rgba(232,184,75,0.1)' : 'none',
                  }}>
                    <div>
                      <div style={{ fontFamily: font, fontSize: '12px', fontWeight: 500, color: C.charcoal }}>{dateStr}</div>
                      <div style={{ fontFamily: font, fontSize: '11px', color: C.warmGray }}>{timeStr} – {endTimeStr}</div>
                    </div>
                    <div>
                      <div style={{ fontFamily: font, fontSize: '13px', fontWeight: 500, color: C.charcoal }}>{ev.name}</div>
                      <div style={{ fontFamily: font, fontSize: '11px', color: C.warmGray }}>
                        {ev.inviteesCounter.active} attendee{ev.inviteesCounter.active !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: '20px', fontFamily: font, fontSize: '11px',
                        background: ev.status === 'active' ? '#E8F5E9' : '#FFF3E0',
                        color: ev.status === 'active' ? '#2E7D32' : '#E65100',
                        border: ev.status === 'active' ? '1px solid #A5D6A7' : '1px solid #FFCC80',
                      }}>
                        {ev.status === 'active' ? 'Confirmed' : 'Canceled'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      )}

      {/* Calendly Widget Preview */}
      {connected && calendarLink && (
        <Panel title="Booking Preview" icon="👁️">
          <p style={{ fontFamily: font, fontSize: '12px', color: C.warmGray, marginBottom: '16px' }}>
            This is how your Calendly scheduling page appears to seekers on your profile:
          </p>
          <div style={{
            border: '1.5px solid rgba(232,184,75,0.3)', borderRadius: '10px',
            overflow: 'hidden', background: C.white,
          }}>
            <iframe
              src={calendarLink}
              style={{ width: '100%', height: '650px', border: 'none' }}
              title="Calendly Scheduling"
            />
          </div>
        </Panel>
      )}

      {/* Manual Link Modal */}
      <Modal open={showLinkModal} onClose={() => setShowLinkModal(false)} title={connected ? 'Change Calendly Link' : 'Enter Calendly Link'} maxWidth="500px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <FormGroup label="Calendly Scheduling URL">
            <Input
              value={newLink}
              onChange={e => setNewLink(e.target.value)}
              placeholder="https://calendly.com/your-name/30min"
            />
          </FormGroup>
          <div style={{
            fontFamily: font, fontSize: '12px', color: C.warmGray, lineHeight: 1.5,
            padding: '10px 14px', background: C.offWhite, borderRadius: '6px',
          }}>
            Find your link in <strong>Calendly Dashboard → Event Types</strong>. Copy the link for the event type you want seekers to book.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
          <Btn variant="secondary" onClick={() => setShowLinkModal(false)}>Cancel</Btn>
          <Btn onClick={handleSaveLink} style={saving ? { opacity: 0.6 } : {}}>
            {saving ? 'Saving...' : (connected ? 'Update Link' : 'Save Link')}
          </Btn>
        </div>
      </Modal>
    </div>
  );
}
