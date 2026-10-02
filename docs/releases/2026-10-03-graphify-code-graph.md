# Graphify / Code Graph integration — 2026-10-03

JARVIS now owns a provider-independent repository graph contract and deterministic query layer for node search, directional dependencies, shortest paths and reverse-dependency impact ranking.

Graphify is optional and limited to development/CI extraction. The Cloudflare Worker has no Python/Graphify runtime dependency. Generated graphs are commit-bound; stale graphs cannot expose current graph capabilities. If Graphify becomes unavailable or paid-only for required functionality, a native producer can target the same schema.

The verified CI path uses the open-source `graphifyy[sql]==0.9.74` package and `graphify extract ... --code-only --no-cluster`, so baseline repository mapping does not require a hosted Graphify account or paid API key.

## Verified extraction

A real GitHub Actions extraction over the final PR merge candidate completed successfully with:

- 168 code files scanned
- 1,757 raw Graphify nodes
- 4,533 raw Graphify edges
- 1,653 normalized repository-local nodes
- 4,171 normalized repository-local edges
- exact source-commit freshness validation: ready
- generated artifacts uploaded by CI rather than committed to `main`

Source-less external/unresolved Graphify nodes and their edges are deliberately removed during normalization instead of inventing file provenance.

## Validation

Focused Node tests cover graph validation, commit freshness, cyclic and disconnected graphs, deterministic search, directional neighbors, shortest paths, reverse-dependency impact ranking, raw `links`/`edges` compatibility, source-location/provenance normalization, source-less external nodes, CLI stale/invalid exit behavior and repository capability freshness.

The dedicated Code Graph workflow installs the pinned Graphify version, performs real extraction, normalizes the graph, rejects stale/invalid output, runs all focused graph/CLI tests and uploads the generated graph as a workflow artifact. Normal `npm run check`, Cloudflare Worker execution and deployment remain independent of the Graphify Python runtime.
