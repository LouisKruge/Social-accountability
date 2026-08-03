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

### 1.1 Surfaces, not cards

**A vertical stack of identical rounded rectangles is the default output of
every UI framework, and the eye stops reading it after about two seconds.** The
fix is not nicer rectangles — it is three different densities on one screen, so
there is an order to read in rather than four identical things to choose
between:

- **The lead** — a hairline rule and a headline. No box at all.
- **The bed** — two columns, hairline-separated, medium weight.
- **The tail** — a list, because those are references rather than features.

The hero figure sits **directly on the black** with no card, no border and no
background, at roughly four times the size of anything near it. That is what
makes a number read as the subject rather than as a statistic inside a widget.

A card is now something you use when content genuinely needs containing — not
the default wrapper for everything.

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

## 2. Colour: monochrome, one accent

| Token | Value | Means |
|---|---|---|
| `valley` | `#000000` | the page — true black |
| `slope` | `#0A0A0A` | elevation 1, a resting surface |
| `ridge` | `#171717` | elevation 2 — raised, hovered, selected |
| `scree` | `#262626` | structure — hairlines, inactive strokes |
| `snow` | `#FFFFFF` | **live** — the thing you should read first |
| `sage` | `#8E8E8E` | the quiet register — labels, captions |
| `summit` | soft amber | **money confirmed as yours.** Nothing else, ever |
| `fall` | red | genuine errors and destructive actions only |

**Hierarchy is carried by brightness, not hue.** In a monochrome system "active"
is simply the brightest thing on screen and "inactive" recedes to grey — a
stronger signal than a colour, and it costs nothing. What used to be mint is now
white; what used to be four competing hues is now one.

### Why the green went

It tinted every surface, and it was the single thing making the app read as
"another finance dashboard" before a component was drawn. Green is what every
fintech reaches for. Removing it is worth more than any amount of card polish.

### Why exactly one accent

Because it is the only hue on the screen, the amber does not have to shout to be
seen — which is the whole mechanism by which restraint reads as expensive. A
second accent would halve its weight; a third would make it decoration.

**Red is the one exception**, and it is an accessibility requirement rather than
a style choice: an error that reads only as grey is a failure. It is reserved
for genuine errors and destructive actions — never for "behind pace".

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
| Sounds | Asked for twice. A money and coaching app that makes noises is a toy, and on the web there is no equivalent of the OS-level silent switch — a sound you cannot reliably suppress is worse than none. |
| Confetti, particles | The casino register the product spent three passes avoiding. Celebrating a payout like a slot machine undoes it. |
| Haptics | `navigator.vibrate` doesn't exist on iOS Safari — the majority of this audience. A feature that silently works for some users isn't a feature. |
| A second accent | §2 — the amber only reads as expensive because it is alone. |
| Radial menus, gesture shortcuts | Undiscoverable, fight the browser's own gestures, no accessible equivalent. |
| A live ticker of other people's activity | Would need fabricated events to look alive — the account currently has one real user and no stakes. It ships when there is genuine activity to show, driven by Supabase realtime, and shows nothing when nothing is happening. |
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

---

## 7. References, and what each one actually contributes

A reference is only useful if you can name the *mechanism* you are borrowing.
"Make it feel like Linear" produces nothing; "Linear earns density by removing
containers, not by shrinking type" is something you can build.

| Reference | The mechanism worth taking | What would be cargo-cult |
|---|---|---|
| **Nothing OS** | Monochrome with a single accent, and a proprietary numeral treatment. Identity from restraint rather than from decoration. | Dot-matrix type. It is *their* signature; copying it makes Ascend look derivative, which is the opposite of the goal. |
| **visionOS** | Layered depth with a clear z-order, and transitions where one element *moves* rather than two cross-fading. | Heavy translucency. It works because Apple composites against a real camera feed; on a 390px web viewport it is a blur filter that costs frames and reads as smeared. Glass here is on **one** surface — the dock — because that one genuinely floats. |
| **Rivian** | Legibility as the premium signal. Large type, enormous contrast, nothing decorative in the driver's eyeline. | Automotive iconography and skeuomorphic gauges. |
| **Linear** | Density earned by **removing containers**, not by shrinking type. Hairlines and alignment do the work a border was doing. | Their exact greys, which are tuned for a desktop app viewed at arm's length. |
| **Arc** | Navigation that isn't a bar, and motion with real momentum. The command bar and the travelling dock pill both come from here. | Sidebar-as-browser-chrome — there is no window to reorganise on a phone. |
| **Monzo / Revolut** | Money stated plainly, and trust built by *showing the mechanism* — where a payment is, what a fee was, why something is held. | Their card-heavy home screens, which are the exact pattern this pass removed. |

### What that produced, concretely

- **Nothing / Rivian** → the palette: black, greys, white, one amber.
- **Linear** → the Commit and Elevate homes have no cards at all. A lead with a
  hairline rule, a two-column bed, a numbered index. Structure from alignment.
- **Arc / visionOS** → the dock's selected pill *travels* via `layoutId`; the
  command bar; springs rather than durations.
- **Monzo** → the payout tracker showing every state transition with its stated
  reason, and `expectedArrival()` returning **null** rather than guessing.

### The reference that mattered most is none of them

The strongest identity decisions in this app came from the *product*, not from
looking at other apps: gold means money that actually landed and nothing else;
the pool fills in the valley and climbs; the challenge glyph is a stair whose
rise is the difficulty. A borrowed mechanism is worth having. A borrowed
signature is worth nothing, because it is by definition already someone's.
