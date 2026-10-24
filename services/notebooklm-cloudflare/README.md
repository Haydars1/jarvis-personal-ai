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
4. The Google browser storage JSON can exceed **5 KB**, so it may not fit into a regular Cloudflare Worker secret. Use **Cloudflare Secrets Store** (64 KiB limit) to store the Google session:
   - Open Cloudflare Dashboard > Secrets Store; create a secret named `NOTEBOOKLM_AUTH_JSON` with the storage_state.json contents, scope `workers`.
   - On the private `hayirlievlad-notebooklm-mcp` Worker, add a **Secrets Store binding** named exactly `NOTEBOOKLM_AUTH_STORE` pointing to that secret. This is a user-account action and must not be performed using GitHub source files.
   - Only if the exact JSON is at most 5 KB may a Worker secret named `NOTEBOOKLM_AUTH_JSON` be used as fallback. For normal use, prefer Secrets Store.
   - Add the separate regular Worker secret `NOTEBOOKLM_MCP_TOKEN` (a randomly generated bearer token) on the private service. Never paste either secret in this conversation, commit them to GitHub, or echo them in CI logs.
   - The private Worker reads `env.NOTEBOOKLM_AUTH_STORE.get()` only inside authenticated start-up logic, then passes the JSON as an environment variable to the Container process.

5. On existing `hayirlievlad` Worker set secret `NOTEBOOKLM_MCP_TOKEN` **with exactly the same value**. The service binding in its `wrangler.jsonc` points to `hayirlievlad-notebooklm-mcp` internally. No `NOTEBOOKLM_MCP_URL` is needed.
6. Build and stage-deploy the private service first, then stage-deploy the main Worker, **only after separate production approval**. Manual Wrangler examples from repository root (do not run on production without approval):

   ```bash
   npx wrangler deploy --config services/notebooklm-cloudflare/wrangler.jsonc
   # NOTEBOOKLM_AUTH_STORE must be bound through Secrets Store; do not paste cookies in terminal history.
   npx wrangler secret put NOTEBOOKLM_MCP_TOKEN --config services/notebooklm-cloudflare/wrangler.jsonc
   npx wrangler secret put NOTEBOOKLM_MCP_TOKEN
   ```

   Note: the above commands change a Cloudflare account and incur possible billing. They are instructions only and have **not** been executed. Use staging / a separate Worker identity before production. Re-deploy after configuration as appropriate.
7. Test logged-in `/api/notebooklm/status`, `/notebooks`, `/sources?notebook=<canonical-id>`, and `/ask`. Also test anonymous access (must be 401), invalid MCP tools (403), a cold start, session expiration and failure recovery. Do not merge until these are verified live.

## Google authentication lifecycle

The **Web** backend supports single-profile `NOTEBOOKLM_AUTH_JSON` environment content without persistent filesystem storage. Cloudflare Secrets Store is preferred because regular Worker secrets are limited to 5 KB. Cloudflare Containers' filesystem is ephemeral; this avoids storing cookies in a container image or relying on a durable mount. However cookies expire; the project's own guide recommends updating the secret around every **one or two weeks** as needed. When login expires, re-run `notebooklm login` locally and securely update the account-level Secrets Store entry behind `NOTEBOOKLM_AUTH_STORE`. Never share the cookie JSON with anyone.

The stateful/Android master-token mode could avoid some cookie issues but uses a Google-account-equivalent credential. It is **not enabled** in this PR, and should require a separate security review. Single-owner only; do not enable multiple replicas.

## ChatGPT limitation

Cloudflare can host this private connector for hayırlıevlad. It does **not** bypass ChatGPT account-plan restrictions: this service has no public OAuth endpoint, and a Plus account cannot add an arbitrary custom MCP server via the available ChatGPT UI. A separately reviewed OAuth-enabled public service would be needed for supported account plans, with explicit account-owner approval.

## Verify locally

```bash
npm run check
npx wrangler deploy --config services/notebooklm-cloudflare/wrangler.jsonc --dry-run
```

`npm run check` runs syntax and mocked bridge/firewall tests. `--dry-run` may still require Docker (and may fetch Python dependencies) but does **not** deploy. These checks cannot prove that a live Google session succeeds or that the account is enabled for paid Containers.
