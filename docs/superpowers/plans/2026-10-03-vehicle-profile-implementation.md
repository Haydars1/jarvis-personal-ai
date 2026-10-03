# Vehicle Profile System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add persistent vehicle selection and vehicle-specific animated fault diagrams using platform + engine + model override profiles.

**Architecture:** Keep fault semantics (`getFaultVisual`) independent from vehicle geometry. Resolve a selected vehicle into a `ResolvedVehicleDiagram` by merging platform defaults, engine-family placements and vehicle overrides, then feed that geometry into a reusable vehicle schematic renderer.

**Tech Stack:** React, TypeScript, React Router, CSS Modules, SVG, localStorage, Jasmine + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-03-vehicle-profile-design.md`

## Global Constraints
- Public UI is German-only.
- Never claim exact placement when only platform/generic data exists.
- Existing fault library and routes must continue to work.
- Mobile must not overflow horizontally.
- Prefer compact static profile data and SVG; no video/GIF.

## Review Focus
- Unsupported engine/year falls back safely and labels accuracy.
- Stored selection survives malformed/outdated localStorage values.
- Switching vehicle updates geometry without changing fault semantics.
- Focus IDs missing from a vehicle profile still render via generic scene positions.
- Mobile controls remain usable with long model/engine names.

---

### Task 1: Vehicle profile types, resolver and seed dataset
**Files:** Create `helpers/vehicleProfiles.ts`, `helpers/vehicleProfiles.spec.tsx`.
**Produces:** `VehicleSelection`, `VehicleProfile`, `ResolvedVehicleProfile`, `vehicleProfiles`, `getVehicleOptions(selection)`, `resolveVehicleProfile(selection)`.
- [ ] Write failing tests for BMW G20, VW Passat B8, Ford Focus MK4, Mercedes W213 and unsupported fallback.
- [ ] Implement platform/engine/override merge.
- [ ] Add initial multi-brand dataset from the approved clusters.
- [ ] Run resolver specs and verify pass.

### Task 2: Persistent vehicle selection UI
**Files:** Create `components/VehicleSelector.tsx`, `components/VehicleSelector.module.css`, `helpers/useVehicleSelection.tsx`, tests.
**Consumes:** Task 1 types/options.
**Produces:** `VehicleSelector` and `useVehicleSelection()` returning selection + resolved profile + setters/reset.
- [ ] Test cascading Marke → Modell → Baureihe → Jahr → Motor options.
- [ ] Test persistence and invalid stored value recovery.
- [ ] Implement compact premium selector and “Allgemeine Darstellung”.
- [ ] Verify desktop/mobile render.

### Task 3: Reusable cutaway vehicle schematic
**Files:** Create `components/VehicleSystemSchematic.tsx`, CSS, tests.
**Consumes:** `ResolvedVehicleProfile`, `SystemSceneId`, fault focus.
**Produces:** SVG car shell + per-system nodes/paths.
- [ ] Test that brand/profile variants produce different body/placement data.
- [ ] Test labels for AdBlue tank/SCR, turbo/Ladeluft, DPF sensor, ABS module/wheels.
- [ ] Implement neutral technical vehicle shell and animated flow paths.
- [ ] Add reduced-motion behavior.

### Task 4: Integrate vehicle geometry into fault detail pages
**Files:** Modify `components/FaultSystemAnimation.tsx`, CSS, `pages/fehlercodes.$code.tsx`; update existing animation specs.
**Consumes:** Tasks 1-3.
- [ ] Add selector above system animation.
- [ ] Feed resolved profile to `FaultSystemAnimation`.
- [ ] Replace abstract primary stage with vehicle schematic for supported profiles while preserving component info/buttons.
- [ ] Keep clearly labeled general fallback.
- [ ] Run full test suite.

### Task 5: Regression and production verification
- [ ] Verify P0299 on VW/BMW/Ford yields different placements.
- [ ] Verify ADBLUE/P20EE, P2453, ABS, OIL, COOLANT, BATTERY.
- [ ] Verify mobile width and keyboard accessibility.
- [ ] Publish only after all tests pass and external routes return 200.
