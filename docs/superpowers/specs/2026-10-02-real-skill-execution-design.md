# JARVIS Real Repository Skill Execution Design

## Purpose

JARVIS must use the repository/skill pool to perform useful work, not merely list repositories or claim that a queued job is a completed capability. The user-facing definition of success is a concrete result produced by an executable adapter, with truthful fallback when a candidate cannot run.

## Current problem

The repository catalog, skill compiler and cloud runner exist, but the chat path currently treats some repository skills as successful as soon as a cloud job is queued. Many learned repositories are catalog-visible without a runnable adapter. This makes the pool look more capable than it is and can return internal queue status instead of the requested result.

## Required behavior

1. **Catalog is not execution.** A repository may be discovered or learned without being executable. User-visible readiness requires a verified runnable adapter.
2. **Concrete-result success.** A skill attempt succeeds only when it returns a usable result payload. `queued`, `running`, missing output, timeout or adapter failure are not successful answers.
3. **Sequential capability fallback.** For a task, JARVIS ranks executable candidates and tries them in order within bounded limits. A failed candidate is recorded and the next compatible candidate is attempted. Provider/Workers-AI fallback remains after executable skill attempts.
4. **No ordinary-chat hijacking.** Repository tools only run for matching explicit capability intent. Normal questions such as weather must never route to coding/repository adapters.
5. **Truthful async cloud jobs.** If a GitHub-hosted runner is required and cannot finish within the request budget, JARVIS may create a pending job, but must not present it as the answer. The chat continues to a working fallback. The pending job is exposed separately for later status/result retrieval.
6. **Execution health.** Each learned skill exposes an execution state: `catalog-only`, `learned`, `adapter-ready`, `executable`, or `degraded`, plus a reason. `ready` is not inferred merely from capability-name overlap.
7. **Measured capability report.** JARVIS exposes counts for total curated repositories, learned skills, adapter-ready skills, actually executable skills, degraded skills and recently successful executions. This is the metric used in the app instead of raw repo count.
8. **Safe adapter model.** Third-party repositories are not given arbitrary shell execution from chat. Execution occurs only through verified native adapters or allowlisted cloud-runner adapters with bounded inputs. Existing confirmation gates for physical vehicle actions remain unchanged.
9. **Autonomous adapter growth.** The existing skill-learning/backlog flow may continue converting learned repositories into native adapters, but new adapters are marked executable only after tests/verification pass.
10. **Traceability.** A completed skill result records repository, source commit, adapter, execution lane, duration and outcome. Internal traces may be summarized in diagnostics but should not replace the user answer.

## Architecture

### Execution planner

Add a focused planner that receives discovered skills and request context, filters by `canExecuteNativeSkill`, ranks candidates, and returns an ordered execution plan. It must never select a catalog-only or unverified adapter.

### Execution runner

Add a runner that attempts candidates one by one. Worker-native adapters may return immediately. Cloud-runner adapters may return either a completed result or a pending job. Pending is recorded and the runner continues to the next candidate/fallback rather than claiming success.

### Cloud job result handling

Reuse `cloud_tool_jobs`. Add a compact authenticated status/result endpoint if necessary so the iOS client can retrieve pending job results. `cloudJobAnswer()` remains the canonical conversion of completed cloud results into user-facing text.

### Chat orchestration

Replace the single `find first executable skill -> return queue acknowledgement` behavior with the execution planner/runner. The skill layer returns only on concrete success. Otherwise orchestration proceeds through healthy provider/Workers-AI/base fallback while preserving pending job metadata separately.

### Capability status

Extend skill serialization/discovery with computed execution state and reason. Add an authenticated execution summary endpoint so the app can show how many capabilities are actually usable.

## Initial implementation scope

This increment does not promise that every curated repository becomes executable immediately. It changes JARVIS so that:

- every repository is represented truthfully,
- existing verified adapters are actually tried,
- queued cloud work is no longer mistaken for a finished answer,
- multiple compatible executable skills can be attempted,
- failures fall through automatically,
- executable capability counts are measurable,
- the autonomous adapter pipeline has a clear target state.

Subsequent adapter increments can increase executable coverage without changing this execution contract.

## Verification

Tests must prove:

- ordinary weather chat does not invoke repo-cloud-tools;
- a first skill failure causes the next executable candidate to run;
- a completed skill result is returned immediately;
- a queued cloud job does not become the chat answer;
- provider fallback still answers when all skills fail or remain pending;
- execution summary distinguishes catalog/learned/adapter-ready/executable/degraded;
- unsupported/unverified repositories are never executed;
- existing ECU/device confirmation gates remain intact.

## Acceptance criteria

The feature is accepted only when repository tests pass, production deployment passes, and the iOS build consumes the truthful execution status without presenting raw repository count as runnable capability count.