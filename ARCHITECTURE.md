# JARVIS Architecture

## Runtime overview

JARVIS has two primary clients: the native SwiftUI iOS application under `ios/` and the static PWA under `public/`. Both call the same Cloudflare Worker API.

Wrangler now points to the explicit composition root `src/app-entry.js`. That root owns top-level route composition for chat and mobile push instead of making `apns-push-entry.js` the runtime entrypoint.

Current active request path:

`app-entry -> capability-runtime -> chat-output -> video-failover -> social-growth -> jarvis-os -> chat-enhancements -> google-search -> smart-router -> provider -> integration -> worker-entry -> worker`

For `/api/chat/send`, `app-entry` composes the media-rescue application service around `capability-runtime`, then composes the chat orchestrator around that media-aware core. APNs is composed as an infrastructure service instead of a runtime wrapper. The old `apns-push-entry.js`, `jarvis-orchestrator-entry.js` and `media-rescue-entry.js` remain as thin compatibility adapters only.

Data and external services:

- D1: chat history, credentials, provider metrics, jobs, notifications, watches and application state.
- Workers AI: fast synthesis and selected generation paths.
- External AI providers: Gemini, NVIDIA, DeepSeek, Mistral, xAI, Together, Fireworks, Groq, OpenRouter and compatible endpoints.
- Search/media integrations: Google search plus image/video providers.
- APNs: native iOS push delivery.
- GitHub Actions: syntax/tests, D1 additive schema, deployment and live health verification.

## Problems found

### 1. Deep middleware chain

The original runtime traversed more than a dozen wrapper modules before reaching the base worker. Internal API calls through `core.fetch` could traverse a large part of the same chain again. Route ownership was implicit in import order, which increased coupling and made latency and regressions difficult to reason about.

The first three top-level wrappers have now been removed from the active runtime chain. Remaining wrappers still need incremental migration.

### 2. Shared infrastructure duplicated across modules

JSON responses, request-body parsing, D1 helpers, base64url conversion and AES-GCM credential decryption were repeated in several entry modules. Shared runtime utilities now live in `src/lib/runtime.js`; remaining modules should migrate to them as they are touched.

### 3. Duplicate work on timeout

The orchestrator previously started a second `core.fetch` after the first request crossed a soft deadline. The original promise was not cancelled, so both requests could continue concurrently and repeat provider calls or persistence work. This retry has been removed.

### 4. Hot-path database and crypto work

Provider credentials and provider metrics were loaded from D1 for every orchestrated message. The credential master key was also imported repeatedly. Provider rows now have a short in-isolate TTL cache and the imported credential key is cached.

### 5. Large source-of-truth files and duplicate repository trees

`src/worker.js`, the native settings/UI files and several web UI modules are large. The repository also contains nested duplicate trees such as `.github/.github`, `public/public` and `src/src`. These remain cleanup targets until CI proves they are unreferenced.

### 6. Regression protection was syntax-only

`npm run check` previously used only `node --check`. It now includes Node tests for orchestration policy and architecture wiring.

## Refactor applied

- Added `src/lib/runtime.js` for response, D1, timeout, fetch cancellation and credential decryption utilities.
- Added `src/lib/orchestration.js` for pure routing/classification, provider scoring and output cleanup policy.
- Added `src/application/chat/orchestrator.js` as the chat application service.
- Added `src/application/media/rescue.js` as the media-rescue application service.
- Added `src/infrastructure/apns/push-service.js` for APNs registration, delivery and flush logic.
- Added `src/app-entry.js` as the explicit application composition root.
- Changed Wrangler `main` from `src/apns-push-entry.js` to `src/app-entry.js`.
- Converted APNs, orchestrator and media-rescue entry files into compatibility adapters.
- Removed duplicate `core.fetch` retries after soft timeouts.
- Added a short in-isolate TTL cache for provider rows and a cached imported credential key.
- Kept external provider fetches cancellable through `AbortController`.
- Added architecture regression tests so the Worker cannot silently switch back to the wrapper entry chain.

## Improved architecture

Current migration target:

`HTTP composition root -> application service -> provider/search/media adapters -> repositories/infrastructure -> response presenter`

Module boundaries:

- `src/app-entry.js`: composition root and top-level route dispatch.
- `src/application/chat/`: chat orchestration workflow.
- `src/application/media/`: media recovery/enrichment workflow.
- `src/domain/` or `src/lib/orchestration.js`: pure routing and provider scoring policy.
- `src/adapters/ai/`: future provider clients and failover.
- `src/adapters/search/`: future Google and other research adapters.
- `src/adapters/media/`: future image/video provider adapters.
- `src/infrastructure/`: D1 repositories, encryption, APNs and observability.

Migration remains incremental so public API behavior stays stable while each wrapper is removed only after regression coverage exists.

## Next cleanup stages

1. Extract capability-runtime route handlers and provider credential operations into application/infrastructure modules.
2. Move repeated runtime/crypto/D1 helpers from the remaining entry modules to `src/lib/runtime.js`.
3. Add contract tests for `/api/chat/send`, authentication, Google search, media failover and APNs routes.
4. Continue collapsing `chat-output`, `video-failover`, `social-growth`, `jarvis-os` and search/router wrappers into explicit route/service composition.
5. Split `src/worker.js` by authentication, chat persistence, credentials and system-state domains once route contracts are protected by tests.
6. Audit and remove `.github/.github`, `public/public` and `src/src` only after references are proven absent.
7. Split native `AppState` into session/chat/system-action stores and break `ContentView`/`SettingsView` into focused views.
