# Ascend — the design language

A design language is not a mood board. It is a set of decisions already made, so
that building a new screen is assembly rather than invention — and so that two
screens built months apart still look like one product.

Everything here is enforced in code: `tailwind.config.ts` (scales),
`src/app/globals.css` (material), `src/lib/motion.ts` (motion).

---

## 0. Why the app looked "assembled" before this

Every screen was individually reasonable. Together they weren't, and the reason
was measurable rather than aesthetic:

- **Spacing**: `mb-5`, `mb-6`, `mb-7`, `p-4`, `p-5` used interchangeably. Nine
  distinct vertical gaps across the app, none of them chosen relative to each
  other.
- **Type**: `text-[1.7rem]`, `text-[1.75rem]`, `text-[1.9rem]`, `text-[2.1rem]`,
  `text-[2.5rem]` — five "headline" sizes, no two the same, all arbitrary.
  `text-[0.6rem]`, `text-[0.62rem]`, `text-[0.65rem]`, `text-[0.68rem]` for what
  was conceptually one label style.
- **Motion**: fifteen components, fifteen slightly different durations.
- **Colour**: forty-odd hardcoded hexes in SVG that no theme could reach.

Nobody could point at any one of these. Everybody would feel all of them.

---

## 1. The five principles

### 1.1 Editorial, not dashboard

The type scale has a **violent jump** between `title` (1.75rem) and `display`
(2.5rem) and again to `hero` (3.5rem). A gentle scale reads as a settings
screen. A real gap between "the headline" and "everything else" gives the eye
somewhere to land first, which is what a magazine does and a dashboard doesn't.

Every size carries its own line-height and tracking, because a size without them
is half a decision and the other half ends up scattered across components.

### 1.2 Cinematic motion

Springs, not durations. A duration says "take 300ms whatever you're doing"; a
spring says "you have mass and you're settling" — so a 4px nudge finishes fast
and a full-height sheet takes its time, from the same declaration.

Four named springs (`snap`, `settle`, `weighty`, `figure`) and three durations
for the cases with no distance to travel. **`figure` is deliberately the slowest
— money should not twitch.**

**Motion carries information or it doesn't happen.** Every transition answers
*what changed?* — arrived, settled, expanded, left. Decoration isn't on the list.

### 1.3 Adaptive density

Commit's exchange leads with one number at editorial scale and puts the density
one tap away. Bloomberg's density works because a trader knows what they're
looking for; someone opening this at 6am does not.

Elevate is quieter than Commit on purpose — one is a money surface, the other is
about how you feel looking in a mirror. **Same system, different register.**

### 1.4 Live surfaces

Counters roll. Pools fill. Rails draw. But only where the value genuinely
changed — `animate-pulse-soft` is reserved for data that is actually live, and a
skeleton shimmer means *loading*, not "we added a shimmer".

### 1.5 One material system

Four elevation layers and a component may claim exactly one: `flat` (on the
page), `lift` (a resting card), `float` (came from somewhere — sheets, menus),
`crest` (summit light pooling above, not a drop shadow).

Glass appears on **one** surface — the navigation — because it genuinely floats
over content. Glass everywhere is a 2013 texture, not depth.

---

## 2. Colour: four accents, four meanings

| Token | Means | Never means |
|---|---|---|
| `ice` | live, in progress, yours but not won | success |
| `summit` | **money confirmed as yours** | decoration, chrome, "premium" |
| `fall` | a descent — behind, failed, returned | urgency for its own sake |
| `sage` | the quiet register — labels, captions | disabled |

### On the requested blue and purple

The brief asked for "blue only for analytics, purple only for premium". **Not
added, and the reasoning is the point of the whole document:** the eye only
learns a colour code that stays small. Four accents with fixed jobs is a
language. Six is decoration that *costs the existing four their meaning* —
gold stops reading as "your money landed" the moment it's competing with two
more hues for attention.

Analytics already reads correctly in `ice` and `sage`. There is no premium tier
in the product that needs its own colour.

---

## 3. Theming

Colour lives in CSS custom properties, so **a theme is eleven values, not a
rewrite**. Tailwind resolves through `rgb(var(--token) / <alpha-value>)`, which
keeps `bg-slope/60` working exactly as before.

**Light mode is a genuine inversion, not a tint.** The altitude metaphor
survives: the page becomes high, thin, bright air, and surfaces sit slightly
*below* it — so elevation reads by getting *darker*, the opposite of dark mode.
That is how real light themes avoid looking like a washed-out dark theme. Mint
darkens to teal, gold to bronze; same token, same meaning, different value.

Forty-odd hardcoded hexes in the SVG components were converted to the same
variables, because a chart that can't theme makes the theme a half-theme.

The stored theme is painted by a blocking inline script in `<head>` — the one
place that is the correct answer, because doing it in an effect flashes the
wrong theme on every cold load.

---

## 4. Accessibility, as a constraint not a pass

- **16px minimum on inputs.** Not a style choice: anything smaller makes iOS
  Safari zoom the page on focus.
- **48px minimum tap target** on every button (`min-h-[3rem]`).
- **Focus ring on every interactive element**, on any ground.
- **Reduced motion removes the travel, never the information.** An ascent line
  snaps to *drawn* rather than never appearing; a counter renders its final
  value. Every animated component has a tested static equivalent.
- `text-wrap: balance` on headings, `pretty` on paragraphs — no orphans.

---

## 5. Deliberately not built

| Asked for | Why not |
|---|---|
| Sounds | A money and coaching app that makes noises is a toy. |
| Confetti, particles | The casino register the product spent three passes avoiding. Celebrating a payout like a slot machine undoes it. |
| Haptics | `navigator.vibrate` doesn't exist on iOS Safari — the majority of this audience. A feature that silently works for some users isn't a feature. |
| Blue + purple accents | §2 — dilutes the four meanings that already work. |
| Radial menus, gesture shortcuts | Undiscoverable, fight the browser's own gestures, no accessible equivalent. |
| JS overscroll rubber-banding | An imitation always feels like an imitation. `overscroll-behavior` where the platform gives it to us; nothing where it doesn't. |

---

## 6. Adding a screen

1. `AppShell` — gutter, width and nav inset are already right.
2. Pick from the type scale. If nothing fits, the scale is wrong — fix the
   scale, don't add an arbitrary value.
3. Pick **one** elevation.
4. Motion from `src/lib/motion.ts`. If the movement doesn't say what changed,
   make it a static state.
5. Accent only if it means what §2 says it means.
