# Spiritual California — Image Style Guide v2

**PHOTOREALISTIC · CALIFORNIA POPPY · HUMAN CONNECTION**

> **This supersedes `03-IMAGE-PROMPTS-50.md` completely.** The original muted-gouache
> illustration direction is withdrawn. Do not mix the two — a library with two visual systems
> reads as unfinished.

---

## 1. The brief in one paragraph

Spiritual California is not a Zen retreat. It is **sunlit, warm, populated, and alive**. The
images should look like photographs taken on a good day in California, of real people who are
actually enjoying being where they are — with orange poppies, green hills, tall trees, ocean
light and the specific golden quality of Californian afternoon sun.

The feeling to aim for: **you recognise this place, you want to be in it, and the people in it
look like people you know.**

---

## 2. The colour anchor — extracted from the logo

The mark is an orange disc with a white botanical form in negative space. Sampled directly from
`logo.webp` (96 × 96, no transparency, 49% orange / 39% white):

### Primary

| | Hex | RGB | Notes |
|---|---|---|---|
| **Poppy Orange** *(brand primary)* | **`#F38519`** | 243, 133, 25 | Most frequent pixel value. HSV 30°, 90%, 95%. **Use this everywhere.** |
| *Measured average* | `#F0851C` | 240, 133, 28 | All-orange-pixel mean — slightly darker because antialiased edges pull it down. Reference only. |
| **Logo White** | `#FFFFFF` | 255, 255, 255 | The botanical form. Pure white, not off-white. |

> The logo is a **small raster** (96px). If a vector or brand file exists, confirm `#F38519`
> against it before printing anything. For screen and image work it is accurate.

### Tint and shade ramp (derived)

| Role | Hex | Use |
|---|---|---|
| Deep poppy | `#A85D13` | Shadowed orange, terracotta tile, dusk |
| Poppy dark | `#CC7117` | Hover states, dense flower centres |
| **Poppy** | **`#F38519`** | **The signature** |
| Poppy light | `#F39D49` | Sunlit petal edges, warm fabric |
| Poppy pale | `#F6BB82` | Backgrounds, washes |
| Poppy mist | `#FCE6D1` | Very light section fills |

### Supporting palette

| Role | Notes |
|---|---|
| Golden yellow | Poppy centres, dry summer grass, low sun |
| Living green | Oak, redwood, spring hillside, garden foliage |
| Hazy sky blue | Californian, slightly milky, never electric |
| Warm neutral | Sun-bleached wood, linen, sand, terracotta |

### Two consequences of the logo being a **circle**

1. **The quiet zone must be roughly circular**, not rectangular. Leave a calm patch about 12% of
   the frame width in the lower-right — sky, blurred foliage, plain wall or water. Avoid busy
   detail or high contrast there.
2. **White-on-orange needs a mid-tone background.** The mark disappears on a bright sky and muddies
   on dark foliage. Aim the quiet zone at something mid-value: shaded grass, wood, a wall in soft
   light.

**Every image should contain the poppy orange somewhere** — as actual poppies, or as clothing, a
blanket, a mug, a bicycle, a door, a scarf. Once per image, not everywhere. It is the thread
that makes 119 photographs read as one publication.

**Avoid:** cool grey-blue grading, desaturated "clean wellness" palettes, clinical white, and the
teal-and-orange blockbuster grade.

---

## 3. The locked STYLE BLOCK

Paste this above every subject line, unchanged.

```
STYLE — use for every image in this series, unchanged:

Photorealistic editorial photograph. Shot on a full-frame camera with a 35mm or 50mm prime lens,
natural light only, shallow-to-medium depth of field. The look of a warm, unfussy magazine
feature — not stock photography, not advertising.

LIGHT: Californian daylight. Late afternoon golden hour, or bright open shade, or clean morning
sun. Warm, generous, slightly hazy. Soft shadows. Never flat, never harsh, never studio-lit.

COLOUR: Warm and alive. California poppy orange (#F38519 — the exact brand hex) must appear somewhere in the frame —
as real poppies, or as an object, garment or textile. Supporting palette: golden dry grass,
living green foliage, hazy blue sky, sun-bleached wood, warm sand. Rich but natural saturation.
No cool grey-blue grade, no HDR, no teal-and-orange blockbuster look.

PEOPLE: Real-looking people of genuinely varied ages, body types and ethnicities — Californian
in the true sense. Candid, mid-moment, unposed. Natural expressions: absorbed, amused, at ease,
in conversation. Never a stock-photo grin, never anyone looking into the lens, never a model
posing. Clothing is ordinary and lived-in.

PLACE: Recognisably California — poppy meadows and superblooms, golden hills, coastal bluffs,
redwood and oak groves, farmers markets, sunlit backyards and porches, community halls, tiled
courtyards, small studios with plants and open windows.

COMPOSITION: 3:2 landscape, 1536 × 1024. Generous negative space. Subject placed off-centre.
Foreground depth where possible — foliage, a blurred shoulder, a doorway edge.

DO NOT INCLUDE: text, letters, numbers, logos or watermarks; anyone looking at the camera;
stock-photo poses or expressions; crystals, mandalas, chakra rainbows, glowing auras, lotus
silhouettes or any new-age visual cliché; medical or clinical settings unless specified; heavy
retouching or plastic skin; extra fingers or distorted hands.

Leave a CIRCULAR quiet zone in the lower-right — roughly 12% of the frame width — on a mid-value
area (shaded grass, wood, plain wall in soft light) so a round white-on-orange logo can sit there.
Not bright sky, not dark foliage, not busy detail.
```

---

## 4. Tone tiers — read this before generating anything

The warm bright default is right for most of the library. **It is wrong for some of it.** A
sunlit picnic on an article about self-harm treatment is a serious editorial error, and this is
the most likely way the new direction goes wrong.

Every image subject in the master list is tagged with a tier.

### 🌞 Tier 1 — BRIGHT (default)
Full warmth. Groups, laughter, movement, poppy fields, markets, gardens. Used for the wellness
journal, community practices, and the lighter "What To Do" pieces.

### 🌤️ Tier 2 — WARM QUIET
Same light, same palette, same photorealism — but **one or two people, calm, no laughter, more
space**. Used for sleep, anxiety, grief-adjacent and most Clinic articles.
*Add to the prompt:* `TONE: quiet and warm. One or two people at most. Calm, unhurried, no
laughter. More negative space than usual.`

### 🌥️ Tier 3 — GENTLE / NO FACES
Warm light and poppy orange retained, but **no visible faces and no direct depiction of
distress**. Hands, backs, empty chairs with human traces, a person at distance in a landscape.
Used for trauma, self-harm, OCD, personality disorder, eating disorder and safety-critical
articles.
*Add to the prompt:* `TONE: gentle and respectful. No visible faces. No depiction of distress or
symptoms. Warm light and poppy orange retained. Human presence implied rather than shown.`

**Rule:** when in doubt, go one tier calmer. Nobody has ever been harmed by an image being too
gentle.

---

## 5. Getting consistency out of a photorealistic series

Harder than illustration. Illustration forgives; photography does not — 119 photos from
different sessions will look like 119 different magazines unless you enforce this.

1. **Generate in one continuous session** per series where possible.
2. **Approve one image first**, then attach it as a reference to every subsequent prompt with:
   *"Match the light quality, colour grade, lens character and mood of the attached reference
   exactly. Only the subject changes."*
3. **Re-anchor every 15 images.** Attach your first approved image *and* the most recent good
   one together, and ask for something stylistically between them. Drift is guaranteed around
   image 15–20.
4. **Keep the lens language identical.** "35mm prime, natural light, shallow depth of field" in
   every single prompt.
5. **Never negotiate with drift by adding adjectives.** That compounds it. Re-anchor instead.

---

## 6. Practical rules for photorealistic AI images

- **Hands and faces are where AI fails.** Prefer mid-distance over close-up. Give hands a job —
  holding a mug, a rope, a drum, a book. Three-quarter or profile angles beat straight-on.
- **Groups of more than four go wrong.** Keep to 1–4 people unless the subject demands a crowd,
  and then push them further back.
- **Never ask for text in the image.** Signage, book covers, worksheets — all will come out as
  gibberish. Crop them out or blur them.
- **The logo is composited afterwards**, in Canva or Figma. Never in the prompt. Bottom-right,
  60% opacity, 40px margin.
- **Check every face for uncanny artefacts** before approving. Teeth and eyes first.
- **Diversity must be specified, not assumed.** These models default narrow. Vary it deliberately
  across the library rather than making every single image a diversity tableau.

---

## 7. Ethics and honesty rules

The journal's whole positioning is honesty. The images must not undo it.

- **No image may imply a clinical outcome.** No before/after, no miraculous recovery, no one
  visibly "cured."
- **No image may depict a practitioner treating a patient in a way that suggests efficacy** the
  article says isn't established. For Tier C and D modalities, show the *setting* or the
  *participant*, not a healing act.
- **No real practitioner likenesses**, and no images that could be mistaken for a specific
  identifiable person.
- **Nobody depicted as ill, distressed or in crisis.** Ever. Use Tier 3.
- **No children as subjects in trauma or clinical articles.** For the TF-CBT article, use an
  empty family-friendly space or adult hands.

---

## 8. Output and file naming

- **1536 × 1024**, 3:2 landscape
- Export **WebP** with a **PNG** fallback
- Filename is exactly `{slug}.webp`, matching the master list
- Journal images → `public/images/journal/`
- What To Do → `public/images/what-to-do/`
- Clinic → `public/images/clinic/`

## 9. Quality gate

Reject and regenerate if any of these fail:

- [ ] California poppy orange (#F38519) present, once, naturally
- [ ] Light is warm Californian daylight, not studio or grey
- [ ] Nobody looking at the camera; no stock-photo expressions
- [ ] Hands and faces free of artefacts
- [ ] Zero text, letters or logos in frame
- [ ] Correct tone tier for the article's subject
- [ ] Lower-right has a CIRCULAR mid-value quiet zone (~12% of frame width) for the round logo
- [ ] It looks like a photograph a real person took, not a render
