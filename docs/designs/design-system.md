# Reading Station — Design System Spec (v1)

> Design delegation spec for the implementation agent (Codex). Self-contained.
> Repo: `QuocKhanhLuong/Portfolio` (Next.js 14 + R3F + GSAP + Lenis, CSS Modules).
> Pairs with `redesign-spec.md` (structure/perf/phases). This file defines the
> **look**: tokens, type, the field treatment, and every component. Visual
> reference: `reading-station-ui-kit-v2.html`. Where this spec and the reference
> disagree, this spec wins (the HTML is a sketch; some marks are mis-aligned there
> on purpose-to-be-fixed — see §5.4).

---

## 0. CONCEPT

**Reading station.** The portfolio is presented as a scientific image-reading
instrument (oscilloscope / radiology light-box / DICOM scope). The particle field
is the *signal / scan being read*, not decoration. All "techno-retro" cues come
from lab-instrument heritage — phosphor amber, fiducial marks, coordinate scales,
monospace readouts, a slow scan sweep — anchored by a serious editorial serif so
the page reads *researcher*, not *gamer*. Boldness is spent in exactly one place:
the phosphor accent. Everything else is quiet.

This replaces the previous look (near-black `#080909` + terracotta `#C87552`),
which is a generic AI-default palette and whose terracotta sits close to
Anthropic's own accent — a tell. Do not reintroduce it.

---

## 1. REPO INTEGRATION

- Tokens live in `app/globals.css` `:root`. Replace the current color block with
  §2.1; keep the existing `--serif/--sans/--mono` font vars (the trio in
  `app/fonts.ts` — Newsreader + IBM Plex Sans + IBM Plex Mono — stays).
- Motion tokens in §2.4 already exist in `globals.css`; keep names, confirm values.
- Component styling stays in CSS Modules (`ui/overlay.module.css`,
  `scene/field-panel.module.css`). No Tailwind, no UI kit, no CSS-in-JS.
- Google-fonts weights needed: Newsreader 300/400/500 (opsz axis), Plex Sans
  300/400/500, Plex Mono 400/500. `fonts.ts` currently loads Mono 400 only — add
  500 (used for labels).

### 1.1 Token migration map (old → new)
```
--paper        #080909  →  --ground        #0C0E0D
--paper-2      #0B0C0C  →  --ground-raised #14171A
--ink          #ECE9E1  →  --ink           #E7E4D8
--ink-soft     #A4A8A3  →  --ink-dim       #8A8F88
--muted        #7A807B  →  --ink-faint     #565B57
--line         …0.10    →  --hairline      rgba(231,228,216,0.10)
(new)                   →  --hairline-2    rgba(231,228,216,0.18)
--accent-warm  #C87552  →  --phosphor      #E4A54A   (primary accent, was terracotta — remove terracotta)
--accent-cool  #8296AA  →  --trace         #6C9C93   (secondary data only, rare)
--research     #B49A65  →  (fold into --phosphor / --ink-faint; drop as its own token)
(new)                   →  --live          #D2553C   (REC dot only)
```
Update every reference to the old names across `globals.css`, `overlay.module.css`,
`field-panel.module.css`, and `FieldGraph.tsx` (`WARM_COLOR`, `RESEARCH_COLOR`,
`EDGE_COLOR`, `NODE_COLOR`, `BASE_BACKGROUND` constants → new palette).

---

## 2. DESIGN TOKENS

### 2.1 Colour
```css
--ground:        #0C0E0D;   /* film-base charcoal, cool near-black          */
--ground-raised: #14171A;   /* raised surface (rare: kit swatch strips)      */
--ink:           #E7E4D8;   /* warm exposed-film white — primary text        */
--ink-dim:       #8A8F88;   /* secondary text                                */
--ink-faint:     #565B57;   /* ticks, coordinates, fiducials, tertiary       */
--hairline:      rgba(231,228,216,0.10);
--hairline-2:    rgba(231,228,216,0.18);
--phosphor:      #E4A54A;   /* THE accent: active state, hover, signal, rules */
--phosphor-dim:  rgba(228,165,74,0.16); /* selection, wash                    */
--trace:         #6C9C93;   /* desaturated scope cyan — secondary data, rare  */
--live:          #D2553C;   /* 6–7px REC dot only, never fills a shape        */
```
Ground is NOT pure black: keep a faint two-stop radial wash on `body`
(amber top-right ~5%, trace bottom ~3%) so it never reads as flat AI-black.

**Accent discipline:** `--phosphor` is the only saturated colour that appears in
normal browsing. `--trace` appears only on genuine secondary data (e.g. a second
series). `--live` only as the small pulsing "Reading" dot. Never fill large areas
with any accent.

### 2.2 Type roles
Three faces, three jobs (unchanged trio, re-cast):
- **Newsreader** (serif, opsz) — the *thesis* voice. Headlines and the hero name
  ONLY. Weight 400 (300 for large leads). Never bold. `font-optical-sizing:auto`.
- **IBM Plex Sans** — body / connective copy. 300–400. Quiet.
- **IBM Plex Mono** — the *structural data layer*: nav, eyebrows, section numbers,
  metadata, tags, coordinates, readouts. Uppercase, wide tracking. This is where
  the techno-retro identity lives. Plex's engineering heritage justifies it.

### 2.3 Type scale (exact)
```css
/* display / hero name — Newsreader */
font-size: clamp(2.75rem, 7vw, 5.75rem); line-height:0.96; letter-spacing:-0.02em;
/* headline / section title — Newsreader */
font-size: clamp(1.6rem, 3.2vw, 2.6rem); line-height:1.04; letter-spacing:-0.015em;
/* lead — Newsreader 300 */
font-size: clamp(1.05rem, 1.6vw, 1.35rem); line-height:1.5;
/* body — Plex Sans */
font-size: clamp(15px, 0.35vw + 14px, 17px); line-height:1.62;
/* label / readout — Plex Mono 500 */
font-size: 0.688rem; letter-spacing:0.18em; text-transform:uppercase;
/* data / coordinate — Plex Mono 400 */
font-size: 0.75rem; letter-spacing:0.02em;
```
The hero name gets its **own full-width grid row** (never shares a row with the
field zone). This fixes the old overflow where "Quốc" collided with the graph.

### 2.4 Motion tokens (confirm existing)
```css
--dur-micro: 160ms;   --dur-reveal: 520ms;   --dur-scene: 800ms;
--ease-standard: cubic-bezier(0.4,0,0.2,1);   /* hover / micro          */
--ease-emph:     cubic-bezier(0.16,1,0.3,1);  /* reveals / rule growth  */
```

### 2.5 Rhythm
```css
--gutter: clamp(20px, 4vw, 56px);   --content-max: 80rem;   --measure: 42rem;
```

---

## 3. LAYOUT & GRID

One shared 12-column grid is the single source of horizontal alignment (see
`redesign-spec.md` §2.1). Blocks align by `grid-column` only; no `margin-left:%`.

Staggered ("so-le") placement — content one side, field the other, alternating:
```
HERO        content col 1–7    | field bleeds off RIGHT edge, dissolves left
01 ABOUT    field bleeds LEFT   | content col 6–12
02 WORK     content col 1–7    | field bleeds off RIGHT edge
03 RESEARCH field bleeds LEFT   | content col 6–12
04 EXPER.   content col 1–7    | field bleeds off RIGHT edge
05 CONTACT  content only — no field, the page ends quiet
```
The rhythm comes from alternating the *side*, never from changing the field model
for one section. No full-width "field behind the list" special case.

---

## 4. THE FIELD — the signature (borderless, bleeding, offset, mask-faded)

This is the memorable element and the corrected treatment the author asked for.
**No box. No border. No different background colour. No closed frame.**

### 4.1 Rules
1. The field canvas sits on the **same `--ground`** as the page — never a
   recessed well or a different fill. There is no border around it.
2. It **bleeds off one screen edge** (right for right-aligned sections, left for
   left) and occupies `width: min(70%, 900px)` of that side, full section height.
3. It **dissolves toward the content** via a CSS mask so it is never opaque under
   text:
   ```css
   -webkit-mask-image: linear-gradient(to left, #000 46%, transparent 92%);
           mask-image: linear-gradient(to left, #000 46%, transparent 92%);
   /* mirror to `to right` for left-aligned field zones */
   ```
   The fade %s are the readability control. If text still competes, pull the
   `transparent` stop earlier (e.g. 84%); if the field feels too weak, push it later.
4. Because it bleeds and fades, the field can be **dense** (particle density high,
   0.5–0.7) without hurting legibility — the old `0.13` was compensating for the
   overlap bug that no longer exists.
5. Same field, one `SceneState` per section: signal → pixel → features → cloud →
   volume → contour → graph. (Shape targets defined in `redesign-spec.md` §Phase 4.)

### 4.2 Instrument marks — float freely, never a frame
Marks are thin, `--ink-faint`, and **do not connect into a closed rectangle** (that
was the v1 mistake the author rejected). Each is an independent overlay:
- **Fiducial** (registration cross): a 15px `+` mark, placed ONLY where the field
  meets a screen edge — e.g. top-and-bottom of the right screen edge for a
  right-bleed field. Two per field, not four-around-a-box.
- **Vertical scale**: a thin tick column hugging the outer screen edge of the
  field zone. It is a *ruler*, not a border. **Alignment rule (fixes the sketch
  bug):** anchor the scale to the **field zone's outer edge**, not to `--gutter` —
  in the reference HTML it was pinned to the gutter and drifted out of line with
  the field. Position it at the field zone's edge so tick column and field always
  agree.
- **Readout label**: mono `--data`, floating near the top of the field zone,
  e.g. `FIELD ▸ SIGNAL · N=350 · 60FPS`. Right-aligned for right fields.
- **Scan sweep**: one slow (`~6.5s`) phosphor gradient band translating down the
  field zone, clipped to the field zone bounds. Very low alpha (~0.07). Off under
  `prefers-reduced-motion`.

### 4.3 What this fixes
The old graph looked pasted in and its box edges/fills overlapped content and each
other. Borderless-bleed-plus-fade removes every hard edge, keeps the field large
and off to one side, and reframes it as an instrument reading. Nothing overlaps
text; no two frames slide over one another because there are no frames.

---

## 5. FIELD INTERACTION (particlesGL-informed)

Reference: `naughtyduk/particlesGL` — a Three.js particle renderer that turns DOM
elements / images / SVG / text into particle systems reacting to the pointer, with
**velocity-gated interaction** (the effect only responds while the cursor is
actively moving). Borrow the *patterns*, not necessarily the dependency — the repo
already has its own field machinery. Two ideas to adopt:

1. **Velocity-gated pointer response.** Field reacts to pointer *velocity*, not
   mere presence: fast movement injects a short-lived push/turbulence that damps
   out (~0.94/frame). Still cursor = still field. This reads as natural and costs
   nothing when idle. (Author already had a `pointerEnergy` scalar in
   `store.ts` — drive it from pointer velocity.)
2. **DOM/text/SVG → particle sourcing** for per-section targets: instead of
   hand-coding every 2D path, a section's target can be sampled from a small SVG
   or text glyph (e.g. `constellation` = the author's initials sampled from text).
   This generalises the existing `luminanceAt` sampler.

Optional flourish (only after the redesign-spec phases land and the M1 profile is
clean): a **cursor lens** — within a small radius of the pointer the field changes
representation (e.g. `cloud`→`volume`), turning the cursor into an inspection tool.

**Guardrails (non-negotiable):**
- M1 is the performance baseline. Any interaction must hold 60fps on M1 with the
  field paused when its section is offscreen.
- All of §5 is disabled under `prefers-reduced-motion` and when `webglFailed`.
- Do not add particlesGL as a dependency just for these; implement the patterns in
  the existing field unless a profiling reason justifies the swap.

---

## 6. COMPONENTS

All hovers use `--dur-micro` + `--ease-standard`; reveals use `--dur-reveal` +
`--ease-emph`. No `translateX` on hover anywhere — motion is a growing rule +
colour, never a slide (sliding breaks the grid's left edge).

### 6.1 Top instrument bar
Sticky, `rgba(12,14,13,0.82)` + `backdrop-filter: blur(8px)`, 1px `--hairline`
bottom. Left: brand name (mono, 0.22em) over role (mono, `--ink-faint`). Center:
nav links (mono, 0.16em, `--ink-dim`) with a phosphor underline that grows 0→100%
on hover. Right: a live readout — 7px `--live` pulsing dot + `READING` (mono,
`--ink-faint`). The dot is the instrument's "on" light; it encodes nothing false.

### 6.2 Buttons
- **Primary:** transparent, 1px `--hairline-2` border, mono label. On hover:
  border + text → `--phosphor`, and two 6px corner **fiducial ticks** fade in at
  the top-left and bottom-right corners (registration motif, not a full box).
- **Secondary:** mono label, no border, a baseline rule that is `--hairline-2`
  and grows a `--phosphor` overlay 0→100% on hover.

### 6.3 Tags
Mono, 0.10em, 1px `--hairline` border, small padding. Hover: border→`--phosphor`,
text→`--ink`. Coordinate-style, uniform height. (These are the only bordered boxes
allowed, and they are small and never overlap anything.)

### 6.4 Section header
Grid: `auto 1fr` on ≥760px. Number/eyebrow in mono phosphor (`01 / About`), title
in Newsreader 400. Sticky headers must have a **fully opaque** background and only
one visible at a time (fixes the ghosted-title stack). A short phosphor tick may
sit before the eyebrow.

### 6.5 Work / Research card (compact)
Grid `auto 1fr auto`: index (mono `--ink-faint`) · {serif title + one-line sans
desc} · meta (`FIELD / <b>STATE</b>` in phosphor, plus year/venue). Top 1px
`--hairline`. On hover: a `--phosphor` rule grows across the top edge 0→100%
(`--dur-reveal`), index → phosphor. Compact enough that ≥2 cards are visible per
screen (reduce vertical padding to ~40% of the old rows). Description is one line
by default; may expand on hover/focus.

### 6.6 Footer
1px `--hairline` top. Two mono `--ink-faint` readout lines: identity left,
palette/type signature right. Quiet.

---

## 7. MOTION LANGUAGE

- **Reveals:** clip + small `translateY` on enter, run once, no re-trigger on
  scroll-up. Driven by GSAP + ScrollTrigger (the repo's one scroll system). No CSS
  `animation-timeline` (avoid a second timing source).
- **Hairlines draw** 0→100% rather than fade.
- **Readouts may tick** (mono values step/count into place) — subtle, optional.
- **Field:** vertical drift as a section enters/leaves (never horizontal orbit) +
  idle breathing + velocity-gated pointer response (§5).
- **Reticle (optional):** near a field zone the cursor may gain a small crosshair.
- Everything above is disabled under `prefers-reduced-motion`.

---

## 8. QUALITY FLOOR

- Responsive to 390px: on narrow screens the field goes full-width behind content
  at low opacity with a top-fade mask, and the vertical scale + edge fiducials are
  hidden (they need screen-edge room). Text remains fully legible.
- Visible keyboard focus: 2px `--phosphor` outline, 3px offset.
- `prefers-reduced-motion`: no field animation, no reveals, static first frame.
- `webglFailed`: page fully readable with no canvas; marks that imply a live field
  (REC dot, readout `60FPS`) should hide or go static so nothing lies.
- Contrast: body/`--ink` on `--ground` and `--ink-dim` on `--ground` must stay
  legible; because the field fades out under text, text never sits on particles.

---

## 9. NON-GOALS

- No terracotta / warm-clay accent; no cream background; no acid-green/vermilion.
  These are the three AI-default looks — avoid all three.
- No bordered "viewport boxes", recessed wells, or any frame that encloses the
  field. The field is borderless and bleeds.
- No neon glow, no CRT skeuomorphism beyond the restrained scan sweep. Retro is
  earned through instrument vernacular, not gloss.
- No second scroll system, no new heavy dependency, no UI kit.

---

## 10. ACCEPTANCE CRITERIA

1. Palette matches §2.1 everywhere; no `#C87552`/terracotta or `#080909` remain.
2. Newsreader appears only on hero name + headlines; mono carries all labels/
   metadata/nav; sans carries body.
3. Every field is borderless, bleeds off one edge, and fades toward content; at no
   width does a field edge or fill form a visible rectangle or overlap text.
4. Field side alternates down the page (right/left/right/left); CONTACT has none.
5. Vertical scale aligns to the field zone's outer edge (not the gutter) at 1280 /
   1440 / 1920 / 2560 — no drift.
6. Hover states use growing rules + colour, never `translateX`.
7. One sticky section title visible at a time, opaque; hero name on its own row,
   never colliding with the field.
8. 60fps on M1 with offscreen field paused; reduced-motion and `webglFailed`
   fallbacks both fully legible.
