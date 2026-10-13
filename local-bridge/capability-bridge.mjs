import { adapterManifest, executeLocalAdapter, parseAdapterConfig, selectAdapter } from './capability-adapters.mjs';

const JARVIS_URL = String(process.env.JARVIS_URL || '').replace(/\/$/, '');
const TOKEN = String(process.env.JARVIS_CAPABILITY_BRIDGE_TOKEN || '');
const POLL_MS = Math.max(800, Number(process.env.JARVIS_CAPABILITY_POLL_MS || 1500));
const HEARTBEAT_MS = Math.max(5000, Number(process.env.JARVIS_CAPABILITY_HEARTBEAT_MS || 15000));
const ADAPTERS = parseAdapterConfig(process.env.JARVIS_CAPABILITY_ADAPTERS_JSON || '[]');
const RUNTIME_TARGETS = [...new Set(ADAPTERS.map(adapter => adapter.executionTarget).filter(Boolean))];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const headers = () => ({ authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' });

async function jsonFetch(path, options = {}) {
  const response = await fetch(`${JARVIS_URL}${path}`, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
  const text = await response.text();
  let payload = {};
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = { raw: text }; }
  if (!response.ok) throw new Error(payload.error || `HTTP_${response.status}`);
  return payload;
}

async function heartbeat() {
  return jsonFetch('/api/capability-bridge/heartbeat', {
    method: 'POST',
    body: JSON.stringify({
      agent: 'jarvis-capability-local-bridge/1',
      runtime_targets: RUNTIME_TARGETS,
      adapters: adapterManifest(ADAPTERS)
    })
  });
}

async function nextJob() {
  const payload = await jsonFetch('/api/capability-bridge/jobs/next');
  return payload.job || null;
}

async function report(jobId, ok, result = null, error = null) {
  return jsonFetch(`/api/capability-bridge/jobs/${encodeURIComponent(jobId)}/result`, {
    method: 'POST', body: JSON.stringify({ ok, result, error })
  });
}

export async function runCapabilityBridge({ once = false } = {}) {
  if (!JARVIS_URL || !TOKEN) throw new Error('JARVIS_URL_AND_CAPABILITY_BRIDGE_TOKEN_REQUIRED');
  if (!ADAPTERS.length) throw new Error('JARVIS_CAPABILITY_ADAPTERS_JSON_REQUIRED');
  let lastHeartbeat = 0;
  console.log('JARVIS generic capability bridge started.');
  console.log('Cloud:', JARVIS_URL);
  console.log('Adapters:', ADAPTERS.map(adapter => `${adapter.id}:${adapter.type}`).join(', '));

  for (;;) {
    try {
      const current = Date.now();
      if (current - lastHeartbeat >= HEARTBEAT_MS) {
        await heartbeat();
        lastHeartbeat = current;
      }
      const job = await nextJob();
      if (job) {
        const adapter = selectAdapter(ADAPTERS, job, RUNTIME_TARGETS);
        if (!adapter) {
          await report(job.id, false, null, 'NO_MATCHING_LOCAL_ADAPTER');
        } else {
          try {
            const result = await executeLocalAdapter(adapter, job.request || {});
            await report(job.id, true, result, null);
          } catch (error) {
            await report(job.id, false, null, String(error?.message || error));
          }
        }
        if (once) return;
        continue;
      }
      if (once) return;
    } catch (error) {
      console.error('capability bridge loop error:', error?.message || error);
      if (once) throw error;
    }
    await sleep(POLL_MS);
  }
}

if (import.meta.url === new URL(`file://${process.argv[1] || ''}`).href) {
  runCapabilityBridge().catch(error => {
    console.error(error?.message || error);
    process.exitCode = 1;
  });
}
