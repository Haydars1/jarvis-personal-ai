# OpenDots agent-computer integration skill

Source: https://github.com/CopilotKit/OpenDots (MIT). This is an **integration blueprint**, not an installed service.

## Purpose
Enable the existing hayırlıevlad/JARVIS assistant to delegate authorized, persistent tasks to isolated per-agent computers, with saved work, review gates and traceable execution.

## Architecture boundary
- Keep Cloudflare Workers + D1 + KV as the existing application's primary API and memory store.
- OpenDots is a **separate Node.js 24 service** with CopilotKit Intelligence, not a drop-in Cloudflare Worker library or a PDF-learning plugin.
- Deploy only after a separate runtime, persistent volume, model provider, owner authentication and CopilotKit Intelligence have been configured.
- Do not silently synchronize conversations or import user data. OpenDots stores page/work metadata in SQLite and conversations in its configured Intelligence service.
- Do not install OpenDots onto the user's Windows PC or expose local shell/browser access by default.

## Integration interface proposal (not yet implemented)
1. JARVIS authenticates to an optional OpenDots gateway using a server-side, scoped secret.
2. JARVIS submits a narrowly scoped task with an idempotency key, originating user ID and allowed capabilities.
3. Gateway returns job ID, state, and a sanitized result link. Polling/streaming must respect rate limits.
4. Read-only browsing may run without additional approval; writing files, sending messages, shell commands, destructive actions, deploying, spending money or changing secrets require explicit user confirmation.
5. Persist audit trail (task ID, permission decision, timestamps, errors) without leaking credentials.
6. Never assume that OpenDots MCP tools or CopilotKit Automatic Learning are available until configured and independently tested.

## Suggested specialized agents
- Researcher: public web research and citations; no account actions.
- Document analyst: user-authorized documents with page-level provenance.
- Developer: branch-only GitHub changes and tests; no production deploy/merge without approval.
- ECU expert: technical reference and diagnostics; vehicle modifications require applicable legal/safety review.

## Verification checklist
- [ ] Isolated OpenDots instance is running with Node.js 24 and durable storage.
- [ ] Owner authentication, origin checks and HTTPS work.
- [ ] CopilotKit Intelligence and model connection verified with a real conversation.
- [ ] Per-agent computer permissions and human approval cards tested.
- [ ] JARVIS-to-OpenDots authentication and job state contract implemented.
- [ ] Fail-closed on missing service/credentials; no secret exposed to browser.
- [ ] Audit logs, retry/idempotency and job cancellation tested.
- [ ] User explicitly approves production enablement.

## Official references
- https://github.com/CopilotKit/OpenDots
- https://github.com/CopilotKit/OpenDots/blob/main/docs/SETUP.md
