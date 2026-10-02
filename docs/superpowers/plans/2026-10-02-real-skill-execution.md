# JARVIS Real Skill Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make repository skills return real results, never treat queued jobs as successful answers, and expose truthful executable-capability status.

**Architecture:** Keep the existing curated repository catalog and cloud runner. Add a bounded skill execution planner/runner in chat orchestration that tries executable candidates in order, polls cloud jobs briefly for completed output, records pending jobs separately, and falls through to the next skill/provider when no concrete result arrives. Extend cloud skill serialization with explicit execution state and a summary endpoint.

**Tech Stack:** Cloudflare Worker, Node.js, D1, GitHub Actions cloud runner, SwiftUI iOS client.

**Spec:** `docs/superpowers/specs/2026-10-02-real-skill-execution-design.md`

## Global Constraints

- Catalog presence is never treated as execution success.
- Only allowlisted/native adapters execute from chat.
- Physical vehicle write/service confirmation gates remain unchanged.
- Ordinary chat must never trigger repository tools.
- Queued/running cloud jobs are metadata, not the user answer.

## Review Focus

- Cloud job remains queued beyond request budget: continue fallback and expose pending metadata.
- First executable skill fails: next compatible skill is attempted.
- Cloud job completes during poll window: completed answer is returned.
- Unverified/catalog-only repository: never executed.
- Normal weather/chat request: no repo skill job created.

---

### Task 1: Concrete-result skill runner

**Files:**
- Create: `src/application/chat/skill-execution.js`
- Modify: `src/application/chat/orchestrator.js`
- Test: `tests/chat-skill-gating.test.js`

**Interfaces:**
- Consumes: discovered skill rows, `canExecuteNativeSkill`, `/api/tools/cloud/jobs`, `/api/tools/cloud/jobs/:id`.
- Produces: `executeSkillPlan(core, req, env, ctx, text, rows, context)` returning `{result,pending,attempts}`.

- [ ] Add failing tests proving queued jobs are not returned as answers, completed cloud jobs are returned, and a failed first skill falls through.
- [ ] Run the focused tests and verify RED.
- [ ] Implement ordered skill execution with bounded polling and pending metadata.
- [ ] Wire chat orchestrator to return only concrete skill results.
- [ ] Run focused tests and full `npm run check` to GREEN.

### Task 2: Truthful execution state and summary

**Files:**
- Modify: `src/application/capabilities/cloud-execution.js`
- Test: `tests/cloud-capability-execution.test.js`

**Interfaces:**
- Produces: computed `execution_state`, `execution_reason` on skill rows and authenticated `GET /api/tools/skills/execution-summary`.

- [ ] Add failing tests for catalog/learned/adapter-ready/executable/degraded counts.
- [ ] Run focused tests and verify RED.
- [ ] Implement execution-state computation and summary endpoint.
- [ ] Run focused tests and full `npm run check` to GREEN.

### Task 3: iOS truthful capability status

**Files:**
- Modify: `ios/JARVIS/JarvisAPI.swift`
- Modify: the existing capability/status view that shows repository readiness.
- Test: existing native validation + Swift compile gate.

**Interfaces:**
- Consumes: `/api/tools/skills/execution-summary`.
- Produces: user-visible counts for executable/degraded/catalog skills instead of raw repository count.

- [ ] Add model/API parsing for execution summary.
- [ ] Replace any raw repo-ready label with truthful executable counts.
- [ ] Run native validation and simulator compile.
- [ ] Build consolidated unsigned IPA artifact.
