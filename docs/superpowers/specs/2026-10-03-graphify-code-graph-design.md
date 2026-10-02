# Graphify Code Graph Integration Design

## Objective

Add a persistent repository knowledge-graph layer to JARVIS so coding agents can answer structural questions, trace dependencies, and estimate change impact without repeatedly re-reading the repository.

The integration must not make JARVIS dependent on a paid Graphify plan. The preferred engine is the open-source, local Graphify CLI. If Graphify later requires payment for a needed capability, becomes unavailable, or cannot run reliably in CI, JARVIS will fall back to its own graph builder/query layer with the same internal contract.

## Current architecture context

JARVIS already has:

- repository metadata and integration state in `src/lib/repository-integrations.js`
- repository skill compilation in `src/lib/repo-skill-compiler.js`
- capability execution and routing under `src/application/capabilities/`
- GitHub Actions workflows under `.github/workflows/`
- Node test and syntax validation through `npm run check`
- Cloudflare Worker production runtime composed through `src/app-entry.js`

The code graph must remain outside the hot Cloudflare Worker build path. Graph generation belongs to development/CI, while the Worker may consume only compact generated artifacts or query results when explicitly needed.

## Design principles

1. **Local-first and free-first**
   - Use the Apache-2.0 open-source Graphify engine where practical.
   - No hosted Graphify account is required for baseline operation.
   - No paid API key is required to map code-only repositories.

2. **Provider independence**
   - JARVIS code must depend on a small internal graph contract, not directly on Graphify-specific JSON everywhere.
   - Graphify is an adapter/producer, not the source of truth for JARVIS application logic.

3. **Deterministic code analysis**
   - Prefer AST/import/call relationships over model-generated guesses for code structure.
   - Preserve provenance metadata when available (`EXTRACTED`, `INFERRED`, source file/line).

4. **No production-runtime bloat**
   - Python/Graphify is never installed into the Cloudflare Worker runtime.
   - Graph generation runs in GitHub Actions or a developer/local runner.

5. **Graceful fallback**
   - If Graphify cannot execute, the pipeline reports `degraded` rather than pretending graph coverage is current.
   - A native JARVIS graph builder can later replace or supplement Graphify without changing consumers.

## Architecture

### 1. Graph producer adapter

Create a script layer under `scripts/code-graph/` that owns graph generation.

Primary path:

`repository checkout -> Graphify CLI -> graphify-out/graph.json -> normalized JARVIS graph artifact`

The adapter is responsible for:

- detecting whether Graphify is installed/available
- running Graphify against the repository root
- validating output existence and JSON shape
- capturing generator/version/timestamp/commit metadata
- normalizing Graphify output into a stable JARVIS schema
- returning explicit status: `ready`, `degraded`, or `unavailable`

### 2. Stable JARVIS graph schema

Create a generated artifact such as `data/code-graph.json` with this conceptual shape:

```json
{
  "version": 1,
  "generator": "graphify",
  "source_commit": "<git sha>",
  "generated_at": "<iso timestamp>",
  "status": "ready",
  "nodes": [],
  "edges": [],
  "stats": {
    "nodes": 0,
    "edges": 0
  }
}
```

Node fields should include stable ID, kind, label/name, file path and optional source location.

Edge fields should include source ID, target ID, relationship type and provenance when available.

Consumers must read this normalized format, not raw Graphify output.

### 3. Query/impact service

Add a focused library, proposed path `src/lib/code-graph.js`, exposing pure functions such as:

- `getCodeGraphStatus(graph)`
- `findGraphNodes(graph, query, options)`
- `getGraphNeighbors(graph, nodeId, options)`
- `findGraphPath(graph, fromId, toId, options)`
- `rankImpactedFiles(graph, changedFiles, options)`

These functions operate only on the normalized artifact and remain Graphify-independent.

Initial implementation should avoid adding a graph database. The repository is small enough for an in-memory JSON graph and deterministic traversal.

### 4. Repository capability integration

Extend the existing repository capability layer so JARVIS can expose graph availability as repository intelligence, rather than introducing a parallel subsystem.

Expected capabilities include:

- `code-graph`
- `dependency-trace`
- `impact-analysis`
- `symbol-neighborhood`

`repo-skill-compiler.js` may treat these as available only when a validated graph artifact exists for the current source commit.

Stale graph artifacts must not be reported as current.

### 5. CI workflow

Add a dedicated workflow such as `.github/workflows/code-graph.yml`.

The workflow should:

1. check out the repository
2. install a pinned compatible Python/Graphify version
3. build the local code graph
4. normalize and validate it
5. run code-graph tests
6. upload generated graph files as workflow artifacts

The first version should **not** automatically commit generated graph files back to `main`. This prevents noisy self-mutating commits and keeps deployment independent of Graphify availability.

A later step may deliberately publish a compact graph snapshot if JARVIS needs runtime access to it.

### 6. Local developer commands

Add package scripts that wrap the implementation, for example:

- `npm run graph:build`
- `npm run graph:check`
- `npm run graph:query -- ...`

The wrapper may call Python/Graphify when present and must produce a clear actionable error when the local prerequisite is missing.

### 7. Native fallback path

If Graphify becomes paid-only for needed functionality or technically unsuitable, JARVIS will keep the same normalized schema and replace the producer with a native implementation.

Native fallback scope:

- parse JS/MJS imports and exports
- parse Swift imports/types/references where feasible
- parse SQL schema entities and references
- map files, modules, symbols, imports/calls and schema relationships
- compute reverse dependencies and impacted-file ranking

A native fallback does **not** need to reproduce Graphify's hosted enterprise features such as formal verification, team memory, RBAC, or cross-repository enterprise indexing.

## Data flow

### Build time

`Git checkout -> Graph producer -> Raw Graphify output -> Normalizer -> Validation -> JARVIS graph artifact -> Tests/artifact upload`

### Query time

`JARVIS coding/repository request -> code-graph service -> normalized graph -> structural result with source paths/provenance`

The chat/orchestration layer may use graph results as evidence but should not expose hidden reasoning traces.

## Failure behavior

- Graphify CLI missing locally: local graph command exits non-zero with install guidance; normal JARVIS app/test/deploy remains usable unless graph-specific checks are explicitly invoked.
- Graphify CI install fails: graph workflow fails independently; production deployment is not blocked by default.
- Output malformed: normalization fails and marks the graph unavailable.
- Graph source commit differs from repository HEAD: status is `stale`; impact/dependency claims must not be represented as current.
- Empty graph: treated as invalid for a non-empty repository.

## Security and privacy

- Code-only analysis should remain local/CI and deterministic.
- No JARVIS secrets, credentials or runtime environment dumps may be added to graph inputs.
- `.env`, secret stores, build output and credential files must remain excluded.
- Hosted Graphify/MCP is optional and not required for baseline functionality.

## Testing strategy

Add focused Node tests for the stable JARVIS graph contract:

- normalized graph validation
- stale/current commit detection
- node search
- neighbor traversal
- shortest dependency path
- reverse-dependency impact ranking
- malformed/empty graph handling

The integration must keep `npm run check` passing.

A small fixture graph should be committed under `tests/fixtures/` so core graph behavior is testable without Python or Graphify installed.

Graphify CLI execution itself should be verified by the dedicated CI workflow rather than making every Node test depend on Python.

## Acceptance criteria

The feature is complete when:

1. JARVIS can build a local Graphify code graph without a hosted/paid Graphify account.
2. Raw Graphify output is normalized behind a JARVIS-owned schema.
3. JARVIS can answer deterministic node, neighbor, path and impacted-file queries from the normalized graph.
4. Graph freshness is tied to the exact source commit and stale graphs are clearly rejected or marked stale.
5. `npm run check` still passes without Graphify installed.
6. A dedicated CI job proves the actual Graphify extraction path works.
7. Cloudflare production runtime does not gain a Python or Graphify runtime dependency.
8. The architecture permits replacing Graphify with a native JARVIS graph producer without changing query consumers.

## Out of scope for this phase

- paid Graphify Enterprise features
- hosted Graphify account dependency
- automatically mutating `main` with generated graph snapshots
- graph database infrastructure
- cross-repository enterprise indexing
- formal verification/proof features

## Implementation direction

Preferred implementation order:

1. stable schema + pure query library + fixtures/tests
2. Graphify producer/normalizer script
3. package scripts
4. CI workflow
5. repository capability/status integration
6. end-to-end verification

This order ensures JARVIS owns the interface before it depends on any external graph generator.
