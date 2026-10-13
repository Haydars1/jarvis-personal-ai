# REA research adapter — JARVIS (disabled by default)

Source: https://github.com/morluto/rea (MIT for REA-authored code; third-party dependencies retain separate licenses).

## Integration boundary

REA is an optional, **local** reverse-engineering MCP/CLI tool. It is not bundled, installed, executed, or exposed to the Cloudflare Worker by this change. The Worker must never run user-uploaded executables or grant arbitrary process execution. The existing ECU binary inspector remains the default for safe BIN/HEX byte comparison.

## Approval gates before any future activation

1. Pin an audited upstream commit and dependency lockfile; inspect licenses, install scripts, network calls, filesystem writes, and process execution paths.
2. Require explicit per-session opt-in and an isolated, least-privilege local process with no production secrets.
3. Allow only authorized input files; do not analyze proprietary third-party binaries without authorization.
4. Capture evidence, tool version, SHA-256 of inputs and limitations; never label map locations or ECU compatibility as verified without independent evidence.
5. Keep native decompilers (Ghidra/Hopper/IDA), hardware drivers and device write operations outside the Worker. No automatic download, setup, Windows installation or paid tools.
6. Add mocked contract tests and a rollback/disable switch before considering any runtime integration.

Status: **research-only / not installed / not connected**. This document is a review gate, not a claim of working REA integration.
