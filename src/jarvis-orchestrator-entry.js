import core from './media-rescue-entry.js';
import { createChatOrchestrator } from './application/chat/orchestrator.js';

const handleChat = createChatOrchestrator(core);

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname === '/api/chat/send' && req.method === 'POST') {
      return handleChat(req, env, ctx);
    }
    return core.fetch(req, env, ctx);
  },

  async scheduled(event, env, ctx) {
    if (core.scheduled) return core.scheduled(event, env, ctx);
  }
};
