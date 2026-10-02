# Graphify Code Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local-first repository knowledge graph to JARVIS that supports dependency tracing and impacted-file analysis without making production dependent on paid Graphify services.

**Architecture:** JARVIS owns a normalized graph schema and pure query library. Graphify is only a build-time producer behind a normalizer, with a future native producer able to replace it without changing graph consumers. Cloudflare Worker production remains free of Python/Graphify runtime dependencies.

**Tech Stack:** Node.js ESM, Node test runner, JSON graph artifacts, Python/Graphify CLI only in local/CI generation, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-03-graphify-code-graph-design.md`

## Global Constraints

- Baseline code-graph functionality must not require a paid Graphify account or hosted Graphify API.
- Graphify/Python must not become a Cloudflare Worker runtime dependency.
- JARVIS consumers must read a JARVIS-owned normalized graph schema, not raw Graphify output.
- Graph freshness must be tied to the exact source commit.
- `npm run check` must pass without Graphify installed.
- Graphify CI failure must not silently report a graph as current.
- Do not auto-commit generated graph snapshots to `main` in this phase.

## Review Focus

- **Stale source commit:** querying a graph built for a different commit must report `stale`, never `ready`; covered in Task 1.
- **Malformed/empty graph:** validation must reject unusable graph artifacts deterministically; covered in Task 1.
- **Cycles and disconnected components:** path and impact traversal must terminate and remain deterministic; covered in Task 2.
- **Graphify absent:** normal JARVIS checks must still pass and graph build must fail with an actionable graph-specific message; covered in Task 3.
- **Graphify output shape drift:** the normalizer must reject unsupported raw shapes instead of inventing relationships; covered in Task 3.

---

### Task 1: Stable graph contract and freshness validation

**Files:**
- Create: `src/lib/code-graph.js`
- Create: `tests/fixtures/code-graph.json`
- Create: `tests/code-graph.test.js`

**Interfaces:**
- Produces: `validateCodeGraph(graph)`, `getCodeGraphStatus(graph, sourceCommit)`, `normalizeGraphNode(node)`, `normalizeGraphEdge(edge)`.
- `getCodeGraphStatus` returns one of `ready`, `stale`, `degraded`, `unavailable`, `invalid`.

- [ ] **Step 1: Write failing contract tests**
  - Add tests named `accepts_valid_version_1_graph`, `rejects_empty_graph`, `rejects_malformed_edges`, `reports_ready_for_matching_commit`, and `reports_stale_for_different_commit`.
  - Assert version `1`, non-empty `nodes` and `edges`, valid node IDs, edge endpoint existence, and exact commit freshness behavior.

- [ ] **Step 2: Run the focused test and verify failure**
  - Run: `node --test tests/code-graph.test.js`
  - Expected: FAIL because `src/lib/code-graph.js` does not exist or exports are missing.

- [ ] **Step 3: Implement the minimal contract**
  - Implement `validateCodeGraph(graph)` to return `{ valid: boolean, errors: string[] }`.
  - Implement `getCodeGraphStatus(graph, sourceCommit)` to reject invalid graphs first, then compare `graph.source_commit` exactly when a source commit is supplied.
  - Implement normalization helpers that preserve `id`, `kind`, `name`, `file`, optional `line`, plus edge `source`, `target`, `type`, optional `provenance`.

- [ ] **Step 4: Run focused tests**
  - Run: `node --test tests/code-graph.test.js`
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - Commit message: `feat: add stable code graph contract`

### Task 2: Pure graph queries and impact analysis

**Files:**
- Modify: `src/lib/code-graph.js`
- Modify: `tests/code-graph.test.js`
- Modify: `tests/fixtures/code-graph.json`

**Interfaces:**
- Consumes: validated normalized version-1 graph from Task 1.
- Produces: `findGraphNodes(graph, query, options={})`, `getGraphNeighbors(graph, nodeId, options={})`, `findGraphPath(graph, fromId, toId, options={})`, `rankImpactedFiles(graph, changedFiles, options={})`.

- [ ] **Step 1: Write failing query tests**
  - Add tests named `finds_nodes_by_name_and_file`, `returns_directional_neighbors`, `finds_shortest_path_with_cycle`, `returns_null_for_disconnected_path`, and `ranks_reverse_dependency_impact`.
  - Fixture must include at least one cycle and one disconnected node.

- [ ] **Step 2: Verify tests fail**
  - Run: `node --test tests/code-graph.test.js`
  - Expected: FAIL on missing query exports.

- [ ] **Step 3: Implement deterministic traversals**
  - Node search: case-insensitive match on `name`, `file`, and `kind`.
  - Neighbor traversal: default direction `both`; support `incoming` and `outgoing`.
  - Path search: breadth-first search with visited set; return ordered node IDs or `null`.
  - Impact ranking: seed nodes whose `file` matches changed files, traverse incoming dependencies, aggregate by file, then sort by descending score and lexical file path for ties.

- [ ] **Step 4: Run focused tests**
  - Run: `node --test tests/code-graph.test.js`
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - Commit message: `feat: add code graph queries and impact analysis`

### Task 3: Graphify producer and normalizer adapter

**Files:**
- Create: `scripts/code-graph/build.mjs`
- Create: `scripts/code-graph/normalize.mjs`
- Create: `tests/code-graph-normalizer.test.js`
- Create: `tests/fixtures/graphify-raw.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: raw Graphify output path, repository root, exact source commit.
- Produces: normalized version-1 JARVIS graph JSON compatible with Task 1.
- `normalizeGraphify(raw, metadata)` returns the normalized graph object.
- `build.mjs` exits non-zero for missing Graphify, unsupported output, or invalid normalized graph.

- [ ] **Step 1: Write failing normalizer tests**
  - Add tests named `normalizes_supported_graphify_shape`, `preserves_source_location_and_provenance`, `rejects_unknown_shape`, and `rejects_empty_graphify_output`.

- [ ] **Step 2: Verify normalizer tests fail**
  - Run: `node --test tests/code-graph-normalizer.test.js`
  - Expected: FAIL because normalizer is missing.

- [ ] **Step 3: Implement the normalizer**
  - Convert supported Graphify nodes/edges to JARVIS version-1 schema.
  - Set `generator: "graphify"`, exact `source_commit`, `generated_at`, `status: "ready"`, and `stats`.
  - Do not synthesize missing relationships.

- [ ] **Step 4: Implement producer wrapper**
  - Detect a Graphify executable without modifying production dependencies.
  - Run Graphify against repository root into a temporary/raw output directory.
  - Normalize output and validate with Task 1 contract before writing `graphify-out/code-graph.json`.
  - Missing executable error must mention that normal JARVIS runtime remains usable and that only graph generation is unavailable.

- [ ] **Step 5: Ignore generated local artifacts**
  - Add `graphify-out/` to `.gitignore`.

- [ ] **Step 6: Run normalizer tests**
  - Run: `node --test tests/code-graph-normalizer.test.js tests/code-graph.test.js`
  - Expected: PASS.

- [ ] **Step 7: Commit**
  - Commit message: `feat: add Graphify graph producer adapter`

### Task 4: Package commands and syntax coverage

**Files:**
- Modify: `package.json`
- Modify: `scripts/check-syntax.mjs` only if its discovery rules require explicit inclusion.
- Create: `scripts/code-graph/query.mjs`
- Modify: `tests/code-graph.test.js` if CLI parsing needs pure helpers.

**Interfaces:**
- Produces commands: `npm run graph:build`, `npm run graph:check`, `npm run graph:query -- <operation> ...`.

- [ ] **Step 1: Add package scripts**
  - `graph:build` invokes `node scripts/code-graph/build.mjs`.
  - `graph:check` validates an existing graph artifact without invoking Graphify.
  - `graph:query` invokes `node scripts/code-graph/query.mjs`.

- [ ] **Step 2: Implement query CLI**
  - Support operations `status`, `find`, `neighbors`, `path`, and `impact` using Task 1/2 library only.
  - Invalid operation exits non-zero with a usage message.

- [ ] **Step 3: Extend syntax coverage**
  - Ensure `npm run check:syntax` parses `src/lib/code-graph.js` and all `scripts/code-graph/*.mjs` files.

- [ ] **Step 4: Verify without Graphify installed**
  - Run: `npm run check:syntax && node --test tests/code-graph.test.js tests/code-graph-normalizer.test.js`
  - Expected: PASS without requiring Python/Graphify.

- [ ] **Step 5: Commit**
  - Commit message: `feat: expose code graph developer commands`

### Task 5: GitHub Actions Graphify verification

**Files:**
- Create: `.github/workflows/code-graph.yml`

**Interfaces:**
- Produces workflow artifact containing raw Graphify output, normalized `code-graph.json`, and validation/test output.

- [ ] **Step 1: Add dedicated workflow**
  - Trigger on `workflow_dispatch`, pull requests that change `src/**`, `ios/**`, `schema.sql`, `scripts/code-graph/**`, `package*.json`, or this workflow, and pushes to non-main feature branches if useful.
  - Checkout exact commit and set up pinned Node and Python versions.

- [ ] **Step 2: Install pinned open-source Graphify dependency**
  - Install only inside the workflow environment; do not add Python to Worker dependencies.
  - Capture Graphify version in job output.

- [ ] **Step 3: Build and validate graph**
  - Run `npm run graph:build`.
  - Run `npm run graph:check`.
  - Run focused graph tests.

- [ ] **Step 4: Upload artifacts**
  - Upload `graphify-out/` even on graph-validation failure where files exist, for diagnosis.
  - Do not commit generated artifacts to `main`.

- [ ] **Step 5: Commit**
  - Commit message: `ci: verify Graphify code graph generation`

### Task 6: Repository capability integration

**Files:**
- Modify: `src/lib/repo-skill-compiler.js`
- Modify: `src/lib/repository-integrations.js`
- Create: `tests/code-graph-capability.test.js`
- Modify: `package.json` syntax command if needed for newly referenced files.

**Interfaces:**
- Consumes: graph status metadata, not raw Graphify format.
- Produces capability IDs `code-graph`, `dependency-trace`, `impact-analysis`, `symbol-neighborhood` only when graph freshness is validated.

- [ ] **Step 1: Write failing capability tests**
  - Add tests named `exposes_graph_capabilities_for_current_graph`, `does_not_expose_graph_capabilities_for_stale_graph`, and `does_not_require_graph_for_existing_repository_skills`.

- [ ] **Step 2: Verify tests fail**
  - Run: `node --test tests/code-graph-capability.test.js`
  - Expected: FAIL on missing graph capability behavior.

- [ ] **Step 3: Add graph capability metadata**
  - Integrate graph status additively; do not replace existing repository detection rules.
  - Stale/degraded/unavailable graph state must be visible as state metadata but must not advertise current structural capabilities.

- [ ] **Step 4: Run focused tests**
  - Run: `node --test tests/code-graph-capability.test.js tests/repo-skill-compiler.test.js tests/repo-skill-registry.test.js`
  - Expected: PASS.

- [ ] **Step 5: Commit**
  - Commit message: `feat: expose code graph repository intelligence`

### Task 7: Whole-branch verification and documentation

**Files:**
- Modify: `ARCHITECTURE.md`
- Modify: `README.md` or `README-TR.txt` only where needed for graph commands.
- Create: `docs/releases/2026-10-03-graphify-code-graph.md`

**Interfaces:**
- No new runtime interface; documents verified behavior and limitations.

- [ ] **Step 1: Update architecture documentation**
  - Document graph generation as CI/dev infrastructure outside the Worker hot path.
  - Document normalized schema ownership and native fallback boundary.

- [ ] **Step 2: Run complete local verification**
  - Run: `npm run check`
  - Expected: PASS without Graphify installed.

- [ ] **Step 3: Verify branch diff**
  - Confirm there are no secrets, generated `graphify-out/` files, Python runtime additions to Worker dependencies, or accidental changes outside the planned scope.

- [ ] **Step 4: Verify actual Graphify workflow**
  - Push branch and inspect `.github/workflows/code-graph.yml` result.
  - If Graphify package/install syntax differs from assumptions, fix only the adapter/workflow and rerun until the dedicated graph job proves real extraction.

- [ ] **Step 5: Write release note**
  - Record exact tested commit, Graphify version, graph node/edge counts, test result, and whether graph status is `ready` or `degraded`.

- [ ] **Step 6: Final commit and PR**
  - Commit message: `docs: record code graph verification`
  - Open a PR from `feature/graphify-code-graph` to `main` without auto-merge.
