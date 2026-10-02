import test from 'node:test';
import assert from 'node:assert/strict';
import { createEcuChannelStore } from '../src/application/ecu/channels.js';

function fakeEnv() {
  const row = {
    id: 'channel-1',
    title: 'original full backup_IntFl',
    file_name: 'original full backup_IntFl.bin',
    file_sha256: 'abc123',
    file_size: 1,
    identity_text: '',
    created_at: 1,
    updated_at: 1
  };
  return {
    DB: {
      prepare(sql) {
        const statement = {
          args: [],
          bind(...args) { this.args = args; return this; },
          async first() {
            if (/FROM ecu_chat_channels WHERE id=\?/i.test(sql)) return row;
            if (/SELECT id FROM ecu_chat_channels WHERE file_sha256=\?/i.test(sql)) return { id: row.id };
            return null;
          },
          async run() { return { success: true }; },
          async all() { return { results: [] }; }
        };
        return statement;
      }
    }
  };
}

function ecuRequest(text) {
  return new Request('https://jarvis.example/api/chat/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      channel: 'ecu',
      channelId: 'channel-1',
      text,
      attachments: [{
        name: 'original full backup_IntFl.bin',
        type: 'application/octet-stream',
        base64: 'AA=='
      }]
    })
  });
}

test('existing ECU channel acknowledges an already-uploaded file without reprocessing the repeated binary', async () => {
  let coreCalls = 0;
  const core = {
    async fetch() {
      coreCalls += 1;
      return new Response(JSON.stringify({ reply: 'core called', history: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }
  };
  const store = createEcuChannelStore(core);
  const response = await store.fetch(ecuRequest('Orijinal dosyasını yükledim ya'), fakeEnv(), {});
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(coreCalls, 0);
  assert.match(payload.reply, /aktif dosya/i);
  assert.match(payload.reply, /original full backup_IntFl/i);
});

test('explicit ECU re-analysis still forwards the binary attachment to the inspector', async () => {
  let forwardedBody = null;
  const core = {
    async fetch(req) {
      forwardedBody = await req.json();
      return new Response(JSON.stringify({ reply: 'yeniden analiz edildi', history: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }
  };
  const store = createEcuChannelStore(core);
  const response = await store.fetch(ecuRequest('Bu dosyayı yeniden analiz et'), fakeEnv(), {});

  assert.equal(response.status, 200);
  assert.equal(forwardedBody.attachments.length, 1);
  assert.equal(forwardedBody.attachments[0].name, 'original full backup_IntFl.bin');
});
