# JARVIS Free Integration Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:executing-plans` (or subagent-driven development where available) and implement task-by-task with TDD.

**Goal:** Extend the existing JARVIS Integration Hub so only verified free/free-plan integrations can be selected automatically, existing capabilities are reused instead of duplicated, and the iPhone/web UI truthfully shows what is active, connection-required, external, reference-only, excluded, or unavailable.

**Architecture:** Reuse `src/application/integrations/hub.js`, the repository/cloud/native execution stack, and `public/integrations-ui.js`. Add one canonical free-integration registry and one free-only router. ChatGPT-only connectors remain external surfaces unless JARVIS independently has a real adapter/auth path.

**Tech stack:** Cloudflare Workers, JavaScript ES modules, Node `node:test`, existing D1/KV credential state, SwiftUI iOS client.

**Spec:** `docs/superpowers/specs/2026-10-03-free-integration-hub-design.md`

## Global Constraints
- Install/integrate free and free-plan tools only.
- Never auto-install/route screenshot-labelled paid tools: **ScreensDesign MCP, Higgsfield MCP, Plaud, ManyChat, Sandcastles MCP**.
- Unknown pricing is non-routable until verified free/free-plan.
- Do not spend money, start subscriptions, change billing, or add paid API usage.
- Do not claim an integration is active unless a working adapter/connector proves it.
- Existing installed integrations and repository seeds must be reused, not duplicated.
- No production deploy, `main` merge, billing, subscription, or secret changes during implementation without separate explicit approval.
- External account/OAuth connections remain user-controlled.

## Branch Safety
`main` and `feature/learning-engine` are heavily diverged (current comparison: learning branch hundreds of commits ahead and also substantially behind main). Do **not** merge/rebase them casually for this feature.

Use two implementation lines:
1. **Backend/Web:** create `feature/free-integration-hub` from latest `main`.
2. **iOS:** create `feature/free-integration-hub-ios` from latest `feature/learning-engine` after the API contract is green.

Review them separately. Backend production deployment and merging remain outside this plan until separately approved. iOS can compile against the contract before production deploy, but the new live catalog will not be claimed active until the Worker endpoint is deployed later.

---

## Task 1 — Canonical Free Integration Registry + Eligibility Policy

**Backend branch:** `feature/free-integration-hub`

**Create:** `src/lib/free-integration-registry.js`  
**Create:** `tests/free-integration-registry.test.js`  
**Modify:** `package.json` to add new module(s) to explicit syntax checks if needed.

### 1.1 RED tests
Require records with: `id`, `name`, `team`, `surface`, `sourceType`, `capabilities`, `pricing`, `authState`, `runtimeState`, `adapterId`, `route`, `provenance`, `notes`.

Assert:
- `free + ready` and `free-plan + ready` can be auto-executable.
- `unknown`, `paid`, `connection-required`, `reference-only`, `excluded` cannot be auto-executable.
- ScreensDesign, Higgsfield, Plaud, ManyChat, and Sandcastles normalize to `paid/excluded`.
- Unknown pricing never silently becomes free.
- Team summary counts Build / Design / Growth / Operations / Scale correctly.

Run:
```bash
node --test tests/free-integration-registry.test.js
```
Expected: FAIL because registry module does not exist.

### 1.2 Minimal implementation
Export at least:
- `FREE_INTEGRATION_TEAMS`
- `FREE_INTEGRATION_SEEDS`
- `normalizeIntegration()`
- `isAutoExecutableIntegration()`
- `integrationSummary()`

Seed only evidence-backed states. Do not turn screenshot presence into runtime capability.

### 1.3 GREEN
```bash
node --test tests/free-integration-registry.test.js
npm run check:syntax
```
Expected: PASS.

### 1.4 Commit
```bash
git add src/lib/free-integration-registry.js tests/free-integration-registry.test.js package.json
git commit -m "feat: add free integration eligibility policy"
```

---

## Task 2 — Normalize Existing JARVIS + External Connector States

**Modify:** `src/lib/repository-integrations.js`  
**Modify:** `src/lib/free-integration-registry.js`  
**Create:** `tests/free-integration-state.test.js`

### 2.1 RED tests
Cover:
- Existing `microsoft/playwright-mcp`, `remotion-dev/remotion`, `apify/crawlee`, `artemnovitckii/notebooklm-coach` are referenced through existing repository metadata, not duplicated.
- `notebooklm-coach` stays reference/provenance-only; JARVIS executes its clean-room YouTube adapter.
- A free integration that lacks OAuth/API setup is `connection-required`, not `ready`.
- Figma/Canva/Consensus installed in ChatGPT are represented as `surface='chatgpt'` / external-handoff unless JARVIS has its own adapter.
- HeyGen remains outside free auto-routing while free eligibility is unverified.
- Existing JARVIS Google Drive / YouTube paths retain their actual connection states.

Run:
```bash
node --test tests/free-integration-state.test.js
```
Expected: FAIL.

### 2.2 Implementation
Add `buildFreeIntegrationCatalog({ repositoryIntegrations, providerState })` and join by canonical repo/provider ID.

Rules:
- Existing runtime status/adapter route is authoritative.
- `source-only`, `reference`, `configuration-required`, `hardware-required` remain non-ready.
- ChatGPT connector state never automatically becomes Worker executable state.

### 2.3 GREEN
```bash
node --test tests/free-integration-state.test.js tests/pdf-integrations.test.js tests/open-source-capabilities.test.js
```
Expected: PASS.

### 2.4 Commit
```bash
git add src/lib/free-integration-registry.js src/lib/repository-integrations.js tests/free-integration-state.test.js
git commit -m "feat: normalize free integration states"
```

---

## Task 3 — Free-Only Router + Fallback Trace

**Create:** `src/application/integrations/free-router.js`  
**Create:** `tests/free-integration-router.test.js`  
**Modify:** `src/application/capabilities/runtime.js`  
**Modify:** `package.json` syntax-check list as needed.

### 3.1 RED tests
Assert:
1. Paid and unknown-pricing integrations are never selected.
2. `connection-required`, `reference-only`, and `excluded` are visible but not executable.
3. A ready free adapter wins before degraded fallbacks.
4. When first adapter fails, next verified free fallback is selected.
5. Trace explains every skip/failure.
6. Team/capability matching is deterministic.
7. ChatGPT-only connectors are never returned as Worker-executable without an explicit JARVIS adapter.

Run:
```bash
node --test tests/free-integration-router.test.js
```
Expected: FAIL.

### 3.2 Implementation
Export a pure selector, e.g. `selectFreeIntegration(task, records, failedIds=[])` returning `{selected, fallbacks, skipped}`. Keep selection logic testable without network calls.

Hook into capability runtime only at the integration handoff boundary; do not replace the existing AI-provider router or hijack ordinary chat.

### 3.3 GREEN + regressions
```bash
node --test tests/free-integration-router.test.js tests/cloud-capability-execution.test.js tests/orchestration.test.js tests/reliability-runtime.test.js
```
Expected: PASS.

### 3.4 Commit
```bash
git add src/application/integrations/free-router.js src/application/capabilities/runtime.js tests/free-integration-router.test.js package.json
git commit -m "feat: route only verified free integrations"
```

---

## Task 4 — Extend Existing Integration Hub API

**Modify:** `src/application/integrations/hub.js`  
**Create:** `tests/free-integration-hub-api.test.js`

### 4.1 RED API tests
Require authenticated `GET /api/integrations/catalog?team=<optional>&state=<optional>` returning:
- `integrations[]`
- `summary`
- `filters`

Keep current `/api/integrations/status` Google/YouTube/Meta/Facebook/Instagram keys unchanged and add a `freeHub` summary additively.

Assert paid/excluded records may be displayed for transparency but always have `autoExecutable:false`. No secret/raw token may be returned.

Run:
```bash
node --test tests/free-integration-hub-api.test.js
```
Expected: FAIL.

### 4.2 Implementation
Preserve all existing Meta/Google OAuth behavior. Add catalog/filter/status composition only.

### 4.3 GREEN
```bash
node --test tests/free-integration-hub-api.test.js tests/security.test.js
```
Expected: PASS.

### 4.4 Commit
```bash
git add src/application/integrations/hub.js tests/free-integration-hub-api.test.js
git commit -m "feat: expose free integration hub catalog"
```

---

## Task 5 — Upgrade Existing Web Integration Hub UI

**Modify:** `public/integrations-ui.js`  
**Modify:** existing provider-card CSS file after inspection  
**Create/Modify:** a focused UI source regression test.

### 5.1 RED assertions
Require team filters and truthful states:
- Aktif
- Bağlantı gerekli
- Ücretsiz / adapter bekliyor
- Sadece kaynak
- Ücretli / hariç
- Kullanılamıyor

Paid/excluded cards must not expose activation/subscription actions.

### 5.2 Implementation
Reuse current `#integrationHub`, `#integrationCards`, status refresh, Google/YouTube/Meta actions. Add the free catalog beneath/alongside existing account cards rather than creating a duplicate hub.

### 5.3 Verify
```bash
npm run check:syntax
node --test tests/free-integration-hub-api.test.js tests/free-integration-registry.test.js
```
Expected: PASS.

### 5.4 Commit
```bash
git add public/integrations-ui.js public/*.css tests/
git commit -m "feat: show truthful free integration status in web hub"
```

---

## Task 6 — Verify Real JARVIS Execution Matrix

**Modify:** `tests/free-integration-router.test.js` and runtime tests only where real adapters exist.

Build a matrix for every screenshot tool with one status:
- `verified-executable`
- `chatgpt-external`
- `connection-required`
- `free-not-adapted`
- `reference-only`
- `paid-excluded`
- `unavailable`

Smoke at least one **real** free JARVIS execution path for each team that actually has a supported executable adapter. Examples, subject to current verified adapter state:
- Build: repository tools / native code graph / Playwright.
- Growth: YouTube Teaching; Firecrawl only if a JARVIS adapter/auth route exists.
- Operations: Google Drive through existing Google OAuth only when configured.

Do not fabricate Design/Scale execution simply to make the matrix green; external-only/unsupported remains explicit.

Run:
```bash
npm run check
npm run test:integration
```
Expected: PASS, or live credential-dependent checks truthfully report connection-required/skipped rather than false success.

Commit any scoped test/runtime corrections.

---

## Task 7 — Native iPhone Integration Hub

**iOS branch:** create `feature/free-integration-hub-ios` from current `feature/learning-engine` only after Task 4 API contract is green.

**Create:** `ios/JARVIS/IntegrationHubView.swift`  
**Modify:** `ios/JARVIS/JarvisAPI.swift`  
**Modify:** `ios/JARVIS/SettingsView.swift`  
**Create:** `tests/free-integration-ios.test.js`

### 7.1 RED contract test
Require:
- native view exists
- API calls `/api/integrations/catalog`
- five team filters exist
- truthful state labels exist
- paid/excluded items expose no paid activation action

Run:
```bash
node --test tests/free-integration-ios.test.js
```
Expected: FAIL.

### 7.2 Implementation
Add Swift models + API decoding, `IntegrationHubView`, and a compact Settings navigation entry. Use server-returned state; do not invent connection status locally.

### 7.3 GREEN + native compile
```bash
node --test tests/free-integration-ios.test.js
npm run check
cd ios
xcodegen generate
xcodebuild -project JARVIS.xcodeproj -scheme JARVIS -sdk iphonesimulator -configuration Debug CODE_SIGNING_ALLOWED=NO build
xcodebuild -project JARVIS.xcodeproj -scheme JARVIS -sdk iphoneos -configuration Release CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO build
```
Expected: all PASS.

### 7.4 Commit
```bash
git add ios/JARVIS/IntegrationHubView.swift ios/JARVIS/JarvisAPI.swift ios/JARVIS/SettingsView.swift tests/free-integration-ios.test.js
git commit -m "feat: add iPhone free integration hub"
```

---

## Task 8 — Final Verification + Review Artifacts

### Backend/Web line
Run:
```bash
npm run check
node --test tests/free-integration-registry.test.js tests/free-integration-state.test.js tests/free-integration-router.test.js tests/free-integration-hub-api.test.js
```
Expected: zero failures.

Inspect diff for:
- paid/unknown accidentally eligible
- ChatGPT connector misrepresented as JARVIS adapter
- duplicate repo seed
- secret leakage
- billing/subscription action
- Google/Meta regression

Open a **review PR only** from `feature/free-integration-hub`; do not merge.

### iOS line
Run native regression plus simulator + iPhone Release compile again after any repair. Build an unsigned IPA using the existing Workshop Beta workflow only after the feature commit passes all gates. Verify artifact upload before sharing it.

Open/retain the iOS feature branch for review; do not merge it to `main` as part of this plan.

### Final handoff state
Report:
- exact verified backend commit
- exact verified iOS commit
- test/build results
- unsigned IPA artifact
- every screenshot integration grouped by final state/team
- remaining account connection requirements

Stop before production deploy, `main` merge, secret changes, billing changes, or paid-provider enablement.

## Completion Definition
This plan is complete when the two feature lines are verified and review-ready. “Installed/active” means a real executable adapter/connected surface was verified; catalog presence alone never counts.
