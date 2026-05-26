import { Node } from '@tiptap/core';

/**
 * Tiptap node extensions that round-trip the rich-layout card markup
 * used by StaticPageRenderer's `.pillar` and `.steps-box` blocks.
 *
 * Without these, Tiptap's StarterKit would silently strip the
 * surrounding `<div class="…">` elements on save, destroying the visual
 * layout the seed migrations install (see
 * 20260526140000_richer_mission_layout).
 *
 * Each node defines:
 *   • parseHTML — the selector that matches the existing markup when
 *     the editor loads the body
 *   • renderHTML — the markup emitted on save (must match the public
 *     renderer's CSS selectors)
 *
 * Schema is intentionally strict for the "shape" elements (icon, title,
 * num, the box wrappers themselves) and permissive for the descriptive
 * text blocks (allow any inline content + standard StarterKit marks).
 * That gives admins full prose-editing power inside each card while
 * locking the structural layout.
 *
 * The 8 nodes split into two families:
 *
 *   Pillar family (used on /mission's four commitments):
 *     - pillar          → outer card; contains exactly icon + title + text
 *     - pillarIcon      → the gold-tinted emoji circle
 *     - pillarTitle     → the serif heading line
 *     - pillarText      → the gray descriptive paragraph
 *
 *   Steps-box family (used on /mission's verification flow):
 *     - stepsBox        → outer container; H3 heading + one-or-more steps
 *     - step            → row: numbered circle + body
 *     - stepNum         → the gold-circle number/character
 *     - stepBody        → the strong title + span/paragraph description
 *
 * To enable, pass `staticPageBlocks` to <RichTextEditor>.
 */

// ─── Pillar family ──────────────────────────────────────────────────────

export const Pillar = Node.create({
  name: 'pillar',
  group: 'block',
  // Strict shape: exactly icon + title + text, in that order. Forces a
  // valid card on every insert/parse; bad partial states can't sneak in.
  content: 'pillarIcon pillarTitle pillarText',
  defining: true,
  isolating: true,
  parseHTML() {
    return [{ tag: 'div.pillar' }];
  },
  renderHTML() {
    return ['div', { class: 'pillar' }, 0];
  },
});

export const PillarIcon = Node.create({
  name: 'pillarIcon',
  content: 'text*',
  // No inline marks — the icon is one or two characters (usually an
  // emoji); bold/italic would be visual noise inside the gold circle.
  marks: '',
  defining: true,
  parseHTML() {
    return [{ tag: 'div.pillar-icon' }];
  },
  renderHTML() {
    return ['div', { class: 'pillar-icon' }, 0];
  },
});

export const PillarTitle = Node.create({
  name: 'pillarTitle',
  content: 'inline*',
  defining: true,
  parseHTML() {
    return [{ tag: 'div.pillar-title' }];
  },
  renderHTML() {
    return ['div', { class: 'pillar-title' }, 0];
  },
});

export const PillarText = Node.create({
  name: 'pillarText',
  content: 'inline*',
  defining: true,
  parseHTML() {
    return [{ tag: 'p.pillar-text' }];
  },
  renderHTML() {
    return ['p', { class: 'pillar-text' }, 0];
  },
});

// ─── Steps-box family ───────────────────────────────────────────────────

export const StepsBox = Node.create({
  name: 'stepsBox',
  group: 'block',
  // H3 (StarterKit's heading) + one or more steps. The leading heading
  // is required so the box is always self-introducing.
  content: 'heading step+',
  defining: true,
  isolating: true,
  parseHTML() {
    return [{ tag: 'div.steps-box' }];
  },
  renderHTML() {
    return ['div', { class: 'steps-box' }, 0];
  },
});

export const Step = Node.create({
  name: 'step',
  content: 'stepNum stepBody',
  defining: true,
  parseHTML() {
    return [{ tag: 'div.step' }];
  },
  renderHTML() {
    return ['div', { class: 'step' }, 0];
  },
});

export const StepNum = Node.create({
  name: 'stepNum',
  content: 'text*',
  marks: '',
  defining: true,
  parseHTML() {
    return [{ tag: 'div.step-num' }];
  },
  renderHTML() {
    return ['div', { class: 'step-num' }, 0];
  },
});

export const StepBody = Node.create({
  name: 'stepBody',
  // Strict shape: a title line + a description line. Mirrors the
  // pillar/title/text pattern so the editing UX is consistent across
  // both card families.
  content: 'stepTitle stepText',
  defining: true,
  parseHTML() {
    return [{ tag: 'div.step-body' }];
  },
  renderHTML() {
    return ['div', { class: 'step-body' }, 0];
  },
});

export const StepTitle = Node.create({
  name: 'stepTitle',
  content: 'inline*',
  defining: true,
  parseHTML() {
    return [
      { tag: 'p.step-title' },
      // Legacy fallback: the original mission seed used a bare <strong>
      // inside .step-body. Match that too so the first editor open
      // doesn't lose the title; renderHTML normalizes it to <p> on save.
      {
        tag: 'strong',
        getAttrs: (el) => {
          const parent = (el as HTMLElement).parentElement;
          return parent?.classList.contains('step-body') ? {} : false;
        },
      },
    ];
  },
  renderHTML() {
    return ['p', { class: 'step-title' }, 0];
  },
});

export const StepText = Node.create({
  name: 'stepText',
  content: 'inline*',
  defining: true,
  parseHTML() {
    return [
      { tag: 'p.step-text' },
      // Legacy fallback for the original <span> shape.
      {
        tag: 'span',
        getAttrs: (el) => {
          const parent = (el as HTMLElement).parentElement;
          return parent?.classList.contains('step-body') ? {} : false;
        },
      },
    ];
  },
  renderHTML() {
    return ['p', { class: 'step-text' }, 0];
  },
});

/**
 * Convenience array — drop this into Tiptap's `extensions` list.
 *
 *   useEditor({
 *     extensions: [StarterKit, ...staticPageBlockExtensions],
 *   });
 */
export const staticPageBlockExtensions = [
  Pillar,
  PillarIcon,
  PillarTitle,
  PillarText,
  StepsBox,
  Step,
  StepNum,
  StepBody,
  StepTitle,
  StepText,
];
