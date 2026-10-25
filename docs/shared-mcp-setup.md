# Shared MCP gateway — preparation

This branch prepares a shared MCP endpoint for hayırlıevlad and ChatGPT.

## Security requirements
- Authenticate every request with OAuth 2.1 (ChatGPT-compatible authorization flow); do not expose a public unauthenticated tool endpoint.
- Use a dedicated Cloudflare Worker route and scoped D1/KV bindings.
- Start with read-only tools (health, project metadata, allowed repository summaries).
- Do not expose arbitrary HTTP fetch, shell execution, secrets, or unrestricted GitHub write tools.
- Enforce per-user authorization, input validation, rate limits, audit logs, and confirmation for sensitive writes.
- Keep existing .mcp.json local codebase-memory configuration unchanged.
- Deploy only after separate security review and explicit approval.

## Pending implementation
1. Inspect current Cloudflare Worker routing/auth architecture.
2. Implement remote MCP Streamable HTTP transport with proper session handling.
3. Configure OAuth and register the remote MCP endpoint in ChatGPT and hayırlıevlad separately.
4. Run integration tests; verify denied requests fail closed.

Status: planning scaffold only, not installed or deployed.
