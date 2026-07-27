# Elevate — platform specification

Elevate is private coaching on how someone presents themselves. This document
records what was built, what was deliberately not built, and why.

---

## 0. The line the whole product sits on

Elevate holds photographs of a person's face and body. Under POPIA that is
**special personal information** — the most sensitive data Ascend will ever
store. Every decision below follows from that, and from one product rule:

> Coach the person toward a goal **they** chose. Never judge how they look.

---

## 1. Information architecture — five studios

The old Elevate was one route that did one thing: upload photos, wait, read a
report. That is a product you use once. A studio you can walk into with a
specific question is one you come back to.

| Studio | Route | The question you walk in with |
|---|---|---|
| Style Studio | `/elevate/style` | What do I wear? |
| Look Lab | `/elevate/look` | What do I ask the barber for? |
| Photo Coach | `/elevate/photo` | How do I take this shot? |
| Confidence Coach | `/elevate/confidence` | What do I practise today? |
| Timeline | `/elevate/timeline` | What have I actually changed? |

Plus `/elevate/profile` — direction, goal mode, budget, and an explicit
**never-suggest** list. Every studio tunes itself to these answers.

**The hero is a sentence, not a number.** Commit leads with a figure because
money is a figure. What a person carries into Elevate is a *situation* — an
interview on Thursday, a photo they hate — so the hero states the situation in
their own words.

---

## 2. What was built

| Area | Artefact | State |
|---|---|---|
| Schema, 5 tables | `20260727000200_elevate_studios.sql` | Applied, RLS in-migration |
| Garment vision + guard | `src/lib/wardrobe.ts` | 25 tests |
| Outfit builder (pure) | `buildOutfits`, `findGaps`, `costPerWear` | covered above |
| Photo Coach engine | `src/lib/photoCoach.ts` | 20 tests |
| Studio IA + loader | `src/lib/elevate.ts` | Built |
| Six routes | home, style, look, photo, confidence, timeline, profile | Built |
| Shared content guard | `scanText()` extracted from `glowup.ts` | 28 tests |

---

## 3. The three structural safety decisions

### 3.1 The wardrobe photographs CLOTHES, not people

Every photo the Style Studio touches is a garment — on a hanger, laid flat, on a
rail. That is architectural, not incidental:

- A photo of a shirt carries none of the risk of a photo of a torso. There is no
  body to comment on, so an entire class of harm is **designed out** rather than
  guarded against.
- It is where the styling value actually is. A stylist's advantage is knowing
  what you already own.

The garment response still passes through the same prohibited-content guard as
the coaching reports, because a model asked about a shirt can still volunteer
something about the person wearing it. Tested:
`REJECTS a garment description that strays onto the body`.

### 3.2 The outfit builder is arithmetic, not a model

Category coverage, occasion match, season match, colour compatibility — pure
rules. Instant, free, offline-capable, exhaustively testable, and every
suggestion can state the rule that produced it. It returns **nothing** rather
than a half-outfit; `findGaps()` says what is missing instead.

### 3.3 One guard, one copy

`scanText()` was extracted from `glowup.ts` so every Elevate surface screens
against the **same** patterns. A second copy of that list elsewhere would drift,
and the surface with the stale copy would be the one that leaks.

---

## 4. What was NOT built, and why

### 4.1 Virtual try-on, hairstyle preview, beauty preview — **not built**

The brief asked to render haircuts, beards, nail colours, hair colour and
clothing onto the user's own photographs.

**This requires generative image editing of a real person's face and body — the
same machinery as a deepfake.** Two reasons it was not built:

1. **It is the appearance-anxiety engine the product is forbidden to become.**
   Showing someone an endless series of altered versions of their own face is
   precisely what "never encourage unhealthy appearance standards" rules out.
   The harm is not hypothetical; it is the documented failure mode of every app
   in this category.
2. Claude has no image generation. This would mean selecting and wiring a
   diffusion model, and then owning a face-editing pipeline.

**What was built instead** is what a barber or stylist actually gives you, which
is not a render: *the sentence to say*, the upkeep interval, the daily effort,
the grow-out timeline, and what happens if you hate it. Look Lab says this
plainly on the page rather than hiding the absence.

### 4.2 Attractiveness scores, rankings, comparison — **absent by construction**

There is no cross-user function anywhere in Elevate. Commit has
`cohort_progress()` and `cohort_market()`; Elevate has **no equivalent and must
never acquire one**. No gallery, no "people like you", no score. Every query is
`.eq("user_id", userId)` against an owner-only table, and there is deliberately
no visibility or sharing column in the schema — because the moment such a column
exists, somebody eventually sets it.

### 4.3 The Timeline is not a before-and-after grid

It records **actions and decisions**, not a photo grid of the user's face over
time. A grid invites exactly the self-comparison the product refuses to
encourage. A list of things you did is progress you can point at without judging
how you looked in March.

### 4.4 Confidence Coach is rehearsal, not therapy

Every drill is a behaviour you can perform in a room — an opening line, a pause,
where to put your forearms. Nothing diagnoses, nothing asks about mood, nothing
implies the user is broken. The page carries the SADAG number (0800 567 567) and
says plainly that a styling app is the wrong tool for anything heavier.

### 4.5 Also not built

| Asked for | Why not |
|---|---|
| Retailer catalogue integration | No partner or API exists. Would be fabricated stock. |
| Notifications | Depends on the WhatsApp/n8n track, not yet built. |
| Skin-care *diagnosis* | Routine suggestions only. Diagnosis is medical practice. |
| Brand auto-detection | The prompt explicitly forbids guessing a brand — wrong often enough that the catalogue becomes untrustworthy. |

---

## 5. Data architecture

```
profiles
  ├─ style_profiles     direction, goal, budget, never-suggest   [owner-only]
  ├─ wardrobe_items     garments + vision output                 [owner-only]
  ├─ looks              saved outfits + the reasoning            [owner-only]
  ├─ coach_actions      every suggestion, tickable, dismissable  [owner-only]
  ├─ timeline_entries   what changed and when                    [owner-only]
  ├─ glowup_reports     the coaching reports                     [owner-only]
  └─ glowup_photos      private bucket, signed URLs only         [owner-only]
```

`delete_my_glowup_data()` was extended to cover the new photo-bearing tables. It
returns every storage path the caller owns, then deletes the rows — so "delete
my data" stays a *complete* answer. **Adding a table with a `storage_path`
without adding it to that function silently turns a complete deletion into a
partial one.**

The 18+ age gate sits in front of the whole section, not as a checkbox further
in, because the dating-profile use case is what makes it 18+.

---

## 6. Next

1. **Garment upload + vision wiring** — `buildGarmentPrompt` and
   `validateGarment` are built and tested; the upload route reusing the existing
   private-bucket flow is the remaining work.
2. **Live adversarial test of the guard** against the real Claude API — still
   outstanding from the original build, needs `ANTHROPIC_API_KEY` in Vercel.
3. **Shopping plans** from `findGaps()` output + budget tier.
4. **Weekly summary** from `coach_actions` completed in the period.
