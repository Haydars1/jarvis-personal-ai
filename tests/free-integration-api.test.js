import test from 'node:test';
import assert from 'node:assert/strict';
import { createIntegrationHub } from '../src/application/integrations/hub.js';

function dbMock({ google=true } = {}) {
  return {
    prepare(sql) {
      return {
        bind() { return this; },
        async first() {
          if (sql.includes('SELECT value FROM kv WHERE key=?')) {
            const key = arguments.length ? arguments[0] : null;
            return null;
          }
          if (sql.includes("provider='google'")) return google ? { id:'google-1' } : null;
          if (sql.includes("provider='meta'")) return null;
          return null;
        },
        async all() { return { results:[] }; },
        async run() { return { success:true }; }
      };
    }
  };
}

function envMock({ youtube=false } = {}) {
  const kv = new Map([
    ['google_oauth', { email:'owner@example.test', scope: youtube ? 'openid https://www.googleapis.com/auth/youtube.readonly' : 'openid' }]
  ]);
  return {
    DB: {
      prepare(sql) {
        let values=[];
        return {
          bind(...args) { values=args; return this; },
          async first() {
            if (sql.includes('SELECT value FROM kv WHERE key=?')) {
              const value = kv.get(values[0]);
              return value === undefined ? null : { value:JSON.stringify(value) };
            }
            if (sql.includes("provider='google'")) return { id:'google-1' };
            if (sql.includes("provider='meta'")) return null;
            return null;
          },
          async all() { return { results:[] }; },
          async run() { return { success:true }; }
        };
      }
    },
    JARVIS_SECRET:'unit-test-secret'
  };
}

function coreMock() {
  return {
    async fetch(req) {
      const path = new URL(req.url).pathname;
      if (path === '/api/auth/status') return new Response(JSON.stringify({ authenticated:true }), { headers:{'content-type':'application/json'} });
      return new Response(JSON.stringify({ error:'CORE_FALLBACK' }), { status:404, headers:{'content-type':'application/json'} });
    }
  };
}

test('authenticated integration catalog endpoint filters by team and state without leaking secrets', async () => {
  const hub = createIntegrationHub(coreMock());
  const response = await hub.fetch(new Request('https://jarvis.test/api/integrations/catalog?team=Build&state=ready'), envMock({youtube:true}), {});
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.filters.team, 'Build');
  assert.equal(payload.filters.state, 'ready');
  assert.ok(Array.isArray(payload.integrations));
  assert.equal(payload.integrations.every(item => item.team === 'Build' && item.runtimeState === 'ready'), true);
  assert.equal(JSON.stringify(payload).includes('encrypted_secret'), false);
  assert.equal(JSON.stringify(payload).includes('access_token'), false);
});

test('integration status preserves legacy provider keys and adds freeHub summary', async () => {
  const hub = createIntegrationHub(coreMock());
  const response = await hub.fetch(new Request('https://jarvis.test/api/integrations/status'), envMock({youtube:true}), {});
  assert.equal(response.status, 200);
  const payload = await response.json();
  for (const key of ['google','youtube','meta','facebook','instagram']) assert.ok(Object.hasOwn(payload, key), key);
  assert.equal(payload.google.connected, true);
  assert.equal(payload.youtube.connected, true);
  assert.ok(payload.freeHub);
  assert.equal(typeof payload.freeHub.total, 'number');
  assert.equal(typeof payload.freeHub.autoExecutable, 'number');
});

test('catalog rejects unrecognized filters instead of silently widening the query', async () => {
  const hub = createIntegrationHub(coreMock());
  const response = await hub.fetch(new Request('https://jarvis.test/api/integrations/catalog?team=UnknownTeam'), envMock(), {});
  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.equal(payload.error, 'INVALID_INTEGRATION_FILTER');
});
