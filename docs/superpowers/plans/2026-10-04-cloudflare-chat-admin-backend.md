# Cloudflare Chat Admin Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Floot database/auth/push/chat primitives with a Cloudflare Worker + D1 backend that supports public customer chat, AI/human takeover state, notifications, and protected admin APIs.

**Architecture:** Keep the React app backend-neutral and expose JSON endpoints from a dedicated Worker under `worker/`. D1 is the durable source of truth; Cloudflare Access protects admin surfaces, while visitor chat endpoints remain public, validated, rate-limited, and origin-restricted. AI and Web Push are adapter interfaces so preview/local development works before provider secrets are supplied.

**Tech Stack:** Cloudflare Workers, D1, Wrangler, TypeScript, Vitest, Web Push, Cloudflare Access.

**Spec:** `docs/superpowers/specs/2026-10-04-cloudflare-migration-design.md`

## Global Constraints

- No Floot database/auth/push/runtime code.
- No secret may be present in frontend source or bundle.
- D1 stores chat state/messages; KV, if later added, is only cache/rate-limit/idempotency support.
- Human takeover must win over in-flight AI replies.
- Public API inputs require schema validation and body-size limits.
- Admin authorization must not trust user-editable request data; use verified Cloudflare Access identity/assertion server-side.
- External AI/push secrets are not created or changed in this plan without explicit approval.
- Production deployment is out of scope.

## Review Focus

- Duplicate/retried visitor POSTs must not create duplicate messages or duplicate owner milestones.
- AI completion racing with owner takeover must be discarded after takeover.
- Unknown/expired admin identity must return 401/403, never admin data.
- Oversized or malformed public chat payloads must fail with 400/413 without touching D1.
- Conversation language/vehicle/fault context updates must not erase previously collected contact data.

---

### Task 1: Create Worker package, bindings contract, and local test harness

**Files:**
- Create: `worker/package.json`, `worker/tsconfig.json`, `worker/wrangler.jsonc`
- Create: `worker/src/index.ts`, `worker/src/env.ts`, `worker/src/http.ts`
- Test: `worker/src/index.test.ts`

**Interfaces:**
- Produces: `Env` with `DB: D1Database`, optional AI/Web Push bindings, and `ALLOWED_ORIGIN`; Worker `fetch(request, env, ctx): Promise<Response>`.

- [ ] **Step 1: Write failing health/CORS tests**
  - `GET /api/health` → 200 JSON.
  - Disallowed origin on public API → 403.
  - Allowed origin receives correct CORS headers.

- [ ] **Step 2: Verify RED**
  - Run: `npm --prefix worker test -- --run src/index.test.ts`

- [ ] **Step 3: Implement minimal router, JSON helpers, and Env types**
  - Keep routing explicit; do not add a framework unless required.

- [ ] **Step 4: Verify GREEN/typecheck**
  - Run: `npm --prefix worker test -- --run && npm --prefix worker run typecheck`

- [ ] **Step 5: Commit**
  - `build(6006): establish cloudflare worker api`

### Task 2: Define D1 schema and repository layer

**Files:**
- Create via Wrangler: `worker/migrations/<generated>_chat_core.sql`
- Create: `worker/src/db/types.ts`, `worker/src/db/chat-repository.ts`
- Test: `worker/src/db/chat-repository.test.ts`

**Interfaces:**
- Produces `ChatRepository`: `createConversation`, `getConversation`, `appendMessage`, `updateConversationContext`, `claimHumanTakeover`, `releaseHumanTakeover`, `beginAiTurn`, `commitAiTurn`, `recordMilestone`.

- [ ] **Step 1: Write failing repository/state-machine tests**
  - New conversation begins `ai_active`.
  - Takeover changes state to `human_active`.
  - `commitAiTurn` reports stale when revision changed after takeover.
  - Duplicate `(conversation_id,milestone)` is deduped.

- [ ] **Step 2: Create migration using Wrangler**
  - From `worker/`: `npx wrangler d1 migrations create DB chat_core`.
  - Use the filename Wrangler generates.
  - Define `conversations`, `messages`, `notification_milestones`, `push_subscriptions`, indexes, unique constraints, and a revision column for race protection.

- [ ] **Step 3: Apply migration locally and verify repository tests are RED**
  - From `worker/`: `npx wrangler d1 migrations apply DB --local`.

- [ ] **Step 4: Implement repository with prepared statements**
  - User values only through `.bind(...)`.

- [ ] **Step 5: Verify GREEN**
  - Run: `npm --prefix worker test -- --run src/db/chat-repository.test.ts`

- [ ] **Step 6: Commit**
  - `feat(6006): add d1 chat repository`

### Task 3: Implement public chat API with idempotent writes

**Files:**
- Create: `worker/src/chat/schemas.ts`, `worker/src/chat/service.ts`, `worker/src/routes/chat.ts`
- Test: `worker/src/routes/chat.test.ts`

**Interfaces:**
- Endpoints: `POST /api/chat/start`, `GET /api/chat/:id`, `POST /api/chat/:id/messages`.
- Message writes consume `Idempotency-Key`.

- [ ] **Step 1: Write failing API tests**
  - Start persists language/page/fault/vehicle context.
  - Same idempotency key never duplicates a message.
  - Invalid schema → 400; oversized body → 413.
  - Context updates preserve existing contact data.

- [ ] **Step 2: Verify RED**
  - Run: `npm --prefix worker test -- --run src/routes/chat.test.ts`

- [ ] **Step 3: Implement routes/service**
  - Normalize language to `de|tr|en`.
  - Return only visitor-safe fields.

- [ ] **Step 4: Verify GREEN/typecheck**

- [ ] **Step 5: Commit**
  - `feat(6006): implement public chat api`

### Task 4: Implement AI provider abstraction and takeover race protection

**Files:**
- Create: `worker/src/ai/provider.ts`, `worker/src/ai/prompt.ts`, `worker/src/ai/fallback-provider.ts`, `worker/src/chat/ai-turn.ts`
- Test: `worker/src/chat/ai-turn.test.ts`

**Interfaces:**
- `AiProvider.reply(input): Promise<AiReply>`.
- `runAiTurn(repo, provider, conversationId): Promise<"sent"|"stale"|"disabled">`.

- [ ] **Step 1: Write failing AI-turn tests**
  - Reply language matches conversation language.
  - Takeover before completion produces `stale` and persists no AI message.
  - `human_active` never calls the provider.
  - Prompt explicitly avoids definitive failed-part claims from a single DTC.

- [ ] **Step 2: Verify RED**
  - Run: `npm --prefix worker test -- --run src/chat/ai-turn.test.ts`

- [ ] **Step 3: Implement provider interface and local fallback**
  - No paid/external provider required yet.

- [ ] **Step 4: Implement revision-checked AI commit**

- [ ] **Step 5: Verify GREEN/typecheck**

- [ ] **Step 6: Commit**
  - `feat(6006): protect ai replies from human takeover races`

### Task 5: Implement owner notification milestones and Web Push adapter

**Files:**
- Create: `worker/src/notifications/milestones.ts`, `worker/src/notifications/push.ts`, `worker/src/routes/push.ts`
- Test: `worker/src/notifications/milestones.test.ts`, `worker/src/routes/push.test.ts`

**Interfaces:**
- Produces milestone detector; `PushSender`; `POST /api/admin/push/subscriptions`; notification deep link `/admin/chat/:conversationId`.

- [ ] **Step 1: Write failing milestone/dedupe tests**
  - Phone captured, vehicle complete, DTC+symptom, human requested each trigger once.

- [ ] **Step 2: Verify RED**
  - Run: `npm --prefix worker test -- --run src/notifications/milestones.test.ts src/routes/push.test.ts`

- [ ] **Step 3: Implement detector and subscription storage**
  - Keep push sending adapter-driven for tests.

- [ ] **Step 4: Verify GREEN/typecheck**

- [ ] **Step 5: Commit**
  - `feat(6006): add owner notification milestones`

### Task 6: Implement Cloudflare Access-protected admin API

**Files:**
- Create: `worker/src/auth/access.ts`, `worker/src/routes/admin.ts`
- Test: `worker/src/auth/access.test.ts`, `worker/src/routes/admin.test.ts`

**Interfaces:**
- `requireAdmin(request, env): Promise<AdminIdentity>`.
- Endpoints: list/read conversations, takeover, release, owner reply.

- [ ] **Step 1: Write failing auth/admin tests**
  - Missing/invalid Access identity → 401/403.
  - Valid configured owner can list/read/takeover/release/reply.
  - Owner reply rejected unless state is `human_active`.

- [ ] **Step 2: Verify RED**
  - Run: `npm --prefix worker test -- --run src/auth/access.test.ts src/routes/admin.test.ts`

- [ ] **Step 3: Implement Access identity verification adapter**
  - Production verifies Cloudflare Access assertion/identity; never trust public email headers.

- [ ] **Step 4: Implement admin routes/state transitions**

- [ ] **Step 5: Verify GREEN/typecheck**

- [ ] **Step 6: Commit**
  - `feat(6006): add access protected admin api`

### Task 7: Wire admin React pages to the Worker API

**Files:**
- Create: `src/admin/api.ts`, `src/pages/AdminPage.tsx`, `src/pages/AdminChatPage.tsx`
- Test: `src/pages/AdminPage.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes the configurable public Worker API base from frontend Plan Task 6.
- Produces `/admin` and `/admin/chat/:conversationId`; no local password form.

- [ ] **Step 1: Write failing admin UI tests**
  - List/status/context render.
  - Takeover/release calls correct endpoints.
  - Owner reply only in human mode.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement admin pages/API client**
  - No `owner@6006.local`; no password form.

- [ ] **Step 4: Verify GREEN/build**

- [ ] **Step 5: Commit**
  - `feat(6006): rebuild admin chat without floot auth`

### Task 8: End-to-end local backend verification

**Files:**
- Create: `worker/src/e2e/chat-flow.test.ts`
- Modify root scripts only if needed.

**Interfaces:**
- Produces a repeatable local verification command for D1 + Worker + frontend API contract.

- [ ] **Step 1: Add full flow test**
  - Visitor starts → posts → AI fallback → milestone → owner takeover → visitor posts with no AI → owner reply → release → AI may answer again.

- [ ] **Step 2: Run local migrations and both suites**
  - Worker: local migration, tests, typecheck.
  - Frontend: tests, typecheck, build.

- [ ] **Step 3: Search runtime source for forbidden Floot backend dependencies**

- [ ] **Step 4: Commit**
  - `test(6006): verify cloudflare chat takeover flow`
