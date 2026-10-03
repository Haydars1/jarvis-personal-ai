# Native JARVIS Code Graph Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Graphify as the required repository graph producer with a deterministic JARVIS-owned native graph engine while preserving the existing version-1 graph/query/chat contract.

**Architecture:** Add a bounded native scanner under `scripts/code-graph/native/` that discovers repository files, parses supported languages/configs, emits stable nodes/edges, and feeds the existing validator/query layer in `src/lib/code-graph.js`. Runtime graph jobs switch to the native producer and report `engine: jarvis-native`; Graphify remains opt-in comparison only and can later be removed.

**Tech Stack:** Node.js ESM, Node test runner, `@babel/parser` as a fixed dev dependency for JS/TS parsing, filesystem/path APIs, existing JSON graph contract, existing GitHub Actions workflows.

**Spec:** `docs/superpowers/specs/2026-10-03-native-code-graph-engine-design.md`

## Global Constraints

- `npm run graph:build` must succeed with Graphify and Python absent.
- Existing version-1 graph schema and query API remain stable.
- Graph extraction stays outside the Cloudflare Worker runtime.
- Repository source code must never be executed during scanning.
- `.env*`, dependencies, binaries, build outputs, generated graph output, and unbounded symlinks must not be scanned.
- Unsupported/dynamic syntax may reduce coverage but must not invent dependencies.
- Stable source tree + commit must produce stable node IDs, edge ordering, and stats.
- Exact `source_commit` freshness validation remains mandatory.
- Runtime graph jobs must report `engine: jarvis-native`.
- Graphify is optional comparison tooling only; normal checks/runtime must not install or invoke it.

## Review Focus

- Dynamic imports/calls that cannot be resolved statically must be omitted and surfaced only as diagnostics, never fabricated.
- Symlinks and oversized/unbounded repository trees must stay within scan limits and never escape the repository root.
- Duplicate symbol names across files/scopes must still receive deterministic unique IDs and correct edges.
- Malformed JS/TS/Swift/SQL/config files must degrade only their own coverage and must not corrupt the whole graph unless graph integrity becomes invalid.
- Windows/POSIX path differences must normalize to repository-relative `/` paths so IDs and freshness behavior stay deterministic.

---

### Task 1: Native graph primitives and deterministic IDs

**Files:**
- Create: `scripts/code-graph/native/ids.mjs`
- Create: `scripts/code-graph/native/model.mjs`
- Create: `tests/native-code-graph-model.test.js`

**Interfaces:**
- Produces: `normalizeRepoPath(path) -> string`, `fileNodeId(file) -> string`, `symbolNodeId(language,file,kind,name,scope?) -> string`, `createNode(input) -> node`, `createEdge(input) -> edge`, `finalizeGraph(parts, metadata) -> version-1 graph`.

- [ ] **Step 1: Write failing tests** for stable IDs, duplicate symbol scopes, POSIX/Windows path normalization, deterministic node/edge sorting, and version-1 validation.
- [ ] **Step 2: Run** `node --test tests/native-code-graph-model.test.js`; expect failures because native model modules do not exist.
- [ ] **Step 3: Implement** the exact interfaces above with deterministic lexical sorting and `validateCodeGraph()` before return.
- [ ] **Step 4: Re-run** the focused test; expect PASS.
- [ ] **Step 5: Commit** `feat: add native code graph model primitives`.

### Task 2: Bounded repository discovery

**Files:**
- Create: `scripts/code-graph/native/discover.mjs`
- Create: `tests/native-code-graph-discovery.test.js`
- Create fixtures under: `tests/fixtures/native-graph/discovery/`

**Interfaces:**
- Consumes: `normalizeRepoPath()` from Task 1.
- Produces: `discoverRepositoryFiles(root, options?) -> { files, diagnostics }` where files are repo-relative paths.

- [ ] **Step 1: Write failing tests** for `.git`, `node_modules`, `graphify-out`, `dist/build/cache`, `.env*`, binary/media exclusion, symlink escape rejection, max file count, max file size, and deterministic ordering.
- [ ] **Step 2: Run** `node --test tests/native-code-graph-discovery.test.js`; expect FAIL.
- [ ] **Step 3: Implement** bounded recursive discovery with default limits and no source execution.
- [ ] **Step 4: Re-run** focused test; expect PASS.
- [ ] **Step 5: Commit** `feat: add bounded native graph file discovery`.

### Task 3: JavaScript and TypeScript parser

**Files:**
- Create: `scripts/code-graph/native/javascript.mjs`
- Create: `tests/native-code-graph-javascript.test.js`
- Create fixtures under: `tests/fixtures/native-graph/javascript/`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: file contents + Task 1 ID/model helpers.
- Produces: `analyzeJavaScriptFile({ file, source, resolveLocalModule }) -> { nodes, edges, diagnostics }`.

- [ ] **Step 1: Add `@babel/parser` as a fixed dev dependency** with JS, JSX, TypeScript, and modern syntax support; do not add it to Worker runtime imports.
- [ ] **Step 2: Write failing tests** for local imports/exports, functions, classes, methods, static calls, cycles, duplicate names, dynamic import omission, malformed source diagnostics, and unresolved external packages.
- [ ] **Step 3: Run** `node --test tests/native-code-graph-javascript.test.js`; expect FAIL.
- [ ] **Step 4: Implement** AST extraction and repository-local module resolution; emit only high-confidence calls/references.
- [ ] **Step 5: Re-run** focused test; expect PASS.
- [ ] **Step 6: Commit** `feat: add native JavaScript TypeScript graph parser`.

### Task 4: Native builder and default graph build command

**Files:**
- Create: `scripts/code-graph/native/builder.mjs`
- Create: `scripts/code-graph/native/index.mjs`
- Create: `tests/native-code-graph-builder.test.js`
- Modify: `scripts/code-graph/build.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: Tasks 1-3 discovery/parser output.
- Produces: `buildNativeCodeGraph({ root, sourceCommit, generatedAt? }) -> graph` and CLI output `graphify-out/code-graph.json` for compatibility with existing query tooling.

- [ ] **Step 1: Write failing tests** proving native builder succeeds with no `graphify` executable, writes `generator: "jarvis-native"`, preserves exact commit freshness, produces non-empty deterministic edges on a fixture repo, and fails on an empty/non-trivial relationship-less graph according to fixture expectations.
- [ ] **Step 2: Run** `node --test tests/native-code-graph-builder.test.js`; expect FAIL.
- [ ] **Step 3: Implement** builder composition and change `npm run graph:build` to native.
- [ ] **Step 4: Keep** existing `graph:check` and `graph:query` behavior unchanged against the new artifact.
- [ ] **Step 5: Re-run** builder tests plus `tests/code-graph*.test.js`; expect PASS.
- [ ] **Step 6: Commit** `feat: make JARVIS native graph builder the default`.

### Task 5: Runtime graph job migration

**Files:**
- Modify: `.github/scripts/code-graph-job.mjs`
- Modify: `.github/scripts/cloud-tool-runner.mjs` only if import/call wiring requires it.
- Modify: `tests/code-graph-runtime-query.test.js`
- Create: `tests/native-code-graph-job.test.js`

**Interfaces:**
- Consumes: `buildNativeCodeGraph()` from Task 4.
- Produces: existing query result shapes with `engine: "jarvis-native"`.

- [ ] **Step 1: Write failing tests** proving runtime job never calls `pip`, `python`, or `graphify`; status/find/neighbors/path/impact continue returning the same fields; malformed files degrade safely.
- [ ] **Step 2: Run** focused runtime graph tests; expect FAIL on current Graphify-backed implementation.
- [ ] **Step 3: Replace** `ensureGraphify()` and Graphify extraction with the native builder while preserving query execution logic.
- [ ] **Step 4: Re-run** focused runtime tests; expect PASS.
- [ ] **Step 5: Commit** `feat: run code graph jobs on JARVIS native engine`.

### Task 6: Swift structural parser

**Files:**
- Create: `scripts/code-graph/native/swift.mjs`
- Create: `tests/native-code-graph-swift.test.js`
- Add fixtures under: `tests/fixtures/native-graph/swift/`
- Modify: `scripts/code-graph/native/builder.mjs`

**Interfaces:**
- Produces: `analyzeSwiftFile({ file, source }) -> { nodes, edges, diagnostics }`.

- [ ] **Step 1: Write failing tests** for imports, class/struct/enum/protocol/actor declarations, named functions/methods, inheritance/conformance, duplicate names, and malformed source diagnostics.
- [ ] **Step 2: Run** focused Swift tests; expect FAIL.
- [ ] **Step 3: Implement** conservative structural parsing without executing Swift tooling or source.
- [ ] **Step 4: Integrate** Swift output into builder and re-run tests; expect PASS.
- [ ] **Step 5: Commit** `feat: add native Swift graph parser`.

### Task 7: SQL schema parser

**Files:**
- Create: `scripts/code-graph/native/sql.mjs`
- Create: `tests/native-code-graph-sql.test.js`
- Add fixtures under: `tests/fixtures/native-graph/sql/`
- Modify: `scripts/code-graph/native/builder.mjs`

**Interfaces:**
- Produces: `analyzeSqlFile({ file, source }) -> { nodes, edges, diagnostics }`.

- [ ] **Step 1: Write failing tests** for D1/SQLite `CREATE TABLE`, foreign keys, indexes, table references, unsupported statements, malformed SQL, and duplicate object names.
- [ ] **Step 2: Run** focused SQL tests; expect FAIL.
- [ ] **Step 3: Implement** conservative D1/SQLite structural extraction.
- [ ] **Step 4: Integrate** SQL output into builder and re-run tests; expect PASS.
- [ ] **Step 5: Commit** `feat: add native SQL graph parser`.

### Task 8: Package, workflow, and Wrangler relationship parser

**Files:**
- Create: `scripts/code-graph/native/config.mjs`
- Create: `tests/native-code-graph-config.test.js`
- Add fixtures under: `tests/fixtures/native-graph/config/`
- Modify: `scripts/code-graph/native/builder.mjs`

**Interfaces:**
- Produces: `analyzeConfigFile({ file, source }) -> { nodes, edges, diagnostics }` for `package.json`, `.github/workflows/*.yml|yaml`, and `wrangler.jsonc`.

- [ ] **Step 1: Write failing tests** for package script -> repo script/file, workflow -> local script/action path, Wrangler -> Worker entrypoint, unsafe/evaluated config rejection, and malformed config diagnostics.
- [ ] **Step 2: Run** focused config tests; expect FAIL.
- [ ] **Step 3: Implement** deterministic text/JSON/JSONC/YAML-subset extraction without executing config code.
- [ ] **Step 4: Integrate** into builder and re-run tests; expect PASS.
- [ ] **Step 5: Commit** `feat: add native config and workflow graph parser`.

### Task 9: Graphify becomes optional comparison only

**Files:**
- Move/retain Graphify adapter as: `scripts/code-graph/graphify-build.mjs`
- Retain: `scripts/code-graph/normalize.mjs`
- Create: `scripts/code-graph/compare.mjs`
- Create: `tests/native-code-graph-compare.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces optional commands: `graph:build:graphify`, `graph:compare`.

- [ ] **Step 1: Write failing tests** proving normal graph build/check/query do not invoke Graphify and comparison works from two existing normalized graph files without requiring Graphify at query time.
- [ ] **Step 2: Run** focused comparison tests; expect FAIL.
- [ ] **Step 3: Move** old Graphify build path behind opt-in script and implement a non-blocking comparison report with node/edge/import/symbol/impact overlap metrics.
- [ ] **Step 4: Re-run** focused tests; expect PASS.
- [ ] **Step 5: Commit** `refactor: make Graphify comparison-only`.

### Task 10: CI, full verification, and documentation

**Files:**
- Modify: `.github/workflows/code-graph.yml`
- Modify: `package.json` syntax coverage
- Modify: `ARCHITECTURE.md`
- Modify: `README.md`
- Create: `docs/releases/2026-10-03-native-code-graph-engine.md`

**Interfaces:**
- CI proves native extraction/query execution on Node without installing Python/Graphify.

- [ ] **Step 1: Change Code Graph CI** so primary job installs Node dependencies only, runs `npm run graph:build`, `npm run graph:check`, focused native tests, and uploads the native artifact.
- [ ] **Step 2: Add optional comparison job** only when explicitly dispatched/configured; it must not gate native CI success.
- [ ] **Step 3: Run** `npm run check`; expect all tests PASS with no Graphify/Python installation.
- [ ] **Step 4: Run** `npm run graph:build && npm run graph:check`; expect `generator: jarvis-native`, exact commit `ready`, and non-empty graph stats.
- [ ] **Step 5: Run** Cloudflare `wrangler deploy --dry-run`; expect success and no parser/native graph modules imported into Worker runtime bundle.
- [ ] **Step 6: Inspect diff** for secrets, generated graph artifacts, accidental runtime parser imports, or source-execution paths; expect none.
- [ ] **Step 7: Update docs/release note** with final native node/edge counts, supported parsers, known conservative gaps, and Graphify optional status.
- [ ] **Step 8: Commit** `docs: record native JARVIS graph verification`.
- [ ] **Step 9: Open PR** `feature/native-code-graph-engine -> main`; do not auto-merge until final branch verification/review is complete.

## Final Acceptance Verification

- [ ] `npm run graph:build` succeeds on a runner with neither Python nor Graphify installed.
- [ ] `npm run graph:check` reports the exact current commit as `ready`.
- [ ] `npm run graph:query -- find ...`, neighbors, path, and impact all work on the native artifact.
- [ ] Runtime chat graph jobs report `engine: jarvis-native`.
- [ ] JS/TS, Swift, SQL, package/workflow/Wrangler fixtures all pass.
- [ ] `npm run check` passes in full.
- [ ] Worker/browser integration and Cloudflare dry-run pass.
- [ ] Graphify can be unavailable without breaking any normal JARVIS graph feature.
