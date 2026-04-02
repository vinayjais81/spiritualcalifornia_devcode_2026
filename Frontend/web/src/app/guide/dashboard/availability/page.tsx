'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  C, font, serif, PageHeader, Panel, Btn, FormGroup, Select,
} from '@/components/guide/dashboard-ui';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Generate time options in 15-min increments (06:00 – 22:00)
function timeOptions() {
  const opts: string[] = [];
  for (let h = 6; h <= 22; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 22 && m > 0) break;
      opts.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return opts;
}

const TIMES = timeOptions();

function formatTime12(t: string) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

interface AvailSlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  bufferMin: number;
}

export default function AvailabilityPage() {
  const [slots, setSlots] = useState<AvailSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bufferMin, setBufferMin] = useState(15);

  const load = useCallback(() => {
    api.get('/guides/availability')
      .then(r => {
        const data: AvailSlot[] = r.data || [];
        setSlots(data);
        if (data.length > 0) {
          setBufferMin(data[0].bufferMin || 15);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const addSlot = (day: number) => {
    // Default: 9 AM – 5 PM
    setSlots(prev => [...prev, { dayOfWeek: day, startTime: '09:00', endTime: '17:00', bufferMin }]);
  };

  const removeSlot = (day: number, idx: number) => {
    const daySlots = slots.filter(s => s.dayOfWeek === day);
    const target = daySlots[idx];
    setSlots(prev => {
      let count = 0;
      return prev.filter(s => {
        if (s.dayOfWeek === day && s.startTime === target.startTime && s.endTime === target.endTime) {
          return count++ !== idx ? true : false;
        }
        return true;
      });
    });
  };

  const updateSlot = (day: number, idx: number, field: 'startTime' | 'endTime', value: string) => {
    const daySlots = slots.filter(s => s.dayOfWeek === day);
    const target = daySlots[idx];
    setSlots(prev => {
      let count = 0;
      return prev.map(s => {
        if (s.dayOfWeek === day && s.startTime === target.startTime && s.endTime === target.endTime) {
          if (count === idx) {
            count++;
            return { ...s, [field]: value };
          }
          count++;
        }
        return s;
      });
    });
  };

  const copyToAll = (sourceDay: number) => {
    const sourceSlots = slots.filter(s => s.dayOfWeek === sourceDay);
    if (sourceSlots.length === 0) return;

    const newSlots: AvailSlot[] = [];
    for (let d = 0; d < 7; d++) {
      if (d === sourceDay) {
        newSlots.push(...sourceSlots);
      } else {
        newSlots.push(...sourceSlots.map(s => ({ ...s, dayOfWeek: d, bufferMin })));
      }
    }
    setSlots(newSlots);
    toast.success(`Copied ${DAYS[sourceDay]}'s schedule to all days`);
  };

  const copyToWeekdays = (sourceDay: number) => {
    const sourceSlots = slots.filter(s => s.dayOfWeek === sourceDay);
    if (sourceSlots.length === 0) return;

    // Keep weekend slots, replace weekdays
    const weekendSlots = slots.filter(s => s.dayOfWeek === 0 || s.dayOfWeek === 6);
    const newSlots: AvailSlot[] = [...weekendSlots];
    for (let d = 1; d <= 5; d++) {
      newSlots.push(...sourceSlots.map(s => ({ ...s, dayOfWeek: d, bufferMin })));
    }
    setSlots(newSlots);
    toast.success('Applied to weekdays (Mon–Fri)');
  };

  const handleSave = async () => {
    // Validate: endTime must be after startTime
    for (const slot of slots) {
      if (slot.endTime <= slot.startTime) {
        toast.error(`${DAYS[slot.dayOfWeek]}: End time must be after start time`);
        return;
      }
    }

    setSaving(true);
    try {
      await api.put('/guides/availability', {
        slots: slots.map(s => ({
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          isRecurring: true,
          bufferMin,
        })),
      });
      toast.success('Availability saved');
    } catch {
      toast.error('Failed to save availability');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ fontFamily: font, fontSize: '13px', color: C.warmGray, padding: '40px' }}>Loading...</div>;
  }

  return (
    <div>
      <PageHeader title="Weekly Availability" subtitle="Set your regular working hours. Seekers can book during these times." />

      {/* Buffer Time Setting */}
      <Panel title="Session Settings" icon="⚙️">
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <FormGroup label="Buffer Between Sessions">
            <Select
              value={String(bufferMin)}
              onChange={e => setBufferMin(parseInt(e.target.value))}
              style={{ width: '160px' }}
            >
              <option value="0">No buffer</option>
              <option value="5">5 minutes</option>
              <option value="10">10 minutes</option>
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="60">1 hour</option>
            </Select>
          </FormGroup>
          <p style={{ fontFamily: font, fontSize: '12px', color: C.warmGray, marginTop: '20px' }}>
            Buffer time is added after each session to give you a break before the next one.
          </p>
        </div>
      </Panel>

      {/* Weekly Schedule */}
      <Panel title="Weekly Schedule" icon="📅">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {DAYS.map((dayName, dayIdx) => {
            const daySlots = slots.filter(s => s.dayOfWeek === dayIdx);
            const isActive = daySlots.length > 0;

            return (
              <div
                key={dayIdx}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 1fr auto',
                  gap: '16px',
                  alignItems: 'start',
                  padding: '16px 0',
                  borderBottom: dayIdx < 6 ? '1px solid rgba(232,184,75,0.1)' : 'none',
                }}
              >
                {/* Day label + toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '6px' }}>
                  <button
                    onClick={() => {
                      if (isActive) {
                        setSlots(prev => prev.filter(s => s.dayOfWeek !== dayIdx));
                      } else {
                        addSlot(dayIdx);
                      }
                    }}
                    style={{
                      width: '36px',
                      height: '20px',
                      borderRadius: '10px',
                      border: 'none',
                      cursor: 'pointer',
                      background: isActive ? C.gold : '#ddd',
                      position: 'relative',
                      transition: 'background 0.2s',
                    }}
                  >
                    <span style={{
                      position: 'absolute',
                      top: '2px',
                      left: isActive ? '18px' : '2px',
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      background: C.white,
                      transition: 'left 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                    }} />
                  </button>
                  <span style={{
                    fontFamily: font,
                    fontSize: '13px',
                    fontWeight: 500,
                    color: isActive ? C.charcoal : C.warmGray,
                    minWidth: '40px',
                  }}>
                    {DAYS_SHORT[dayIdx]}
                  </span>
                </div>

                {/* Time slots */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {isActive ? daySlots.map((slot, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <select
                        value={slot.startTime}
                        onChange={e => updateSlot(dayIdx, idx, 'startTime', e.target.value)}
                        style={{
                          fontFamily: font, fontSize: '13px', color: C.charcoal,
                          background: C.offWhite, border: '1.5px solid rgba(232,184,75,0.3)',
                          borderRadius: '6px', padding: '6px 10px', outline: 'none',
                        }}
                      >
                        {TIMES.map(t => (
                          <option key={t} value={t}>{formatTime12(t)}</option>
                        ))}
                      </select>
                      <span style={{ fontFamily: font, fontSize: '12px', color: C.warmGray }}>to</span>
                      <select
                        value={slot.endTime}
                        onChange={e => updateSlot(dayIdx, idx, 'endTime', e.target.value)}
                        style={{
                          fontFamily: font, fontSize: '13px', color: C.charcoal,
                          background: C.offWhite, border: '1.5px solid rgba(232,184,75,0.3)',
                          borderRadius: '6px', padding: '6px 10px', outline: 'none',
                        }}
                      >
                        {TIMES.map(t => (
                          <option key={t} value={t}>{formatTime12(t)}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => removeSlot(dayIdx, idx)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: C.warmGray, fontSize: '16px', padding: '4px',
                        }}
                        title="Remove this time block"
                      >
                        ×
                      </button>
                    </div>
                  )) : (
                    <span style={{ fontFamily: font, fontSize: '12px', color: C.warmGray, paddingTop: '6px' }}>
                      Unavailable
                    </span>
                  )}

                  {isActive && (
                    <button
                      onClick={() => addSlot(dayIdx)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontFamily: font, fontSize: '11px', color: C.gold,
                        textAlign: 'left', padding: '2px 0', fontWeight: 500,
                      }}
                    >
                      + Add another time block
                    </button>
                  )}
                </div>

                {/* Copy actions */}
                <div style={{ display: 'flex', gap: '4px', paddingTop: '6px' }}>
                  {isActive && (
                    <>
                      <button
                        onClick={() => copyToWeekdays(dayIdx)}
                        title="Copy to weekdays"
                        style={{
                          background: 'none', border: '1px solid rgba(232,184,75,0.3)',
                          borderRadius: '4px', padding: '4px 8px', cursor: 'pointer',
                          fontFamily: font, fontSize: '10px', color: C.warmGray,
                        }}
                      >
                        Mon–Fri
                      </button>
                      <button
                        onClick={() => copyToAll(dayIdx)}
                        title="Copy to all days"
                        style={{
                          background: 'none', border: '1px solid rgba(232,184,75,0.3)',
                          borderRadius: '4px', padding: '4px 8px', cursor: 'pointer',
                          fontFamily: font, fontSize: '10px', color: C.warmGray,
                        }}
                      >
                        All
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* Save */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '8px' }}>
        <Btn variant="secondary" onClick={load}>Reset</Btn>
        <Btn onClick={handleSave} style={saving ? { opacity: 0.6 } : {}}>
          {saving ? 'Saving...' : 'Save Availability'}
        </Btn>
      </div>

      {/* Info */}
      <div style={{
        marginTop: '28px', fontFamily: font, fontSize: '13px', color: C.warmGray,
        lineHeight: 1.6, padding: '16px', background: C.offWhite, borderRadius: '8px',
        borderLeft: `3px solid ${C.gold}`,
      }}>
        <strong style={{ color: C.charcoal }}>How availability works:</strong> Set your regular weekly hours here.
        When Calendly is connected, seekers will see available slots based on both your weekly hours and your Calendly schedule.
        Blocked or booked slots are automatically excluded.
      </div>
    </div>
  );
}
