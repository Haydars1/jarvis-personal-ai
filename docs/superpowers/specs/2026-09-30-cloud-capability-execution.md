# Cloud Capability Execution

## Goal
JARVIS must use curated GitHub capabilities without depending on the user's laptop being online.

## Architecture
- **Cloudflare Worker** remains the always-on control plane: routing, auth, D1 job queue, task planning, results.
- **Worker-native capabilities** (pure JS/WASM/network packages compatible with Workers) are bundled directly into the Worker or exposed through thin adapters.
- **GitHub-hosted cloud runner** is the execution plane for CPU/native/Python/CLI repositories that cannot run inside Workers. It runs on GitHub-hosted runners, not the user's laptop, checks out only the required repo at a pinned SHA, executes an allowlisted adapter command, returns structured results, and discards the VM afterward.
- **GPU-heavy capabilities** are registered as cloud-GPU-required. They are not falsely marked ready on standard GitHub runners; they require a GPU cloud execution backend before activation.
- **Vehicle hardware capabilities** remain device-required. They can be integrated into the system, but physical CAN/J2534/OBD access still needs actual connected hardware somewhere.

## Source handling
Curated repository metadata remains in the capability registry. Source code is fetched in the cloud execution environment when needed and pinned to a commit. The user's laptop is not used for the general capability pool.

## Safety
- No arbitrary shell commands supplied by chat.
- Every executable integration needs an adapter manifest with fixed entrypoint/arguments schema.
- Repository URL and commit are pinned from registry data.
- Unknown/unlicensed/quarantined repos cannot execute automatically.
- ECU write/calibration operations remain confirmation-gated and hardware-bound.

## Migration
1. Remove automatic third-party source sync from `local-bridge/ecu-bridge.mjs`.
2. Keep local source sync only as an optional developer utility, never a required runtime path.
3. Add cloud tool job queue and cloud-runner API.
4. Add GitHub Actions cloud execution workflow.
5. Add adapter manifests progressively by capability, preferring Worker-native adapters first.
