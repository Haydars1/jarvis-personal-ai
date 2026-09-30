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
- runtime verification retry uses the canonical deployed Worker hostname `jarvis-personal-ai.haydojarvis.workers.dev`
- skill-first chat routing: a ready learned native skill is attempted before paid/hosted AI providers; repository knowledge/search work is queued directly to the GitHub cloud runner without an AI API call

This marker intentionally triggers the normal main-branch production deployment workflow and the GitHub-hosted cloud skill runner so schema migration, build validation, production smoke checks, and real repository-skill learning can be verified on the merged code.

Additional production routing:
- ECU chat commands such as DTC read, live data, long-coding read and adaptation read are converted to real local-bridge jobs.
- ECU write/service intents are detected but remain confirmation-gated.
- Device-routed replies remain persisted in the ECU channel history.
