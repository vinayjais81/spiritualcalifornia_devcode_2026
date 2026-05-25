-- ─── Seed the California Seller of Travel disclosures page ──────────────
--
-- Inserts the StaticPage row that backs the `/travel-disclosures` route
-- (Frontend/web/src/app/travel-disclosures/page.tsx, slug =
-- "travel-disclosures") so the page is live the moment this migration
-- deploys. Mirrors the 20260525120000_seed_refund_policy convention.
--
-- ON CONFLICT (slug) DO NOTHING — safe to re-run; preserves admin
-- edits made through /admin/static-pages after the initial seed.

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
  'travel-disclosures',
  'Travel Disclosures',
  'Travel Disclosures | Spiritual California',
  'California Seller of Travel disclosures required under California Business & Professions Code §17550.13 and §17550.20.',
  'Legal · Seller of Travel',
  'Provided under California Business & Professions Code §17550.13 & §17550.20.',
  $body$
<p>Spiritual California Inc. is a registered California Seller of Travel. The disclosures below are provided to every traveler, and the journey-specific items (total price, payment schedule, the provider of your services, and your departure details) are also disclosed to you at the time of booking and on your booking confirmation and receipt.</p>

<h2>1 — Seller of Travel identity</h2>
<p>Travel is arranged by <strong>Spiritual California Inc.</strong>, a corporation registered to do business in the State of California, located at 631 E El Camino Real, Sunnyvale, CA 94087. Telephone: (408) 780-4722. Email: <a href="mailto:tours@spiritualcalifornia.com">tours@spiritualcalifornia.com</a>. California Seller of Travel Registration: <strong>CST #2171340-40</strong>.</p>

<h2>2 — State of California registration disclaimer</h2>
<p>Registration as a seller of travel does not constitute approval by the State of California.</p>

<h2>3 — Our role and the provider of your travel services</h2>
<p>Spiritual California Inc. acts as a travel agent. Each journey is delivered by an independent local tour operator, accommodation, guide, healer, or other supplier that is registered or licensed in its own country. Spiritual California is not the tour operator, air carrier, or accommodation provider, and does not directly operate or supervise the on-the-ground program.</p>
<p>The name of the operator and the other providers of the transportation and travel services for your specific journey is disclosed to you on that journey's page, at booking, and on your booking confirmation and receipt. Spiritual California does not sell air transportation and does not act as an air carrier; unless expressly stated, you are responsible for arranging your own flights.</p>

<h2>4 — Total amount to be paid and payment schedule</h2>
<p>The total amount payable for your journey, the deposit due at booking, and the balance and its due date are shown to you before you pay and are itemized on your booking confirmation and receipt. The total includes the accommodation, meals, ground transport, and program activities listed under "What's Included" for that journey. It does not include airfare to the gateway, visas or entry fees, optional excursions, gratuities, or travel insurance, unless expressly stated.</p>

<h2>5 — Cancellation and refund rights</h2>
<p>You have cancellation and refund rights as set out in our <a href="/refund-policy">Cancellation &amp; Refund Policy</a>, which is provided to you and which you agree to at booking. It explains the deposit and balance schedule, the cancellation tiers, what happens if Spiritual California cancels a journey, minimum group sizes, force-majeure handling, and refund processing times. Travel insurance covering trip cancellation is strongly recommended; Spiritual California does not sell insurance and is not a licensed insurance agent.</p>

<h2>6 — Refund commitment</h2>
<p><em>Required statement</em></p>
<blockquote>Upon cancellation of the travel or travel services, when the passenger is not at fault and has not cancelled in violation of any terms and conditions previously clearly and conspicuously disclosed and agreed to by the passenger, all sums paid to Spiritual California Inc. for services not provided to the passenger will be promptly paid to the passenger, unless the passenger advises Spiritual California Inc. otherwise in writing, after the passenger cancels.</blockquote>

<h2>7 — Trust account</h2>
<p><em>Required statement</em></p>
<blockquote>California law requires certain sellers of travel to have a trust account or bond. This business has a trust account. One hundred percent (100%) of customer funds are deposited into a client trust account and withdrawn only in compliance with Section 17550.15 of the Seller of Travel law.</blockquote>

<h2>8 — Travel Consumer Restitution Fund — California residents</h2>
<p><em>Required statement · Spiritual California is a participant</em></p>
<blockquote>This transaction is covered by the California Travel Consumer Restitution Fund (TCRF) if the passenger is located in California at the time of payment. Eligible passengers may file a claim with the TCRF if they are owed a refund of more than $50 for transportation or travel services that the seller of travel failed to forward to the proper provider, or that were not refunded to the passenger when required. The maximum amount that may be paid by the TCRF to any one passenger is the total amount paid to the seller of travel on behalf of the passenger, to a maximum of $15,000. A claim must be filed with the TCRF within 12 months after the scheduled completion date of the travel. A claim must include sufficient documentation to prove the claim and a $35 processing fee. Claimants must agree to waive their right to other civil remedies against a registered participating seller of travel for matters arising out of the transaction. Claims may be filed with the Travel Consumer Restitution Corporation at P.O. Box 6001, Larkspur, CA 94977-6001, or online at <a href="https://www.tcrcinfo.org" target="_blank" rel="noopener noreferrer">www.tcrcinfo.org</a>.</blockquote>

<h2>9 — Travel Consumer Restitution Fund — passengers residing outside California</h2>
<p><em>Required statement</em></p>
<blockquote>The California Travel Consumer Restitution Fund does not cover passengers who reside outside the State of California. If you are not a California resident, this transaction is not covered by the California Travel Consumer Restitution Fund.</blockquote>

<hr/>

<p><strong>Spiritual California Inc.</strong><br/>
631 E El Camino Real, Sunnyvale, CA 94087<br/>
Email: <a href="mailto:tours@spiritualcalifornia.com">tours@spiritualcalifornia.com</a> &nbsp;·&nbsp; Phone: (408) 780-4722<br/>
California Seller of Travel CST #2171340-40</p>

<p><small>© 2026 Spiritual California Inc. · These Travel Disclosures are provided under California Business &amp; Professions Code §17550 et seq. and should be read together with our Terms of Service, Privacy Policy, and Cancellation &amp; Refund Policy. The journey-specific disclosures (total price, payment schedule, provider, and departure details) are also provided at booking and on your receipt.</small></p>
  $body$,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
) ON CONFLICT ("slug") DO NOTHING;
