# JARVIS Architecture

## Runtime overview

JARVIS has two primary clients: the native SwiftUI iOS application under `ios/` and the static PWA under `public/`. Both call the same Cloudflare Worker API.

The Worker entry configured by Wrangler is `src/apns-push-entry.js`. The current backend evolved as a middleware chain in which each `*-entry.js` module imports the previous worker, intercepts routes that it owns, and delegates the rest to `core.fetch`.

Current request path:

`apns-push -> jarvis-orchestrator -> media-rescue -> capability-runtime -> chat-output -> video-failover -> social-growth -> jarvis-os -> chat-enhancements -> google-search -> smart-router -> provider -> integration -> worker-entry -> worker`

Data and external services:

- D1: chat history, credentials, provider metrics, jobs, notifications, watches and application state.
- Workers AI: fast synthesis and selected generation paths.
- External AI providers: Gemini, NVIDIA, DeepSeek, Mistral, xAI, Together, Fireworks, Groq, OpenRouter and compatible endpoints.
- Search/media integrations: Google search plus image/video providers.
- APNs: native iOS push delivery.
- GitHub Actions: syntax/tests, D1 additive schema, deployment and live health verification.

## Problems found

### 1. Deep middleware chain

A normal request may traverse more than a dozen wrapper modules before reaching the base worker. Internal API calls made through `core.fetch` can traverse a large part of the same chain again. Route ownership is implicit in import order, which increases coupling and makes latency and regressions difficult to reason about.

### 2. Shared infrastructure duplicated across modules

JSON responses, request-body parsing, D1 helpers, base64url conversion and AES-GCM credential decryption are repeated in several entry modules. Fixes to these utilities can diverge between modules.

### 3. Duplicate work on timeout

The orchestrator previously started a second `core.fetch` after the first request crossed a soft deadline. The original promise was not cancelled, so both requests could continue concurrently and repeat provider calls or persistence work.

### 4. Hot-path database and crypto work

Provider credentials and provider metrics were loaded from D1 for every orchestrated message. The credential master key was also imported repeatedly. These operations add avoidable latency to every complex request.

### 5. Large source-of-truth files and duplicate repository trees

`src/worker.js`, the native settings/UI files and several web UI modules are large. The repository also contains nested duplicate trees such as `.github/.github`, `public/public` and `src/src`. These make it unclear which files are authoritative and increase maintenance risk.

### 6. Regression protection was syntax-only

`npm run check` previously used only `node --check`. It verified parseability but not routing policy, URL cleanup, provider scoring or fallback behavior.

## Refactor applied

This change intentionally keeps public API behavior stable while improving the hottest path first.

- Added `src/lib/runtime.js` for response, D1, timeout, fetch cancellation and credential decryption utilities.
- Added `src/lib/orchestration.js` for pure routing/classification, provider scoring and output cleanup policy.
- Rewrote `src/jarvis-orchestrator-entry.js` around explicit `simpleChat` and `orchestratedChat` flows.
- Removed duplicate `core.fetch` retries after soft timeouts. A request now has one base execution path and deterministic fallbacks.
- Added a short in-isolate TTL cache for provider rows and a cached imported credential key.
- Kept external provider fetches cancellable through `AbortController`.
- Converted web fallback sources to compact Markdown links rather than raw URLs.
- Added Node test coverage for the extracted orchestration policy and made tests part of `npm run check`.

## Target architecture

The long-term target is an explicit composition root rather than another layer in the wrapper chain:

`HTTP entry -> router -> auth/context -> application service -> provider/search/media adapters -> repositories -> response presenter`

Suggested module boundaries:

- `src/http/`: route registration, request parsing, response mapping.
- `src/application/`: chat orchestration, jobs, watches, notification workflows.
- `src/domain/`: routing policy and provider scoring with no platform dependencies.
- `src/adapters/ai/`: provider clients and failover.
- `src/adapters/search/`: Google and other research sources.
- `src/adapters/media/`: image/video providers.
- `src/infrastructure/`: D1 repositories, encryption, APNs, observability.

Migration should be incremental. New logic should use these boundaries, while existing entry wrappers are reduced one at a time after route-level regression tests exist.

## Next cleanup stages

1. Move repeated runtime/crypto/D1 helpers from the remaining entry modules to `src/lib/runtime.js`.
2. Add contract tests for `/api/chat/send`, authentication, Google search, media failover and APNs routes.
3. Introduce an explicit route table and migrate wrappers into route handlers/services.
4. Split `src/worker.js` by domain once route contracts are protected by tests.
5. Audit and remove nested duplicate trees only after CI confirms they are unreferenced.
6. Split native `AppState` into session/chat/system-action stores and break `ContentView`/`SettingsView` into focused views.
