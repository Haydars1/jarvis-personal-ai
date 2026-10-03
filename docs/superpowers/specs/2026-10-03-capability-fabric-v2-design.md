# JARVIS Capability Fabric v2 — Design Spec

Date: 2026-10-03
Status: Proposed, conversational architecture approved; written-spec review pending
Branch: `feature/capability-fabric-v2`

## 1. Objective

Turn JARVIS's existing repository/skill catalog, native skill executor, cloud runner, learning engine, YT Öğretisi, code graph, ECU tooling, iPhone app, and source-pool infrastructure into one verified **Capability Fabric**.

The fabric must accept many external repositories and learning sources without pretending that catalogued code is already a working capability. Every source must move through an explicit lifecycle and only become executable after verification.

Primary user outcome:

- Add repositories, videos, channels, PDFs, examples, or tools once.
- JARVIS extracts useful capabilities and maps them to the correct specialist agent.
- JARVIS selects the best verified implementation at runtime.
- If the first implementation fails, it can try another compatible verified implementation.
- The UI reports what is merely known, what is installed, what is executable, and what has actually passed a test.
- Third-party code cannot silently gain unrestricted access to secrets, devices, the filesystem, vehicle write operations, or production deployment.

## 2. Existing Foundations

The design extends existing code instead of replacing it:

- `src/lib/repo-skill-compiler.js`
- `src/application/capabilities/native-skill-executor.js`
- `src/application/capabilities/cloud-execution.js`
- `src/lib/capability-policy.js`
- `src/lib/repository-integrations.js`
- `src/application/chat/smart-router.js`
- `.github/scripts/cloud-tool-runner.mjs`
- `data/capability-registry.json`
- source-pool/provenance data already in the repository
- native code-graph engine and optional Graphify compatibility
- YT learning runtime and persistent learning memory
- the iOS `YT Öğretisi` view on `feature/learning-engine`
- ECU binary inspection, ThinkDiag/device bridge, vehicle coding research, and native iOS vehicle code on `feature/learning-engine`

The key problem is no longer "can JARVIS store repos?". It is **turning sources into trustworthy, measurable, routed capabilities without destabilizing existing modules**.

## 3. Scope

### In scope

1. Repository/source ingestion and deduplication.
2. Metadata, license, provenance, commit pinning, and dependency capture.
3. Static safety review and policy classification before execution.
4. Sandboxed/isolated execution for third-party tools whenever practical.
5. Adapter compilation and runtime registration.
6. Capability grouping and fallback among equivalent tools.
7. Truthful capability state and execution evidence.
8. Specialist-agent routing.
9. YT Öğretisi enrichment with transcript + visual/repo/tool extraction + provenance.
10. Memory/learning integration.
11. Main vs `feature/learning-engine` convergence through a controlled integration branch.
12. iPhone UI visibility for capability state and YT Öğretisi results.
13. Vehicle/ECU-specific safety gates.
14. Development-candidate generation from learned sources.

### Out of scope for automatic execution

- automatic production deployment;
- automatic merge to `main`;
- secret creation or secret rotation;
- destructive filesystem/database operations outside a sandbox;
- unreviewed arbitrary shell execution on the primary JARVIS environment;
- automatic high-risk ECU writes;
- emissions-control bypass generation or automated EGR/DPF/AdBlue/SCR defeat patches.

These may be represented as reference knowledge or proposals where appropriate, but not silently executed.

## 4. Candidate Source Families

The user has supplied repository screenshots/videos over multiple batches. The ingestion layer must treat these as **candidate sources**, not as trusted capabilities.

The final image batch includes candidates such as:

- `Nanako0129/sepia` — writing/editing skill candidate.
- `obra/superpowers` — software-development workflow/skills candidate.
- `rohitg00/ai-engineering-from-scratch` — educational/reference source.
- `Leonxlnx/unlazy` — completion/verification-discipline skill candidate.
- `furkankly/zoetrope` — agent/session observability candidate.
- `Ryze-AI-Agent/open-seo-mcp-skills` — SEO/MCP capability candidate.
- `nateherkali/scroll-craft` — frontend/design workflow candidate.
- `tigerless-labs/agent-memory` — long-term memory candidate.
- `lexmount/moli` — headless browser candidate.
- `ShawnPana/phone-harness` — desktop/bridge phone-control candidate.

Earlier batches include additional candidate families such as browser automation, code understanding/graphing, memory, skill security, sandboxing, creator/design tooling, and learning sources. The ingestion job must resolve the exact GitHub repository identity and current commit before registration.

No star count, screenshot caption, or social-media description is sufficient evidence that a capability works.

## 5. Core Lifecycle

Every external source must have a state that is both machine-readable and user-visible.

```text
candidate
  -> resolved
  -> learned
  -> security_scanned
  -> approved_for_adapter | reference_only | blocked
  -> adapter_ready
  -> executable
  -> verified
  -> degraded (when later health checks fail)
```

### State meanings

- **candidate**: user supplied or discovered; identity may not yet be verified.
- **resolved**: repository/source URL, license, commit/ref and source metadata verified.
- **learned**: README/SKILL/docs/code surface analysed and capabilities extracted.
- **security_scanned**: static/rule-based risk review completed with findings recorded.
- **reference_only**: useful knowledge, but not safe/appropriate/compatible for execution.
- **blocked**: unsafe, incompatible, prohibited, or irreparably unverifiable.
- **adapter_ready**: JARVIS knows the invocation contract but has not proved execution.
- **executable**: execution environment and dependencies are available.
- **verified**: a defined acceptance test produced concrete evidence.
- **degraded**: previously executable/verified, but a health check now fails.

The registry must never count `candidate`, `resolved`, `learned`, or `adapter_ready` as a working capability.

## 6. Capability Model

A repository is not a capability. One repository may expose multiple capabilities, and several repositories may implement the same capability.

Example:

```text
capability: browser.navigate
implementations:
  - moli
  - browser-use
  - stagehand
  - dots/browser
```

Runtime selection operates on **capabilities**, not repo popularity.

Suggested capability record:

```json
{
  "capability_id": "browser.navigate",
  "domain": "browser",
  "implementation_id": "lexmount/moli@<commit>",
  "adapter_id": "browser-moli",
  "state": "verified",
  "risk_class": "networked-readwrite",
  "execution_target": "sandbox-cloud",
  "requirements": ["network"],
  "provenance": [],
  "tests": [],
  "health": {},
  "priority": 70
}
```

## 7. Specialist-Agent Mapping

Capabilities are routed into specialist groups instead of one monolithic agent.

### General Chat Agent

Uses verified tools opportunistically and delegates domain work.

### Vehicle Diagnostics Agent

ThinkDiag/OBD diagnostics, module scan, DTC, live data, readiness, freeze-frame and supported service operations.

### Vehicle Coding & Adaptation Agent

Coding/adaptation/basic settings with compatibility, preflight, backup, confirmation, verification, and recovery rules.

### ECU File Workshop Agent

BIN/ORI/MOD/HEX inspection, ECU/HW/SW metadata, checksum validation, diffing, map visualization, project/channel organization and evidence-backed educational analysis.

### Repo/Skill Engine

Owns repository ingestion, learning, adapter compilation, verification, health, fallback and execution provenance.

### Phone Automation Agent

Native iOS App Intents/Shortcuts/deep-links/notifications where supported. Desktop tools such as Phone Harness are exposed as optional bridge implementations and must not be represented as iPhone-local control.

### Creator / Web / Social Agents

Design, frontend, SEO, social, YouTube creator and related capabilities use their own domain groups and policies.

### YT Öğretisi

Separate learning channel. It does not equal YouTube Creator Studio.

## 8. Security Gate

External skills are untrusted by default.

### 8.1 Static review

Before adapter generation, scan for at least:

- prompt-injection or instruction-hijacking patterns in skill docs;
- unexpected secret/environment-variable reads;
- filesystem traversal or broad home-directory access;
- shell command construction;
- child-process/spawn/exec use;
- network destinations and upload behavior;
- credential/cookie/browser-profile access;
- package-install/bootstrap scripts;
- postinstall hooks;
- destructive commands;
- self-modifying behavior;
- privilege escalation;
- hidden telemetry;
- license incompatibility.

A SkillSpector-like integration may be used as one signal, but JARVIS policy remains authoritative.

### 8.2 Execution isolation

Use an OpenShell-like sandbox or equivalent isolation abstraction where the tool requires local execution.

Policy classes:

1. `reference-only`
2. `pure-read`
3. `network-read`
4. `workspace-readwrite`
5. `sandbox-network-readwrite`
6. `device-read`
7. `device-write-confirmed`
8. `production-prohibited`

Third-party repositories do not inherit JARVIS production credentials by default.

### 8.3 Supply-chain pinning

Executable adapters must pin the source commit or release. Updating to a new commit moves the implementation back to at least `security_scanned`/`adapter_ready` until verification reruns.

## 9. Adapter Compiler v2

The existing repo-skill compiler becomes a staged compiler.

### Phase A — Resolve

- canonical owner/repo;
- default branch;
- requested/current commit;
- license;
- README/SKILL/plugin manifests;
- language/runtime/dependencies;
- install and execution hints.

### Phase B — Learn

Extract:

- capability names;
- required inputs;
- produced outputs;
- side effects;
- runtime prerequisites;
- auth requirements;
- paid API requirements;
- platform constraints;
- example invocations;
- known failure conditions.

### Phase C — Policy

Assign risk class and whether the source is executable, reference-only, or blocked.

### Phase D — Adapter proposal

Produce a typed adapter manifest. Do not automatically treat generated adapter code as trusted.

### Phase E — Verification

Run repository-specific smoke/acceptance tests in isolation. Store evidence, version, duration, exit status, and output digest.

## 10. Runtime Selection and Fallback

When a specialist agent requests a capability:

```text
request
 -> capability intent
 -> candidate verified implementations
 -> filter by device/platform/permission/network/cost/risk
 -> score by health + compatibility + recency + reliability
 -> execute best implementation
 -> validate concrete output
 -> if compatible failure, try next implementation
 -> return result + trace
```

### Required runtime truths

- A queued job is not a completed result.
- An adapter that merely exists is not a working tool.
- Tool failure must not be rewritten as success by fallback chat.
- Fallback to another implementation must be visible in the execution trace.
- Hosted AI fallback and deterministic/local tool execution must be distinguishable.

## 11. Verification Evidence

Each verified implementation must define an acceptance contract.

Examples:

- Browser tool: fetch a known safe page, return title/body marker, prove no host filesystem write.
- Code-search tool: search a fixture repository and return expected path/line.
- Memory tool: write fixture memory, retrieve it, restart process/store if relevant, retrieve again.
- SEO tool: run against fixture/mock data when live credentials are absent.
- Design skill: generate a bounded fixture artifact and verify expected file/DOM structure.
- Phone bridge: show bridge availability only when supported host/device prerequisites are satisfied.

Verification evidence is stored separately from human-readable descriptions.

## 12. Observability

Zoetrope-like session visualization can become an optional observability implementation.

JARVIS must maintain its own canonical execution trace:

- request ID;
- specialist agent;
- capability ID;
- selected implementation;
- fallback attempts;
- tool calls;
- duration;
- result state;
- source/commit;
- policy decision;
- user confirmation where applicable.

UI can render this as a flow graph, but the trace format must not depend on one third-party viewer.

## 13. Memory Architecture

Memory candidates such as `agent-memory`, Hindsight, MemPalace, Second Brain or similar are **implementations**, not the source of truth.

JARVIS needs a stable memory abstraction:

- short-term session context;
- user/project memory;
- source-backed learned knowledge;
- episodic execution history;
- vehicle/project/file memory;
- provenance and confidence.

A backend may be replaced without changing the rest of the application.

Source-backed knowledge must retain:

- source URL;
- source type;
- timestamp/line/passage where possible;
- ingestion time;
- content digest;
- confidence/trust state;
- derived development candidates.

## 14. YT Öğretisi v2

The existing `youtube-teaching` runtime remains the entry point but becomes multimodal and development-aware.

### Inputs

- YouTube video URL;
- channel URL;
- playlist URL when implemented;
- uploaded local video when the native upload path is available.

### Extraction pipeline

1. Resolve source identity.
2. Capture transcript/captions or ASR when available.
3. Sample important frames/timestamps.
4. Detect visible repository names, URLs, CLI commands, package names, file names, settings, diagrams and code fragments.
5. Normalize discovered GitHub candidates.
6. Verify external repos/tools against GitHub/web sources.
7. Store source-linked knowledge chunks.
8. Classify domain: ECU tuning, diagnostics, coding, software development, AI, creator, etc.
9. Compare learned information with current Capability Fabric.
10. Generate development candidates with evidence.

### NotebookLM Coach role

`artemnovitckii/notebooklm-coach` is an optional ingestion/query implementation for bulk channel learning and cited answers. It must not be the sole storage layer or sole transcript path because it has external authentication/session/tier constraints.

JARVIS's native learning memory remains authoritative for application state and provenance.

### UI statuses

```text
Analiz ediliyor
Kaynak çözüldü
Öğrenildi
Araç/repo doğrulandı
JARVIS'e eklendi
Geliştirme adayı
Test edildi
Referans-only / Engellendi
```

The user can inspect:

- what was learned;
- what repo/tool was found;
- timestamp/source evidence;
- whether it already existed in JARVIS;
- which development candidate was generated;
- whether a resulting capability was actually tested.

## 15. Educational vs Executable Vehicle Knowledge

YT Öğretisi may ingest educational ECU tuning and diagnostics material, but ingestion does not imply permission to execute all procedures.

Allowed knowledge use includes:

- ECU binary structure education;
- ORI/MOD comparisons;
- checksum analysis/verification;
- map and metadata visualization;
- DTC/diagnostic interpretation;
- coding/service documentation;
- user-provided file organization and analysis;
- safe, supported service workflows with preconditions.

High-risk vehicle writes require:

- exact vehicle/session target;
- supported ECU/module match;
- battery/voltage/ignition/engine-state preflight where relevant;
- backup;
- explicit confirmation;
- verification;
- recovery/rollback strategy;
- audit log.

Knowledge relating to emissions-control defeat may be retained as non-executable reference context where legally/safely appropriate, but JARVIS must not auto-generate or execute bypass patches.

## 16. iOS and Branch Convergence

Current development is split:

- `main`: newest backend capability fabric, repo execution, cloud jobs, code graph, YT runtime.
- `feature/learning-engine`: richer native iPhone UI, YT Öğretisi screen and advanced vehicle/ThinkDiag/coding code.

Do **not** merge one branch wholesale over the other.

Create a controlled integration sequence:

1. Build Capability Fabric v2 backend changes from current `main`.
2. Identify overlapping iOS files by path and semantic role.
3. Port or merge specialist iOS views/services with explicit conflict review.
4. Keep backend API contracts backward-compatible during convergence.
5. Run Node/backend tests.
6. Run native static tests.
7. Run Xcode simulator build.
8. Run Release/iPhone build.
9. Only after all acceptance checks, propose merge to `main`.

Production deployment and final `main` merge remain explicit proposals, not automatic actions.

## 17. Capability Dashboard

Settings/diagnostics should expose grouped counts and drill-down:

```text
Sources              150
Resolved             141
Learned              128
Security approved     83
Reference only        32
Blocked               13
Adapter ready         55
Executable            37
Verified              29
Degraded               3
```

Per capability show:

- capability name;
- specialist agent;
- implementation repo;
- commit/release;
- license;
- security state;
- execution target;
- requirements;
- latest verification;
- latest failure;
- provenance.

Avoid presenting raw repository count as "JARVIS can do X things".

## 18. Failure Modes

### Repository disappears

Pinned metadata/provenance remains; capability becomes degraded if runtime artifacts are unavailable.

### Upstream changes

New commit is not trusted automatically. Re-scan and re-verify.

### Dependency unavailable

Mark degraded and try another compatible implementation.

### Tool requires paid API

Keep as reference/conditional capability; do not silently incur cost.

### Tool requires desktop/Mac

Expose `needs_host` rather than pretending iPhone-native support.

### Authentication requires browser/2FA

Expose setup-required state. Do not hang a cloud worker waiting for interactive login.

### Sandbox unavailable

Do not fall back to unrestricted execution unless a separately trusted native adapter explicitly permits it.

## 19. Data Migration Strategy

No destructive rewrite of `data/capability-registry.json`.

Introduce a v2 normalized registry/cache while retaining compatibility readers during migration.

Suggested new entities:

- `sources`
- `source_revisions`
- `capabilities`
- `implementations`
- `adapter_manifests`
- `security_findings`
- `verification_runs`
- `execution_health`
- `learning_evidence`
- `development_candidates`

D1/schema migration must be additive first.

## 20. Acceptance Criteria

The Capability Fabric v2 project is not complete until all of the following are demonstrated:

1. A user-supplied repo can be resolved, pinned, learned, security-classified, and registered.
2. A non-executable educational repo becomes `reference_only`, not falsely `executable`.
3. At least two interchangeable implementations can exist under one capability ID.
4. Runtime can skip a degraded implementation and use another verified compatible implementation.
5. Execution trace shows selection and fallback.
6. A dangerous/untrusted skill is blocked before unrestricted execution.
7. Updating a source commit invalidates prior verification state until re-tested.
8. YT Öğretisi can retain transcript/source provenance and discovered repo/tool evidence.
9. YT Öğretisi can produce a development candidate without silently applying it to production.
10. NotebookLM Coach integration reports setup/auth constraints truthfully.
11. Phone Harness is represented as a host bridge, not iPhone-native automation.
12. Vehicle writes remain confirmation/preflight gated.
13. Capability dashboard distinguishes sources/learned/adapter/executable/verified/degraded.
14. Existing repo skill execution tests continue passing.
15. Existing YT learning tests continue passing.
16. Existing ECU/vehicle native tests continue passing after branch convergence.
17. iOS simulator and Release builds pass before any merge proposal.

## 21. Implementation Decomposition

This architecture should be implemented as independently verifiable subprojects:

### A. Capability Registry v2

Normalized source/capability/implementation states, provenance, migration compatibility.

### B. Security & Sandbox Gate

Static findings, risk policy, execution target rules, optional external scanners.

### C. Adapter Compiler v2

Typed manifests, dependency/platform requirements, adapter lifecycle.

### D. Verification & Health Engine

Acceptance contracts, evidence, health and degraded-state handling.

### E. Runtime Capability Router

Capability-level selection, compatibility filtering, fallback and trace.

### F. YT Öğretisi v2

Multimodal extraction, discovered repo/tool verification, learning evidence, development candidates.

### G. Memory Abstraction

Stable JARVIS memory interfaces with pluggable backend implementations.

### H. Observability

Canonical execution trace plus optional Zoetrope-style viewer integration.

### I. Specialist Integrations

Browser, SEO, creator/design, phone bridge and other candidate repo families.

### J. iOS / Backend Convergence

Controlled integration of `feature/learning-engine` into the new fabric with native validation.

## 22. Design Decision

Chosen approach: **ingest broadly, execute narrowly, verify continuously**.

Rejected alternatives:

- **Clone/install everything directly**: too much supply-chain and capability-truth risk.
- **Keep everything as documentation only**: wastes useful executable capabilities.
- **One repo = one tool = one UI entry**: creates duplication and poor routing.

The Capability Fabric is the stable product abstraction; third-party repositories are replaceable implementations behind it.
