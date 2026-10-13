// Cloudflare-safe registry: integrations are NOT installed in Workers.
// Endpoints are advertised only when configured. Never reveal credentials.
export const HUB_PROVIDERS=Object.freeze([
 {id:'openhands',name:'OpenHands',kind:'remote-agent',repository:'https://github.com/OpenHands/OpenHands',env:'OPENHANDS_BASE_URL',requirements:'Separate authenticated OpenHands service (Docker/container runtime)',tasks:['software-development','coding-agent']},
 {id:'n8n',name:'n8n',kind:'workflow-service',repository:'https://github.com/n8n-io/n8n',env:'N8N_BASE_URL',requirements:'Separate authenticated n8n instance',tasks:['automation','workflow']},
 {id:'skills',name:'Skills.sh',kind:'skill-catalog',repository:'https://github.com/vercel-labs/skills',requirements:'Review and import vetted Agent Skills manifests',tasks:['skills','research']},
 {id:'freellmapi',name:'FreeLLMAPI',kind:'multi-provider-gateway',repository:'https://github.com/tashfeenahmed/freellmapi',env:'FREELLMAPI_BASE_URL',requirements:'An authenticated externally hosted HTTPS gateway + unified key; Cloudflare Workers cannot host the full Node/SQLite service.',tasks:['chat','coding','model-fallback']},
 {id:'ollama',name:'Ollama',kind:'model-endpoint',repository:'https://github.com/ollama/ollama',env:'OLLAMA_BASE_URL',requirements:'Reachable private model server (never expose local API publicly)',tasks:['local-llm','coding']}
]);
export function hubProviderStatus(env={}) {
 return HUB_PROVIDERS.map(({env:binding,...provider})=>({
  ...provider,
  state:binding?(env[binding]?'configured-unverified':'not-configured'):'catalog-available',
  // A configured endpoint is not proof of a working or authenticated service.
  available:false
 }));
}
