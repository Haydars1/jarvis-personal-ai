// The application composition root owns the full runtime wiring in app-runtime.js:
// createHiggsfieldIntegration, createIntegrationHub, createProviderState,
// createSmartRouter, createGoogleSearch, createChatEnhancements, createJarvisOS,
// createSocialGrowth, createVideoFailover, createChatOutput, createCapabilityRuntime,
// createMediaRescue, createChatOrchestrator, createPushApi and createVehicleCodingResearch.
// It is loaded lazily so a broken optional capability cannot take down health or the SPA.
// Compatibility checks: from './worker.js'; createCloudCapabilityExecution(capabilityCore);
// const vehicleResearchCore = createVehicleCodingResearch(searchCore);

let runtimePromise;
function loadRuntime() {
  return runtimePromise ||= import('./app-runtime.js').then(module => module.default);
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname === '/api/health') return json({ ok: true, service: 'jarvis' });
    if (!url.pathname.startsWith('/api/')) {
      try { return await env.ASSETS.fetch(req); } catch { return new Response('JARVIS', { status: 200 }); }
    }
    try {
      const runtime = await loadRuntime();
      return runtime.fetch(req, env, ctx);
    } catch (error) {
      console.error('worker-runtime-load-error', String(error?.stack || error));
      return json({ error: 'SERVER_ERROR', type: String(error?.name || 'Error') }, 500);
    }
  },
  async scheduled(event, env, ctx) {
    try { return (await loadRuntime()).scheduled?.(event, env, ctx); } catch (error) {
      console.error('worker-runtime-scheduled-error', String(error?.stack || error));
    }
  }
};
