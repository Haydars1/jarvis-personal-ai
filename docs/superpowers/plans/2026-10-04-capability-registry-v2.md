# Capability Registry v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first independently verifiable Capability Fabric v2 subproject: a truthful normalized registry for sources, revisions, capabilities, implementations, adapter manifests, security findings, verification runs, execution health, learning evidence, and development candidates without destructively rewriting the legacy registry.

**Architecture:** Add a focused v2 registry module with explicit schema/state validation and a compatibility bridge for legacy v1 entries. Keep repository identity separate from capability identity, preserve source revisions/commit pinning, and derive dashboard counts from state instead of raw repository totals. The legacy `data/capability-registry.json` remains readable but is not silently rewritten by runtime code; the new v2 cache/document is additive.

**Tech Stack:** Node.js ESM, `node:test`, existing JARVIS capability compiler/harvester modules, JSON persistence.

**Spec:** `docs/superpowers/specs/2026-10-03-capability-fabric-v2-design.md`

## Global Constraints

- Do not merge to `main` automatically.
- Do not deploy production automatically.
- Do not create/rotate secrets.
- Do not execute unreviewed third-party shell code on the primary JARVIS environment.
- Do not count `candidate`, `resolved`, `learned`, `security_scanned`, or `adapter_ready` as a working capability.
- Source commit/release changes must invalidate prior verification state until re-tested.
- Migration is additive first; do not destructively rewrite `data/capability-registry.json`.
- Repository count is not capability count.
- High-risk vehicle writes and emissions-control defeat remain outside automatic execution.

## Review Focus

1. Empty or malformed legacy `data/capability-registry.json` must not crash registry-v2 loading; it must surface a deterministic degraded/empty compatibility result.
2. Duplicate repositories with different commits must create one source with multiple source revisions, not duplicate source identities.
3. One repository exposing multiple capabilities and multiple repositories implementing one capability must normalize correctly.
4. A changed source revision must clear `verified`/healthy execution evidence for affected implementations until re-verification.
5. Dashboard counts must be derived from normalized state and must not report learned/adapter-only entries as executable or verified.

---

### Task 1: Add normalized Registry v2 schema and validators

**Files:**
- Create: `src/lib/capability-registry-v2.js`
- Create: `tests/capability-registry-v2.test.js`

**Interfaces:**
- Consumes: plain JS objects and legacy registry documents.
- Produces: `createCapabilityRegistryV2()`, `validateCapabilityRegistryV2(registry)`, `normalizeCapabilityState(state)`, and exported lifecycle constants.

- [ ] **Step 1: Write failing schema tests**

Add tests asserting:
- `createCapabilityRegistryV2()` returns `schemaVersion: 2`.
- top-level collections exist for `sources`, `source_revisions`, `capabilities`, `implementations`, `adapter_manifests`, `security_findings`, `verification_runs`, `execution_health`, `learning_evidence`, and `development_candidates`.
- invalid lifecycle values are rejected.
- `verified` cannot be assigned without an implementation and verification evidence reference.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test tests/capability-registry-v2.test.js`

Expected: FAIL because `src/lib/capability-registry-v2.js` does not exist.

- [ ] **Step 3: Implement the minimal schema/validation module**

Create exact exports:
- `CAPABILITY_SOURCE_STATES`
- `CAPABILITY_IMPLEMENTATION_STATES`
- `createCapabilityRegistryV2() -> object`
- `normalizeCapabilityState(state: string) -> string | null`
- `validateCapabilityRegistryV2(registry: object) -> { ok: boolean, errors: string[] }`

Keep validation deterministic and side-effect free.

- [ ] **Step 4: Run focused tests**

Run: `node --test tests/capability-registry-v2.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/capability-registry-v2.js tests/capability-registry-v2.test.js
git commit -m "feat: add capability registry v2 schema"
```

### Task 2: Add legacy v1 compatibility and safe empty-file handling

**Files:**
- Modify: `src/lib/capability-registry-v2.js`
- Modify: `tests/capability-registry-v2.test.js`
- Modify: `tests/capability-harvester.test.js`

**Interfaces:**
- Consumes: current legacy shape `{ schemaVersion: 1, entries: [...] }`, empty string, missing document, or malformed JSON result supplied by caller.
- Produces: `migrateLegacyRegistryV1(legacy, options?) -> registryV2` and `readLegacyRegistryCompatibility(raw) -> { status, registry, errors }`.

- [ ] **Step 1: Write failing compatibility tests**

Add tests asserting:
- empty legacy content returns `status: 'empty'` without throwing.
- malformed content returns `status: 'invalid'` with errors.
- a valid v1 entry becomes one normalized source plus one source revision.
- legacy repo categories become capability relationships, not duplicate repository objects.
- existing harvester tests no longer assume an empty checked-in file is valid populated production data; they test harvester output separately from compatibility loading.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test tests/capability-registry-v2.test.js tests/capability-harvester.test.js`

Expected: FAIL on the new compatibility assertions.

- [ ] **Step 3: Implement compatibility bridge**

Add exact exports:
- `readLegacyRegistryCompatibility(raw: string | object | null) -> { status: 'ok'|'empty'|'invalid', registry: object, errors: string[] }`
- `migrateLegacyRegistryV1(legacy: object, options?: object) -> object`

Requirements:
- canonical repo identity is case-insensitive owner/name;
- preserve source metadata/provenance where present;
- never mutate the input object;
- do not write files from this module.

- [ ] **Step 4: Run focused tests**

Run: `node --test tests/capability-registry-v2.test.js tests/capability-harvester.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/capability-registry-v2.js tests/capability-registry-v2.test.js tests/capability-harvester.test.js
git commit -m "feat: bridge legacy capability registry safely"
```

### Task 3: Normalize source revisions, capabilities, and implementations

**Files:**
- Modify: `src/lib/capability-registry-v2.js`
- Modify: `tests/capability-registry-v2.test.js`

**Interfaces:**
- Consumes: repository identity, commit/release, extracted capability IDs, implementation metadata.
- Produces: `upsertSourceRevision(registry, input)`, `upsertCapability(registry, input)`, `upsertImplementation(registry, input)`.

- [ ] **Step 1: Write failing normalization tests**

Add tests asserting:
- same repo + same commit deduplicates.
- same repo + different commit creates a new source revision under the same source.
- one source can expose multiple capabilities.
- two sources can implement the same capability ID.
- implementation identity includes source revision so verification cannot leak across commits.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test tests/capability-registry-v2.test.js`

Expected: FAIL on missing upsert functions.

- [ ] **Step 3: Implement normalized upsert helpers**

Add exact exports:
- `upsertSourceRevision(registry: object, input: object) -> { source, revision }`
- `upsertCapability(registry: object, input: object) -> object`
- `upsertImplementation(registry: object, input: object) -> object`

Use stable deterministic IDs derived from canonical source identity + pinned revision + capability ID; do not use star count as capability priority.

- [ ] **Step 4: Run focused tests**

Run: `node --test tests/capability-registry-v2.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/capability-registry-v2.js tests/capability-registry-v2.test.js
git commit -m "feat: normalize capability sources and implementations"
```

### Task 4: Invalidate verification on source revision change

**Files:**
- Modify: `src/lib/capability-registry-v2.js`
- Modify: `tests/capability-registry-v2.test.js`

**Interfaces:**
- Consumes: registry, implementation ID, new source revision ID.
- Produces: `moveImplementationToRevision(registry, implementationId, revisionId)` and `invalidateVerificationForImplementation(registry, implementationId, reason)`.

- [ ] **Step 1: Write failing revision-invalidation tests**

Add tests asserting:
- moving an implementation to a new source revision changes state from `verified` to `adapter_ready` or lower.
- previous verification records remain as historical evidence but no longer satisfy current verification.
- current execution health is reset/degraded with reason `source_revision_changed`.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test tests/capability-registry-v2.test.js`

Expected: FAIL on missing invalidation functions.

- [ ] **Step 3: Implement verification invalidation**

Add exact exports:
- `invalidateVerificationForImplementation(registry: object, implementationId: string, reason: string) -> object`
- `moveImplementationToRevision(registry: object, implementationId: string, revisionId: string) -> object`

Do not delete historical `verification_runs`; mark them non-current through revision linkage.

- [ ] **Step 4: Run focused tests**

Run: `node --test tests/capability-registry-v2.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/capability-registry-v2.js tests/capability-registry-v2.test.js
git commit -m "feat: invalidate stale capability verification"
```

### Task 5: Add truthful registry summary for the capability dashboard

**Files:**
- Modify: `src/lib/capability-registry-v2.js`
- Modify: `tests/capability-registry-v2.test.js`

**Interfaces:**
- Consumes: normalized registry v2.
- Produces: `summarizeCapabilityRegistry(registry) -> object`.

- [ ] **Step 1: Write failing dashboard-summary tests**

Add a mixed-state fixture and assert exact counts for:
- `sources`
- `resolved`
- `learned`
- `security_approved`
- `reference_only`
- `blocked`
- `adapter_ready`
- `executable`
- `verified`
- `degraded`

Also assert that a learned-only source does not increase executable/verified counts.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test tests/capability-registry-v2.test.js`

Expected: FAIL because summary function does not exist.

- [ ] **Step 3: Implement truthful summary**

Add exact export:
- `summarizeCapabilityRegistry(registry: object) -> { sources, resolved, learned, security_approved, reference_only, blocked, adapter_ready, executable, verified, degraded }`

Count implementation states from implementations, source states from sources/revisions, and never infer working capability status from repository presence alone.

- [ ] **Step 4: Run focused tests**

Run: `node --test tests/capability-registry-v2.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/capability-registry-v2.js tests/capability-registry-v2.test.js
git commit -m "feat: add truthful capability registry summary"
```

### Task 6: Add additive v2 cache document and full regression verification

**Files:**
- Create: `data/capability-registry-v2.json`
- Modify: `package.json`
- Modify: `tests/capability-registry-v2.test.js`

**Interfaces:**
- Consumes: registry-v2 module.
- Produces: checked-in additive cache skeleton and syntax-check coverage.

- [ ] **Step 1: Write failing repository-shape tests**

Add tests asserting:
- `data/capability-registry-v2.json` exists and validates as schema version 2.
- existing `data/capability-registry.json` still exists.
- `package.json` syntax check includes `src/lib/capability-registry-v2.js`.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test tests/capability-registry-v2.test.js`

Expected: FAIL because the v2 cache file and syntax-check entry do not yet exist.

- [ ] **Step 3: Add the additive cache and syntax-check entry**

Create `data/capability-registry-v2.json` from `createCapabilityRegistryV2()` with empty normalized collections only; do not fabricate verification results or executable capabilities.

Update `package.json` `check:syntax` to include `node --check src/lib/capability-registry-v2.js`.

- [ ] **Step 4: Run all verification**

Run:
- `node --test tests/capability-registry-v2.test.js tests/capability-harvester.test.js`
- `npm run check:syntax`
- `npm test`

Expected: all PASS. If unrelated pre-existing tests fail, record exact failures and do not claim completion until separated from regressions introduced by this plan.

- [ ] **Step 5: Commit**

```bash
git add data/capability-registry-v2.json package.json tests/capability-registry-v2.test.js
git commit -m "feat: seed additive capability registry v2 cache"
```

## Completion Gate

This subproject is complete only when:

- the new v2 registry schema validates;
- legacy empty/malformed/populated inputs are handled truthfully;
- repository/source identity is separate from capability identity;
- multiple implementations can share one capability ID;
- source revision changes invalidate current verification without deleting history;
- dashboard counts distinguish learned/adapter/executable/verified/degraded states;
- the legacy registry remains present and untouched by runtime migration;
- focused tests, syntax checks, and the full Node test suite pass.

After this plan passes, the next independent plan is **Security & Sandbox Gate**, followed by **Adapter Compiler v2**, **Verification & Health Engine**, **Runtime Capability Router**, and then **YT Öğretisi v2**.