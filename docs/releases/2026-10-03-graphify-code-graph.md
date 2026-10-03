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

- verified code head: `9206d45ecdb075b2aedd57260d1bfd1a001d25ae`
- exact PR merge checkout used by the latest Code Graph artifact: `4c0a3c23b4a2261bc7484f7ad61957d9f00153a2`
- generator: `jarvis-native`
- graph status: `ready`
- normalized nodes: **5,541**
- normalized edges: **7,929**
- focused Code Graph tests: **73 / 73 passed**
- complete repository Node tests: **250 / 250 passed**
- syntax verification: **114 JavaScript modules passed**
- Cloudflare Worker dry-run: **passed**
- Reliability workflow: **all steps passed**, including Worker HTTP/browser integration and Cloudflare bundle validation
- uploaded-PDF repository audit: **214 total; 206 source-verified, 8 metadata-only, 0 unavailable**
- generated graph artifact: uploaded by GitHub Actions, not committed to `main`

The repository audit now safely handles the GitHub Actions repository-scoped token returning HTTP 403 for unrelated public repositories. It falls back to `git ls-remote` for an immutable public HEAD SHA and, when present, hashes a README fetched from that exact SHA on `raw.githubusercontent.com`. Upstream repository code is not executed. If both API and fallback verification fail, the repository remains `unavailable` rather than being reported as verified.

The eight `metadata-only` repositories had an immutable public repository HEAD verified but no supported root README candidate at that commit. None of the 214 repositories were `unavailable` in the final audit.

## Runtime integration

Cloud code-graph jobs now call the JARVIS-native builder directly and report `engine: jarvis-native`. The Graphify/Python installer path has been removed from runtime graph jobs.

Repository graph capabilities remain additive: existing repository skills do not require a graph, while `code-graph`, `dependency-trace`, `impact-analysis` and `symbol-neighborhood` are exposed only for a current validated graph.

## CI behavior

`.github/workflows/code-graph.yml` installs Node dependencies, builds the native graph, validates exact-commit freshness, runs the focused graph test suite and uploads the artifact. Python and Graphify are not installed in the required workflow, and its repository permission is read-only (`contents: read`).

The self-update workflow passed its complete checks and Cloudflare dry-run. Its final merge command is intentionally blocked because PR #94 remains a draft; no manual main-branch merge was performed in this work.

The repository's connected Cloudflare Git integration independently reported automatic production deployments of branch commits during development. Those deployments were not manually triggered by this implementation session.
