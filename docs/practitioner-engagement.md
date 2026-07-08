# Practitioner Engagement — Applaud, Follow, Share (2026-07-08)

Client-reported: the practitioner blog page and profile page had several
non-functional buttons (styled placeholders with no handler). Resolution,
by button:

## Share (Twitter, LinkedIn, Copy Link) — blog page
Pure client-side, no backend. `handleShare(network)` in the single-post page:
- Twitter → `https://twitter.com/intent/tweet?url=…&text=…` (new tab)
- LinkedIn → `https://www.linkedin.com/sharing/share-offsite/?url=…` (new tab)
- Copy Link → `navigator.clipboard.writeText(location.href)` + toast

## Applaud (clap) — blog page
Simple running tally, deduped per-device (not per-user).
- Schema: `BlogPost.applauseCount Int @default(0)`.
- API: `POST /blog/:id/applaud` (`@Public()`) → `{ applauseCount }`. Increments
  and returns the authoritative count. 404 if the post isn't published.
- Client: optimistic bump, persists `sc-applauded-<postId>` in localStorage to
  disable the button after one clap per device; reconciles with the server
  count on success, reverts on failure.
- `findBySlug` already returns the post's scalars, so the initial count needs
  no extra query.

## Follow — blog page (author bar)
Seeker → guide follow. Any signed-in user may follow; anonymous users are
prompted to sign in (redirect back to the post).
- Schema: `GuideFollow { userId, guideId, @@unique([userId, guideId]) }`;
  relations on `User.guideFollows` and `GuideProfile.followers`.
  `followerCount` is derived (count of rows), not denormalised.
- API (`/guides`, auth-required, no role restriction):
  - `POST :id/follow` → `{ isFollowing: true, followerCount }` (upsert, idempotent)
  - `DELETE :id/follow` → `{ isFollowing: false, followerCount }` (deleteMany, idempotent)
  - `GET :id/follow-status` → `{ isFollowing, followerCount }` for the current user
  - `:id` is the **GuideProfile.id** (blog `findBySlug` now returns `guide.id`).
- Client: loads follow-status on mount (signed-in only), optimistic toggle,
  reverts on error. Not-signed-in click → toast + `/signin?redirect=…`.

## Send Message — guide profile page
**Hidden**, not wired. There is no seeker↔guide direct-messaging subsystem
(no Message/Conversation models, inbox, or notifications), and routing to the
platform contact form would be misleading. "Book a Session" already covers
reaching a guide. Revisit when messaging is scoped as its own phase.

## Migration
`20260708120000_blog_applause_guide_follow` — adds `blog_posts.applauseCount`
and the `guide_follows` table. Hand-authored to match the schema (applied on
deploy via `prisma migrate deploy`).
