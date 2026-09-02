# Event time selector, and why dialogs stopped vanishing

Client feedback, 2026-09-02: *"When user click outside of time selector dialog
disappeared. Also, it's better to make UI of time selector more user friendly."*

Two separate defects on the guide's **Add / Edit Event** dialog.

## 1. The dialog vanished, taking the form with it

`Modal` in `components/guide/dashboard-ui.tsx` closed on a bare
`onClick={onClose}` attached to the backdrop. Seven dialogs use that component
and six of them wrap a data-entry form, so an accidental dismissal did not just
close a panel — it silently destroyed everything typed.

A `datetime-local` field is what made it reproducible. The browser paints that
calendar/time popup **outside the page's DOM**, so dismissing the popup with a
click puts that click over the backdrop and closes the whole form. Two other
everyday gestures did the same thing: drag-selecting text in a field and
releasing past the dialog edge (`click` fires on the nearest common ancestor),
and a slightly-missed scrollbar.

**Fix:** a dismissal now only counts when the gesture *begins and ends* on the
backdrop. `onPointerDown` records where the press started; the inner container
stops propagation, so anything originating inside the dialog — or from a browser
popup that never generated a `pointerdown` in the page at all — can no longer
close it. `Escape` closes, which is the predictable exit and what the
accessibility contract expects. The dialog also gained `role="dialog"`,
`aria-modal`, and `aria-labelledby`.

This fix is central, so it covers the blog, calendar, events, products,
services, verification and seeker-tour-cancel dialogs at once.

> Not covered: `GlobalSearchModal`, `GalleryLightbox`, the two dashboard nav
> drawers, and the seeker booking-detail overlay each roll their own backdrop.
> None of them wraps a form, so a stray dismissal costs nothing.

## 2. The time selector itself

`Date & Start Time` and `End Time` were two raw `datetime-local` inputs — a row
of tiny segments filled in the browser's order, with no indication of how long
the event ran.

Replaced by `components/guide/DateTimeRange.tsx`: one date field, then start and
end as readable 12-hour dropdowns in 15-minute steps, which is how an event is
actually described ("Friday the 12th, 6 to 8").

**Multi-day is the constraint that shaped this.** Event types include `RETREAT`
and `SOUL_TRAVEL`, so an end time on a later date is legitimate — which ruled
out the obvious "start time + duration preset" design. Instead an *Ends on a
different day* checkbox reveals an end date, so multi-day works without every
single-session event paying for it. The checkbox turns itself on when editing an
event that already spans days, so an existing retreat cannot silently collapse
to one day on save.

Details worth keeping:

- **Off-step times are preserved, not snapped.** An event created before this
  component existed may sit at `18:37`; it appears as its own `6:37 PM (exact)`
  option rather than being rewritten to `18:30`, so opening a dialog never edits
  data the user did not touch.
- **Picking a time before a date used to be a no-op.** `join()` returns `''`
  when either half is missing, so the dropdown snapped back to its placeholder
  and read as broken. Nothing forces top-down entry, so the date now falls back
  to today and the user can correct it.
- **Choosing a start with no end fills in one hour**, rolling the date and
  ticking the multi-day box if it crosses midnight.
- **A summary line** reads `Runs 2 days 1 hr 30 min`.
- **An inverted range** is flagged inline and blocks save with a toast. The
  button is deliberately not disabled — a refused submit must always say why
  (see `project_form_validation_feedback`).

The value contract is unchanged: `startTime` / `endTime` remain
`datetime-local` strings, so the page's `save()` was untouched.

## Verification

`tsc --noEmit` and `next build` both clean. The date algorithms were exercised
directly — 18 checks covering midnight and new-year rollover, noon/midnight
12-hour labelling (`12:00 PM`, not `0:00 PM`), multi-day span text, inverted vs
overnight ranges, and off-step preservation. There is no frontend test runner in
this project, so those ran as a one-off against the extracted helpers.

## Still open

The public booking flow (`/book/[guideSlug]`, step 2) has its own `type="date"` +
`type="time"` pair where a seeker retypes what they booked in Calendly. It is
not a dialog, so it has neither defect, but it is the more client-visible
control and `DateTimeRange` is reusable there if that is wanted next.
