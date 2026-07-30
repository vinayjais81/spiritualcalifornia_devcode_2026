# Practitioners Modality Filter & Featured Strip

Fixes the QA defect *"Practitioners modality filter excludes matching
practitioners; Featured carousel ignores the filter"* (severity: normal) —
[SpiritualCalifornia-playwright-testing#3](https://github.com/SvetlanaZap/SpiritualCalifornia-playwright-testing/issues/3).

Two independent bugs in `GuidesService.listPublic`
(`Backend/api/src/modules/guides/guides.service.ts`).

## Bug 1 — the filter read the wrong column

```ts
where.modalities = { has: filters.modality };   // old
```

Modality data is split across **two** stores, and the filter only consulted the
emptier one:

| Source | Written by | State on QA |
| --- | --- | --- |
| `GuideProfile.modalities` (`String[]`) | guide, via onboarding/dashboard free-text | `[]` for every seeded practitioner; hand-typed junk elsewhere |
| `categories` → `subcategory.name` | the seed and the category picker | populated, at exactly the right granularity |

Verified against the live QA API (`GET /api/v1/guides/public`, 21 guides):

```
Maya Williams, Reiki Master     modalities: []
Carlos Mendez, QiGong Sifu      modalities: []
Dr. Sarah Chen, L.Ac.           modalities: []
Priya Sharma, E-RYT 500         modalities: []
Marcus Thompson, PCC            modalities: ["keywords1","keywords2"]
vinayGuide Jaiswal              modalities: ["Yoga","Running","Breathing"]
Invte Practitioner              modalities: ["Reiki","Breathwork","Somatic Healing"]
```

So `has: 'Reiki'` matched exactly one guide — the test account "Invte
Practitioner" — and excluded Maya Williams, whose `subcategorySlugs` are
`['reiki', 'energy-healing', 'sound-healing']`. Hence "Showing 1 practitioner".

Every credible practitioner in the directory was unreachable by every chip.

### Fix

Match either source:

```ts
where.OR = [
  { modalities: { has: modality } },
  { categories: { some: { subcategory: { name: { contains: modality, mode: 'insensitive' } } } } },
  { categories: { some: { subcategory: { slug: slugify(modality) } } } },
];
```

**`contains`, not `equals`** — because some chips are family names rather than
leaf subcategories, and exact matching leaves those permanently empty:

| Chip (value sent) | Actual subcategory | Exact | Contains |
| --- | --- | --- | --- |
| Coaching | `Career` / `Relationship` / `Executive` / `Purpose Coaching` | ✗ | ✓ |
| Qigong | `QiGong` | ✗ (case) | ✓ |
| Reiki, Breathwork, Meditation, Yoga, Sound Healing | exact names exist | ✓ | ✓ |
| ~~Ayurveda~~ → `Ayurvedic` | `Ayurvedic Nutrition` | ✗ | ✗ → ✓ after relabel |

It also means the "Meditation" chip now picks up Tibetan and Walking
Meditation, which is what choosing that chip means.

### Correction: `contains` alone did not fix the Ayurveda chip

An earlier revision of this document claimed `contains` rescued
Ayurveda → `Ayurvedic Nutrition`. It does not. The two strings diverge at the
eighth character — `Ayurved**a**` vs `Ayurved**ic**` — so `'Ayurveda'` is not a
substring of `'Ayurvedic Nutrition'`. Post-deploy verification against the live
API showed that chip still returning 0 while every other chip returned results.

Fixed by changing the value the chip sends from `Ayurveda` to `Ayurvedic`
(a genuine substring), keeping `Ayurveda` as the display label. The `MODALITIES`
list in `practitioners/page.tsx` now documents that its `slug` is a *matching
token*, not decoration.

**This chip still returns 0 results today**, because no guide on QA currently
has any Nutrition-category subcategory. The code is now correct; the data is
simply empty. It will populate as soon as a practitioner is tagged.

### Post-deploy verification (live QA API)

| Chip | total | featured |
| --- | --- | --- |
| Reiki | 2 (was 1, now includes Maya Williams) | 0 |
| Breathwork | 4 | 1 |
| Sound Healing | 3 | 0 |
| Yoga | 2 | 1 |
| Meditation | 2 | 0 |
| Coaching | 2 | 0 |
| Qigong | 1 | 0 |
| Ayurvedic | 0 (no guide tagged — see above) | 0 |
| *(unfiltered)* | 21 | 3 (auto-fill intact) |

Featured is now empty or filter-consistent on every chip, and still fills to 3
on the unfiltered view.

**Known limitation:** Prisma has no case-insensitive or substring operator for
scalar lists, so the `modalities` clause stays an exact, case-sensitive `has`.
A guide who typed "Life Coaching" by hand won't match the "Coaching" chip via
that column — only via subcategories. Closing that properly means making
subcategories authoritative and treating `modalities` as display-only, which is
a data migration, not a filter change.

## Bug 2 — Featured ran its own query

The featured strip built a completely separate `where` with its conditions
hardcoded, so it never saw `filters`:

```ts
where: { isPublished: true, isVerified: true, isFeatured: true, user: { isActive: true } }
```

With the Reiki filter active it returned Guide01 (Acupuncture), Кирилл и
Наталья (Tibetan Meditation) and vinayGuide (Yoga) — precisely the three the QA
report names.

### Fix

- `where: { ...where, isFeatured: true }` — inherits modality *and* minRating.
- **Auto-fill only on the unfiltered view.** The strip pads to 3 with top-rated
  guides when fewer than 3 are flagged. Under an active filter that padding
  would either duplicate the results list or present non-matching guides under
  a "Featured" heading. An empty strip is the honest answer, and the frontend
  already hides the section when the list is empty.

## Also fixed: cards showed no modality tag

The listing selected only `category.name`, never `subcategory.name` — which is
why a guide tagged reiki/energy-healing/sound-healing rendered "Body Healing"
three times and `modalities[0]` was `undefined`.

Left alone, this would have made the fix look wrong: Maya would appear under the
Reiki filter with no Reiki tag on her card. So `listPublic` now returns
`modalities` as the **union of stored modalities and subcategory names**, deduped
case-insensitively, stored-first so the guide's own wording wins the primary
slot the cards display (`withDisplayModalities`).

This aligns the directory with `getPublicProfile`, which already derived its
`tags` from subcategories — which is where the reporter saw Maya's "top tag is
Reiki" in the first place. The profile page was right; the directory was the
outlier.

`getMyProfile` deliberately still returns raw stored `modalities` — that is the
field the guide edits, and it must not show derived values back to them.

## Tests

`Backend/api/src/modules/guides/list-public-filter.spec.ts` — 12 cases: the OR
shape, slugification of multi-word chips, the `contains` behaviour for Ayurveda
and Coaching, `all`/absent applying no constraint, the visibility gate
surviving alongside the filter, featured inheriting both filters, auto-fill
suppressed under a filter and retained without one, and the modality union
including dedupe, ordering and the empty case.

## Follow-up worth scheduling

The root cause is that `modalities` is a redundant free-text mirror of
subcategories, populated inconsistently and never validated — the live data
contains `keywords1`, `keywords2`, `Running`, `Aerodance`. The filter now works
around that split rather than resolving it. Recommend either backfilling
`modalities` from subcategories and constraining writes to the known set, or
dropping the column in favour of subcategories and keeping free text purely for
search. Until then the two stores will keep drifting.

## Note for the QA suite

`tests/ui/guest/discovery.spec.ts` → *"Filtering Practitioners by Reiki modality
excludes Maya Williams and the Featured carousel ignores the filter"* asserts
the broken behaviour and will now fail. Invert it to assert Maya Williams is
present under the Reiki chip, and that every Featured card carries the active
modality.
