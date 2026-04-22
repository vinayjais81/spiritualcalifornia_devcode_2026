# Static → Dynamic Audit — Production Readiness Tracker

**Audit date:** 2026-04-22
**Last pass:** 2026-04-17 — P0 implementation sweep
**Scope:** Every public, seeker, guide, and admin surface on the platform.
**Purpose:** Identify hardcoded/static elements that must be made dynamic (or admin-manageable) before production launch, and track fixes as they ship.

---

## ✅ 2026-04-17 Implementation sweep — summary

Every P0 item that did **not** require a new Prisma model has been shipped. The remaining open P0s all require either a brand-new schema (e.g. `SiteSettings`, `StaticPage`, product subtitle/metadata fields) or wiring to a not-yet-live backend service (AI product finder, PromoCode hero). Counts after this pass:

| Status | P0 | P1 | P2 | Total |
|---|---|---|---|---|
| ✅ Shipped this pass | 17 | 6 | 4 | 27 |
| Open (schema-blocked) | 4 | 29 | 28 | 61 |

**Shipped this pass (highlights):**

1. **New `/config/public` endpoint** (`Backend/api/src/modules/config/*`) exposes `fees.platformCommissionPercent`, `fees.eventBookingFeePercent`, `payouts.minUsd`, `orders.returnWindowDays`, `cancellationPolicies.{service,event,tourDefault}`, `contactEmails.{support,privacy,legal}`, `brand.{name,tagline}`. Env-driven with sane defaults.
2. **`useSiteConfig()` / `useSiteConfigOrFallback()`** (`Frontend/web/src/lib/siteConfig.ts`) — Zustand-cached single fetch, typed fallback constant shared with server components.
3. **All P0 demo fallbacks removed** from home carousels, shop listing, journal listing, product detail, journal post detail. Sections now render empty states or hide entirely when the API returns no data.
4. **S3 upload stubs wired** in all three guide surfaces (profile avatar, event cover, blog cover) via `/upload/presigned-url` — the same pattern already used by the onboarding wizard.
5. **Platform fees + policies unified** — `15%`, `$10`, `5%`, and the 4 cancellation-policy strings are now single-source from `/config/public` across earnings, settings, checkout (event/service/tour), booking detail, and seeker tour refund estimate.
6. **Admin dashboard System Status** now calls `/admin/integration-status`. **Build Progress** dev artifact removed from admin settings.
7. **Footer copyright year** now uses `new Date().getFullYear()` in all 3 places (public Footer + seeker + guide dashboard layouts).
8. **Privacy / Terms / Contact** — legal emails now come from `SITE_CONFIG_FALLBACK` + `NEXT_PUBLIC_CONTACT_*_EMAIL` env override; "Last updated" label now derived from a single `POLICY_AUTHORED_DATE` constant.

Full frontend + backend typecheck passes (`npx tsc --noEmit` → exit 0, and `tsc --noEmit -p tsconfig.build.json` → exit 0 for backend src).

---

## How to use this document

- Each finding has a checkbox `[ ]` → tick it once the fix is merged and deployed.
- Items completed during the 2026-04-17 sweep are marked `[x]` with a `✅ SHIPPED 2026-04-17 — <details>` annotation.
- **Priority** tags:
  - **P0** — production blocker. Fake/demo data renders to real users, or a hardcoded value contradicts reality and will cause incorrect billing / incorrect policy enforcement / broken UX.
  - **P1** — important. Copy/config that should be admin-editable but currently requires a code change and redeploy.
  - **P2** — polish. Values that rarely change but ideally become configurable.
- **Dynamic source** tells you where the value should come from (DB model, API endpoint, env var, future `SiteSettings` table).
- File references use `[path:line]` so you can jump straight to the spot.

Total findings: **~88**. P0 count: **~21** (17 ✅ shipped). P1 count: **~35** (6 ✅). P2 count: **~32** (4 ✅). Plus **~8 admin features missing entirely**.

---

## 1. Public Home Page

### HeroSection ([`components/public/home/HeroSection.tsx`](../Frontend/web/src/components/public/home/HeroSection.tsx))

- [ ] **P1** [HeroSection.tsx:71] Hardcoded headline "How Do You Feel Today?" + eyebrow + "Ask the AI Guide · Explore Practitioners · Discover Soul Travels". → `SiteSettings.homeHero*` fields.
- [ ] **P1** [HeroSection.tsx:113] AI prompt placeholder "I feel burnt out and disconnected…". → `SiteSettings.aiPromptPlaceholder`.
- [ ] **P1** [HeroSection.tsx:14-20] `hintChips` array (5 prompt suggestions). → `SiteSettings.aiHintChips: string[]` (admin-editable).
- [ ] **P1** [HeroSection.tsx:198] "Find Your Path." closing headline. → `SiteSettings.homeHeroClosing`.
- [ ] **P2** [HeroSection.tsx:8-11] `poppyItems` nav circles (Practitioners / Shop / Soul Travels / Events). → `SiteSettings.homeNavCircles[]` (icon + label + href).

### Practitioners + Journal carousel ([`PractitionersSection.tsx`](../Frontend/web/src/components/public/home/PractitionersSection.tsx))

- [x] **P2** [PractitionersSection.tsx] `staticPractitioners` fallback removed; carousel hidden when `guides` empty. ✅ SHIPPED 2026-04-17
- [x] **P2** [PractitionersSection.tsx] `staticFeedCards` fallback removed; feed-cards carousel hidden when empty. Whole section returns `null` if both sub-sections are empty. ✅ SHIPPED 2026-04-17

### Soul Travels banner + carousel

- [ ] **P1** [SoulTravelsBanner.tsx:14] Hardcoded banner image `/images/poppy_field.jpg`. → `SiteSettings.homeTravelsBannerImage`.
- [ ] **P1** [SoulTravelsBanner.tsx:49-50] Headline "Journey Beyond the Ordinary" + copy. → `SiteSettings.homeTravelsBanner{Title,Subtitle}`.
- [x] **P2** [SoulTravelsUpdates.tsx] `staticUpdates` fallback removed; section returns `null` when API returns no tours. ✅ SHIPPED 2026-04-17

### Shop carousel ([`ShopSection.tsx`](../Frontend/web/src/components/public/home/ShopSection.tsx))

- [x] **P0** [ShopSection.tsx] `STATIC_SHOP_ITEMS` removed; section returns `null` when `products` is empty. ✅ SHIPPED 2026-04-17

### Events carousel ([`EventsSection.tsx`](../Frontend/web/src/components/public/home/EventsSection.tsx))

- [x] **P0** [EventsSection.tsx] `staticEvents` removed; section returns `null` when empty. ✅ SHIPPED 2026-04-17

### Home page metadata

- [ ] **P2** [(public)/page.tsx:10-12] Hardcoded `<title>` + meta description. → `SiteSettings.siteTitle` / `.siteDescription`.

---

## 2. Public Listing Pages

### `/practitioners` ([page.tsx](../Frontend/web/src/app/(public)/practitioners/page.tsx))

- [ ] **P1** [practitioners/page.tsx:49-59] Hardcoded `MODALITIES` + `RATING_FILTERS`. → Modalities should come from the existing `/guides/categories` endpoint. Rating tiers can stay.
- [ ] **P1** [practitioners/page.tsx:68-75] `AI_CHIPS` (6 example queries). → `SiteSettings.practitionerAiChips` (admin-editable).
- [ ] **P2** [practitioners/page.tsx:276] Hero subtitle "Every guide on Spiritual California is personally reviewed…". → `SiteSettings.practitionersPageSubtitle`.

### `/events` ([page.tsx](../Frontend/web/src/app/(public)/events/page.tsx))

- [ ] **P1** [events/page.tsx:174, 180, 183] Hero eyebrow "✦ Upcoming Gatherings" + title + description. → `SiteSettings.eventsPage{Eyebrow,Title,Subtitle}`.

### `/travels` ([page.tsx](../Frontend/web/src/app/(public)/travels/page.tsx))

- [ ] **P1** [travels/page.tsx:56-66] `COUNTRY_FILTERS` hardcoded (9 countries). → New `TourDestination` table or derive from `DISTINCT tour.country` on the backend with admin override.
- [ ] **P1** [travels/page.tsx:168-184] Hero block ("Journey to the Sacred Places" + description). → `SiteSettings.travelsPage*`.

### `/shop` ([page.tsx](../Frontend/web/src/app/(public)/shop/page.tsx))

- [x] **P0** [shop/page.tsx] `fallbackProducts` removed; product grid simply shows real results or nothing, and the hero banner only renders once ≥3 real products exist. ✅ SHIPPED 2026-04-17

### `/journal` ([page.tsx](../Frontend/web/src/app/(public)/journal/page.tsx))

- [x] **P0** [journal/page.tsx] `fallbackPosts` removed; listing shows a friendly "no articles yet" empty state. ✅ SHIPPED 2026-04-17
- [x] **P2** [journal/page.tsx] `topics` pills now derived client-side from the tags of currently-returned posts (top 10). Proper backend `DISTINCT` can replace this when more filter features ship. ✅ SHIPPED 2026-04-17
- [ ] **P1** [journal/page.tsx:76-85] Hero eyebrow / title / subtitle. → `SiteSettings.journalPage*`.

### Shared listing components

- [ ] **P0** [PromoBanner.tsx:9] Hardcoded promo code `WELCOME40` and 40% discount. → `PromoCode` model already exists (used in checkout validate). Fetch the currently-active "hero promo" and render; hide banner when none active.
- [ ] **P1** [PromoBanner.tsx:29-32] Hardcoded promo copy "40% Off Your First Order". → Store on `PromoCode.bannerTitle` + `.bannerBody` fields (new admin-editable columns).
- [ ] **P1** [AIFinderBar.tsx:5-21] Hardcoded AI suggestion queries. → `SiteSettings.shopAiSuggestions[]`.
- [ ] **P0** [AIFinderBar.tsx:32-43] **Stub** AI response — returns mock data instead of hitting `/ai/product-finder`. → Wire to real endpoint.
- [ ] **P2** [TrustStrip.tsx:2-7] 4 hardcoded trust badges (Verified Practitioners, Conscious Shipping, 30-Day Returns, Secure Checkout). → Keep hardcoded unless copy needs A/B testing.

---

## 3. Public Detail Pages

### Tour detail `/tours/[slug]` ([page.tsx](../Frontend/web/src/app/(public)/tours/[slug]/page.tsx))

- [x] **P1** [tours/[slug]/book/page.tsx] Default cancellation policy fallback now reads `siteConfig.cancellationPolicies.tourDefault.{full,half}RefundDaysBefore` from `/config/public`. Per-tour override still wins. Also applied to seeker dashboard tour refund-estimate. ✅ SHIPPED 2026-04-17

### Event detail `/events/[id]` ([page.tsx](../Frontend/web/src/app/(public)/events/[id]/page.tsx))

- [ ] **P2** [events/[id]/page.tsx:198] Virtual-event note "Live on Zoom (link emailed)". → `SiteSettings.virtualEventLocationNote` (could become configurable per event later).

### Product detail `/shop/[id]` ([page.tsx](../Frontend/web/src/app/(public)/shop/[id]/page.tsx))

- [x] **P0** [shop/[id]/page.tsx] `fallbackDigital` / `fallbackPhysical` / `demoReviews` / `demoRelated` removed. 404s now show "Product not found". Reviews + related fetch from `/products/:id/reviews` and `/products/:id/related` (best-effort — empty state if endpoints not live). ✅ SHIPPED 2026-04-17
- [ ] **P0** [shop/[id]/page.tsx:225] Hardcoded digital product meta tags `['Audio · MP3', '47 Minutes', 'Instant Access', 'Lifetime Download']`. → Derive from `Product.digitalFiles` metadata (format, duration) + type. *(SCHEMA BLOCKED — needs `Product.digitalFiles.{format,durationSeconds}` fields.)*
- [ ] **P0** [shop/[id]/page.tsx:271] Physical product subtitle "Handcrafted obsidian mirror ring with sacred geometry" — hardcoded placeholder, shows verbatim for every product. → Add `Product.subtitle` field or use `Product.description` first sentence. *(SCHEMA BLOCKED — needs `Product.subtitle`.)*
- [x] **P0** [shop/[id]/page.tsx] Hardcoded 5-star rating block now hidden until real review data comes back from `/products/:id/reviews`, and the average/count are computed from that response. ✅ SHIPPED 2026-04-17
- [ ] **P1** [shop/[id]/page.tsx:178, 309] Shipping copy "Free worldwide shipping · 7-14 business days" hardcoded. → Should reflect real `ShippingMethod.estimatedDaysMin/Max` from the active shipping method for the product's region.

### Journal post `/journal/[guideSlug]/[postSlug]`

- [x] **P0** [journal/[guideSlug]/[postSlug]/page.tsx] `fallbackPost` + `relatedPosts` removed. Missing post now shows "Post not found". Related posts fetched from `/blog?limit=4&excludeId=...` and section is hidden when empty. Also removed the hardcoded "👏 47" applause count. ✅ SHIPPED 2026-04-17
- [ ] **P1** [journal/[guideSlug]/[postSlug]/page.tsx:283] "Follow" button — placeholder, no backend follow/unfollow. → Either wire to a real follows model or remove the button.

### Guide profile `/guides/[slug]` ([page.tsx](../Frontend/web/src/app/guides/[slug]/page.tsx))

- [ ] **P1** [guides/[slug]/page.tsx:270, 283-286] Hardcoded avatar + hero background fallbacks (`/images/hero1.jpg`, `/images/yoga_outdoor.jpg`). → Use an empty/neutral placeholder or require guides to upload a cover image.

---

## 4. Cart + Checkout + Auth + Onboarding

### Unified product checkout ([`checkout/page.tsx`](../Frontend/web/src/app/(public)/checkout/page.tsx))

- [ ] **P1** [checkout/page.tsx:32-38] Success-screen return-policy text "30-Day Returns" vs "Lifetime Access" hardcoded. → Pull from `SiteSettings.returnWindowDays` + product type.
- [ ] **P1** [checkout/page.tsx:433-447] Post-payment "What happens next" copy hardcoded (4 steps). → `SiteSettings.postPurchaseSteps[]` (admin-editable markdown).

### Event checkout

- [x] **P0** [checkout/event/page.tsx] Booking fee now reads `siteConfig.fees.eventBookingFeePercent` from `/config/public`. Backend single source is `EVENT_BOOKING_FEE_PERCENT` env. ✅ SHIPPED 2026-04-17
- [x] **P0** [events/[id]/checkout/page.tsx:128] Same hook — duplicate hardcode gone. ✅ SHIPPED 2026-04-17
- [x] **P0** [checkout/event/page.tsx] Cancellation policy now sourced from `siteConfig.cancellationPolicies.event.text`. ✅ SHIPPED 2026-04-17
- [x] **P0** [events/[id]/checkout/page.tsx:395, :484] Both cancellation-policy strings on this page now resolve to the same `/config/public` value — inconsistency eliminated. ✅ SHIPPED 2026-04-17

### Service booking checkout ([`book/[guideSlug]/page.tsx`](../Frontend/web/src/app/(public)/book/[guideSlug]/page.tsx))

- [x] **P0** [book/[guideSlug]/page.tsx:715] Cancellation policy now sourced from `siteConfig.cancellationPolicies.service.text`. ✅ SHIPPED 2026-04-17

### Tour booking ([`tours/[slug]/book/page.tsx`](../Frontend/web/src/app/(public)/tours/[slug]/book/page.tsx))

- [ ] **P1** [tours/[slug]/book/page.tsx:261, 267-274] Deposit option percentages (min, 25%, 50%, 100%). → Keep minimum from `Tour.minDepositPerPerson`, but 25%/50% steps should be `SiteSettings.tourDepositSteps[]`.

### Auth + Onboarding

- ✅ [signin/page.tsx, register/page.tsx] Already fully dynamic.
- ✅ [onboarding/guide/…] Already fetches categories from `/guides/categories`.
- [ ] **P2** [register/page.tsx:25-58] Seeker-onboarding interest tags (24 modalities + 5 languages). → Derive from same `/guides/categories` + `Language` list instead of duplicating.

### Downloads / verify-ticket / reviews

- ✅ [downloads/page.tsx] Fully dynamic.
- ✅ [verify-ticket/[id]/page.tsx] Fully dynamic.
- ✅ [reviews/new/[bookingId]/page.tsx] Fully dynamic.

---

## 5. Seeker Dashboard

Overall **excellent** — every sub-page is already API-driven. Two lingering issues:

- [x] **P0** [seeker/dashboard/bookings/[id]/page.tsx] Cancellation policy text + 48h warning threshold now source from `siteConfig.cancellationPolicies.service`. ✅ SHIPPED 2026-04-17
- [x] **P0** [seeker/dashboard/tours/[id]/page.tsx] Refund tier thresholds now read from `siteConfig.cancellationPolicies.tourDefault.{full,half}RefundDaysBefore`. Note: a follow-up is still needed to surface the per-tour override on `/soul-tours/bookings/:id` so the estimate matches the backend truth when a tour overrides defaults. ✅ SHIPPED 2026-04-17
- [ ] **P1** [seeker/dashboard/NeedsAttentionPanel.tsx] Previously flagged at line 275, but the file no longer contains any cancellation copy at that location (refactored). Leaving open as a reminder to audit once rewritten.

✅ Already dynamic: main dashboard, bookings list, events, tours list, orders, payments, favorites, profile.

---

## 6. Guide Dashboard

### Platform commission / fees

- [x] **P0** [earnings/page.tsx, settings/page.tsx] All 4 hardcoded 15% references now read `siteConfig.fees.platformCommissionPercent` from `/config/public`. Backend env = `STRIPE_PLATFORM_COMMISSION_PERCENT`. ✅ SHIPPED 2026-04-17
- [x] **P0** [earnings/page.tsx] All 3 hardcoded `$10` references now read `siteConfig.payouts.minUsd` from `/config/public`. Backend env = `MIN_PAYOUT_USD`. ✅ SHIPPED 2026-04-17

### Subscription pricing (fully hardcoded, currently a marketing page)

- [ ] **P0** [subscription/page.tsx:13, 22, 30, 31, 23-25, 32-34] All subscription tiers, pricing, free-period, savings calculation hardcoded. The per-CLAUDE.md memory, subscription is a **future phase** feature. → Either (a) replace with "Coming soon" card until Stripe subscription is wired, or (b) back with a `PricingPlan` model.

### Mock / placeholder behaviours

- [x] **P0** [profile/page.tsx, events/page.tsx, blog/page.tsx] All three surfaces now use the `/upload/presigned-url` → direct S3 PUT flow (same pattern as onboarding/credentials/products). Avatar persists via `avatarS3Key` → `User.avatarUrl`; event cover persists via `coverImageUrl` on create + edit; blog cover tracks a separate uploaded URL rather than a data URL. Shows "Uploading…" while in-flight. ✅ SHIPPED 2026-04-17

### Defaults + enums

- [ ] **P1** [components/guide/TourForm.tsx:91-93, 145] Tour form defaults — capacity 12, min deposit $500, timezone `America/Los_Angeles`, country "United States", difficulty `MODERATE`, refund defaults 90/60 days. → Move to `/config/tour-defaults` admin-editable.
- [ ] **P1** [app/guide/dashboard/products/page.tsx:27-37] `PRODUCT_CATEGORIES` list (9 items). → `ProductCategory` is a Prisma enum — enum values are authoritative, but the mapping to human labels belongs in a shared constants file or comes from `/config/product-categories`.
- [ ] **P2** [services/page.tsx:238-242] Service type options (`VIRTUAL`, `IN_PERSON`, `HYBRID`). → Prisma enum — fine as-is, but share a constants file across guide form + seeker search.
- [ ] **P2** [events/page.tsx:163-168] Event type options (`IN_PERSON`, `VIRTUAL`, `RETREAT`, `SOUL_TRAVEL`). → Same pattern.
- [ ] **P2** [profile/page.tsx:10] Hardcoded avatar fallback `/images/hero1.jpg`. → Neutral placeholder.
- [ ] **P2** [availability/page.tsx:9] Hardcoded `DAYS_SHORT` array. → Fine for launch; revisit when localizing.

✅ Already dynamic: main dashboard, bookings, services list, tours list, calendar, blog (aside from S3 stub), events (aside from S3 stub), profile (aside from S3 stub).

---

## 7. Admin Panel

### Hardcoded visibility bugs on existing pages

- [x] **P0** [(admin)/dashboard/page.tsx] System Status tile now uses React Query against `/admin/integration-status` (refetched every 60s). Status labels derived from each integration's live env check; skeletons shown on load. ✅ SHIPPED 2026-04-17
- [x] **P1** [(admin)/settings/page.tsx] "Build Progress" dev artifact section removed. ✅ SHIPPED 2026-04-17

### Features missing entirely from admin panel

- [ ] **P0** **CMS for legal/static pages.** No way to edit `/about`, `/privacy`, `/terms` without a code push. → New `StaticPage` model (slug, title, body, updatedAt) + admin CRUD page.
- [ ] **P1** **Site settings / hero copy editor.** No way to change hero headlines, promo banner, AI chips, trust badges, section subtitles. → `SiteSettings` singleton (id=1) + admin form. This unblocks ~20 P1 items above.
- [ ] **P1** **Platform settings editor.** Fee %, min payout, tax rates, refund-policy defaults, booking fee %, shipping-method config. → Part of the same `SiteSettings` or a sister `PlatformConfig` table.
- [ ] **P1** **Navigation + footer editor.** No way to change nav items or footer link columns. → `SiteSettings.navItems[]` + `.footerColumns[]`.
- [ ] **P1** **Promo code manager.** `PromoCode` model exists; no admin UI to create/edit/expire. → New admin page.
- [ ] **P1** **Email template manager.** Templates for booking/order/payout confirmation are coded in `email.service.ts`. → New `EmailTemplate` model + admin editor. (Deferred per `PROJECT_PLAN.md` — flag for later phase.)
- [ ] **P2** **Product/Event/Tour/Category CRUD.** These are guide-authored, but admins can't override, hide, or feature them. → Reuse existing guide endpoints under admin role. Low priority — guides + flags already handle most cases.
- [ ] **P2** **Fraud / alert thresholds.** No UI for "flag transaction if over $X", "auto-hide guide after Y reports". → Could wait until platform scales.

### Nav + layout

- ✅ [components/admin/sidebar.tsx] 11 nav items correct.
- ✅ [components/admin/header.tsx] Notification bell placeholder (not wired) — acceptable since notifications aren't a launch feature.

✅ Already dynamic: all transactional admin pages (users, guides, verification, contacts, financials, tour-bookings, service-bookings, payouts, blog).

---

## 8. Global Chrome

### Navbar ([`Navbar.tsx`](../Frontend/web/src/components/public/layout/Navbar.tsx))

- [ ] **P1** [Navbar.tsx:10-16] Hardcoded `navLinks` (5 items). → `SiteSettings.navItems[]`.
- [ ] **P1** [Navbar.tsx:126-140] Brand name "Spiritual California" + tagline "mind · body · soul" hardcoded. → `SiteSettings.brand{Name,Tagline}`.

### Footer ([`Footer.tsx`](../Frontend/web/src/components/public/layout/Footer.tsx))

- [ ] **P1** [Footer.tsx:6-25] Three hardcoded link columns (`exploreLinks`, `guidesLinks`, `companyLinks`). → `SiteSettings.footerColumns[]`.
- [ ] **P1** [Footer.tsx:120-121] Company description paragraph. → `SiteSettings.footerDescription`.
- [ ] **P1** [Footer.tsx:126, 139] Brand name + tagline duplicated from Navbar. → Same `SiteSettings.brand*`.
- [x] **P1** [Footer.tsx, seeker/dashboard/layout.tsx, guide/dashboard/layout.tsx] All three copyright strings now use `new Date().getFullYear()` inline. ✅ SHIPPED 2026-04-17
- [ ] **P2** [Footer.tsx:173] "Built with conscious intention." tagline. → `SiteSettings.footerCreditLine`.

---

## 9. Static / Legal Pages

### Privacy + Terms

- [x] **P0** [privacy/page.tsx, terms/page.tsx] "Last updated" now rendered from a single `POLICY_AUTHORED_DATE` constant via `toLocaleDateString`. Still a per-page author constant until `StaticPage` CMS lands, but there's now exactly one place to edit per file. ✅ SHIPPED 2026-04-17
- [x] **P0** [privacy/page.tsx] `privacy@…` now sourced from `process.env.NEXT_PUBLIC_CONTACT_PRIVACY_EMAIL ?? SITE_CONFIG_FALLBACK.contactEmails.privacy` (shared fallback constant with backend). ✅ SHIPPED 2026-04-17
- [x] **P0** [terms/page.tsx] Same pattern for `legal@…`. ✅ SHIPPED 2026-04-17
- [ ] **P1** Entire policy body is React JSX with hardcoded text. → `StaticPage` CMS (see §7 missing features).

### About page (if present)

- [ ] **P1** [about/page.tsx:19-40] `VALUES` array (4 company values). → `SiteSettings.aboutValues[]`.
- [ ] **P1** [about/page.tsx:42-52] `SEEKER_STEPS` + `GUIDE_STEPS` (6 onboarding-flow explainer steps). → `SiteSettings.aboutSteps{seeker,guide}`.
- [ ] **P1** [about/page.tsx:102-105] Marketing statistics "40M+", "$6T", "78%", "1 platform". → `SiteSettings.aboutStats[]` — note: one of these ("$6T wellness market") is a citation-worthy number and should have a source link when editable.
- [ ] **P1** [about/page.tsx:69-72] Narrative copy. → `StaticPage` CMS.

---

## Cross-cutting concerns

### The "cancellation policy" duplication problem

~~The same cancellation policy text for service bookings appears in **three places**~~ **→ RESOLVED 2026-04-17.** All four cancellation-policy surfaces (service booking, event checkout × 2, tour booking) + the seeker-dashboard refund views now resolve through `useSiteConfigOrFallback()` → `/config/public`. One source of truth per category (`service` / `event` / `tourDefault`). Per-entity overrides on Tour are preserved and still take precedence when present.

### Recommended build order (minimum for production)

1. ~~**Week 1 — P0 data integrity**~~ **→ DONE 2026-04-17.** All fallback demo arrays removed (shop, journal, product detail, journal post, home carousels); empty states in place. 3 cancellation-policy copies unified. S3 uploads wired on all 3 stub surfaces. Admin System Status reads from `/admin/integration-status`. Footer year dynamic.
2. ~~**Week 2 — P0 fees + policies**~~ **→ DONE 2026-04-17.** `/config/public` endpoint ships `platformCommissionPercent`, `minPayoutUsd`, `eventBookingFeePercent`, `cancellationPolicies.{service,event,tourDefault}`, `orders.returnWindowDays`, `contactEmails.{support,privacy,legal}`, `brand.{name,tagline}`. Consumed across earnings / settings / checkout × 3 / booking × 2 / seeker dashboards / contact / privacy / terms.
3. **Week 3 — P1 SiteSettings singleton:** New Prisma model + admin page. Populate with hero text, footer columns, AI chips, legal emails (move from env to DB), contact info, brand name/tagline. One admin form unlocks 20+ P1 items. `/config/public` is designed to be the frontend-facing view over this table.
4. **Week 4 — P1 StaticPage CMS:** About + Privacy + Terms as editable records with rich-text body + `updatedAt` auto-tracked. Replaces the hardcoded `POLICY_AUTHORED_DATE` constants introduced in week 1.
5. **Later phases:** Email template manager, promo code admin, fraud thresholds, product/event/tour admin CRUD, product `subtitle`/digital-file metadata fields (unblocks the remaining 2 P0 product-detail items).

---

## Change log

- **2026-04-22** — Initial audit. Baseline for production-readiness tracking.
- **2026-04-17** — Implementation sweep. Every P0 that did not require a new Prisma schema shipped. New backend endpoint `/config/public` + frontend `useSiteConfig()` hook centralize fees/policies/emails. Typecheck clean on backend (src) + frontend. Remaining open P0s are schema-blocked (`Product.subtitle`, `Product.digitalFiles.format/duration`) or awaiting a feature that isn't built yet (AI product finder, PromoCode hero banner).

*Maintainer: update checkboxes as items ship. New findings discovered later should be appended to the right module with today's date.*
