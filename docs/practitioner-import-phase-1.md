# Practitioner Import — Phase 1 (parse, review, create)

Implements Phase 1 of `docs/practitioner-import-invite-strategy.md`: an admin
uploads a practitioner spreadsheet, reviews exactly what will happen, and
creates dormant invited guide accounts.

**Nothing in this phase can send an email.** That is deliberate — it lets the
import ship while the sender identity, pricing and unsubscribe decisions are
still open. The `practitioner-import` module has no dependency on the email
layer at all, so the safety property is structural rather than a flag someone
can flip by mistake.

## Where things live

| | |
| --- | --- |
| Parser | `Backend/api/src/modules/practitioner-import/spreadsheet-parser.ts` |
| Sheet → taxonomy | `.../category-map.ts` |
| Classify, dedupe, commit | `.../practitioner-import.service.ts` |
| Endpoints | `.../practitioner-import.controller.ts` (`/admin/practitioner-import`) |
| Admin screens | `Frontend/web/src/app/(admin)/admin/practitioner-import/` |
| Schema | migration `20260731140000_practitioner_import` |

## The pipeline

```
upload .xlsx ─▶ parse (headers, per sheet) ─▶ normalise ─▶ classify ─▶ DRAFT batch
                                                                          │
                                            admin reviews, rescues, excludes
                                                                          │
                                                                     commit ─▶ dormant accounts
```

### Parsing: by header, never by position

The client's file has **11 different column layouts across 15 sheets**. Column 4
is `Email` on one sheet and `Contact (Psychology Today profile)` on another.
Positional parsing would have written directory URLs into the email column for a
third of the file, so every column is located by matching its header text, per
sheet, and unrecognised headers are reported rather than guessed at.

Other shapes the parser handles, each because the real file contains them:

- **Trailing "Sources:" commentary rows** sitting in the data would otherwise
  import as a practitioner named *"Source: Psychology Today directory, filtered
  by…"*. Detected by prefix and by length — a name is not a paragraph.
- **Credentials glued to names.** `Veronika Gold, MA, LMFT (Polaris Insight
  Center)` → name `Veronika Gold`, credential kept separately. Stripping is
  iterative; the first version removed only `, LMFT` and left `, MA` on the
  profile. Found by running the parser over the real file, not by unit test.
- **A parenthetical that belongs to the name.** `Mushim (Patricia) Ikeda` is a
  dharma name with the legal name inside it, not an organisation — it survives
  intact because the org rule only fires on a trailing parenthetical.
- **Regions posing as cities.** "Bay Area", "San Francisco Bay Area",
  "California" are dropped rather than published as someone's location.
- **Own site vs directory profile.** A URL on psychologytoday.com is a contact
  route we cannot email, so it never lands in `websiteUrl` where it would be
  shown on a profile as the practitioner's own site.
- **Hyperlink cells.** A URL typed into Excel arrives as an object; reading
  `.value` naively yields `[object Object]`.

### Classification

Ordered so the most absolute exclusions win — a suppressed practitioner is never
merely reported as "duplicate":

| Status | Meaning |
| --- | --- |
| `EXCLUDED` | An admin excluded this row on a previous import. Outranks everything. |
| `SKIPPED_NOT_A_PERSON` | Source commentary, not a practitioner. |
| `SKIPPED_NO_EMAIL` | Nothing to invite. Kept as prospect research. |
| `SKIPPED_SUPPRESSED` | Previously asked to be removed. **Never recreate.** |
| `SKIPPED_DUPLICATE` | Address belongs to another row or an existing user. |
| `NEEDS_REVIEW` | Organisation-shaped name, or an unmapped sheet. |
| `PENDING` | Will become an account on commit. |

### What an imported account is

No password (nobody can log in, including us), unverified email, unpublished and
unverified profile — so it fails all three conditions of the public visibility
gate and cannot be found by a seeker or a search engine. `onboardingPath` is set
to `PROACTIVE_INVITE` and `importBatchId` records which upload produced it. The
practitioner's preferred slug is reserved at import so it is still theirs when
they claim it.

Each row commits **in its own transaction**. With 300 rows off a hand-made
spreadsheet something will be wrong, and losing 299 good accounts to one bad row
would be absurd. Failures are written back onto the row: a unique-constraint
clash is a genuine duplicate, anything else parks as `NEEDS_REVIEW` rather than
being mislabelled.

## The skipped list is a work queue

Rows that can't become accounts are the other half of the product, not a
by-product. On the batch screen every skipped row can be:

1. **Given an email inline** — the address is re-run through the same checks the
   import applies (suppression, existing user, in-batch clash), so pasting a
   suppressed address can't bypass them. This is the only workflow that ever
   reaches the 124 practitioners whose only listed contact is a directory
   profile.
2. **Approved** (for `NEEDS_REVIEW`), **excluded permanently**, or annotated with
   an outreach note so two people don't chase the same practitioner.
3. **Exported as CSV** for outreach done outside the panel.

`fingerprint` (sheet + normalised name + city) makes a re-import reconcile onto
the existing row instead of duplicating it — exclusions and outreach notes
survive. It deliberately excludes the email, so an admin adding a missing
address by hand doesn't turn the row into a different person next upload.

## Suppression tombstones

`EmailSuppression` stores an HMAC of the address and never the address itself.
Without it, deleting a practitioner on request and then re-importing the same
spreadsheet would recreate them and email them again — the worst outcome
available to this feature. Checked at import and at inline-email time.

`EMAIL_HASH_SECRET` must be set in production. It falls back to
`JWT_ACCESS_SECRET` with a warning so nothing hashes with an empty key, but
rotating that secret would orphan every tombstone.

## Verified against the real file

31 unit tests, plus a run of the parser over the client's actual workbook:

| | Independent analysis | Parser |
| --- | ---: | ---: |
| Sheets | 15 | 15 |
| Rows | 324 | 324 |
| Source-commentary rows | 15 | 15 |
| Practitioner rows | 309 | 309 |
| With an email | 142 | 142 |
| Duplicate addresses | 5 | 5 |
| Unmapped sheets / headers | 0 | 0 |

Category spread on commit would be: somatic-therapy 107, purpose-coaching 42,
herbal-medicine 36, energy-healing 25, naturopathy 13, shamanism 13,
hypnotherapy 10, acupuncture 9, birth-doula 9, meditation 8,
plant-medicine-integration 7, ayurvedic-nutrition 6, massage-bodywork 6, yoga 5,
sound-healing 4, end-of-life-doula 4, tibetan-medicine 3, breathwork 2.

The three sheets that split across categories all resolved correctly — Doulas
into birth (9) and end-of-life (4), Yoga & Meditation into yoga (5) and
meditation (8), Sound & Breathwork into sound (4) and breathwork (2).

**The workbook is not committed and no test depends on it.** It holds 300+ named
practitioners with contact details; putting that in git history on two remotes
is not a decision to make casually. Tests use a synthetic fixture built in the
same shapes.

## Dependency note

Adds `exceljs` for reading .xlsx. Its `npm audit` advisories are transitive
through `archiver` — the *writing* path, which this code never touches. The
alternative was hand-rolling a ZIP + XLSX reader, which is a poor trade for a
feature whose entire job is reading files other people produce.

## Not in this phase

Invite emails, the claim flow for invited accounts (`claimAccount` still
requires `isTestAccount`), the send queue, retention purges, and the enrichment
crawl. See the strategy doc for the phase plan and the decisions still open.
