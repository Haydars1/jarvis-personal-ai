import test from 'node:test';
import assert from 'node:assert/strict';
import { checkMcpRequest } from '../services/notebooklm-cloudflare/src/proxy-policy.js';

test('Cloudflare notebook MCP proxy permits only three defined tools', () => {
  for (const name of ['notebook_list','source_list','chat_ask']) {
    assert.equal(checkMcpRequest({jsonrpc:'2.0',method:'tools/call',params:{name,arguments:{}}}),true);
  }
  for (const name of ['notebook_delete','source_delete','source_add','share_set_access','chat_start','toolDiscovery']) {
    assert.equal(checkMcpRequest({jsonrpc:'2.0',method:'tools/call',params:{name,arguments:{}}}),false);
  }
});
test('Cloudflare proxy permits MCP handshake but refuses unexpected methods and malformed inputs', () => {
  assert.equal(checkMcpRequest({jsonrpc:'2.0',method:'initialize',params:{}}),true);
  assert.equal(checkMcpRequest({jsonrpc:'2.0',method:'notifications/initialized'}),true);
  assert.equal(checkMcpRequest({jsonrpc:'2.0',method:'tools/list'}),false);
  assert.equal(checkMcpRequest({jsonrpc:'2.0',method:'resources/read'}),false);
  assert.equal(checkMcpRequest([{}]),false);
  assert.equal(checkMcpRequest(null),false);
});
