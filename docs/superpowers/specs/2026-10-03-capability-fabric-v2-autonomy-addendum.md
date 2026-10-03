# Capability Fabric v2 — Normative Autonomy & Inventory Addendum

Date: 2026-10-03
Status: Normative companion to `2026-10-03-capability-fabric-v2-design.md`

This addendum records issues found during self-review of the main design. It is part of the written design and must be approved with it.

## A. Safe Autonomous Improvement Loop

JARVIS is expected to improve itself from verified sources without requiring a new micro-command after every safe step. This autonomy is allowed only inside a controlled development boundary.

```text
learning evidence
 -> development candidate
 -> classify change risk
 -> if low-risk and allowed: create/use feature branch
 -> generate tests first
 -> implement bounded change
 -> run verification
 -> record evidence
 -> if verification passes: mark candidate implemented_verified
 -> propose promotion/merge
```

### Automatically allowed on a feature branch

- tests and fixtures;
- additive parsers/readers;
- source metadata and provenance improvements;
- non-destructive adapters running in sandbox/read-only mode;
- capability routing refinements that preserve existing fallbacks;
- UI status/observability additions;
- documentation;
- compatibility shims;
- local/sandbox smoke tests;
- fixes whose acceptance contract is deterministic and whose blast radius is bounded.

### Proposal-only / explicit approval required

- merge to `main`;
- production deployment;
- secrets or credential changes;
- paid API activation or spending;
- destructive database/filesystem migrations;
- broad permission expansion;
- publishing external content on the user's behalf where a final publish action is irreversible;
- high-risk physical-device writes;
- vehicle coding/service/write operations requiring confirmation;
- any change that weakens safety, provenance, audit, or sandbox controls.

A failed autonomous attempt must stop or fall back safely; it must never hide the failure by reporting success.

## B. Source Inventory Is Separate From Capability Count

Every supplied screenshot/video/link may contain zero, one, or many candidate sources. JARVIS must maintain an explicit inventory table rather than relying on social-media captions or manually copied lists.

Each inventory item should include:

- `source_id`
- canonical URL / owner+repo when resolved
- source type: screenshot, video, direct URL, PDF, discovered link
- source batch / provenance
- first-seen timestamp
- exact commit/release after resolution
- license
- duplicate fingerprint
- status
- security findings count
- extracted capability IDs
- specialist-agent mapping
- executable/reference-only/blocked state

Deduplication keys should use canonical repository identity plus source revision/content digest, not display name alone.

## C. Repository Identity Verification

Names read from screenshots are candidates only. Before the repository enters `resolved` state, JARVIS must verify:

1. the repository exists;
2. canonical owner/name;
3. default branch;
4. exact commit SHA used for analysis;
5. README/SKILL/plugin manifests actually belong to that revision;
6. license information;
7. archived/fork status where relevant;
8. install/runtime requirements;
9. whether a screenshot description materially misrepresents current upstream behavior.

## D. License and Attribution Gate

A repository may be technically useful but unsuitable for copying into JARVIS.

The compiler must distinguish:

- instructions/ideas that may be learned;
- external executable dependency invoked without code copying;
- code that can be vendored under its license;
- code requiring attribution/notice preservation;
- code that is incompatible and therefore reference-only.

Third-party license notices must be kept when required.

## E. Development Candidate States

YT Öğretisi and repo learning should use explicit development-candidate states:

```text
proposed
 -> evidence_verified
 -> risk_classified
 -> queued_for_dev
 -> implementing
 -> tests_passing | tests_failed
 -> implemented_verified
 -> promotion_proposed
 -> promoted | rejected | superseded
```

This prevents "learned" from being confused with "the app has been improved".

## F. Promotion Rule

No autonomous code change is a product capability until all relevant acceptance tests pass and evidence is attached to the candidate/implementation.

Promotion from feature branch to `main` is never implied by successful tests. It remains a separate explicit action.

## G. Customer / Long-Running Session Notification Hook

The fabric should expose an event hook for meaningful state changes, including:

- customer/device session connected;
- long-running verified job completed/failed;
- capability degraded;
- development candidate verified;
- action waiting on owner confirmation.

Delivery can use the existing APNs/notification infrastructure when available. Notifications must describe truthful state (for example, `queued`, `running`, `verified`, `failed`) and must not convert a queue acknowledgement into a completion notification.

## H. Self-Review Result

The main design plus this addendum now covers the previously missing requirement: **JARVIS may autonomously apply low-risk improvements in an isolated feature branch after source verification, but it may not silently promote them to production or `main`.**
