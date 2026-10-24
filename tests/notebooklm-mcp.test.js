import test from 'node:test';
import assert from 'node:assert/strict';
import { createNotebookLmMcpIntegration } from '../src/application/integrations/notebooklm-mcp.js';

const base = 'https://assistant.example.test';
const mk = (authenticated = true) => ({
  fetch: async req => req.url.includes('/api/auth/status')
    ? Response.json({ authenticated })
    : Response.json({ fallback: true })
});
const env = { NOTEBOOKLM_MCP_URL: 'https://notebook.example.test/mcp', NOTEBOOKLM_MCP_TOKEN: 'unit-test-token' };

test('refuses private access without authenticated owner', async () => {
  const bridge = createNotebookLmMcpIntegration(mk(false));
  const res = await bridge.fetch(new Request(base + '/api/notebooklm/notebooks'), env);
  assert.equal(res.status, 401);
});
test('requires a configured HTTPS service', async () => {
  const bridge = createNotebookLmMcpIntegration(mk());
  assert.equal((await bridge.fetch(new Request(base + '/api/notebooklm/notebooks'), {})).status, 503);
  const health = await bridge.fetch(new Request(base + '/api/notebooklm/status'), { ...env, NOTEBOOKLM_MCP_URL: 'http://localhost:9420/mcp' });
  assert.equal((await health.json()).configured, false);
});
test('never reveals authentication credentials in status endpoint', async () => {
  const bridge = createNotebookLmMcpIntegration(mk());
  const res = await bridge.fetch(new Request(base + '/api/notebooklm/status'), env);
  const body = await res.text();
  assert.equal(JSON.parse(body).configured, true);
  assert.equal(body.includes(env.NOTEBOOKLM_MCP_TOKEN), false);
});
test('forwards an allowed notebook question through MCP handshake', async () => {
  const methods = [];
  const transport = async (_, init) => {
    const req = JSON.parse(init.body);
    methods.push(req.method);
    const headers = { 'content-type':'application/json', 'mcp-session-id': 'test-session' };
    if (req.method === 'notifications/initialized') return new Response(null, { status: 202 });
    if (req.method === 'initialize') return Response.json({jsonrpc:'2.0', id:req.id, result:{capabilities:{}}}, {headers});
    return Response.json({jsonrpc:'2.0', id:req.id, result:{content:[{type:'text',text:'Expected answer'}]}}, {headers});
  };
  const bridge = createNotebookLmMcpIntegration(mk(), {transport});
  const response = await bridge.fetch(new Request(base + '/api/notebooklm/ask', { method: 'POST', body: JSON.stringify({notebook:'ECU',question:'Question?'}) }), env);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).result.content,['Expected answer']);
  assert.deepEqual(methods,['initialize','notifications/initialized','tools/call']);
});
test('rejects blank question without contacting server', async () => {
  const bridge = createNotebookLmMcpIntegration(mk(), { transport: () => { throw Error('unexpected'); } });
  const response = await bridge.fetch(new Request(base + '/api/notebooklm/ask', { method: 'POST', body: JSON.stringify({notebook:'ECU',question:''}) }), env);
  assert.equal(response.status, 400);
});
