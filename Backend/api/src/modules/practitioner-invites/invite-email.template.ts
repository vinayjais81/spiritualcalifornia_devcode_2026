/**
 * The practitioner invite email.
 *
 * Cold outreach to someone who never asked to hear from us, so every element
 * below is either a legal requirement or a deliberate decision recorded in
 * docs/practitioner-import-invite-strategy.md §8a:
 *
 *   - Sender is a named person (Lana Rafaella), not a brand.
 *   - We say **where we found them**. It is the first question they will ask,
 *     and CCPA notice-at-collection expects it.
 *   - We say the profile is **reserved, not published**. Without this the
 *     natural reading is "you made a page about me", which is the single most
 *     likely angry reply.
 *   - Commission is named (20%) but the $50 listing plan is not — that plan is
 *     not enforced today, so quoting it would describe a charge that does not
 *     happen. The percentage is passed in from live config, never hardcoded
 *     (docs/commission-display-truth.md).
 *   - Physical postal address in the footer: required by CAN-SPAM.
 *   - The remove-me link sits next to it, in ordinary readable type. Burying
 *     an opt-out is both unlawful and a good way to earn a spam complaint
 *     instead of a quiet unsubscribe.
 */

export interface InviteEmailData {
  firstName: string;
  /** What the spreadsheet said they practise — used to prove this isn't a blast. */
  modality?: string | null;
  city?: string | null;
  /** Where the list came from, in words a human would use. */
  sourceDescription: string;
  claimUrl: string;
  unsubscribeUrl: string;
  commissionPercent: number;
  senderName: string;
  replyTo: string;
  postalAddress: string;
  /** Test-mode banner: the address this would have gone to in production. */
  redirectNotice?: string | null;
}

const C = {
  gold: '#F07814',
  goldPale: '#FEF7F0',
  charcoal: '#3A3530',
  warmGray: '#8A8278',
  faint: '#B5AFA8',
  rule: 'rgba(240,120,20,0.18)',
};

export function inviteEmailSubject(data: InviteEmailData): string {
  const base = `${data.firstName}, your practitioner profile on Spiritual California`;
  return data.redirectNotice ? `[TEST → ${data.redirectNotice}] ${base}` : base;
}

export function inviteEmailHtml(data: InviteEmailData): string {
  const practice = [data.modality, data.city].filter(Boolean).join(' · ');

  return `
<div style="font-family: 'Inter', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: ${C.charcoal};">

  ${
    data.redirectNotice
      ? `<div style="background: #FFF4E5; border: 1px solid #F0B27A; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; font-size: 12px; color: #8A5B1E;">
           <strong>Test mode.</strong> In production this would have gone to
           <strong>${escapeHtml(data.redirectNotice)}</strong>. Links below are real and will work.
         </div>`
      : ''
  }

  <div style="text-align: center; margin-bottom: 28px;">
    <div style="font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: ${C.gold};">
      Spiritual California
    </div>
  </div>

  <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">Hi ${escapeHtml(data.firstName)},</p>

  <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
    I'm building Spiritual California — a directory of <strong>verified</strong> practitioners
    across the Bay Area, so people looking for this work can find someone real
    without wading through the usual noise.
  </p>

  <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
    I came across your practice ${escapeHtml(data.sourceDescription)}${
      practice ? ` (${escapeHtml(practice)})` : ''
    }, and I've <strong>reserved a profile</strong> for you.
    <em>It isn't published, and nothing about you is visible to anyone</em> —
    it stays that way unless you claim it yourself.
  </p>

  <div style="background: ${C.goldPale}; border: 1px solid ${C.rule}; border-radius: 10px; padding: 20px 22px; margin: 26px 0;">
    <div style="font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: ${C.warmGray}; margin-bottom: 12px;">
      What claiming it involves
    </div>
    <div style="font-size: 14px; line-height: 1.8;">
      <strong>1.</strong> Set a password — a minute.<br/>
      <strong>2.</strong> Fill in your profile: bio, what you offer, your rates.<br/>
      <strong>3.</strong> Verification — ID and your credentials. This is the part
      that makes the "verified" badge mean something, and it's why we exist.
    </div>
  </div>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${data.claimUrl}"
       style="display: inline-block; padding: 15px 34px; background: ${C.gold}; color: #FFFFFF; border-radius: 8px; text-decoration: none; font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;">
      Claim my profile
    </a>
    <div style="font-size: 11px; color: ${C.faint}; margin-top: 12px;">
      This link is yours alone and works for 30 days.
    </div>
  </div>

  <p style="font-size: 14px; line-height: 1.7; margin: 0 0 16px; color: ${C.warmGray};">
    <strong style="color: ${C.charcoal};">What it costs:</strong> nothing to list.
    When you're booked through Spiritual California we keep ${data.commissionPercent}% —
    and we cover the card processing fees, so you receive exactly
    ${100 - data.commissionPercent}% of what a client pays.
  </p>

  <p style="font-size: 14px; line-height: 1.7; margin: 0 0 24px; color: ${C.warmGray};">
    If it's not for you, no hard feelings — just
    <a href="${data.unsubscribeUrl}" style="color: ${C.gold};">remove your information</a>
    and I won't contact you again. Or reply to this email and it comes straight to me.
  </p>

  <p style="font-size: 15px; line-height: 1.7; margin: 0 0 4px;">— ${escapeHtml(data.senderName)}</p>
  <p style="font-size: 13px; color: ${C.warmGray}; margin: 0 0 32px;">
    Spiritual California · <a href="mailto:${data.replyTo}" style="color: ${C.gold};">${data.replyTo}</a>
  </p>

  <div style="border-top: 1px solid ${C.rule}; padding-top: 18px; font-size: 11px; line-height: 1.7; color: ${C.faint};">
    You're receiving this because your practice is listed publicly ${escapeHtml(data.sourceDescription)}.
    We hold only your name, city and practice type.<br/>
    <a href="${data.unsubscribeUrl}" style="color: ${C.warmGray}; text-decoration: underline;">
      Remove my information
    </a>
    — one click, deletes everything we hold, permanently.<br/><br/>
    ${escapeHtml(data.postalAddress)}
  </div>
</div>`.trim();
}

/**
 * Plain-text alternative. Not optional: a text/plain part measurably improves
 * inbox placement, and some recipients read mail as text by choice.
 */
export function inviteEmailText(data: InviteEmailData): string {
  const practice = [data.modality, data.city].filter(Boolean).join(' · ');
  return `Hi ${data.firstName},

I'm building Spiritual California — a directory of verified practitioners across
the Bay Area, so people looking for this work can find someone real without
wading through the usual noise.

I came across your practice ${data.sourceDescription}${practice ? ` (${practice})` : ''},
and I've reserved a profile for you. It isn't published, and nothing about you is
visible to anyone — it stays that way unless you claim it yourself.

What claiming it involves:
  1. Set a password — a minute.
  2. Fill in your profile: bio, what you offer, your rates.
  3. Verification — ID and your credentials. This is the part that makes the
     "verified" badge mean something, and it's why we exist.

Claim your profile (valid 30 days):
${data.claimUrl}

What it costs: nothing to list. When you're booked through Spiritual California
we keep ${data.commissionPercent}% — and we cover the card processing fees, so you receive
exactly ${100 - data.commissionPercent}% of what a client pays.

If it's not for you, no hard feelings — remove your information here and I won't
contact you again:
${data.unsubscribeUrl}

Or just reply to this email; it comes straight to me.

— ${data.senderName}
Spiritual California · ${data.replyTo}

---
You're receiving this because your practice is listed publicly ${data.sourceDescription}.
We hold only your name, city and practice type. Removing your information deletes
everything we hold, permanently: ${data.unsubscribeUrl}

${data.postalAddress}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
