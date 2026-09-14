# JARVIS Architecture

## Runtime overview

JARVIS has two primary clients: the native SwiftUI iOS application under `ios/` and the static PWA under `public/`. Both call the same Cloudflare Worker API.

Wrangler points to the explicit composition root `src/app-entry.js`. The root now composes Higgsfield, the integration hub, provider state, smart routing, Google search, chat enhancements, JARVIS OS, social growth, video failover, response presentation, capability runtime, media rescue, chat orchestration and APNs explicitly around `src/worker.js`.

There is no remaining top-level `*-entry.js` wrapper in the active runtime chain. Legacy entry files remain only as compatibility adapters.

For `/api/chat/send`, the composition root assembles the higher-level stack explicitly and routes the request through the same application services used by the PWA and native iOS clients.

APNs is composed separately as infrastructure. The old `worker-entry.js`, `integration-entry.js`, `provider-entry.js`, `smart-router-entry.js`, `google-search-entry.js`, `chat-enhancements-entry.js`, `jarvis-os-entry.js`, `social-growth-entry.js`, `video-failover-entry.js`, `chat-output-entry.js`, `capability-runtime-entry.js`, `media-rescue-entry.js`, `jarvis-orchestrator-entry.js` and `apns-push-entry.js` are compatibility adapters only.

## Data and external services

- D1: chat history, credentials, provider metrics, jobs, notifications, watches and application state.
- Workers AI: fast synthesis, repair and selected generation paths.
- External AI providers: Gemini, NVIDIA, DeepSeek, Mistral, xAI, Together, Fireworks, Groq, OpenRouter and compatible endpoints.
- Video providers: Higgsfield, Replicate, Runway and fal.ai.
- Social publishing: Meta Graph API for owned Instagram/Facebook accounts.
- Search/media integrations: Google search plus image/video providers.
- APNs: native iOS push delivery.
- GitHub Actions: syntax/tests, additive D1 schema, deployment and live health verification.

## Problems found and mitigations

### Deep middleware chain

The original runtime traversed more than a dozen wrapper modules before reaching the base worker. Those wrapper layers have now been removed from the active runtime path and replaced by explicit composition in `src/app-entry.js`. This makes route ownership visible and prevents hidden wrapper ordering from silently changing behavior.

### Shared infrastructure duplication

JSON responses, request parsing, D1 helpers, base64url conversion and AES-GCM credential crypto were repeated throughout entry modules. Shared runtime utilities now live in `src/lib/runtime.js`, including cached AES key import, encryption/decryption, D1 helpers and cancellable fetch.

### Duplicate work on timeout

The orchestrator previously issued a second base chat request after a soft timeout while the first request could still be executing. That retry was removed; fallback now uses independent expert/search paths.

### Unbounded external calls

Provider and integration calls used raw fetches in several paths. Extracted Higgsfield, Replicate, Runway, fal.ai and Meta integration paths now use bounded `fetchWithTimeout` calls where appropriate.

### Hot-path database and crypto work

Provider credential metadata was repeatedly loaded and the credential master key was repeatedly imported. Chat provider rows now have a short isolate cache and the crypto key is cached centrally.

### Sensitive integration state

Meta OAuth app credentials and page access-token state are stored through encrypted credential blobs. Legacy plaintext `meta_pages` KV state is migrated to encrypted storage on read and no longer written back in plaintext. Security regression tests protect this behavior.

### Large source-of-truth files and duplicate trees

`src/worker.js` is now the main remaining large backend source-of-truth file. Nested duplicate trees such as `.github/.github`, `public/public` and `src/src` remain cleanup targets until references are proven absent.

### Regression protection

`npm run check` runs syntax validation plus Node tests for orchestration policy, architecture composition and security invariants. Deployment then applies additive D1 schema and performs a live health check before the change is considered verified.

## Refactor applied

- `src/lib/runtime.js`: JSON, request parsing, D1, timeouts, cancellable fetch and credential crypto.
- `src/lib/orchestration.js`: pure routing/classification, provider scoring and response cleanup policy.
- `src/application/chat/orchestrator.js`: chat orchestration and deterministic fallback.
- `src/application/chat/presenter.js`: reasoning-leak cleanup, language repair and history presentation.
- `src/application/chat/smart-router.js`: provider-aware chat/image/video routing.
- `src/application/chat/enhancements.js`: vision, tool discovery and multimodal enhancements.
- `src/application/media/rescue.js`: media enrichment and recovery.
- `src/application/capabilities/runtime.js`: Runway/fal capability routes and fallback.
- `src/application/providers/higgsfield.js`: official OpenAPI discovery, encrypted credentials, generation/status routes and bounded provider calls.
- `src/application/providers/state.js`: provider-state augmentation.
- `src/application/search/google.js`: Google Programmable Search integration.
- `src/application/integrations/hub.js`: Meta/YouTube integration hub with encrypted Meta page token storage.
- `src/application/os/runtime.js`: JARVIS OS jobs, watches, metrics and memory workflows.
- `src/application/video/failover.js`: Higgsfield/Replicate failover and queue lifecycle.
- `src/application/social/growth.js`: campaign creation, social queue, Meta publishing and webhook handling.
- `src/infrastructure/apns/push-service.js`: APNs registration, delivery and flush.
- `src/app-entry.js`: explicit application composition root around `src/worker.js`.
- Migrated legacy entry files are thin compatibility adapters guarded by architecture tests.

## Improved architecture

`HTTP composition root -> application services -> provider/search/media adapters -> repositories/infrastructure -> response presenter`

Primary boundaries:

- `src/app-entry.js`: composition and dispatch.
- `src/application/chat/`: chat orchestration, routing and presentation.
- `src/application/media/`: media recovery/enrichment.
- `src/application/capabilities/`: capability workflows.
- `src/application/providers/`: provider-specific services and provider state.
- `src/application/search/`: search integrations.
- `src/application/integrations/`: account/platform integration workflows.
- `src/application/video/`: video failover and queues.
- `src/application/social/`: social growth and publishing workflows.
- `src/application/os/`: jobs, watches, memory and system workflows.
- `src/lib/`: shared runtime and pure policy.
- `src/infrastructure/`: APNs and future persistence/observability adapters.

## Next cleanup stages

1. Split `src/worker.js` by authentication/session, chat persistence, credential management and system-state domains behind explicit application/repository boundaries.
2. Add route-contract tests for authentication, chat history/send, Google search, Higgsfield/video-pool, social-growth and APNs routes.
3. Add structured observability for provider latency, timeout and fallback reasons without exposing hidden reasoning.
4. Audit and remove duplicate nested trees only after references are proven absent.
5. Split native iOS `AppState` into focused session/chat/system-action stores and break large SwiftUI views into focused components.
