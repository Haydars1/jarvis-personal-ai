# Live AI Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a persistent German AI support chat with lead capture, owner notifications, authenticated admin, and instant human takeover.

**Architecture:** Use a managed database/auth/realtime service behind Vercel API routes. Keep chat state persistent and transport-agnostic; start with short polling/realtime subscription, while AI generation and notification adapters are server-side. Vehicle context stores the shared `vehicle_profile_key` from the vehicle subsystem.

**Tech Stack:** React/TypeScript frontend, Vercel server routes, Postgres/Supabase-compatible persistence, authenticated admin, web push, email provider, AI provider server-side.

**Spec:** `docs/superpowers/specs/2026-10-03-live-ai-chat-design.md`

## Global Constraints
- German-only public UI.
- No forced contact form before chat.
- Human takeover must stop AI before the next reply is generated.
- Admin and conversation data are never publicly exposed.
- Avoid one-email-per-message spam; notify on milestones.
- Existing pages/design remain intact.

## Review Focus
- Duplicate visitor submits do not create duplicate conversations/notifications.
- Polling/realtime reconnect recovers missed messages in order.
- Race between AI reply and human takeover resolves in favor of human takeover.
- Invalid/admin-unauthenticated conversation IDs do not leak data.
- Contact details are optional and stored only after explicit visitor submission.

---

### Task 1: Persistence schema and chat service
**Files:** Create database migration/schema, `server/chatService.ts`, tests.
**Produces:** conversation/message CRUD and atomic takeover/release operations.
- [ ] Create conversation/message/notification milestone tables.
- [ ] Test status transitions and ordered message fetch.
- [ ] Test takeover race behavior.

### Task 2: Public chat API
**Files:** Create Vercel API routes for create/get conversation, post visitor message, fetch messages, update context.
**Consumes:** Task 1.
- [ ] Test validation and visitor-session ownership.
- [ ] Persist page path, fault code and vehicle profile key.
- [ ] Return cursor/timestamps for incremental updates.

### Task 3: AI reply service
**Files:** Create `server/aiSupport.ts` and AI reply route/tests.
- [ ] Build German system prompt with fault + vehicle context.
- [ ] Test no AI reply when `human_active`.
- [ ] Avoid definitive “component is broken” claims from one DTC.
- [ ] Collect contact details naturally, not as a blocking form.

### Task 4: Public chat launcher
**Files:** Create `components/SupportChat.tsx`, CSS, tests; mount on homepage and fault pages.
- [ ] Contextual greeting from current route/fault.
- [ ] Persist visitor session/conversation across refresh.
- [ ] Poll/subscribe for owner messages without reload.
- [ ] Add privacy text before saving contact details.

### Task 5: Owner auth and admin chat UI
**Files:** Create `/admin`, `/admin/chat/:id`, auth guards, admin API routes, CSS/tests.
- [ ] Active/recent conversation list with unread/status/context.
- [ ] Conversation stream and sticky vehicle/fault card.
- [ ] `Chat übernehmen`, owner reply, `AI wieder aktivieren`, close.
- [ ] Test unauthorized access is rejected.

### Task 6: Push + email notification adapters
**Files:** Create notification service and subscription UI/settings.
- [ ] Push once on meaningful engagement with deep link.
- [ ] Email fallback/parallel notification once per qualified lead.
- [ ] Test milestone deduplication.

### Task 7: End-to-end verification
- [ ] Visitor starts on P0299 and selected vehicle context is attached.
- [ ] Owner receives alert and opens exact conversation.
- [ ] Takeover prevents AI response and owner reply reaches visitor.
- [ ] Release optionally re-enables AI.
- [ ] Refresh preserves conversation.
- [ ] Existing fault pages continue to pass regression tests.
