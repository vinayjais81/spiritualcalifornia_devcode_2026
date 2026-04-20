'use client';

import { useState, useMemo } from 'react';

interface Props {
  /** YYYY-MM-DD strings that should show a gold dot */
  eventDates: string[];
  /** YYYY-MM-DD — controlled selected date, or null */
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Mini month-view calendar matching the events.html sidebar design.
 * - Charcoal header with month label + prev/next
 * - Weekday row (Su Mo Tu We Th Fr Sa)
 * - Days grid: today highlighted gold, selected charcoal, event-days show a gold dot
 * - Clicking a selected day again clears the selection (toggle behavior)
 */
export function MiniCalendar({ eventDates, selectedDate, onSelectDate }: Props) {
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const changeMonth = (dir: number) => {
    let m = viewMonth + dir;
    let y = viewYear;
    if (m > 11) { m = 0; y++; }
    if (m < 0) { m = 11; y--; }
    setViewMonth(m);
    setViewYear(y);
  };

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();
  const eventSet = useMemo(() => new Set(eventDates), [eventDates]);

  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const leadingBlanks: number[] = [];
  for (let i = firstDay - 1; i >= 0; i--) leadingBlanks.push(daysInPrev - i);

  const daysArr: number[] = [];
  for (let d = 1; d <= daysInMonth; d++) daysArr.push(d);

  const totalShown = firstDay + daysInMonth;
  const trailing = totalShown % 7 === 0 ? 0 : 7 - (totalShown % 7);
  const trailingArr: number[] = [];
  for (let i = 1; i <= trailing; i++) trailingArr.push(i);

  return (
    <div style={{
      background: '#fff',
      borderRadius: 16,
      boxShadow: '0 2px 20px rgba(58,53,48,0.07)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 20px', background: '#3A3530',
      }}>
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          style={navBtnStyle}
          aria-label="Previous month"
        >
          ‹
        </button>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 18, color: '#fff', fontWeight: 400,
        }}>
          {MONTHS[viewMonth]} {viewYear}
        </div>
        <button
          type="button"
          onClick={() => changeMonth(1)}
          style={navBtnStyle}
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div style={{ padding: 16 }}>
        {/* Weekdays */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 6 }}>
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((w) => (
            <div key={w} style={{
              textAlign: 'center', fontSize: 10, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: '#8A8278', padding: '4px 0',
            }}>
              {w}
            </div>
          ))}
        </div>

        {/* Days */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {leadingBlanks.map((n, i) => (
            <div key={`lead-${i}`} style={otherMonthStyle}>{n}</div>
          ))}
          {daysArr.map((d) => {
            const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(d)}`;
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const hasEvent = eventSet.has(dateStr);

            const bg = isSelected ? '#3A3530' : isToday ? '#E8B84B' : 'transparent';
            const color = isSelected ? '#fff' : '#3A3530';

            return (
              <button
                key={d}
                type="button"
                onClick={() => onSelectDate(isSelected ? null : dateStr)}
                style={{
                  aspectRatio: '1',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, borderRadius: 8,
                  cursor: 'pointer', border: 'none', position: 'relative',
                  background: bg,
                  color,
                  fontWeight: isToday || isSelected ? 600 : 400,
                  transition: 'all 0.2s',
                }}
              >
                {d}
                {hasEvent && (
                  <span style={{
                    position: 'absolute', bottom: 3, left: '50%',
                    transform: 'translateX(-50%)',
                    width: 4, height: 4, borderRadius: '50%',
                    background: isSelected ? '#E8B84B' : '#E8B84B',
                  }} />
                )}
              </button>
            );
          })}
          {trailingArr.map((n, i) => (
            <div key={`trail-${i}`} style={otherMonthStyle}>{n}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid rgba(255,255,255,0.2)',
  color: '#fff',
  width: 30, height: 30, borderRadius: '50%',
  cursor: 'pointer', fontSize: 14,
  transition: 'all 0.2s',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const otherMonthStyle: React.CSSProperties = {
  aspectRatio: '1',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 13, color: 'rgba(138,130,120,0.4)',
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
