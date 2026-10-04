# JARVIS WhatsApp Agent + Agent Control Center — Implementation Plan

Date: 2026-10-04
Branch: `feature/capability-fabric-v2`
Spec authority: `docs/superpowers/specs/2026-10-03-capability-fabric-v2-design.md` + autonomy addendum

## Goal

Add two bounded but integrated capabilities to JARVIS without replacing the existing specialist-agent architecture:

1. **WhatsApp Agent Channel** — Meta WhatsApp Cloud API becomes an external conversation channel into JARVIS Core. Incoming WhatsApp messages are normalized, routed through the existing smart router/specialist agents, answered through the configured model stack, and recorded with truthful delivery state.
2. **Agent Control Center** — a Paperclip-inspired operational control plane inside JARVIS for assigning work to specialist agents, viewing agent/task state, tracking approvals, cost/usage metadata when available, and seeing the real execution/evidence trail.

Paperclip is treated as a verified upstream design/integration source (`paperclipai/paperclip`), not copied blindly and not counted as a JARVIS capability merely because it exists.

## Global constraints

- No merge to `main` in this plan.
- No production deployment in this plan.
- No secret creation/rotation in this plan.
- No paid API activation or spending.
- No credential values committed to git.
- WhatsApp configuration UI stores only secret references / configured-state metadata; actual tokens remain environment/secret managed.
- Incoming webhook verification must be deterministic and test-covered.
- Outgoing sends must expose `queued/sent/delivered/failed` truthfully; queue acknowledgement is never reported as delivered.
- Agent Control Center must reflect real task/agent state; no fake progress.
- Existing JARVIS specialist agents remain separate; the control center coordinates them rather than flattening them into one agent.
- High-risk device/vehicle writes stay behind existing confirmation and safety gates.

## Task 1 — Source verification + capability registry entries

### RED
Add tests that require source records for:
- `paperclipai/paperclip` as an orchestration/control-plane reference source;
- Meta WhatsApp Cloud API as a networked external channel;
- OpenRouter/model gateway as optional provider infrastructure only, not a hard dependency.

Tests must fail until registry records include canonical identity, provenance, license/source type, risk class, and execution/reference state.

### GREEN
Add/extend capability/source registry entries and resolver metadata. Paperclip should be `reference_only` or `adapter_ready` until an actual adapter acceptance test exists.

### Acceptance
- Registry does not count Paperclip as verified just because it was catalogued.
- WhatsApp channel capability is distinguishable from model provider capability.

## Task 2 — WhatsApp webhook core

### RED
Add backend tests for:
- GET webhook verification challenge success/failure;
- POST webhook parsing for text messages;
- idempotency by Meta message id;
- ignored unsupported event types;
- normalized inbound envelope containing channel, sender, message id, timestamp, text and raw provenance;
- signature verification hook/policy boundary;
- safe failure when credentials/config are missing.

### GREEN
Implement a `whatsapp-channel` application module and HTTP route adapter using existing router/session services.

### Acceptance
- Valid inbound text reaches JARVIS routing exactly once.
- Duplicate webhook delivery does not create duplicate assistant work.
- Missing/invalid verification data returns a non-success response without leaking configuration.

## Task 3 — Outbound WhatsApp replies + business knowledge profile

### RED
Add tests for:
- outbound message request construction;
- truth-state mapping (`queued`, `sent`, `delivered`, `failed`);
- no secret values returned by config/status APIs;
- business knowledge profile schema (business details, services/pricing text, hours, locations, policies/FAQ, brand voice, booking rules);
- business profile changes affect prompt/context assembly without rebuilding the app.

### GREEN
Implement:
- outbound WhatsApp sender adapter;
- config/status model using secret references;
- persisted business-knowledge profile;
- context injection before smart routing/model execution.

### Acceptance
- JARVIS can answer WhatsApp using current business knowledge while preserving normal specialist-agent routing.
- The UI can show “configured / not configured” without exposing token contents.

## Task 4 — Action/booking bridge

### RED
Add tests for a provider-neutral booking contract:
- availability lookup;
- slot presentation;
- required customer-detail collection;
- explicit booking confirmation;
- provider failure fallback to human handoff / informational response.

### GREEN
Add `booking` capability interface with a first adapter boundary compatible with Cal.com/Google Calendar later. Do not require a live paid provider for tests; use deterministic fixtures.

### Acceptance
- WhatsApp agent can move from chat → availability → confirmed booking only when an adapter is configured.
- Without adapter configuration it does not fabricate a booking.

## Task 5 — Agent Control Center backend

### RED
Add tests for:
- specialist-agent inventory (general, diagnostics, coding, ECU workshop, repo/skill, phone automation, creator/social, automation, YT Öğretisi);
- task lifecycle (`proposed`, `queued`, `running`, `waiting_approval`, `verified`, `failed`, `cancelled`);
- assignment to one owner agent;
- parent/child task linkage for delegation;
- immutable event/evidence entries for state transitions;
- approval-required gates for destructive/production/secret/high-risk actions;
- budget/usage fields optional and truthful when unavailable.

### GREEN
Implement a lightweight native control-plane service inside JARVIS using the existing capability fabric/job infrastructure where possible instead of importing Paperclip wholesale.

### Acceptance
- One API response can render “which agent owns which task, state, evidence, blocker, next safe step.”
- A queued task is not shown as completed.

## Task 6 — iPhone UI: WhatsApp + Agent Control Center

### RED
Add/extend Swift validation tests/static checks requiring:
- sidebar entries for `WhatsApp Agent` and `Agent Merkezi`;
- WhatsApp view sections: connection state, business knowledge, webhook status, recent conversations/actions;
- Agent Control Center sections: agents, active tasks, waiting approvals, recent verified/failed outcomes;
- no secret/token plaintext rendering.

### GREEN
Implement native SwiftUI views and API calls on the existing iOS app branch/integration branch.

### Acceptance
- Both modules are separately accessible from the JARVIS sidebar.
- The UI differentiates configured/connected/queued/running/verified/failed states.

## Task 7 — Integration and router wiring

### RED
Add integration tests proving:
- WhatsApp → normalized inbound → smart router → specialist agent → outbound adapter;
- control-center task creation from a routed long-running job;
- approval-required action pauses rather than executing;
- completion event attaches evidence and updates UI-visible state.

### GREEN
Wire modules into the existing smart router, learning/memory context, notification hooks and capability state model.

### Acceptance
- WhatsApp is a channel, not a separate monolithic brain.
- Control Center observes and coordinates existing specialist agents.

## Task 8 — Verification, security review, CI and release artifact

Run the repository test suite and existing iOS validation/release workflow on the feature branch.

Verify:
- no plaintext credential patterns added;
- webhook/idempotency/security tests pass;
- router regression tests pass;
- iPhone Release compile passes;
- generated unsigned IPA artifact exists if the current workflow supports it.

Do not merge or deploy production. Report exact commit(s), tests, workflow run and artifact status.

## Implementation order

`Task 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8`

Interfaces shared across tasks:
- Task 2 produces normalized channel envelope consumed by Task 7.
- Task 3 produces outbound/config/business-context interfaces consumed by Tasks 4 and 7.
- Task 5 produces task/event state consumed by Task 6 and Task 7.
- Task 6 consumes backend status only; it must not infer success locally.

## Final completion contract

This plan is complete only when all named tests are present, observed failing before implementation where applicable, then passing; the whole relevant suite is green; iOS validation compiles; and the final report distinguishes implemented/verified from merely configured/reference-only states.
