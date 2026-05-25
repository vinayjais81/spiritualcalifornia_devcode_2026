-- ─── Seed / update the Terms of Service StaticPage row ─────────────────
--
-- Installs the client-finalized 2026-05-22 Terms text as the source of
-- truth for /terms. The `terms` slug has had a stub row in every
-- environment since the original CMS bootstrap, so this uses Pattern B
-- (INSERT ... ON CONFLICT DO UPDATE) — same approach as the privacy
-- seed migration, for the same reason.
--
-- After this migration, all four legal pages (terms, privacy,
-- refund-policy, travel-disclosures) carry the client's final text.
-- Future admin edits via /admin/static-pages are safe because Prisma
-- migrations only run once per environment.
--
-- The Contents list at the top of the body uses anchor links (#section-N)
-- that resolve to the matching <h2 id="section-N"> further down. Browsers
-- handle in-page navigation natively — no JS required.

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
  'terms',
  'Terms of Service',
  'Terms of Service | Spiritual California',
  'The agreement between you and Spiritual California Inc. for use of our website, app, and services — including arbitration, class-action waiver, and liability limits.',
  'Legal',
  'Spiritual California Inc. · CST #2171340-40.',
  $body$
<p>Welcome to Spiritual California. These Terms are the agreement between you and Spiritual California Inc. for your use of our website, app, and services. Please read them — especially <a href="#section-19">Section 19</a>, which requires most disputes to be resolved by individual arbitration and waives class actions, and <a href="#section-17">Sections 17</a>–<a href="#section-18">18</a>, which limit our liability and require you to indemnify us.</p>

<p>By creating an account, booking a journey, purchasing a product, booking a session, buying an event ticket, using the AI Guide, or otherwise using our services, you agree to these Terms, our <a href="/privacy">Privacy Policy</a>, our <a href="/refund-policy">Cancellation &amp; Refund Policy</a>, and our <a href="/travel-disclosures">Travel Disclosures</a>, which are incorporated here by reference. If you do not agree, do not use the services.</p>

<h2>Contents</h2>
<ol>
  <li><a href="#section-1">Who we are &amp; our role</a></li>
  <li><a href="#section-2">Definitions</a></li>
  <li><a href="#section-3">Eligibility &amp; accounts</a></li>
  <li><a href="#section-4">We are a marketplace, not the provider</a></li>
  <li><a href="#section-5">Soul Travels (tours)</a></li>
  <li><a href="#section-6">Practitioner sessions</a></li>
  <li><a href="#section-7">Events &amp; ticketing</a></li>
  <li><a href="#section-8">Conscious Shop</a></li>
  <li><a href="#section-9">The AI Spiritual Guide</a></li>
  <li><a href="#section-10">Not medical or professional advice</a></li>
  <li><a href="#section-11">Payments, pricing &amp; taxes</a></li>
  <li><a href="#section-12">Your content &amp; reviews</a></li>
  <li><a href="#section-13">Acceptable use</a></li>
  <li><a href="#section-14">Intellectual property</a></li>
  <li><a href="#section-15">Providers &amp; third parties</a></li>
  <li><a href="#section-16">Disclaimers</a></li>
  <li><a href="#section-17">Limitation of liability</a></li>
  <li><a href="#section-18">Indemnification</a></li>
  <li><a href="#section-19">Disputes, arbitration &amp; class waiver</a></li>
  <li><a href="#section-20">Governing law</a></li>
  <li><a href="#section-21">Changes &amp; termination</a></li>
  <li><a href="#section-22">General</a></li>
  <li><a href="#section-23">Contact</a></li>
</ol>

<h2 id="section-1">§ 1 — Who we are &amp; our role</h2>
<p>"Spiritual California," "we," "us," and "our" mean <strong>Spiritual California Inc.</strong>, a corporation registered to do business in the State of California, located at 631 E El Camino Real, Sunnyvale, CA 94087, holding California Seller of Travel registration <strong>CST #2171340-40</strong>. "You" and "your" mean the person using the services or, if you act for an organization, that organization.</p>
<p>Spiritual California operates an online marketplace and directory that connects people seeking spiritual, wellness, and personal-growth experiences ("Seekers") with independent providers of those experiences. We facilitate discovery, booking, scheduling, ticketing, and payment. We are an intermediary — see <a href="#section-4">Section 4</a>.</p>

<h2 id="section-2">§ 2 — Definitions</h2>
<ul>
  <li><strong>Services</strong> — our website, app, AI Guide, marketplace, booking and payment tools, and related features.</li>
  <li><strong>Providers</strong> — the independent businesses and individuals who offer experiences through the Services, including tour Operators, Practitioners, event Hosts, sacred-place owners, and sellers in the Conscious Shop.</li>
  <li><strong>Operator</strong> — an independent, locally registered tour operator that delivers a Soul Travels journey on the ground.</li>
  <li><strong>Content</strong> — text, images, reviews, listings, and other material on the Services.</li>
</ul>

<h2 id="section-3">§ 3 — Eligibility &amp; accounts</h2>
<p>You must be at least <strong>18 years old</strong> and able to form a binding contract to use the Services. The Services are not directed to children, and we do not knowingly collect information from anyone under 18. You agree to provide accurate information, keep your account credentials secure, and accept responsibility for all activity under your account. You are responsible for ensuring that any traveler, guest, or person you book for meets the requirements of the relevant experience.</p>

<h2 id="section-4">§ 4 — We are a marketplace, not the provider</h2>
<p><strong>This is the most important thing to understand about how Spiritual California works.</strong> We connect you with independent Providers. <strong>We do not ourselves deliver</strong> the journeys, sessions, events, ceremonies, treatments, or products offered through the Services. Each Provider is an independent business or professional, solely responsible for the experiences it offers and for the conduct, safety, qualifications, licensing, and quality of its own services.</p>
<p>For travel, Spiritual California acts as a <strong>travel agent and Seller of Travel</strong> arranging journeys delivered by independent Operators; we are not the tour operator, air carrier, accommodation, or ground supplier. For practitioner sessions, events, and shop products, the Practitioner, Host, or seller is the provider, not us.</p>
<p>While we apply selection and verification criteria to Providers, we do not control their day-to-day operations, do not guarantee their services, and are not liable for their acts or omissions. Any contract for the actual experience is between you and the Provider, in addition to these Terms. Your financial recourse for matters arising from a Provider's performance lies against that Provider; our responsibility to you is limited as described in <a href="#section-16">Sections 16</a>–<a href="#section-17">17</a>.</p>
<p>Providers are bound by a separate provider agreement with us and represent that they are properly licensed, registered, insured, and permitted to offer their services. These Terms also apply to Providers' use of the Services.</p>

<h2 id="section-5">§ 5 — Soul Travels (tours)</h2>
<p>Soul Travels journeys are arranged by us as agent for independent Operators and are governed by these Terms, the <a href="/refund-policy">Cancellation &amp; Refund Policy</a>, the <a href="/travel-disclosures">Travel Disclosures</a>, and any journey-specific terms shown at booking, all of which you accept when you book.</p>
<ul>
  <li><strong>Deposits, balances, cancellations, and refunds</strong> are governed by the <a href="/refund-policy">Cancellation &amp; Refund Policy</a>.</li>
  <li><strong>Travel documents.</strong> You are solely responsible for valid passports, visas, permits, vaccinations, and entry requirements for every destination, and for arriving by the stated time. We do not provide, guarantee, or advise on immigration outcomes. Requirements differ by destination and by your nationality.</li>
  <li><strong>Flights.</strong> Unless expressly stated, we do not sell or arrange airfare; you book your own flights to the gateway.</li>
  <li><strong>Travel insurance is strongly recommended.</strong> We do not sell insurance and are not a licensed insurance agent.</li>
  <li><strong>Itinerary changes.</strong> Operators may substitute activities, accommodations, guides, or routes of comparable value for weather, safety, or local conditions, as described in the Refund Policy.</li>
  <li><strong>Assumption of risk.</strong> Journeys may include physically and emotionally demanding activities (for example, hiking, elevation, heat, fasting, ceremonies, traditional treatments, and altered-state practices). You voluntarily assume the risks of participation and agree to the participant acknowledgement presented at booking.</li>
</ul>

<h2 id="section-6">§ 6 — Practitioner sessions</h2>
<p>Practitioners are independent professionals, not our employees or agents. When you book a session, your agreement for that session is with the Practitioner. Practitioners are responsible for their own licensing, scope of practice, qualifications, insurance, and compliance with the laws of the jurisdictions in which they and you are located. We do not supervise sessions and do not guarantee any result. Sessions are subject to <a href="#section-10">Section 10</a>.</p>

<h2 id="section-7">§ 7 — Events &amp; ticketing</h2>
<p>Events are organized by independent Hosts. We provide ticketing and payment tools; the Host is responsible for the event, including its content, venue, safety, accessibility, and any cancellation or rescheduling. Unless the event page states otherwise, ticket refunds are governed by the Host's stated policy. We are not responsible for a Host's cancellation, no-show, or change of an event, beyond facilitating any refund the Host authorizes.</p>

<h2 id="section-8">§ 8 — Conscious Shop</h2>
<p>Physical and digital products are sold through the Services. Shipping, delivery, and returns for <strong>physical products</strong> follow the policy shown at checkout or on the product page. <strong>Digital products</strong> (such as audio courses and downloadable materials) are licensed to you for personal, non-commercial use and are non-refundable once accessed or downloaded, except where the product was not delivered or is defective. Products are offered for general wellness and lifestyle purposes and are not intended to diagnose, treat, cure, or prevent any condition (see <a href="#section-10">Section 10</a>).</p>

<h2 id="section-9">§ 9 — The AI Spiritual Guide</h2>
<p>The AI Guide offers general reflections, suggestions, and starting points. <strong>It is not a counselor, therapist, physician, or licensed professional</strong>, and it does not provide medical, mental-health, legal, or financial advice or any diagnosis or treatment. <strong>It is not a crisis or emergency service.</strong> If you are in crisis or considering self-harm, call or text <strong>988</strong> (the U.S. Suicide &amp; Crisis Lifeline) or your local emergency number.</p>
<p>AI outputs may be inaccurate or incomplete. Do not rely on the AI Guide for any decision that requires professional judgment. Your use of the AI Guide is at your own discretion and risk, subject to <a href="#section-16">Sections 16</a>–<a href="#section-17">17</a>.</p>

<h2 id="section-10">§ 10 — Not medical or professional advice</h2>
<p>The Services, the experiences offered through them, and all related Content are <strong>for personal exploration, education, and general wellness</strong>. They are <strong>not</strong> medical, psychological, psychiatric, or other professional services and are <strong>not a substitute</strong> for diagnosis, treatment, or advice from a licensed healthcare or other qualified professional. Practices and traditions offered through the Services — including, for example, energy work, breathwork, sound practices, traditional and herbal wellness practices, hypnotherapy, and ceremony — are not represented as medical treatment. Always consult a qualified professional before making health, mental-health, or other significant decisions, and never disregard professional advice because of something offered through the Services. <strong>You are responsible for determining whether any experience is appropriate for you.</strong></p>

<h2 id="section-11">§ 11 — Payments, pricing &amp; taxes</h2>
<ul>
  <li>Prices are shown in <strong>US Dollars (USD)</strong>. If you pay with a non-US card, your bank may apply currency-conversion fees outside our control.</li>
  <li>Payments are processed by our third-party payment processor. By providing payment information, you authorize us and our processor to charge the amounts due, including deposits and balances on the schedule shown at booking.</li>
  <li>You represent that you are authorized to use the payment method you provide.</li>
  <li>Prices and availability may change before you complete a purchase. We may correct pricing errors and cancel affected orders with a refund.</li>
  <li><strong>Trust account.</strong> As required for our travel services, customer funds for travel are held in a client trust account and disbursed in compliance with California Seller of Travel law (see <a href="/travel-disclosures">Travel Disclosures</a>).</li>
  <li>Applicable taxes and mandatory fees are reflected in the total shown at checkout.</li>
</ul>

<h2 id="section-12">§ 12 — Your content &amp; reviews</h2>
<p>You may submit reviews, photos, questions, and other Content. You keep ownership of your Content, but you grant Spiritual California a worldwide, non-exclusive, royalty-free, sublicensable license to use, host, display, reproduce, and distribute it in connection with operating and promoting the Services. You represent that you have the rights to submit it, that it is accurate and your own honest experience, and that it does not violate anyone's rights or any law. We may remove Content at our discretion but are not obligated to monitor it and are not responsible for Content submitted by users or Providers.</p>

<h2 id="section-13">§ 13 — Acceptable use</h2>
<p>You agree not to: break the law or facilitate illegal activity; infringe others' rights; post false, misleading, defamatory, harassing, hateful, or harmful content; impersonate anyone; interfere with or disrupt the Services or their security; scrape, harvest, or collect data without permission; use the Services to compete with us; or use any automated means to access the Services except as we permit. We may suspend or terminate access for violations.</p>

<h2 id="section-14">§ 14 — Intellectual property</h2>
<p>The Services, including our name, logo, design, text, and software, are owned by Spiritual California Inc. or our licensors and are protected by intellectual-property laws. We grant you a limited, revocable, non-exclusive, non-transferable license to use the Services for their intended personal purpose. You may not copy, modify, distribute, sell, or create derivative works from the Services without our written permission.</p>

<h2 id="section-15">§ 15 — Providers &amp; third parties</h2>
<p>The Services may contain links to, or integrations with, third-party websites and services (for example, payment, scheduling, and mapping tools). We do not control and are not responsible for third-party services or for Providers' websites, policies, or conduct. Your dealings with Providers and third parties are between you and them.</p>

<h2 id="section-16">§ 16 — Disclaimers</h2>
<p>The services and all content, experiences, and products are provided <strong>"as is" and "as available,"</strong> without warranties of any kind, whether express, implied, or statutory, including any implied warranties of merchantability, fitness for a particular purpose, title, and non-infringement. We do not warrant that the services will be uninterrupted, secure, or error-free, that any experience or provider will meet your expectations, or that any outcome will result from any experience. To the fullest extent permitted by law, we disclaim all warranties regarding providers and their services.</p>
<p>Some jurisdictions do not allow certain warranty exclusions, so some of the above may not apply to you.</p>

<h2 id="section-17">§ 17 — Limitation of liability</h2>
<p>To the fullest extent permitted by law, Spiritual California and its officers, directors, employees, and agents will not be liable for any <strong>indirect, incidental, special, consequential, exemplary, or punitive damages</strong>, or for any loss of profits, data, goodwill, or other intangible losses, arising out of or relating to the services, even if advised of the possibility.</p>
<p>To the fullest extent permitted by law, our total liability for all claims relating to the services will not exceed the greater of (a) the total amount you paid to Spiritual California for the specific service giving rise to the claim, or (b) <strong>US $100</strong>. For any travel booking, our liability is limited to the amount you paid to Spiritual California for that booking. Because we act as an intermediary, we are not liable for the acts, omissions, negligence, or failure to perform of any Provider, Operator, Host, or third party.</p>
<p>Nothing in these Terms limits liability that cannot be limited under California law, including liability for fraud, willful injury, or violation of law under California Civil Code §1668. The limitations in this Section apply to the maximum extent permitted by law and survive termination.</p>

<h2 id="section-18">§ 18 — Indemnification</h2>
<p>You agree to defend, indemnify, and hold harmless Spiritual California and its officers, directors, employees, and agents from any claims, damages, liabilities, costs, and expenses (including reasonable attorneys' fees) arising out of or relating to: your use of the Services; your participation in any experience; your Content; your violation of these Terms or any law; or your violation of any third party's rights. We may assume the exclusive defense of any matter subject to indemnification, and you agree to cooperate.</p>

<h2 id="section-19">§ 19 — Disputes, arbitration &amp; class-action waiver</h2>
<p><strong>Please read this section carefully — it affects your legal rights.</strong></p>
<h3>Informal resolution first</h3>
<p>Before starting an arbitration, you agree to contact us at <a href="mailto:tours@spiritualcalifornia.com">tours@spiritualcalifornia.com</a> with a written description of the dispute and to try in good faith to resolve it for at least 60 days. Most issues can be resolved this way.</p>
<h3>Binding arbitration</h3>
<p>If we cannot resolve a dispute informally, you and Spiritual California agree that any dispute arising out of or relating to these Terms or the Services will be resolved by <strong>final and binding individual arbitration</strong>, administered by JAMS under its applicable rules and its Consumer Arbitration Minimum Standards. The arbitration will take place in Santa Clara County, California, or by videoconference, and judgment on the award may be entered in any court of competent jurisdiction.</p>
<h3>Class-action &amp; jury-trial waiver</h3>
<p>You and Spiritual California agree that each may bring claims against the other only in an <strong>individual capacity</strong>, and not as a plaintiff or class member in any class, collective, or representative proceeding. You and Spiritual California waive any right to a jury trial. The arbitrator may not consolidate more than one person's claims or preside over any form of representative or class proceeding.</p>
<h3>30-day right to opt out</h3>
<p>You may opt out of this arbitration agreement within <strong>30 days</strong> of first accepting these Terms by emailing <a href="mailto:tours@spiritualcalifornia.com">tours@spiritualcalifornia.com</a> with your name and a statement that you opt out of arbitration. Opting out does not affect any other part of these Terms.</p>
<h3>Exceptions</h3>
<p>Either party may bring an individual claim in small-claims court, and either party may seek injunctive relief in court to protect intellectual property or stop misuse of the Services. If the class-action waiver is found unenforceable as to a particular claim, that claim will proceed in court, but the rest of this Section still applies.</p>

<h2 id="section-20">§ 20 — Governing law</h2>
<p>These Terms are governed by the laws of the State of California, without regard to its conflict-of-laws rules. Subject to <a href="#section-19">Section 19</a>, any dispute not subject to arbitration will be brought exclusively in the state or federal courts located in Santa Clara County, California, and you consent to their jurisdiction.</p>

<h2 id="section-21">§ 21 — Changes &amp; termination</h2>
<p>We may update these Terms from time to time. If we make material changes, we will update the "last updated" date and, where appropriate, give notice. Your continued use after changes take effect means you accept them. We may suspend or end your access to the Services at any time, with or without notice, including for violation of these Terms. Sections that by their nature should survive termination (including <a href="#section-4">Sections 4</a>, <a href="#section-10">10</a>, <a href="#section-12">12</a>, and <a href="#section-16">16</a>–<a href="#section-20">20</a>) will survive.</p>

<h2 id="section-22">§ 22 — General</h2>
<p>These Terms, together with the <a href="/privacy">Privacy Policy</a>, <a href="/refund-policy">Cancellation &amp; Refund Policy</a>, <a href="/travel-disclosures">Travel Disclosures</a>, and any terms shown at booking, are the entire agreement between you and us regarding the Services. If any provision is found unenforceable, the rest remains in effect. Our failure to enforce a provision is not a waiver. You may not assign these Terms without our consent; we may assign them. We are not liable for delays or failures caused by events beyond our reasonable control (force majeure). Notices to you may be given through the Services or to your account email; notices to us go to the contact below.</p>

<h2 id="section-23">§ 23 — Contact</h2>
<p><strong>Spiritual California Inc.</strong><br/>
631 E El Camino Real, Sunnyvale, CA 94087<br/>
Email: <a href="mailto:tours@spiritualcalifornia.com">tours@spiritualcalifornia.com</a> &nbsp;·&nbsp; Phone: (408) 780-4722<br/>
California Seller of Travel CST #2171340-40</p>

<hr/>

<p><small>© 2026 Spiritual California Inc. · CST #2171340-40 · Registration as a seller of travel does not constitute approval by the State of California. These Terms should be read together with our <a href="/privacy">Privacy Policy</a>, <a href="/refund-policy">Cancellation &amp; Refund Policy</a>, and <a href="/travel-disclosures">Travel Disclosures</a>.</small></p>
  $body$,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO UPDATE SET
  "title"           = EXCLUDED."title",
  "metaTitle"       = EXCLUDED."metaTitle",
  "metaDescription" = EXCLUDED."metaDescription",
  "eyebrow"         = EXCLUDED."eyebrow",
  "subtitle"        = EXCLUDED."subtitle",
  "body"            = EXCLUDED."body",
  "isPublished"     = EXCLUDED."isPublished",
  "updatedAt"       = CURRENT_TIMESTAMP;
