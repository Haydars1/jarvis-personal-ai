# Cloudflare Chat Admin Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Floot database/auth/push/chat primitives with a Cloudflare Worker + D1 backend that supports public customer chat, AI/human takeover state, notifications, and protected admin APIs.

**Architecture:** Keep the public React app backend-neutral and expose JSON endpoints from a dedicated Worker under `worker/`. D1 is the durable source of truth; Cloudflare Access protects admin UI/API paths, while visitor chat endpoints remain public, validated, rate-limited, and origin-restricted. AI and Web Push are adapter interfaces so deployment can proceed before provider secrets are supplied.

**Tech Stack:** Cloudflare Workers, D1, Wrangler, TypeScript, Vitest, Web Push, Cloudflare Access.

**Spec:** `docs/superpowers/specs/2026-10-04-cloudflare-migration-design.md`

## Global Constraints

- No Floot database/auth/push/runtime code.
- No secret may be present in frontend source or bundle.
- D1 stores chat state/messages; KV, if later added, is only cache/rate-limit/idempotency support.
- Human takeover must win over in-flight AI replies.
- Public API inputs require schema validation and body-size limits.
- Admin authorization must not trust user-editable request data; rely on Cloudflare Access identity/assertion verified server-side or a test adapter in unit tests.
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
- Create: `worker/package.json`
- Create: `worker/tsconfig.json`
- Create: `worker/wrangler.jsonc`
- Create: `worker/src/index.ts`
- Create: `worker/src/env.ts`
- Create: `worker/src/http.ts`
- Create: `worker/src/index.test.ts`

**Interfaces:**
- Produces: `Env` with `DB: D1Database`, optional `AI_PROVIDER_KEY`, Web Push secret bindings, and `ALLOWED_ORIGIN`; Worker `fetch(request, env, ctx): Promise<Response>`.

- [ ] **Step 1: Write failing health/CORS tests**
  - `GET /api/health` → 200 JSON.
  - Disallowed origin on public API → 403.
  - Allowed origin receives correct CORS headers.

- [ ] **Step 2: Verify RED**
  - Run: `npm --prefix worker test -- --run worker/src/index.test.ts`

- [ ] **Step 3: Implement minimal router, JSON helpers, and Env types**
  - Keep route dispatch explicit; do not introduce a framework unless tests show a need.

- [ ] **Step 4: Verify GREEN/typecheck**
  - Run: `npm --prefix worker test -- --run && npm --prefix worker run typecheck`

- [ ] **Step 5: Commit**
  - Commit message: `build(6006): establish cloudflare worker api`

### Task 2: Define D1 schema and repository layer

**Files:**
- Create: `worker/migrations/0001_chat_core.sql`
- Create: `worker/src/db/types.ts`
- Create: `worker/src/db/chat-repository.ts`
- Create: `worker/src/db/chat-repository.test.ts`

**Interfaces:**
- Produces: `ChatRepository` methods `createConversation`, `getConversation`, `appendMessage`, `updateConversationContext`, `claimHumanTakeover`, `releaseHumanTakeover`, `beginAiTurn`, `commitAiTurn`, `recordMilestone`.

- [ ] **Step 1: Write repository/state-machine tests**
  - New conversation begins `ai_active`.
  - Owner takeover changes state to `human_active`.
  - `commitAiTurn` fails/returns stale when revision changed after takeover.
  - Duplicate `(conversation_id,milestone)` is rejected/deduped.

- [ ] **Step 2: Create migration using Wrangler command**
  - Run: `npx wrangler d1 migrations create DB chat_core` from `worker/` and use the generated filename; do not invent a second migration filename if Wrangler generated a different sequence.
  - Migration defines `conversations`, `messages`, `notification_milestones`, `push_subscriptions` with indexes/constraints from the spec.

- [ ] **Step 3: Apply migration to local D1 and verify RED repository tests**
  - Run: `npx wrangler d1 migrations apply DB --local`
  - Then run repository tests.

- [ ] **Step 4: Implement prepared-statement repository methods**
  - All values use `.bind(...)`; no SQL string interpolation for user data.

- [ ] **Step 5: Verify GREEN**
  - Run: local D1 migration + `npm --prefix worker test -- --run worker/src/db/chat-repository.test.ts`

- [ ] **Step 6: Commit**
  - Commit message: `feat(6006): add d1 chat repository`

### Task 3: Implement public chat API with idempotent writes

**Files:**
- Create: `worker/src/chat/schemas.ts`
- Create: `worker/src/chat/service.ts`
- Create: `worker/src/routes/chat.ts`
- Create: `worker/src/routes/chat.test.ts`

**Interfaces:**
- Produces endpoints: `POST /api/chat/start`, `GET /api/chat/:id`, `POST /api/chat/:id/messages`.
- Consumes client idempotency key header `Idempotency-Key` on message writes.

- [ ] **Step 1: Write failing API tests**
  - Start persists language/page/fault/vehicle context.
  - Valid visitor message persists once.
  - Same idempotency key retried does not duplicate message.
  - Invalid JSON/schema → 400; body over configured maximum → 413.
  - Context update preserves existing contact fields.

- [ ] **Step 2: Verify RED**
  - Run: `npm --prefix worker test -- --run worker/src/routes/chat.test.ts`

- [ ] **Step 3: Implement public chat routes/service**
  - Use explicit schema parsing and normalized language `de|tr|en`.
  - Return only visitor-safe conversation fields.

- [ ] **Step 4: Verify GREEN**
  - Run: route tests + worker typecheck.

- [ ] **Step 5: Commit**
  - Commit message: `feat(6006): implement public chat api`

### Task 4: Implement AI provider abstraction and takeover race protection

**Files:**
- Create: `worker/src/ai/provider.ts`
- Create: `worker/src/ai/prompt.ts`
- Create: `worker/src/ai/fallback-provider.ts`
- Create: `worker/src/chat/ai-turn.ts`
- Create: `worker/src/chat/ai-turn.test.ts`

**Interfaces:**
- Produces: `AiProvider.reply(input): Promise<AiReply>`; `runAiTurn(repo,provider,conversationId): Promise<"sent"|"stale"|"disabled">`.

- [ ] **Step 1: Write failing AI-turn tests**
  - Response language matches conversation language.
  - Human takeover before completion makes result `stale` and no AI message is persisted.
  - `human_active` conversation returns `disabled` without invoking provider.
  - Prompt states that a DTC is not a definitive failed-part diagnosis.

- [ ] **Step 2: Verify RED**
  - Run: `npm --prefix worker test -- --run worker/src/chat/ai-turn.test.ts`

- [ ] **Step 3: Implement provider interface and fallback provider**
  - Do not connect/spend on an external provider yet; fallback behavior keeps local/preview flow testable.

- [ ] **Step 4: Implement revision-checked AI commit**
  - `beginAiTurn` captures state/revision; `commitAiTurn` only writes when still `ai_active` at the same revision.

- [ ] **Step 5: Verify GREEN**
  - Run AI-turn tests and typecheck.

- [ ] **Step 6: Commit**
  - Commit message: `feat(6006): protect ai replies from human takeover races`

### Task 5: Implement owner notification milestones and Web Push adapter

**Files:**
- Create: `worker/src/notifications/milestones.ts`
- Create: `worker/src/notifications/push.ts`
- Create: `worker/src/routes/push.ts`
- Create: `worker/src/notifications/milestones.test.ts`
- Create: `worker/src/routes/push.test.ts`

**Interfaces:**
- Produces: milestone detector; `PushSender` interface; `POST /api/admin/push/subscriptions`; notification deep link `/admin/chat/:conversationId`.

- [ ] **Step 1: Write failing dedupe/milestone tests**
  - Phone captured, vehicle complete, DTC+symptom, human requested each trigger once.
  - Repeated same condition does not trigger again.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement milestone detector and subscription storage**
  - Web Push sender remains adapter-driven so tests do not require live credentials.

- [ ] **Step 4: Verify GREEN**
  - Run notification tests and typecheck.

- [ ] **Step 5: Commit**
  - Commit message: `feat(6006): add owner notification milestones`

### Task 6: Implement Cloudflare Access-protected admin API

**Files:**
- Create: `worker/src/auth/access.ts`
- Create: `worker/src/auth/access.test.ts`
- Create: `worker/src/routes/admin.ts`
- Create: `worker/src/routes/admin.test.ts`

**Interfaces:**
- Produces: `requireAdmin(request, env): Promise<AdminIdentity>`; endpoints `GET /api/admin/conversations`, `GET /api/admin/conversations/:id`, `POST /api/admin/conversations/:id/takeover`, `POST /api/admin/conversations/:id/release`, `POST /api/admin/conversations/:id/messages`.

- [ ] **Step 1: Write failing authorization/admin tests**
  - Missing/invalid Access identity → 401/403.
  - Valid configured owner identity can list/read/takeover/release/reply.
  - Owner reply rejected unless state is `human_active`.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement Access identity verification adapter**
  - Unit tests inject a verifier; production verifier validates Cloudflare Access assertion/identity rather than trusting email headers from the public internet.

- [ ] **Step 4: Implement admin routes/state transitions**

- [ ] **Step 5: Verify GREEN**
  - Run auth/admin tests and typecheck.

- [ ] **Step 6: Commit**
  - Commit message: `feat(6006): add access protected admin api`

### Task 7: Wire admin React pages to the Worker API

**Files:**
- Create: `src/admin/api.ts`
- Create: `src/pages/AdminPage.tsx`
- Create: `src/pages/AdminChatPage.tsx`
- Create: `src/pages/AdminPage.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: admin JSON API from Task 6.
- Produces: `/admin` and `/admin/chat/:conversationId` UI; no local password form.

- [ ] **Step 1: Write failing admin UI tests**
  - Conversation list renders statuses/context.
  - Takeover button calls takeover endpoint and changes controls.
  - Release re-enables AI state.
  - Owner reply available only during human mode.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement admin pages/API client**
  - Remove any dependency on `owner@6006.local` or password forms from the standalone app.

- [ ] **Step 4: Verify GREEN/build**
  - Run frontend admin tests, typecheck, build.

- [ ] **Step 5: Commit**
  - Commit message: `feat(6006): rebuild admin chat without floot auth`

### Task 8: End-to-end local backend verification

**Files:**
- Create: `worker/src/e2e/chat-flow.test.ts`
- Modify: root `package.json` scripts if needed.

**Interfaces:**
- Produces: repeatable local verification command for D1 + Worker + frontend API contract.

- [ ] **Step 1: Add end-to-end scenario test**
  - Visitor starts conversation → posts message → AI fallback replies → milestone records → owner takes over → visitor posts → AI stays silent → owner replies → owner releases → AI can respond again.

- [ ] **Step 2: Run full local migrations and test suites**
  - Run D1 migrations local, worker tests, frontend tests, both typechecks, frontend build.

- [ ] **Step 3: Search repository for forbidden Floot backend dependencies**
  - New runtime source must contain no `@floot/` import or Floot auth/push/database helper.

- [ ] **Step 4: Commit**
  - Commit message: `test(6006): verify cloudflare chat takeover flow`
