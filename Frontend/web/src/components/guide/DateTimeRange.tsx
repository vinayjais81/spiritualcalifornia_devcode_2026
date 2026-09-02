'use client';

import React from 'react';
import { C, font, FormGroup, Input, Select } from '@/components/guide/dashboard-ui';

/**
 * Date + start/end time picker for events.
 *
 * Replaces a pair of bare `datetime-local` inputs. Those were hard to use for
 * two reasons: the control is a row of tiny segments that have to be filled in
 * the browser's own order, and it renders its calendar in a native popup —
 * which was also what made the surrounding dialog vanish (see the Modal
 * comment in dashboard-ui.tsx).
 *
 * The shape here is one date plus two readable time dropdowns, because that is
 * how an event is actually described ("Friday the 12th, 6 to 8"). Times are
 * 15-minute steps in 12-hour form, which is every start time a session
 * realistically begins on.
 *
 * MULTI-DAY. Event types include RETREAT and SOUL_TRAVEL, so an end time on a
 * later date is legitimate and a duration picker would have been wrong. Rather
 * than make every single-session event pay for that, a checkbox reveals an end
 * date. It turns itself on when editing an event that already spans days, so an
 * existing retreat never silently collapses to one day on save.
 *
 * The value contract is unchanged: `startTime`/`endTime` stay `datetime-local`
 * strings (`YYYY-MM-DDTHH:mm`), so the page's save() is untouched.
 */

const STEP_MINUTES = 15;

/** '18:30' -> '6:30 PM'. Built from parts rather than Date to avoid any TZ shift. */
function label24to12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

const TIME_OPTIONS: { value: string; label: string }[] = (() => {
  const out = [];
  for (let mins = 0; mins < 24 * 60; mins += STEP_MINUTES) {
    const v = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    out.push({ value: v, label: label24to12(v) });
  }
  return out;
})();

/** Split 'YYYY-MM-DDTHH:mm' without constructing a Date (which would localise it). */
function split(value: string): { date: string; time: string } {
  if (!value || !value.includes('T')) return { date: value || '', time: '' };
  const [date, rest] = value.split('T');
  return { date, time: (rest || '').slice(0, 5) };
}

const join = (date: string, time: string) => (date && time ? `${date}T${time}` : '');

function todayLocal() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * A chosen time may not land on a 15-minute step — an event created before this
 * component existed, or one edited in Calendly. Show it as its own option
 * instead of snapping the value, which would edit data the user never touched.
 */
function optionsIncluding(time: string) {
  if (!time || TIME_OPTIONS.some(o => o.value === time)) return TIME_OPTIONS;
  return [...TIME_OPTIONS, { value: time, label: `${label24to12(time)} (exact)` }]
    .sort((a, b) => a.value.localeCompare(b.value));
}

function addMinutes(date: string, time: string, delta: number) {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(`${date}T00:00:00`);
  d.setMinutes(h * 60 + m + delta);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function describeSpan(start: string, end: string): string | null {
  if (!start || !end) return null;
  const a = new Date(start), b = new Date(end);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
  const mins = Math.round((b.getTime() - a.getTime()) / 60000);
  if (mins <= 0) return null;
  const days = Math.floor(mins / 1440);
  const hrs = Math.floor((mins % 1440) / 60);
  const rem = mins % 60;
  const parts = [];
  if (days) parts.push(`${days} day${days > 1 ? 's' : ''}`);
  if (hrs) parts.push(`${hrs} hr${hrs > 1 ? 's' : ''}`);
  if (rem) parts.push(`${rem} min`);
  return parts.join(' ');
}

/** True when the range is present but ends at or before it starts. */
export function isEndBeforeStart(startTime: string, endTime: string): boolean {
  if (!startTime || !endTime) return false;
  const a = new Date(startTime), b = new Date(endTime);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return false;
  return b.getTime() <= a.getTime();
}

export function DateTimeRange({
  startTime,
  endTime,
  onChange,
  minDate,
}: {
  startTime: string;
  endTime: string;
  onChange: (next: { startTime: string; endTime: string }) => void;
  minDate?: string;
}) {
  const s = split(startTime);
  const e = split(endTime);

  // Derived, not stored: an existing multi-day event has to show its end date
  // on open, and a user who unchecks then rechecks should not see stale state.
  const spansDays = !!(s.date && e.date && e.date !== s.date);
  const [multiDayChecked, setMultiDayChecked] = React.useState(spansDays);
  const multiDay = multiDayChecked || spansDays;

  const setStartDate = (date: string) => {
    // Keep the end on the same day unless the event is explicitly multi-day,
    // otherwise moving the date leaves the end stranded in the old one.
    const nextEnd = multiDay ? endTime : join(date, e.time);
    onChange({ startTime: join(date, s.time), endTime: nextEnd });
  };

  // `join` yields '' when either half is missing, so touching a time before a
  // date would discard the selection and the dropdown would snap back to its
  // placeholder — the control reading as broken. Nothing forces the user to
  // fill these top-down, so fall back to today and let them correct the date.
  const dateFor = (d: string) => d || todayLocal();

  const setStartTimeOfDay = (time: string) => {
    const date = dateFor(s.date);
    const nextStart = join(date, time);
    // First time chosen and no end yet: offer a one-hour default rather than
    // leaving a required field empty. Rolls the date if it crosses midnight.
    if (!endTime) {
      const plus = addMinutes(date, time, 60);
      if (plus.date !== date) setMultiDayChecked(true);
      onChange({ startTime: nextStart, endTime: join(plus.date, plus.time) });
      return;
    }
    onChange({ startTime: nextStart, endTime });
  };

  const setEndTimeOfDay = (time: string) =>
    onChange({ startTime, endTime: join(multiDay ? dateFor(e.date || s.date) : dateFor(s.date), time) });

  const setEndDate = (date: string) =>
    onChange({ startTime, endTime: join(date, e.time || s.time || '09:00') });

  const toggleMultiDay = (on: boolean) => {
    setMultiDayChecked(on);
    // Collapsing back to one day: pull the end onto the start's date so the
    // hidden end-date field cannot keep a value the user can no longer see.
    if (!on && s.date) onChange({ startTime, endTime: join(s.date, e.time) });
  };

  const invalid = isEndBeforeStart(startTime, endTime);
  const span = describeSpan(startTime, endTime);

  return (
    <>
      <FormGroup label={multiDay ? 'Start Date' : 'Date'} required htmlFor="ev-start-date">
        <Input
          id="ev-start-date"
          required
          aria-required="true"
          type="date"
          min={minDate}
          value={s.date}
          onChange={ev => setStartDate(ev.target.value)}
        />
      </FormGroup>

      <FormGroup label="Starts At" required htmlFor="ev-start-time">
        <Select
          id="ev-start-time"
          required
          aria-required="true"
          value={s.time}
          onChange={ev => setStartTimeOfDay(ev.target.value)}
        >
          <option value="" disabled>Select a time</option>
          {optionsIncluding(s.time).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </FormGroup>

      {multiDay && (
        <FormGroup label="End Date" required htmlFor="ev-end-date">
          <Input
            id="ev-end-date"
            required
            aria-required="true"
            type="date"
            min={s.date || minDate}
            value={e.date}
            onChange={ev => setEndDate(ev.target.value)}
          />
        </FormGroup>
      )}

      <FormGroup label="Ends At" required htmlFor="ev-end-time">
        <Select
          id="ev-end-time"
          required
          aria-required="true"
          value={e.time}
          onChange={ev => setEndTimeOfDay(ev.target.value)}
          style={invalid ? { borderColor: C.red } : undefined}
        >
          <option value="" disabled>Select a time</option>
          {optionsIncluding(e.time).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </FormGroup>

      <div style={{ gridColumn: '1 / -1', marginTop: '-6px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontFamily: font, fontSize: '12px', color: C.charcoal }}>
          <input
            type="checkbox"
            checked={multiDay}
            onChange={ev => toggleMultiDay(ev.target.checked)}
            style={{ accentColor: C.gold, width: '15px', height: '15px', cursor: 'pointer' }}
          />
          Ends on a different day
          <span style={{ color: C.warmGray }}>— for retreats and multi-day gatherings</span>
        </label>

        {invalid ? (
          <div role="alert" style={{ marginTop: '8px', fontFamily: font, fontSize: '12px', color: C.red }}>
            The end time is before the start. {!multiDay && 'Tick “Ends on a different day” if this event runs overnight.'}
          </div>
        ) : span ? (
          <div style={{ marginTop: '8px', fontFamily: font, fontSize: '12px', color: C.warmGray }}>
            Runs <strong style={{ color: C.charcoal }}>{span}</strong>
          </div>
        ) : null}
      </div>
    </>
  );
}
