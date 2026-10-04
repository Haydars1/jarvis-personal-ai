# Capability Fabric Runtime Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the safe runtime core that turns normalized capability implementations into security-classified adapter manifests, verification evidence, health state, and deterministic verified routing with fallback.

**Architecture:** Add four focused pure-JS modules on top of Capability Registry v2. Security policy stays authoritative and side-effect free; adapter compilation produces typed manifests only; verification/health stores evidence without executing arbitrary code; the router selects only executable/verified implementations and returns an explicit attempt trace. Existing runtime remains compatible and can adopt these modules incrementally.

**Tech Stack:** Node.js ESM, `node:test`, existing Capability Registry v2.

**Spec:** `docs/superpowers/specs/2026-10-03-capability-fabric-v2-design.md`

## Global Constraints

- Do not merge to `main` automatically.
- Do not deploy production automatically.
- Do not create/rotate secrets or enable paid APIs.
- Unreviewed third-party shell code must never run on the primary JARVIS environment.
- Repository presence, learned state, or adapter presence must never be reported as verified execution.
- High-risk vehicle writes and emissions-control defeat remain outside automatic execution.

## Review Focus

1. Prompt-injection, secret access, destructive shell, browser profile and privilege-escalation findings must block or downgrade execution deterministically.
2. Adapter manifests must preserve exact pinned source revision and never infer trust from popularity.
3. Verification evidence must match implementation + source revision and stale evidence must not count as current.
4. Router must exclude learned/adapter-only/blocked implementations and make fallback attempts visible.
5. Cost/platform/permission/risk filters must not silently choose incompatible tools.

---

### Task 1: Security & sandbox policy gate

**Files:**
- Create: `src/lib/capability-security-v2.js`
- Create: `tests/capability-security-v2.test.js`

**Interfaces:**
- Produces: `scanCapabilitySource(input)`, `classifyCapabilityPolicy(input)`, `isPolicyExecutable(policy)`.

- [ ] Pin deterministic risk findings and policy classes with tests.
- [ ] Implement static text/file/manifest heuristics and authoritative policy classification.
- [ ] Ensure unsafe/destructive/secret/privilege patterns cannot auto-execute.

### Task 2: Adapter Compiler v2 manifest

**Files:**
- Create: `src/lib/capability-adapter-compiler-v2.js`
- Create: `tests/capability-adapter-compiler-v2.test.js`

**Interfaces:**
- Consumes: learned capability + pinned revision + policy result.
- Produces: `compileAdapterManifest(input)` and `validateAdapterManifest(manifest)`.

- [ ] Test pinned revision, typed inputs/outputs, requirements, auth/cost/platform and execution target.
- [ ] Implement proposal-only adapter manifests; blocked/reference-only policies cannot become executable manifests.

### Task 3: Verification & health engine

**Files:**
- Create: `src/lib/capability-verification-v2.js`
- Create: `tests/capability-verification-v2.test.js`

**Interfaces:**
- Produces: `recordVerificationRun(registry,input)`, `recordExecutionHealth(registry,input)`, `currentVerificationFor(registry,implementationId)`, `currentHealthFor(registry,implementationId)`.

- [ ] Test evidence linkage, stale revision rejection, health degradation and historical retention.
- [ ] Implement additive evidence recording and current-state lookup.

### Task 4: Verified runtime router with visible fallback

**Files:**
- Create: `src/lib/capability-router-v2.js`
- Create: `tests/capability-router-v2.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `rankCapabilityImplementations(registry,request)` and `executeCapabilityWithFallback(registry,request,executor)`.

- [ ] Test exclusion of non-working states and policy/requirement mismatches.
- [ ] Test health/recency/reliability scoring and deterministic ordering.
- [ ] Test fallback trace: failed implementation then verified compatible implementation.
- [ ] Add all four modules to syntax checks and run full CI once at the end.

## Completion Gate

The runtime core is complete when unsafe sources cannot auto-execute, manifests are pinned and typed, verification evidence is revision-bound, degraded health is visible, and runtime selection only considers compatible executable/verified implementations with explicit fallback traces.
