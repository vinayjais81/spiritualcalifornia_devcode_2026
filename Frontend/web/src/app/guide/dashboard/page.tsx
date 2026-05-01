'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { api } from '@/lib/api';
import { C, font, formatDate, PageHeader, Panel, StatCard, Btn, EventDateBox, StatusBadge, EmptyState } from '@/components/guide/dashboard-ui';
import { GuideProfileCompletenessWidget } from '@/components/guide/GuideProfileCompletenessWidget';
import { GuidePaymentsChip } from '@/components/guide/GuidePaymentsChip';

interface GuideEvent { id: string; title: string; startTime: string; location: string | null; ticketTiers: { sold: number }[]; }
interface BlogPost { id: string; title: string; coverImageUrl: string | null; isPublished: boolean; publishedAt: string | null; createdAt: string; }

export default function DashboardOverview() {
  const [profile, setProfile] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [events, setEvents] = useState<GuideEvent[]>([]);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);

  useEffect(() => {
    Promise.all([
      api.get('/guides/me').catch(() => ({ data: null })),
      api.get('/services/mine').catch(() => ({ data: [] })),
      api.get('/events/mine').catch(() => ({ data: [] })),
      api.get('/blog/mine').catch(() => ({ data: [] })),
    ]).then(([p, sv, ev, bl]) => {
      setProfile(p.data);
      setServices(sv.data);
      setEvents(ev.data);
      setBlogPosts(bl.data);
    });
  }, []);

  const displayName = profile?.displayName || 'Guide';

  return (
    <div>
      <PageHeader title={`Welcome back, ${displayName.split(' ')[0]}`} subtitle="Here is a snapshot of your practice on Spiritual California.">
        {profile?.slug && (
          <Link href={`/guides/${profile.slug}`} target="_blank" style={{ textDecoration: 'none' }}>
            <Btn variant="secondary">👁️ View My Public Profile</Btn>
          </Link>
        )}
      </PageHeader>

      {/* Profile-completeness nudge — shown when the guide hasn't filled out
          all wizard sections (categories, profile, location/schedule,
          credentials, submit-for-verification). Self-hides at 100%. */}
      <GuideProfileCompletenessWidget completeness={profile?.completeness} />

      {/* Payments setup nudge — surfaces Stripe Connect status. Self-hides
          when fully connected. Spec: docs/payments-publish-gate.md §6.1. */}
      <GuidePaymentsChip />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '28px' }}>
        <StatCard value="$0" label="Current Balance" accent />
        <StatCard value={services.length} label="Services" />
        <StatCard value={profile?.isVerified ? '✓' : '—'} label="Verified" />
        <StatCard value={blogPosts.length} label="Blog Posts" />
      </div>

      <Panel title="Upcoming Events" icon="📅">
        {events.length === 0 ? <EmptyState message="No events yet. Create your first event!" /> : events.slice(0, 3).map(ev => (
          <div key={ev.id} style={{ display: 'grid', gridTemplateColumns: '80px 1fr auto', gap: '14px', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid rgba(232,184,75,0.1)' }}>
            <EventDateBox startTime={ev.startTime} />
            <div>
              <div style={{ fontFamily: font, fontSize: '14px', fontWeight: 500, color: C.charcoal, marginBottom: '3px' }}>{ev.title}</div>
              <div style={{ fontFamily: font, fontSize: '12px', color: C.warmGray }}>{ev.location || 'Location TBD'}</div>
            </div>
            <div style={{ fontFamily: font, fontSize: '12px', color: C.warmGray }}>{ev.ticketTiers?.[0]?.sold || 0} registered</div>
          </div>
        ))}
        <div style={{ marginTop: '16px' }}><Link href="/guide/dashboard/events" style={{ textDecoration: 'none' }}><Btn variant="secondary" size="sm">Manage All Events →</Btn></Link></div>
      </Panel>

      <Panel title="Recent Blog Posts" icon="✍️">
        {blogPosts.length === 0 ? <EmptyState message="No posts yet. Write your first blog post!" /> : blogPosts.slice(0, 3).map(post => (
          <div key={post.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 0', borderBottom: '1px solid rgba(232,184,75,0.1)' }}>
            <div style={{ width: '72px', height: '54px', borderRadius: '6px', background: C.goldPale, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {post.coverImageUrl ? (
                post.coverImageUrl.startsWith('data:')
                  ? <img src={post.coverImageUrl} alt="" style={{ width: '72px', height: '54px', objectFit: 'cover' }} />
                  : <Image src={post.coverImageUrl} alt="" width={72} height={54} className="object-cover" />
              ) : <span style={{ fontSize: '24px' }}>✍️</span>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: font, fontSize: '14px', fontWeight: 500, color: C.charcoal, marginBottom: '3px' }}>{post.title}</div>
              <div style={{ fontFamily: font, fontSize: '11px', color: C.warmGray }}>{post.isPublished ? `Published · ${formatDate(post.publishedAt!)}` : `Draft · ${formatDate(post.createdAt)}`}</div>
            </div>
            <StatusBadge published={post.isPublished} />
          </div>
        ))}
        <div style={{ marginTop: '16px' }}><Link href="/guide/dashboard/blog" style={{ textDecoration: 'none' }}><Btn variant="secondary" size="sm">Go to My Blog →</Btn></Link></div>
      </Panel>
    </div>
  );
}
