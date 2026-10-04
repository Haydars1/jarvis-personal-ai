import { currentHealthFor, currentVerificationFor } from './capability-verification-v2.js';

function compact(value=''){return String(value??'').trim();}

function manifestFor(registry,implementation){
  return (Array.isArray(registry?.adapter_manifests)?registry.adapter_manifests:[]).find(item=>compact(item?.implementation_id)===compact(implementation?.id))||null;
}

function currentHealth(registry,implementationId){
  try{return currentHealthFor(registry,implementationId);}catch{return null;}
}

function currentVerification(registry,implementationId){
  try{return currentVerificationFor(registry,implementationId);}catch{return null;}
}

function compatibleManifest(manifest,request={}){
  if(!manifest)return {ok:false,reason:'manifest_missing'};
  if(['reference-only','production-prohibited'].includes(String(manifest.policy_class||'')))return {ok:false,reason:'policy_not_executable'};
  if(manifest.requires_confirmation===true&&request.confirmed!==true)return {ok:false,reason:'confirmation_required'};
  if(manifest?.cost?.paid_api===true&&request.allow_paid!==true)return {ok:false,reason:'paid_api_not_allowed'};
  const platform=compact(request.platform).toLowerCase();
  const platforms=(Array.isArray(manifest.platforms)?manifest.platforms:[]).map(value=>compact(value).toLowerCase()).filter(Boolean);
  if(platforms.length&&(!platform||!platforms.includes(platform)))return {ok:false,reason:'platform_mismatch'};
  const available=new Set((Array.isArray(request.available_requirements)?request.available_requirements:[]).map(value=>compact(value).toLowerCase()));
  for(const requirement of Array.isArray(manifest.requirements)?manifest.requirements:[]){
    const normalized=compact(requirement).toLowerCase();
    if(normalized&& !available.has(normalized))return {ok:false,reason:`missing_requirement:${normalized}`};
  }
  return {ok:true,reason:'compatible'};
}

function scoreCandidate(implementation,verification,health){
  let score=implementation.state==='verified'?100:60;
  score+=Math.max(-20,Math.min(20,Number(implementation.priority||0)));
  if(verification)score+=20;
  if(health?.state==='healthy')score+=10;
  if(Number.isFinite(Number(health?.reliability)))score+=Math.round(Math.max(0,Math.min(1,Number(health.reliability)))*30);
  if(Number.isFinite(Number(health?.latency_ms)))score-=Math.min(10,Math.floor(Number(health.latency_ms)/1000));
  return score;
}

export function rankCapabilityImplementations(registry={},request={}){
  const capabilityId=compact(request.capability_id??request.capabilityId).toLowerCase();
  if(!capabilityId)return [];
  const rows=[];
  for(const implementation of Array.isArray(registry.implementations)?registry.implementations:[]){
    if(compact(implementation?.capability_id).toLowerCase()!==capabilityId)continue;
    if(!['verified','executable'].includes(String(implementation.state||'')))continue;
    const manifest=manifestFor(registry,implementation);
    const compatibility=compatibleManifest(manifest,request);
    if(!compatibility.ok)continue;
    const verification=currentVerification(registry,implementation.id);
    if(implementation.state==='verified'&&!verification)continue;
    const health=currentHealth(registry,implementation.id);
    if(health&&['degraded','unavailable'].includes(health.state))continue;
    rows.push({implementation,manifest,verification,health,score:scoreCandidate(implementation,verification,health)});
  }
  return rows.sort((a,b)=>b.score-a.score||String(a.implementation.id).localeCompare(String(b.implementation.id)));
}

function publicAttempt(candidate,status,error=null){
  return {
    implementation_id:candidate.implementation.id,
    adapter_id:candidate.manifest?.id||null,
    source_revision_id:candidate.implementation.source_revision_id||null,
    status,
    error:error?String(error):null
  };
}

export async function executeCapabilityWithFallback(registry={},request={},executor){
  if(typeof executor!=='function')throw new TypeError('executor function is required');
  const candidates=rankCapabilityImplementations(registry,request);
  const attempts=[];
  const trace=[];
  for(const candidate of candidates){
    trace.push({kind:'capability-attempt',implementation_id:candidate.implementation.id,adapter_id:candidate.manifest?.id||null,state:'running'});
    try{
      const result=await executor({implementation:candidate.implementation,manifest:candidate.manifest,request});
      const explicitFailure=result&&typeof result==='object'&&result.ok===false;
      const valid=typeof request.validate_result==='function'?request.validate_result(result)!==false:result!==undefined&&result!==null;
      if(explicitFailure||!valid){
        const error=explicitFailure?(result.error||'executor_reported_failure'):'invalid_result';
        attempts.push(publicAttempt(candidate,'failed',error));
        trace.push({kind:'capability-attempt',implementation_id:candidate.implementation.id,state:'failed',error:String(error)});
        if(result?.compatible_failure===false)break;
        continue;
      }
      attempts.push(publicAttempt(candidate,'completed'));
      trace.push({kind:'capability-attempt',implementation_id:candidate.implementation.id,state:'completed'});
      return {ok:true,result,selected_implementation_id:candidate.implementation.id,attempts,trace};
    }catch(error){
      attempts.push(publicAttempt(candidate,'failed',error?.message||error));
      trace.push({kind:'capability-attempt',implementation_id:candidate.implementation.id,state:'failed',error:String(error?.message||error)});
    }
  }
  return {ok:false,error:candidates.length?'ALL_IMPLEMENTATIONS_FAILED':'NO_COMPATIBLE_IMPLEMENTATION',attempts,trace};
}
