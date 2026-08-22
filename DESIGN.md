# Abhyas — Design System

This file is the contract for how Abhyas looks and moves. Read it before
changing any CSS. It exists so a change can be made without eroding the
design, which has been tuned by hand over many passes.

**The one rule that matters:** nothing here is arbitrary. Every colour, face,
radius and curve has a stated job. If a change conflicts with a rule below,
change the rule deliberately and update this file — don't work around it.

---

## 1. What Abhyas is

A course-resource archive for IIT Hyderabad. Students arrive knowing a
**course code** (`CS2110`) or a **course name**, and leave with a past paper,
notes, an assignment, or the textbook their instructor prescribed.

The design metaphor is **one continuous sheet of warm paper**. The whole page
sits on a single raised sheet (`.shell`) over a tan ground. Resources are
**folders** on that sheet. Anything that breaks the "one sheet" illusion —
nesting a card inside the sheet, a second raised surface — weakens it.

### File map

| File | Role |
|---|---|
| `index.html` | Browse — the course-folder archive |
| `library.html` | The Library — textbooks on shelves |
| `releases.html` | Releases — what shipped / is building / is next |
| `terms.html` | Terms — four statements plus the FAQ |
| `styles.css` | **All** styling. One stylesheet, no per-page CSS. |
| `data.js` | `RESOURCES` + `DEPARTMENTS`. Single source of truth. |
| `app.js` | Browse page: folder cards, filters, modals |
| `books.js` | Book covers + the book detail panel (used by both pages) |
| `library.js` | Library page: shelves, branch filter |
| `releases.js` | `RELEASES` + `VERSIONS` data and renders |
| `terms.js` | FAQ accordion toggle |
| `_archive/` | Nothing here is loaded. Safe to delete. |

Cache-busting is manual: every `<link>`/`<script>` carries `?v=N`.
**Bump the version when you edit a file**, or the browser serves a stale copy.
This has bitten before — an edit appeared not to work because `app.js?v=1`
was cached.

---

## 2. Colour

### Ground

| Token | Value | Use |
|---|---|---|
| `--paper` | `#FFF8E6` | the sheet — main page surface |
| `--surface` | `#FFFDF5` | raised things: sheets, panels, inputs |
| `--ink` | `#282129` | primary text |
| `--ink-soft` | `#61545E` | secondary text, body copy |
| `--muted` | `#928287` | meta, timestamps, counts |
| `--hair` | `#EBE0CA` | 1px borders and rules |
| `--wash` | `rgba(40,33,41,.045)` | soft surfaces: chips, fields, rows |
| `--wash-strong` | `rgba(40,33,41,.09)` | the same, one step up |

**Soft surfaces are ink at low alpha, never an opaque grey.** A wash picks up
whatever sits behind it, so the same chip on the cream sheet and inside a
white panel stay related instead of reading as two different greys. If you
find yourself reaching for `#f4ecdf` or similar, use `--wash`.
| body background | `#EADCC2` | the tan ground behind the sheet |

**The palette is deliberately warm.** It is tuned a few hundred Kelvin warm —
roughly what a screen looks like under macOS Night Shift — because that is
how the owner wanted it to feel for every visitor. Night Shift is a display
filter and never reaches a user's screen, so the warmth is baked into the
values themselves. Blue is attenuated ~4%, red lifted ~1%.

`--surface` is **not** pure white. Pure white is the coldest thing on a
screen and broke the warmth. Do not "fix" it back to `#FFFFFF`.

### Resource kinds — semantic colour

Colour on the Browse page **means something**. This is the most important
colour rule in the system:

| Kind | Colour | Tint | Ink |
|---|---|---|---|
| Past papers / quizzes | `--papers` `#F28700` | `#FEE7C0` | `#8B5000` |
| Notes / slides | `--notes` `#698B39` | `#ECF0D1` | `#495A23` |
| Assignments / labs | `--assignment` `#D04724` | `#FDDFCC` | `#8D2D14` |
| Reference books | `--reference` `#8C6597` | `#F0E6F0` | `#5B3C60` |

All four are warm neighbours of the amber CTA — amber is the anchor, the
others are terracotta, olive and clay-mauve. They are **not** four unrelated
primaries, and adding a blue or a cool green would break the family.

Because colour carries meaning, the UI keeps that promise: clicking an amber
folder opens the modal **already on the Past Papers tab**. See §7.

### Branch accents — decorative colour

Branches (CS, ME, MSME…) also carry a colour, but it is **decorative, not
semantic**. There are 15 branches and no natural colour mapping; the accent
exists only so pills are tellable apart.

Every branch accent is **derived from the four families above** at four
lightness/saturation steps, cycled so neighbouring pills never share a
family. 15 distinguishable accents, zero new hues. They live on
`DEPARTMENTS[].accent` in `data.js`.

**A branch accent only ever appears as a dot, never a fill.** Fills stay
reserved for resource kind. Breaking this makes branch colour look semantic.

### Contrast

Verified with WCAG ratios. Body text `--ink` on `--paper` is **14.8:1**.

**Known issue, pre-existing:** white text on the amber folder face is
**2.47:1**, below the 4.5 AA threshold. It affects the card titles on
past-paper folders. Fixing it means darkening the amber or switching that
text to `--papers-ink`. Do not make it worse.

---

## 3. Type

Four faces. Each has one job. **This is the rule most often broken — check
the table before setting any `font-family`.**

| Token | Face | Job |
|---|---|---|
| `--font-display` | Bricolage Grotesque | **Brand voice only.** Wordmark, hero H1, section headings, modal headings. |
| `--font-course` | Archivo 700 | **Names the thing you are looking for.** Course names, book titles, branch headings, release titles. |
| `--font-body` | Plus Jakarta Sans | Everything readable. Body copy, nav, buttons, form fields. |
| `--font-mono` | DM Mono | Metadata only. Course codes, dates, counts, status labels, ⌘K keycaps. |

The split between display and course is the point: **Bricolage speaks for the
brand, Archivo names the content.** A course name and a book title are the
same kind of object — a scannable item — so they share a face.

### Loaded weights

```
Archivo             700
Bricolage Grotesque 700, 800   (variable optical size 12–96)
DM Mono             400, 500
Plus Jakarta Sans   400,500,600,700,800
```

**Never set a weight that isn't loaded.** The browser fakes it by smearing the
nearest weight, and it looks wrong. DM Mono at 600/700 was a real bug here.
If you need a new weight, add it to the Google Fonts `<link>` in **all three**
HTML files.

### Bricolage has an optical-size axis

`font-optical-sizing: auto` is the default and silently picks a **wider** cut
at smaller sizes. That is usually fine, but it breaks any layout that depends
on a fixed advance width. The footer wordmark pins it:

```css
font-optical-sizing: none;
font-variation-settings: "opsz" 96, "wght" 800;
```

### Tracking — use the curve, never a guess

Letter-spacing **scales with rendered size**. Display type needs pulling
tight; body type needs none. Pick the band by rendered px:

| Token | Value | Band |
|---|---|---|
| `--track-hero` | `-.045em` | 48px+ |
| `--track-xl` | `-.036em` | 30–48px |
| `--track-lg` | `-.030em` | 24–30px |
| `--track-md` | `-.024em` | 19–24px |
| `--track-sm` | `-.014em` | 16–19px |
| `--track-xs` | `0` | under 16px |

Two rules on top of the table:

- **Archivo runs one band looser than Bricolage.** Its counters close up
  faster; past about `-.025em` it turns to mud. A 27px Archivo title takes
  `--track-md`, not `--track-lg`.
- **Clamped type needs a media query.** `.hero h1` is `clamp(2.35rem, 7.4vw,
  5.4rem)` — 37.6px on a phone, 86.4px on desktop. A single token cannot
  follow that, so it drops to `--track-xl` below 650px.

The footer wordmark sits below the table at `-.055em`: it is set larger than
any real heading, so it is a deliberate outlier, not a missing band.

### Line-height

Inverse of tracking — display tight, body loose.

```
display (30px+)   1.02      hero  .96
mid headings      1.05–1.2
body copy         1.5–1.6
```

---

## 4. Shape

```
--r-sm: 10px    --r-md: 16px    --r-lg: 24px
.shell          30px
```

### The signature corner

```css
border-radius: 28px 48px 28px 28px;
```

The oversized top-right corner is what makes a rectangle read as a **folder**.
It is the single most recognisable shape in the system. It appears on:

- `.fcard` — course folders (Browse)
- `.rel-col` — the three release folders (Releases)

Scale it down on small screens (`24px 38px 24px 24px`), never square it off.

White "sheets" inside a folder are always `14px`.

---

## 5. Layout & spacing

One vertical rhythm for content blocks: **`--section-y: 80px`**. Sections
should not each invent their own padding.

```
.wrap      max-width 1180px, padding 0 28px  (18px on mobile)
.shell     border-radius 30px, overflow: clip
.hero      padding 52px 0 20px
.grid      repeat(auto-fill, minmax(250px, 1fr)), gap 30px 26px
.foot      margin-top 130px
```

`.grid` uses `auto-fill` with a **fixed minimum**, not `1fr` tracks, so cards
stay the same size at every viewport and a short last row ends ragged rather
than stretching.

### Breakpoints

`1060px · 900px · 820px · 720px · 700px · 640px · 620px · 560px`

There is no formal scale — they were added where specific components broke.
Prefer reusing an existing one over inventing a ninth.

### Separation is by space, not lines

The footer has **no top rule**. On a continuous sheet a hairline reads as an
arbitrary divider; 130px of air reads as an ending. Reach for space before a
border.

---

## 6. Motion

### Two paths, never both

| Browser | Path |
|---|---|
| Chrome, Edge, Safari | native CSS **scroll-driven animation** (`view()` timelines) |
| Firefox | `IntersectionObserver` one-shot fallback |

The JS skips the observer entirely when the native path is available:

```js
if (window.CSS && CSS.supports("(animation-timeline: view()) and (animation-range: entry)")
    && !matchMedia("(prefers-reduced-motion: reduce)").matches) return;
```

The `@supports` test **must** include `(animation-range: entry)`. Some engines
ship `animation-timeline` without ranges and would run the animation wrong.

Only `opacity` and `transform` are animated — both compositor-friendly.
`filter: blur()` is deliberately excluded from scroll-driven paths; blurring
20 cards continuously during scroll janks.

### Curves and durations

| Token | Value | Use |
|---|---|---|
| `--ease-out-expo` | `cubic-bezier(.16,1,.3,1)` | **arrivals** — the house curve |
| `--ease` | `cubic-bezier(.2,.9,.3,1)` | colour, background, general |
| `--pop` | `cubic-bezier(.34,1.56,.64,1)` | sheets springing out of a folder |
| `--dur-arrive` | `.9s` | anything entering the page |
| `--dur-hover` | `.28s` | anything responding to a pointer |

**Arrivals are long, hovers are short.** A slow, front-loaded deceleration is
most of what reads as expensive; a slow *hover* reads as broken. Do not
shorten `--dur-arrive` to make the page feel "snappier" — that is the wrong
lever, and it is the difference between this site and a template.

### Reduced motion

Every animation is inside `@media (prefers-reduced-motion: no-preference)` or
guarded in JS. Under `reduce`, everything is visible and static and
`scroll-behavior` drops to `auto`.

### Two traps that cost real debugging time

**`overflow: hidden` kills scroll-driven animation.** It makes an element a
*scroll container*, so `view()` timelines resolve against it instead of the
document and every animation reads as already finished. `.shell` uses
**`overflow: clip`** — it crops identically to the radius without creating a
scroll container. Do not change it back.

**`view()` needs a subject it can measure.** Two failures found here:
an anonymous `view()` on an element the animation *scales to zero* collapses
the very subject the timeline measures (`progress` resolves to `null`), and an
**`position: absolute`** subject can leave the ViewTimeline inactive
(`currentTime` null) even when the element is fully on screen. The version
timeline's rail is therefore driven by a short scroll handler in
`releases.js`, and its cards use an IntersectionObserver on every browser.
When a scroll-driven animation "does nothing", read `timeline.currentTime` —
`null` means the timeline never activated, which is a different bug from the
animation being out of range.

**`animation-fill-mode: both` plus a dead timeline = invisible content.** If
the timeline never activates, the element renders its `from` state forever.
Any element given an entry animation needs a path that guarantees it ends up
visible — a `@supports not` fallback, an observer, or a timeout safety net.

**Cascade order beats `@supports`.** A plain `.x { opacity: 0 }` appended
*after* an `@supports` block that sets `.x { opacity: 1 }` wins on source
order at equal specificity, and pins the element invisible. Guard fallbacks
with `@supports not (...)` so the two paths are mutually exclusive rather
than relying on one to neutralise the other.

**Huge text swallows clicks.** The footer wordmark is `~31cqi` with
`line-height: .8`; its glyph inline box overflows the layout box by ~73px
upward and was invisibly covering the byline links. It carries
`pointer-events: none`. Any decorative oversized type needs the same.

### Smooth-scroll libraries

Lenis was tried and **reverted** — it broke scrolling entirely. The cause: it
requires its own stylesheet, and critically `scroll-behavior: auto !important`
while active. Abhyas sets `html { scroll-behavior: smooth }`, and the two
fight until scrolling stalls. If you try again, port the CSS as well as the
JS, and verify by measuring that **content actually moves**, not that
`window.scrollY` changes — a page can report scroll while rendering frozen.

---

## 7. Components

### Folder card (`.fcard`) — Browse

Three real layers, and the layering is what sells it:

1. `.fc-back` — the folder body, `--back`, signature corner
2. `.fc-sheet` ×3 — white sheets peeking out, `14px`, staggered
3. `.fc-front` — the pocket flap, `--front` gradient, white text, `--glow` shadow

On hover the **sheets spring up and the flap sinks** — opposing motion. Each
kind opens differently (`.t-papers` lifts a stack, `.t-notes` has a mid layer,
`.t-reference` is a book spine). Per-kind values live in `.t-*` blocks as
`--back`, `--front`, `--glow`, `--dot`.

**Opening honours the colour.** `activateCard()` in `app.js`:

- a **reference** folder opens the book shelf directly — no modal
- every other kind opens the modal **already on its own tab**
- falls back to "All Files" if that tab would be empty

### Book cover (`.book`) — Library

Course code (mono, small, on top) → title (Archivo) → rule → author (caps).
The **course code leads** because that is how books are indexed: a student
knows `CS2110`, not the book's title. The detail panel repeats it and labels
the course "Prescribed for".

### FAQ accordion (`.faq`) — Terms

The panel animates **`grid-template-rows: 0fr → 1fr`**, never `max-height`.

```css
.faq-panel     { display: grid; grid-template-rows: 0fr;
                 transition: grid-template-rows .5s var(--ease-out-expo); }
.faq-panel-in  { overflow: hidden; }
.is-open .faq-panel { grid-template-rows: 1fr; }
```

`max-height` animates toward a *guessed* value: set it too low and long
answers clip, too high and the tail of the transition eases through empty
space. That dead tail is what makes most accordions feel cheap. `0fr → 1fr`
eases to the answer's real height whatever its length.

One open at a time. The JS in `terms.js` only toggles `.is-open` and
`aria-expanded`; all motion is CSS.

**An accordion hides content, so it only earns its place when there is more
than the reader wants at once.** The four Terms statements are *not* in one:
four one-line facts a reader must not miss should never cost four clicks.

### Version timeline (`.vt`) — Releases

Below the board. A rail down the left with an icon node per release and a card
of grouped bullets. **The board is for small in-flight updates; a numbered
release goes in the timeline.** Keep every line a short bullet — this is a
changelog, not an announcement.

`.s-building / .s-shipped / .s-next` each define **two** token sets:
`--col-*` dress the release folders, `--k-*` dress the timeline. Both map to
the same four brand families. Adding a status means adding both.

### Release folders (`.rel-col`) — Releases

Three columns, each a folder in the archive's own vocabulary: signature
corner, `--col-back` gradient, white `14px` sheets inside, `--pop` hover.
Status maps to existing kind colours — In progress = amber, Shipped = olive,
Next up = mauve.

### Pills

Two variants:

- **Browse (`.pills`)** — resource kinds, roomy: `gap 4px`, `padding 8px 17px`,
  `.88rem`, 8px dot. One raised white chip marks the active one.
- **Library (`#libPills`)** — 15 branch codes, tight: `gap 1px`,
  `padding 7px 11px`, `.82rem`, 6px dot. Fits all 15 on one line.

There is **no "All" pill** on the Library. Nothing selected already means
everything; clicking the active branch again clears the filter. Branches with
no books render `.is-empty` — dimmed, `pointer-events: none`, `disabled` — so
a student sees their branch listed without hitting a dead end.

### Footer

Brand column (mark, blurb, byline, copyright) + three link columns, then the
oversized wordmark sized with **container query units** so it always fills the
content column exactly:

```css
.foot-word-wrap { container-type: inline-size; }
.foot-word      { font-size: 31.4cqi; }   /* 100 ÷ 3.064em advance */
```

It fills ~96%, not 100% — at exactly 100% the final "s" overshoots the
`background-clip: text` box and gets sliced flat.

---

## 8. Data model

`data.js` holds both `RESOURCES` and `DEPARTMENTS`. **`DEPARTMENTS` is the
single source of truth** for branches — Library shelves, the filter pills and
the Contribute form all read from it. Never hardcode a branch list again;
that drift is why the Library once offered five departments and the archive
nine.

```js
{ code: "CS", name: "Computer Science and Engineering",
  accent: "#546F2E", short: "Computer Science" }
```

- `code` — the pill label, and the key on every resource record
- `name` — full official title; Contribute form, tooltips
- `short` — shelf headings; "Engineering" dropped where redundant
- `accent` — the decorative dot (§2)

A resource's `type` is one of `papers | notes | assignment | reference` and
drives its colour. `dominantKind()` picks a folder's colour from the most
common type inside it.

---

## 9. Before you ship a change

1. Did you bump `?v=N` on every file you edited?
2. Does any new `font-family` match the §3 role table?
3. Is every `font-weight` actually loaded?
4. Is new colour drawn from an existing token, or did you invent a hue?
5. If it is a branch colour — is it a dot, not a fill?
6. Is new motion guarded by `prefers-reduced-motion`?
7. Did you check it at **375px, 768px and 1440px**? Most bugs here were
   responsive.
8. Did you verify by measuring the DOM, not by reading the code? Several bugs
   in this codebase looked correct in source and were broken in the browser.

---

## 10. Things that are settled

Do not re-litigate these without a specific reason. Each was tried:

- **No white card around the footer.** The page is already one raised sheet;
  a card inside it flattens both and makes the footer the brightest thing on
  screen. Tried, reverted.
- **No smooth-scroll library** unless its CSS ships with it. See §6.
- **Four type faces, not five.** A serif accent for one line was considered
  and rejected.
- **Colour means resource kind.** Branch colour is decorative. Keep them
  visually distinct in role.
- **The folder corner is the brand.** Don't square it.
