// Stable composition contract is loaded lazily after the health/static boundary.
// from './worker.js'
// createHiggsfieldIntegration, createIntegrationHub, createProviderState,
// createSmartRouter, createGoogleSearch, createChatEnhancements,
// createVehicleCodingResearch, createJarvisOS, createSocialGrowth,
// createVideoFailover, createChatOutput, createCapabilityRuntime,
// createChatOrchestrator, createMediaRescue, createPushApi,
// createYouTubeLearningCapability(createCloudCapabilityExecution(capabilityCore)),
// createSkillSeeding(cloudExecutionCore),
// const orchestratedChat = createEmergencyChatFallback(createChatOrchestrator(ecuCore));
// const nativeSkillChat = createNativeSkillFirstChat(ecuCore, orchestratedChat);
// const handleChat = createCodeGraphChatRuntime(nativeSkillChat);
// const vehicleResearchCore = createVehicleCodingResearch(searchCore);
// createChatEnhancements(vehicleResearchCore);
// createSocialNativeDraft(createSocialGrowth(osCore));
// /api/tools/cloud/ /api/learning/ /api/ecu/partnumbers/ /api/ecu/manual-library/

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/api/health' && req.method === 'GET') {
      return Response.json({ ok: true, cloud: true, ts: Date.now() }, { headers: { 'cache-control': 'no-store' } });
    }
    if (!url.pathname.startsWith('/api/') && env.ASSETS?.fetch) return env.ASSETS.fetch(req);
    try {
      const legacy = await import('./worker.js');
      return await legacy.default.fetch(req, env, { waitUntil() {} });
    } catch (error) {
      console.error('worker-lazy-start-error', String(error?.stack || error));
      return Response.json({ error: 'SERVER_ERROR', type: String(error?.name || 'Error') }, { status: 500 });
    }
  },
  async scheduled(event, env, ctx) {
    const legacy = await import('./worker.js');
    return legacy.default.scheduled?.(event, env, ctx);
  }
};

export class EcuComputeContainer {
  constructor(state, env) { this.state = state; this.env = env; }
  async fetch() { return new Response('ECU compute container retired', { status: 410 }); }
}
