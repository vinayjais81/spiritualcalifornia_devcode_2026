'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { C, font, serif, PageHeader, Panel, EmptyState } from '@/components/guide/dashboard-ui';

// ─── Types ──────────────────────────────────────────────────────────────────

interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number | string;
  downloadUrl: string | null;
  downloadUrlExpiresAt: string | null;
  downloadCount: number;
  product: {
    name: string;
    type: 'DIGITAL' | 'PHYSICAL';
    imageUrls?: string[];
  };
}

interface ShippingAddressJson {
  street?: string;
  apartment?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

interface Order {
  id: string;
  status: 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';
  subtotal: number | string;
  discountAmount: number | string;
  shippingCost: number | string;
  taxAmount: number | string;
  totalAmount: number | string;
  shippingAddress: ShippingAddressJson | null;
  contactEmail: string;
  contactFirstName: string;
  contactLastName: string;
  contactPhone: string | null;
  createdAt: string;
  items: OrderItem[];
  payment?: { status: string; paymentMethod: string | null } | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function fmtMoney(v: number | string) {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return `$${n.toFixed(2)}`;
}

function shortId(id: string) {
  return id.slice(-8).toUpperCase();
}

// One row per status. Each status needs to tell the user what they can do next.
const STATUS_STYLES: Record<Order['status'], { bg: string; color: string; border: string; label: string }> = {
  PENDING:   { bg: '#FFF8E1', color: '#F57F17', border: '1px solid #FFE082', label: 'Awaiting Payment' },
  PAID:      { bg: '#E8F5E9', color: '#2E7D32', border: '1px solid #A5D6A7', label: 'Paid' },
  SHIPPED:   { bg: '#E1F5FE', color: '#0277BD', border: '1px solid #81D4FA', label: 'Shipped' },
  DELIVERED: { bg: '#E8F5E9', color: '#1B5E20', border: '1px solid #66BB6A', label: 'Delivered' },
  CANCELLED: { bg: '#FFEBEE', color: '#C62828', border: '1px solid #EF9A9A', label: 'Cancelled' },
  REFUNDED:  { bg: '#E3F2FD', color: '#1565C0', border: '1px solid #90CAF9', label: 'Refunded' },
};

function StatusPill({ status }: { status: Order['status'] }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.PENDING;
  return (
    <span style={{
      padding: '4px 12px', borderRadius: 20, fontFamily: font, fontSize: 11,
      background: s.bg, color: s.color, border: s.border, fontWeight: 500,
    }}>
      {s.label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════

type FilterKey = 'all' | 'pending' | 'paid' | 'cancelled';

export default function MyOrdersPage() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterKey>('all');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: orders, isLoading, refetch } = useQuery<Order[]>({
    queryKey: ['seeker', 'my-orders'],
    queryFn: async () => {
      const { data } = await api.get('/orders/mine');
      return Array.isArray(data) ? data : [];
    },
  });

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filtered = (orders || []).filter((o) => {
    if (filter === 'pending')   return o.status === 'PENDING';
    if (filter === 'paid')      return ['PAID', 'SHIPPED', 'DELIVERED'].includes(o.status);
    if (filter === 'cancelled') return ['CANCELLED', 'REFUNDED'].includes(o.status);
    return true;
  });

  const totals = {
    all:       orders?.length ?? 0,
    pending:   (orders || []).filter((o) => o.status === 'PENDING').length,
    paid:      (orders || []).filter((o) => ['PAID', 'SHIPPED', 'DELIVERED'].includes(o.status)).length,
    cancelled: (orders || []).filter((o) => ['CANCELLED', 'REFUNDED'].includes(o.status)).length,
  };

  const totalSpent = (orders || [])
    .filter((o) => ['PAID', 'SHIPPED', 'DELIVERED'].includes(o.status))
    .reduce((sum, o) => sum + Number(o.totalAmount), 0);

  // Handle inline download click. Uses the cached signed URL if it's still
  // valid; otherwise calls the backend to mint a fresh one.
  const handleDownload = async (order: Order, item: OrderItem) => {
    if (item.product.type !== 'DIGITAL') return;

    const cachedExpired = !item.downloadUrlExpiresAt
      || new Date(item.downloadUrlExpiresAt).getTime() <= Date.now() + 60_000;

    try {
      setDownloadingId(item.id);
      let url = item.downloadUrl;
      if (!url || cachedExpired) {
        const { data } = await api.get(`/orders/${order.id}/download/${item.id}`);
        url = data?.downloadUrl;
      }
      if (!url) throw new Error('Download link unavailable');
      window.open(url, '_blank');
      // Refetch to reflect the incremented download count
      refetch();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Could not start download. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="My Orders"
        subtitle={`${totals.all} order${totals.all !== 1 ? 's' : ''} · Total spent: ${fmtMoney(totalSpent)}`}
      />

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {([
          { key: 'all',       label: `All (${totals.all})` },
          { key: 'paid',      label: `Paid (${totals.paid})` },
          { key: 'pending',   label: `Pending (${totals.pending})` },
          { key: 'cancelled', label: `Cancelled (${totals.cancelled})` },
        ] as Array<{ key: FilterKey; label: string }>).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '8px 20px', borderRadius: 20, fontFamily: font, fontSize: 12, fontWeight: 500,
              border: filter === f.key ? `1.5px solid ${C.gold}` : '1.5px solid rgba(232,184,75,0.2)',
              background: filter === f.key ? C.goldPale : C.white,
              color: filter === f.key ? C.charcoal : C.warmGray,
              cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Panel title="Loading…" icon="⏳">
          <div style={{ padding: 40, textAlign: 'center', fontFamily: font, color: C.warmGray }}>
            Loading your orders…
          </div>
        </Panel>
      ) : !filtered.length ? (
        <Panel title="No Orders" icon="📦">
          <EmptyState
            message={
              filter === 'all'
                ? 'You haven\'t placed any orders yet. Explore the shop to find curated products from verified practitioners.'
                : `No ${filter} orders.`
            }
          />
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Link
              href="/shop"
              style={{ fontFamily: font, fontSize: 13, color: C.gold, textDecoration: 'none', fontWeight: 500 }}
            >
              Browse the Shop →
            </Link>
          </div>
        </Panel>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filtered.map((order) => {
            const isOpen = expanded.has(order.id);
            const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);
            const digitalCount = order.items.filter((i) => i.product.type === 'DIGITAL').length;
            const physicalCount = order.items.filter((i) => i.product.type === 'PHYSICAL').length;
            const isPaid = ['PAID', 'SHIPPED', 'DELIVERED'].includes(order.status);

            return (
              <div key={order.id} style={{
                background: C.white, border: '1px solid rgba(232,184,75,0.12)',
                borderRadius: 12, overflow: 'hidden',
              }}>
                {/* Summary row */}
                <button
                  onClick={() => toggle(order.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 16,
                    padding: '20px 24px', textAlign: 'left', cursor: 'pointer',
                    border: 'none', background: 'transparent',
                  }}
                >
                  <div style={{
                    width: 64, height: 64, borderRadius: 8,
                    background: C.goldPale, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, fontSize: 28,
                  }}>
                    {digitalCount > 0 && physicalCount === 0 ? '💾'
                      : physicalCount > 0 && digitalCount === 0 ? '📦'
                      : '🛍️'}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      flexWrap: 'wrap', marginBottom: 4,
                    }}>
                      <StatusPill status={order.status} />
                      <span style={{
                        fontFamily: font, fontSize: 10, color: C.warmGray,
                        padding: '2px 8px', background: C.offWhite, borderRadius: 4,
                      }}>
                        Order #{shortId(order.id)}
                      </span>
                      {digitalCount > 0 && (
                        <span style={{
                          fontFamily: font, fontSize: 10, color: C.gold,
                          padding: '2px 8px', background: 'rgba(232,184,75,0.1)', borderRadius: 4,
                          fontWeight: 500,
                        }}>
                          {digitalCount} digital
                        </span>
                      )}
                      {physicalCount > 0 && (
                        <span style={{
                          fontFamily: font, fontSize: 10, color: C.warmGray,
                          padding: '2px 8px', background: C.offWhite, borderRadius: 4,
                        }}>
                          {physicalCount} physical
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontFamily: serif, fontSize: 18, fontWeight: 500,
                      color: C.charcoal, marginBottom: 2,
                    }}>
                      {order.items[0]?.product.name}
                      {order.items.length > 1 && (
                        <span style={{ fontFamily: font, fontSize: 13, color: C.warmGray, fontWeight: 400 }}>
                          {' '}+ {order.items.length - 1} more
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: font, fontSize: 12, color: C.warmGray }}>
                      Placed {fmtDate(order.createdAt)} · {itemCount} item{itemCount !== 1 ? 's' : ''}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: serif, fontSize: 20, fontWeight: 500, color: C.charcoal }}>
                      {fmtMoney(order.totalAmount)}
                    </div>
                    {order.payment?.paymentMethod && (
                      <div style={{ fontFamily: font, fontSize: 11, color: C.warmGray }}>
                        {order.payment.paymentMethod}
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: 18, color: C.warmGray, flexShrink: 0 }}>
                    {isOpen ? '▲' : '▼'}
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{
                    borderTop: '1px solid rgba(232,184,75,0.12)',
                    padding: '20px 24px', background: C.offWhite,
                  }}>
                    {/* Items */}
                    <div style={{
                      fontFamily: font, fontSize: 11, letterSpacing: '0.1em',
                      textTransform: 'uppercase', color: C.warmGray, marginBottom: 12,
                    }}>
                      Items in this order
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                      {order.items.map((item) => {
                        const isDigital = item.product.type === 'DIGITAL';
                        const coverImage = item.product.imageUrls?.[0];
                        const canDownload = isDigital && isPaid;
                        const isDownloading = downloadingId === item.id;
                        return (
                          <div
                            key={item.id}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 14,
                              padding: '12px 16px',
                              background: C.white, borderRadius: 8,
                              border: '1px solid rgba(232,184,75,0.1)',
                            }}
                          >
                            <div style={{
                              width: 48, height: 48, borderRadius: 6,
                              background: C.goldPale, display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0, overflow: 'hidden', fontSize: 20,
                            }}>
                              {coverImage ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                isDigital ? '🎵' : '📦'
                              )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontFamily: font, fontSize: 13, fontWeight: 500,
                                color: C.charcoal, marginBottom: 2,
                              }}>
                                {item.product.name}
                              </div>
                              <div style={{ fontFamily: font, fontSize: 11, color: C.warmGray }}>
                                {isDigital ? 'Digital · ' : 'Physical · '}
                                Qty {item.quantity} · {fmtMoney(Number(item.unitPrice) * item.quantity)}
                                {isDigital && item.downloadCount > 0 && ` · Downloaded ${item.downloadCount}×`}
                              </div>
                            </div>

                            {/* Digital download CTA */}
                            {canDownload && (
                              <button
                                onClick={() => handleDownload(order, item)}
                                disabled={isDownloading}
                                style={{
                                  padding: '8px 18px', borderRadius: 6,
                                  background: isDownloading ? 'rgba(58,53,48,0.6)' : C.charcoal,
                                  color: C.gold,
                                  fontFamily: font, fontSize: 11, fontWeight: 600,
                                  letterSpacing: '0.08em', textTransform: 'uppercase',
                                  border: 'none',
                                  cursor: isDownloading ? 'wait' : 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {isDownloading ? 'Preparing…' : '⬇ Download'}
                              </button>
                            )}
                            {isDigital && !isPaid && (
                              <span style={{ fontFamily: font, fontSize: 11, color: C.warmGray, fontStyle: 'italic' }}>
                                Available after payment
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Shipping address (physical orders only) */}
                    {physicalCount > 0 && order.shippingAddress && (
                      <>
                        <div style={{
                          fontFamily: font, fontSize: 11, letterSpacing: '0.1em',
                          textTransform: 'uppercase', color: C.warmGray, marginBottom: 8,
                        }}>
                          Shipping to
                        </div>
                        <div style={{
                          background: C.white, borderRadius: 8, padding: '12px 16px',
                          border: '1px solid rgba(232,184,75,0.1)',
                          fontFamily: font, fontSize: 13, color: C.charcoal, lineHeight: 1.6,
                          marginBottom: 20,
                        }}>
                          <div>{order.contactFirstName} {order.contactLastName}</div>
                          <div style={{ color: C.warmGray }}>
                            {order.shippingAddress.street}
                            {order.shippingAddress.apartment && `, ${order.shippingAddress.apartment}`}
                            <br />
                            {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}
                            <br />
                            {order.shippingAddress.country}
                          </div>
                          {order.contactPhone && (
                            <div style={{ color: C.warmGray, marginTop: 4 }}>📞 {order.contactPhone}</div>
                          )}
                        </div>
                      </>
                    )}

                    {/* Price breakdown */}
                    <div style={{
                      fontFamily: font, fontSize: 11, letterSpacing: '0.1em',
                      textTransform: 'uppercase', color: C.warmGray, marginBottom: 8,
                    }}>
                      Payment summary
                    </div>
                    <div style={{
                      background: C.white, borderRadius: 8,
                      border: '1px solid rgba(232,184,75,0.1)',
                      padding: '14px 18px',
                      fontFamily: font, fontSize: 13, lineHeight: 1.9,
                    }}>
                      <Row label="Subtotal" value={fmtMoney(order.subtotal)} />
                      {Number(order.discountAmount) > 0 && (
                        <Row label="Discount" value={`− ${fmtMoney(order.discountAmount)}`} color="#2E7D32" />
                      )}
                      {Number(order.shippingCost) > 0 && (
                        <Row label="Shipping" value={fmtMoney(order.shippingCost)} />
                      )}
                      {Number(order.taxAmount) > 0 && (
                        <Row label="Tax" value={fmtMoney(order.taxAmount)} />
                      )}
                      <div style={{
                        marginTop: 8, paddingTop: 10,
                        borderTop: '1.5px solid rgba(232,184,75,0.25)',
                        display: 'flex', justifyContent: 'space-between',
                        fontFamily: serif, fontSize: 16, fontWeight: 500,
                      }}>
                        <span style={{ color: C.charcoal }}>Total</span>
                        <span style={{ color: C.charcoal }}>{fmtMoney(order.totalAmount)}</span>
                      </div>
                    </div>

                    {/* Footer actions */}
                    <div style={{
                      marginTop: 16, display: 'flex',
                      alignItems: 'center', justifyContent: 'space-between',
                      gap: 12, flexWrap: 'wrap',
                    }}>
                      <div style={{ fontFamily: font, fontSize: 12, color: C.warmGray }}>
                        Receipt emailed to <strong style={{ color: C.charcoal }}>{order.contactEmail}</strong>
                      </div>
                      {digitalCount > 0 && (
                        <Link
                          href="/downloads"
                          style={{
                            fontFamily: font, fontSize: 12, color: C.gold,
                            textDecoration: 'none', fontWeight: 500,
                          }}
                        >
                          Downloads Library →
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: C.warmGray }}>{label}</span>
      <span style={{ color: color || C.charcoal }}>{value}</span>
    </div>
  );
}
