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

## 6. The Life Events Engine

The inversion, and the thing that turns Elevate from a set of tools into a
proactive assistant: instead of "what do you want to improve?", Ascend says
*"you have an interview on Tuesday"* and orchestrates backwards from the date.

### Why it is a scheduler, not a model

Everything in the plan is arithmetic on a calendar plus domain knowledge that
does not change. Skin takes weeks. A haircut needs about forty-eight hours to
settle. A tailor's turnaround is not yours to control. None of that requires
inference, and a model would make the plan non-deterministic — the one property
a plan must never have.

### The part that makes it feel built by someone who knows

Every task carries **both** an ideal lead time and a latest-useful date:

| Task | Ideal | Window closes |
|---|---|---|
| Start the skincare run | 21 days | 10 days |
| Choose the outfit | 7 days | 1 day |
| Alterations | 6 days | 3 days |
| **Haircut** | **5 days** | **2 days** |
| Clean or press | 4 days | 2 days |
| Shape the beard | 2 days | 1 day |
| Follow up | −2 days (after) | — |

A haircut the day before an interview is not a close call, it is a mistake. So
with an event tomorrow the haircut is not marked "overdue" — it is marked
**window closed**, moved out of the live plan, and listed separately under "not
worth doing now".

**That honesty is the feature.** A checklist that pretends everything is still
possible is worse than no checklist, because the person discovers the truth on
the morning of the event. Someone four days from a wedding needs to know the
three-week skincare routine is off the table so they can put the time into what
still works.

Readiness is measured against **what is still achievable**, not against the full
list — otherwise a person opening the app four days out is told they are 40%
ready because of a window that shut before they arrived.

### What is stored, and what is not

The **plan is not stored.** It is derived from `(kind, date)` by a pure function
on every render, so improving a lead time applies to every existing event
immediately instead of leaving a trail of plans built by older rules. Only the
event and the ticked tasks are rows — and a task row exists *only* when done, so
there is no "not done" state to fall out of sync.

`life_events` is among the most sensitive tables in the product: it says a
person is job-hunting, on a first date, or away from home on a given week.
Owner-only in every direction, no sharing mechanism at all, and four assertions
prove it — including that a second user cannot attach a task to an event they
do not own even knowing its id.

---

## 7. The Transformation Score

**Not attractiveness. Transformation.** That distinction is enforceable rather
than aspirational, because of what the inputs are — every signal is a count of
something the person *did*:

catalogued a wardrobe item · actually wore it · saved a look · completed a
coaching action · finished a review · recorded progress over time · prepared for
a real event

**There is no model anywhere in this path.** A score built on a model's
assessment of a face would be an attractiveness score wearing a different label,
and it would move when the model changed rather than when the person did.
Counting actions is the only construction that delivers the brief's own
requirement: *"the score changes ONLY when real improvement happens."*

Two details worth naming:

- **Rates, not volumes.** Three coaching actions all completed beats thirty with
  four done. A short list you finish is not less transformation.
- **A burst is not a journey.** The "progress recorded" signal multiplies how
  much is recorded by how long it spans, so twelve timeline entries made in one
  afternoon do not score as twelve weeks of change.

Grooming and communication carry weight and are permanently null — no grooming
log exists and the Communication Lab is not built. Reported as missing with
their weight, excluded from the arithmetic. Same coverage rule as the Discipline
Score; the two share one scoring engine (`weightedScore`) so a fix to the floor,
the rescaling or the apportionment is a fix to both.

Contributions are apportioned by **largest remainder**, so the displayed parts
sum to exactly the score above the floor. Rounding each independently drifts by
a point or two, and someone checking the arithmetic and finding it off by one
has been given a reason to distrust the number.

---

## 8. What the brief asked for that is NOT built

| Asked for | Status |
|---|---|
| **Virtual Try-On Studio** — upload yourself, generate realistic previews in different sizes, colours and poses | **Not built, and not a scheduling matter.** It requires generating photorealistic images of a real, identifiable person's body in clothes they do not own. Ascend has no image-generation capability wired up, and adding one for this purpose builds a deepfake tool for the user's own face. It also requires body-shape modelling, which the system prompt forbids and the tests assert against. The buildable adjacent thing is outfit composition from garment photos the user already owns — no body, no generation. |
| **Retailer integrations** (Nike, Zara, H&M, Cotton On…) | Blocked. Needs commercial agreements and product APIs before it needs code. |
| **Communication Lab with live voice** | Spec. Real-time audio capture, speech pacing, filler-word detection and tone analysis are a separate product surface with their own privacy posture — a microphone is a different consent conversation from a photo. |
| **AI Barber hair simulation** | Same objection as try-on: generating altered images of a real person's head. The Look Lab gives written, specific direction instead — what to ask for, and when. |
| **Personal Brand Score** (LinkedIn, CV, reputation) | Spec. A "credibility score" over someone's professional identity is the highest-consequence number in this brief and needs its own design pass before it exists. |
| **Particles, breathing cards, magnetic buttons** | Declined. See `DESIGN_LANGUAGE.md` §5 — the casino register three passes were spent removing. Motion carries information or it does not happen. |
| **Premium haptics** | `navigator.vibrate` does not exist on iOS Safari, which is most of this audience. |
| **Calendar integration** | Blocked on a provider connection. Events are entered by hand, and the plan does not pretend otherwise. |

The Style Studio's deeper features — closet heatmaps, seasonal rotation, weather
adaptation, packing lists — are all buildable on the existing `wardrobe_items`
table and are the natural next pass.

---

## 9. Next

1. **Garment upload + vision wiring** — `buildGarmentPrompt` and
   `validateGarment` are built and tested; the upload route reusing the existing
   private-bucket flow is the remaining work.
2. **Live adversarial test of the guard** against the real Claude API — still
   outstanding from the original build, needs `ANTHROPIC_API_KEY` in Vercel.
3. **Shopping plans** from `findGaps()` output + budget tier.
4. **Event-aware outfit selection** — the plan says "choose the outfit"; the
   next version picks candidates from the real wardrobe by occasion.
5. **Weekly summary** from `coach_actions` completed in the period.
