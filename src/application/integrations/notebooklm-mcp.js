// Read-only NotebookLM connector: internal Cloudflare service binding first, HTTPS fallback.
// Google cookie data is isolated in the NotebookLM container service, never in this Worker.
const CONTENT_TYPE = 'application/json; charset=utf-8';
const MCP_VERSION = '2025-03-26';
const MAX_RESPONSE = 200_000;
const ALLOWED_TOOLS = Object.freeze(['notebook_list', 'source_list', 'chat_ask']);

function reply(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': CONTENT_TYPE, 'cache-control': 'no-store' } });
}

function safeEndpoint(raw) {
  try {
    const url = new URL(String(raw || ''));
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
        !url.pathname.endsWith('/mcp') ||
        ['localhost', '127.0.0.1', '::1'].includes(host) ||
        host.endsWith('.local') || host.endsWith('.internal') ||
        /^(?:10|127|169\.254|192\.168)\./.test(host) || /^172\.(?:1[6-9]|2\d|3[01])\./.test(host)) {
      return null;
    }
    return url.href;
  } catch { return null; }
}

function parseEventPayload(text) {
  // Streamable MCP HTTP servers may respond with JSON or SSE. Keep the last JSON-RPC response.
  const messages = [];
  for (const frame of text.split(/\r?\n\r?\n/)) {
    const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n');
    if (!data || data === '[DONE]') continue;
    try { messages.push(JSON.parse(data)); } catch { /* ignore ping / non-JSON events */ }
  }
  return messages.findLast(item => item && (item.result || item.error)) || null;
}

function parseRpc(text, contentType) {
  if (text.length > MAX_RESPONSE) throw new Error('NOTEBOOKLM_RESPONSE_TOO_LARGE');
  const response = contentType.includes('text/event-stream') ? parseEventPayload(text) : JSON.parse(text);
  if (!response || typeof response !== 'object') throw new Error('NOTEBOOKLM_INVALID_RPC');
  if (response.error) throw new Error('NOTEBOOKLM_RPC_ERROR');
  return response.result || null;
}

function internalBinding(env) {
  return env.NOTEBOOKLM_MCP_SERVICE && typeof env.NOTEBOOKLM_MCP_SERVICE.fetch === 'function';
}
function configured(env) {
  return Boolean(env.NOTEBOOKLM_MCP_TOKEN && (internalBinding(env) || safeEndpoint(env.NOTEBOOKLM_MCP_URL)));
}

async function callTool(env, tool, args, transport = fetch) {
  if (!ALLOWED_TOOLS.includes(tool)) throw new Error('NOTEBOOKLM_TOOL_NOT_ALLOWED');
  const internal = internalBinding(env);
  const endpoint = internal ? 'https://notebooklm.service.invalid/mcp' : safeEndpoint(env.NOTEBOOKLM_MCP_URL);
  const requester = internal ? env.NOTEBOOKLM_MCP_SERVICE.fetch.bind(env.NOTEBOOKLM_MCP_SERVICE) : transport;
  const token = String(env.NOTEBOOKLM_MCP_TOKEN || '').trim();
  if (!endpoint || !token) throw new Error('NOTEBOOKLM_NOT_CONFIGURED');
  let session = '';
  let nextId = 1;
  const invoke = async (method, params, notification = false) => {
    const headers = {
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'mcp-protocol-version': MCP_VERSION
    };
    if (session) headers['mcp-session-id'] = session;
    const request = { jsonrpc: '2.0', method, ...(params ? { params } : {}), ...(notification ? {} : { id: nextId++ }) };
    const response = await requester(endpoint, {
      method: 'POST', headers, body: JSON.stringify(request), signal: AbortSignal.timeout(30000),
      redirect: 'error'
    });
    if (!response.ok) throw new Error(`NOTEBOOKLM_HTTP_${response.status}`);
    const returnedSession = response.headers.get('mcp-session-id');
    if (returnedSession) session = returnedSession;
    if (notification || response.status === 202) return null;
    return parseRpc(await response.text(), response.headers.get('content-type') || '');
  };
  await invoke('initialize', { protocolVersion: MCP_VERSION, capabilities: {}, clientInfo: { name: 'hayirlievlad-readonly', version: '1.0.0' } });
  await invoke('notifications/initialized', {}, true);
  const result = await invoke('tools/call', { name: tool, arguments: args });
  if (result?.isError) throw new Error('NOTEBOOKLM_TOOL_ERROR');
  return result;
}

function notebookRef(value) {
  const v = typeof value === 'string' ? value.trim() : '';
  return v && v.length <= 200 ? v : null;
}

function compactResult(result) {
  return {
    content: (Array.isArray(result?.content) ? result.content : []).filter(x => x?.type === 'text').map(x => String(x.text || '').slice(0, 40000)).slice(0, 10),
    structured: result?.structuredContent && typeof result.structuredContent === 'object' ? result.structuredContent : null
  };
}

export function createNotebookLmMcpIntegration(core, { transport = fetch } = {}) {
  if (!core?.fetch) throw new Error('NOTEBOOKLM_CORE_REQUIRED');
  async function authenticated(req, env, ctx) {
    const url = new URL('/api/auth/status', req.url);
    const check = await core.fetch(new Request(url, { headers: req.headers }), env, ctx);
    try { return Boolean((await check.json()).authenticated); } catch { return false; }
  }
  return {
    async fetch(req, env, ctx) {
      const url = new URL(req.url);
      if (!url.pathname.startsWith('/api/notebooklm/')) return core.fetch(req, env, ctx);
      if (!(await authenticated(req, env, ctx))) return reply({ error: 'UNAUTHORIZED' }, 401);
      if (url.pathname === '/api/notebooklm/status' && req.method === 'GET') {
        return reply({ configured: configured(env), backend: internalBinding(env) ? 'cloudflare-container' : 'external-https', mode: 'read-only', tools: ALLOWED_TOOLS });
      }
      if (!configured(env)) return reply({ error: 'NOTEBOOKLM_NOT_CONFIGURED' }, 503);
      try {
        if (url.pathname === '/api/notebooklm/notebooks' && req.method === 'GET') {
          return reply({ ok: true, result: compactResult(await callTool(env, 'notebook_list', {}, transport)) });
        }
        if (url.pathname === '/api/notebooklm/sources' && req.method === 'GET') {
          const notebook = notebookRef(url.searchParams.get('notebook'));
          if (!notebook) return reply({ error: 'NOTEBOOK_REQUIRED' }, 400);
          return reply({ ok: true, result: compactResult(await callTool(env, 'source_list', { notebook }, transport)) });
        }
        if (url.pathname === '/api/notebooklm/ask' && req.method === 'POST') {
          const body = await req.json().catch(() => ({}));
          const notebook = notebookRef(body.notebook);
          const question = typeof body.question === 'string' ? body.question.trim() : '';
          if (!notebook || !question || question.length > 5000) return reply({ error: 'INVALID_QUESTION_OR_NOTEBOOK' }, 400);
          const sourceIds = body.source_ids;
          if (sourceIds !== undefined && (!Array.isArray(sourceIds) || sourceIds.length > 50 || sourceIds.some(x => typeof x !== 'string' || !x.trim() || x.length > 200))) {
            return reply({ error: 'INVALID_SOURCE_IDS' }, 400);
          }
          const args = { notebook, question, ...(sourceIds?.length ? { source_ids: sourceIds } : {}) };
          return reply({ ok: true, result: compactResult(await callTool(env, 'chat_ask', args, transport)) });
        }
        return reply({ error: 'NOT_FOUND' }, 404);
      } catch (error) {
        const timeout = error?.name === 'TimeoutError';
        return reply({ error: timeout ? 'NOTEBOOKLM_TIMEOUT' : String(error?.message || 'NOTEBOOKLM_ERROR').slice(0, 100) }, timeout ? 504 : 502);
      }
    },
    scheduled(event, env, ctx) { return core.scheduled?.(event, env, ctx); }
  };
}
