# JARVIS Safe Autonomous Improvement Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic, branch-local autonomous development controller that selects the next verified low-risk JARVIS improvement, enforces hard safety gates, drives a bounded test/repair/retest cycle, records machine-readable evidence, and continues to the next safe candidate without repeated user micro-prompts.

**Architecture:** Add a focused autonomy layer under `src/application/autonomy/` that consumes existing Capability Fabric v2 verification/policy state plus YT Öğretisi and user-curated source provenance. A pure candidate-policy module decides what may enter the loop, a ledger records truthful cycle state, and a controller ranks and executes bounded cycles through injected executor/verifier adapters. Existing GitHub Actions remain the coding execution transport, but receive an explicit machine-readable autonomy contract instead of relying only on a broad natural-language prompt. No part of this plan merges `main`, deploys production, changes secrets, incurs cost, or performs high-risk vehicle writes.

**Tech Stack:** Node.js 22 ESM, `node:test`, existing Capability Registry v2/security/verification modules, existing YouTube learning memory, GitHub Actions, Wrangler dry-run.

**Spec:** `docs/superpowers/specs/2026-10-04-safe-autonomous-improvement-loop-design.md`; parent/addendum: `docs/superpowers/specs/2026-10-03-capability-fabric-v2-design.md`, `docs/superpowers/specs/2026-10-04-capability-fabric-v2-autonomous-loop-addendum.md`

## Global Constraints

- Autonomous edits run only on a non-production feature/integration/`jarvis/auto-*` branch.
- Never auto-merge to `main` and never auto-deploy production.
- Never create, rotate, delete, expose, or infer secrets/credentials.
- Never activate paid APIs, purchases, subscriptions, or any other unapproved spending.
- Never perform irreversible/destructive data, schema, filesystem, account-permission, or external publishing actions.
- Never weaken sandbox, test, or security policy to make a candidate pass.
- Third-party code cannot enter the execution path before Capability Fabric identity resolution, security classification, pinned revision, and required verification.
- High-risk vehicle/ECU writes remain human-gated; emissions-control defeat knowledge remains non-executable/reference-only.
- A queued job, generated adapter, prose claim, screenshot caption, social post, or README claim is never sufficient proof of a verified capability.
- Every completed cycle must emit machine-readable evidence with result state, verification result, changed files, commit when available, remaining gap, next candidate, and stop/gate reason.

## Review Focus

1. **Unverified source input:** screenshot/video/README/social claims must never become an auto-implementation candidate until identity/provenance and Capability Fabric state satisfy policy; test in Task 1 and Task 4.
2. **Stale verification:** evidence from an older source revision must not authorize a newer revision; test in Task 1.
3. **Truthful result states:** `failed`, `blocked`, `degraded`, `setup_required`, and `human_gate` must remain distinct from `verified`; test in Task 2 and Task 3.
4. **Failed verification:** failed tests must prevent a cycle from being marked verified and must prevent promotion/commit-success semantics; test in Task 2, Task 3, and Task 5.
5. **Independent progress:** one externally blocked candidate must not idle the whole loop when another independent verified safe candidate exists; test in Task 3.

---

### Task 1: Deterministic candidate normalization and autonomy gate

**Files:**
- Create: `src/application/autonomy/candidate-policy.js`
- Create: `tests/autonomy-candidate-policy.test.js`

**Interfaces:**
- Consumes: Capability Fabric implementation/source state, pinned source revision, source provenance, requested action metadata, branch/runtime context.
- Produces: `normalizeDevelopmentCandidate(input) -> DevelopmentCandidate`
- Produces: `evaluateAutonomyGate(candidate, context) -> { allowed: boolean, state: string, reasons: string[] }`
- Uses existing verification/policy data; does not execute third-party code.

- [ ] **Step 1: Write failing tests for safe and gated candidates**

Add tests asserting that a branch-local additive/testable candidate with verified provenance is allowed, while candidates involving `main`, production deployment, secret mutation, paid API activation, destructive action, unverified third-party execution, high-risk vehicle write, or emissions defeat return `allowed:false` with `state:'human_gate'` or the appropriate blocked/reference state.

- [ ] **Step 2: Write the stale-revision regression test**

Assert that a candidate whose `source_revision` differs from the revision bound to current verification is not allowed to execute automatically.

- [ ] **Step 3: Run the candidate-policy tests and verify RED**

Run: `node --test tests/autonomy-candidate-policy.test.js`

Expected: FAIL because `src/application/autonomy/candidate-policy.js` does not exist.

- [ ] **Step 4: Implement `normalizeDevelopmentCandidate` and `evaluateAutonomyGate`**

Keep the module pure. Normalize candidate IDs, specialist/capability IDs, provenance, revision, risk/action classes, expected changed scope, test contract, and gate-relevant flags. Gate decisions must be deterministic and reason-bearing.

- [ ] **Step 5: Run tests and verify GREEN**

Run: `node --test tests/autonomy-candidate-policy.test.js`

Expected: PASS.

- [ ] **Step 6: Commit the verified unit**

Commit message: `feat: add deterministic autonomy candidate gate`

### Task 2: Machine-readable development evidence ledger

**Files:**
- Create: `src/application/autonomy/development-ledger.js`
- Create: `tests/autonomy-development-ledger.test.js`

**Interfaces:**
- Produces: `createDevelopmentCycle(input) -> DevelopmentCycle`
- Produces: `recordDevelopmentEvent(cycle, event) -> DevelopmentCycle`
- Produces: `completeDevelopmentCycle(cycle, result) -> DevelopmentCycle`
- Produces: `serializeDevelopmentTrace(cycle) -> object`
- Valid result states: `done`, `failed`, `blocked`, `degraded`, `setup_required`, `human_gate`; `verified` is a separate evidence flag/result and cannot be inferred from `done` alone.

- [ ] **Step 1: Write failing ledger-state tests**

Assert cycle ID, trigger/provenance, specialist/capability, files changed, tests/builds, pass/fail evidence, commit SHA, remaining gap, next candidate, gate/stop reason, and timestamps are represented without collapsing distinct states.

- [ ] **Step 2: Write the false-completion regression test**

Assert that a cycle containing a failed required verification cannot serialize with `verified:true`, even if an executor reported success or produced files.

- [ ] **Step 3: Run ledger tests and verify RED**

Run: `node --test tests/autonomy-development-ledger.test.js`

Expected: FAIL because the module does not exist.

- [ ] **Step 4: Implement the immutable-style ledger helpers**

Events remain append-only inside a cycle trace. `completeDevelopmentCycle` derives truthful verification status from recorded required checks rather than free-form executor prose.

- [ ] **Step 5: Run tests and verify GREEN**

Run: `node --test tests/autonomy-development-ledger.test.js`

Expected: PASS.

- [ ] **Step 6: Commit the verified unit**

Commit message: `feat: add autonomous development evidence ledger`

### Task 3: Safe multi-cycle controller with bounded repair and independent fallback

**Files:**
- Create: `src/application/autonomy/development-loop.js`
- Create: `tests/autonomy-development-loop.test.js`

**Interfaces:**
- Consumes: normalized candidates, autonomy context, `executor(candidate, contract)`, `verifier(candidate, execution)`, optional `repair(candidate, failedExecution)`, and ledger helpers.
- Produces: `rankDevelopmentCandidates(candidates, context) -> DevelopmentCandidate[]`
- Produces: `selectNextSafeCandidate(candidates, context) -> { candidate, gate } | null`
- Produces: `runSafeDevelopmentLoop({ candidates, context, executor, verifier, repair, maxCycles }) -> { cycles, state, nextCandidate, stopReason }`

- [ ] **Step 1: Write failing ranking/selection tests**

Assert ranking favors user-value/blocking impact, evidence strength, testability, reversibility, and smaller regression surface; it must exclude candidates rejected by Task 1.

- [ ] **Step 2: Write the continuation test**

Given two safe independent candidates, assert a successful verified first cycle automatically starts the second without another user command.

- [ ] **Step 3: Write failure and repair tests**

Assert a failed verifier prevents false completion; a safe repair may run once and must be re-verified; if repair still fails, the cycle remains failed/degraded rather than being rewritten as success.

- [ ] **Step 4: Write blocked-independent-candidate test**

Given candidate A blocked by setup/external dependency and candidate B independently safe, assert the loop records A accurately and proceeds to B.

- [ ] **Step 5: Write human-gate and termination tests**

Assert the loop stops cleanly with `human_gate` when the highest required next action crosses a gated boundary, and with `no_verified_next_action` when no safe candidate remains.

- [ ] **Step 6: Run controller tests and verify RED**

Run: `node --test tests/autonomy-development-loop.test.js`

Expected: FAIL because the controller does not exist.

- [ ] **Step 7: Implement the minimal controller**

The controller coordinates only bounded candidate selection, executor/verifier calls, optional one-cycle repair, ledger evidence, and termination. It does not itself merge, deploy, mutate secrets, or run arbitrary third-party install scripts.

- [ ] **Step 8: Run tests and verify GREEN**

Run: `node --test tests/autonomy-development-loop.test.js`

Expected: PASS.

- [ ] **Step 9: Commit the verified unit**

Commit message: `feat: add safe autonomous development loop controller`

### Task 4: Bridge verified Capability Fabric and YT Öğretisi evidence into development candidates

**Files:**
- Create: `src/application/autonomy/candidate-sources.js`
- Create: `tests/autonomy-candidate-sources.test.js`
- Read/consume without duplicating seed lists: `src/lib/user-curated-capability-seeds.js`
- Read/consume existing learning records: `src/lib/youtube-learning-memory.js`
- Read/consume existing Capability Fabric state: `src/lib/capability-registry-v2.js`

**Interfaces:**
- Produces: `developmentCandidatesFromCapabilityRegistry(registry, options) -> DevelopmentCandidateInput[]`
- Produces: `developmentCandidatesFromYouTubeEvidence(records, registry, options) -> DevelopmentCandidateInput[]`
- Produces: `dedupeDevelopmentCandidates(candidates) -> DevelopmentCandidateInput[]`

- [ ] **Step 1: Write failing screenshot-pack/capability bridge tests**

Use fixtures derived from existing `USER_CURATED_CAPABILITY_SEEDS`; assert raw screenshot-pack membership alone creates discovery/reference input but does not authorize auto-execution. Assert only registry entries with sufficient resolved/learned/security/verification evidence can create an executable development candidate.

- [ ] **Step 2: Write failing YT Öğretisi provenance tests**

Assert a learned video result must retain source URL and repo/tool evidence; an unverified repo name mentioned in a video cannot become auto-executable. Assert a verified discovered repo/tool plus a confirmed JARVIS capability gap can produce a bounded development candidate with source provenance.

- [ ] **Step 3: Write dedupe tests**

Assert duplicate candidates discovered from screenshot pack, YT Öğretisi, and registry normalize to one candidate while preserving provenance from every source.

- [ ] **Step 4: Run source-bridge tests and verify RED**

Run: `node --test tests/autonomy-candidate-sources.test.js`

Expected: FAIL because the module does not exist.

- [ ] **Step 5: Implement the bridge without re-copying the 56-source list**

Reuse the existing curated seed module and existing YT learning/provenance structures. Candidate generation must compare discovered capabilities with current registry state and must not equate a repository entry with a working capability.

- [ ] **Step 6: Run tests and verify GREEN**

Run: `node --test tests/autonomy-candidate-sources.test.js`

Expected: PASS.

- [ ] **Step 7: Commit the verified unit**

Commit message: `feat: bridge learned sources into safe dev candidates`

### Task 5: GitHub Actions contract runner and truthful trace artifact

**Files:**
- Create: `.github/scripts/autonomy-loop-runner.mjs`
- Modify: `.github/workflows/jarvis-codex-agent.yml`
- Modify: `tests/autonomy-workflow.test.js`
- Modify: `package.json`

**Interfaces:**
- Script input: current branch/context plus `/tmp/jarvis-skill-backlog.json` and available machine-readable source/capability data.
- Script output before coding: `/tmp/jarvis-autonomy-contract.json` containing exactly one selected bounded candidate, acceptance/test contract, allowed scope, gate state, and provenance.
- Script output after execution/verification: `/tmp/jarvis-autonomy-trace.json` containing the cycle evidence/status.
- Workflow consumes the contract in the coding-agent prompt; the agent may not broaden itself beyond the contract without creating a new loop cycle.

- [ ] **Step 1: Extend workflow tests first**

Assert the workflow invokes `.github/scripts/autonomy-loop-runner.mjs`, creates/reads `/tmp/jarvis-autonomy-contract.json`, feeds the bounded contract to the coding step, refuses to promote failed verification, uploads a machine-readable autonomy trace artifact, and still does not auto-merge or production-deploy.

- [ ] **Step 2: Run workflow tests and verify RED**

Run: `node --test tests/autonomy-workflow.test.js`

Expected: FAIL on missing contract-runner integration.

- [ ] **Step 3: Implement the contract runner**

Make the script a thin file I/O adapter around Tasks 1–4. It must never infer secrets or perform external writes beyond emitting local contract/trace files for the workflow.

- [ ] **Step 4: Integrate the scheduled workflow**

Insert contract selection before the coding provider chain. The prompt must reference the selected candidate, exact acceptance criteria, allowed file/scope hints, provenance, and hard gates. Preserve existing hosted → keyless local coder → Codex fallback, `npm run check`, Wrangler dry-run, isolated `jarvis/auto-*` branch, and PR-only promotion behavior.

- [ ] **Step 5: Upload truthful trace evidence**

Use an Actions artifact upload step that runs on success/failure as appropriate and contains `/tmp/jarvis-autonomy-trace.json`. A failed test or absent required verification must be represented as failure/degraded/blocked, never `verified`.

- [ ] **Step 6: Add syntax coverage**

Extend `check:syntax` to include `candidate-policy.js`, `development-ledger.js`, `development-loop.js`, `candidate-sources.js`, and `.github/scripts/autonomy-loop-runner.mjs`.

- [ ] **Step 7: Run targeted tests and verify GREEN**

Run: `node --test tests/autonomy-candidate-policy.test.js tests/autonomy-development-ledger.test.js tests/autonomy-development-loop.test.js tests/autonomy-candidate-sources.test.js tests/autonomy-workflow.test.js`

Expected: PASS.

- [ ] **Step 8: Commit the verified integration**

Commit message: `feat: enforce bounded autonomous development contracts`

### Task 6: Full regression and deployment-free verification

**Files:**
- No new production files expected; repair only regressions demonstrated by this task.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: concrete branch-local verification evidence; no production side effect.

- [ ] **Step 1: Run the full repository verification suite**

Run: `npm run check`

Expected: PASS.

- [ ] **Step 2: Run Cloudflare build validation without deployment**

Run: `npx wrangler deploy --dry-run --outdir .wrangler-dry`

Expected: successful dry-run build; no production deployment.

- [ ] **Step 3: Remove dry-run output and inspect the final diff**

Confirm only planned files/repairs are present and no secret/config/production-deploy weakening was introduced.

- [ ] **Step 4: Verify autonomous acceptance behavior from tests/evidence**

Confirm: one safe cycle automatically selects the next safe candidate; failed tests prevent verified status; bounded repair re-tests; independent safe work can continue after an external block; human-gated actions stop cleanly; the trace is machine-readable and truthful.

- [ ] **Step 5: Commit final regression repairs if any**

Commit only if Task 6 required code/test repair; otherwise leave prior verified commits unchanged.

## Completion Gate

This subproject is complete only when Tasks 1–6 pass, the workflow consumes a deterministic bounded candidate contract, a successful cycle can continue to another safe candidate without another micro-command, failed verification cannot be reported as complete, independent safe work can continue past an unrelated blocker, and `main` merge/production deploy/secret mutation/spending/destructive actions/high-risk vehicle writes remain hard stops.

After completion, `feature/capability-fabric-v2` may be proposed for controlled integration, but this plan itself does not merge or deploy it.