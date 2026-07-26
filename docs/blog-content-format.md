# Blog Post Content Format — raw JSON rendering on the journal (2026-07-26)

Client-reported: the journal post
`/journal/michael-tanaka/sound-healing-101-what-science-says` rendered its body
as literal ProseMirror JSON —

```
{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":…
```

— while other posts (e.g. James O'Brien's) rendered normally.

## Cause

`BlogPost.content` is contractually **HTML**. The Tiptap editor writes
`editor.getHTML()` (`RichTextEditor.tsx`), the create/update DTOs document it as
HTML (`example: '<p>…</p>'`), and every renderer feeds it straight to
`dangerouslySetInnerHTML`.

The seed violated that contract **inconsistently**. Of the blog entries in
`prisma/seed.ts`, the first three were written as
`JSON.stringify({ type: 'doc', content: [...] })` while the rest (from
`guideIdx: 3` onward) were plain HTML strings. So exactly three seeded posts
displayed as raw JSON, which is why the bug looked post-specific rather than
systemic:

- `5-meditation-techniques-for-tech-professionals`
- `hidden-cost-of-hustle-culture-silicon-valley`
- `sound-healing-101-what-science-says`

The guide dashboard had already hit this and carried a private
`normalizeContent()` helper so the editor wouldn't load raw JSON — but the
public post page never got the same treatment.

## Fix

**1. Seed corrected.** All three entries now hold HTML, matching every other
post. Fresh databases can no longer reintroduce the problem.

**2. Shared normaliser** — `Frontend/web/src/lib/postContent.ts`,
`normalizePostContent(raw)`. Legacy rows already exist in the QA/prod
databases, so readers stay defensive rather than relying on a re-seed:

- Input not starting with `{`/`[` → returned **unchanged** (the HTML path is
  untouched, so trusted editor output still renders exactly as before).
- Well-formed `{"type":"doc"}` → serialised to HTML.
- Malformed JSON → returned unchanged.

Handles `heading` (clamped to h2–h4 so a body can't emit a second `<h1>`),
`paragraph`, `blockquote`, `bulletList`/`orderedList`/`listItem`, `codeBlock`,
`hardBreak`, `horizontalRule`, `image`, and the `bold`/`italic`/`code`/`link`
marks. Unknown block types fall back to `<p>` so no copy is silently dropped.

**Security note:** text taken from the JSON path is HTML-escaped, and `link`
`href` / `image` `src` are restricted to `http(s)` — that content never passed
through the editor's sanitiser but does reach `dangerouslySetInnerHTML`. The
old dashboard helper interpolated text unescaped; the shared version does not.

**3. Applied in both consumers.** The public post page
(`(public)/journal/[guideSlug]/[postSlug]/page.tsx`) now renders `bodyHtml`,
and the guide dashboard's duplicate helper was deleted in favour of the shared
one.

Also fixed alongside: the read-time estimate word-counted `post.content`
directly, so on JSON posts it was counting JSON syntax. It now counts the
normalised prose, and splits on `/\s+/` rather than a single space.

## Database state

The three QA rows still hold JSON — they render correctly through the
normaliser, and self-heal permanently the first time anyone opens and saves the
post in the dashboard editor (`openEdit` normalises on load). No data migration
was written; the normaliser covers any stray JSON row in any environment,
including ones the seed didn't create.
