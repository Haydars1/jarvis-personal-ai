# JARVIS capability and ECU bridge release

Production release marker for the capability-aware routing and ECU local bridge work merged on 2026-09-29.

Included:
- task-specific AI provider selection with health/quota-aware fallback
- autonomous coding provider pool plus Codex fallback
- Gemini 3.8 Flash and OpenRouter Auto routing
- social campaign cadence parsing (daily / weekly / N-week)
- ECU Studio device status and job controls
- D1-backed ECU device bridge/job queue
- local Node.js ECU bridge polling agent
- explicit bridge capability advertisement before a device job can be claimed

This marker intentionally triggers the normal main-branch production deployment workflow so schema migration, build validation and production smoke checks run on the merged code.


Additional production routing:
- ECU chat commands such as DTC read, live data, long-coding read and adaptation read are converted to real local-bridge jobs.
- ECU write/service intents are detected but remain confirmation-gated.
- Device-routed replies remain persisted in the ECU channel history.
