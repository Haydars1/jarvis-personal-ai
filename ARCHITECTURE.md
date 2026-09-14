# JARVIS Architecture

## Runtime overview

JARVIS has two primary clients: the native SwiftUI iOS application under `ios/` and the static PWA under `public/`. Both call the same Cloudflare Worker API.

Wrangler points to the explicit composition root `src/app-entry.js`. The root now composes APNs, chat orchestration, media rescue, chat output cleanup, capability runtime and video failover as services instead of making those concerns own the Worker entry chain.

Current remaining legacy request path below the composition root:

`app-entry -> social-growth -> jarvis-os -> chat-enhancements -> google-search -> smart-router -> provider -> integration -> worker-entry -> worker`

For `/api/chat/send`, the composition root builds this stack explicitly:

`video failover -> chat output presenter -> capability runtime -> media rescue -> chat orchestrator`

APNs is composed separately as infrastructure. The old `apns-push-entry.js`, `jarvis-orchestrator-entry.js`, `media-rescue-entry.js`, `capability-runtime-entry.js`, `chat-output-entry.js` and `video-failover-entry.js` remain thin compatibility adapters only.

Data and external services:

- D1: chat history, credentials, provider metrics, jobs, notifications, watches and application state.
- Workers AI: fast synthesis, repair and selected generation paths.
- External AI providers: Gemini, NVIDIA, DeepSeek, Mistral, xAI, Together, Fireworks, Groq, OpenRouter and compatible endpoints.
- Video providers: Higgsfield, Replicate, Runway and fal.ai.
- Search/media integrations: Google search plus image/video providers.
- APNs: native iOS push delivery.
- GitHub Actions: syntax/tests, D1 additive schema, deployment and live health verification.

## Problems found

### 1. Deep middleware chain

The original runtime traversed more than a dozen wrapper modules before reaching the base worker. Internal `core.fetch` calls could traverse large sections of the same chain again. Route ownership was implicit in import order, increasing coupling and making latency difficult to reason about.

Six wrapper layers have now been removed from the active runtime path and replaced by explicit composition. The remaining chain begins at `social-growth-entry.js`.

### 2. Shared infrastructure duplicated across modules

JSON responses, request parsing, D1 helpers, base64url conversion and AES-GCM credential crypto were repeated throughout entry modules. Shared runtime utilities now live in `src/lib/runtime.js`, including cached AES key import, encrypt/decrypt helpers, D1 helpers and cancellable fetch.

### 3. Duplicate work on timeout

The orchestrator previously issued a second `core.fetch` after a soft timeout while the first request could still be executing. That retry was removed; fallback now uses independent expert/search paths rather than duplicating the base chat request.

### 4. Unbounded external calls

Several video provider requests previously used raw `fetch` without a timeout. Extracted Higgsfield, Replicate, Runway and fal.ai paths now use `fetchWithTimeout`, reducing the chance that a provider stalls a Worker request indefinitely.

### 5. Hot-path database and crypto work

Provider credentials and metrics were loaded repeatedly and the credential master key was re-imported. Chat provider rows now have a short isolate cache and the crypto key is cached centrally.

### 6. Large source-of-truth files and duplicate repository trees

`src/worker.js`, `src/jarvis-os-entry.js`, `src/social-growth-entry.js` and several native/web UI files remain large. The repository also contains nested duplicate trees such as `.github/.github`, `public/public` and `src/src`; these remain cleanup targets until references are proven absent.

### 7. Regression protection was syntax-only

`npm run check` now runs Node tests for orchestration and architecture composition in addition to syntax validation.

## Refactor applied

- `src/lib/runtime.js`: JSON, request parsing, D1 helpers, timeout helpers, cancellable fetch and shared credential encryption/decryption.
- `src/lib/orchestration.js`: pure routing/classification, provider scoring and response cleanup policy.
- `src/application/chat/orchestrator.js`: chat orchestration and deterministic fallback.
- `src/application/chat/presenter.js`: reasoning-leak cleanup, language repair and history presentation with bounded repair latency.
- `src/application/media/rescue.js`: image/video enrichment and media recovery.
- `src/application/capabilities/runtime.js`: Runway/fal capability routes, provider testing and extra video fallback.
- `src/application/video/failover.js`: Higgsfield/Replicate failover, cooldowns, provider metrics and queue processing.
- `src/infrastructure/apns/push-service.js`: APNs registration, delivery and flush.
- `src/app-entry.js`: explicit application composition root.
- Wrangler `main` points to `src/app-entry.js`.
- Migrated entry files are thin adapters guarded by architecture tests.

## Improved architecture

Current structure:

`HTTP composition root -> application services -> provider/search/media adapters -> repositories/infrastructure -> response presenter`

Module boundaries:

- `src/app-entry.js`: top-level composition and dispatch.
- `src/application/chat/`: orchestration and response presentation.
- `src/application/media/`: media recovery/enrichment.
- `src/application/capabilities/`: capability-specific workflows and provider fallback.
- `src/application/video/`: video-provider failover and queue lifecycle.
- `src/lib/orchestration.js`: pure routing/provider policy.
- `src/lib/runtime.js`: shared infrastructure primitives.
- `src/infrastructure/`: APNs and future D1/observability repositories.

Migration stays incremental so public API behavior remains stable while each legacy wrapper is removed only after tests exist.

## Next cleanup stages

1. Extract `social-growth-entry.js` into application services and adapters.
2. Extract `jarvis-os-entry.js` into jobs/watches/notification application services.
3. Move Google search and smart-router logic behind explicit adapters instead of wrapper routing.
4. Split `src/worker.js` by authentication, chat persistence, credential management and system-state domains after route-contract coverage exists.
5. Add contract tests for chat send/history, authentication, Google search, video-pool routes and APNs routes.
6. Audit and remove `.github/.github`, `public/public` and `src/src` only after references are proven absent.
7. Split native `AppState` into session/chat/system-action stores and break large SwiftUI views into focused components.
