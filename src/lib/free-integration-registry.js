export const FREE_INTEGRATION_TEAMS = Object.freeze(['Build','Design','Growth','Operations','Scale']);

const PAID_EXCLUDED_NAMES = new Set([
  'screensdesign mcp',
  'higgsfield mcp',
  'plaud',
  'manychat',
  'sandcastles mcp'
]);

const PRICING = new Set(['free','free-plan','unknown','paid']);
const RUNTIME = new Set(['ready','connection-required','degraded','reference-only','unavailable','excluded']);
const AUTH = new Set(['none','connected','required','unknown']);

function slug(value='') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'');
}

function canonicalTeam(value) {
  const match = FREE_INTEGRATION_TEAMS.find(team => team.toLowerCase() === String(value || '').trim().toLowerCase());
  return match || 'Scale';
}

export function isAutoExecutableIntegration(record = {}) {
  const pricing = String(record.pricing || 'unknown');
  const runtimeState = String(record.runtimeState || 'unavailable');
  const surface = String(record.surface || 'external');
  return (pricing === 'free' || pricing === 'free-plan')
    && runtimeState === 'ready'
    && surface !== 'chatgpt'
    && surface !== 'external';
}

export function normalizeIntegration(record = {}, runtimeState = {}) {
  const name = String(record.name || record.id || 'Unnamed integration').trim();
  const paidExcluded = PAID_EXCLUDED_NAMES.has(name.toLowerCase());
  const pricing = paidExcluded
    ? 'paid'
    : (PRICING.has(String(record.pricing || '').toLowerCase()) ? String(record.pricing).toLowerCase() : 'unknown');
  const requestedRuntime = String(runtimeState.runtimeState || runtimeState.status || record.runtimeState || record.status || '').toLowerCase();
  const normalizedRuntime = paidExcluded
    ? 'excluded'
    : (RUNTIME.has(requestedRuntime) ? requestedRuntime : 'unavailable');
  const requestedAuth = String(runtimeState.authState || record.authState || '').toLowerCase();
  const authState = AUTH.has(requestedAuth) ? requestedAuth : (normalizedRuntime === 'connection-required' ? 'required' : 'unknown');
  const normalized = {
    id: String(record.id || slug(name) || 'integration'),
    name,
    team: canonicalTeam(record.team),
    surface: String(record.surface || 'external'),
    sourceType: String(record.sourceType || 'catalog'),
    capabilities: [...new Set((Array.isArray(record.capabilities) ? record.capabilities : []).map(String).filter(Boolean))],
    pricing,
    authState,
    runtimeState: normalizedRuntime,
    adapterId: record.adapterId ? String(record.adapterId) : null,
    route: record.route ? String(record.route) : null,
    provenance: record.provenance || null,
    notes: String(record.notes || ''),
  };
  normalized.autoExecutable = isAutoExecutableIntegration(normalized);
  return normalized;
}

export const FREE_INTEGRATION_SEEDS = Object.freeze([
  { id:'screensdesign-mcp', name:'ScreensDesign MCP', team:'Design', surface:'external', sourceType:'screenshot', pricing:'paid', runtimeState:'excluded', notes:'Paid screenshot-labelled tool; never auto-routed.' },
  { id:'higgsfield-mcp', name:'Higgsfield MCP', team:'Design', surface:'external', sourceType:'screenshot', pricing:'paid', runtimeState:'excluded', notes:'Paid screenshot-labelled tool; never auto-routed.' },
  { id:'plaud', name:'Plaud', team:'Operations', surface:'external', sourceType:'screenshot', pricing:'paid', runtimeState:'excluded', notes:'Paid screenshot-labelled tool; never auto-routed.' },
  { id:'manychat', name:'ManyChat', team:'Growth', surface:'external', sourceType:'screenshot', pricing:'paid', runtimeState:'excluded', notes:'Paid screenshot-labelled tool; never auto-routed.' },
  { id:'sandcastles-mcp', name:'Sandcastles MCP', team:'Design', surface:'external', sourceType:'screenshot', pricing:'paid', runtimeState:'excluded', notes:'Paid screenshot-labelled tool; never auto-routed.' },
  { id:'figma-chatgpt', name:'Figma', team:'Design', surface:'chatgpt', sourceType:'connector', pricing:'unknown', runtimeState:'reference-only', notes:'Visible as an external ChatGPT surface until JARVIS has its own verified adapter.' },
  { id:'canva-chatgpt', name:'Canva', team:'Design', surface:'chatgpt', sourceType:'connector', pricing:'unknown', runtimeState:'reference-only', notes:'Visible as an external ChatGPT surface until JARVIS has its own verified adapter.' },
  { id:'consensus-chatgpt', name:'Consensus', team:'Operations', surface:'chatgpt', sourceType:'connector', pricing:'unknown', runtimeState:'reference-only', notes:'Visible as an external ChatGPT surface until JARVIS has its own verified adapter.' },
  { id:'heygen-chatgpt', name:'HeyGen', team:'Growth', surface:'chatgpt', sourceType:'connector', pricing:'unknown', runtimeState:'reference-only', notes:'Free-tier eligibility is not assumed; excluded from automatic free routing until verified.' }
].map(seed => Object.freeze(normalizeIntegration(seed))));

export function integrationSummary(records = []) {
  const summary = {
    total: 0,
    autoExecutable: 0,
    teams: Object.fromEntries(FREE_INTEGRATION_TEAMS.map(team => [team, 0])),
    states: Object.fromEntries([...RUNTIME].map(state => [state, 0])),
    pricing: Object.fromEntries([...PRICING].map(value => [value, 0]))
  };
  for (const input of records) {
    const record = input?.autoExecutable === undefined ? normalizeIntegration(input) : input;
    summary.total += 1;
    if (record.autoExecutable) summary.autoExecutable += 1;
    if (Object.hasOwn(summary.teams, record.team)) summary.teams[record.team] += 1;
    if (Object.hasOwn(summary.states, record.runtimeState)) summary.states[record.runtimeState] += 1;
    if (Object.hasOwn(summary.pricing, record.pricing)) summary.pricing[record.pricing] += 1;
  }
  return summary;
}
