export { EcuComputeContainer } from './infrastructure/ecu/cloud-container.js';
import legacyBase, { isAuthed as isOwnerAuthenticated } from './worker.js';
import { createCapabilityRuntime } from './application/capabilities/runtime.js';
import { createChatEnhancements } from './application/chat/enhancements.js';
import { createChatOrchestrator } from './application/chat/orchestrator.js';
import { createEmergencyChatFallback } from './application/chat/emergency-fallback.js';
import { createChatOutput } from './application/chat/presenter.js';
import { createSmartRouter } from './application/chat/smart-router.js';
import { createIntegrationHub } from './application/integrations/hub.js';
import { createMediaRescue } from './application/media/rescue.js';
import { createJarvisOS } from './application/os/runtime.js';
import { createHiggsfieldIntegration } from './application/providers/higgsfield.js';
import { createProviderState } from './application/providers/state.js';
import { createGoogleSearch } from './application/search/google.js';
import { createSocialGrowth } from './application/social/growth.js';
import { createVideoFailover } from './application/video/failover.js';
import { createPushApi, flushPush } from './infrastructure/apns/push-service.js';
import { prepareChatAttachments } from './application/chat/attachments.js';
import { createEcuRuntime } from './application/ecu/runtime.js';
import { createEcuAuthGuard } from './application/ecu/auth-guard.js';
import { createEcuChatTool } from './application/ecu/tool.js';
import { createComputeDispatch } from './infrastructure/ecu/compute-dispatch.js';

const higgsfieldCore=createHiggsfieldIntegration(legacyBase);
const integrationCore=createIntegrationHub(higgsfieldCore);
const providerCore=createProviderState(integrationCore);
const routerCore=createSmartRouter(providerCore);
const searchCore=createGoogleSearch(routerCore);
const enhancementCore=createChatEnhancements(searchCore);
const osCore=createJarvisOS(enhancementCore);
const socialCore=createSocialGrowth(osCore);
const videoCore=createVideoFailover(socialCore);
const outputCore=createChatOutput(videoCore);
const capabilityCore=createCapabilityRuntime(outputCore);
const ecuComputeDispatch=createComputeDispatch();
const ecuRuntimeCore=createEcuRuntime(capabilityCore,{computeDispatch:ecuComputeDispatch,computeStatus:env=>ecuComputeDispatch.getRoutingStatus(env)});
const ecuCore=createEcuAuthGuard(ecuRuntimeCore,{isOwnerAuthenticated});
const handleMediaRescue=createMediaRescue(ecuCore);
const mediaCore={fetch(req,env,ctx){const url=new URL(req.url);if(url.pathname==='/api/chat/send'&&req.method==='POST')return handleMediaRescue(req,env,ctx);return ecuCore.fetch(req,env,ctx)},scheduled(event,env,ctx){return ecuCore.scheduled?.(event,env,ctx)}};
const ecuChatCore=createEcuChatTool(mediaCore);
const handleChat=createEmergencyChatFallback(createChatOrchestrator(ecuChatCore));
const handlePush=createPushApi(ecuCore);

function shouldFlushPush(req,response){const url=new URL(req.url);return response?.ok&&(url.pathname.startsWith('/api/')||req.method==='POST')}
async function routeRequest(req,env,ctx){
  const url=new URL(req.url);
  if(url.pathname.startsWith('/api/mobile/push/')){const response=await handlePush(req,env,ctx);if(response)return response}
  if(url.pathname==='/api/chat/send'&&req.method==='POST'){const prepared=await prepareChatAttachments(req,env);return handleChat(prepared.request,env,ctx)}
  return ecuCore.fetch(req,env,ctx)
}
export default{
  async fetch(req,env,ctx){const response=await routeRequest(req,env,ctx);if(shouldFlushPush(req,response))ctx.waitUntil(flushPush(env).catch(()=>{}));return response},
  async scheduled(event,env,ctx){await ecuCore.scheduled?.(event,env,ctx);ctx.waitUntil((async()=>{await new Promise(resolve=>setTimeout(resolve,2500));await flushPush(env)})().catch(()=>{}))}
};
