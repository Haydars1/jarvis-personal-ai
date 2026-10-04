# Cloudflare Frontend Runtime Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Floot-dependent 6006 frontend/runtime with a standalone React + TypeScript + Vite application that preserves the public 6006 experience, three-language support, fault library, vehicle selector, and vehicle-specific schematics.

**Architecture:** Keep `6006-performance` as the development source of truth and leave JARVIS `main` untouched. Migrate existing static 6006 logic from `fault-data.js` and `js/*.mjs` into typed `src/` modules, then rebuild the public UI as a React SPA that can be deployed by Cloudflare Pages without any `@floot/*` runtime dependency.

**Tech Stack:** React, TypeScript, Vite, React Router, Vitest, Testing Library, Cloudflare Pages-compatible SPA output.

**Spec:** `docs/superpowers/specs/2026-10-04-cloudflare-migration-design.md`

## Global Constraints

- Work only on `6006-performance`; never merge 6006 work into JARVIS `main`.
- No Floot packages, Floot runtime helpers, Floot auth, Floot push, or Floot endpoint assumptions may remain in the new app.
- Preserve DE / TR / EN behavior and German fallback for missing localization.
- Vehicle resolution order remains exact vehicle → platform → engine → generic/system fallback.
- Do not invent vehicle-specific component positions when they are not verified.
- Production deployment is out of scope for this plan.
- Pin dependencies and commit the lockfile.

## Review Focus

- Direct navigation to `/fehlercodes/P0299` must render in a Cloudflare Pages SPA instead of 404ing.
- Corrupt or unknown `6006_language` and `6006_vehicle` localStorage values must fall back safely.
- Unknown DTCs must not fabricate localized technical content or exact part positions.
- Mobile layouts around 393 px width must not overflow horizontally.
- A Passat B8 CRLB + AdBlue/SCR request must explicitly fall back to generic SCR visualization instead of pretending the car has a verified factory SCR layout.

---

### Task 1: Establish standalone React/Vite build and test harness

**Files:**
- Modify: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/test/setup.ts`
- Create: `src/App.test.tsx`
- Modify: `index.html`

**Interfaces:**
- Consumes: current repository assets/data only.
- Produces: `npm run dev`, `npm run test`, `npm run typecheck`, and `npm run build`; `App` with `/` and `/fehlercodes/:code` routes.

- [ ] **Step 1: Write the failing smoke tests**
  - `src/App.test.tsx` asserts `/` renders `6006 PERFORMANCE`.
  - It asserts `/fehlercodes/P0299` resolves through the SPA router.

- [ ] **Step 2: Run the tests and verify RED**
  - Run: `npm test -- --run src/App.test.tsx`
  - Expected: fail because the React/Vite app does not yet exist.

- [ ] **Step 3: Add the minimal React/Vite/TypeScript scaffold**
  - Define `App(): JSX.Element` with React Router routes for `/` and `/fehlercodes/:code`.
  - Add exact scripts: `dev`, `test`, `typecheck`, `build`.
  - Pin all added package versions and commit the generated lockfile.

- [ ] **Step 4: Verify build harness**
  - Run: `npm test -- --run src/App.test.tsx && npm run typecheck && npm run build`
  - Expected: all commands succeed and `dist/index.html` exists.

- [ ] **Step 5: Commit**
  - Commit message: `build(6006): establish standalone react vite app`

### Task 2: Port language and fault domain modules to TypeScript

**Files:**
- Source references: `fault-data.js`, `js/i18n.mjs`, `js/fault-localization.mjs`, `js/fault-visual.mjs`
- Create: `src/domain/faults.ts`
- Create: `src/domain/fault-visual.ts`
- Create: `src/i18n/translations.ts`
- Create: `src/i18n/language.ts`
- Create: `src/domain/faults.test.ts`
- Create: `src/i18n/language.test.ts`

**Interfaces:**
- Produces: `type Language = "de" | "tr" | "en"`; `normalizeLanguage(value): Language`; `t(lang,key,params?): string`; `faultByCode(code): FaultEntry | undefined`; `localizeFault(fault,lang): FaultEntry`; `getFaultVisual(code): FaultVisual`.

- [ ] **Step 1: Write failing tests for known, unknown, and corrupt inputs**
  - `normalizeLanguage("tr-TR") === "tr"`, unknown values → `"de"`.
  - `P0299` has localized TR/EN title/meaning.
  - Unknown fault localization returns the German source instead of invented copy.
  - `OIL`, `ABS`, `DPF`, `ADBLUE`, `P20EE`, `P2453`, `P0299` resolve to the expected visual families.

- [ ] **Step 2: Verify RED**
  - Run: `npm test -- --run src/domain/faults.test.ts src/i18n/language.test.ts`

- [ ] **Step 3: Port the existing data/translation behavior into typed modules**
  - Preserve current supported fault list and existing special-case warnings.
  - Keep fault code identifiers untranslated.

- [ ] **Step 4: Verify GREEN and type safety**
  - Run: `npm test -- --run src/domain/faults.test.ts src/i18n/language.test.ts && npm run typecheck`

- [ ] **Step 5: Commit**
  - Commit message: `refactor(6006): port fault and language domain to typescript`

### Task 3: Port vehicle catalog, persistence, and schematic resolution

**Files:**
- Source references: `js/vehicle-profiles.mjs`, `js/vehicle-schematic.mjs`, `js/vehicle-selection.mjs`, `js/vehicle-selector-ui.mjs`
- Create: `src/vehicle/catalog.ts`
- Create: `src/vehicle/profile.ts`
- Create: `src/vehicle/persistence.ts`
- Create: `src/vehicle/profile.test.ts`
- Create: `src/vehicle/persistence.test.ts`

**Interfaces:**
- Produces: `VehicleContext`; `getVehicleOptions(context)`; `resolveVehicleProfile(context): ResolvedVehicleProfile`; `loadVehicle(storage): VehicleContext`; `saveVehicle(storage,vehicle): void`.

- [ ] **Step 1: Write failing profile/persistence tests**
  - Exact profiles: Passat B8 CRLB, BMW G20/G21 B47, Focus MK4 2.0 EcoBlue, W213/S213 OM654.
  - Platform/engine/generic fallbacks.
  - Corrupt localStorage returns an empty safe context.
  - Passat B8 CRLB reports no verified factory SCR layout for AdBlue visualization.

- [ ] **Step 2: Verify RED**
  - Run: `npm test -- --run src/vehicle/*.test.ts`

- [ ] **Step 3: Port current resolver behavior and cascading catalog**
  - Keep the selection order Brand → Model → Body/Series → Year → Engine.
  - Preserve manual fallback for unsupported vehicles.

- [ ] **Step 4: Verify GREEN**
  - Run: `npm test -- --run src/vehicle/*.test.ts && npm run typecheck`

- [ ] **Step 5: Commit**
  - Commit message: `feat(6006): port vehicle profile resolver`

### Task 4: Rebuild the public home page and fault library

**Files:**
- Create: `src/pages/HomePage.tsx`
- Create: `src/pages/HomePage.css`
- Create: `src/components/LanguageSwitch.tsx`
- Create: `src/components/FaultField.tsx`
- Create: `src/components/FaultLibrary.tsx`
- Create: `src/components/VehicleSelector.tsx`
- Create: `src/pages/HomePage.test.tsx`

**Interfaces:**
- Consumes: i18n/fault/vehicle modules from Tasks 2–3.
- Produces: public `/` experience with language switch, animated warning-symbol field, searchable/filterable fault library, and cascading vehicle selector.

- [ ] **Step 1: Write failing UI tests**
  - DE/TR/EN switch changes visible navigation/service/fault text.
  - Fault search finds `P0299`.
  - Vehicle selector cascades supported model/body/engine choices.
  - Invalid stored language/vehicle state does not crash render.

- [ ] **Step 2: Verify RED**
  - Run: `npm test -- --run src/pages/HomePage.test.tsx`

- [ ] **Step 3: Implement the premium public page**
  - Preserve the approved charcoal/ivory/sage/emerald/forest/antique-gold palette and existing premium editorial motion direction.
  - Keep warning icons clickable and route each item to `/fehlercodes/:code`.

- [ ] **Step 4: Verify GREEN, typecheck, and build**
  - Run: `npm test -- --run src/pages/HomePage.test.tsx && npm run typecheck && npm run build`

- [ ] **Step 5: Commit**
  - Commit message: `feat(6006): rebuild public homepage without floot`

### Task 5: Rebuild fault detail and vehicle-specific system animation

**Files:**
- Create: `src/pages/FaultPage.tsx`
- Create: `src/pages/FaultPage.css`
- Create: `src/components/FaultSystemAnimation.tsx`
- Create: `src/components/FaultSystemAnimation.css`
- Create: `src/pages/FaultPage.test.tsx`
- Create: `src/components/FaultSystemAnimation.test.tsx`

**Interfaces:**
- Consumes: `faultByCode`, `localizeFault`, `getFaultVisual`, `resolveVehicleProfile`.
- Produces: vehicle-aware animated fault detail page with `data-scene`, `data-focus`, `data-vehicle-profile`, and `data-vehicle-confidence` markers for testing/debugging.

- [ ] **Step 1: Write failing detail/animation tests**
  - P0299 uses boost scene.
  - P2453 uses DPF pressure scene.
  - ABS uses brakes scene.
  - Exact supported vehicle shows its profile label.
  - Unsupported vehicle shows generic note.
  - Passat B8 CRLB + ADBLUE shows generic SCR warning instead of a claimed exact layout.

- [ ] **Step 2: Verify RED**
  - Run: `npm test -- --run src/pages/FaultPage.test.tsx src/components/FaultSystemAnimation.test.tsx`

- [ ] **Step 3: Implement the system animation and safety copy**
  - Maintain clickable component labels and animated flow paths.
  - Never imply the highlighted part is proven defective.

- [ ] **Step 4: Verify GREEN**
  - Run: `npm test -- --run src/pages/FaultPage.test.tsx src/components/FaultSystemAnimation.test.tsx && npm run typecheck`

- [ ] **Step 5: Commit**
  - Commit message: `feat(6006): add vehicle aware fault schematics`

### Task 6: Add backend-neutral customer chat shell

**Files:**
- Create: `src/chat/types.ts`
- Create: `src/chat/api.ts`
- Create: `src/components/SupportChat.tsx`
- Create: `src/components/SupportChat.css`
- Create: `src/components/SupportChat.test.tsx`

**Interfaces:**
- Produces: `ChatApi` interface with `startConversation`, `sendMessage`, `getConversation`; `createChatApi({ baseUrl }): ChatApi` where `baseUrl` is supplied by environment/config and may point to a separate Worker host.

- [ ] **Step 1: Write failing chat-shell tests**
  - Selected language and vehicle/fault context are included in start/send payloads.
  - Configured `baseUrl` prefixes chat requests correctly.
  - UI renders API replies.
  - API failure shows a recoverable status instead of losing typed text.

- [ ] **Step 2: Verify RED**
  - Run: `npm test -- --run src/components/SupportChat.test.tsx`

- [ ] **Step 3: Implement the backend-neutral shell**
  - No Floot SDK/imports.
  - No AI key or secret in client code.
  - Read only a public API base URL from Vite environment/config; secrets never use `VITE_` variables.

- [ ] **Step 4: Verify GREEN**
  - Run: `npm test -- --run src/components/SupportChat.test.tsx && npm run typecheck`

- [ ] **Step 5: Commit**
  - Commit message: `feat(6006): add backend neutral support chat shell`

### Task 7: Cloudflare Pages SPA readiness and complete frontend verification

**Files:**
- Create: `public/_headers`
- Modify only if required: `vite.config.ts`
- Modify: `.github/workflows/6006-tests.yml`

**Interfaces:**
- Produces: `dist/` suitable for Cloudflare Pages and CI that runs tests, typecheck, and build on `6006-performance`.

- [ ] **Step 1: Add CI assertions for the production bundle**
  - Build must produce `dist/index.html`.
  - Built output must contain no `@floot/` or `floot.app` runtime reference.

- [ ] **Step 2: Run CI commands locally and confirm any current failure**
  - Run: `npm test -- --run && npm run typecheck && npm run build`

- [ ] **Step 3: Add Pages-compatible headers and SPA assumptions**
  - Do not add a top-level `404.html`; Cloudflare Pages then serves the React SPA for deep routes.
  - Add safe baseline headers in `public/_headers` without breaking required fonts/assets.

- [ ] **Step 4: Full verification**
  - Run: `npm test -- --run && npm run typecheck && npm run build`
  - Expected: all tests pass; no Floot runtime references in `dist`.

- [ ] **Step 5: Commit**
  - Commit message: `ci(6006): make standalone frontend cloudflare ready`
