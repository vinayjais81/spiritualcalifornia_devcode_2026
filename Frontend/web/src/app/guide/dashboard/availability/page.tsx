'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  C, font, serif, PageHeader, Panel, Btn, EmptyState,
} from '@/components/guide/dashboard-ui';

const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface CalendlyEventType {
  name: string;
  slug: string;
  duration: number;
  schedulingUrl: string;
  active: boolean;
  kind: string;
}

interface ScheduledEvent {
  name: string;
  startTime: string;
  endTime: string;
  status: string;
  inviteesCounter: { total: number; active: number };
}

export default function AvailabilityPage() {
  const [profile, setProfile] = useState<any>(null);
  const [eventTypes, setEventTypes] = useState<CalendlyEventType[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<ScheduledEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const profileRes = await api.get('/guides/me');
        setProfile(profileRes.data);
        const isConnected = profileRes.data?.calendlyConnected && !!profileRes.data?.calendlyUserUri;
        setConnected(isConnected);

        if (isConnected) {
          const [etRes, evRes] = await Promise.all([
            api.get('/calendly/event-types').catch(() => ({ data: [] })),
            api.get('/calendly/events').catch(() => ({ data: [] })),
          ]);
          setEventTypes(etRes.data || []);
          setUpcomingEvents(evRes.data || []);
        }
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return <div style={{ fontFamily: font, fontSize: '13px', color: C.warmGray, padding: '40px' }}>Loading...</div>;
  }

  return (
    <div>
      <PageHeader title="Availability" subtitle="Your availability is managed through Calendly." />

      {/* Not connected */}
      {!connected && (
        <Panel title="Calendly Not Connected" icon="📅">
          <div style={{ textAlign: 'center', padding: '32px' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🗓️</div>
            <p style={{ fontFamily: font, fontSize: '14px', color: C.charcoal, marginBottom: '8px' }}>
              Connect Calendly to manage your availability
            </p>
            <p style={{ fontFamily: font, fontSize: '13px', color: C.warmGray, lineHeight: 1.6, maxWidth: '420px', margin: '0 auto 20px' }}>
              Your availability and booking schedule are managed through Calendly. Connect your account to see your event types and upcoming sessions here.
            </p>
            <Btn onClick={() => window.location.href = '/guide/dashboard/calendar'}>
              Go to Calendar Settings
            </Btn>
          </div>
        </Panel>
      )}

      {/* Connected — Event Types */}
      {connected && (
        <>
          <Panel title="Your Event Types" icon="✨">
            {eventTypes.length === 0 ? (
              <EmptyState message="No event types found in your Calendly account." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {eventTypes.map((et, i) => (
                  <div key={et.slug || i} style={{
                    display: 'grid', gridTemplateColumns: '1fr 100px 100px 120px',
                    gap: '12px', alignItems: 'center', padding: '14px 0',
                    borderBottom: i < eventTypes.length - 1 ? '1px solid rgba(232,184,75,0.08)' : 'none',
                  }}>
                    <div>
                      <div style={{ fontFamily: font, fontSize: '14px', fontWeight: 500, color: C.charcoal }}>{et.name}</div>
                      <div style={{ fontFamily: font, fontSize: '11px', color: C.warmGray, marginTop: '2px' }}>{et.schedulingUrl}</div>
                    </div>
                    <div style={{ fontFamily: font, fontSize: '13px', color: C.charcoal }}>{et.duration} min</div>
                    <span style={{
                      padding: '3px 10px', borderRadius: '20px', fontFamily: font, fontSize: '11px', textAlign: 'center',
                      background: et.active ? '#E8F5E9' : '#F5F5F5',
                      color: et.active ? '#2E7D32' : '#757575',
                      border: et.active ? '1px solid #A5D6A7' : '1px solid #E0E0E0',
                    }}>
                      {et.active ? 'Active' : 'Inactive'}
                    </span>
                    <a href={et.schedulingUrl} target="_blank" rel="noopener noreferrer" style={{
                      fontFamily: font, fontSize: '11px', color: C.gold, textDecoration: 'none',
                    }}>
                      Open in Calendly →
                    </a>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Upcoming Events */}
          <Panel title="Upcoming Sessions" icon="📋">
            {upcomingEvents.length === 0 ? (
              <EmptyState message="No upcoming sessions. When seekers book through Calendly, they'll appear here." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {upcomingEvents.map((ev, i) => {
                  const start = new Date(ev.startTime);
                  const end = new Date(ev.endTime);
                  return (
                    <div key={i} style={{
                      display: 'grid', gridTemplateColumns: '140px 1fr 80px',
                      gap: '16px', alignItems: 'center', padding: '12px 0',
                      borderBottom: i < upcomingEvents.length - 1 ? '1px solid rgba(232,184,75,0.08)' : 'none',
                    }}>
                      <div>
                        <div style={{ fontFamily: font, fontSize: '12px', fontWeight: 500, color: C.charcoal }}>
                          {start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </div>
                        <div style={{ fontFamily: font, fontSize: '11px', color: C.warmGray }}>
                          {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} – {end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </div>
                      </div>
                      <div style={{ fontFamily: font, fontSize: '13px', fontWeight: 500, color: C.charcoal }}>{ev.name}</div>
                      <span style={{
                        padding: '3px 10px', borderRadius: '20px', fontFamily: font, fontSize: '11px', textAlign: 'center',
                        background: ev.status === 'active' ? '#E8F5E9' : '#FFEBEE',
                        color: ev.status === 'active' ? '#2E7D32' : '#C62828',
                        border: ev.status === 'active' ? '1px solid #A5D6A7' : '1px solid #EF9A9A',
                      }}>
                        {ev.status === 'active' ? 'Confirmed' : 'Canceled'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          {/* Manage in Calendly */}
          <div style={{
            padding: '20px', background: C.goldPale, border: '1px solid rgba(232,184,75,0.2)',
            borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontFamily: font, fontSize: '13px', fontWeight: 500, color: C.charcoal, marginBottom: '4px' }}>
                Manage your availability
              </div>
              <p style={{ fontFamily: font, fontSize: '12px', color: C.warmGray, lineHeight: 1.5, margin: 0 }}>
                Set your working hours, buffer times, and date overrides directly in Calendly. Changes are reflected automatically on your booking page.
              </p>
            </div>
            <a href="https://calendly.com/event_types" target="_blank" rel="noopener noreferrer" style={{
              padding: '10px 22px', borderRadius: '6px', fontFamily: font, fontSize: '12px', fontWeight: 500,
              letterSpacing: '0.08em', textTransform: 'uppercase' as const,
              background: C.charcoal, color: C.gold, textDecoration: 'none', whiteSpace: 'nowrap',
            }}>
              Open Calendly
            </a>
          </div>
        </>
      )}
    </div>
  );
}
