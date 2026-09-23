function isPrivateOrLocalIpv4(octets) {
  if (!Array.isArray(octets) || octets.length !== 4 || octets.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = octets;
  return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

function mappedIpv4Octets(ipv6) {
  const match = String(ipv6 || '').match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (!match) return null;
  const high = Number.parseInt(match[1], 16);
  const low = Number.parseInt(match[2], 16);
  return [high >> 8, high & 0xff, low >> 8, low & 0xff];
}

function isSafeRegisteredWorkerEndpoint(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:' || !url.pathname.endsWith('/jobs')) return false;
    if (url.username || url.password || url.search || url.hash) return false;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]' || host.endsWith('.local')) return false;
    if (/^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return false;
    const private172 = host.match(/^172\.(\d{1,3})\./);
    if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return false;
    const ipv6 = host.replace(/^\[|\]$/g, '');
    if (/^(fc|fd)[0-9a-f]{2}:/i.test(ipv6) || /^fe[89ab][0-9a-f]:/i.test(ipv6)) return false;
    const mappedIpv4 = mappedIpv4Octets(ipv6);
    if (mappedIpv4 && isPrivateOrLocalIpv4(mappedIpv4)) return false;
    return true;
  } catch {
    return false;
  }
}

async function chooseEndpoint(env = {}, now = Date.now, { allowLocal = true } = {}) {
  if (allowLocal && env.DB?.prepare) {
    try {
      const row = await env.DB.prepare(`SELECT endpoint,last_seen_at,expires_at
        FROM ecu_workers
        WHERE kind='local' AND enabled=1
        ORDER BY last_seen_at DESC LIMIT 1`).first();
      const current = Number(now());
      if (row?.endpoint && Number(row.expires_at || 0) > current && isSafeRegisteredWorkerEndpoint(row.endpoint)) return { url: String(row.endpoint), workerKind: 'local' };
    } catch {}
  }
  if (allowLocal) {
    const localUrl = String(env.ECU_LOCAL_WORKER_URL || '').trim();
    const localOnline = String(env.ECU_LOCAL_WORKER_ONLINE || '').trim() === '1';
    if (localUrl && localOnline && isSafeRegisteredWorkerEndpoint(localUrl)) return { url: localUrl, workerKind: 'local' };
  }
  if (env.ECU_COMPUTE_CONTAINER && typeof env.ECU_COMPUTE_CONTAINER.getByName === 'function') return { containerBinding: env.ECU_COMPUTE_CONTAINER, workerKind: 'cloud-container' };
  const cloudUrl = String(env.ECU_CLOUD_WORKER_URL || '').trim();
  if (cloudUrl && isSafeRegisteredWorkerEndpoint(cloudUrl)) return { url: cloudUrl, workerKind: 'cloud' };
  return null;
}

function payloadFor(job, env = {}) {
  const callbackBaseUrl=(job.config||{}).callback_base_url||String(env.JARVIS_PUBLIC_URL||'').trim()||null;
  if((job.operation||'')==='diff_pair') return {job_id:job.id,operation:'diff_pair',ori_artifact_sha256:job.oriArtifactSha256,mod_artifact_sha256:job.modArtifactSha256,ori_artifact_uri:job.oriArtifactUri,mod_artifact_uri:job.modArtifactUri,operation_label:job.operationLabel||'',paid_api_allowed:false,config:{...(job.config||{}),callback_base_url:callbackBaseUrl}};
  if((job.operation||'')==='train') return {job_id:job.id,operation:'train',dataset_version:job.datasetVersion,dataset_digest:job.datasetDigest,production_model_version:job.productionModelVersion||'baseline',paid_api_allowed:false,config:{...(job.config||{}),callback_base_url:callbackBaseUrl}};
  return {job_id:job.id,artifact_sha256:job.artifactSha256,artifact_uri:job.artifactUri,operation:job.operation||'analyze',model_version:job.modelVersion||'baseline',rulepack_version:job.rulepackVersion||'baseline',paid_api_allowed:false,config:{...(job.config||{}),callback_base_url:callbackBaseUrl}};
}

export function createComputeDispatch({ fetchImpl = fetch, timeoutMs = 15000, localCooldownMs = 30_000, now = Date.now } = {}) {
  let localCooldownUntil = 0;

  async function getRoutingStatus(env = {}) {
    const current = Number(now());
    const tokenConfigured = Boolean(String(env.ECU_COMPUTE_TOKEN || '').trim());
    const coolingDown = current < localCooldownUntil;
    const localCandidate = await chooseEndpoint(env, now, { allowLocal: true });
    const localUsable = tokenConfigured && localCandidate?.workerKind === 'local';
    const preferred = tokenConfigured
      ? await chooseEndpoint(env, now, { allowLocal: !coolingDown })
      : null;
    const local = coolingDown && localUsable
      ? { state:'cooldown', cooldownRemainingMs:Math.max(0, localCooldownUntil-current) }
      : localUsable
        ? { state:'healthy', cooldownRemainingMs:0 }
        : { state:'unavailable', cooldownRemainingMs:0 };
    return {
      local,
      preferredWorkerKind: preferred?.workerKind || null,
      computeAvailable: Boolean(preferred),
      computeTokenConfigured: tokenConfigured,
    };
  }

  async function dispatch(job, env = {}) {
    const current = Number(now());
    const localCoolingDown = current < localCooldownUntil;
    const endpoint = await chooseEndpoint(env, now, { allowLocal: !localCoolingDown });
    if (!endpoint) return {accepted:false,state:'QUEUED',workerKind:null,reason:'NO_COMPUTE_ENDPOINT'};
    const token = String(env.ECU_COMPUTE_TOKEN || '').trim();
    if (!token) return {accepted:false,state:'QUEUED',workerKind:endpoint.workerKind,reason:'NO_COMPUTE_TOKEN'};

    const headers={'content-type':'application/json','idempotency-key':String(job.runFingerprint||''),authorization:`Bearer ${token}`};
    const body=JSON.stringify(payloadFor(job,env));

    async function attempt(target) {
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),timeoutMs);
      try {
        let response;
        if(target.containerBinding){
          const stub=target.containerBinding.getByName('jarvis-ecu-compute');
          response=await stub.fetch(new Request('http://ecu-container/jobs',{method:'POST',headers,body,signal:controller.signal}));
        } else response=await fetchImpl(target.url,{method:'POST',headers,body,signal:controller.signal,redirect:'error'});
        if(!response.ok) return {accepted:false,state:'QUEUED',workerKind:target.workerKind,reason:`DISPATCH_HTTP_${response.status}`};
        let remote={}; try{remote=await response.json();}catch{}
        return {accepted:remote.accepted!==false,state:'DISPATCHED',workerKind:target.workerKind,remote};
      } catch { return {accepted:false,state:'QUEUED',workerKind:target.workerKind,reason:'DISPATCH_FAILED'}; }
      finally { clearTimeout(timer); }
    }

    const first=await attempt(endpoint);
    if(first.accepted || endpoint.workerKind!=='local') {
      if (localCoolingDown) return {...first,routeReason:'LOCAL_COOLDOWN',localCooldownRemainingMs:Math.max(0,localCooldownUntil-current)};
      return first;
    }

    localCooldownUntil = Number(now()) + Math.max(0, Number(localCooldownMs) || 0);
    const fallback=await chooseEndpoint(env,now,{allowLocal:false});
    if(!fallback) return first;
    const second=await attempt(fallback);
    return {...second,fallbackFrom:'local'};
  }

  dispatch.getRoutingStatus = getRoutingStatus;
  return dispatch;
}