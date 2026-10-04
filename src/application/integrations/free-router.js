import { isAutoExecutableIntegration } from '../../lib/free-integration-registry.js';

const TEAMS = new Set(['Build','Design','Growth','Operations','Scale']);

export function classifyIntegrationTeam(task = {}) {
  if (TEAMS.has(task?.team)) return task.team;
  const text = String(task?.text || task?.prompt || task?.message || '').toLowerCase();
  if (/figma|canva|design|tasarım|ui\b|ux\b|diagram|diyagram|slide|sunum|prototype|prototip/.test(text)) return 'Design';
  if (/instagram|seo|growth|marketing|pazarlama|social|sosyal|youtube|research|araştır|content|içerik/.test(text)) return 'Growth';
  if (/drive|calendar|takvim|gmail|e-?posta|mail\b|notion|todo|slack|doküman|document|workflow|iş akışı/.test(text)) return 'Operations';
  if (/multi[- ]?agent|çoklu ajan|model serving|orchestrat|orkestr|memory|hafıza|rag\b|scale|ölçek/.test(text)) return 'Scale';
  return 'Build';
}

function skipReason(record) {
  if (record?.pricing === 'paid') return 'paid';
  if (record?.pricing !== 'free' && record?.pricing !== 'free-plan') return 'pricing-unverified';
  if (record?.runtimeState === 'connection-required') return 'connection-required';
  if (record?.runtimeState === 'reference-only') return 'reference-only';
  if (record?.runtimeState === 'excluded') return 'excluded';
  if (record?.runtimeState !== 'ready') return 'not-ready';
  if (record?.surface === 'chatgpt' || record?.surface === 'external') return 'external';
  return null;
}

function ordered(records = []) {
  return records
    .map((record, index) => ({ record, index }))
    .sort((a, b) => {
      const left = Number.isFinite(a.record?.fallbackOrder) ? a.record.fallbackOrder : Number.MAX_SAFE_INTEGER;
      const right = Number.isFinite(b.record?.fallbackOrder) ? b.record.fallbackOrder : Number.MAX_SAFE_INTEGER;
      if (left !== right) return left - right;
      return a.index - b.index || String(a.record?.name || a.record?.id || '').localeCompare(String(b.record?.name || b.record?.id || ''));
    })
    .map(({ record }) => record);
}

export function selectFreeIntegration({ task = {}, catalog = [] } = {}) {
  const team = classifyIntegrationTeam(task);
  const capability = String(task?.capability || '').trim();
  const trace = [];
  const connectionRequired = [];
  const candidates = [];

  for (const record of catalog || []) {
    if (!record || typeof record !== 'object') continue;
    if (record.team !== team) {
      trace.push({ phase:'select', id:record.id, status:'skipped', reason:'team-mismatch' });
      continue;
    }
    if (capability && Array.isArray(record.capabilities) && record.capabilities.length && !record.capabilities.includes(capability)) {
      trace.push({ phase:'select', id:record.id, status:'skipped', reason:'capability-mismatch' });
      continue;
    }
    const reason = skipReason(record);
    if (reason) {
      if (reason === 'connection-required') connectionRequired.push(record);
      trace.push({ phase:'select', id:record.id, status:'skipped', reason });
      continue;
    }
    if (!isAutoExecutableIntegration(record)) {
      trace.push({ phase:'select', id:record.id, status:'skipped', reason:'policy-blocked' });
      continue;
    }
    candidates.push(record);
    trace.push({ phase:'select', id:record.id, status:'candidate', reason:'free-ready' });
  }

  const sorted = ordered(candidates);
  const waiting = ordered(connectionRequired);
  return {
    team,
    state: sorted.length ? 'ready' : (waiting.length ? 'connection-required' : 'unavailable'),
    selected: sorted[0] || null,
    candidates: sorted,
    connectionRequired: waiting,
    trace
  };
}

export async function executeFreeIntegrationPlan({ task = {}, catalog = [], execute } = {}) {
  const plan = selectFreeIntegration({ task, catalog });
  const trace = [...plan.trace];
  if (!plan.candidates.length) return { ok:false, state:plan.state, integration:null, result:null, connectionRequired:plan.connectionRequired, trace };
  if (typeof execute !== 'function') return { ok:false, state:'unavailable', integration:null, result:null, connectionRequired:plan.connectionRequired, trace:[...trace, { phase:'execute', status:'failed', reason:'executor-unavailable' }] };

  for (const integration of plan.candidates) {
    try {
      const result = await execute(integration, task);
      if (!result || result.ok === false) {
        trace.push({ phase:'execute', id:integration.id, status:'failed', error:String(result?.error || result?.reason || 'adapter returned no successful result') });
        continue;
      }
      trace.push({ phase:'execute', id:integration.id, status:'success' });
      return { ok:true, state:'completed', integration, result, connectionRequired:plan.connectionRequired, trace };
    } catch (error) {
      trace.push({ phase:'execute', id:integration.id, status:'failed', error:String(error?.message || error || 'adapter failed') });
    }
  }
  return { ok:false, state:'failed', integration:null, result:null, connectionRequired:plan.connectionRequired, trace };
}
