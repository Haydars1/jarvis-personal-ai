import { spawn } from 'node:child_process';

export const SUPPORTED_ADAPTER_TYPES = Object.freeze(['ollama', 'openai-compatible', 'json-http', 'command-json']);
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const TARGETS = new Set(['local-cpu', 'local-gpu', 'device', 'external-service']);

function uniq(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(value => String(value).trim()).filter(Boolean))];
}
function normalizeEndpoint(value = '') {
  const raw = String(value || '').trim().replace(/\/$/, '');
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return url.toString().replace(/\/$/, '');
  } catch { return ''; }
}
function envHeaders(adapter, env = process.env) {
  const result = {};
  const map = adapter?.headersEnv && typeof adapter.headersEnv === 'object' ? adapter.headersEnv : {};
  for (const [header, envName] of Object.entries(map)) {
    const safeHeader = String(header || '').trim();
    const safeEnvName = String(envName || '').trim();
    if (!safeHeader || !safeEnvName) continue;
    const value = env?.[safeEnvName];
    if (value) result[safeHeader] = String(value);
  }
  return result;
}

export function parseAdapterConfig(raw = '[]') {
  let source;
  try { source = typeof raw === 'string' ? JSON.parse(raw || '[]') : raw; } catch { return []; }
  if (!Array.isArray(source)) return [];
  const result = [];
  for (const item of source) {
    if (!item || typeof item !== 'object') continue;
    const id = String(item.id || '').trim();
    const type = String(item.type || '').trim();
    const capabilities = uniq(item.capabilities);
    const executionTarget = TARGETS.has(String(item.executionTarget || '')) ? String(item.executionTarget) : (type === 'command-json' ? 'local-cpu' : 'local-cpu');
    if (!ID_RE.test(id) || !SUPPORTED_ADAPTER_TYPES.includes(type) || !capabilities.length) continue;
    const base = {
      id, type, repo: String(item.repo || '').trim() || null,
      capabilities, executionTarget,
      model: String(item.model || '').trim() || null,
      timeoutMs: Math.max(1000, Math.min(120000, Number(item.timeoutMs || 30000))),
      headersEnv: item.headersEnv && typeof item.headersEnv === 'object' ? { ...item.headersEnv } : {}
    };
    if (type === 'command-json') {
      const command = String(item.command || '').trim();
      const args = Array.isArray(item.args) ? item.args.map(value => String(value)).slice(0, 64) : [];
      if (!command || command.includes('\0')) continue;
      result.push({ ...base, command, args });
      continue;
    }
    const endpoint = normalizeEndpoint(item.endpoint);
    if (!endpoint) continue;
    const method = ['POST', 'PUT', 'PATCH'].includes(String(item.method || '').toUpperCase()) ? String(item.method).toUpperCase() : 'POST';
    result.push({ ...base, endpoint, method });
  }
  return result;
}

export function adapterManifest(adapters = []) {
  return (Array.isArray(adapters) ? adapters : []).map(adapter => ({
    id: adapter.id,
    type: adapter.type,
    repo: adapter.repo || null,
    capabilities: uniq(adapter.capabilities),
    executionTarget: adapter.executionTarget || 'local-cpu',
    model: adapter.model || null
  }));
}

export function selectAdapter(adapters = [], job = {}, availableTargets = ['local-cpu', 'local-gpu', 'device', 'external-service']) {
  const capability = String(job?.capability || '').trim();
  const requested = String(job?.adapter_id || '').trim();
  const targets = new Set(uniq(availableTargets));
  if (!capability) return null;
  return (Array.isArray(adapters) ? adapters : []).find(adapter => {
    if (requested && adapter.id !== requested) return false;
    if (!adapter.capabilities?.includes(capability)) return false;
    return targets.has(String(adapter.executionTarget || 'local-cpu'));
  }) || null;
}

export function buildCommandInvocation(adapter, request = {}) {
  return {
    command: String(adapter?.command || ''),
    args: Array.isArray(adapter?.args) ? [...adapter.args] : [],
    shell: false,
    stdin: `${JSON.stringify(request?.payload ?? request?.input ?? request?.request ?? {})}\n`,
    timeoutMs: Math.max(1000, Math.min(120000, Number(adapter?.timeoutMs || 30000)))
  };
}

function parseResponseText(text) {
  try { return JSON.parse(text); } catch { return { raw: text }; }
}
async function fetchJson(url, options, timeoutMs, fetchImpl = globalThis.fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { ...options, signal: controller.signal });
    const text = await response.text();
    const payload = parseResponseText(text);
    if (!response.ok) throw new Error(payload?.error || payload?.message || `ADAPTER_HTTP_${response.status}`);
    return payload;
  } finally { clearTimeout(timer); }
}
function joinEndpoint(base, suffix) {
  return `${String(base || '').replace(/\/$/, '')}/${String(suffix || '').replace(/^\//, '')}`;
}

async function executeCommandJson(adapter, request, spawnImpl = spawn) {
  const invocation = buildCommandInvocation(adapter, request);
  return new Promise((resolve, reject) => {
    const child = spawnImpl(invocation.command, invocation.args, {
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });
    let stdout = '', stderr = '', settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      error ? reject(error) : resolve(value);
    };
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch {}
      finish(new Error('ADAPTER_COMMAND_TIMEOUT'));
    }, invocation.timeoutMs);
    child.stdout?.on('data', chunk => { if (stdout.length < 2_000_000) stdout += String(chunk); });
    child.stderr?.on('data', chunk => { if (stderr.length < 200_000) stderr += String(chunk); });
    child.on('error', error => finish(error));
    child.on('close', code => {
      if (code !== 0) return finish(new Error(`ADAPTER_COMMAND_${code}:${stderr.slice(0, 500)}`));
      finish(null, parseResponseText(stdout.trim()));
    });
    child.stdin?.end(invocation.stdin);
  });
}

export async function executeLocalAdapter(adapter, request = {}, deps = {}) {
  if (!adapter || !SUPPORTED_ADAPTER_TYPES.includes(adapter.type)) throw new Error('UNSUPPORTED_LOCAL_ADAPTER');
  if (adapter.type === 'command-json') return executeCommandJson(adapter, request, deps.spawnImpl || spawn);
  const headers = { 'content-type': 'application/json', accept: 'application/json', ...envHeaders(adapter, deps.env || process.env) };
  if (adapter.type === 'ollama') {
    const payload = request.payload && typeof request.payload === 'object' ? request.payload : {};
    return fetchJson(joinEndpoint(adapter.endpoint, '/api/chat'), {
      method: 'POST', headers,
      body: JSON.stringify({ model: adapter.model || payload.model, messages: payload.messages || request.messages || [], stream: false, ...payload, model: adapter.model || payload.model, stream: false })
    }, adapter.timeoutMs, deps.fetchImpl);
  }
  if (adapter.type === 'openai-compatible') {
    const payload = request.payload && typeof request.payload === 'object' ? request.payload : {};
    const endpoint = /\/v1$/i.test(adapter.endpoint) ? joinEndpoint(adapter.endpoint, 'chat/completions') : joinEndpoint(adapter.endpoint, 'v1/chat/completions');
    return fetchJson(endpoint, {
      method: 'POST', headers,
      body: JSON.stringify({ ...payload, model: adapter.model || payload.model, messages: payload.messages || request.messages || [] })
    }, adapter.timeoutMs, deps.fetchImpl);
  }
  return fetchJson(adapter.endpoint, {
    method: adapter.method || 'POST', headers,
    body: JSON.stringify(request.payload ?? request.input ?? request.request ?? {})
  }, adapter.timeoutMs, deps.fetchImpl);
}
