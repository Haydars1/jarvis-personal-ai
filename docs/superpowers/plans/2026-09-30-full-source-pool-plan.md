# Full Source Pool Implementation Plan

1. Import both OBD/ECU PDFs as one deduplicated 78-repository seed set.
2. Extend `CURATED_CAPABILITY_SEEDS` with the OBD seed set while preserving auto-execution restrictions.
3. Add `local-bridge/source-pool-sync.mjs` that performs real shallow git clone/fetch operations into a persistent third-party source root and writes a commit-pinned manifest.
4. Add package scripts and syntax checks for source syncing.
5. Add regression tests for 78/78 PDF coverage, real clone behavior, safe clone flags, manifest generation and sensitive-tool execution gating.
6. Add source-pool state reporting that can be consumed by the local bridge/router in subsequent integration work.
7. Run full checks and Cloudflare dry-run; merge only when green.
