# JARVIS ECU Brain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Integrate a persistent, always-available ECU Brain into the existing JARVIS architecture with continuous research, versioned training data, controlled retraining, benchmark-gated model promotion, and optional local/cloud compute workers.

**Architecture:** Cloudflare remains the control plane and never depends on the user's laptop. Heavy binary/ML work is performed by job-driven compute workers. JARVIS exposes ECU operations through application services and a single chat/UI tool surface.

**Tech Stack:** Existing Cloudflare Worker/D1/PWA/iOS stack plus object storage, external Python compute worker, specialized ML models, Node tests for Worker behavior, Python tests for compute behavior.

**Spec:** `docs/superpowers/specs/2026-09-17-jarvis-ecu-brain-design.md`

## Global Constraints

- Do not add ECU behavior directly into `src/worker.js` beyond routing/composition.
- All D1 changes are additive migrations.
- Paid LLM APIs are OFF by default for ECU analysis.
- Original binaries are immutable.
- Unknown/unsupported is an explicit state.
- Research claims retain provenance and verification state.
- Only verified examples enter gold training datasets.
- Candidate models must beat production benchmark before promotion.
- Laptop worker is optional; cloud path must work independently.
- Every task is test-first.

---

### Task 1: ECU domain schema and job state machine

**Files:**
- Create: `src/application/ecu/models.js`
- Create: `src/application/ecu/state-machine.js`
- Create: `tests/ecu-state-machine.test.js`
- Create: additive D1 migration for ECU metadata tables

**Produces:**
- stable ECU job states: `QUEUED`, `DISPATCHED`, `RUNNING`, `NEEDS_REVIEW`, `READY`, `FAILED`
- validation that prevents illegal state transitions

### Task 2: ECU application service

**Files:**
- Create: `src/application/ecu/runtime.js`
- Modify: `src/app-entry.js`
- Create: `tests/ecu-runtime.test.js`

**Produces:**
- routes for upload-session metadata, create analysis job, get job status, list history, research status, training status
- no binary analysis inside Worker

### Task 3: Object storage abstraction

**Files:**
- Create: `src/infrastructure/ecu/artifact-store.js`
- Create: `tests/ecu-artifact-store.test.js`
- Modify Wrangler bindings/config as required

**Produces:**
- content-addressed immutable original storage
- signed/controlled artifact references

### Task 4: Compute worker contract

**Files:**
- Create: `compute/pyproject.toml`
- Create: `compute/ecu_worker/contracts.py`
- Create: `compute/tests/test_contracts.py`

**Produces:**
- JSON job input/output schema shared conceptually with Worker
- deterministic run fingerprint

### Task 5: Binary fingerprint engine

**Files:**
- Create: `compute/ecu_worker/fingerprint.py`
- Create: `compute/ecu_worker/features.py`
- Create: `compute/tests/test_fingerprint.py`

**Produces:**
- file hash/size/entropy/string signatures
- ECU family/HW/SW candidates with confidence/evidence

### Task 6: Map candidate extraction

**Files:**
- Create: `compute/ecu_worker/maps.py`
- Create: `compute/tests/test_maps.py`

**Produces:**
- candidate offsets/shapes/endian/value statistics/axis hints
- noise rejection

### Task 7: Worker dispatch and retry

**Files:**
- Create: `src/infrastructure/ecu/compute-dispatch.js`
- Create: `tests/ecu-compute-dispatch.test.js`

**Behavior:**
- prefer available local worker registration when configured
- otherwise dispatch to cloud compute endpoint
- idempotent retry by run fingerprint
- timeout/failure leaves recoverable job state

### Task 8: JARVIS chat tool integration

**Files:**
- Create: `src/application/ecu/tool.js`
- Modify chat/capability composition in `src/app-entry.js`
- Create: `tests/ecu-chat-tool.test.js`

**Produces:**
- intent/action surface for `analyze`, `compare`, `job status`, `research status`, `training status`

### Task 9: PWA ECU UI

**Files:**
- Create focused ECU UI module(s) under `public/`
- Add navigation entry
- Create Node/browser-contract tests as appropriate

**Shows:**
- upload
- progress
- ECU/HW/SW candidates
- map candidates/confidence
- history
- research/training/model status

### Task 10: iOS ECU UI

**Files:**
- Add focused SwiftUI ECU feature files under `ios/`
- Avoid inflating existing global AppState

**Shows:** same core state as PWA, including file upload and job polling.

### Task 11: ORI/MOD diff learning

**Files:**
- Create: `compute/ecu_worker/diff.py`
- Create: `compute/tests/test_diff.py`

**Produces:** exact changed ranges, delta features, links to map candidates.

### Task 12: Knowledge/provenance store

**Files:**
- Create: `src/application/ecu/research.js`
- Create: `tests/ecu-research.test.js`
- Add D1 migration tables for sources/claims/runs

**Rules:**
- every claim has source metadata
- duplicate claims merge without losing provenance
- default state is unverified

### Task 13: Continuous research scheduler

**Files:**
- Extend ECU research application module
- Add scheduled entry/composition path
- Create tests for cadence/state/idempotency

**Behavior:**
- run scheduled discovery/import jobs
- batch and deduplicate work
- never auto-promote raw web claims to verified training examples

### Task 14: Dataset versioning

**Files:**
- Create: `compute/ecu_worker/training/dataset.py`
- Create: `compute/tests/training/test_dataset.py`

**Rules:**
- immutable snapshots
- train/validation/test split by ECU/SW grouping
- no leakage across close variants

### Task 15: Semantic map model baseline

**Files:**
- Create: `compute/ecu_worker/models/map_classifier.py`
- Create tests and benchmark fixture tooling

**Behavior:**
- start with small interpretable/specialized baseline
- calibrated confidence
- explicit unknown class

### Task 16: Model registry, retraining and promotion gate

**Files:**
- Create: `compute/ecu_worker/training/retrain.py`
- Create: `compute/ecu_worker/training/benchmark.py`
- Create: `compute/ecu_worker/training/registry.py`
- Create tests proving worse model is rejected and rollback works

### Task 17: Research-to-training review pipeline

**Files:**
- Extend control plane and compute training modules
- Create tests for provenance retention and verification gate

**Behavior:**
- candidate knowledge -> review/corroboration -> verified example -> dataset snapshot

### Task 18: Resource-aware local/cloud execution

**Files:**
- Create: `compute/ecu_worker/device.py`
- Create tests for CPU/CUDA profiles

**Rules:**
- target RTX 4070 Laptop / 16 GB RAM
- conservative batch size
- dataset streaming
- CUDA OOM retry with smaller batch
- CPU fallback

### Task 19: Validation/checksum interfaces

**Files:**
- Create validation and checksum adapter interfaces in compute package
- Tests for unsupported state and release gating

**Rule:** never invent an ECU-specific checksum algorithm merely to pass acceptance.

### Task 20: End-to-end acceptance

**Acceptance:**
- JARVIS accepts an ECU file/job while laptop is offline
- cloud compute path can process fixture analysis
- result returns to PWA/chat state
- identical job is cached/idempotent
- research run stores provenance
- unverified source is excluded from gold dataset
- retraining candidate that regresses is rejected
- rollback succeeds
- all existing JARVIS checks remain green

### Task 21: Deployment and observability

- structured metrics: queue latency, compute latency, failure reason, model version, cache hit
- no binary contents or secret data in logs
- deploy only after `npm run check` plus compute test suite plus live health verification
