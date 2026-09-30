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
- native adapter resolver for JARVIS capabilities that already exist
- OIDC-protected native-skill backlog for the autonomous developer
- clean-room skill reimplementation workflow so missing repository capabilities can become JARVIS-native skills without blindly copying third-party source

This marker intentionally triggers the normal main-branch production deployment workflow so schema migration, build validation and production smoke checks run on the merged code.

Additional production routing:
- ECU chat commands such as DTC read, live data, long-coding read and adaptation read are converted to real local-bridge jobs.
- ECU write/service intents are detected but remain confirmation-gated.
- Device-routed replies remain persisted in the ECU channel history.
