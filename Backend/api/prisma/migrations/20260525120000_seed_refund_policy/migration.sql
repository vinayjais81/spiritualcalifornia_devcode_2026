-- ─── Seed the Soul Travels cancellation & refund policy page ────────────
--
-- Inserts the StaticPage row that backs the `/refund-policy` route
-- (Frontend/web/src/app/refund-policy/page.tsx, slug = "refund-policy")
-- so the page is live the moment this migration deploys — no manual CMS
-- step required. After seeding, admin can edit copy from
-- /admin/static-pages; the migration won't re-run.
--
-- ON CONFLICT (slug) DO NOTHING:
--   • Makes the migration idempotent.
--   • Critically, if an admin has already created or edited the row by
--     the time this migration lands, we leave their content alone. Seed
--     is for first-time deploys only.
--
-- Body is HTML targeted at StaticPageRenderer's `.static-page-body`
-- styles (h2 / h3 / p / ul / li / strong / a / blockquote / hr).
-- Dollar-quoted ($body$ … $body$) so apostrophes and quotes pass through
-- raw — no double-escaping.
--
-- Note: §2 contains the placeholder $[ADMIN FEE] which the policy author
-- left as a TODO ("set it to your actual booking-admin cost"). Admin
-- should replace this in /admin/static-pages before turning on live
-- payments.

INSERT INTO "static_pages" (
  "id",
  "slug",
  "title",
  "metaTitle",
  "metaDescription",
  "eyebrow",
  "subtitle",
  "body",
  "isPublished",
  "publishedAt",
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid()::text,
  'refund-policy',
  'Cancellation & Refund Policy',
  'Cancellation & Refund Policy | Spiritual California',
  'How deposits, balances, cancellations, and refunds work for every Soul Travels journey — US and international.',
  'Soul Travels',
  'Applies to all Soul Travels journeys, US and international.',
  $body$
<p>We want your journey to be transformative from the first click to the last day. This policy explains how deposits, balances, cancellations, and refunds work, in plain language. Please read it before you book — you'll be asked to agree to it as part of checkout.</p>

<h2>§ 1 — Who we are, and what this policy covers</h2>
<p>Spiritual California Inc. (California Seller of Travel registration CST #2171340-40) arranges curated spiritual journeys. We act as a travel agent: each journey is delivered on the ground by an independent local tour operator, retreat, accommodation, healer, or guide (each, an "Operator") that is licensed or registered in its own country. We are not the Operator. We select our Operators with care, but we do not run their programs or control their day-to-day operations, and our financial responsibility to you is limited to the amounts you have paid to Spiritual California Inc.</p>
<p>This policy applies to every Soul Travels journey we sell, whether the journey takes place in the United States or internationally. Where an individual journey page sets out different or stricter terms — because an Operator, permit, or government agency requires non-refundable pre-payment — those journey-specific terms control for that journey. Everything else here applies.</p>

<h2>§ 2 — Deposits &amp; payment schedule</h2>
<ul>
  <li><strong>Deposit at booking.</strong> A per-person deposit (shown on each journey page) is due to reserve your place. Of that deposit, <strong>$[ADMIN FEE] per person</strong> is non-refundable and covers booking administration and the initial commitments we make to Operators on your behalf.</li>
  <li><strong>Balance due 45 days before departure.</strong> The remaining balance is due no later than 45 days before your departure date. We will remind you, but it is your responsibility to pay on time.</li>
  <li><strong>Bookings made within 45 days of departure</strong> require payment in full at the time of booking.</li>
  <li><strong>Non-payment of the balance by its due date</strong> is treated as a cancellation by you, and the traveler-cancellation tiers in §3 apply as of the due date.</li>
  <li>All amounts are in <strong>US Dollars (USD)</strong>. If you pay with a card issued outside the United States, your bank may apply a foreign-currency conversion fee that is outside our control.</li>
</ul>

<h2>§ 3 — If you cancel: traveler cancellation tiers</h2>
<p>To cancel, you (or any traveler on your booking) must notify us in writing at <a href="mailto:tours@spiritualcalifornia.com">tours@spiritualcalifornia.com</a>. Your cancellation takes effect on the date we receive your written notice. The following applies to the total journey price unless the journey page states otherwise:</p>
<h3>60+ days before departure</h3>
<p>Refund of all sums paid, less (i) the non-refundable deposit portion in §2, and (ii) any payments we have already made on your behalf to Operators, accommodations, or government agencies that we cannot recover.</p>
<h3>30–59 days before departure</h3>
<p>50% of the total journey price is non-refundable. We refund the remaining 50%, less any non-recoverable third-party payments already made on your behalf.</p>
<h3>29 days or fewer before departure</h3>
<p>No refund. 100% of the journey price is non-refundable, because by this point our commitments to Operators are fully paid and non-recoverable.</p>
<blockquote><strong>Why the tiers tighten as departure nears.</strong> As a travel agent, we pay Operators, retreats, and government agencies in advance to hold your place. The closer you cancel to departure, the more of that money is already spent and cannot be returned to us. The tiers reflect real, non-recoverable costs — not a penalty. This is standard for curated small-group travel, and it is exactly why we strongly recommend travel insurance (§7).</blockquote>

<h2>§ 4 — Costs that are never refundable through us</h2>
<p>Some costs are paid by you directly to third parties, or are committed on your behalf and cannot be recovered regardless of when you cancel. These are <strong>not refundable</strong> through Spiritual California:</p>
<ul>
  <li>Airfare and any flights you book yourself to or from the gateway city.</li>
  <li>Visas, entry permits, conservation or temple-access fees, and other government charges.</li>
  <li>Travel insurance premiums.</li>
  <li>Any Operator deposit or permit (for example, a limited-access pilgrimage or ceremony slot) identified as non-refundable on the journey page.</li>
</ul>

<h2>§ 5 — If we cancel a journey</h2>
<p>Occasionally we must cancel a scheduled departure — most often because it does not reach the minimum number of travelers needed to run, or because an Operator can no longer deliver the program. If we cancel a journey for any reason within our control:</p>
<ul>
  <li>You may choose a <strong>full refund</strong> of every amount you paid to Spiritual California (including the otherwise non-refundable deposit), or</li>
  <li>A <strong>transfer of your full payment</strong> to another available journey or departure of equivalent value, or a credit toward a future journey.</li>
  <li>We will also do our best to assist with rebooking and to give you as much advance notice as possible.</li>
</ul>
<p>We are <strong>not</strong> responsible for costs you arranged independently around the journey — such as flights, visas, or pre-/post-trip accommodation. This is the main reason we recommend refundable airfare or travel insurance.</p>
<h3>Minimum group size</h3>
<p>Each journey runs only if it reaches a minimum number of travelers (stated on the journey page). If a departure does not meet its minimum, we may cancel it — usually no later than 30 days before departure — and the "if we cancel" terms above apply: full refund, transfer, or credit, your choice.</p>

<h2>§ 6 — Force majeure &amp; events beyond anyone's control</h2>
<p>"Force majeure" means circumstances neither we nor our Operators can reasonably control — including natural disasters, extreme weather, epidemics or pandemics, war or civil unrest, terrorism, border closures, government travel restrictions or advisories, strikes, or the failure of an Operator, airline, or supplier to perform.</p>
<p>If a journey cannot proceed, or must be cut short, because of force majeure, we will:</p>
<ul>
  <li>Refund all sums we are able to recover from Operators and suppliers for services not provided to you; and</li>
  <li>For amounts already paid on your behalf that the Operators or suppliers will not return, offer you a <strong>credit toward a future journey</strong> for the non-recoverable portion, valid for 24 months.</li>
</ul>
<p>Force majeure is no one's fault, and the financial loss is shared: we pass back what we can recover, and we are not able to refund money that has already been irrecoverably spent on your behalf. Travel insurance with cancellation and interruption cover is the right tool to protect against this — see §7.</p>

<h2>§ 7 — Travel insurance</h2>
<p>We <strong>strongly recommend</strong> that every traveler purchase comprehensive travel insurance at the time of booking, including trip cancellation, trip interruption, emergency medical, and emergency evacuation cover. Given the cancellation tiers above and the nature of remote and ceremonial travel, insurance is the most reliable way to protect the money you've paid.</p>
<p>Spiritual California does not sell travel insurance and is not a licensed insurance agent or broker. We cannot recommend a specific policy or advise you on coverage. Please obtain insurance directly from a licensed provider (for example, a comparison marketplace such as InsureMyTrip, or carriers such as Allianz, IMG, or World Nomads) and review the policy terms yourself before you buy.</p>

<h2>§ 8 — Itinerary changes &amp; substitutions</h2>
<p>Soul Travels journeys take place in living places, with weather, ceremony, and local conditions that can shift. Our Operators may need to substitute activities, accommodations, guides, or routes of comparable value and character — for example, moving a sunrise ceremony for weather, or changing a guide. These substitutions are part of authentic travel and are <strong>not grounds for a refund</strong>. We will tell you about material changes as soon as we reasonably can. Because the Operator delivers the program, decisions about on-the-ground changes rest with the Operator.</p>

<h2>§ 9 — Transfers, name changes &amp; substitutions of travelers</h2>
<p>If you can no longer travel, you may be able to transfer your place to another eligible traveler, subject to Operator approval and any supplier name-change fees, if you ask us in writing at least 30 days before departure. Transfers are not guaranteed and depend on the Operator's and suppliers' rules.</p>

<h2>§ 10 — California Seller of Travel disclosures</h2>
<p>The following disclosures are provided under California's Seller of Travel law (Business &amp; Professions Code §17550 et seq.).</p>
<h3>Refund commitment</h3>
<p>Upon cancellation of the travel or travel services, when you are not at fault and have not cancelled in violation of the terms and conditions previously clearly and conspicuously disclosed and agreed to, all sums paid to Spiritual California Inc. for services not provided to you will be promptly paid to you, unless you advise Spiritual California Inc. otherwise in writing.</p>
<h3>Refund processing time</h3>
<p>Eligible refunds are processed within 30 days, consistent with California Business &amp; Professions Code §17550.14, to the original method of payment.</p>
<h3>Trust account</h3>
<p>California law requires certain sellers of travel to have a trust account or bond. This business has a trust account. 100% of customer funds are deposited into a client trust account and withdrawn only in compliance with §17550.15 of the Seller of Travel law.</p>
<h3>Travel Consumer Restitution Fund (TCRF) — California residents</h3>
<p>This transaction is covered by the California Travel Consumer Restitution Fund (TCRF) if Spiritual California Inc. was registered and participating in the TCRF at the time of sale and the passenger is located in California at the time of payment. Eligible passengers may file a claim with the TCRF if they are owed a refund of more than $50 for travel services that Spiritual California Inc. failed to forward to the proper provider, or that were not refunded when required. The maximum payable to any one passenger is the total amount paid to the seller, up to $15,000. A claim must be filed within 12 months of the scheduled completion date, with documentation and a $35 processing fee. Claimants waive other civil remedies against the seller for matters arising from the claim. Claim forms: Travel Consumer Restitution Corporation, P.O. Box 6001, Larkspur, CA 94977-6001, or <a href="https://www.tcrcinfo.org" target="_blank" rel="noopener noreferrer">www.tcrcinfo.org</a>.</p>
<h3>Travel Consumer Restitution Fund (TCRF) — travelers outside California</h3>
<p>The California Travel Consumer Restitution Fund does not cover passengers who reside outside the State of California. If you are not a California resident, this transaction is not covered by the TCRF.</p>
<p><em>Registration as a seller of travel does not constitute approval by the State of California.</em></p>

<h2>§ 11 — Disputed charges</h2>
<p>If you have a concern about a charge, please contact us first at <a href="mailto:tours@spiritualcalifornia.com">tours@spiritualcalifornia.com</a> — we can almost always resolve it faster than your bank can. Initiating a chargeback for a charge that is non-refundable under this policy, which you agreed to at booking, does not change the terms you accepted.</p>

<h2>§ 12 — How to reach us &amp; how to cancel</h2>
<p><strong>Spiritual California Inc.</strong><br/>
631 E El Camino Real, Sunnyvale, CA 94087<br/>
Email: <a href="mailto:tours@spiritualcalifornia.com">tours@spiritualcalifornia.com</a> &nbsp;·&nbsp; Phone: (408) 780-4722<br/>
California Seller of Travel CST #2171340-40</p>
<p>To cancel, email us in writing. Your cancellation is effective on the date we receive your notice.</p>
<p>This policy is governed by the laws of the State of California. Any dispute will be handled as set out in our Terms of Service, which include individual arbitration and a class-action waiver. If any part of this policy is found unenforceable, the rest remains in effect. This Cancellation &amp; Refund Policy forms part of, and should be read together with, our Terms of Service and Travel Disclosures.</p>

<hr/>

<p><small>© 2026 Spiritual California Inc. · CST #2171340-40 · Registration as a seller of travel does not constitute approval by the State of California. This policy is a consumer disclosure, not a contract summary; the full terms you agree to at booking, together with the Terms of Service and Travel Disclosures, govern your booking.</small></p>
  $body$,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
) ON CONFLICT ("slug") DO NOTHING;
