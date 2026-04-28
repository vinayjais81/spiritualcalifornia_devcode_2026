'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { C, font, PageHeader, Panel, StatCard } from '@/components/guide/dashboard-ui';
import { NeedsAttentionPanel } from '@/components/seeker/NeedsAttentionPanel';
import { ProfileCompletenessWidget } from '@/components/seeker/ProfileCompletenessWidget';

export default function SeekerDashboardPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState({ totalBookings: 0, upcomingBookings: 0, completedBookings: 0, totalSpent: 0, favoriteGuides: 0 });
  const [bookings, setBookings] = useState<any[]>([]);

  useEffect(() => {
    api.get('/seekers/dashboard/stats').then(r => setStats(r.data)).catch(() => {});
    api.get('/bookings/my-bookings').then(r => setBookings((r.data || []).slice(0, 5))).catch(() => {});
  }, []);

  return (
    <div>
      <PageHeader title={`Welcome back, ${user?.firstName || 'Seeker'}`} subtitle="Your spiritual journey at a glance." />

      {/* Profile-completeness nudge — shown when the seeker hasn't filled
          out the registration wizard's deferred fields (interests,
          experience, practices, journey, bio). Self-hides at 100%. */}
      <ProfileCompletenessWidget />

      {/* Unified "Needs your attention" block — cart + pending tours +
          pending service bookings + pending ticket purchases. Hidden
          entirely when nothing is pending. */}
      <NeedsAttentionPanel />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
        <StatCard value={stats.upcomingBookings} label="Upcoming Sessions" accent />
        <StatCard value={stats.completedBookings} label="Completed" />
        <StatCard value={`$${stats.totalSpent.toFixed(0)}`} label="Total Spent" />
        <StatCard value={stats.favoriteGuides} label="Favorite Guides" />
      </div>

      {/* Upcoming Bookings */}
      <Panel title="Upcoming Sessions" icon="📅">
        {bookings.length === 0 ? (
          <div style={{ fontFamily: font, fontSize: '13px', color: C.warmGray, textAlign: 'center', padding: '24px' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🧘</div>
            No upcoming sessions. <a href="/practitioners" style={{ color: C.gold }}>Browse practitioners</a> to book your first session.
          </div>
        ) : (
          bookings.filter(b => ['PENDING', 'CONFIRMED'].includes(b.status)).slice(0, 3).map((b: any) => {
            const start = b.slot?.startTime ? new Date(b.slot.startTime) : null;
            return (
              <div key={b.id} style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr auto',
                gap: '12px', alignItems: 'center', padding: '14px 0',
                borderBottom: '1px solid rgba(232,184,75,0.08)',
              }}>
                <div>
                  <div style={{ fontFamily: font, fontSize: '14px', fontWeight: 500, color: C.charcoal }}>{b.service?.name}</div>
                  <div style={{ fontFamily: font, fontSize: '11px', color: C.warmGray }}>with {b.service?.guide?.displayName}</div>
                </div>
                <div style={{ fontFamily: font, fontSize: '12px', color: C.charcoal }}>
                  {start ? start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ' · ' + start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '—'}
                </div>
                <span style={{
                  padding: '3px 10px', borderRadius: '20px', fontFamily: font, fontSize: '11px',
                  background: b.status === 'CONFIRMED' ? '#E8F5E9' : '#FFF3E0',
                  color: b.status === 'CONFIRMED' ? '#2E7D32' : '#E65100',
                  border: b.status === 'CONFIRMED' ? '1px solid #A5D6A7' : '1px solid #FFCC80',
                }}>
                  {b.status === 'CONFIRMED' ? 'Confirmed' : 'Pending'}
                </span>
              </div>
            );
          })
        )}
        {bookings.length > 0 && (
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <a href="/seeker/dashboard/bookings" style={{ fontFamily: font, fontSize: '12px', color: C.gold, textDecoration: 'none' }}>View all bookings →</a>
          </div>
        )}
      </Panel>
    </div>
  );
}
