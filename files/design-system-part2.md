# Reading Station — Design System, Part 2: Per-Section Layout

> Extends `design-system.md` (Part 1: tokens, type, colour, components). This part
> defines the **layout of each section** under the revised direction. Visual
> reference: `specimen-scope-v3.html`. Where this and Part 1 disagree on the field,
> **this part wins** — the field is now full-screen and centred, not a side panel.

---

## 0. DIRECTION CHANGE (supersedes Part 1 §3–§4)

**Specimen scope.** Content is **centred** on screen like a specimen on a reading
stage. The field is **one full-screen canvas, fixed behind everything, radially
symmetric about screen centre**. A thin **viewfinder HUD** sits at the screen edges
(corner brackets + edge readouts + a centre reticle) and "reads" the specimen. The
so-le / side-panel model from Part 1 is retired.

Anti-boredom principle: the page is not one layout repeated. Each section is a
distinct **reading mode** — the field changes *shape and behaviour*, and the centred
content changes *form* (a name, a statement, a log, an index, a channel list). Same
instrument, different specimen each time.

Balance rule: every section is symmetric about the vertical centre line. Content is
centre-aligned; the field is radially symmetric; the HUD is edge-symmetric.

---

## 1. PERSISTENT CHROME (all sections)

### 1.1 Full-screen field (`#scope`)
- One fixed `<canvas>`/R3F surface, `inset:0`, `z-index:0`, `pointer-events:none`.
- Radially symmetric about centre. Density 0.45–0.65 (dark ground + additive =
  density becomes light; the old 0.13 is retired).
- A vignette layer above it (`radial-gradient` fading to `--ground` at the edges)
  so the field concentrates attention at centre and never fights the HUD.
- Scroll does **not** move the field horizontally. Scroll drives **state morph**
  only (see §2). Idle breathing + velocity-gated pointer response always on.
- Paused (frameloop demand) when the tab is hidden; it is always on-screen so it
  cannot be gated by viewport, but it must drop to idle cost when the pointer is
  still and no morph is in progress.

### 1.2 Viewfinder HUD (`.hud`, `z-index:4`, `pointer-events:none`)
Thin, `--ink-faint`, monospace. Never encloses the content — it lives at the
screen edges only, so nothing frames or overlaps the centred copy.
- **Corner brackets** at the four screen corners (L-shaped, 1px `--hairline-2`).
- **Top readout** (centre-top): `SPECIMEN ▸ <STATE>` · `<idx> / 05` · `N=<count>`.
  `<STATE>` in `--phosphor`, updates per section.
- **Edge labels**: vertical mono text hugging left ("Reading station · v1") and
  right (live `X · Y` pointer coordinates).
- **Centre reticle**: a small phosphor crosshair at exact screen centre, opacity
  ~0.5 — the focus point the whole page reads through.
- **REC dot**: 6px `--live`, slow pulse, near the top readout. Hides on
  `webglFailed` (nothing should imply a live field that isn't running).

### 1.3 Nav (`z-index:5`)
Centred row of mono links at top. Active section link → `--phosphor`. Phosphor
underline grows on hover. The active state is set by the same observer that drives
the field (§2).

---

## 2. STATE MORPH ON SCROLL

An `IntersectionObserver` (threshold ~0.5) marks the section in view. On entry it:
1. retargets the field to that section's `SceneState`,
2. updates the HUD `<STATE>` and index,
3. sets the active nav link.

The field lerps toward the new shape (~0.06/frame) so transitions read as an
instrument **refocusing**, not a cut. One state visible at a time.

Section → state → field form:

| Section     | State          | Field form (radially symmetric)                    |
|-------------|----------------|----------------------------------------------------|
| Hero        | `signal`       | horizontal oscilloscope trace across centre        |
| About       | `pixel`        | centred scan grid / matrix                         |
| Work        | `features`     | keypoint scatter in a soft disc                    |
| Research    | `graph`        | concentric node rings (radial index)               |
| Experience  | `volume`       | layered voxel shells / slice stack                 |
| Contact     | `constellation`| sparse still stars, widest spread, calm            |

(Personalised shape targets defined in `redesign-spec.md` Phase 4; these are their
centred, symmetric arrangements.)

---

## 3. PER-SECTION LAYOUT

All sections: `min-height:100vh`, flex column, centre-aligned, vertically centred,
`gap: 1.5rem`, generous top/bottom padding. Reveal on enter: kicker → title →
body, staggered ~70ms, once (GSAP).

### 3.1 Hero — `signal`
The most characteristic thing first: the name as the specimen.
```
            [ kicker · mono phosphor, flanked by two hairline ticks ]
                 L U Ơ N G   Q U Ố C
                 K H Á N H                    ← Newsreader, clamp(3rem,9vw,7.5rem)
            [ lead · Newsreader 300, one line about reading structure ]
            [ Begin reading ↓ ]   [ Get in touch ↗ ]
```
Name centred, on its own rows. Field is a symmetric trace behind it. This is the
one place the display type is largest; spend it here.

### 3.2 About — `pixel`
A single centred thesis statement, no columns.
```
            01 · About
            What a model keeps, and what it throws away.   ← stitle, max 20ch
            [ one centred paragraph, max 52ch, Plex Sans 300 ]
```
Keep it to one statement + one paragraph. The restraint is the point; the field
(scan grid) carries the visual interest.

### 3.3 Work — `features` — the creative moment
Not a boring vertical list. A centred **detection log**: each project is a
"reading taken from the field". The log block is centred (`max-width:62rem`) but
its rows are internally left-aligned for legibility.
```
            02 · Selected work
            Readings taken from the field.
   ┌──────────────────────────────────────────────────────────┐
   │ 01   Self-supervised representation learning   FIELD/FEATURES ·2025 │
   │ 02   Physics-guided cardiac segmentation       FIELD/CONTOUR ·CMIG  │
   │ 03   Depth from uncalibrated multi-view        FIELD/CLOUD ·wip     │
   │ 04   Calibration under distribution shift      FIELD/UNCERTAINTY    │
   └──────────────────────────────────────────────────────────┘
```
Row = `index (mono, phosphor on hover) · {serif title + one-line desc} · meta
(FIELD / STATE in phosphor + year/venue)`. Hairline top per row; on hover a
phosphor rule grows across the top edge and the row nudges 0.5rem right (this is
the ONE place a small horizontal nudge is allowed, because the row is inside a
centred block, not on the page grid). Compact: ≥3 rows visible at once.

**Creative hook:** hovering a row pulses the matching cluster in the field
(the field's `features` scatter briefly brightens the sub-cluster tied to that
row's `SceneState`). Optional, gated on M1 perf.

### 3.4 Research — `graph`
Centred, sparse. The field (concentric graph rings) *is* the visual index; the
readable record stays centred and short.
```
            03 · Research
            Questions, papers, and the links between them.
            [ one centred paragraph ]
            [ Paper title ↗ ]   ← a single phosphor link, or a short centred list
```
If listing papers, use the same detection-log row as Work but lighter (venue/year
mono, title serif), still centred block.

### 3.5 Experience — `volume`
Centred capability readout. Three groups (Vision & learning / 3D & medical /
Research engineering) as three centred mono-labelled clusters, or a single centred
column of capability lines. No 3-column bordered table (that was the old Excel
look). Field = voxel/slice shells.
```
            04 · Experience
            Research and engineering, kept close to the evidence.
            VISION & LEARNING        3D & MEDICAL         RESEARCH ENG
            representation learning  multi-view geometry  pytorch
            self-supervised          depth & recon        reproducible
            image understanding      volumetric seg       diagnostic tooling
```
Three clusters centred as a group, each cluster left-aligned internally, equal
widths, separated by whitespace only — no vertical rules, no borders.

### 3.6 Contact — `constellation`
The quiet ending. Field settles into still, wide-spread stars; motion calms.
```
            05 · Contact
            Open to careful questions and difficult visual problems.
            Email   GitHub   Scholar   LinkedIn   CV     ← centred mono channels
```
Channels are mono links with a phosphor underline on hover, centred in a row. No
field morph after this; the page ends still.

---

## 4. MOTION (additions to Part 1 §7)

- **Refocus transition** between sections: field lerp + a brief HUD "focus pull"
  (the centre reticle tightens/expands ~120ms) so changing specimen feels like an
  instrument refocusing.
- **Velocity-gated pointer** (from particlesGL): field particles dislocate only
  while the pointer is actively moving; damp to rest when still. Coordinate readout
  in the HUD tracks the pointer live.
- **Optional cursor lens**: within a small radius the field switches representation
  (e.g. `features`→`graph`), turning the cursor into an inspection tool. Ship only
  after M1 profiling is clean.
- All disabled under `prefers-reduced-motion`: field static at its first shape, HUD
  coordinates frozen, no refocus animation.

---

## 5. RESPONSIVE

- ≤640px: HUD edge labels + reticle hide; corner brackets shrink; field density
  drops a tier; nav collapses to a centred compact row. Content stays centred and
  fully legible. Detection-log rows drop the meta column.
- The field never causes horizontal scroll; it is `position:fixed; inset:0`.

---

## 6. ACCEPTANCE CRITERIA (additions to Part 1 §10)

1. Content is centred and vertically balanced in every section; nothing is framed
   or boxed by the HUD.
2. The field is one full-screen, radially symmetric canvas; it morphs shape per
   section on scroll and never sweeps horizontally.
3. HUD updates `STATE`/index/coordinates correctly per section; hides field-implied
   marks on `webglFailed`.
4. Each section is a visibly different reading mode (distinct field form + distinct
   content form) — not the same layout repeated.
5. Work rows: ≥3 visible, hover grows a phosphor rule (nudge allowed only inside
   the centred block).
6. 60fps on M1 with idle-cost drop when pointer is still; reduced-motion and
   `webglFailed` fully legible.
