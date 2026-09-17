# JARVIS ECU Brain Design

## Goal

Add a persistent ECU/TCU intelligence subsystem to JARVIS so the user can upload an ORI file directly in JARVIS, have it analyzed, and receive ECU/HW/SW identification, map candidates, supported operations, validation results, and later MOD artifacts without depending on the user's laptop being continuously online.

The ECU subsystem must also continuously expand its knowledge base from approved public/owned technical material and improve its models through controlled retraining.

## Existing JARVIS fit

JARVIS already has a Cloudflare Worker composition root, D1-backed jobs/application state, a PWA and native iOS client, and an application-service architecture. ECU Brain must plug into this architecture without turning `src/worker.js` into another monolith.

## Architecture

### Always-on control plane

Cloudflare side remains always available and handles:
- authentication and authorization
- upload session creation
- job metadata/state
- queues and retries
- artifact metadata
- research scheduler state
- dataset/model registry metadata
- chat/tool orchestration

Large binary artifacts are stored outside D1. D1 stores only metadata, hashes, state, provenance, and model/dataset references.

### Compute plane

Heavy binary analysis and ML inference run on an external worker service rather than in Cloudflare Workers. Workers are disposable and job-driven.

Priority:
1. local RTX worker when available
2. cloud CPU worker for lightweight analysis
3. cloud GPU worker for model inference/retraining

The user's laptop is optional capacity, not a dependency.

### JARVIS tool interface

Expose ECU Brain to chat and UI through stable actions:
- `jarvis.ecu.analyze(file)`
- `jarvis.ecu.compare(ori, mod)`
- `jarvis.ecu.jobs.status(jobId)`
- `jarvis.ecu.training.status()`
- `jarvis.ecu.research.status()`

Future calibration operations use the same job interface and validation pipeline.

## Single brain model

Do not create separate applications for Stage, diagnostics, research, and training. Use one ECU Brain with focused internal modules:
- fingerprinting
- binary feature extraction
- map candidate detection
- semantic classification
- knowledge retrieval
- ORI/MOD diff learning
- calibration proposal
- checksum adapters
- validation
- model registry

## Continuous research

JARVIS runs scheduled research jobs that discover and ingest approved/allowed technical information.

Pipeline:
`discover -> fetch/ingest -> deduplicate -> extract claims -> classify -> store provenance -> corroborate/review -> training candidate`

Source types may include:
- public technical documentation
- public educational articles
- public video transcripts
- public forum/tutorial text
- open-source repositories
- user-owned files and ORI/MOD examples

No web claim becomes gold training data merely because it was found online. Every claim keeps source/provenance and a verification state.

## Controlled self-improvement

The production model never mutates after each file.

Loop:
1. research/import creates candidate knowledge
2. verified examples enter a versioned dataset snapshot
3. candidate model trains on scheduled/on-demand compute
4. held-out benchmark compares candidate with current production model
5. worse/equal candidate is rejected
6. better candidate is promoted atomically
7. prior production model remains available for rollback

Track at minimum:
- model version
- dataset version
- feature schema version
- benchmark metrics
- promotion/rejection reason
- rollback target

## Local-first cost behavior

Paid general LLM APIs are not required for normal ECU analysis.
- cache identical file/model/config runs
- use deterministic fingerprints
- use small specialized models for binary tasks
- only provision GPU when jobs require it
- shut down/dispose idle GPU workers where provider supports it
- batch scheduled research/training to reduce cost

## MVP scope

First supported family: EDC17C46.

MVP milestones:
1. upload binary through JARVIS
2. hash/store immutable original
3. create ECU analysis job
4. identify/fingerprint ECU family/HW/SW candidates
5. extract binary/map candidates
6. show confidence/evidence in JARVIS
7. compare ORI/MOD files
8. maintain training examples with provenance
9. schedule continuous research ingestion
10. train/promote/rollback model versions through benchmark gate

Calibration output is enabled only after verified ECU-specific examples/checksum support exist. Unknown/unsupported remains an explicit state; never fabricate support.

## Data model

Additive D1 entities:
- `ecu_files`
- `ecu_jobs`
- `ecu_analysis_results`
- `ecu_map_candidates`
- `ecu_knowledge_sources`
- `ecu_knowledge_claims`
- `ecu_training_examples`
- `ecu_dataset_versions`
- `ecu_model_versions`
- `ecu_benchmarks`
- `ecu_research_runs`

Binary files and model artifacts live in object storage / compute storage, referenced by URI/hash.

## UI

PWA and iOS should expose:
- ECU upload
- current job/progress
- ECU/HW/SW result
- detected map candidates + confidence
- ORI/MOD diff
- research status
- training/model status
- history

Chat should also understand commands such as “Jarvis bu dosyayı analiz et”.

## Acceptance criteria

- JARVIS remains usable if no ECU worker is online.
- ECU job state survives restarts.
- identical input/model/config is idempotent/cached.
- originals are immutable.
- low confidence cannot masquerade as supported.
- research keeps provenance.
- unverified research cannot enter gold dataset.
- a worse candidate model cannot replace production.
- rollback works.
- no paid LLM is required for standard ECU analysis.
