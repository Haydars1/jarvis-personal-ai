# GitHub Capability Fabric Design

## Goal

Turn JARVIS from an API-first assistant into a local/open-source-first capability orchestrator that continuously discovers useful public GitHub projects, evaluates them, catalogs them, and routes suitable tasks to those capabilities before paid AI providers.

The registry is intentionally allowed to grow to hundreds or thousands of candidates. JARVIS must not vendor or execute every discovered repository.

## Architecture

The capability fabric has five boundaries:

1. **Discovery seeds** — category-specific GitHub search queries plus curated ecosystem catalogs such as awesome MCP/local-AI lists.
2. **Admission policy** — deterministic license, archive, freshness, security-topic and metadata checks. Discovery never implies trust.
3. **Registry** — normalized repository records with categories, execution target, trust/admission status and score.
4. **Selection** — task-aware local/open-source ranking that runs before remote AI provider ranking when a compatible capability is healthy and available.
5. **Adapters** — separately reviewed executors. A registry entry cannot execute code merely because it was discovered.

A scheduled GitHub Actions harvester refreshes the registry without using an LLM or paid AI API. Changes travel through a `jarvis/*` branch and the repository's normal PR/test/merge gate.

## Capability taxonomy

The initial taxonomy must cover at least:

- local-llm
- coding-agent
- browser-agent
- computer-use
- workflow-rpa
- crawler-scraper
- research-search
- image-generation
- video-generation
- video-editing-render
- speech-to-text
- text-to-speech
- ocr-document
- rag-vector-memory
- mcp-tooling
- social-automation
- devops-observability
- ecu-file-analysis
- ecu-diagnostics
- can-uds-obd
- device-bridge

The taxonomy is data-driven; new categories can be added without changing the admission algorithm.

## Admission policy

Admission states:

- `accepted` — permissive license and no blocking safety/health signal. May be considered by local-first routing, but execution still requires an adapter.
- `external-only` — useful project whose license or architecture should remain a separate service/process rather than copied into JARVIS.
- `quarantine` — insufficient license/metadata confidence or unresolved risk. Discoverable but never auto-executable.
- `rejected` — archived/disabled or clearly unsafe/unrelated for JARVIS's capability fabric.

Permissive licenses such as MIT, Apache-2.0, BSD and ISC can be accepted. Copyleft projects such as GPL/AGPL are cataloged `external-only`. Missing/NOASSERTION licenses are quarantined.

Repositories advertising malware, credential theft, phishing, destructive exploitation, stealth persistence, spyware or red-team payload execution are rejected from the automatic capability pool. Security tooling can only be introduced later through an explicit reviewed adapter.

Automotive entries may support diagnostics, UDS/CAN/OBD communication, binary inspection, checksum/integrity analysis, map visualization, comparison, restoration and legitimate calibration workflows. The registry must not turn discovery into an automated road-vehicle emissions defeat pipeline; emissions-control modification remains analysis-only/human-review in the existing policy.

## Scoring

Repository quality score is deterministic and capped to 0–100. Positive signals include recent pushes, stars/forks, known license, explicit category/topic match and maintained status. Penalties include staleness, missing license, archive/disabled state and risky topics.

Routing score combines registry quality with task-category match and runtime availability (`cloud`, `local-cpu`, `local-gpu`, `device`, `external-service`). A higher registry score must not override an incompatible execution target.

## Seed strategy

Initial curated seeds should include representative projects across the ecosystem, including local inference/coding, workflow automation, browser/crawling, media generation, speech/OCR, vector memory, MCP, social automation and automotive diagnostics/tuning. Curated seeds are not privileged: they pass the same admission policy as discovered repositories.

Search query definitions are the primary scaling mechanism. The first version must contain at least 20 category queries and include broad sources such as `awesome-mcp-servers`, `awesome-local-ai`, workflow automation and automotive CAN/UDS/ECU searches.

## Harvester

The harvester is a dependency-free Node script using GitHub's REST API and `GITHUB_TOKEN` when available. It:

1. executes the configured queries with bounded per-query results;
2. deduplicates by `full_name`;
3. normalizes metadata;
4. evaluates admission and score;
5. merges curated seed metadata;
6. writes deterministic JSON sorted by capability then score then repository name.

The scheduled workflow runs daily plus `workflow_dispatch`. It must not execute discovered repository install scripts. It only updates registry metadata, validates the repository, then pushes a generated branch/PR when content changed.

## Runtime selection

`openSourceCandidates(kind, registry, runtimeContext)` returns compatible admitted capabilities ordered by task fit and health. `buildExecutionPlan(kind, registry, runtimeContext, providerRows)` exposes two lanes:

1. `openSource` — compatible local/external capabilities first;
2. `providers` — existing provider scores as fallback.

The caller retains control of actual execution. This preserves existing provider failover while making open-source capabilities first-class.

## First delivery acceptance criteria

- 20+ discovery queries and 15+ categories are represented.
- Curated seed set spans all major JARVIS workloads, not only 4–5 repositories.
- Deterministic admission rejects archived/unsafe repositories, quarantines unknown licenses, separates copyleft projects, and accepts healthy permissive projects.
- Local/open-source candidate ranking precedes provider API fallback without removing provider failover.
- Daily/manual harvester workflow exists and performs metadata-only discovery.
- Registry output is deterministic and does not auto-install or auto-execute discovered code.
- `npm run check` and Cloudflare dry-run remain green before merge.
