function chooseEndpoint(env = {}) {
  const localUrl = String(env.ECU_LOCAL_WORKER_URL || '').trim();
  const localOnline = String(env.ECU_LOCAL_WORKER_ONLINE || '').trim() === '1';
  if (localUrl && localOnline) return { url: localUrl, workerKind: 'local' };

  const cloudUrl = String(env.ECU_CLOUD_WORKER_URL || '').trim();
  if (cloudUrl) return { url: cloudUrl, workerKind: 'cloud' };

  return null;
}

function payloadFor(job, env = {}) {
  return {
    job_id: job.id,
    artifact_sha256: job.artifactSha256,
    artifact_uri: job.artifactUri,
    operation: job.operation || 'analyze',
    model_version: job.modelVersion || 'baseline',
    rulepack_version: job.rulepackVersion || 'baseline',
    paid_api_allowed: false,
    config: { ...(job.config || {}), callback_base_url: String(env.JARVIS_PUBLIC_URL || '').trim() || null },
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

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers = {
        'content-type': 'application/json',
        'idempotency-key': String(job.runFingerprint || ''),
      };
      const token = String(env.ECU_COMPUTE_TOKEN || '').trim();
      if (token) headers.authorization = `Bearer ${token}`;

      const response = await fetchImpl(endpoint.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payloadFor(job, env)),
        signal: controller.signal,
      });

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
