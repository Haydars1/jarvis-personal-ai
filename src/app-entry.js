import legacyBase from './google-search-entry.js';
import { createCapabilityRuntime } from './application/capabilities/runtime.js';
import { createChatEnhancements } from './application/chat/enhancements.js';
import { createChatOrchestrator } from './application/chat/orchestrator.js';
import { createChatOutput } from './application/chat/presenter.js';
import { createMediaRescue } from './application/media/rescue.js';
import { createJarvisOS } from './application/os/runtime.js';
import { createSocialGrowth } from './application/social/growth.js';
import { createVideoFailover } from './application/video/failover.js';
import { createPushApi, flushPush } from './infrastructure/apns/push-service.js';

const enhancementCore = createChatEnhancements(legacyBase);
const osCore = createJarvisOS(enhancementCore);
const socialCore = createSocialGrowth(osCore);
const videoCore = createVideoFailover(socialCore);
const outputCore = createChatOutput(videoCore);
const capabilityCore = createCapabilityRuntime(outputCore);
const handleMediaRescue = createMediaRescue(capabilityCore);
const mediaCore = {
  fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname === '/api/chat/send' && req.method === 'POST') return handleMediaRescue(req, env, ctx);
    return capabilityCore.fetch(req, env, ctx);
  },
  scheduled(event, env, ctx) {
    return capabilityCore.scheduled?.(event, env, ctx);
  }
};

const handleChat = createChatOrchestrator(mediaCore);
const handlePush = createPushApi(capabilityCore);

function shouldFlushPush(req, response) {
  const url = new URL(req.url);
  return response?.ok && (url.pathname.startsWith('/api/') || req.method === 'POST');
}

async function routeRequest(req, env, ctx) {
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/mobile/push/')) {
    const response = await handlePush(req, env, ctx);
    if (response) return response;
  }
  if (url.pathname === '/api/chat/send' && req.method === 'POST') return handleChat(req, env, ctx);
  return capabilityCore.fetch(req, env, ctx);
}

export default {
  async fetch(req, env, ctx) {
    const response = await routeRequest(req, env, ctx);
    if (shouldFlushPush(req, response)) ctx.waitUntil(flushPush(env).catch(() => {}));
    return response;
  },
  async scheduled(event, env, ctx) {
    await capabilityCore.scheduled?.(event, env, ctx);
    ctx.waitUntil((async () => {
      await new Promise(resolve => setTimeout(resolve, 2500));
      await flushPush(env);
    })().catch(() => {}));
  }
};
