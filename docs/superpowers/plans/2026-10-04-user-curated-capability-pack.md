# User-Curated Capability Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add every GitHub repository supplied in the user's screenshot batches to JARVIS as a deduplicated, safety-gated, discoverable capability source that can be learned through the existing repo-skill compiler without falsely advertising unverified execution.

**Architecture:** Keep the screenshot-derived repositories in one focused registry module, merge it into `CURATED_CAPABILITY_SEEDS`, and let the existing repository admission, cloud skill-analysis and capability routing pipeline do the actual learning. Every entry carries a category, execution target and execution policy so unsafe, paid-only, device-only or reference-only tools remain visible without being auto-executed. Existing capability APIs and skill seeding therefore gain the repositories automatically instead of adding one-off adapters for every repo.

**Tech Stack:** Node.js 22, ES modules, Cloudflare Worker runtime, GitHub Actions, node:test.

**Spec:** `docs/superpowers/specs/2026-10-04-jarvis-pro-capability-fabric-design.md`

## Global Constraints

- Work only on `feature/capability-fabric-v2`; do not merge to `main` or deploy production.
- Prefer free/open-source use; mark external paid/API requirements rather than silently spending money.
- Repository catalogue presence is not execution proof.
- Unsafe or high-risk tooling must never become auto-executable merely by appearing in the screenshot list.
- Device-control repositories require an explicit compatible bridge before execution is advertised.
- Keep duplicate repositories deduplicated by case-insensitive `owner/name`.

## Review Focus

- Duplicate screenshot entries must produce one canonical seed.
- Repositories whose own operation needs external credentials/services must remain `external-service` or reference-only until configured.
- Mobile/computer-control tooling must not be presented as usable on the iPhone app unless its host/device prerequisites exist.
- Security/reverse-engineering repositories must be learned as analysis/reference capabilities, not arbitrary code execution.
- The screenshot pack must not replace the existing curated/PDF seeds; it must extend them.

---

### Task 1: Screenshot repository registry

**Files:**
- Create: `src/lib/user-curated-capability-seeds.js`
- Create: `tests/user-curated-capability-seeds.test.js`

**Interfaces:**
- Produces: `USER_CURATED_CAPABILITY_SEEDS: ReadonlyArray<CapabilitySeed>`

- [ ] Write failing tests proving representative repositories from every screenshot batch are present, duplicates are absent, and every entry has category/executionTarget/source.
- [ ] Run the focused test and observe RED because the module does not exist.
- [ ] Implement the registry with the complete screenshot-derived repository set.
- [ ] Run focused test to GREEN.

### Task 2: Merge registry into the capability fabric

**Files:**
- Modify: `src/lib/open-source-capabilities.js`
- Modify: `tests/user-curated-capability-seeds.test.js`

**Interfaces:**
- Consumes: `USER_CURATED_CAPABILITY_SEEDS`
- Produces: `CURATED_CAPABILITY_SEEDS` including base + PDF + user screenshot seeds, deduplicated case-insensitively.

- [ ] Add failing integration assertions that `CURATED_CAPABILITY_SEEDS` contains screenshot seeds exactly once and preserves existing base entries.
- [ ] Observe RED.
- [ ] Merge and deduplicate the arrays.
- [ ] Run focused tests to GREEN.

### Task 3: Execution-policy guardrails

**Files:**
- Modify: `src/lib/user-curated-capability-seeds.js`
- Modify: `tests/user-curated-capability-seeds.test.js`

**Interfaces:**
- Produces per-seed `autoExecute` and optional `restriction` policy used by existing admission/skill-learning code.

- [ ] Add failing assertions for reference-only education, device/desktop prerequisites, external-service configuration and analysis-only reverse-engineering entries.
- [ ] Observe RED.
- [ ] Add explicit policy metadata to the affected seeds.
- [ ] Run focused tests to GREEN.

### Task 4: Full verification

**Files:**
- No production file changes unless a failure exposes a bug.

**Interfaces:**
- Verifies the repository remains compatible with current Worker and capability tests.

- [ ] Run `npm run check` in CI.
- [ ] Run full PR reliability workflow including integration and dry-run bundle validation.
- [ ] Inspect any failures; fix only regressions caused by this change using RED→GREEN.
- [ ] Leave branch unmerged and production undeployed.
