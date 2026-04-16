'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';

const C = {
  gold: '#E8B84B',
  charcoal: '#3A3530',
  warmGray: '#8A8278',
  cream: '#FAFAF7',
  white: '#FFFFFF',
  green: '#27AE60',
  red: '#C0392B',
  orange: '#E67E22',
  goldPale: '#FDF6E3',
};
const serif = "'Cormorant Garamond', serif";
const sans = "'Inter', sans-serif";

interface TicketData {
  ticketId: string;
  status: string;
  checkedInAt: string | null;
  attendee: {
    name: string | null;
    email: string | null;
    dietaryNeeds: string | null;
    accessibilityNeeds: string | null;
  };
  tier: { name: string; price: number; currency: string };
  event: {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    timezone: string;
    location: string | null;
    type: string;
    coverImageUrl: string | null;
    guideName: string;
  };
  purchasedAt: string;
}

export default function VerifyTicketPage() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInResult, setCheckInResult] = useState<{ checkedInAt: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    api.get(`/tickets/verify/${id}`)
      .then((res) => setTicket(res.data))
      .catch((err) => setError(err?.response?.data?.message || 'Ticket not found'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleCheckIn = async () => {
    if (!id) return;
    setCheckingIn(true);
    try {
      const res = await api.post(`/tickets/${id}/check-in`);
      setCheckInResult(res.data);
      setTicket((prev) => prev ? { ...prev, status: 'CONFIRMED', checkedInAt: res.data.checkedInAt } : prev);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Check-in failed');
    } finally {
      setCheckingIn(false);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: sans, color: C.warmGray }}>
        Verifying ticket...
      </div>
    );
  }

  if (error && !ticket) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: sans, padding: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>!</div>
        <h1 style={{ fontFamily: serif, fontSize: 28, color: C.charcoal, marginBottom: 8 }}>Invalid Ticket</h1>
        <p style={{ color: C.warmGray, fontSize: 14 }}>{error}</p>
      </div>
    );
  }

  if (!ticket) return null;

  const isCheckedIn = !!(ticket.checkedInAt || checkInResult);
  const isValid = ticket.status === 'CONFIRMED';
  const isCancelled = ticket.status === 'CANCELLED' || ticket.status === 'REFUNDED';

  const statusColor = isCheckedIn ? C.orange : isValid ? C.green : isCancelled ? C.red : C.warmGray;
  const statusLabel = isCheckedIn
    ? 'CHECKED IN'
    : isValid ? 'VALID' : ticket.status;

  return (
    <div style={{ maxWidth: 520, margin: '40px auto', padding: '0 20px', fontFamily: sans }}>
      {/* Status Banner */}
      <div style={{
        background: isCheckedIn ? 'rgba(230,126,34,0.1)' : isValid ? 'rgba(39,174,96,0.1)' : 'rgba(192,57,43,0.1)',
        border: `2px solid ${statusColor}`,
        borderRadius: 12,
        padding: '20px 24px',
        textAlign: 'center',
        marginBottom: 24,
      }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>
          {isCheckedIn ? '\u2714' : isValid ? '\u2713' : '\u2717'}
        </div>
        <div style={{
          fontSize: 14, fontWeight: 700, letterSpacing: '0.12em',
          color: statusColor, textTransform: 'uppercase',
        }}>
          {statusLabel}
        </div>
        {isCheckedIn && (
          <div style={{ fontSize: 12, color: C.warmGray, marginTop: 6 }}>
            Checked in at {formatTime(ticket.checkedInAt || checkInResult!.checkedInAt)}{' '}
            on {formatDate(ticket.checkedInAt || checkInResult!.checkedInAt)}
          </div>
        )}
      </div>

      {/* Event Details Card */}
      <div style={{
        background: C.white, border: '1px solid rgba(232,184,75,0.2)',
        borderRadius: 12, overflow: 'hidden', marginBottom: 20,
      }}>
        {ticket.event.coverImageUrl && (
          <div style={{ height: 160, background: `url(${ticket.event.coverImageUrl}) center/cover`, borderBottom: '1px solid rgba(232,184,75,0.2)' }} />
        )}
        <div style={{ padding: '20px 24px' }}>
          <h2 style={{ fontFamily: serif, fontSize: 22, color: C.charcoal, margin: '0 0 4px' }}>
            {ticket.event.title}
          </h2>
          <p style={{ fontSize: 12, color: C.warmGray, margin: '0 0 16px' }}>
            Hosted by {ticket.event.guideName}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', fontSize: 13 }}>
            <Detail label="Date" value={formatDate(ticket.event.startTime)} />
            <Detail label="Time" value={`${formatTime(ticket.event.startTime)} - ${formatTime(ticket.event.endTime)}`} />
            <Detail label="Location" value={ticket.event.location || 'Online'} />
            <Detail label="Type" value={ticket.event.type.replace('_', ' ')} />
          </div>
        </div>
      </div>

      {/* Attendee Details Card */}
      <div style={{
        background: C.white, border: '1px solid rgba(232,184,75,0.2)',
        borderRadius: 12, padding: '20px 24px', marginBottom: 20,
      }}>
        <h3 style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.warmGray, margin: '0 0 14px', fontWeight: 500 }}>
          Attendee Details
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', fontSize: 13 }}>
          <Detail label="Name" value={ticket.attendee.name || '-'} />
          <Detail label="Email" value={ticket.attendee.email || '-'} />
          <Detail label="Ticket Tier" value={ticket.tier.name} />
          <Detail label="Price" value={`$${ticket.tier.price.toLocaleString()}`} />
          {ticket.attendee.dietaryNeeds && (
            <Detail label="Dietary Needs" value={ticket.attendee.dietaryNeeds} />
          )}
          {ticket.attendee.accessibilityNeeds && (
            <Detail label="Accessibility" value={ticket.attendee.accessibilityNeeds} />
          )}
        </div>
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(232,184,75,0.15)', fontSize: 11, color: C.warmGray }}>
          Ticket ID: {ticket.ticketId.slice(-8).toUpperCase()} &middot; Purchased {formatDate(ticket.purchasedAt)}
        </div>
      </div>

      {/* Check-in Button (only for valid, not-yet-checked-in tickets) */}
      {isValid && !isCheckedIn && (
        <button
          onClick={handleCheckIn}
          disabled={checkingIn}
          style={{
            width: '100%', padding: 18, borderRadius: 10,
            background: checkingIn ? 'rgba(39,174,96,0.5)' : C.green,
            color: C.white, fontFamily: sans,
            fontSize: 14, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            border: 'none', cursor: checkingIn ? 'not-allowed' : 'pointer',
            marginBottom: 12,
          }}
        >
          {checkingIn ? 'Checking in...' : 'Mark as Checked In'}
        </button>
      )}

      {/* Error display */}
      {error && ticket && (
        <div style={{
          padding: '12px 16px', borderRadius: 8, marginBottom: 12,
          background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.2)',
          fontSize: 13, color: C.red, textAlign: 'center',
        }}>
          {error}
        </div>
      )}

      {isCancelled && (
        <div style={{
          padding: '14px 18px', borderRadius: 8,
          background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.2)',
          fontSize: 13, color: C.red, textAlign: 'center',
        }}>
          This ticket has been {ticket.status.toLowerCase()}. It is no longer valid for entry.
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A8278', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ color: '#3A3530', fontWeight: 500 }}>{value}</div>
    </div>
  );
}
