import { DurableObject } from 'cloudflare:workers';
import { checkMcpRequest } from './proxy-policy.js';

const MAX_BODY_BYTES = 32 * 1024;
const IDLE_MS = 5 * 60 * 1000;
const PORT = 9420;

function error(code, status) {
  return Response.json({ error: code }, { status, headers: { 'cache-control': 'no-store' } });
}

// A single dedicated Cloudflare Container; no public workers.dev or routes.
// Google cookies are supplied at runtime via a Cloudflare secret, never Docker/GitHub.
export class NotebookLmContainer extends DurableObject {
  starting = null;

  async googleAuth() {
    // A full Playwright storage_state.json can exceed the 5 KB Worker secret limit.
    // Prefer Secrets Store (64 KB/account secret) when configured by the owner.
    const value = typeof this.env.NOTEBOOKLM_AUTH_STORE?.get === 'function'
      ? await this.env.NOTEBOOKLM_AUTH_STORE.get()
      : this.env.NOTEBOOKLM_AUTH_JSON;
    if (!value || typeof value !== 'string' || value.length > 65536) {
      throw new Error('NOTEBOOKLM_GOOGLE_AUTH_UNAVAILABLE');
    }
    return value;
  }

  async ensureRunning() {
    const container = this.ctx.container;
    if (!this.env.NOTEBOOKLM_MCP_TOKEN) throw new Error('NOTEBOOKLM_MCP_SECRET_MISSING');
    const googleAuth = await this.googleAuth();
    if (!container.running) {
      container.start({
        image: container.images.base,
        instance: 'lite',
        enableInternet: true,
        env: {
          NOTEBOOKLM_MCP_TOKEN: this.env.NOTEBOOKLM_MCP_TOKEN,
          NOTEBOOKLM_AUTH_JSON: googleAuth,
          NOTEBOOKLM_MCP_TRANSPORT: 'http',
          NOTEBOOKLM_MCP_HOST: '0.0.0.0',
          NOTEBOOKLM_MCP_PORT: String(PORT),
          NOTEBOOKLM_MCP_ALLOW_EXTERNAL_BIND: '1',
          NOTEBOOKLM_MCP_STRICT_IDS: '1'
        }
      });
    }
    await container.setInactivityTimeout(IDLE_MS);
    const port = container.getTcpPort(PORT);
    for (let attempt = 0; attempt < 80; attempt++) {
      try {
        // An MCP GET often returns 405; any HTTP response confirms the port is ready.
        const response = await port.fetch('http://container/mcp', {
          method: 'GET', signal: AbortSignal.timeout(700)
        });
        await response.body?.cancel();
        return;
      } catch {
        await scheduler.wait(200);
      }
    }
    throw new Error('NOTEBOOKLM_CONTAINER_PORT_NOT_READY');
  }

  async fetch(request) {
    this.starting ??= this.ensureRunning().finally(() => { this.starting = null; });
    await this.starting;
    const headers = new Headers({
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: 'Bearer ' + this.env.NOTEBOOKLM_MCP_TOKEN,
      'mcp-protocol-version': request.headers.get('mcp-protocol-version') || '2025-03-26'
    });
    const session = request.headers.get('mcp-session-id');
    if (session) headers.set('mcp-session-id', session);
    const response = await this.ctx.container.getTcpPort(PORT).fetch('http://container/mcp', {
      method: 'POST', headers, body: request.body
    });
    return response;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/mcp' || request.method !== 'POST') return error('NOT_FOUND', 404);
    const secret = env.NOTEBOOKLM_MCP_TOKEN;
    if (!secret || (!env.NOTEBOOKLM_AUTH_STORE && !env.NOTEBOOKLM_AUTH_JSON)) return error('NOTEBOOKLM_NOT_CONFIGURED', 503);
    if (request.headers.get('authorization') !== 'Bearer ' + secret) return error('UNAUTHORIZED', 401);
    const input = await request.text();
    if (new TextEncoder().encode(input).length > MAX_BODY_BYTES) return error('PAYLOAD_TOO_LARGE', 413);
    let rpc;
    try { rpc = JSON.parse(input); } catch { return error('INVALID_JSON', 400); }
    if (!checkMcpRequest(rpc)) return error('MCP_OPERATION_FORBIDDEN', 403);
    const headers = new Headers(request.headers);
    headers.delete('cookie');
    headers.delete('host');
    return env.NOTEBOOKLM_CONTAINER.getByName('single-google-account')
      .fetch(new Request('http://container/mcp', { method: 'POST', headers, body: input }));
  }
};
