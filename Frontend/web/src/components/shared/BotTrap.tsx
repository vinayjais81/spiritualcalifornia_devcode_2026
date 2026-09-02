'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Honeypot + fill-timing for public forms.
 *
 * Added after the 2026-09-02 contact-form abuse. Rate limiting could not touch
 * it — the per-IP throttle was verified enforcing while submissions carried on
 * at ~19/hour, which only a distributed bot can do. So the question stops being
 * "how often is this IP asking" and becomes "is this a person".
 *
 * The server decides; this only supplies the evidence. See
 * `Backend/api/src/common/bot-signals.ts` for how each signal is weighted.
 */

/** Must match HONEYPOT_FIELD in the backend. */
const HONEYPOT_NAME = 'contactReference';

export function useBotTrap() {
  // Set once on first render and never updated — the elapsed time has to be
  // measured from when the form appeared, not from the last keystroke.
  const renderedAt = useRef<number>(Date.now());
  const [honeypot, setHoneypot] = useState('');

  const botFields = useCallback(
    () => ({
      [HONEYPOT_NAME]: honeypot,
      elapsedMs: Date.now() - renderedAt.current,
    }),
    [honeypot],
  );

  return { botFields, honeypot, setHoneypot };
}

/**
 * Render inside the <form>, anywhere.
 *
 * Hidden by moving it off-screen rather than `display: none`, because some bots
 * deliberately skip `display:none` inputs knowing they are usually traps. It is
 * kept out of the tab order and hidden from assistive tech, so nobody using a
 * keyboard or a screen reader can reach it by accident.
 *
 * The label is what a screen reader would announce if it ever were reached, and
 * the field name is deliberately bland: a password manager will happily autofill
 * a hidden input called `website` or `address` and turn a real person into a
 * false positive, which is the one failure this must not have.
 */
export function HoneypotField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: '-9999px',
        top: 'auto',
        width: 1,
        height: 1,
        overflow: 'hidden',
      }}
    >
      <label htmlFor={HONEYPOT_NAME}>Do not fill this in — it is for spam detection</label>
      <input
        id={HONEYPOT_NAME}
        name={HONEYPOT_NAME}
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
