# MASTER PROMPT — INTEGRATE ECU BRAIN INTO JARVIS

You are working in the existing repository `Haydars1/jarvis-personal-ai`.

The user has approved continuous execution. Do not repeatedly ask permission to continue. Stop only for an irreversible external-account action, a missing secret/credential, or a decision that cannot safely be inferred from the checked-in design.

## READ FIRST

1. `ARCHITECTURE.md`
2. `docs/superpowers/specs/2026-09-17-jarvis-ecu-brain-design.md`
3. `docs/superpowers/plans/2026-09-17-jarvis-ecu-brain-plan.md`
4. `package.json`

## REQUIRED DEVELOPMENT METHOD

Use Superpowers where available:
- test-driven-development
- systematic-debugging
- verification-before-completion
- subagent-driven-development or executing-plans

Follow RED -> GREEN -> REFACTOR. Never claim success without running the relevant tests. Preserve all existing JARVIS behavior.

## PRODUCT REQUIREMENT

Integrate a single persistent ECU Brain into JARVIS.

User experience:
- user uploads ORI/BIN from JARVIS PWA/iOS/chat
- JARVIS accepts the job even if the user's laptop is offline
- control plane stores immutable file metadata and job state
- heavy analysis is dispatched to optional local worker or cloud compute
- result returns to JARVIS with ECU/HW/SW candidates, map candidates, confidence/evidence, history and model version
- later verified calibration/checksum adapters can produce validated MOD artifacts through the same pipeline

Do not build a separate user-facing app. ECU Brain is a JARVIS capability.

## CONTINUOUS RESEARCH / SELF-IMPROVEMENT

This is a core requirement, not a future note.

JARVIS must be able to run scheduled ECU-domain research jobs that ingest allowed/public technical material and user-owned examples. Store every source with provenance and verification state.

Pipeline:
`discover -> ingest -> deduplicate -> extract -> classify -> corroborate/review -> training candidate`

Raw web information is NOT automatically trusted training truth.

Self-improvement pipeline:
`verified examples -> immutable dataset version -> candidate model training -> held-out benchmark -> compare to production -> promote only if better -> rollback available`

Never mutate the production model directly after each job.

## COST / AVAILABILITY RULES

- user's RTX 4070 Laptop is optional compute only; system must work when laptop is OFF
- paid general-purpose LLM APIs are OFF by default for ECU analysis
- Cloudflare remains always-on control plane
- heavy compute is job-driven
- prefer local GPU when available, otherwise cloud worker
- cloud GPU should be provisioned only when necessary where provider supports on-demand workers
- cache identical file/model/config jobs
- use specialized small models for binary work rather than a large LLM

## ARCHITECTURAL RULES

Existing JARVIS architecture is:
`HTTP composition root -> application services -> adapters/infrastructure -> presenter`

Respect it.

- keep ECU application code under `src/application/ecu/`
- keep ECU infrastructure adapters under `src/infrastructure/ecu/`
- heavy Python compute lives under `compute/`
- only compose routes/tools in `src/app-entry.js`
- do not bloat `src/worker.js`
- D1 migrations are additive
- original binaries are immutable
- D1 stores metadata, not large binary payloads
- explicit `unknown`, `unsupported`, `needs_review` states

## FIRST SUPPORTED FAMILY

EDC17C46.

Do not fake broad ECU support. Build measurable capability for the first family, then make the interfaces extensible.

## EXECUTION ORDER

Execute the checked-in plan task-by-task.

At minimum, the first vertical slice must reach:
1. ECU job state machine
2. JARVIS ECU routes/tool
3. artifact metadata/storage abstraction
4. compute worker contract
5. binary fingerprint engine
6. map candidate extraction
7. job dispatch
8. JARVIS status/result rendering
9. provenance-aware research store
10. scheduled research job
11. dataset versioning
12. model benchmark/promotion/rollback

## HARD QUALITY GATES

Never fabricate:
- ECU family identification
- HW/SW identifiers
- map semantics
- checksum algorithms
- calibration safety
- benchmark accuracy

When data is insufficient, return explicit `unknown`/`unsupported`/`needs_review`.

A generated calibration artifact must never reach READY state unless validation and verified checksum support pass.

## ACCEPTANCE

Before calling the feature complete, prove:
- all existing `npm run check` tests still pass
- compute test suite passes
- JARVIS accepts an ECU job while no local worker is online
- cloud/remote worker contract handles a fixture job
- repeated identical job is idempotent/cached
- original artifact remains immutable
- research provenance is retained
- unverified research cannot enter gold dataset
- worse candidate model cannot replace production
- model rollback works
- paid LLM usage remains OFF by default
- no sensitive binary contents are logged

## EXECUTION STYLE

Work continuously. After each task, report briefly what changed and immediately move to the next task. If blocked, state the exact blocker and continue every other non-blocked task.

Start now by checking the current branch/repository state, running the existing baseline tests, then execute Task 1 from the plan.
