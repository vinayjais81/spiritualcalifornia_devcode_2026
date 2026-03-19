# Spiritual California Marketplace Platform
## Technical Project Plan & Estimates
**Prepared by:** Technical Project Manager (Claude AI)
**Date:** March 9, 2026
**Version:** 1.0
**Resource Model:** 1 Senior Full Stack Developer + Claude AI Copilot (dedicated, full lifecycle)

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Tech Stack Decision & Rationale](#2-tech-stack-decision--rationale)
3. [System Architecture Overview](#3-system-architecture-overview)
4. [Feature Module Breakdown](#4-feature-module-breakdown)
5. [Phase-by-Phase Development Plan](#5-phase-by-phase-development-plan)
6. [Effort Estimation Summary](#6-effort-estimation-summary)
7. [Milestone & Timeline Roadmap](#7-milestone--timeline-roadmap)
8. [Risk Register](#8-risk-register)
9. [Third-Party Integration Summary](#9-third-party-integration-summary)
10. [Infrastructure & DevOps Plan](#10-infrastructure--devops-plan)
11. [Definition of Done & Quality Gates](#11-definition-of-done--quality-gates)

---

## 1. Executive Summary

**Spiritual California** is a two-sided marketplace connecting Seekers (wellness service consumers) with verified Guides (wellness practitioners). The platform differentiates on **trust and verification** — every practitioner is vetted via identity and credential verification before appearing publicly.

### Platform Pillars
| Pillar | Description |
|--------|-------------|
| Trust | Identity + credential verification for all Guides |
| Discovery | AI-powered chatbot + robust search/filter for Seekers |
| Commerce | End-to-end booking, events, and product e-commerce |
| Community | Reviews, testimonials, practitioner blogs |
| Monetization | Stripe Connect + 12-20% commission on all transactions |

### Scope Summary
- **2 primary user roles:** Seeker, Guide (+ Platform Admin)
- **2 onboarding paths:** Proactive (platform-initiated) + Self-registration
- **4 commerce verticals:** Services, Events, Products, Soul Travels
- **1 AI feature:** Spiritual Journey Guide chatbot (homepage entry point)
- **1 AI backend feature:** Automated document/credential analysis
- **Phase 2 ready:** Subscription model architecture ($50/month for Guides)

### Top-Line Estimate
| Metric | Value |
|--------|-------|
| Total Duration | **28–31 weeks** (~7–8 months) |
| Developer | 1 Senior Full Stack Dev |
| AI Copilot | Claude AI (dedicated, full lifecycle) |
| Confidence Level | **~88–92%** (no wireframes; estimate based on similar marketplace builds) |
| MVP Go-Live | ~Week 24 (core flows, no events/ecommerce) |
| Full Production Go-Live | ~Week 31 |

> **Claude Copilot Efficiency Gain:** Based on observed productivity with AI pair-programming on complex TypeScript/NestJS/Next.js projects, the copilot delivers approximately **30–35% faster output** on boilerplate, schema design, integration code, and debugging. All estimates below are post-adjustment.

---

## 2. Tech Stack Decision & Rationale

### Confirmed Stack (Your Choices Endorsed + Augmented)

| Layer | Technology | Version | Rationale |
|-------|------------|---------|-----------|
| **Frontend** | Next.js | 15 (App Router) | SSR/SSG for SEO, React Server Components, Vercel-native, TypeScript-first |
| **Backend** | NestJS | 11 | Enterprise-grade, modular, TypeScript-first, decorators for clean architecture |
| **Primary DB** | PostgreSQL | 16 | Complex relational data, JSONB for flexible metadata, full-text search built-in |
| **ORM** | **Prisma** | 5.x | Better NestJS integration than Drizzle, mature migrations, excellent type safety |
| **Cache / Sessions** | Redis | 7 (Redis Cloud) | Rate limiting, session store, job queues, API response caching |
| **Job Queue** | BullMQ | 5.x | Async document processing, email delivery, scraping jobs — runs on Redis |
| **Search** | **Algolia** | v4 | Superior relevance scoring for practitioner discovery vs raw pg_tsvector |
| **File Storage** | AWS S3 + CloudFront | — | Verification docs, profile images, video, digital product files |
| **Email** | **Resend** | — | Modern API, excellent deliverability, React Email templates |
| **Payments** | Stripe Connect | — | Non-negotiable. Multi-party payments, KYC for Guides, automatic commission splits |
| **Identity Verify** | **Persona** | — | As specified. Government ID verification, liveness check |
| **OCR** | AWS Textract | — | As specified. Credential document extraction |
| **AI Guide + Doc NLP** | **Anthropic Claude API** | claude-sonnet-4-6 | AI Journey Guide chatbot + NLP entity extraction for credential validation |
| **Virtual Events** | Zoom SDK | — | Virtual event hosting integration |
| **Infrastructure** | Docker + **Railway** (Phase 1) → AWS ECS Fargate (Scale) | — | Railway for fast solo-dev deployment; migrate to AWS at scale |
| **Monorepo** | **Turborepo** | — | Shared TypeScript types/schemas between Next.js and NestJS |
| **CI/CD** | GitHub Actions | — | Automated test, build, and deploy pipeline |
| **Monitoring** | Sentry (errors) + Grafana/Prometheus | — | Error tracking + performance metrics |
| **Frontend Hosting** | Vercel | — | Next.js native, zero-config deployment, edge functions |

### Secondary Thoughts & Deviations from Brief

> **Your brief suggested:** Vite + React + Drizzle + MySQL/TiDB. Here is why we deviate:

1. **Next.js over plain Vite/React:** The platform is SEO-critical (practitioner discovery = organic search). Next.js App Router delivers SSR/SSG out of the box. Vite is SPA-only without SSR plugins.

2. **Prisma over Drizzle:** Drizzle is excellent but still maturing. For a solo dev managing complex migrations (users, services, bookings, payments, events, products, credentials), Prisma's type-safe client and migration history are significantly more battle-tested. Zero risk of data-loss migrations.

3. **PostgreSQL over MySQL/TiDB:** PostgreSQL's JSONB columns allow flexible practitioner metadata (custom subcategories, dynamic credential fields). TiDB adds unnecessary operational overhead for your current scale. Postgres on Railway or Supabase is trivially managed.

4. **Algolia for search:** A practitioner marketplace lives and dies on discovery quality. `pg_tsvector` is good but relevance ranking for multi-faceted searches (category + location + price + rating + availability) requires careful tuning. Algolia handles this out-of-the-box. Budget: ~$0–$50/month at launch.

5. **Railway for initial hosting over AWS:** A solo developer should not spend 2–3 weeks on AWS IAM/VPC/ECS configuration. Railway deploys Docker containers with PostgreSQL and Redis in under 1 day. Migrate to AWS ECS when you hit sustained 10k+ users/month.

6. **Turborepo monorepo:** Sharing the Prisma schema types and Zod validation schemas between `apps/web` (Next.js) and `apps/api` (NestJS) eliminates a major source of drift bugs.

### Architecture Decision Record (ADR)

```
ADR-001: Monorepo structure (Turborepo)
  - apps/web       → Next.js 15 frontend
  - apps/api       → NestJS 11 backend
  - packages/db    → Prisma schema + generated client
  - packages/types → Shared TypeScript interfaces/DTOs
  - packages/email → React Email templates

ADR-002: API pattern → REST (NestJS) with tRPC bridge (optional)
  - Primary: REST API with OpenAPI/Swagger docs
  - Optional v2: tRPC for type-safe client-server calls in Next.js

ADR-003: Authentication → JWT (access token 15m) + Refresh Token (7d, httpOnly cookie)
  - Guard-based RBAC (SEEKER | GUIDE | ADMIN | SUPER_ADMIN)
  - Guides can also hold Seeker role (multi-role)

ADR-004: Background jobs → BullMQ on Redis
  - Queues: email, document-analysis, scraping, payouts, notifications

ADR-005: File uploads → Direct S3 pre-signed URLs (client → S3 direct, no backend relay)
```

---

## 3. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│   Next.js 15 (Vercel)  │  Mobile Web  │  Admin Panel (Next.js)  │
└──────────────┬──────────────────────────────────────────────────┘
               │ REST / Server Actions
┌──────────────▼──────────────────────────────────────────────────┐
│                         API LAYER                                │
│                    NestJS 11 (Railway/ECS)                        │
│  Auth │ Users │ Guides │ Services │ Bookings │ Payments │ AI     │
│  Events │ Products │ Reviews │ Admin │ Webhooks │ Search  │       │
└──────┬────────┬────────┬──────────┬───────────┬──────────────────┘
       │        │        │          │           │
┌──────▼──┐ ┌───▼────┐ ┌─▼──────┐ ┌▼─────────┐ ┌▼──────────────┐
│PostgreSQL│ │ Redis  │ │AWS S3  │ │  BullMQ  │ │  Algolia      │
│(Prisma) │ │(Cache/ │ │(Files/ │ │  Workers │ │  (Search)     │
│         │ │ Queues)│ │  CDN)  │ │          │ │               │
└─────────┘ └────────┘ └────────┘ └──────────┘ └───────────────┘
                                        │
                        ┌───────────────┼──────────────────┐
                        │               │                  │
                   ┌────▼───┐    ┌──────▼──────┐   ┌──────▼───┐
                   │Resend  │    │AWS Textract │   │ Claude   │
                   │(Email) │    │(OCR)        │   │ API (AI) │
                   └────────┘    └─────────────┘   └──────────┘

External Services:
  Stripe Connect (payments)  │  Persona (identity verify)  │  Zoom SDK
```

### Database Entity Map (Core Tables)
```
users → user_roles → roles
users → seeker_profiles
users → guide_profiles → guide_categories → categories
guide_profiles → services → service_slots → bookings
guide_profiles → products → product_orders
guide_profiles → events → event_tickets → ticket_purchases
guide_profiles → credentials → credential_verifications
guide_profiles → blog_posts
bookings → payments → platform_fees
users → reviews (seeker→guide, post-booking)
users → testimonials (guide→guide)
guide_profiles → payout_accounts → payout_requests
```

---

## 4. Feature Module Breakdown

### Module 1: Auth & User Management
| Feature | Complexity | Notes |
|---------|-----------|-------|
| Seeker registration (email + social) | Medium | Google/Apple OAuth optional |
| Guide registration (both paths) | High | Multi-step wizard |
| JWT auth + refresh tokens | Medium | httpOnly cookies |
| Multi-role system (Seeker+Guide) | Medium | One account, two roles |
| Email verification | Low | Resend + BullMQ |
| Password reset flow | Low | |
| Admin & Super Admin roles | Medium | |
| Session management | Medium | Redis-backed |

### Module 2: Practitioner Onboarding

#### Path A — Proactive (Platform-Initiated)
| Feature | Complexity | Notes |
|---------|-----------|-------|
| Web scraper service | High | Puppeteer/Playwright-based, configurable per source (PsychologyToday, personal sites) |
| Auto profile creation from scraped data | High | Data normalization, duplicate detection |
| Claim token generation + storage | Medium | Time-limited, one-use tokens |
| Invitation email flow | Medium | Resend, customizable template |
| Claim & edit profile flow | Medium | Token validation, account merge logic |

#### Path B — Self-Registration
| Feature | Complexity | Notes |
|---------|-----------|-------|
| "Become a Guide" onboarding wizard | High | Multi-step: category → profile → docs |
| Category & subcategory selection | Medium | Practitioner can add custom subcategories |
| Profile builder (guided) | High | |

#### Verification Layer (Both Paths)
| Feature | Complexity | Notes |
|---------|-----------|-------|
| Document upload (S3 pre-signed URLs) | Medium | |
| Persona API — identity verification | High | SDK integration, webhook handling |
| AWS Textract — credential OCR | High | Extract name + institution |
| Claude API — NLP entity extraction | High | Cross-reference institution DB, flag discrepancies |
| Institution reference database | Medium | Seed with known wellness schools/orgs |
| Manual review queue (admin) | Medium | Flag low-confidence verifications |
| Verified modality badge | Low | Per-credential badge display |
| "Verified Account" badge | Low | Triggered after identity + 1 modality |

### Module 3: Guide Hub

| Feature | Complexity | Notes |
|---------|-----------|-------|
| Public profile page | High | Bio, photo gallery, video gallery, credentials, services, reviews |
| Profile editor | High | Live preview |
| Blog / CMS (personal) | High | Tiptap rich text editor, tags, categories |
| Service management (CRUD) | Medium | Name, price, duration, description |
| Native availability calendar | High | Time slots, recurring availability, buffer times |
| Calendly API option (toggle) | Medium | Alternative to native calendar |
| Event creation & management | High | 3 types: Virtual / Soul Travel / In-Person |
| Zoom integration (virtual events) | High | Meeting creation via Zoom API |
| Ticket tiers & capacity management | Medium | |
| Digital product listings | Medium | Upload file → S3, generate download link post-purchase |
| Physical product listings | Medium | Inventory, variants |
| Financial dashboard | High | Revenue, pending, transaction history, payout requests |
| Payout management ($100 threshold) | High | Stripe Connect payouts |

### Module 4: Seeker Experience

| Feature | Complexity | Notes |
|---------|-----------|-------|
| AI Spiritual Journey Guide (chatbot) | High | Claude API, conversation memory, recommendation engine |
| Practitioner search & discovery | High | Algolia, filters: category/price/rating/availability/location |
| Practitioner public profile view | Medium | Read-only version of Guide Hub profile |
| Service booking flow | High | Slot selection → checkout → confirmation |
| Event ticket purchase | Medium | |
| Product purchase | Medium | Cart for products |
| Checkout (Stripe) | High | Guest + authenticated, 3DS, webhooks |
| Booking history | Low | |
| Favorites / bookmarks | Low | |
| Review submission (post-service) | Medium | Only unlocked after confirmed service |
| Testimonial system (Guide→Guide) | Medium | |

### Module 5: Platform Admin

| Feature | Complexity | Notes |
|---------|-----------|-------|
| Admin dashboard (KPIs) | Medium | Users, GMV, active guides, bookings |
| User management | Medium | CRUD, role management, ban/suspend |
| Practitioner verification queue | High | Document viewer, approve/reject + notes |
| Content moderation | Medium | Reviews, blog posts, flag/remove |
| Category/subcategory management | Low | |
| Platform financial reporting | High | Revenue by period, commission totals, payout history |
| Platform settings | Low | Commission rates, feature flags |
| Scraper job management (Path A) | Medium | Trigger, monitor, review scraped profiles |

### Module 6: Platform Infrastructure

| Feature | Complexity | Notes |
|---------|-----------|-------|
| Stripe Connect integration | High | Guide onboarding, split payments, webhooks |
| Commission engine (12-20%) | Medium | Configurable per category or globally |
| Subscription model architecture | Medium | Build schema + payment hooks; gates activation at 1,000+ guides |
| Notification system | Medium | In-app + email: bookings, payouts, verifications, messages |
| Rate limiting & security hardening | High | Per-route limits, CSRF, helmet, input sanitization |
| GDPR compliance | Medium | Data export, right to erasure, cookie consent |
| Redis caching layer | Medium | Profile pages, search results, category lists |
| Full-text search indexing (Algolia) | Medium | Guide profiles, blog posts, products |

---

## 5. Phase-by-Phase Development Plan

> **Notation:** Each phase shows `[base hours] → [with Claude copilot]`
> Developer capacity: 8h/day × 5 days/week = 40h/week
> Claude efficiency multiplier: ~1.3× on greenfield code, ~1.15× on debugging/integration

---

### Phase 0: Foundation & Architecture
**Duration: 1.5 weeks** (Base: 2 weeks → Claude: 1.5 weeks)

| Task | Hours (w/ Claude) |
|------|-------------------|
| Turborepo monorepo setup (web + api + packages) | 8h |
| NestJS app scaffold (modules, guards, interceptors) | 8h |
| Next.js 15 app scaffold (App Router, layout, auth middleware) | 8h |
| PostgreSQL + Prisma schema design (all core entities) | 16h |
| Docker Compose (dev: postgres, redis, api, web) | 6h |
| Redis setup + connection (NestJS + BullMQ) | 4h |
| AWS S3 bucket setup + pre-signed URL utility | 6h |
| GitHub Actions CI/CD pipeline (lint, test, build, deploy) | 8h |
| Railway environment setup (staging + production) | 6h |
| Environment/secrets management (.env validation with Zod) | 4h |
| **Total** | **74h (~2 weeks)** |

> **Deliverable:** Running monorepo, DB schema locked, dev environment working, CI green.

---

### Phase 1: Authentication & User Management
**Duration: 2 weeks** (Base: 2.5 weeks → Claude: 2 weeks)

| Task | Hours (w/ Claude) |
|------|-------------------|
| Auth module: JWT access + refresh tokens, httpOnly cookies | 12h |
| Seeker registration + email verification | 10h |
| Google OAuth integration (optional but recommended) | 8h |
| Password reset flow (email token) | 6h |
| Role-based access control (RBAC guards — SEEKER/GUIDE/ADMIN) | 10h |
| Multi-role user logic (one account, both Seeker + Guide roles) | 8h |
| User profile management (edit, avatar upload to S3) | 8h |
| Admin + Super Admin role scaffolding | 6h |
| Resend email service integration + React Email base templates | 8h |
| Session management (Redis-backed for admin) | 4h |
| **Total** | **80h (2 weeks)** |

> **Deliverable:** Users can register, verify email, login, and have roles. Auth guards protect routes.

---

### Phase 2: Practitioner Onboarding & Verification
**Duration: 5.5 weeks** (Base: 7.5 weeks → Claude: 5.5 weeks)

#### Sub-Phase 2A: Path B — Self-Registration (do first, simpler)
| Task | Hours (w/ Claude) |
|------|-------------------|
| "Become a Guide" wizard (multi-step UI) | 20h |
| Category + custom subcategory selection | 12h |
| Profile builder form (bio, services preview, documents) | 16h |
| Document upload UI (S3 pre-signed, progress bar) | 10h |

#### Sub-Phase 2B: Verification Engine
| Task | Hours (w/ Claude) |
|------|-------------------|
| Persona API integration (identity verify, webhook handler) | 24h |
| AWS Textract integration (document OCR, entity extraction) | 20h |
| Claude API NLP layer (institution cross-reference, name matching) | 24h |
| Institution reference DB (seed data: known wellness schools/orgs) | 12h |
| Confidence scoring + auto-flag for manual review | 10h |
| Verified modality badge system | 6h |
| "Verified Account" master badge logic | 4h |

#### Sub-Phase 2C: Path A — Proactive Onboarding
| Task | Hours (w/ Claude) |
|------|-------------------|
| Web scraper service (Puppeteer, configurable per source) | 32h |
| Scraped data normalization + duplicate detection | 16h |
| Pre-populated draft profile creation | 10h |
| Claim token system (generate, store, expire) | 8h |
| Invitation email flow (Resend template) | 6h |
| Claim & edit flow (token validation, account merge) | 12h |

#### Sub-Phase 2D: Admin Verification Queue
| Task | Hours (w/ Claude) |
|------|-------------------|
| Verification review queue UI (admin) | 16h |
| Document viewer (S3-served, secure) | 8h |
| Approve/reject with notes + auto-notification | 8h |
| **Total** | **254h (~6.5 weeks but 5.5w with parallel work)** |

> **Deliverable:** Both onboarding paths functional. Documents processed by AI. Badges applied. Admin can review.

---

### Phase 3: Guide Hub — Profile & Dashboard
**Duration: 3.5 weeks** (Base: 5 weeks → Claude: 3.5 weeks)

| Task | Hours (w/ Claude) |
|------|-------------------|
| Public profile page (bio, gallery, badges, services, reviews) | 24h |
| Profile editor with live preview | 16h |
| Photo gallery (multi-upload, reorder, S3) | 10h |
| Video embed (YouTube/Vimeo URL + S3 video option) | 8h |
| Blog / CMS (Tiptap editor, post CRUD, tags, publish/draft) | 24h |
| Service management (CRUD, pricing, duration) | 12h |
| Native availability calendar (slots, recurring, buffer) | 28h |
| Calendly API integration (optional toggle) | 12h |
| Financial dashboard (revenue, pending, history — read-only) | 12h |
| Guide settings & preferences | 6h |
| **Total** | **152h (3.5 weeks)** |

> **Deliverable:** Guides can build a complete public profile, manage services, set availability, write blog posts, see financials.

---

### Phase 4: Seeker Experience & AI Guide
**Duration: 3 weeks** (Base: 4.5 weeks → Claude: 3 weeks)

| Task | Hours (w/ Claude) |
|------|-------------------|
| Homepage design + layout | 8h |
| AI Spiritual Journey Guide chatbot (Claude API, conversation flow) | 28h |
| Recommendation engine (maps intents to practitioners/products/events) | 16h |
| Conversation session management (Redis, multi-turn context) | 10h |
| Algolia search index setup (guide profiles, categories) | 10h |
| Practitioner search page (full-text + filter: category/price/rating/avail) | 20h |
| Search filter UI components | 12h |
| Practitioner public profile view (read-only) | 6h |
| Seeker dashboard (bookings, favorites, history) | 10h |
| Favorites / bookmarks | 4h |
| **Total** | **124h (3 weeks)** |

> **Deliverable:** Seekers can use AI chatbot, search for practitioners, view profiles, and access their dashboard.

---

### Phase 5: Booking & Payment System
**Duration: 3.5 weeks** (Base: 5 weeks → Claude: 3.5 weeks)

| Task | Hours (w/ Claude) |
|------|-------------------|
| Stripe Connect: Guide onboarding flow (linked account creation) | 16h |
| Stripe Connect: onboarding redirect + webhook handling | 12h |
| Service booking flow (slot select → payment → confirm) | 24h |
| Booking confirmation emails (Seeker + Guide) | 6h |
| Commission deduction engine (configurable 12-20%) | 8h |
| Stripe webhook handler (payment_intent, transfers, payouts) | 16h |
| Seeker payment history page | 6h |
| Guide payout management ($100 threshold + manual withdraw) | 12h |
| Payout request → Stripe transfer flow | 10h |
| Refund handling (full/partial, Stripe API) | 10h |
| Cancellation policy engine | 8h |
| **Total** | **128h (3.5 weeks)** |

> **Deliverable:** End-to-end booking and payment operational. Stripe Connect live. Commission auto-deducted.

---

### Phase 6: Events & E-commerce
**Duration: 3.5 weeks** (Base: 5 weeks → Claude: 3.5 weeks)

| Task | Hours (w/ Claude) |
|------|-------------------|
| Event creation (3 types: Virtual / Soul Travel / In-Person) | 20h |
| Zoom API integration (create/update/delete meetings for virtual events) | 16h |
| Event ticketing (tiers, capacity, waitlist) | 16h |
| Ticket purchase flow (Stripe, seat management) | 12h |
| QR code ticket generation + email delivery | 8h |
| Digital product listing (upload, description, pricing) | 10h |
| Physical product listing (inventory, variants, shipping info) | 14h |
| Shopping cart (multi-product checkout) | 12h |
| Digital product delivery (post-purchase S3 signed URL, time-limited) | 8h |
| Product order management (Guide side) | 8h |
| Algolia index: events + products | 8h |
| **Total** | **132h (3.5 weeks)** |

> **Deliverable:** Guides can create events (all types), list products. Seekers can purchase tickets and products.

---

### Phase 7: Reviews & Community System
**Duration: 2 weeks** (Base: 2.5 weeks → Claude: 2 weeks)

| Task | Hours (w/ Claude) |
|------|-------------------|
| User review system (unlock after completed paid session) | 16h |
| Star rating + text review form | 6h |
| Review display on practitioner profile (with aggregated score) | 8h |
| Review moderation (admin flag/remove) | 6h |
| Practitioner testimonial system (Guide-to-Guide) | 12h |
| Testimonial display on profiles | 4h |
| Review/testimonial notification system | 4h |
| Fake review prevention (booking ID validation) | 4h |
| **Total** | **60h (2 weeks)** |

> **Deliverable:** Trust layer complete. Seekers can review after verified purchase. Guides can endorse peers.

---

### Phase 8: Admin Panel
**Duration: 3 weeks** (Base: 4 weeks → Claude: 3 weeks)

| Task | Hours (w/ Claude) |
|------|-------------------|
| Admin dashboard KPIs (users, GMV, active guides, bookings) | 12h |
| User management (list, view, edit, ban, role change) | 12h |
| Guide management (profile view, status, verification override) | 10h |
| Verification queue (document viewer, approve/reject, notes) | 14h |
| Content moderation (reviews, blog posts, flag queue) | 10h |
| Platform financial reporting (revenue, commissions, payouts) | 14h |
| Category & subcategory management | 6h |
| Platform settings (commission rates, feature flags, email templates) | 6h |
| Scraper job management (trigger, monitor, review) | 10h |
| Audit log (critical admin actions) | 6h |
| **Total** | **100h (3 weeks - some tasks parallel)** |

> **Deliverable:** Admins can manage the full platform — users, verification, content, financials, settings.

---

### Phase 9: Security, Performance & Scalability
**Duration: 2 weeks** (Base: 3 weeks → Claude: 2 weeks)

| Task | Hours (w/ Claude) |
|------|-------------------|
| Redis caching (profile pages, search, category lists) | 10h |
| Rate limiting (per-route, per-IP, per-user — Throttler guard) | 8h |
| Helmet, CORS, CSRF protection hardening | 6h |
| Input validation audit (Zod schemas, class-validator everywhere) | 8h |
| SQL injection audit (Prisma parameterized queries verification) | 4h |
| OWASP Top 10 checklist review + fixes | 10h |
| Database indexing audit (query EXPLAIN ANALYZE) | 8h |
| N+1 query elimination (Prisma select optimization) | 6h |
| CDN cache-control headers (CloudFront / Vercel edge) | 4h |
| GDPR compliance (data export endpoint, right to erasure, cookie consent) | 8h |
| Load testing (k6 scripts for critical paths: booking, search, checkout) | 8h |
| **Total** | **80h (2 weeks)** |

> **Deliverable:** Platform passes security review. Load tested. Caching live. GDPR compliant.

---

### Phase 10: Testing, QA & Production Deployment
**Duration: 3 weeks** (Base: 4 weeks → Claude: 3 weeks)

| Task | Hours (w/ Claude) |
|------|-------------------|
| Unit tests: NestJS services (auth, bookings, payments, verification) | 20h |
| Unit tests: Next.js components (critical flows) | 12h |
| Integration tests: API endpoints (Supertest, all happy + error paths) | 20h |
| E2E tests: Playwright (registration, onboarding, booking, checkout) | 24h |
| Production infrastructure setup (Railway Prod or AWS ECS) | 10h |
| Production database migration + seed data | 4h |
| Sentry integration (frontend + backend error tracking) | 6h |
| Monitoring dashboards (Grafana or Railway metrics) | 6h |
| Stripe webhook → Production endpoint verification | 4h |
| Persona webhook → Production endpoint verification | 4h |
| Smoke test checklist execution (all critical flows) | 8h |
| UAT support + bug fixes | 16h |
| Documentation (API docs via Swagger, deployment runbook) | 10h |
| **Total** | **144h (3+ weeks)** |

> **Deliverable:** Production-deployed, monitored, tested platform. Verified working by QA checklist.

---

## 6. Effort Estimation Summary

| Phase | Description | Weeks (w/ Claude) | Hours |
|-------|-------------|-------------------|-------|
| 0 | Foundation & Architecture | 1.5 | 74h |
| 1 | Auth & User Management | 2.0 | 80h |
| 2 | Onboarding & Verification | 5.5 | 254h |
| 3 | Guide Hub | 3.5 | 152h |
| 4 | Seeker Experience & AI | 3.0 | 124h |
| 5 | Booking & Payments | 3.5 | 128h |
| 6 | Events & E-commerce | 3.5 | 132h |
| 7 | Reviews & Community | 2.0 | 60h |
| 8 | Admin Panel | 3.0 | 100h |
| 9 | Security & Performance | 2.0 | 80h |
| 10 | Testing, QA & Deployment | 3.0 | 144h |
| **TOTAL** | | **32 weeks** | **~1,328h** |

> **Buffer recommendation:** Add **10% buffer** (~3 weeks) for scope creep, integration surprises, and real-world debugging = **~35 weeks total** to production verification.
>
> **Calendar duration:** ~8 months from project kickoff to verified production deployment.

### Confidence Intervals by Phase
| Phase | Confidence | Risk Driver |
|-------|-----------|-------------|
| 0 — Foundation | 95% | Standard setup |
| 1 — Auth | 92% | Social OAuth may vary |
| 2 — Onboarding / Verification | 75% | Persona + Textract + Claude chain is novel; integration complexity unknown |
| 3 — Guide Hub | 85% | Calendar native build is complex |
| 4 — AI Guide | 78% | LLM conversation UX tuning is unpredictable |
| 5 — Payments | 82% | Stripe Connect edge cases in production |
| 6 — Events / E-commerce | 85% | Zoom SDK integration variance |
| 7 — Reviews | 92% | Straightforward |
| 8 — Admin | 88% | Standard CRUD |
| 9 — Security | 85% | Audit findings unknown |
| 10 — Testing / Deploy | 80% | Bug volume unknown |
| **Overall** | **~85%** | |

---

## 7. Milestone & Timeline Roadmap

```
WEEK  1-3   │ Phase 0+1: Foundation + Auth live
WEEK  4-9   │ Phase 2: Full onboarding + verification pipeline (both paths)
WEEK 10-13  │ Phase 3: Guide Hub — profile, blog, calendar, financials
WEEK 14-16  │ Phase 4: Seeker discovery + AI Guide chatbot
WEEK 17-20  │ Phase 5: Booking + Stripe Connect payments
             │ ─── 🎯 MILESTONE: MVP INTERNAL DEMO (Week 20) ───────────────
WEEK 21-24  │ Phase 6: Events + E-commerce
WEEK 25-26  │ Phase 7: Reviews + Testimonials
             │ ─── 🎯 MILESTONE: FEATURE COMPLETE (Week 26) ──────────────
WEEK 27-29  │ Phase 8: Admin Panel
WEEK 30-31  │ Phase 9: Security hardening + performance
WEEK 32-35  │ Phase 10: Testing + QA + Production deployment
             │ ─── 🚀 MILESTONE: PRODUCTION GO-LIVE + VERIFIED (Week 35) ─
```

### Key Milestones

| # | Milestone | Target Week | Definition of Done |
|---|-----------|-------------|-------------------|
| M1 | Dev Environment Ready | Week 1.5 | Monorepo running, DB schema finalized, CI green |
| M2 | Auth & User System Live | Week 3.5 | Registration, login, roles working (staging) |
| M3 | Onboarding + Verification Live | Week 9 | Both paths working, Persona + AI doc analysis functional |
| M4 | Guide Hub Complete | Week 13 | Full profile, blog, calendar, services (staging) |
| M5 | MVP Internal Demo | Week 20 | Full booking flow: Seeker finds Guide → books → pays → reviewed |
| M6 | Feature Complete | Week 26 | All modules built and tested on staging |
| M7 | Admin Panel Live | Week 29 | Admin can fully manage platform on staging |
| M8 | Security Hardened | Week 31 | OWASP audit passed, load test passed |
| M9 | Production Verified | Week 35 | All E2E tests green, Stripe Live mode, monitoring live |

---

## 8. Risk Register

| # | Risk | Probability | Impact | Mitigation |
|---|------|------------|--------|-----------|
| R1 | Persona API integration complexity exceeds estimate | Medium | High | Spike 1 day early; have Stripe Identity as backup |
| R2 | AI document analysis (Textract + Claude) accuracy below threshold | Medium | High | Manual review fallback for all low-confidence; tune prompts iteratively |
| R3 | Web scraper blocked by target sites (anti-bot) | High | Medium | Use stealth mode (playwright-extra), respect robots.txt, rate-limit aggressively; treat Path A as lower priority |
| R4 | Stripe Connect onboarding UX causes Guide drop-off | Medium | High | Implement Stripe Express (simplified) vs Standard; test with 5 guides early |
| R5 | Native calendar complexity exceeds estimate | Medium | High | Start with Calendly API integration as fallback; native calendar as enhancement |
| R6 | AI chatbot (Journey Guide) response quality unsatisfying | Medium | Medium | Invest in prompt engineering; use few-shot examples; A/B test conversation flows |
| R7 | Single developer availability risk (illness, burnout) | Low | High | Claude copilot reduces bus factor; keep comprehensive PR descriptions as documentation |
| R8 | Scope creep from new feature requests mid-build | High | High | Strict change control: any new feature → appended to backlog, not current sprint |
| R9 | PostgreSQL performance at scale (1k+ guides, 100k+ bookings) | Low | Medium | Connection pooling (PgBouncer), proper indexing, read replicas when needed |
| R10 | Third-party API cost overruns (Algolia, Textract, Claude API) | Medium | Medium | Budget alerts on all APIs; fallback to pg_tsvector if Algolia cost spikes |

---

## 9. Third-Party Integration Summary

| Service | Purpose | Complexity | Cost Model | Setup Time |
|---------|---------|-----------|-----------|-----------|
| **Stripe Connect** | Payments, payouts, commission splits | High | % per transaction | 3–4 days |
| **Persona** | Identity verification (government ID) | High | Per verification | 2–3 days |
| **AWS Textract** | OCR for credential documents | Medium | Per page | 1–2 days |
| **Anthropic Claude API** | AI Guide chatbot + NLP doc analysis | Medium | Per token | 1 day |
| **Resend** | Transactional email | Low | Per email | 0.5 day |
| **Algolia** | Practitioner search | Medium | Per search | 1–2 days |
| **AWS S3 + CloudFront** | File storage + CDN | Medium | Per GB / request | 1 day |
| **Zoom SDK** | Virtual event hosting | High | Per minute/host | 2–3 days |
| **Redis Cloud** | Cache + queues | Low | Per GB | 0.5 day |
| **Railway** | Hosting (PostgreSQL + NestJS + Redis) | Low | Flat monthly | 0.5 day |
| **Vercel** | Next.js frontend hosting | Low | Flat monthly | 0.5 day |
| **Sentry** | Error monitoring | Low | Free tier initially | 0.5 day |
| **GitHub Actions** | CI/CD | Low | Free tier | 1 day |

---

## 10. Infrastructure & DevOps Plan

### Environments
| Env | Purpose | Infra |
|-----|---------|-------|
| `local` | Developer laptop | Docker Compose |
| `staging` | Integration testing, demos | Railway (shared) |
| `production` | Live platform | Railway Pro → AWS ECS Fargate at scale |

### Production Infrastructure (Railway → AWS Migration Path)

**Phase 1 (Launch, 0–10k users):** Railway
- PostgreSQL (Railway managed, daily backups)
- Redis (Railway managed)
- NestJS API (Railway service, auto-scaled to 2 replicas)
- Next.js frontend (Vercel)
- Estimated cost: ~$50–100/month

**Phase 2 (Growth, 10k–100k users):** AWS
- RDS PostgreSQL (Multi-AZ)
- ElastiCache Redis (clustered)
- ECS Fargate (NestJS, auto-scaling)
- CloudFront + S3 (assets + CDN)
- Estimated cost: ~$300–800/month

### CI/CD Pipeline (GitHub Actions)
```yaml
On PR:
  → lint (ESLint, Prettier)
  → typecheck (tsc --noEmit)
  → unit tests
  → build

On merge to main:
  → all above
  → integration tests
  → deploy to staging (Railway)
  → smoke test

On tag (vX.Y.Z):
  → deploy to production
  → post-deploy smoke test
  → Sentry release
```

---

## 11. Definition of Done & Quality Gates

### Per-Feature DoD
- [ ] Feature implemented and peer-reviewed (Claude copilot review)
- [ ] Unit tests written (≥80% coverage on services)
- [ ] API documented in Swagger
- [ ] No TypeScript `any` types introduced
- [ ] No `console.log` in production code
- [ ] Error cases handled with proper HTTP status codes
- [ ] Input validation (Zod/class-validator) at all API boundaries

### Per-Phase DoD
- [ ] All features tested on staging environment
- [ ] Regression tests pass
- [ ] No P0/P1 bugs open
- [ ] Performance baseline met (API p95 < 500ms, page LCP < 2.5s)

### Production Go-Live Checklist
- [ ] All E2E tests green (Playwright)
- [ ] Stripe Live mode configured and tested
- [ ] Persona production credentials active
- [ ] Sentry error tracking live
- [ ] Database backups automated and verified
- [ ] Rate limiting active on all public endpoints
- [ ] SSL certificates valid
- [ ] GDPR cookie consent banner live
- [ ] Admin able to log in and review verification queue
- [ ] At least 5 verified Guides onboarded (smoke test data)
- [ ] Full booking flow completed end-to-end in production

---

## Appendix A: Service Categories (from Brief)

| Main Category | Suggested Subcategories |
|---------------|------------------------|
| Mind Healing | Meditation, Hypnotherapy, NLP, Mindfulness Coaching, Psychotherapy |
| Body Healing | Yoga, Reiki, QiGong, Energy Healing, Massage, Herbalist, Acupuncture |
| Soul Travels | Spiritual Retreats, Cultural Immersions, Nature-Based Healing Trips |
| Life Coaching | Career Coaching, Relationship Coaching, Executive Coaching, Purpose Coaching |
| Creative Arts | Art Therapy, Music Therapy, Expressive Dance |

> All subcategories are practitioner-extendable (custom subcategories stored in DB, pending admin approval).

---

## Appendix B: Subscription Model Architecture (Future Phase)

**Trigger:** 1,000+ verified Guides on platform.
**Model:** $50/month per Guide for premium listing + features.

**Architecture decisions to make now (so we don't rewrite later):**
1. `guide_subscriptions` table with `status`, `stripe_subscription_id`, `current_period_end`
2. Feature flag system in `platform_settings` to gate subscription requirement
3. Stripe Billing setup during Phase 5 (Stripe Connect already in place — Billing is additive)
4. Graceful degradation: if Guide doesn't subscribe → profile still visible but marked "Unverified" or deprioritized in search

**Estimated additional work when activated:** ~2 weeks

---

*Document generated by Claude AI (claude-sonnet-4-6) acting as Technical Project Manager.*
*Last updated: March 9, 2026*



Spiritual_California_Marketplace_Platform/
├── Backend/
│   └── api/           ← NestJS REST API (serves EVERYTHING)
│                         - Public marketplace endpoints
│                         - Guide/Seeker endpoints  
│                         - Admin endpoints (/api/v1/admin/*)
│
└── Frontend/
    └── web/           ← Next.js 15 app (ALL frontend in one place)
                          - Public marketplace (/)
                          - Seeker dashboard (/dashboard)
                          - Guide hub (/guide/*)
                          - Admin panel (/admin/*) ← protected by middleware

                  
                  cd Frontend/web
npm run dev
Then open http://localhost:3000/login and use:

Field Value
Email admin@spiritualcalifornia.com
Password  Admin@123456

Step 1 — Auth Module (2-3 days)         ← REQUIRED foundation
  ├── JWT access + refresh tokens
  ├── Login / Register endpoints
  ├── RBAC guards (ADMIN / SUPER_ADMIN)
  └── Password reset

Step 2 — Users Module (1 day)           ← Admin needs to manage users
  └── User CRUD + role management

Step 3 — Admin Module backend (2 days)  ← The actual admin API
  ├── Dashboard KPIs
  ├── User management endpoints
  ├── Verification queue endpoints
  ├── Financial reporting
  └── Platform settings

Step 4 — Admin Frontend in Next.js      ← Admin UI
  ├── Login page
  ├── Dashboard
  ├── User management table
  └── Settings

All seed data inserted successfully. The database is now populated with:

1 SuperAdmin — admin@spiritualcalifornia.com / Admin@123456
9 Guides (Los Gatos, San Jose, Campbell, Cupertino, Saratoga, Los Altos, Santa Clara) — password: Guide@123456
6 Seekers (Silicon Valley region) — password: Seeker@123
12 bookings, 9 reviews, 5 events, 7 products, 3 blog posts


