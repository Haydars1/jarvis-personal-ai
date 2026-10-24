# Cloudflare Containers — NotebookLM MCP (single owner, private service)

## What this changes

No VPS or always-on PC is required after deployment: a Cloudflare Container runs the Python NotebookLM MCP service when hayırlıevlad needs it, then scales down after five minutes of inactivity. **The initial Google login still must be completed by the account owner once**, using a browser. This is not Google's official NotebookLM API; notebooklm-py MCP is experimental.

This deployment has **no workers.dev URL or public route**. The only caller is the existing hayırlıevlad Worker through a Cloudflare Service Binding (`NOTEBOOKLM_MCP_SERVICE`). Three tools are permitted twice (at the main app and service boundary): `notebook_list`, `source_list`, `chat_ask`.

Cloudflare Containers require **Workers Paid**, starting at $5/month with metered usage after included allowances. Do not deploy or enable billing without account-owner approval.

## Source files

- `Dockerfile` — python:3.12-slim + pinned `notebooklm-py[mcp]==0.8.5`
- `wrangler.jsonc` — private Cloudflare Worker and one Container instance
- `src/index.js` — isolated Cloudflare Durable Object Container lifecycle and authentication
- `src/proxy-policy.js` — MCP tool firewall

The existing `../../wrangler.jsonc` adds an internal service binding to `hayirlievlad-notebooklm-mcp`.

## Deployment prerequisites (manual, owner-controlled)

1. In your Cloudflare account, check Workers Paid is active and Containers are enabled. Docker is needed **on the deployment computer only** to build and push the image. It does not need to run afterwards.
2. Use a dedicated Google account containing only documents you agree to place at risk with an experimental client. Install `notebooklm-py==0.8.5` locally and run `notebooklm login` in a browser; review the authentication file in `~/.notebooklm/profiles/default/storage_state.json`. Do not paste it in ChatGPT or upload it to GitHub.
3. Create a cryptographically random bearer token (minimum 32 bytes), save it to a secure password manager.
4. Set two **Cloudflare Worker secrets** on the `hayirlievlad-notebooklm-mcp` service, via Wrangler's secret prompting or local stdin:
   - `NOTEBOOKLM_AUTH_JSON`: exact contents of the local `storage_state.json`
   - `NOTEBOOKLM_MCP_TOKEN`: the generated bearer token
   Do not create plaintext `vars` entries, commit `.dev.vars`, expose via logs, or place cookies in the Dockerfile or GitHub Actions secrets.
5. On existing `hayirlievlad` Worker set secret `NOTEBOOKLM_MCP_TOKEN` **with exactly the same value**. The service binding in its `wrangler.jsonc` points to `hayirlievlad-notebooklm-mcp` internally. No `NOTEBOOKLM_MCP_URL` is needed.
6. Build and stage-deploy the private service first, then stage-deploy the main Worker, **only after separate production approval**. Manual Wrangler examples from repository root (do not run on production without approval):

   ```bash
   npx wrangler deploy --config services/notebooklm-cloudflare/wrangler.jsonc
   npx wrangler secret put NOTEBOOKLM_AUTH_JSON --config services/notebooklm-cloudflare/wrangler.jsonc
   npx wrangler secret put NOTEBOOKLM_MCP_TOKEN --config services/notebooklm-cloudflare/wrangler.jsonc
   npx wrangler secret put NOTEBOOKLM_MCP_TOKEN
   ```

   Note: the above commands change a Cloudflare account and incur possible billing. They are instructions only and have **not** been executed. Use staging / a separate Worker identity before production. Re-deploy after configuration as appropriate.
7. Test logged-in `/api/notebooklm/status`, `/notebooks`, `/sources?notebook=<canonical-id>`, and `/ask`. Also test anonymous access (must be 401), invalid MCP tools (403), a cold start, session expiration and failure recovery. Do not merge until these are verified live.

## Google authentication lifecycle

The **Web** backend supports single-profile `NOTEBOOKLM_AUTH_JSON` secret without persistent filesystem storage. Cloudflare Containers' filesystem is ephemeral; this avoids storing cookies in a container image or relying on a durable mount. However cookies expire; the project's own guide recommends updating the secret around every **one or two weeks** as needed. When login expires, re-run `notebooklm login` locally and securely rotate `NOTEBOOKLM_AUTH_JSON` in the service Worker. Never share the cookie JSON with anyone.

The stateful/Android master-token mode could avoid some cookie issues but uses a Google-account-equivalent credential. It is **not enabled** in this PR, and should require a separate security review. Single-owner only; do not enable multiple replicas.

## ChatGPT limitation

Cloudflare can host this private connector for hayırlıevlad. It does **not** bypass ChatGPT account-plan restrictions: this service has no public OAuth endpoint, and a Plus account cannot add an arbitrary custom MCP server via the available ChatGPT UI. A separately reviewed OAuth-enabled public service would be needed for supported account plans, with explicit account-owner approval.

## Verify locally

```bash
npm run check
npx wrangler deploy --config services/notebooklm-cloudflare/wrangler.jsonc --dry-run
```

`npm run check` runs syntax and mocked bridge/firewall tests. `--dry-run` may still require Docker (and may fetch Python dependencies) but does **not** deploy. These checks cannot prove that a live Google session succeeds or that the account is enabled for paid Containers.
