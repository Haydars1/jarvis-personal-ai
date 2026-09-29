const FALLBACK_BIAS = Object.freeze({
  coding: ['anthropic','openai','deepseek','nvidia','gemini','xai','mistral','openrouter','groq','cerebras','sambanova'],
  reasoning: ['openai','anthropic','deepseek','nvidia','xai','gemini','mistral','openrouter','cerebras'],
  research: ['perplexity','gemini','xai','openai','anthropic','openrouter','nvidia','deepseek'],
  documents: ['gemini','anthropic','openai','mistral','openrouter'],
  translation: ['openai','anthropic','gemini','mistral','deepseek'],
  creative: ['anthropic','openai','gemini','mistral','xai','openrouter'],
  chat: ['openai','anthropic','gemini','nvidia','groq','xai','mistral','deepseek','openrouter'],
  video: ['higgsfield','runway','fal','replicate'],
  image: ['cloudflare','openai','gemini','openrouter']
});

export function providerRank(provider, capability='chat') {
  const list=FALLBACK_BIAS[capability] || FALLBACK_BIAS.chat;
  const index=list.indexOf(String(provider||'').toLowerCase());
  return index < 0 ? list.length + 10 : index;
}

export function selectCapabilityCandidates(rows=[], capability='chat', scoreFn=null) {
  return rows
    .map(row => {
      const provider=String(row.provider||'').toLowerCase();
      const learned=scoreFn ? Number(scoreFn(row, capability) ?? -999) : 0;
      const health=row.last_status === 'ok' ? 20 : row.last_status === 'error' ? -80 : 0;
      const priorityPenalty=Math.min(15, Number(row.priority||100)/20);
      const domainBias=Math.max(0, 35-providerRank(provider, capability)*4);
      return {...row, capability_score: learned + health + domainBias - priorityPenalty};
    })
    .sort((a,b)=>b.capability_score-a.capability_score);
}

export function isRetryableProviderFailure(error) {
  const status=Number(error?.status||String(error?.message||'').match(/\b(401|402|403|408|409|425|429|5\d\d)\b/)?.[1]||0);
  return [401,402,403,408,409,425,429].includes(status) || status>=500 ||
    /quota|credit|billing|payment|rate.?limit|insufficient|timeout|temporar|overload|capacity|auth|token/i.test(String(error?.message||error||''));
}

export async function runCapabilityFailover(candidates, invoke, {maxAttempts=7}={}) {
  const attempts=[];
  for (const candidate of candidates.slice(0,maxAttempts)) {
    const started=Date.now();
    try {
      const result=await invoke(candidate);
      attempts.push({provider:candidate.label||candidate.provider,ok:true,ms:Date.now()-started});
      return {result, selected:candidate, attempts};
    } catch(error) {
      attempts.push({provider:candidate.label||candidate.provider,ok:false,ms:Date.now()-started,error:String(error?.message||error)});
      if (!isRetryableProviderFailure(error)) continue;
    }
  }
  const error=new Error('ALL_CAPABILITY_PROVIDERS_FAILED');
  error.attempts=attempts;
  throw error;
}

export const CAPABILITY_PROVIDER_BIAS = FALLBACK_BIAS;
