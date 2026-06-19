# Design v6 — Integration Analysis & Strategy

**Source:** `Design_v6-20260618T042531Z-3-001/Design_v6/` (24 static HTML pages + assets), delivered by the client (Svetlana) on 2026-06-18.
**Status:** Analysis complete. **Scope LOCKED 2026-06-19 → REBRAND ONLY (Phases 0–2).** Apply the new look to all existing pages, preserve every current feature; Phase 3 net-new features (§3) are deferred. No code changed yet.
**Supersedes the visual language of:** the March-30 design drop (`project_client_designs_analysis.md`).

---

## 0. Governing principle (read this first)

> **Restyle in place. Never rebuild a page from the new HTML.**

The existing Next.js app is **significantly more mature than the v6 mockups**. The HTML files are static, descended from an *earlier* cut of this same app, and they silently omit dozens of shipped production features — compliance gates, the Payouts-v2 ledger, server-persisted cart, abandoned-item surfacing, crisis detection, Stripe Payment Element, dynamic filters, role-mutex, deferred onboarding. Every `handleSubmit()` in the design is an `alert()` stub with hardcoded totals.

If a developer "implements the design" by recreating the markup, they will **delete working features and reintroduce regulatory regressions**. The mandate for every page is: keep the existing React component and its data/logic wiring, swap only the visual layer (tokens, fonts, markup styling).

---

## 1. What actually changed: the design-system delta

This is a **visual rebrand**, not a re-architecture. Three global changes drive ~70% of the work:

| Token | Current | Design v6 | Notes |
|-------|---------|-----------|-------|
| **Primary accent** | gold `#E8B84B` | **orange `#F07814`** | The big one. Already exists in `globals.css` as `--color-brand-orange: #F07820` — v6 promotes it to the primary accent. |
| **Heading font** | Cormorant Garamond | **Playfair Display** | `300–600` + italic. Loaded via Google Fonts in design. |
| **Body font** | Inter | Inter | **Unchanged** ✓ |
| Charcoal | `#3A3530` | `#3D3D3D` | Minor. |
| Off-white bg | `#FAFAF7` | `#F5F2EB` | Minor (warmer). |
| Pale accent tint | `#FDF6E3` (gold) | `#FEF7F0` (orange) | Hue-shifts with the accent. |
| Gold-light | `#F5D98A` | `#FDE8D0` | Used in the new light hero/AI-bar gradients. |
| Cursor | default | custom `cursor.png` | Optional brand flourish. |
| Secondary green | `#5A8A6A` | `#7BAE8A` | Used on "Place"/location tags. |

### The mechanical catch
The accent and serif font are **hardcoded inline ~370+ times across ~93 component files** (e.g. `HeroSection.tsx` alone hardcodes the gold ~20× in SVG strokes, button fills, poppy borders, radial overlays). There is a `--color-gold` token, but most components bypass it.

**Implication:** a blind `sed s/#E8B84B/#F07814/` is *insufficient and risky* — the pale tints, gold-light gradient stops, and category colors shift differently. We need a **curated palette map** applied as a reviewed codemod, plus a `globals.css` token update, plus the `layout.tsx` font registration.

---

## 2. Page-by-page compatibility matrix (all 24 pages)

Classification legend:
- **RESTYLE** — same structure & data; new CSS/markup only.
- **STRUCTURAL** — layout/sections differ; component rework, but data largely exists.
- **NEW** — design implies data/features the backend/route does not have yet.

Effort: **S** ≈ ½–1 day · **M** ≈ 2–4 days · **L** ≈ 1–2+ weeks (usually because it carries a net-new feature).

### Marketing & Content
| Design page | Existing route | Class | Effort | Key notes |
|---|---|---|---|---|
| `index.html` | `(public)/page.tsx` | RESTYLE | M | Structurally identical & data-wired; effort is the inline-gold/Cormorant in Hero + home sections. Adds "Editor's Pick" feed badge (minor data). |
| `about.html` | `app/about` (CMS) | RESTYLE | S | CMS-driven; recolor `StaticPageRenderer` + load new "Two Girls, One Vision" copy into the `about` CMS row. |
| `mission.html` | `app/mission` (CMS) | STRUCTURAL | M | New `steps-box` ("How We Verify") + 4 `pillar` cards + pull-quote. Either teach `StaticPageRenderer` these blocks or convert `/mission` to a hardcoded styled page. |
| `posts.html` | `(public)/journal` | **NEW** | L | Filter axis changes from topic-tags → **post source/type** (Practitioners/Travel/Shop/Editorial); wide-card + badge variants; cross-module bottom strip (featured practitioners + upcoming tours). Needs blog `postType` + non-guide authors. |
| `single-post.html` | `journal/[guideSlug]/[postSlug]` | **NEW** | M–L | Restyle is easy; but adds **claps/appreciation count, bookmarks, follow, toasts**, pull-quote/video-embed/divider content blocks. Interactive bits are net-new backend. |
| `blog-modern-spirituality.html` | none (editorial) | **NEW** | M | Admin-authored ("By the Admins") article with **no guide author** — current model/route assumes every post has a `guide`. Needs editorial-author decision. |

### Practitioners
| Design page | Existing route | Class | Effort | Key notes |
|---|---|---|---|---|
| `practitioners.html` | `(public)/practitioners` | RESTYLE | S | AI bar **flips dark→light** — re-theme `AINonAdviceFooter`/crisis card. **Keep** real `/ai/practitioner-match` + crisis detection + server-side filtering. |
| `practitioner-public.html` | `guides/[slug]` | RESTYLE | S | Adds 2 stat tiles: **Years experience, Sessions completed** (minor data gap). Keep existing Soul Tours block (design predates it). |
| `practitioner-profile.html` | `guides/[slug]` (variant) | **NEW** | L | A *second visualization* of the profile: tabbed + **social post feed** (quick updates, video-embed posts, likes/comments/share) + **save/bookmark**. None exist. Pick ONE layout for the route; scope the feed separately. |
| `practitioner-dashboard.html` | `guide/dashboard/*` | RESTYLE | M | **High regression risk.** Design omits Categories, Bookings, Availability, Tours, Settings, the completeness widget, the Stripe payments chip; its earnings/verification are cosmetic stand-ins for Payouts-v2 + Persona. Re-skin the ~20 routed pages; **drop nothing**. |
| `practitioner-register.html` | `onboarding/guide` | STRUCTURAL | L | New: **"Issues You Help With"** taxonomy (AI matching), **teacher/lineage attestation**, **multi-provider calendar**. Must preserve `isPublished AND isVerified` gate, role-mutex, deferred onboarding — design's "instant live" copy must not bypass them. |

### Auth & Commerce catalog
| Design page | Existing route | Class | Effort | Key notes |
|---|---|---|---|---|
| `register.html` | `app/register` | RESTYLE | S | Near-pure token/font swap; existing page already derived from this design. **Do not rebuild** — would regress password meter, location autocomplete, required-field a11y, Google OAuth, role-mutex. |
| `store.html` | `(public)/shop` | **NEW** | L | Per-card ratings/reviewCount, **compare-at/sale price + %**, New/Bestseller/Editor's-Pick badges, **wishlist heart**, curated sections (Editor's Picks / New Arrivals / Gift Bundles). All need `Product` + backend extension. Keep existing sort dropdown. |
| `product-digital.html` | `shop/[id]` (digital) | STRUCTURAL | M | compare-at price, structured `fileMeta` sidebar, inline video embed. Keep live `ReviewsBlock` + cart store. |
| `product-physical.html` | `shop/[id]` (physical) | STRUCTURAL | M | Structured materials spec, made-to-order lead time, data-driven feature badges, verified-buyer reviews. Variants already exist. |
| `cart.html` | `(public)/cart` | **NEW** | L | **Critical regression risk.** Design has no "Needs your attention" abandoned-items block, no server-cart "items changed" warnings/acknowledge gate, no real empty state — all shipped. Adds promo code (`SOULSTART`), per-type subtotals, 3 split checkout buttons. Re-graft, don't drop. |

### Checkout
| Design page | Existing route | Class | Effort | Key notes |
|---|---|---|---|---|
| `checkout.html` | `(public)/checkout` | RESTYLE | M | Restyle the container; **keep Stripe `<PaymentElement>`** (design's split card fields + Apple/PayPal buttons get dropped). Preserve 2-step order→PaymentIntent→poll flow. |
| `checkout-digital.html` | `(public)/checkout` (digital) | RESTYLE | S | Branch already exists. Optional "Confirm Email" field. Fix copy: links are **7-day** (design says 30). |
| `checkout-physical.html` | `(public)/checkout` (physical) | STRUCTURAL | M | Country/State as selects, per-item lead-time. Keep API-driven shipping/tax; resist hardcoded totals. **Crypto** tab = unsupported. |
| `checkout-event.html` | `events/[id]/checkout` | STRUCTURAL | L | **Route trap:** apply to the production `events/[id]/checkout` (real Stripe + tiers + QR), NOT the `checkout/event` mock. Reconcile the missing **5% booking fee**. |

### Events, Tours & Booking
| Design page | Existing route | Class | Effort | Key notes |
|---|---|---|---|---|
| `events.html` | `(public)/events` | RESTYLE | S | Design is a subset; keep search input + `isVerified` gating. Hero flips dark→light. |
| `soul-travels.html` | `(public)/travels` | RESTYLE | S | **Do NOT re-add** the "4.9 Avg Rating" hero tile (removed for compliance — synthetic). Keep dynamic country filter. |
| `book-soul-tour.html` | `tours/[slug]/book` | RESTYLE | M | **Highest compliance risk.** Design strips clickwrap consent (BookingConsent), `DisclosuresAccordion`, CCPA notices, CST seller ID, and reintroduces a misleading "Taxes & fees $0". Preserve all. New optional field: **passport # + expiry** (sensitive PII → encryption + purge if adopted). |
| `book-practitioner.html` | `book/[guideSlug]` | RESTYLE | S | Keep real Calendly embed (design ships a placeholder) + manual-time fallback + Stripe. Service booking → no CST gate. |

**Tally:** 12 RESTYLE (mostly S), 5 STRUCTURAL (M), 7 carry NEW features (L). The pure rebrand is dominated by S/M restyles; the L items are almost all *new features*, not the rebrand itself.

---

## 3. Net-new features the design implies (separate scope — client decision)

These are **not part of the rebrand**. Each needs backend work and should be quoted/prioritized on its own. Listed by rough size:

| Feature | Pages | Backend work | Size |
|---|---|---|---|
| **Wishlist / favorites** | store, product cards | new per-user saved relation + endpoints + UI | M |
| **Promo / coupon codes** | cart, checkout, store | coupon model, validation endpoint, summary line | M |
| **Product card aggregates** (rating, reviewCount, compare-at/sale, New/Bestseller badges) | store, products | `Product` fields + `/products/public` payload | M |
| **Editorial blog** (non-guide authors) + **Journal source-filter** + cross-module strip | posts, blog-modern-spirituality | `postType`/author-type on `BlogPost`, journal feeds | M–L |
| **Social profile feed** (quick updates, video posts, likes, comments, follow) | practitioner-profile, single-post | `GuidePost` model, likes/comments/follow entities | L |
| **Claps + bookmarks** | single-post | counters + per-user bookmark relation | M |
| **Guide "Issues You Help With" taxonomy** | register | taxonomy + guide relation (feeds AI match) | M |
| **Teacher / lineage attestation** | register | credential sub-model | S–M |
| **Multi-provider calendar** (Google/Apple/Acuity/Cal.com/manual) | register, dashboard | provider enum + integrations | L |
| **Public profile stats** (years experience, sessions completed) | practitioner-public | 2 profile fields | S |
| **Passport capture** | book-soul-tour | manifest fields + encryption + retention/purge | M |

### Payment methods shown in the design that the backend does NOT support
Backend mints **Stripe `card` PaymentIntents only** (wallets — Apple/Google Pay — render automatically via Payment Element). The following appear as clickable tabs/buttons in the mockups but have **zero backend support** — do **not** ship them as live options:
- **PayPal** (general/digital/event/book pages) — needs Stripe PayPal beta + Connect eligibility.
- **Bank Transfer / ACH** (general/digital/physical) — separate enablement.
- **Crypto** (physical, tour) — no processor exists.

---

## 4. Regression-risk register — features the design omits that MUST be preserved

A literal rebuild would delete these. Each restyle PR must verify they survive:

- **Cart:** abandoned/pending-items block (`/seekers/dashboard/pending-actions`); server-cart "items changed" warnings + acknowledge-to-checkout gate (`NEXT_PUBLIC_SERVER_CART_ENABLED`); real empty state.
- **Checkout (all):** 2-step order→PaymentIntent→poll flow; server-authoritative totals; API-driven shipping/tax; Stripe `<PaymentElement>`; digital instant-delivery banner + inline download CTAs (7-day links).
- **Event checkout:** 5% booking fee; tier availability; per-attendee QR generation.
- **Guide dashboard:** Categories, Bookings, Availability, Tours, Settings sidebar entries; `GuideProfileCompletenessWidget`; `GuidePaymentsChip`; Payouts-v2 ledger (clearance windows, $50 min, commission tiers); Persona/Textract/Claude verification pipeline.
- **Guide register:** `isPublished AND isVerified` publish gate; SEEKER↔GUIDE role-mutex; deferred onboarding.
- **Practitioners / booking pages:** real `/ai/practitioner-match` + crisis detection + `AINonAdviceFooter`; `isVerified`-gated "Verified Practitioner" labels (truth-in-advertising); real Calendly embed; server-side filtering; FTS search inputs.

### Two things that must NOT be ported back from the design (compliance)
1. Soul Travels **"4.9 Avg Rating"** hero tile — removed because tour ratings are synthetic (no wired tour reviews).
2. Tour-booking **"Taxes & fees $0"** line — replaced with "Includes all applicable taxes and fees".

### Compliance UI that must survive `book-soul-tour` restyle (CST / CCPA)
Clickwrap consent → `/soul-tours/bookings/{id}/consent` (BookingConsent) **before** Stripe intent · `DisclosuresAccordion` · Notice-at-Collection + Sensitive-PII panels above health fields · persistent "Spiritual California Inc. · CST #2171340-40" · `LegalReceiptBlock` on success.

---

## 5. Phased execution plan

All work on a feature branch **`design-v6-rebrand`** off `main`, shipped as small reviewable PRs, QA'd on `spiritualcalifornia.nityo.in`. (A runtime theme flag is impractical for a font/palette swap — the rebrand is visually all-or-nothing, so isolate it on a branch and QA hard rather than flag it. New *features* in Phase 3 each get their own `NEXT_PUBLIC_*` flag.)

**Phase 0 — Design-system foundation** ✅ **DONE 2026-06-19** (branch `design-v6-rebrand`)
1. ✅ Playfair Display registered in `layout.tsx` (`--font-playfair-display`), replacing Cormorant Garamond. Note: Playfair's lightest weight is 400 (Cormorant had 300) — 300-weight headings now render at 400.
2. ✅ `globals.css` tokens updated: `--color-gold*` now hold the orange palette (`#F07814` / `#FDE8D0` / `#FEF7F0`), `--color-off-white` → `#F5F2EB`, `--color-green` → `#7BAE8A`, `--color-brand-orange` → `#F07814`. Added `--font-playfair`; kept `--font-cormorant`/`.font-cormorant` as legacy aliases pointing at Playfair. **Charcoal kept at `#3A3530`** (design `#3D3D3D` is imperceptibly different; 353 occurrences not worth the churn).
3. ✅ Curated codemod applied across **94 component files** (96 files total incl. foundation): `#E8B84B`→`#F07814`, `#FDF6E3`→`#FEF7F0`, `#F5D98A`→`#FDE8D0`, `#FAFAF7`→`#F5F2EB`, `#F07820`→`#F07814`; `'Cormorant Garamond'`/`var(--font-cormorant-garamond)`/`font-cormorant` → Playfair equivalents. Verified **zero stragglers**; `tsc --noEmit` passes.
4. Custom cursor: **already present** in the codebase (`globals.css` `.public-site { cursor: url('/cursor.png') }`) — no change needed.
5. **Remaining for Phase 0 follow-up / Phase 1:** visual QA in the running app (token swap is mechanical; the dark→light AI-bar re-themes on practitioners/events/travels are Phase 1/2 work, not covered by the codemod).

**Phase 1 — Pure restyles** ✅ **DONE 2026-06-19** (branch `design-v6-rebrand`)
- **Phase 0 follow-up sweep:** the hex-only codemod missed the old gold in **rgba form** — swept `rgba(232,184,75,…)` → `rgba(240,120,20,…)` (541 occurrences / 109 files) and `rgba(253,246,227,…)` → `rgba(254,247,240,…)`. Zero stragglers.
- ✅ `events` — hero flipped dark→light (`#F5F2EB→#FDE8D0`), title/subtitle re-themed to charcoal.
- ✅ `soul-travels` — hero flipped dark→light; **rating tile kept removed** (compliance Task 7); Stat labels re-themed to charcoal.
- ✅ `practitioners` — AI bar flipped dark→light: gradient, heading/subtitle/input/chips re-themed; `CrisisResourcesCard` + `AINonAdviceFooter` switched `variant="dark"`→`"light"`. Real `/ai/practitioner-match` + crisis detection preserved.
- ✅ `register` — verified; already correctly rebranded by Phase 0 (the one `#fff` is white-on-charcoal button text). No change needed.
- ✅ `checkout` (digital branch) — verified; the instant-delivery banner is **dark by design** (`background: var(--charcoal)`, gold-light heading) and already matches. 7-day download-link copy kept (design's "30 days" not adopted).
- ✅ `book-practitioner` — verified; no dark sections, Calendly embed + Stripe intact.
- ✅ `about` — recolored via the Phase 0 codemod (`StaticPageRenderer`). Loading the new "Two Girls, One Vision" copy into the `about` CMS row is a **client content task**, not code.
- ⏸️ **`practitioner-public` (`/guides/[slug]`) — DEFERRED to Phase 2.** Page is rebranded by Phase 0, but the design moves the profile header from the current **dark cover-image banner** to a **white** header (`.profile-header-wrap { background: var(--white) }`), which requires repositioning the avatar + stat tiles — a structural change, not a token swap. Moved out of the low-risk pass.

**Phase 2 — Structural restyles** 🔄 **IN PROGRESS** (branch `design-v6-phase2`)
> **Reassessment after digging in:** under the rebrand-only scope, most "structural" deltas turned out to be one of: (a) themed **dark→light flips** — now all done; (b) actually **Phase-3 data features** (deferred); (c) **image-underlay** gradients that correctly stay dark; or (d) a CMS judgment call. The remaining surface is far smaller than this list first implied.

- ✅ **Batch 1 (done):** shop **AI Finder bar** flipped dark→light (mirrors practitioners; Crisis/NonAdvice → `light`). **`practitioner-public` profile banner** flipped dark→light peach — turned out to be a 1-line gradient change (design keeps the same image@0.35 + white header, only the banner gradient differs). Earlier "structural header restructure" concern was overblown.
- ✅ **Dark-section audit:** the only themed flips were practitioners/events/travels (Phase 1) + shop-AI/profile-banner (here). All other dark gradients are **image overlays/placeholders** (shop hero `rgba(30,22,18)` over product photos; event/tour detail heroes; avatar/card placeholders) and correctly **stay dark**. Event-detail & tour-detail pages have **no design counterpart** (design ships listings only) → left as recolored.
- ⏸️ **Deferred to Phase 3 (data features, out of rebrand-only scope):** store Editor's-Picks/New-Arrivals/Gift-Bundles sections, product card ratings/sale-badges/wishlist, cart promo code + split checkout, product compare-at price. These need backend fields, not restyling.
- 🤔 **Open judgment call — `mission`:** design adds `steps-box` + `pillar` cards. `/mission` is CMS-driven (`StaticPageRenderer`). Choice: extend the renderer to emit these blocks vs convert `/mission` to a hardcoded styled page (loses CMS edit). **Pending decision.**
- 🔍 **Optional deeper pass — guide dashboard:** fully recolored + functional after Phase 0; the design's specific panel/stat-card styling is a marginal cosmetic refinement, not a structural gap. Do a dedicated pass only if exact panel styling is wanted.
- `book-soul-tour` / `checkout*` / `product*` / `home`: recolored by Phase 0; no leftover themed dark sections; compliance + Payment Element + flows intact.

**Phase 3 — Net-new features** *(only if client opts in; each its own PR + flag + possible DB migration)*
Wishlist · promo codes · product aggregates/badges · editorial blog + journal source-filter · social profile feed · claps/bookmarks · issues taxonomy · teacher attestation · multi-provider calendar · public-profile stats · passport capture.

**Sequencing rule:** Phase 0 → 1 delivers the *seamless visual rebrand* the client asked for with minimal risk. Phase 2 completes the look. Phase 3 is optional product growth, decided per-feature.

---

## 6. Open decisions for the client

1. **Scope:** rebrand-only (Phases 0–2), or rebrand + some/all new features (Phase 3)? This changes effort by an order of magnitude.
2. **Cormorant → Playfair:** full replacement, or keep Cormorant anywhere?
3. **Mission/About:** keep CMS-driven (extend renderer) or convert to hardcoded styled pages?
4. **Profile layout:** `practitioner-public` (visitor scroll) vs `practitioner-profile` (tabbed social feed) as the canonical `/guides/[slug]` — and is the social feed in scope at all?
5. **Unsupported payments:** confirm PayPal / Bank Transfer / Crypto are dropped (not shipped as dead tabs).
6. **Passport capture** on tours: adopt (and accept the PII/encryption/purge burden) or omit?

---

*Analysis produced 2026-06-19 from 5 parallel domain reviews of the 24 v6 pages against the live codebase. No code modified.*
