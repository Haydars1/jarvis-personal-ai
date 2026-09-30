# JARVIS Full Source Pool Design

## Goal
JARVIS must not stop at storing GitHub links or metadata. Every curated/public repository selected from the capability catalogs and the uploaded OBD/ECU PDFs must be physically cloned onto an execution node into a persistent third-party source pool. JARVIS can then inspect, index, adapt and invoke compatible tools locally without depending on paid AI APIs for those capabilities.

## Storage model
The main JARVIS repository keeps only manifests, policy and sync/runtime code. Third-party repositories are cloned into a separate persistent directory (default: `~/.jarvis/third_party`) so the main repository is not inflated by gigabytes of vendored code and copyleft projects are not silently redistributed as JARVIS source.

Each source gets its own directory and a manifest record containing the requested repo identity, canonical GitHub identity when redirects/renames occur, local path, checked-out commit SHA, sync status, category, execution target, admission status, auto-execution policy and timestamps.

## Sync behavior
`npm run sources:sync` performs real `git clone` / `git fetch` operations. Clones are shallow (`--depth 1`), single-branch, no tags, no submodules and `GIT_LFS_SKIP_SMUDGE=1` so model weights and large LFS assets are not downloaded automatically. Existing clones are updated in place and reset to the fetched remote HEAD. Failures are recorded per-repository without discarding successful clones.

The source pool imports the complete curated capability set, including both uploaded OBD/Chip-Tuning PDFs. The two OBD PDFs contain 78 unique repositories in total. Downloading source is separate from executing it: sensitive firmware-writing/calibration tools may be present in the pool but remain `autoExecute:false` until an explicit adapter and confirmation path is available.

## Execution boundary
Downloaded repositories are not automatically trusted or executed. JARVIS selects executable tools only when admission/licence/runtime checks and an adapter permit it. Catalog-only/quarantine repositories can still be cloned for indexing and research but never become automatic execution candidates.

## Runtime integration
The local execution node advertises source-pool state to JARVIS. Capability routing can prefer an installed local/open-source adapter before external API providers. Missing tools can be synced on demand; installed tools are referenced by pinned commit SHA.

## Verification
Tests must prove that all 78 unique OBD PDF repositories are represented, the source sync script contains real clone/fetch behavior, LFS/submodules are disabled by default, manifests pin commit SHAs, and package scripts expose source-pool sync. CI validates syntax and policy but does not vendor all third-party source into the main repository.
