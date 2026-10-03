# JARVIS Free Integration Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing JARVIS Integration Hub so only verified free/free-plan integrations can be selected automatically, existing JARVIS capabilities are reused instead of duplicated, and the iPhone app truthfully shows what is active, connection-required, reference-only, excluded, or unavailable.

**Architecture:** Keep the existing `src/application/integrations/hub.js` as the authenticated integration entry point and add one focused registry/policy module plus one focused router module. Repository-backed capabilities continue to use the current repository/cloud/native execution stack; ChatGPT-only connectors are represented as external surfaces and are never falsely advertised as directly executable by the Worker. The existing web integration UI and the native iOS Settings surface consume the same normalized catalog/status payload.

**Tech Stack:** Cloudflare Workers, JavaScript ES modules, Node `node:test`, D1/KV-backed existing credential state, SwiftUI iOS client.

**Spec:** `docs/superpowers/specs/2026-10-03-free-integration-hub-design.md`

## Global Constraints

- Install/integrate free and free-plan tools only.
- Do not install screenshot-labelled paid tools: ScreensDesign MCP, Higgsfield MCP, Plaud, ManyChat.
- Do not spend money, start subscriptions, or change billing.
- Do not claim an integration is active unless a working adapter/connector or explicitly connected surface proves it.
- Existing installed integrations and existing repository seeds must be reused rather than duplicated.
- Unknown pricing defaults to ineligible for automatic execution until verified as free/free-plan.
- No production deploy, `main` merge, billing, subscription, or secret changes in this implementation branch.
- External account/OAuth connections remain user-controlled.

## Review Focus

- **Unknown or changed pricing:** an integration with `pricing='unknown'` or `pricing='paid'` must never be auto-selected; Task 1 pins this.
- **Connection-required provider:** a free integration that needs OAuth/API credentials must show `connection-required`, not `ready`; Task 2 pins this.
- **Duplicate capability source:** a repo/tool already present in `CURATED_CAPABILITY_SEEDS` must be referenced, not inserted again; Task 2 pins this.
- **Adapter failure:** routing must record the failure and move to the next eligible free fallback without selecting a paid/unknown option; Task 3 pins this.
- **Stale external ChatGPT connector state:** JARVIS must label ChatGPT-only tools as external/handoff unless its own runtime can execute them; Task 2 and Task 4 pin this.

---

### Task 1: Free Integration Registry and Eligibility Policy

**Files:**
- Create: `src/lib/free-integration-registry.js`
- Create: `tests/free-integration-registry.test.js`
- Modify: `package.json` (`check:syntax` adds the new module)

**Interfaces:**
- Produces: `FREE_INTEGRATION_TEAMS`, `FREE_INTEGRATION_SEEDS`, `normalizeIntegration(record, runtimeState = {})`, `isAutoExecutableIntegration(record)`, `integrationSummary(records)`.
- Record fields: `id`, `name`, `team`, `surface`, `sourceType`, `capabilities`, `pricing`, `authState`, `runtimeState`, `adapterId`, `route`, `provenance`, `notes`.
- Pricing values: `free`, `free-plan`, `unknown`, `paid`.
- Runtime values: `ready`, `connection-required`, `degraded`, `reference-only`, `unavailable`, `excluded`.

- [ ] **Step 1: Write the failing policy tests**

Add tests asserting:
- `free` + `ready` is auto-executable.
- `free-plan` + `ready` is auto-executable.
- `unknown`, `paid`, `connection-required`, `reference-only`, and `excluded` are never auto-executable.
- ScreensDesign, Higgsfield, Plaud, and ManyChat normalize to `paid/excluded`.
- Unknown pricing normalizes to non-executable instead of guessing free.
- Team summary counts each runtime state correctly.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/free-integration-registry.test.js`
Expected: FAIL because `src/lib/free-integration-registry.js` does not exist.

- [ ] **Step 3: Implement the registry/policy module**

Create the exports above. Seed the screenshot tools only with states supported by evidence already present in the repo/spec; unverified pricing remains `unknown`. Explicitly mark the four screenshot-labelled paid tools as `paid` + `excluded`.

- [ ] **Step 4: Run the focused test and syntax check**

Run: `node --test tests/free-integration-registry.test.js && npm run check:syntax`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/free-integration-registry.js tests/free-integration-registry.test.js package.json
git commit -m "feat: add free integration eligibility policy"
```

### Task 2: Normalize Existing JARVIS and External Connector States

**Files:**
- Modify: `src/lib/repository-integrations.js`
- Modify: `src/lib/free-integration-registry.js`
- Create: `tests/free-integration-state.test.js`

**Interfaces:**
- Consumes: Task 1 registry functions.
- Produces: `buildFreeIntegrationCatalog({ repositoryIntegrations, providerState }) -> IntegrationRecord[]`.
- Existing repo execution states remain authoritative; the new catalog maps them rather than cloning seed entries.

- [ ] **Step 1: Write failing state-normalization tests**

Cover:
- Existing `microsoft/playwright-mcp`, `remotion-dev/remotion`, `apify/crawlee`, and `artemnovitckii/notebooklm-coach` are referenced through existing repository metadata rather than duplicated.
- Existing `notebooklm-coach` stays `reference-only` because JARVIS uses its clean-room YouTube adapter instead of executing third-party code.
- A free provider with missing OAuth/API setup becomes `connection-required`.
- A ChatGPT-only connector such as Figma/Canva/Consensus is represented with `surface='chatgpt'` and is not marked Worker-executable merely because it exists in ChatGPT.
- HeyGen remains outside automatic free routing while free-tier eligibility is unverified, even if connected in ChatGPT.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/free-integration-state.test.js`
Expected: FAIL because `buildFreeIntegrationCatalog` is missing.

- [ ] **Step 3: Implement catalog composition**

Join the Task 1 seed metadata to `repositoryIntegrations()` by canonical repo/id. Reuse existing integration `status/mode/route` values. Never mutate `CURATED_CAPABILITY_SEEDS` just to make a second copy of an already-known repository.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/free-integration-state.test.js tests/pdf-integrations.test.js tests/open-source-capabilities.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/free-integration-registry.js src/lib/repository-integrations.js tests/free-integration-state.test.js
git commit -m "feat: normalize free integration states"
```

### Task 3: Free-Only Router With Fallback Trace

**Files:**
- Create: `src/application/integrations/free-router.js`
- Create: `tests/free-integration-router.test.js`
- Modify: `src/application/capabilities/runtime.js`
- Modify: `package.json` (`check:syntax` adds the router)

**Interfaces:**
- Consumes: normalized `IntegrationRecord[]` from Task 2.
- Produces: `selectFreeIntegration(task, records, failedIds = []) -> { selected, fallbacks, skipped }`.
- `selected` is `null | IntegrationRecord`; `skipped` contains `{id, reason}`; `fallbacks` contains eligible records in priority order.

- [ ] **Step 1: Write failing router tests**

Assert:
- Build/research/operations/design/scale tasks prefer matching team capabilities.
- `paid`, `unknown`, `excluded`, `connection-required`, and `reference-only` records are skipped for execution.
- If first ready adapter is in `failedIds`, the next ready free fallback is selected.
- The trace explains every skipped candidate.
- No ChatGPT-only connector is returned as Worker-executable unless an explicit JARVIS adapter state says `ready`.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/free-integration-router.test.js`
Expected: FAIL because the router does not exist.

- [ ] **Step 3: Implement router and capability-runtime hook**

Add `selectFreeIntegration`. In `src/application/capabilities/runtime.js`, consult the free router only for Integration Hub routed work; preserve existing capability execution behavior for unrelated ECU/YouTube/repo flows.

- [ ] **Step 4: Verify GREEN plus regressions**

Run: `node --test tests/free-integration-router.test.js tests/cloud-capability-execution.test.js tests/orchestration.test.js tests/reliability-runtime.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/application/integrations/free-router.js src/application/capabilities/runtime.js tests/free-integration-router.test.js package.json
git commit -m "feat: route only verified free integrations"
```

### Task 4: Extend the Existing Integration Hub API and Web Status UI

**Files:**
- Modify: `src/application/integrations/hub.js`
- Modify: `public/integrations-ui.js`
- Create: `tests/free-integration-hub-api.test.js`

**Interfaces:**
- Consumes: `buildFreeIntegrationCatalog`, `integrationSummary`.
- Produces authenticated `GET /api/integrations/catalog?team=<optional>&state=<optional>` returning `{ integrations, summary, filters }`.
- Existing `GET /api/integrations/status` keeps Google/YouTube/Meta compatibility and adds `freeHub` summary without breaking current consumers.

- [ ] **Step 1: Write failing API tests**

Assert:
- Unauthenticated catalog requests follow the existing auth behavior.
- Catalog filters by team/state.
- Paid/excluded items may be displayed for transparency but include `autoExecutable:false`.
- Existing Google/YouTube/Facebook/Instagram keys remain unchanged.
- ChatGPT-only entries render as external/handoff state, not JARVIS `ready`.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/free-integration-hub-api.test.js`
Expected: FAIL because `/api/integrations/catalog` is not implemented.

- [ ] **Step 3: Add the API endpoint and extend the existing web cards**

Keep current Meta/Google OAuth code intact. Add a second Integration Hub section grouped by Build / Design / Growth / Operations / Scale with state badges: Active, Connection needed, Free not adapted, Reference only, Paid/excluded, Unavailable.

- [ ] **Step 4: Verify GREEN and existing integration regression**

Run: `node --test tests/free-integration-hub-api.test.js && npm run check:syntax`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/application/integrations/hub.js public/integrations-ui.js tests/free-integration-hub-api.test.js
git commit -m "feat: expose free integration hub catalog"
```

### Task 5: Native iPhone Integration Hub

**Files:**
- Modify: `ios/JARVIS/JarvisAPI.swift`
- Create: `ios/JARVIS/IntegrationHubView.swift`
- Modify: `ios/JARVIS/SettingsView.swift`
- Create: `tests/free-integration-ios.test.js`

**Interfaces:**
- Consumes: `GET /api/integrations/catalog` from Task 4.
- Produces Swift models `IntegrationHubRecord`, `IntegrationHubSummary`, `IntegrationHubCatalogResponse` and `JarvisAPI.integrationCatalog(team:state:) async throws -> IntegrationHubCatalogResponse`.
- `IntegrationHubView` provides team and state filters and no direct paid-subscription action.

- [ ] **Step 1: Write failing native-contract test**

Use Node file assertions to require:
- `IntegrationHubView.swift` exists.
- `JarvisAPI.swift` calls `/api/integrations/catalog`.
- UI contains the five team filters and the truthful state labels.
- UI has no button/text that starts a paid subscription for the excluded providers.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/free-integration-ios.test.js`
Expected: FAIL because the native view/API method is absent.

- [ ] **Step 3: Implement the Swift models/API/view and add Settings navigation**

Keep the existing Settings skill/capability status. Add an `Integration Hub` entry that opens the new view and displays server-returned states without locally inventing connection status.

- [ ] **Step 4: Verify contract test**

Run: `node --test tests/free-integration-ios.test.js`
Expected: PASS.

- [ ] **Step 5: Run native compile gates**

Run the existing `Validate Native JARVIS iOS` workflow (or equivalent Xcode simulator + iPhone Release commands used by repository CI) on the feature branch.
Expected: simulator and iPhone Release compile PASS.

- [ ] **Step 6: Commit**

```bash
git add ios/JARVIS/JarvisAPI.swift ios/JARVIS/IntegrationHubView.swift ios/JARVIS/SettingsView.swift tests/free-integration-ios.test.js
git commit -m "feat: show free integrations on iPhone"
```

### Task 6: Whole-Branch Verification and Review Artifact

**Files:**
- Modify only if a verification failure requires a scoped repair.
- No production workflow or secret file changes.

**Interfaces:**
- Consumes: Tasks 1-5.
- Produces: a feature branch whose API, router, web UI, and iOS UI agree on truthful free-only states.

- [ ] **Step 1: Run full repository validation**

Run: `npm run check`
Expected: all syntax and Node tests PASS.

- [ ] **Step 2: Run focused free-integration suite together**

Run: `node --test tests/free-integration-registry.test.js tests/free-integration-state.test.js tests/free-integration-router.test.js tests/free-integration-hub-api.test.js tests/free-integration-ios.test.js`
Expected: PASS with zero failures.

- [ ] **Step 3: Run native iOS validation again after any repairs**

Expected: simulator + iPhone Release compile PASS.

- [ ] **Step 4: Inspect the final diff for forbidden changes**

Confirm the branch contains no billing/subscription action, no paid-provider auto-execution, no new secrets, no production deploy trigger, and no duplicate repository seeds.

- [ ] **Step 5: Open a review PR only**

Open a PR from the implementation branch without merging it to `main`. Include test evidence and list any integrations still `connection-required`, `reference-only`, or `unknown`.

## Execution Boundary

Completion of this plan means the feature branch and review PR are verified. Production deploy, merge to `main`, adding/changing secrets, starting paid plans, or connecting external accounts are deliberately outside this plan and require a separate explicit user action/approval.