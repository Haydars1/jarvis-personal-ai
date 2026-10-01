# JARVIS capability and ECU bridge release

Production release marker for the capability-aware routing and ECU local bridge work merged on 2026-09-29 and the repository-skill learning system merged on 2026-09-30.

Included:
- task-specific AI provider selection with health/quota-aware fallback
- autonomous coding provider pool plus Codex and keyless local-coder fallback
- social campaign cadence parsing (daily / weekly / N-week)
- ECU Studio device status and confirmation-gated job controls
- D1-backed ECU device bridge/job queue
- explicit bridge capability advertisement before a device job can be claimed
- GitHub-hosted cloud tool runner so general repository skills do not depend on the user's laptop
- repository skill compiler that learns capabilities from repository structure and documentation without a paid AI API
- persistent D1 repo_skills registry and /api/tools/discover skill discovery
- automatic bounded learning of unlearned curated repositories
- cloud-runner self-seeding: each 5-minute cloud runner pass can enqueue a bounded batch of unlearned repositories using GitHub OIDC, then learn them in the same pass
- immediate main-push trigger for relevant skill/cloud-runner changes and release verification
- native adapter resolver for JARVIS capabilities that already exist
- OIDC-protected native-skill backlog for the autonomous developer
- clean-room skill reimplementation workflow so missing repository capabilities can become JARVIS-native skills without blindly copying third-party source
- runtime verification uses the canonical deployed Worker hostname `jarvis-personal-ai.haydojarvis.workers.dev`
- autonomous native-skill builder now fetches its OIDC backlog from that same canonical production Worker instead of the stale legacy hostname
- skill-builder OIDC authentication trusts only the exact main workflow ref plus the dedicated `test/autonomy-runtime` verification ref, fixing live BACKLOG 401 without allowing wildcard workflow branches
- keyless local coder uses a cached local Qwen2.5 Coder/llama.cpp path before Codex, with a bounded OpenCode attempt and verified unified-diff fallback
- repository skill compiler manifests are now versioned; old or missing compiler versions are automatically requeued for revalidation so classifier improvements repair existing D1 skills
- self-update CI now admits `fix/*` branches in addition to `feature/*` and `jarvis/*`, so bugfix PRs receive the same full test, Cloudflare dry-run and auto-merge gate
- top-level skill-first chat gate: executable ready native skills are attempted before the chat orchestrator starts any hosted AI provider request
- repository knowledge/source-search jobs go directly to the GitHub cloud runner without hosted AI API usage
- ECU/device intents go directly to the existing device bridge; read jobs can queue natively while write/service actions remain confirmation-gated
- unsupported ready skills are skipped so a later executable native skill can still be used before provider fallback
- learned `ecu-binary-inspector` skills now execute deterministically before hosted AI when a BIN/ORI/HEX/ROM attachment is present; the original binary attachment is preserved and routed through the existing byte-level ECU inspector
- learned `social-growth` skills now have a deterministic native draft path: explicit social planning requests create disabled/manual draft campaigns and `draft` queue items without starting chat AI generation, Higgsfield video generation, or Meta publishing

This marker intentionally triggers the normal main-branch production deployment workflow and the GitHub-hosted cloud skill runner so schema migration, build validation, production smoke checks, and real repository-skill learning can be verified on the merged code.

Additional production routing:
- ECU chat commands such as DTC read, live data, long-coding read and adaptation read are converted to real local-bridge jobs.
- ECU write/service intents are detected but remain confirmation-gated.
- Device-routed replies remain persisted in the ECU channel history.
- Binary attachments in normal chat can be claimed by a ready ECU binary learned skill and are re-routed internally to the deterministic ECU inspector before provider fallback.
- Social native drafts are persisted with `enabled=0`, `approval_mode=manual` and queue `status=draft`, so the scheduled social worker ignores them until a separate activation/publishing action is explicitly performed.
