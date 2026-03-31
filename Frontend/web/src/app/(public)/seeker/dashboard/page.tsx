'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

type Tab = 'bookings' | 'orders' | 'downloads' | 'reviews';

export default function SeekerDashboardPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('bookings');
  const [bookings, setBookings] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [downloads, setDownloads] = useState<any[]>([]);
  const [reviewable, setReviewable] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [b, o, d, r] = await Promise.allSettled([
          api.get('/bookings/my-bookings'),
          api.get('/orders/mine'),
          api.get('/orders/downloads'),
          api.get('/reviews/reviewable'),
        ]);
        if (b.status === 'fulfilled') setBookings(b.value.data);
        if (o.status === 'fulfilled') setOrders(o.value.data);
        if (d.status === 'fulfilled') setDownloads(d.value.data);
        if (r.status === 'fulfilled') setReviewable(r.value.data);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    };
    fetchAll();
  }, []);

  const tabs: Array<{ key: Tab; label: string; count: number; icon: string }> = [
    { key: 'bookings', label: 'My Bookings', count: bookings.length, icon: '📅' },
    { key: 'orders', label: 'Orders', count: orders.length, icon: '📦' },
    { key: 'downloads', label: 'Downloads', count: downloads.length, icon: '⬇️' },
    { key: 'reviews', label: 'To Review', count: reviewable.length, icon: '⭐' },
  ];

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 48px 80px' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#E8B84B', marginBottom: 8 }}>✦ My Dashboard</div>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 400, color: '#3A3530' }}>
          Welcome back{user?.firstName ? `, ${user.firstName}` : ''}
        </h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(232,184,75,0.1)', marginBottom: 32 }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '14px 24px',
            background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: activeTab === tab.key ? '2px solid #E8B84B' : '2px solid transparent',
            color: activeTab === tab.key ? '#3A3530' : '#8A8278',
            fontSize: 13, fontWeight: activeTab === tab.key ? 600 : 400,
          }}>
            <span>{tab.icon}</span> {tab.label}
            {tab.count > 0 && <span style={{ background: activeTab === tab.key ? '#E8B84B' : '#f0eeeb', color: activeTab === tab.key ? '#3A3530' : '#8A8278', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>{tab.count}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#8A8278' }}>Loading...</div>
      ) : (
        <>
          {/* Bookings */}
          {activeTab === 'bookings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {bookings.length === 0 ? (
                <EmptyState icon="📅" title="No bookings yet" desc="Book a session with a practitioner to get started." cta={{ label: 'Browse Practitioners', href: '/practitioners' }} />
              ) : bookings.map((b: any) => (
                <div key={b.id} style={{ background: '#fff', border: '1px solid rgba(232,184,75,0.1)', borderRadius: 12, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#FDF6E3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🧘</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 500, color: '#3A3530', marginBottom: 2 }}>{b.service?.name || 'Session'}</div>
                    <div style={{ fontSize: 12, color: '#8A8278' }}>
                      {b.service?.guide?.displayName} · {b.slot?.startTime ? new Date(b.slot.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'TBD'}
                    </div>
                  </div>
                  <StatusBadge status={b.status} />
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 500, color: '#3A3530' }}>${Number(b.totalAmount)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Orders */}
          {activeTab === 'orders' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {orders.length === 0 ? (
                <EmptyState icon="📦" title="No orders yet" desc="Browse our shop for spiritual tools and digital resources." cta={{ label: 'Visit Shop', href: '/shop' }} />
              ) : orders.map((o: any) => (
                <div key={o.id} style={{ background: '#fff', border: '1px solid rgba(232,184,75,0.1)', borderRadius: 12, padding: '20px 24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#8A8278' }}>Order #{o.id.slice(-8).toUpperCase()}</div>
                      <div style={{ fontSize: 12, color: '#8A8278' }}>{new Date(o.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <StatusBadge status={o.status} />
                      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 500, color: '#3A3530', marginTop: 4 }}>${Number(o.totalAmount)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(o.items || []).map((item: any) => (
                      <span key={item.id} style={{ padding: '4px 10px', borderRadius: 6, background: '#FDF6E3', fontSize: 11, color: '#3A3530' }}>
                        {item.product?.name || 'Item'} ×{item.quantity}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Downloads */}
          {activeTab === 'downloads' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {downloads.length === 0 ? (
                <EmptyState icon="⬇️" title="No digital purchases yet" desc="Digital products are available for instant download after purchase." cta={{ label: 'Browse Digital Products', href: '/shop' }} />
              ) : downloads.map((d: any) => (
                <div key={d.orderItemId} style={{ background: '#fff', border: '1px solid rgba(232,184,75,0.1)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 8, background: '#FDF6E3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🎵</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#3A3530' }}>{d.productName}</div>
                    <div style={{ fontSize: 11, color: '#8A8278' }}>by {d.guideName} · Downloaded {d.downloadCount}×</div>
                  </div>
                  <Link href="/downloads" style={{ padding: '8px 16px', borderRadius: 6, background: '#3A3530', color: '#E8B84B', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>
                    Download
                  </Link>
                </div>
              ))}
            </div>
          )}

          {/* Reviewable */}
          {activeTab === 'reviews' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {reviewable.length === 0 ? (
                <EmptyState icon="⭐" title="All caught up!" desc="Complete a session to leave a review for your practitioner." />
              ) : reviewable.map((b: any) => (
                <div key={b.id} style={{ background: '#fff', border: '1px solid rgba(232,184,75,0.1)', borderRadius: 12, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#FDF6E3', border: '2px solid #E8B84B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: '#E8B84B' }}>
                    {(b.service?.guide?.displayName || 'G').split(' ').map((w: string) => w[0]).join('').slice(0, 2)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 500, color: '#3A3530' }}>{b.service?.name}</div>
                    <div style={{ fontSize: 12, color: '#8A8278' }}>with {b.service?.guide?.displayName} · {b.slot?.startTime ? new Date(b.slot.startTime).toLocaleDateString() : ''}</div>
                  </div>
                  <Link href={`/reviews/new/${b.id}`} style={{
                    padding: '10px 20px', borderRadius: 8, background: '#E8B84B', color: '#3A3530',
                    fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none',
                  }}>
                    Write Review
                  </Link>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    PENDING: { bg: 'rgba(232,184,75,0.15)', color: '#B8960F' },
    CONFIRMED: { bg: 'rgba(90,138,106,0.12)', color: '#5A8A6A' },
    COMPLETED: { bg: 'rgba(90,138,106,0.12)', color: '#5A8A6A' },
    PAID: { bg: 'rgba(90,138,106,0.12)', color: '#5A8A6A' },
    CANCELLED: { bg: 'rgba(192,57,43,0.1)', color: '#C0392B' },
    SHIPPED: { bg: 'rgba(46,107,158,0.1)', color: '#2E6B9E' },
    DELIVERED: { bg: 'rgba(90,138,106,0.12)', color: '#5A8A6A' },
  };
  const s = map[status] || map.PENDING;
  return <span style={{ padding: '3px 10px', borderRadius: 10, background: s.bg, color: s.color, fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>{status}</span>;
}

function EmptyState({ icon, title, desc, cta }: { icon: string; title: string; desc: string; cta?: { label: string; href: string } }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 20px' }}>
      <span style={{ fontSize: 40, display: 'block', marginBottom: 12 }}>{icon}</span>
      <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 400, color: '#3A3530', marginBottom: 6 }}>{title}</h3>
      <p style={{ fontSize: 13, color: '#8A8278', marginBottom: 20 }}>{desc}</p>
      {cta && <Link href={cta.href} style={{ padding: '10px 24px', borderRadius: 8, background: '#E8B84B', color: '#3A3530', fontSize: 12, fontWeight: 600, textDecoration: 'none', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{cta.label}</Link>}
    </div>
  );
}
