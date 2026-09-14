# JARVIS Architecture

## Runtime overview

JARVIS has two primary clients: the native SwiftUI iOS application under `ios/` and the static PWA under `public/`. Both call the same Cloudflare Worker API.

Wrangler points to the explicit composition root `src/app-entry.js`. The root now composes APNs, chat orchestration, media rescue, chat output cleanup, capability runtime, video failover and social growth as services.

Current remaining legacy request path below the composition root:

`app-entry -> jarvis-os -> chat-enhancements -> google-search -> smart-router -> provider -> integration -> worker-entry -> worker`

For `/api/chat/send`, the composition root builds the application stack explicitly:

`social growth -> video failover -> chat output presenter -> capability runtime -> media rescue -> chat orchestrator`

APNs is composed separately as infrastructure. The old `apns-push-entry.js`, `jarvis-orchestrator-entry.js`, `media-rescue-entry.js`, `capability-runtime-entry.js`, `chat-output-entry.js`, `video-failover-entry.js` and `social-growth-entry.js` are thin compatibility adapters only.

## Data and external services

- D1: chat history, credentials, provider metrics, jobs, notifications, watches and application state.
- Workers AI: fast synthesis, repair and selected generation paths.
- External AI providers: Gemini, NVIDIA, DeepSeek, Mistral, xAI, Together, Fireworks, Groq, OpenRouter and compatible endpoints.
- Video providers: Higgsfield, Replicate, Runway and fal.ai.
- Social publishing: Meta Graph API for owned Instagram/Facebook accounts.
- Search/media integrations: Google search plus image/video providers.
- APNs: native iOS push delivery.
- GitHub Actions: syntax/tests, D1 additive schema, deployment and live health verification.

## Problems found and mitigations

### Deep middleware chain

The original runtime traversed more than a dozen wrapper modules before reaching the base worker. Seven wrapper layers have now been removed from the active runtime path and replaced by explicit composition. The remaining legacy chain begins at `jarvis-os-entry.js`.

### Shared infrastructure duplication

JSON responses, request parsing, D1 helpers, base64url conversion and AES-GCM credential crypto were repeated throughout entry modules. Shared runtime utilities now live in `src/lib/runtime.js`, including cached AES key import, encryption/decryption, D1 helpers and cancellable fetch.

### Duplicate work on timeout

The orchestrator previously issued a second base chat request after a soft timeout while the first request could still be executing. That retry was removed; fallback now uses independent expert/search paths.

### Unbounded external calls

Video and social provider requests previously used raw fetches in multiple paths. Extracted Higgsfield, Replicate, Runway, fal.ai and Meta publishing paths use bounded `fetchWithTimeout` calls where applicable.

### Hot-path database and crypto work

Provider credential metadata was loaded repeatedly and the credential master key was re-imported. Chat provider rows now have a short isolate cache and the crypto key is cached centrally.

### Large source-of-truth files and duplicate trees

`src/worker.js` and `src/jarvis-os-entry.js` remain large. Nested duplicate trees such as `.github/.github`, `public/public` and `src/src` remain cleanup targets until references are proven absent.

### Regression protection

`npm run check` now runs Node tests for orchestration policy and architecture composition in addition to syntax validation.

## Refactor applied

- `src/lib/runtime.js`: JSON, request parsing, D1, timeouts, cancellable fetch and credential crypto.
- `src/lib/orchestration.js`: pure routing/classification, provider scoring and response cleanup policy.
- `src/application/chat/orchestrator.js`: chat orchestration and deterministic fallback.
- `src/application/chat/presenter.js`: reasoning-leak cleanup, language repair and history presentation.
- `src/application/media/rescue.js`: image/video enrichment and media recovery.
- `src/application/capabilities/runtime.js`: Runway/fal capability routes and fallback.
- `src/application/video/failover.js`: Higgsfield/Replicate failover and queue lifecycle.
- `src/application/social/growth.js`: campaign creation, social queue, Meta publishing and webhook handling.
- `src/infrastructure/apns/push-service.js`: APNs registration, delivery and flush.
- `src/app-entry.js`: explicit application composition root.
- Migrated legacy entry files are compatibility adapters guarded by architecture tests.

## Improved architecture

`HTTP composition root -> application services -> provider/search/media adapters -> repositories/infrastructure -> response presenter`

Primary boundaries:

- `src/app-entry.js`: composition and dispatch.
- `src/application/chat/`: chat orchestration and presentation.
- `src/application/media/`: media recovery/enrichment.
- `src/application/capabilities/`: capability workflows.
- `src/application/video/`: video failover and queues.
- `src/application/social/`: social growth and publishing workflows.
- `src/lib/`: shared runtime and pure policy.
- `src/infrastructure/`: APNs and future persistence/observability adapters.

## Next cleanup stages

1. Extract `jarvis-os-entry.js` into jobs, watches and notification application services.
2. Move Google search and smart-router logic behind explicit adapters instead of wrapper routing.
3. Split `src/worker.js` by authentication, chat persistence, credential management and system state after route-contract coverage exists.
4. Add contract tests for chat send/history, authentication, Google search, video-pool, social-growth and APNs routes.
5. Audit and remove duplicate nested trees only after references are proven absent.
6. Split native iOS `AppState` into focused stores and break large SwiftUI views into focused components.
