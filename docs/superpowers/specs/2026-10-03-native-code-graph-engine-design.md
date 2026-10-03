# Native JARVIS Code Graph Engine Design

## Objective

Replace Graphify as a required graph producer with a JARVIS-owned, deterministic repository graph engine. JARVIS must be able to build and query its repository graph without a Graphify install, hosted account, paid API, Python runtime, or third-party graph service.

The existing normalized `version: 1` graph contract and query API remain stable so chat routing, dependency tracing, shortest-path lookup, impact analysis, and symbol neighborhood queries continue to work while the producer changes underneath them.

## Current State

The repository already owns the stable graph/query layer in `src/lib/code-graph.js`. Graphify is currently responsible for extraction through `scripts/code-graph/build.mjs` and `.github/scripts/code-graph-job.mjs`, after which its raw result is normalized by `scripts/code-graph/normalize.mjs`.

The runtime chat integration added in PR #93 already routes code-graph questions into bounded read-only jobs. The native engine must therefore replace the graph-building step without forcing the chat/query layers to change.

## Chosen Architecture

Use a JARVIS-owned parser pipeline as the primary graph producer. Keep Graphify only as an optional comparison adapter during transition, then make it removable without any loss of core functionality.

Flow:

```text
Repository checkout
      |
      v
Native file discovery
      |
      +--> JavaScript / TypeScript parser
      +--> Swift structural parser
      +--> SQL schema parser
      +--> workflow/config parser
      |
      v
JARVIS symbol + relationship model
      |
      v
Native graph builder
      |
      v
version-1 code-graph.json
      |
      +--> findGraphNodes
      +--> getGraphNeighbors
      +--> findGraphPath
      +--> rankImpactedFiles
      +--> chat code-graph jobs
```

## Design Principles

1. **Graphify-independent:** normal graph generation and runtime graph jobs must work when Graphify and Python are absent.
2. **JARVIS-owned contract:** consumers continue reading the current normalized graph schema, not parser-specific data.
3. **Deterministic:** the same commit and source tree must produce stable node IDs, edge types, ordering, and stats.
4. **Local/CI only:** graph extraction remains outside the Cloudflare Worker runtime.
5. **Fail closed:** unsupported syntax may degrade graph coverage but must not invent dependencies.
6. **Incremental-ready:** architecture must permit changed-file rebuilds later without changing the public graph contract.
7. **Provenance-aware:** each relationship records how it was derived, for example `AST`, `IMPORT`, `CALL`, `SCHEMA`, or `CONFIG`.

## Native Producer Structure

Create `scripts/code-graph/native/` with small modules rather than one large scanner.

Proposed modules:

- `discover.mjs` — bounded repository file discovery and exclusions.
- `ids.mjs` — deterministic IDs for file, symbol, table, workflow, and relationship targets.
- `javascript.mjs` — JS/TS module, declaration, import/export, and static call extraction.
- `swift.mjs` — Swift import/type/function relationship extraction.
- `sql.mjs` — table, index, foreign-key, and schema-reference extraction.
- `config.mjs` — package/workflow/config file relationships where they materially affect code execution.
- `builder.mjs` — combines parser output, deduplicates nodes/edges, validates the graph, and returns version 1.
- `index.mjs` — public producer entry point.

`src/lib/code-graph.js` remains the query/validation contract and should not become language-parser code.

## File Discovery

The native scanner walks the repository while excluding generated, binary, dependency, secret, and irrelevant directories/files.

Initial exclusions include:

- `.git/`
- `node_modules/`
- `graphify-out/`
- build/dist/cache directories
- environment/secret files such as `.env*`
- binary/media assets
- generated dependency locks as graph sources unless specifically needed for package relationships

Discovery must have file-count and file-size limits to prevent an accidental unbounded scan.

## JavaScript / TypeScript Analysis

JavaScript/TypeScript is the highest-priority parser because most JARVIS runtime code is JavaScript.

The parser should emit:

- one file/module node per source file;
- function/class/method nodes for statically declared symbols;
- `imports` edges from module to resolved local module;
- `exports` / `defines` relationships;
- static `calls` edges when the callee can be resolved safely;
- `references` edges for deterministic local symbol references where confidence is high.

Dynamic runtime constructs that cannot be proven statically must not be guessed. They may be reported as unresolved diagnostics for future improvement.

Use a maintained open-source JavaScript parser library if necessary; JARVIS owns the graph semantics and builder. The design does not require writing a JavaScript grammar from scratch.

## Swift Analysis

The first native Swift parser targets repository structure rather than full compiler semantics:

- imports;
- type declarations (`class`, `struct`, `enum`, `protocol`, `actor`);
- named functions/methods;
- inheritance/conformance relationships;
- same-repository symbol references when deterministic.

A future compiler-grade parser can replace this adapter without altering graph consumers.

## SQL Analysis

The SQL parser emits:

- table nodes;
- column metadata where needed for relationships;
- foreign-key edges;
- index/table relationships;
- references between schema objects.

The initial target is the SQL dialect used by JARVIS/D1. It must tolerate statements it does not understand without fabricating edges.

## Config and Workflow Analysis

Package manifests and GitHub Actions files can create important execution dependencies not visible in JS imports.

Initial relationships include:

- package script -> referenced repository script/file;
- workflow -> script/command file where statically identifiable;
- Wrangler/config -> Worker entrypoint and known repository resources.

Only deterministic repository-local relationships are added.

## Node and Edge Model

Keep the existing graph version 1 schema.

Node example:

```json
{
  "id": "js:src/app-entry.js#function:createApp",
  "kind": "function",
  "name": "createApp",
  "file": "src/app-entry.js",
  "line": 42
}
```

Edge example:

```json
{
  "source": "js:src/app-entry.js#module",
  "target": "js:src/application/code-graph/chat-runtime.js#module",
  "type": "imports",
  "provenance": "AST"
}
```

IDs must be stable across runs when the symbol identity has not changed.

## Build Commands

Change the default commands to the native producer:

- `npm run graph:build` -> native JARVIS engine
- `npm run graph:check` -> existing validation/freshness check
- `npm run graph:query` -> existing query layer
- optional `npm run graph:compare` -> native vs Graphify comparison while Graphify support remains

Graphify-specific extraction becomes opt-in, for example `npm run graph:build:graphify`, and may later be deleted.

## Runtime Job Migration

`.github/scripts/code-graph-job.mjs` must stop installing Graphify automatically.

Runtime graph jobs should:

1. clone/check out the requested repository commit as today;
2. call the native producer;
3. validate `source_commit` freshness;
4. execute the existing query operation;
5. return the same result shape expected by the chat presenter.

The result `engine` field changes from `graphify` to `jarvis-native`.

No Python installation should be required on this path.

## Optional Graphify Comparison Mode

During migration, keep Graphify only as a non-blocking comparison tool.

Comparison reports may measure:

- node count differences;
- edge count differences;
- local module import coverage;
- symbol coverage;
- impact-analysis overlap.

A mismatch must not block the native engine by default. Graphify is evidence for improving the native parser, not a runtime dependency.

After native acceptance criteria are met, the Graphify comparison workflow can be disabled or removed.

## Failure Handling

- Parser failure for one file: record diagnostic and continue other files unless graph integrity is compromised.
- Unsupported language: skip with diagnostic, never invent edges.
- No valid repository nodes: graph build fails.
- Nodes but no relationships in a non-trivial repository: mark build degraded or fail according to fixture expectations.
- Graph validation failure: do not publish artifact or run impact/path queries.
- Source commit mismatch: graph remains `stale` and capabilities are not advertised as current.

## Security and Resource Limits

The native producer is read-only.

It must never:

- execute repository source code;
- run package install hooks from analyzed repositories;
- source `.env` files;
- evaluate arbitrary config JavaScript;
- follow unbounded symlinks;
- download parser plugins dynamically during a graph job.

Use fixed parser dependencies declared in the JARVIS repository and bounded scan limits.

## Testing Strategy

Add deterministic fixtures for each parser and end-to-end repository fixtures.

Tests must cover:

- stable node IDs and sorted deterministic output;
- JS imports/exports/functions/classes/static calls;
- cyclic module dependencies;
- unresolved/dynamic imports without invented edges;
- Swift imports/types/conformance;
- SQL tables/foreign keys/index relationships;
- workflow/package-script relationships;
- ignored files and secret paths;
- malformed/unsupported source handling;
- exact commit freshness;
- graph validation;
- existing node search/neighbors/path/impact behavior;
- runtime chat graph job using native engine with Graphify absent;
- `npm run check` with no Python and no Graphify.

CI should explicitly prove the native job on a runner where `graphify` is not installed.

## Migration Order

1. Native graph model helpers and deterministic ID utilities.
2. File discovery and exclusions.
3. JavaScript/TypeScript parser and fixtures.
4. Native builder producing the existing graph schema.
5. Native `graph:build` command.
6. Runtime code-graph job migration from Graphify to native.
7. Swift parser.
8. SQL parser.
9. Config/workflow relationships.
10. Full regression/Cloudflare dry-run.
11. Optional native-vs-Graphify comparison report.
12. Remove Graphify as a required CI/runtime dependency.

## Acceptance Criteria

1. `npm run graph:build` succeeds with Graphify and Python absent.
2. The produced artifact passes the existing version-1 validator.
3. Existing find/neighbors/path/impact queries operate unchanged.
4. Runtime chat code-graph jobs report `engine: jarvis-native`.
5. JS local import and module relationships cover the JARVIS runtime source tree deterministically.
6. Swift, SQL, and workflow/config relationships are represented for supported constructs.
7. Exact commit freshness remains enforced.
8. `npm run check` passes without installing or invoking Graphify.
9. Cloudflare Worker bundle does not include parser/runtime graph-generation dependencies.
10. CI proves Graphify-free graph extraction and query execution.
11. Graphify can be deleted or disabled without breaking JARVIS code-graph chat functionality.

## Out of Scope for This Phase

- executing analyzed repository code;
- compiler-perfect resolution of dynamic JavaScript;
- whole-program runtime tracing;
- cross-repository enterprise graph databases;
- formal verification;
- automatic code modification based solely on graph output.

## Success Definition

JARVIS understands its own repository structure through code it owns, and Graphify becomes optional rather than foundational. A user can ask the same dependency, path, symbol, and impact questions even on a machine or CI runner that has never installed Graphify.