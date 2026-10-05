# 6006 Fault Visual System v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a premium, brand-neutral fault visualization to mapped 6006 fault pages: generic vehicle location highlight plus a simple 4–6 node system flow.

**Architecture:** Keep fault-scene knowledge in pure domain modules and render it with three focused React components. `FaultPage` asks a resolver for a scene; mapped faults render the visual card between metadata and the existing detail sections, while unknown/unmapped faults render no invented diagram.

**Tech Stack:** React 19, TypeScript 7, Vite 8, Vitest 5, Testing Library, SVG/CSS animations.

**Spec:** `docs/superpowers/specs/2026-10-05-6006-fault-visual-system-design.md`

## Global Constraints

- Vehicle silhouette must be brand-neutral and receive no brand/model props.
- Initial scene IDs: `boost`, `dpf`, `scr`, `brakes`, `oil`, `cooling`.
- Flow contains only 4–6 relevant nodes.
- One dominant highlight at a time; graphite/ivory/bronze visual language, restrained red only for critical emphasis.
- No blue-heavy neon, dense HUD, vehicle selector, live telemetry, ECU tuning catalogue, or Stage 1/2 data in this phase.
- All visible copy supports `de`, `tr`, `en` through the existing language model.
- Unknown/unmapped faults return no scene and therefore no visual card.
- Respect `prefers-reduced-motion` and keep mobile labels readable.

## Review Focus

- Unmapped fault records must omit the visual instead of guessing a scene — covered in Task 1 resolver tests and Task 4 page test.
- System-text matching must be case-insensitive and tolerate localized/variant wording — covered in Task 1 resolver tests.
- Every scene must stay within 4–6 nodes — covered in Task 1 scene-data test.
- Generic vehicle component must expose only generic region props and no brand/model API — covered in Task 2 component test.
- Reduced-motion/mobile behavior must preserve meaning without depending on animation — covered in Task 3 DOM/CSS assertions plus final build review.

---

### Task 1: Scene data and resolver

**Files:**
- Create: `src/domain/fault-scenes.ts`
- Create: `src/domain/fault-scene-resolver.ts`
- Create: `src/domain/fault-scenes.test.ts`

**Interfaces:**
- Produces `FaultSceneId`, `FaultScene`, `FAULT_SCENES`, and `resolveFaultScene(fault: FaultEntry): FaultScene | undefined`.
- `FaultScene` exposes localized title/caption, `region`, `tone`, 4–6 localized nodes, and ordered node IDs for flow rendering.

- [ ] **Step 1: Write failing domain tests**
  - `P0299` resolves to `boost`.
  - current `DPF` / `P2002` style records resolve to `dpf`.
  - synthetic records with `SCR`, `AdBlue`, `NOx` wording resolve to `scr`.
  - `ABS`/brake, `OIL`/Schmierung and cooling wording resolve to their scenes.
  - unknown generic record resolves `undefined`.
  - each scene contains 4–6 nodes and all flow IDs exist in `nodes`.
  - matching is case-insensitive.

- [ ] **Step 2: Run `npm run test:ui -- src/domain/fault-scenes.test.ts` and verify FAIL because the modules do not exist.**

- [ ] **Step 3: Implement scene types/data and conservative resolver.**
  - Prefer exact code aliases first (`P0299`, `DPF`, `P2002`, `P2453`, `ABS`, `OIL`).
  - Fall back to normalized `code + system + title` keyword matching only for clearly identifying terms (`DPF`, `Partikelfilter`; `SCR`, `AdBlue`, `NOx`; `ABS`, `Brem`; `Öldruck`, `Schmierung`, `oil`; `Kühl`, `coolant`, `radiator`; `Ladedruck`, `Turbo`, `boost`).
  - Return `undefined` when no family is confidently identified.

- [ ] **Step 4: Run the focused domain test and verify PASS.**

- [ ] **Step 5: Commit `feat(6006): add conservative fault scene resolver`.**

### Task 2: Generic vehicle silhouette

**Files:**
- Create: `src/components/GenericVehicleSilhouette.tsx`
- Create: `src/components/GenericVehicleSilhouette.css`
- Create: `src/components/GenericVehicleSilhouette.test.tsx`

**Interfaces:**
- Consumes `FaultScene['region']` and `FaultScene['tone']`.
- Produces `<GenericVehicleSilhouette region tone />` with `data-generic-vehicle="true"` and one active generic region marker.

- [ ] **Step 1: Write failing component tests**
  - renders `data-generic-vehicle="true"`.
  - marks exactly one active region for `front-engine` and for `wheels`.
  - public props contain no `brand`, `model`, `body`, `year`, or engine identity.
  - SVG has no badge/model text and stays decorative (`aria-hidden`).

- [ ] **Step 2: Run focused test and verify FAIL.**

- [ ] **Step 3: Implement one neutral side-profile technical SVG with generic highlight overlays for `front-engine`, `center-underbody`, `rear-underbody`, `wheels`, `engine-lower`, `cooling-front`.**

- [ ] **Step 4: Add restrained amber/red pulse styling and a no-animation reduced-motion rule.**

- [ ] **Step 5: Run focused test and verify PASS.**

- [ ] **Step 6: Commit `feat(6006): add brand-neutral vehicle silhouette`.**

### Task 3: System flow and visual card

**Files:**
- Create: `src/components/FaultFlowDiagram.tsx`
- Create: `src/components/FaultFlowDiagram.css`
- Create: `src/components/FaultVisualCard.tsx`
- Create: `src/components/FaultVisualCard.css`
- Create: `src/components/FaultVisualCard.test.tsx`

**Interfaces:**
- Consumes `FaultScene` and `Language`.
- Produces `<FaultFlowDiagram scene language />` and `<FaultVisualCard scene language />`.
- Card root exposes `data-fault-visual="true"`; node buttons/items expose `data-flow-node` and only one default focus node.

- [ ] **Step 1: Write failing component tests**
  - card renders generic vehicle and 4–6 flow nodes.
  - labels switch correctly for `de`, `tr`, `en`.
  - exactly one node is initially focused.
  - visible caption says the vehicle image is schematic/model-neutral.
  - no combobox/vehicle selector is introduced.

- [ ] **Step 2: Run focused test and verify FAIL.**

- [ ] **Step 3: Implement flow as a simple ordered path with subtle animated connector and optional node selection for concise descriptions.**

- [ ] **Step 4: Compose silhouette + flow in the visual card using the existing graphite/ivory/bronze palette and restrained red critical variant.**

- [ ] **Step 5: Add responsive rules: readable horizontal/stacked flow on phones and reduced-motion fallback.**

- [ ] **Step 6: Run focused test and verify PASS.**

- [ ] **Step 7: Commit `feat(6006): add focused fault visual card`.**

### Task 4: FaultPage integration

**Files:**
- Modify: `src/pages/FaultPage.tsx`
- Modify: `src/pages/FaultPage.css`
- Modify: `src/pages/FaultPage.test.tsx`

**Interfaces:**
- Consumes `resolveFaultScene(fault)` and `FaultVisualCard`.
- Keeps all existing public fault content and support chat behavior unchanged.

- [ ] **Step 1: Extend `FaultPage` tests**
  - `/fehlercodes/P0299` renders `[data-fault-visual="true"]` and generic vehicle.
  - `/fehlercodes/OIL` renders the oil visual family.
  - unknown code renders no fault visual.
  - no public vehicle selector exists.
  - existing browser-language/localization assertions remain green.

- [ ] **Step 2: Run `npm run test:ui -- src/pages/FaultPage.test.tsx` and verify FAIL on the new visual assertions.**

- [ ] **Step 3: Integrate the resolver/card after metadata and before meaning/detail sections. Omit the card when resolver returns `undefined`.**

- [ ] **Step 4: Adjust page spacing only as needed so the visual reads as one premium workspace rather than a stack of unrelated cards.**

- [ ] **Step 5: Run FaultPage tests and verify PASS.**

- [ ] **Step 6: Commit `feat(6006): integrate fault visuals into fault pages`.**

### Task 5: Full verification and PR

**Files:**
- Modify only if verification exposes defects in files from Tasks 1–4.

**Interfaces:**
- Produces a green feature branch ready for review against `6006-performance`.

- [ ] **Step 1: Run `npm test`. Expected: all legacy and UI tests pass.**

- [ ] **Step 2: Run `npm run typecheck`. Expected: zero TypeScript errors.**

- [ ] **Step 3: Run `npm run build`. Expected: Vite production build succeeds.**

- [ ] **Step 4: Verify Worker tests/typecheck remain green with `npm --prefix worker test` and `npm --prefix worker run typecheck`.**

- [ ] **Step 5: Review branch diff for accidental model-specific assets/copy, blue-neon styling, vehicle selector regression, or unrelated backend changes.**

- [ ] **Step 6: Open PR from `feat/6006-fault-visual-v3` to `6006-performance`; do not merge until CI is green and review is complete.**
