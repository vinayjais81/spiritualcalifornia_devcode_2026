'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface DownloadItem {
  orderId: string;
  orderItemId: string;
  productId: string;
  productName: string;
  guideName: string;
  guideSlug: string;
  imageUrl: string | null;
  digitalFiles: any;
  downloadCount: number;
  purchasedAt: string;
  hasFile: boolean;
}

export default function DownloadsPage() {
  const [items, setItems] = useState<DownloadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get('/orders/downloads');
        setItems(res.data);
      } catch {
        // Not logged in or no purchases
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const handleDownload = async (orderId: string, itemId: string) => {
    setDownloading(itemId);
    try {
      const res = await api.get(`/orders/${orderId}/download/${itemId}`);
      // Open the signed S3 URL in a new tab to trigger download
      window.open(res.data.downloadUrl, '_blank');
      // Update local count
      setItems(prev =>
        prev.map(i => i.orderItemId === itemId ? { ...i, downloadCount: res.data.downloadCount } : i),
      );
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Download failed. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '80px 48px' }}>
        <div style={{ height: 32, background: '#f0eeeb', borderRadius: 4, width: '40%', marginBottom: 24 }} />
        {[1, 2, 3].map(i => (
          <div key={i} style={{ display: 'flex', gap: 16, marginBottom: 16, padding: 20, background: '#fff', borderRadius: 12, border: '1px solid rgba(232,184,75,0.1)' }}>
            <div style={{ width: 80, height: 80, background: '#FDF6E3', borderRadius: 8 }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 16, background: '#f0eeeb', borderRadius: 4, width: '60%', marginBottom: 8 }} />
              <div style={{ height: 12, background: '#f0eeeb', borderRadius: 4, width: '30%' }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 48px 80px' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#E8B84B', marginBottom: 8 }}>
          ✦ My Library
        </div>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 400, color: '#3A3530', marginBottom: 6 }}>
          Digital Downloads
        </h1>
        <p style={{ fontSize: 14, color: '#8A8278' }}>
          All your purchased digital products. Download anytime — lifetime access.
        </p>
      </div>

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>📥</span>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 400, color: '#3A3530', marginBottom: 8 }}>
            No downloads yet
          </h2>
          <p style={{ fontSize: 14, color: '#8A8278', marginBottom: 24 }}>
            When you purchase digital products, they&apos;ll appear here for instant download.
          </p>
          <Link href="/shop" style={{
            display: 'inline-block', padding: '12px 28px', borderRadius: 8,
            background: '#E8B84B', color: '#3A3530',
            fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
            textDecoration: 'none',
          }}>
            Browse Digital Products
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {items.map((item) => (
            <div key={item.orderItemId} style={{
              display: 'flex', alignItems: 'center', gap: 20, padding: '20px 24px',
              background: '#fff', border: '1px solid rgba(232,184,75,0.1)', borderRadius: 12,
              transition: 'box-shadow 0.2s',
            }}>
              {/* Image */}
              <div style={{
                width: 80, height: 80, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
                background: '#FDF6E3', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 32 }}>🎵</span>
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: 18, fontWeight: 500, color: '#3A3530', marginBottom: 4,
                }}>
                  {item.productName}
                </h3>
                <div style={{ fontSize: 12, color: '#8A8278', marginBottom: 4 }}>
                  by <Link href={`/guides/${item.guideSlug}`} style={{ color: '#E8B84B', textDecoration: 'none' }}>{item.guideName}</Link>
                </div>
                <div style={{ fontSize: 11, color: '#8A8278' }}>
                  Purchased {new Date(item.purchasedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {item.downloadCount > 0 && ` · Downloaded ${item.downloadCount} time${item.downloadCount > 1 ? 's' : ''}`}
                </div>
              </div>

              {/* Download button */}
              <button
                onClick={() => handleDownload(item.orderId, item.orderItemId)}
                disabled={!item.hasFile || downloading === item.orderItemId}
                style={{
                  padding: '12px 24px', borderRadius: 8, flexShrink: 0,
                  background: downloading === item.orderItemId ? '#8A8278' : '#3A3530',
                  color: '#E8B84B',
                  fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
                  border: 'none', cursor: !item.hasFile ? 'not-allowed' : 'pointer',
                  opacity: !item.hasFile ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                {downloading === item.orderItemId ? '...' : '⬇'} Download
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Lifetime access note */}
      {items.length > 0 && (
        <div style={{
          marginTop: 32, padding: '16px 20px', borderRadius: 8,
          background: '#FDF6E3', border: '1px solid rgba(232,184,75,0.2)',
          textAlign: 'center', fontSize: 12, color: '#3A3530',
        }}>
          🔒 All downloads include <strong>lifetime access</strong>. Re-download anytime from this page.
        </div>
      )}
    </div>
  );
}
