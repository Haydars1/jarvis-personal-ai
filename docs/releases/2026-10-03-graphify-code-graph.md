# Native JARVIS Code Graph — 2026-10-03

JARVIS now owns both the normalized repository graph contract and the default graph producer. Graphify is no longer required for repository dependency/impact analysis, CI verification or runtime code-graph jobs.

## Native engine

The default `npm run graph:build` path uses JARVIS-owned deterministic static analysis under `scripts/code-graph/native/`.

The engine performs bounded repository discovery and extracts supported relationships from:

- JavaScript / TypeScript, using the pinned `@babel/parser` AST parser
- Swift source files
- SQL / D1 schema tables, foreign keys and indexes
- `package.json` scripts
- GitHub Actions workflow `run:` targets
- Wrangler JSONC / TOML entrypoints

The builder does not execute repository source/config files, does not follow repository-external symlinks, enforces deterministic file/count limits and omits unresolved relationships instead of inventing them.

## Provider-independent contract

Consumers continue to use the JARVIS-owned version-1 graph schema and query layer for:

- node/symbol search
- directional dependencies
- shortest dependency paths
- reverse-dependency impact ranking
- freshness-gated repository capabilities

Graph status is tied to the exact source commit. A graph from another commit reports `stale` and cannot advertise current structural capabilities.

## Graphify boundary

Graphify remains optional reference tooling only. A raw Graphify JSON export can be normalized separately with:

```bash
npm run graph:build:graphify -- path/to/graphify.json
npm run graph:compare
```

The reference adapter writes `graphify-out/graphify-code-graph.json`; it cannot overwrite the native `graphify-out/code-graph.json` artifact. No Python/Graphify installation is required by the default build, Cloudflare Worker runtime or required Code Graph CI workflow.

## Verified extraction

GitHub Actions verified the native engine against the JARVIS repository on 2026-10-03.

- PR head tested by full checks: `674ce67a2df6299059fccc00557b730f87c2e842`
- exact PR merge checkout used by Code Graph artifact: `70145931d3e49fa0f82716a44606d6b14d308cb1`
- generator: `jarvis-native`
- graph status: `ready`
- normalized nodes: **5,407**
- normalized edges: **7,761**
- focused Code Graph tests: **73 / 73 passed**
- complete repository Node tests: **248 / 248 passed**
- syntax verification: **114 JavaScript modules passed**
- Cloudflare Worker dry-run: **passed**
- generated graph artifact: uploaded by GitHub Actions, not committed to `main`

## Runtime integration

Cloud code-graph jobs now call the JARVIS-native builder directly and report `engine: jarvis-native`. The Graphify/Python installer path has been removed from runtime graph jobs.

Repository graph capabilities remain additive: existing repository skills do not require a graph, while `code-graph`, `dependency-trace`, `impact-analysis` and `symbol-neighborhood` are exposed only for a current validated graph.

## CI behavior

`.github/workflows/code-graph.yml` now installs Node dependencies, builds the native graph, validates exact-commit freshness, runs the focused graph test suite and uploads the artifact. Python and Graphify are not installed in the required workflow.

The self-update workflow also passed its complete checks and Cloudflare dry-run. Its final merge command was intentionally blocked because PR #94 remains a draft; no main-branch merge or production deployment was performed by this work.
