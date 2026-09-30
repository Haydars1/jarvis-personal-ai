# GitHub Capability Fabric Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a scalable GitHub-backed open-source capability registry and local-first routing layer for JARVIS.

**Architecture:** Discovery is metadata-only and deterministic; repositories are normalized, admitted/quarantined/rejected, stored in a registry, and ranked for tasks before remote AI providers. Execution remains behind separately reviewed adapters, so discovery never runs third-party code automatically.

**Tech Stack:** Node.js ESM, GitHub REST API, GitHub Actions, existing JARVIS provider router/tests.

**Spec:** `docs/superpowers/specs/2026-09-30-github-capability-fabric-design.md`

## Global Constraints

- Discovery must not auto-install or auto-execute third-party repository code.
- Unknown licenses are quarantined; copyleft repositories are external-only; permissive licensed healthy repositories may be accepted.
- Archived/disabled and clearly unsafe repositories are not eligible for automatic routing.
- Existing remote provider failover remains intact as fallback.
- Automotive discovery does not create an automated road-vehicle emissions-control defeat pipeline.
- Harvester uses GitHub metadata only and requires no paid AI API.

## Review Focus

- Missing/null GitHub metadata must produce a safe quarantine/reject result, never an exception.
- Duplicate repositories returned by multiple queries must produce exactly one registry entry.
- GPL/AGPL projects must remain external-only rather than being treated as vendorable code.
- Runtime target mismatches (for example GPU-only tool on cloud CPU) must exclude the candidate.
- Dangerous/security-abuse topics must not enter the automatic execution candidate pool.

---

### Task 1: Capability taxonomy, seed catalog and admission policy

**Files:**
- Create: `src/lib/open-source-capabilities.js`
- Create: `tests/open-source-capabilities.test.js`

**Interfaces:**
- Produces: `CAPABILITY_DISCOVERY_QUERIES`, `CURATED_CAPABILITY_SEEDS`, `evaluateRepository(repo, now)`, `normalizeRepository(repo, hints, now)`.

- [ ] **Step 1: Write failing tests** for 20+ queries, 15+ categories, representative curated seeds, permissive acceptance, copyleft external-only, unknown-license quarantine, archived rejection, unsafe-topic rejection and null-safe metadata handling.
- [ ] **Step 2: Run `npm test` and verify failure is caused by the missing module/behavior.**
- [ ] **Step 3: Implement the minimal deterministic catalog, normalization and admission functions.**
- [ ] **Step 4: Run `npm run check` and verify all tests pass.**
- [ ] **Step 5: Commit.**

### Task 2: Local/open-source task ranking and provider fallback plan

**Files:**
- Modify: `src/lib/open-source-capabilities.js`
- Modify: `src/lib/orchestration.js`
- Modify: `tests/open-source-capabilities.test.js`

**Interfaces:**
- Consumes: normalized registry records from Task 1.
- Produces: `openSourceCandidates(kind, registry, runtimeContext)` and `buildExecutionPlan(kind, registry, runtimeContext, providerRows)`.

- [ ] **Step 1: Write failing tests** proving task-category matching, runtime-target filtering, unhealthy candidate suppression and open-source lane ordering before provider fallback.
- [ ] **Step 2: Run tests and observe RED.**
- [ ] **Step 3: Implement minimal ranking plus provider fallback integration without changing existing provider score semantics.**
- [ ] **Step 4: Run `npm run check` and verify GREEN.**
- [ ] **Step 5: Commit.**

### Task 3: Metadata-only GitHub harvester

**Files:**
- Create: `.github/scripts/harvest-capabilities.mjs`
- Create: `data/capability-registry.json`
- Modify: `tests/open-source-capabilities.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 1 query/seed/admission exports.
- Produces: deterministic registry JSON and `npm run harvest:capabilities`.

- [ ] **Step 1: Write failing tests** for deterministic sorting, deduplication helper behavior and package script presence.
- [ ] **Step 2: Run tests and observe RED.**
- [ ] **Step 3: Implement the dependency-free harvester and deterministic writer; no third-party code execution.**
- [ ] **Step 4: Run `npm run check` and a bounded dry harvester fixture mode; verify GREEN.**
- [ ] **Step 5: Commit.**

### Task 4: Scheduled discovery workflow

**Files:**
- Create: `.github/workflows/capability-harvest.yml`
- Modify: `tests/open-source-capabilities.test.js`

**Interfaces:**
- Consumes: `npm run harvest:capabilities` from Task 3.
- Produces: daily/manual metadata refresh that opens a tested `jarvis/capability-harvest-*` PR only when registry changes.

- [ ] **Step 1: Write failing workflow contract tests** for schedule/manual trigger, least required permissions, check/dry-run gates and PR branch behavior.
- [ ] **Step 2: Run tests and observe RED.**
- [ ] **Step 3: Add workflow using GitHub token only; never install discovered repos.**
- [ ] **Step 4: Run `npm run check` and Cloudflare dry-run.**
- [ ] **Step 5: Commit.**

### Task 5: Whole-branch verification

**Files:**
- Review all files above.

**Interfaces:**
- Produces: merge-ready PR evidence.

- [ ] **Step 1: Run complete `npm run check`.**
- [ ] **Step 2: Run `npx wrangler deploy --dry-run --outdir .wrangler-dry`.**
- [ ] **Step 3: Inspect CI results and fix any Critical/Important issue through RED→GREEN.**
- [ ] **Step 4: Verify PR diff contains no vendored third-party repository code or secrets.**
- [ ] **Step 5: Leave the tested PR for the repository self-update merge gate.**
