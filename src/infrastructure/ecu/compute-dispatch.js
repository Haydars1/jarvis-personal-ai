function chooseEndpoint(env = {}) {
  const localUrl = String(env.ECU_LOCAL_WORKER_URL || '').trim();
  const localOnline = String(env.ECU_LOCAL_WORKER_ONLINE || '').trim() === '1';
  if (localUrl && localOnline) return { url: localUrl, workerKind: 'local' };

  if (env.ECU_COMPUTE_CONTAINER && typeof env.ECU_COMPUTE_CONTAINER.getByName === 'function') {
    return { containerBinding: env.ECU_COMPUTE_CONTAINER, workerKind: 'cloud-container' };
  }

  const cloudUrl = String(env.ECU_CLOUD_WORKER_URL || '').trim();
  if (cloudUrl) return { url: cloudUrl, workerKind: 'cloud' };

  return null;
}

function payloadFor(job, env = {}) {
  const callbackBaseUrl=(job.config||{}).callback_base_url||String(env.JARVIS_PUBLIC_URL||'').trim()||null;
  if((job.operation||'')==='diff_pair'){
    return {
      job_id:job.id,
      operation:'diff_pair',
      ori_artifact_sha256:job.oriArtifactSha256,
      mod_artifact_sha256:job.modArtifactSha256,
      ori_artifact_uri:job.oriArtifactUri,
      mod_artifact_uri:job.modArtifactUri,
      operation_label:job.operationLabel||'',
      paid_api_allowed:false,
      config:{...(job.config||{}),callback_base_url:callbackBaseUrl},
    };
  }
  return {
    job_id: job.id,
    artifact_sha256: job.artifactSha256,
    artifact_uri: job.artifactUri,
    operation: job.operation || 'analyze',
    model_version: job.modelVersion || 'baseline',
    rulepack_version: job.rulepackVersion || 'baseline',
    paid_api_allowed: false,
    config: { ...(job.config || {}), callback_base_url: callbackBaseUrl },
  };
}

export function createComputeDispatch({ fetchImpl = fetch, timeoutMs = 15000 } = {}) {
  return async function dispatch(job, env = {}) {
    const endpoint = chooseEndpoint(env);
    if (!endpoint) {
      return {
        accepted: false,
        state: 'QUEUED',
        workerKind: null,
        reason: 'NO_COMPUTE_ENDPOINT',
      };
    }
    const token = String(env.ECU_COMPUTE_TOKEN || '').trim();
    if (!token) {
      return {
        accepted: false,
        state: 'QUEUED',
        workerKind: endpoint.workerKind,
        reason: 'NO_COMPUTE_TOKEN',
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers = {
        'content-type': 'application/json',
        'idempotency-key': String(job.runFingerprint || ''),
      };
      headers.authorization = `Bearer ${token}`;

      let response;
      const body = JSON.stringify(payloadFor(job, env));
      if (endpoint.containerBinding) {
        const stub = endpoint.containerBinding.getByName('jarvis-ecu-compute');
        response = await stub.fetch(new Request('http://ecu-container/jobs', {
          method: 'POST',
          headers,
          body,
          signal: controller.signal,
        }));
      } else {
        response = await fetchImpl(endpoint.url, {
          method: 'POST',
          headers,
          body,
          signal: controller.signal,
        });
      }

      if (!response.ok) {
        return {
          accepted: false,
          state: 'QUEUED',
          workerKind: endpoint.workerKind,
          reason: `DISPATCH_HTTP_${response.status}`,
        };
      }

      let remote = {};
      try { remote = await response.json(); } catch {}
      return {
        accepted: remote.accepted !== false,
        state: 'DISPATCHED',
        workerKind: endpoint.workerKind,
        remote,
      };
    } catch {
      return {
        accepted: false,
        state: 'QUEUED',
        workerKind: endpoint.workerKind,
        reason: 'DISPATCH_FAILED',
      };
    } finally {
      clearTimeout(timer);
    }
  };
}
