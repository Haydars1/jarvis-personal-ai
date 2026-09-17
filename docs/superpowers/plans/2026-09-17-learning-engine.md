# JARVIS Learning Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a safe self-improving JARVIS that learns durable user preferences, source-backed general knowledge and provider reliability while producing clean, readable answers.

**Architecture:** Add an isolated learning service beside the existing chat orchestrator/OS runtime, backed by additive D1 tables. Retrieval happens before provider execution; learning happens asynchronously after responses. The presenter owns user-visible cleanup/structure so diagnostics and encoded URL debris never leak into chat.

**Tech Stack:** Cloudflare Workers, JavaScript ES modules, D1/SQLite, Workers AI, Node test runner, SwiftUI iOS client, static PWA.

**Spec:** `docs/superpowers/specs/2026-09-17-learning-engine-design.md`

## Global Constraints
- No autonomous production source-code, credential, prompt, or model-weight modification by the learning engine.
- External knowledge is promoted only with provenance; time-sensitive knowledge carries freshness metadata.
- Never persist secrets/tokens/passwords or sensitive personal categories.
- Learning failures never block chat.
- Schema changes are additive and existing `memories` / `provider_metrics` remain compatible.
- Internal timeout/search/provider diagnostics stay out of assistant message text.

---

### Task 1: Learning policy and tests
**Files:** Create `src/application/learning/policy.js`, `tests/learning-policy.test.js`; modify `package.json`.
**Interfaces:** `classifyLearningDomain(text)`, `isSensitiveMemory(text)`, `normalizeMemoryText(text)`, `knowledgeFreshness(domain,text)`, `scoreProviderDomain(metric)`.
- [ ] Write failing Node tests for domains, sensitive-memory rejection, normalization, freshness and scoring.
- [ ] Run `node --test tests/learning-policy.test.js` and verify RED.
- [ ] Implement pure deterministic policy functions and add syntax check.
- [ ] Run focused test and `npm run check`; verify GREEN.
- [ ] Commit `feat: add learning policy primitives`.

### Task 2: Additive D1 learning persistence
**Files:** Create `src/application/learning/repository.js`, `tests/learning-repository.test.js`; modify the active additive schema/migration SQL discovered from CI.
**Interfaces:** `recordLearningEvent`, `upsertKnowledge`, `findKnowledge`, `recordProviderDomainOutcome`, `getProviderDomainMetrics`, `upsertPersonalMemory`.
- [ ] Locate the exact active schema path referenced by Actions.
- [ ] Write failing fake-D1 repository contract tests for provenance/confidence/freshness/dedupe.
- [ ] Verify RED.
- [ ] Add `learning_events`, `knowledge_memories`, `provider_domain_metrics` additively and implement bounded repository functions.
- [ ] Run tests and `npm run check`; verify GREEN.
- [ ] Commit `feat: add learning persistence`.

### Task 3: Personal and knowledge learning service
**Files:** Create `src/application/learning/service.js`, `tests/learning-service.test.js`; modify `src/application/os/runtime.js`.
**Interfaces:** `retrieveLearningContext(env,text)`, `learnFromInteraction(env,{userText,assistantText,provider,researchResults,outcome})`.
- [ ] Write failing tests proving sensitive facts are discarded, corrections/preferences persist, source-backed research may become knowledge, unsourced model prose may not, conflicts are retained/superseded, and failures never throw into chat.
- [ ] Verify RED.
- [ ] Implement bounded Workers-AI extraction plus deterministic filters and bridge existing `rememberAsync` compatibly.
- [ ] Run tests and `npm run check`; verify GREEN.
- [ ] Commit `feat: learn personal and sourced knowledge`.

### Task 4: Domain-aware provider failure learning
**Files:** Modify `src/lib/orchestration.js`, `src/application/chat/smart-router.js`, `src/application/chat/orchestrator.js`; create `tests/provider-domain-learning.test.js`.
- [ ] Write failing tests: timeout/empty penalizes only the relevant domain, success improves score, deterministic fallback remains.
- [ ] Verify RED.
- [ ] Add bounded domain-score adjustment to existing routing and asynchronously record success/failure/latency.
- [ ] Run tests and `npm run check`; verify GREEN.
- [ ] Commit `feat: adapt provider routing from outcomes`.

### Task 5: Learning context in chat
**Files:** Modify `src/application/chat/orchestrator.js`, `src/app-entry.js`; create `tests/chat-learning-context.test.js`.
- [ ] Write failing tests for relevant-only bounded context, stale-knowledge exclusion on current questions, and non-blocking post-response learning.
- [ ] Verify RED.
- [ ] Compose learning explicitly; inject compact context before provider execution; use guarded `ctx.waitUntil` after response.
- [ ] Run tests and `npm run check`; verify GREEN.
- [ ] Commit `feat: integrate learning context into chat`.

### Task 6: Clean/readable response presenter
**Files:** Modify `src/application/chat/presenter.js`, `public/app.js`, active PWA stylesheet; create `tests/presenter-readability.test.js`.
- [ ] Write failing tests for `JARVIS LIVE SEARCH: EMPTY`, raw timeout/provider diagnostics and `%2D...&rut=` debris, plus negative cases preserving legitimate URLs/code/text.
- [ ] Verify RED.
- [ ] Implement conservative cleanup and paragraph/list normalization.
- [ ] Update PWA paragraph spacing/line-height and newline rendering.
- [ ] Run tests and `npm run check`; verify GREEN.
- [ ] Commit `fix: make JARVIS answers clean and readable`.

### Task 7: Native iOS readability parity
**Files:** Discover and modify the active SwiftUI chat-message view and existing native validation.
- [ ] Locate active renderer/workflow.
- [ ] Add the smallest failing validation proving multiline answer preservation.
- [ ] Adjust SwiftUI multiline/layout spacing.
- [ ] Run native validation/build; verify GREEN.
- [ ] Commit `fix: improve native chat readability`.

### Task 8: Feature flag, observability, docs
**Files:** Modify current application flag/state path, `ARCHITECTURE.md`, relevant tests.
- [ ] Write failing test proving disabled learning leaves chat operational without learning writes.
- [ ] Verify RED.
- [ ] Add default-safe flag and structured counters for learning success/failure, knowledge hit/stale hit and provider-domain outcome.
- [ ] Document boundaries/data flow.
- [ ] Run `npm run check`; verify GREEN.
- [ ] Commit `feat: add safe learning rollout controls`.

### Task 9: CI, Cloudflare and IPA acceptance
- [ ] Inspect new Actions runs for Cloudflare deploy and native iOS validation/build.
- [ ] For failures, inspect steps/logs and fix root cause test-first when code-related.
- [ ] Inspect native artifacts; record exact IPA artifact name/id if produced, otherwise explicitly record that none was packaged.
- [ ] Verify live health from the established workflow.
- [ ] Final diff/spec review: all requirements covered and no uncontrolled self-modification introduced.
