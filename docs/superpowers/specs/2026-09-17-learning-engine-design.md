# JARVIS Learning Engine Design

## Goal
JARVIS should improve in two directions without uncontrolled self-modification: (1) learn durable user preferences/corrections, and (2) build a source-aware general knowledge memory from successful research and interactions. It should also learn provider reliability by task/domain and present readable answers without exposing internal fallback/timeout/search plumbing.

## Architecture
Add a Learning Engine behind the existing chat orchestrator and OS runtime. The engine has five bounded responsibilities:

1. **Personal Memory** — extract durable, non-sensitive preferences, corrections and project context; deduplicate and rank by relevance/confidence/recency.
2. **Knowledge Memory** — store reusable researched facts with domain, source URL/title when available, observed/verified timestamps, confidence and expiry/freshness policy. Unverified model output is never promoted as fact by itself.
3. **Failure Learning** — record provider, task/domain, latency, timeout/empty/error reason and whether fallback succeeded. This feeds routing scores rather than user-visible prose.
4. **Provider Scoring** — extend existing provider metrics with domain/task-aware success, latency and recent-failure penalties. Routing may adapt automatically, but must retain deterministic fallback and bounded timeouts.
5. **Response Formatting** — clean technical leakage (`LIVE SEARCH: EMPTY`, raw provider timeout text, URL/rut fragments) and format long Turkish responses into short paragraphs, headings and lists with sensible spacing.

## Data flow
`user message -> intent/domain classification -> retrieve relevant personal + knowledge memory -> provider/router -> optional live research -> answer -> presenter/formatter -> user`

After the response, asynchronous learning records durable personal corrections, provider outcome and eligible source-backed knowledge. Learning must never block the user response.

## Safety and quality boundaries
- No autonomous modification of production source code, prompts, credentials or model weights as part of learning.
- Existing explicit self-update workflow remains separate and auditable.
- Do not persist secrets/tokens/passwords or sensitive personal categories.
- Knowledge entries require provenance when learned from external research; stale/time-sensitive facts receive expiry or freshness metadata.
- Conflicting knowledge is not silently overwritten; newer/source-backed evidence can supersede older entries while retaining provenance.
- Low-confidence memory is context, not asserted truth.
- Bound DB growth with deduplication, per-domain caps/retention and periodic compaction.

## Persistence
Use additive D1 schema only. Introduce tables (or equivalent additive structures) for `learning_events`, `knowledge_memories`, `provider_domain_metrics`, and enhanced personal-memory metadata. Keep existing `memories` and `provider_metrics` compatible.

## UI/readability
Both PWA and native iOS should render semantic answer blocks consistently. Preserve intentional newlines. Add paragraph spacing and line-height; distinguish headings and lists. Internal provider/search/debug labels stay in diagnostics UI/logs, not assistant message text. Strip accidental encoded URL/rut/search fragments before display.

## Testing
Add deterministic tests for:
- personal-memory extraction filters and dedupe;
- source/provenance requirement for knowledge promotion;
- stale/conflicting knowledge handling;
- provider domain scoring and timeout penalties;
- learning never blocking chat;
- presenter stripping technical leakage while preserving legitimate content;
- PWA/native formatting contract;
- additive schema compatibility.

Run `npm run check`, relevant iOS validation/build workflow, Cloudflare deploy workflow, live health check and verify IPA artifact production when the native workflow is configured to upload one.

## Rollout
Ship additively behind a learning-engine feature flag/default-safe configuration. Existing chat remains functional if learning storage or asynchronous learning fails. Observe metrics before allowing learned provider scores to materially reorder providers.
