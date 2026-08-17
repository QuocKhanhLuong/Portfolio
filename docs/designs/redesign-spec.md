# Portfolio Redesign Spec — v1

> Delegation spec for the implementation agent (Codex). Self-contained.
> Repo: `QuocKhanhLuong/Portfolio`. Branch off `main`.
> Written for an agent: inspect before editing, work in phases, stop at each
> stopping condition and report before continuing.

---

## 0. GOAL

Turn the current portfolio from a *cloned F+ agency showreel* into a
*personal computer-vision research portfolio*. Three outcomes, in priority order:

1. **Fix performance.** The page is janky on scroll. The cause is the render
   pipeline, not the particle count. See Phase 0.
2. **Fix layout.** Replace the single full-bleed field-behind-everything model
   with a **staggered (alternating) layout**: content on one side, a *contained*
   graph panel illustrating that section's concept on the other, sides
   alternating down the page. This removes text overlap, the confusing
   horizontal sweep, and the "content is too dim" problem all at once.
3. **Personalize.** The morph targets are F+ brand props (logo, cup, bottle,
   medal, envelope, pen, "18"). Replace them with a CV / medical-imaging visual
   vocabulary that matches the site's own sections.

This is an agreed architectural change from "one persistent full-bleed field" to
"one contained field panel per section". Do not silently preserve the old model.

---

## 1. PROJECT CONTEXT

**Stack:** Next.js 14 (App Router, `'use client'` islands), React Three Fiber +
three.js, GSAP + ScrollTrigger, Lenis, CSS Modules. TypeScript. No Tailwind, no
UI kit — keep it that way.

**Run:** `npm install` then `npm run dev` → `localhost:3000`. Target dev machine
is a MacBook Pro M1; treat that as the performance baseline, not a desktop GPU.

**Key files (verified paths):**

```
app/
  globals.css              design tokens + .display / .headline type scale
  fonts.ts                 Newsreader (serif, opsz axis), IBM Plex Sans, mono
  layout.tsx, page.tsx
content/
  types.ts                 SceneState union + SCENE_STATES[] (10 states)
  projects.ts research.ts capabilities.ts experience.ts portfolio.ts
lib/
  perf.ts                  detectTier(), DPR_RANGE, MIN_ACTIVE_FRACTION
  narrative/
    store.ts               scrollState singleton + zustand store (tier, etc.)
    driver.ts              the ONE scroll owner: gsap ticker → Lenis → ScrollTrigger
    sceneMap.ts            measureSceneAnchors(): DOM [data-scene] → scroll anchors
    ticker.ts interpolate.ts timeline.ts
scene/
  Stage.tsx                single persistent <Canvas>; mounts FPlusGraph
  sceneFrame.ts            SceneClock, SCENE_FOV
  graph/
    FPlusGraph.tsx         (724 lines) owns field, edges, dust, postFX, camera,
                           pointer, group transform — the whole visit
    fplusTargets.ts        createFPlusField(): seed sphere, 10 shape targets, edges
    fplusShaders.ts        smoke + final-composite shaders
  morph/core.ts
ui/
  Portfolio.tsx            (632 lines) all section markup
  overlay.module.css       all layout CSS
  Chrome.tsx               site header / nav
  HeroSphere.tsx           (176 lines) — TO BE REMOVED
  Narrative.tsx lines.ts
reference/
  narrative-prototype.html reference only — do not ship, do not delete
```

**How the field currently works (so you don't fight it):**
- `Stage.tsx` mounts one `<Canvas>`, fixed, full viewport, behind the DOM.
- `FPlusGraph.tsx` runs a single `useFrame`. Each frame it: loops all 350 nodes
  in JS (sin/cos/atan2/sqrt), uploads the whole position buffer + edge buffer to
  the GPU, orbits the camera **around the Y axis** as a function of scroll
  progress (this is the horizontal sweep), then renders through
  `dustComposer` (RenderPass + AfterimagePass) **and** `mainComposer`
  (RenderPass + UnrealBloomPass + a final ShaderPass).
- `sceneMap.ts` maps DOM elements carrying `data-scene="<state>"` to scroll
  positions; the active state is chosen by scroll progress.
- Section → state wiring already exists in `Portfolio.tsx` via `data-scene`:
  hero=`signal`, about=`pixel` (inner `image`), work=`features`,
  research rows carry per-row scenes, experience=`graph`, contact=`constellation`.

---

## 2. GLOBAL DECISIONS (apply across all phases)

### 2.1 Layout grid
Introduce **one** 12-column grid as the single source of horizontal alignment.
Every section's inner wrapper (`.sectionInner`, `.heroGrid`) uses it. No block may
set `margin-left: <percent>` to fake alignment anymore — remove all such rules.

```
gutter | 1  2  3  4  5  6 | 7  8  9  10 11 12 | gutter
```

Staggered placement (the so-le model):

```
HERO        content col 1–7        field panel col 8–12   (right)
01 ABOUT    field panel col 1–5    content col 6–12       (left)
02 WORK     content col 1–7        field panel col 8–12   (right)
03 RESEARCH field panel col 1–5    content col 6–12       (left)
04 EXPER.   content col 1–7        field panel col 8–12   (right)
05 CONTACT  content only, no field  (the ending must be still)
```

Every section (except CONTACT) follows the same model: content on one side, a
contained field panel on the other. **Never run particles directly under text.**
The rhythm comes from alternating the *side* (right / left / right / left …),
not from changing the model for any one section. Do not introduce a full-width
"field behind the list" special case — it reintroduces the overlap/readability
problem this whole redesign exists to remove. CONTACT is the only section with
no field, so the page ends quiet.

### 2.2 Type scale
Current `.display` is `clamp(3rem, 12vw, 10rem)` — on a ~1900px viewport this
clamps to **10rem/160px**, and the hero name overflows its grid column into the
aside (Image 1: "Quoc" collides with the graph). Fix:

- `.display` (hero name): `clamp(2.5rem, 7vw, 6.5rem)`, and give the name its own
  full-width grid row so it never shares a row with the field panel.
- `.headline` / `.sectionTitle`: reduce max from `4.5rem` to `clamp(2rem, 4.5vw, 3.5rem)`
  (Image 2: section header too large).
- Keep Newsreader as the display serif with its `opsz` axis. **Do not** switch
  the display face.

### 2.3 Timing & easing tokens (in `app/globals.css`)
Only three durations and two easings site-wide:

```css
--dur-micro: 160ms;   /* hover, color, underline    */
--dur-reveal: 500ms;  /* block/line reveal on enter  */
--dur-scene: 800ms;   /* section field transitions   */
--ease-standard: cubic-bezier(0.4, 0, 0.2, 1);  /* hover / micro */
--ease-emphasized: cubic-bezier(0.16, 1, 0.3, 1); /* reveals      */
```
Replace ad-hoc `220ms` / `320ms` / expo-on-everything usages with these.

### 2.4 Motion rules
- Hover on rows/links: **do not** `translateX`. Replace with an underline/rule
  that grows `0 → 100%` width + a color change. Sliding breaks the grid's left edge.
- Reveal on enter: clip + small `translateY`, run **once**, no re-trigger on
  scroll-up. Drive reveals with **GSAP + ScrollTrigger** (already the site's
  scroll system) — do **not** add CSS `animation-timeline: view()`. One scroll
  choreography system only; a second timing source makes motion bugs hard to
  debug. CSS handles hover/micro transitions; GSAP handles scroll-linked reveals.
- Respect `prefers-reduced-motion` and the store's `reducedMotion`: no field
  animation, no reveals, static first frame.

### 2.5 Color
Keep the dark ground (`#080909`) — it is correct for an additive particle field.
The readability problem (Images 6, 7) is not the ground; it is text sitting on top
of a busy field with too-low contrast. The so-le model fixes it structurally
(text lives in its own column, not over the field). Additionally: raise body text
lightness one step and, where text sits near a field panel, give the text column a
subtle opaque backing so it never competes with particles.

---

## 3. CONSTRAINTS / NON-GOALS

- **No new heavy dependencies.** GSAP, Lenis, three, R3F are already present. Do
  not add a UI kit, Tailwind, or an animation library.
- **Do not rewrite the content layer.** `content/*` is the author's real data.
  You may *rename* the `SceneState` members (Phase 2) but must update every
  reference; you may not invent or delete portfolio content.
- **Do not keep the name "FPlus".** Rename `FPLUS_*`, `createFPlusField`,
  `fplusTargets`, `fplusShaders` → `FIELD_*`, `createField`, `fieldTargets`,
  `fieldShaders`. The repo must not ship another studio's brand identifiers.
- **Keep one scroll owner.** `driver.ts` is the only place that listens to
  scroll. Do not add a second scroll listener or a second rAF loop.
- **Keep SSR safe.** All `window`/`document` access stays guarded as it is now.
- Keep `reference/narrative-prototype.html` on disk, unshipped.

---

## 4. INSPECT-BEFORE-EDIT CHECKLIST (do this first, report findings)

Before writing code, read and confirm:
1. `scene/graph/FPlusGraph.tsx` — confirm the post-processing chain
   (`UnrealBloomPass`, `AfterimagePass`, `dustComposer`, `finalPass`) and the
   Y-axis camera orbit driven by `scrollState.progress`.
2. `scene/graph/fplusTargets.ts` — confirm the 10 shape targets and that `edges`
   is built with an O(n²) distance loop over 350 nodes (fine at build time,
   confirm it is not re-run per frame).
3. `lib/narrative/sceneMap.ts` — confirm state selection is DOM-anchored via
   `[data-scene]`; the new per-section panels must keep feeding it correct state.
4. `ui/overlay.module.css` — list every rule using `margin-left: <%>` or a
   per-column `grid-template-columns` that is not the shared 12-col grid; these
   are the alignment offenders.
5. `ui/Portfolio.tsx` — map each `<section>` to its `data-scene` and class names.

Report this inventory before Phase 0.

---
## 5. PHASES

> New phase order (agreed): render diet → **grid/layout first** → field panel →
> particle motion → personalize → cleanup. Grid comes **before** the field panel
> on purpose: a panel needs to know which columns it lives in (col 8–12 vs 1–5),
> and those columns are defined by the grid. Building the panel first would force
> temporary hardcoded positions that Phase-later has to redo — exactly the wasted
> loop we want to avoid. Lay the 12-col foundation, place static content, *then*
> drop the field into a column that already exists.

### PHASE 0 — Render diet (kill the lag)
**Goal:** cut per-frame GPU cost to roughly one render pass. Highest impact,
lowest risk. Do this first and measure before/after.

**Scope / non-goals:** do not touch layout or content. No visibility gating yet —
the canvas is still a single fixed full-viewport surface in this phase, so it is
never offscreen and an `IntersectionObserver` here would be a no-op. Gating moves
to Phase 2 where panels are per-section. Visual look may change slightly (less
glow) — acceptable and desired.

**Tasks:**
1. In `FPlusGraph.tsx`, remove `UnrealBloomPass`, `AfterimagePass`, the entire
   `dustComposer`, and the final composite `ShaderPass` (`finalPass`) plus the
   `FPLUS_FINAL_*` / smoke composite plumbing that only existed to feed them.
   Render with a single `RenderPass` (or plain `gl.render`) — drop
   `EffectComposer` entirely if only one pass remains.
2. If any glow is still wanted, fake it cheaply via a brighter sprite texture on
   the points material. No multi-pass bloom.
3. A/B the environment sphere and smoke plane: if, with them off, there is no
   perceptible visual loss on the dark ground, delete them.
4. Remove any expensive text-blur / backdrop effects on the overlay that show up
   in the profile (the header/title blur seen while scrolling).
5. `antialias`: with the composer removed, `antialias: true` on a single forward
   pass is fine; if any composer remains, set it `false`. Pick one, note it.

**Validation:** on the M1, scroll the full page in the Performance panel. Frame
time should drop clearly; target no dropped frames on a slow scroll. Record
before/after numbers.

**Stopping condition:** single-pass render confirmed, before/after M1 timing
reported. **Stop and report.** If the page is already smooth here, note it — it
changes whether Phase 3's shader migration is needed at all.

---

### PHASE 1 — Layout & 12-column grid (static content first)
**Goal:** implement §2.1's shared 12-col grid and the staggered placement using
**static content only** (no field panel yet — leave the panel columns empty for
now). Fix every layout/typography bug from the review images in this phase.

**Scope / non-goals:** do not touch the 3D field. This is pure DOM + CSS. The
field slots are reserved as empty grid columns that Phase 2 fills.

**Tasks (each maps to a reported bug):**
1. **12-col grid** on `.sectionInner` and `.heroGrid`; delete every
   `margin-left: <%>` alignment hack found in the inspect step. All blocks align
   by `grid-column` only.
2. **Staggered placement** per §2.1: reserve the field column (8–12 or 1–5) as an
   empty slot per section, content in the other columns. Alternate the side down
   the page; RESEARCH follows the same model (panel left, content right) — no
   special case.
3. **Hero (Image 1):** apply the `.display` clamp from §2.2; put the name on its
   own full-width row so it never shares a row with the (future) field column.
4. **Section header (Image 2):** apply the `.headline`/`.sectionTitle` clamp from
   §2.2. Make the sticky header background **fully opaque** and ensure only one
   sticky title is visible at a time (the current transparent gradient lets the
   previous section's title ghost through — the stacked titles at the top).
5. **WORK / RESEARCH cards (Images 3, 4):** compact each row so more than one is
   visible per screen. Reduce vertical padding to ~40% of current; tighten
   eyebrow + title + meta; show the description as one line by default, expand on
   hover/focus. Consider a 2-column list on wide viewports.
6. **Hover (§2.4):** replace all `translateX` row hovers with a growing rule +
   color; remove the hardcoded rectangular terracotta highlight behind hovered
   headings/items (Images 2, 8). If a cursor highlight is wanted, use a
   `radial-gradient` that follows the pointer with alpha falloff and **no hard
   edge** — otherwise remove it entirely.
7. **Contact clipping (Image 8):** remove the `overflow: hidden` fixed-width clip
   so the contact heading is never cut.
8. **Contrast (Images 6, 7):** raise body/contact text one lightness step; where a
   text column will sit beside a field, give it a subtle opaque backing.

**Validation (per image), at 1280 / 1440 / 1920 / 2560:**
- Image 1: full name readable, sits in its own row, no collision with the reserved field column.
- Image 2: one opaque section title at the top, no ghosting; header not oversized.
- Images 3, 4: at least two WORK/RESEARCH entries visible per screen.
- Images 6, 7: body/contact text passes contrast; not "sunk".
- Image 8: no terracotta rectangle on hover; heading not clipped.

**Stopping condition:** grid live, static layout correct at all four widths, all
image checks pass. **Stop and report.**

---

### PHASE 2 — Field → contained panel (fills the reserved columns)
**Goal:** replace the one full-viewport orbiting field with a reusable
`<FieldPanel state=... align="left|right" />` that renders a *contained* field
inside the grid column Phase 1 reserved for it, animated but not full-bleed,
paused when offscreen.

**Scope / non-goals:** no shape *content* change (Phase 4); no advanced particle
motion (Phase 3). Container/architecture move + rename + visibility gating only.

**Tasks:**
1. Rename all `FPlus*` identifiers/files to `Field*` (see §3). Update imports.
2. Extract the field render into `<FieldPanel>` that:
   - accepts a `state: SceneState` and an alignment, mounts into its reserved grid
     column (sized to the column, not the viewport),
   - **removes the Y-axis camera orbit** — no more horizontal sweep. Scroll-linked
     motion is a gentle **vertical** drift/parallax as the section enters and
     leaves; map `scrollState.progress` (or section-local progress) to vertical
     offset, not azimuth.
   - **pauses when offscreen** via `IntersectionObserver`.
3. **Canvas strategy — must not spawn N always-on render loops.** The spec's
   "no second rAF loop" rule applies:
   - **Recommended (A):** one small `<Canvas>` per panel, but each set to
     `frameloop="demand"` and driven only while its section is on screen (invalidate
     on the shared ticker / on scroll; stop entirely when the `IntersectionObserver`
     reports offscreen). Never five canvases all running 60fps.
   - Alternative (B): keep one persistent `<Canvas>` and position/scale the field
     over the active section's reserved column by reading its DOM rect. More
     continuity, more complexity. Default to A unless A's multiple contexts
     measurably hurt on the M1.
   Record the chosen strategy and the frameloop/invalidation approach in the PR.
4. Keep feeding `sceneMap.ts`: each panel's host section keeps its `data-scene`,
   so anchor measurement keeps working.
5. Remove `ui/HeroSphere.tsx` and its usage — the hero field panel replaces it.
   Delete the `heroSphereContainer` CSS.

**Validation:** each section shows its own contained field in the correct,
already-built column; no field pixels overlap any text; scrolling drifts panels
vertically, never horizontally; offscreen panels cost ~0 (confirm in the profile
that offscreen canvases are not rendering).

**Stopping condition:** panels contained, no overlap, vertical motion, offscreen
pause verified, rename complete, `npm run build` clean. **Stop and report** — and
report M1 timing, since it decides whether Phase 3 needs the shader migration.

---

### PHASE 3 — Particle motion (only migrate the shader if profiling demands it)
**Goal:** give the contained field richer, less-uniform motion. Do the cheap
JS-side improvements first; migrate the per-node animation to a vertex shader
**only if** Phase 0/2 profiling shows the CPU node loop is still the bottleneck.

**Tasks:**
1. Independent per-node `seed`/`phase` drift so the cloud doesn't pulse as one mass.
2. Staggered state transitions (nodes don't all morph on the same frame).
3. Curved transition paths instead of straight lerps.
4. Pointer response tuned per contained panel (local coordinates, not the old
   full-viewport unproject).
5. **Then, and only then:** if the M1 profile still shows the 350-node JS loop +
   per-frame buffer upload as the hot path, move `seed`/`phase`/`target` into
   vertex-shader attributes with a `uMorph` uniform so the CPU stops uploading a
   full position buffer each frame. If profiling is already clean, **skip this
   step** and record that it was skipped deliberately.

**Validation:** motion reads organic, not mechanical; no regression in frame time
vs. Phase 2. If the shader step was taken, confirm the CPU buffer upload is gone
from the profile.

**Stopping condition:** motion approved, timing held or improved, shader decision
recorded (done or skipped, with the profiling reason). **Stop and report.**

---

### PHASE 4 — Personalize the shapes
**Goal:** the field's morph targets tell *this author's* story (signal → pixel →
image → features → point cloud → volume → contour → uncertainty → graph →
signature), not F+'s props.

**Tasks:**
1. In `fieldTargets.ts` (renamed), rewrite `makeShapeTargets` so each `SceneState`
   maps to a CV / medical-imaging form. Keep the resampler machinery
   (`resamplePath`, `resamplePaths`, `circle`, `rectangle`, …); only the 2D path
   definitions change. Target mapping:

   | SceneState      | Old (F+) | New (author) |
   |-----------------|----------|--------------|
   | `signal`        | seed sphere | keep — initial noise / seed |
   | `pixel`         | F+ logo  | pixel grid / matrix |
   | `image`         | frame    | image frame + scanline |
   | `features`      | glasses  | feature keypoints / detection constellation |
   | `cloud`         | cup      | 3D point cloud |
   | `volume`        | bottle   | MRI slice stack / voxel block |
   | `human`         | medal    | cardiac / organ contour (author's CMIG work) |
   | `uncertainty`   | mail     | distribution / heatmap scatter |
   | `graph`         | pen      | node–edge graph (GNN) |
   | `constellation` | "18"     | author initials or "CV" |

2. Optionally rename the `SceneState` members to match (e.g. `human` → `contour`).
   If done, update `content/types.ts`, `SCENE_STATES`, every `data-scene` in
   `Portfolio.tsx`, and `sceneMap.ts`. If risky, keep the names and change only
   the shapes — the shapes are what's visible.
3. Keep node count ≤ 350; keep edge construction build-time only.
4. Author input welcome here: the exact form of `human`/`contour` and
   `constellation` (initials vs "CV") is a personal-story call — flag these two
   for the author rather than inventing silently.

**Validation:** scrolling walks a coherent CV narrative; nothing references a cup,
bottle, medal, envelope, or "18".

**Stopping condition:** shapes personalized, no F+ props remain. **Stop and report.**

---

### PHASE 5 — Cleanup + QA
**Goal:** remove dead code and confirm the whole thing on the target machine.

**Tasks:**
1. Delete now-dead narrative code left from the old full-bleed model
   (`timeline.ts` / `interpolate.ts` members that no longer feed anything) — only
   after confirming they are truly unreferenced.
2. **Nav font (Image 1):** the nav is `var(--mono)` at `0.62–0.68rem` — too small
   and too terminal for the editorial voice. Either bump mono to `0.8rem` /
   `letter-spacing: 0.16em`, or switch the nav to IBM Plex Sans (already loaded)
   at `~0.85rem` weight 500. Recommended: the sans option. Do not touch the
   display serif.
3. Responsive pass at 390 / 768 / 1280 / 1440 / 1920 / 2560. The fraction of the
   viewport each field panel occupies must be stable across widths (if it shrinks
   toward center as the screen widens, the camera/scale is still viewport-bound —
   fix it).
4. `prefers-reduced-motion: reduce` and the store's `reducedMotion`: no field
   animation, no reveals, static readable page.
5. WebGL-failure fallback (`webglFailed`): page fully readable with no canvas.
6. Final M1 frame-timing on a full scroll vs. the Phase-0 baseline.

**Stopping condition:** all widths clean, reduced-motion clean, fallback clean,
no dead references, `npm run build` clean, timing reported. **Done.**

---
## 6. REPORTING REQUIREMENTS

At each stopping condition, report:
- changed files (list),
- what was removed vs. added,
- `npm run build` / typecheck result,
- for Phase 0, Phase 2, and Phase 5: M1 frame timing (Phase 0 sets the baseline;
  Phase 2 and Phase 5 compare to it — these decide whether Phase 3's shader
  migration is needed),
- for Phase 1: the per-image validation results,
- anything that diverged from this spec and why (open questions, not silent changes).

## 7. SAFETY RULES

- Work on a branch; never force-push `main`.
- One phase per PR (or per commit group), in order. Do not batch phases.
- Inspect before editing; if a file's real content contradicts this spec, stop
  and report the discrepancy rather than guessing.
- Do not delete content data. Do not add dependencies without flagging.
- Keep every `window`/`document` access SSR-guarded.
