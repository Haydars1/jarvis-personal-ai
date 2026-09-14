import core from './jarvis-orchestrator-entry.js';
import { createPushApi, flushPush } from './infrastructure/apns/push-service.js';

const handlePush = createPushApi(core);

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/mobile/push/')) {
      const response = await handlePush(req, env, ctx);
      if (response) return response;
    }

    const response = await core.fetch(req, env, ctx);
    if ((url.pathname.startsWith('/api/') || req.method === 'POST') && response.ok) {
      ctx.waitUntil(flushPush(env).catch(() => {}));
    }
    return response;
  },

  async scheduled(event, env, ctx) {
    if (core.scheduled) await core.scheduled(event, env, ctx);
    ctx.waitUntil((async () => {
      await new Promise(resolve => setTimeout(resolve, 2500));
      await flushPush(env);
    })().catch(() => {}));
  }
};
