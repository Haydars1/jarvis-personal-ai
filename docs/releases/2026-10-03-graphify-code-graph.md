# Graphify / Code Graph integration — 2026-10-03

JARVIS now owns a provider-independent repository graph contract and deterministic query layer for node search, directional dependencies, shortest paths and reverse-dependency impact ranking.

Graphify is optional and limited to development/CI extraction. The Cloudflare Worker has no Python/Graphify runtime dependency. Generated graphs are commit-bound; stale graphs cannot expose current graph capabilities. If Graphify becomes unavailable or paid-only for required functionality, a native producer can target the same schema.

Validation: focused Node tests cover graph validation, freshness, cycles, disconnected paths, impact ranking, normalizer shape/provenance and capability freshness. The dedicated GitHub Actions workflow attempts real Graphify extraction and uploads diagnostic artifacts without auto-committing to main.
