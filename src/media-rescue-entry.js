import core from './capability-runtime-entry.js';
import { createMediaRescue } from './application/media/rescue.js';

const handleMediaRescue = createMediaRescue(core);

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname === '/api/chat/send' && req.method === 'POST') {
      return handleMediaRescue(req, env, ctx);
    }
    return core.fetch(req, env, ctx);
  },

  async scheduled(event, env, ctx) {
    if (core.scheduled) return core.scheduled(event, env, ctx);
  }
};
