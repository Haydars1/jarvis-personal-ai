# JARVIS Capability Fabric v2 — Safe Autonomous Development Loop Addendum

Date: 2026-10-04
Parent spec: `docs/superpowers/specs/2026-10-03-capability-fabric-v2-design.md`
Branch: `feature/capability-fabric-v2`
Status: written design addendum; implementation not yet started

## Purpose

JARVIS must not stop after merely describing the next useful development step. After a safe development cycle finishes, it should inspect the actual result, identify the highest-value remaining gap, choose the next safe action, implement it on the development branch, run the required verification, and repeat without requiring a new micro-command from the user.

This loop is part of development orchestration, not permission to bypass safety, deployment, cost, or device-write gates.

## Loop Contract

For each development cycle:

1. Read current branch state, open acceptance criteria, previous verification evidence, and unresolved failures.
2. Determine whether the current task is actually complete. A commit, queued job, adapter manifest, or generated file alone is not completion.
3. Rank next actions by impact, dependency order, safety, and reversibility.
4. Select the highest-value action that is allowed to run automatically.
5. Implement only on the approved development/integration branch.
6. Run the relevant test set and capture concrete evidence.
7. If tests fail, diagnose the failure and either repair it or mark the capability/task as degraded/blocked with evidence.
8. Re-evaluate the project state from the new evidence.
9. Continue to the next safe action until the acceptance criteria are satisfied or the next action crosses a human-gated boundary.

## Automatically Allowed

The loop may perform these actions without asking for another micro-command when they remain inside the approved feature scope:

- inspect repository files, diffs, issues, workflow logs, test output and existing documentation;
- create or modify code on a feature/integration branch;
- add or update tests;
- run local/CI validation that does not incur unapproved cost;
- generate adapters, fixtures, schemas and migration code when changes are additive/reversible;
- register candidate capabilities as `candidate`, `resolved`, `learned`, `security_scanned`, `reference_only`, `adapter_ready`, `executable`, `verified` or `degraded` according to evidence;
- retry a failed compatible implementation with another verified implementation;
- improve observability, provenance and truthful status reporting;
- ingest approved learning sources and generate development candidates;
- create commits on the development branch after verification evidence exists.

## Human-Gated Boundaries

The autonomous loop must stop and surface a proposal before any of the following:

- merge to `main` or another protected production branch;
- production deployment;
- creation, rotation, deletion or exposure of secrets/credentials;
- paid API activation, purchases, subscriptions or other spending;
- destructive database/filesystem migrations or irreversible deletion;
- weakening sandbox/security policy;
- unrestricted execution of untrusted third-party code on the primary JARVIS host;
- high-risk vehicle/ECU write operations;
- any action whose target identity, compatibility or rollback path is uncertain.

The loop may prepare all artifacts needed for these actions, but may not silently perform the gated action itself.

## Completion Truth Rules

JARVIS may say a development item is complete only when the item’s acceptance contract has concrete evidence.

Examples:

- `adapter_ready` is not `verified`;
- a queued GitHub Action is not a successful build;
- a generated IPA is not verified until the build job finished successfully and the artifact exists;
- a tool description is not a working capability;
- a fallback chat answer is not proof that the deterministic tool worked;
- a YT Öğretisi extraction is not verified until source/provenance and discovered repo/tool evidence are stored and retrievable.

Every cycle should expose a concise trace containing:

- what changed;
- why it was selected;
- files/components touched;
- tests run;
- pass/fail evidence;
- remaining gap;
- next safe action;
- whether a human gate is blocking further progress.

## Failure Handling

When a cycle fails:

1. preserve logs and the failing evidence;
2. do not rewrite failure as success;
3. classify the failure as code defect, environment/dependency issue, unsupported platform, authentication/setup requirement, policy block, or transient external failure;
4. repair automatically only when the repair is safe and inside scope;
5. otherwise mark the item `degraded`, `reference_only`, `blocked`, or `setup_required` as appropriate;
6. continue with another independent safe task when useful rather than idling the whole project.

## Branch and Convergence Rule

All autonomous code changes remain on a feature/integration branch. `main` remains a proposal boundary. For Capability Fabric v2, backend work should originate from the current backend baseline and native iOS/vehicle work from `feature/learning-engine`, converging through controlled integration rather than overwriting one branch with the other.

## YT Öğretisi Development Loop

When a newly learned source reveals a concrete gap:

```text
source evidence
 -> normalize repo/tool/method
 -> verify external identity
 -> compare with current capabilities
 -> create development candidate
 -> security/policy classification
 -> implement safe adapter or reference integration
 -> run acceptance test
 -> register evidence
 -> re-evaluate next gap
```

Unsafe or prohibited vehicle modifications remain reference-only and do not become executable development candidates.

## Stop Conditions

A run stops when any one of these is true:

1. all acceptance criteria for the active subproject pass;
2. the next required action is human-gated;
3. no safe action with useful expected value remains;
4. repeated attempts show the same external blocker and a different safe task is unavailable;
5. the system cannot establish truthful verification evidence.

Stopping must report the exact blocker and the already-completed evidence, not a generic "still working" status.

## Acceptance Criteria for This Loop

The autonomous development loop is not considered implemented until tests demonstrate that:

1. after one successful safe cycle it automatically chooses and starts the next eligible safe task;
2. failed tests prevent false completion;
3. a safe repair can be attempted automatically and re-tested;
4. an independent safe task can proceed when another task is externally blocked;
5. `main` merge, production deploy, secret mutation, spending and destructive operations are never auto-executed;
6. every cycle writes a machine-readable execution/development trace;
7. the user-facing status can show `done`, `failed`, `blocked`, `degraded`, `setup_required`, and `human_gate` distinctly;
8. the loop terminates cleanly when subproject acceptance criteria pass.

## Design Decision

The rule is: **continue automatically inside the safe development envelope; stop only at a real gate or a proven blocker.**

This preserves the user’s requirement that JARVIS actively develops and verifies instead of repeatedly describing what should be done next, while keeping production, secrets, money, destructive actions and high-risk device writes explicitly gated.