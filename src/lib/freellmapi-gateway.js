// Cloudflare-safe adapter for an explicitly configured remote FreeLLMAPI gateway.
// FreeLLMAPI is a separate self-hosted Node/SQLite service, not a Workers package.
const BAD_HOST = /(^localhost$|\.localhost$|\.local$|\.internal$|\.test$|\.invalid$|\.example$|(^|\.)localdomain$)/i;
export function freeLlmGatewayBase(input) {
  let url;
  try { url = new URL(String(input || '').trim()); } catch { throw new Error('FREELLMAPI_HTTPS_URL_REQUIRED'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      (url.port && url.port !== '443')) throw new Error('FREELLMAPI_HTTPS_URL_REQUIRED');
  const hostname = url.hostname.toLowerCase();
  if (!hostname || !hostname.includes('.') || BAD_HOST.test(hostname) ||
      /^\d+(?:\.\d+){3}$/.test(hostname) || hostname.startsWith('[') ||
      /[^a-z0-9.-]/.test(hostname)) throw new Error('FREELLMAPI_PUBLIC_HOST_REQUIRED');
  if (!['/','/v1','/v1/'].includes(url.pathname)) throw new Error('FREELLMAPI_BASE_PATH_INVALID');
  return url.origin + '/v1';
}
export async function freeLlmChat({endpoint,key,model='auto',messages,timeoutMs=7000},fetcher=fetch) {
  const base=freeLlmGatewayBase(endpoint);
  if (!String(key||'').trim()) throw new Error('FREELLMAPI_KEY_REQUIRED');
  if (!Array.isArray(messages) || !messages.length) throw new Error('FREELLMAPI_MESSAGES_REQUIRED');
  const response=await fetcher(base+'/chat/completions',{
    method:'POST',redirect:'error',
    headers:{'content-type':'application/json','accept':'application/json','authorization':'Bearer '+String(key)},
    body:JSON.stringify({model:String(model||'auto'),messages,temperature:0.25,max_tokens:900,stream:false}),
    signal:AbortSignal.timeout(Math.max(1000,Math.min(15000,Number(timeoutMs)||7000)))
  });
  if (!response.ok) throw new Error('FREELLMAPI_HTTP_'+response.status);
  const data=await response.json();
  const content=data?.choices?.[0]?.message?.content;
  const text=(Array.isArray(content)?content.map(item=>typeof item==='string'?item:item?.text||'').join(''):String(content||'')).trim();
  if(!text) throw new Error('FREELLMAPI_EMPTY');
  const routedVia=String(response.headers?.get?.('x-routed-via')||'').slice(0,100);
  return {provider:routedVia?'FreeLLMAPI · '+routedVia:'FreeLLMAPI',text,model:String(data?.model||model||'auto'),routed_via:routedVia};
}
export async function freeLlmModels({endpoint,key,timeoutMs=5000},fetcher=fetch) {
  const base=freeLlmGatewayBase(endpoint);
  if (!String(key||'').trim()) throw new Error('FREELLMAPI_KEY_REQUIRED');
  const response=await fetcher(base+'/models',{
    redirect:'error',headers:{accept:'application/json',authorization:'Bearer '+String(key)},
    signal:AbortSignal.timeout(Math.max(1000,Math.min(10000,Number(timeoutMs)||5000)))
  });
  if (!response.ok) throw new Error('FREELLMAPI_MODELS_'+response.status);
  const payload=await response.json();
  const models=(Array.isArray(payload?.data)?payload.data:[]).slice(0,200)
    .map(item=>String(item?.id||'').slice(0,180)).filter(Boolean);
  return {models,configured:true,reachable:true};
}
