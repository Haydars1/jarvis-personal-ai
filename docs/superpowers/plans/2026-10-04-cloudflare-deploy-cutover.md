# Cloudflare Deploy Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish repeatable GitHub/Cloudflare preview delivery for 6006, verify the standalone application in Cloudflare, and define a controlled production cutover that does not touch JARVIS `main` or require Floot.

**Architecture:** `6006-performance` remains the development/preview branch. A separate `6006-production` branch is the Cloudflare Pages production branch so ordinary development commits cannot publish to production. Cloudflare Pages builds the React app; the Worker is deployed separately and receives D1/secrets only after explicit approval. Floot remains untouched until Cloudflare production is verified, then it can be retired in a separate destructive action.

**Tech Stack:** GitHub Actions, Cloudflare Pages Git integration, Wrangler, Cloudflare Workers, D1, Cloudflare Access.

**Spec:** `docs/superpowers/specs/2026-10-04-cloudflare-migration-design.md`

## Global Constraints

- Never use JARVIS `main` as a 6006 deployment branch.
- Development branch: `6006-performance`.
- Production branch: `6006-production`.
- Preview deployment may be automated; production deployment requires explicit approval.
- No paid plan purchase, custom-domain purchase, secret rotation, or destructive Floot action in this plan unless separately approved.
- Do not delete/disable the existing Floot site before Cloudflare production passes smoke tests.

## Review Focus

- A push to `6006-performance` must never change production.
- A failed CI/build must never advance `6006-production` or trigger a production Worker deployment.
- Preview must use preview/test data/resources rather than production D1 where separation is configured.
- `/fehlercodes/:code` deep links must work on the Pages preview URL.
- Admin protection must not accidentally protect the public site or leave `/api/admin/*` public.

---

### Task 1: Strengthen GitHub CI as the deployment gate

**Files:**
- Modify: `.github/workflows/6006-tests.yml`
- Create if useful: `.github/workflows/6006-worker-tests.yml`

**Interfaces:**
- Produces required green checks for frontend tests/typecheck/build and Worker tests/typecheck on `6006-performance` and `6006-production`.

- [ ] **Step 1: Add failing/observable CI coverage for both packages**
  - Frontend: install with lockfile, test, typecheck, build.
  - Worker: install with lockfile, local D1 migration check, test, typecheck.

- [ ] **Step 2: Run equivalent commands locally**
  - Expected: exactly the commands used by Actions succeed before workflow changes are committed.

- [ ] **Step 3: Update workflow triggers/paths**
  - Trigger on pushes/PRs affecting 6006 runtime/docs/config only.
  - Never deploy production from this workflow.

- [ ] **Step 4: Verify Actions run is green on `6006-performance`**

- [ ] **Step 5: Commit**
  - Commit message: `ci(6006): gate cloudflare migration with full tests`

### Task 2: Create controlled production branch

**Files:** none.

**Interfaces:**
- Produces Git branch `6006-production` based on the last verified 6006 commit.

- [ ] **Step 1: Confirm current `6006-performance` CI is green**

- [ ] **Step 2: Create `6006-production` from the verified commit**
  - Do not point it at JARVIS `main`.

- [ ] **Step 3: Confirm branch SHAs and compare**
  - Initially `6006-production` must exactly match the chosen verified 6006 commit.

- [ ] **Step 4: Record branch purpose in README/deployment docs**
  - Development/preview = `6006-performance`; production = `6006-production`.

- [ ] **Step 5: Commit documentation on `6006-performance`**
  - Commit message: `docs(6006): document preview and production branches`

### Task 3: Configure Cloudflare Pages preview/production separation

**Files:**
- Create: `docs/deployment/cloudflare-pages.md`
- Possibly modify: `public/_headers`

**Interfaces:**
- Produces a Pages project using build command `npm run build`, output `dist`, production branch `6006-production`, preview branch `6006-performance`.

- [ ] **Step 1: Verify current Cloudflare Pages settings against official docs at execution time**
  - Re-check React/Vite Pages build settings because Cloudflare changes frequently.

- [ ] **Step 2: Connect the GitHub repository to a new 6006 Pages project**
  - One-time Cloudflare account authorization may require user interaction if no programmatic connection is available.

- [ ] **Step 3: Set branch controls**
  - Production branch: `6006-production`.
  - Preview builds: `6006-performance` enabled.
  - No automatic production deployment from `6006-performance`.

- [ ] **Step 4: Verify preview URL**
  - Home route loads.
  - Direct `/fehlercodes/P0299` load returns app, not 404.
  - DE/TR/EN selector persists across reload.
  - Mobile 393x852 and desktop layout smoke checks pass.

- [ ] **Step 5: Record project/subdomain in deployment doc**

### Task 4: Provision preview Worker and D1 resources

**Files:**
- Modify: `worker/wrangler.jsonc` only with non-secret resource IDs/bindings.
- Create: `docs/deployment/cloudflare-worker.md`

**Interfaces:**
- Produces preview Worker endpoint and preview D1 binding for the React preview app.

- [ ] **Step 1: Verify Wrangler/Workers/D1 CLI syntax from current official docs**

- [ ] **Step 2: Create preview D1 resource**
  - Use a clearly non-production name such as `6006-chat-preview`.
  - Apply migrations to preview only.

- [ ] **Step 3: Deploy preview Worker**
  - Configure only non-secret bindings first; AI/push adapters may remain fallback/no-op.

- [ ] **Step 4: Configure preview frontend API base/origin**
  - Confirm public CORS allows only the expected preview Pages origin(s).

- [ ] **Step 5: Smoke test preview chat persistence**
  - Start conversation, post message, reload/read conversation.

- [ ] **Step 6: Commit only non-secret config/documentation**
  - Commit message: `chore(6006): document cloudflare preview resources`

### Task 5: Configure Cloudflare Access for admin surfaces

**Files:**
- Modify: `docs/deployment/cloudflare-worker.md`

**Interfaces:**
- Produces Access policy protecting admin surface/API while public homepage/chat remain reachable.

- [ ] **Step 1: Verify Zero Trust/Access availability in the user's Cloudflare account**

- [ ] **Step 2: Protect the chosen admin hostname/path**
  - Allow only the owner-approved email identity.
  - Keep public `/` and `/api/chat/*` outside the admin policy.

- [ ] **Step 3: Verify denied and allowed cases**
  - Anonymous `/api/admin/*` → Access/auth denial.
  - Authorized owner → admin conversation list works.
  - Public homepage and public chat remain accessible anonymously.

- [ ] **Step 4: Document the exact Access application/policy scope without storing credentials**

### Task 6: Preview end-to-end acceptance gate

**Files:**
- Create: `docs/deployment/preview-acceptance.md`

**Interfaces:**
- Produces a checked acceptance record before any production change.

- [ ] **Step 1: Run automated CI and build checks**
  - All frontend + Worker tests green.

- [ ] **Step 2: Public UI smoke test**
  - DE/TR/EN.
  - Fault search/details.
  - Vehicle selector exact/fallback behavior.
  - Passat CRLB + AdBlue generic fallback.

- [ ] **Step 3: Chat/admin smoke test**
  - Visitor chat persists.
  - Human takeover suppresses AI.
  - Owner reply works.
  - Release restores AI fallback.
  - Milestone dedupe works.

- [ ] **Step 4: Security smoke test**
  - No secrets in frontend bundle/repository.
  - `/api/admin/*` protected.
  - malformed/oversized public input rejected.

- [ ] **Step 5: Record acceptance results and commit**
  - Commit message: `test(6006): record cloudflare preview acceptance`

### Task 7: Production cutover — explicit approval gate

**Files:**
- Update deployment docs after completion.

**Interfaces:**
- Produces Cloudflare production Pages + Worker + D1 deployment independent of Floot.

- [ ] **Step 1: STOP and obtain explicit approval for production deployment and production resource/secret changes**

- [ ] **Step 2: Create/apply production D1 resources/migrations**
  - Do not copy Floot test data by default.
  - If real customer data exists, export/migrate it first under a separate reviewed data-migration step.

- [ ] **Step 3: Configure approved production secrets**
  - Secrets live only in Cloudflare secret/env storage.

- [ ] **Step 4: Advance `6006-production` to the exact accepted `6006-performance` commit**
  - No merge to JARVIS `main`.

- [ ] **Step 5: Verify production health and full smoke suite**

- [ ] **Step 6: Mark Cloudflare as the active 6006 production platform**

### Task 8: Floot retirement — separate destructive approval gate

**Files:**
- Update: `docs/deployment/cloudflare-pages.md`

**Interfaces:**
- Produces documented retirement state; no code path depends on Floot.

- [ ] **Step 1: Confirm Cloudflare production has been stable and accepted**

- [ ] **Step 2: Confirm no real-only data remains trapped in Floot**

- [ ] **Step 3: STOP and obtain explicit approval before disabling/deleting any Floot resource**

- [ ] **Step 4: After approval, retire only the requested Floot resources**

- [ ] **Step 5: Search active code/config/docs for operational Floot dependencies**
  - Historical migration docs may mention Floot; runtime/deployment must not depend on it.

- [ ] **Step 6: Commit final migration status**
  - Commit message: `docs(6006): complete floot retirement`
