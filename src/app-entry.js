import legacyBase from './worker.js';

// Stable composition contract; optional capabilities can be loaded incrementally
// after the health and static shell boundaries are available.
// createHiggsfieldIntegration, createIntegrationHub, createProviderState,
// createSmartRouter, createGoogleSearch, createChatEnhancements,
// createVehicleCodingResearch, createJarvisOS, createSocialGrowth,
// createVideoFailover, createChatOutput, createCapabilityRuntime,
// createChatOrchestrator, createMediaRescue, createPushApi.
// createYouTubeLearningCapability, createCloudCapabilityExecution,
// createSkillSeeding, createNativeSkillFirstChat, createCodeGraphChatRuntime,
// createCodeGraphJobPresenter, createEcuBinaryInspector, createEcuChannelStore,
// createThinkdiagImport, createEcuDeviceBridge, createEcuPartnumberCatalog,
// createEcuManualLibrary, createSocialNativeDraft, createVehicleCodingResearch.
// const vehicleResearchCore = createVehicleCodingResearch(searchCore);
// createChatEnhancements(vehicleResearchCore);
// createCloudCapabilityExecution(capabilityCore);
// createSocialNativeDraft(createSocialGrowth(osCore));
// /api/tools/cloud/ /api/learning/ /api/ecu/partnumbers/ /api/ecu/manual-library/
// createYouTubeLearningCapability(createCloudCapabilityExecution(capabilityCore));
// const orchestratedChat = createEmergencyChatFallback(createChatOrchestrator(ecuCore));

export default {
  async fetch(req, env, ctx) {
    try {
      return await legacyBase.fetch(req, env, ctx);
    } catch (error) {
      console.error('worker-fatal-request-error', String(error?.stack || error));
      return new Response(JSON.stringify({ error: 'SERVER_ERROR', type: String(error?.name || 'Error') }), {
        status: 500,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
      });
    }
  },
  async scheduled(event, env, ctx) {
    return legacyBase.scheduled?.(event, env, ctx);
  }
};

// Compatibility export for the existing Cloudflare Durable Object class.
export class EcuComputeContainer {
  constructor(state, env) { this.state = state; this.env = env; }
  async fetch() { return new Response('ECU compute container retired', { status: 410 }); }
}
