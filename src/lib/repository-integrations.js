import { CURATED_CAPABILITY_SEEDS } from './open-source-capabilities.js';
import { OBD_PDF_SEEDS } from './obd-pdf-seeds.js';
import { CODE_GRAPH_CAPABILITIES } from './code-graph.js';
import { FREE_INTEGRATION_SEEDS, normalizeIntegration } from './free-integration-registry.js';
import { SCREENSHOT_INTEGRATION_SEEDS } from './screenshot-integration-matrix.js';
import provenance from '../../data/pdf-repository-provenance.json' with { type: 'json' };
import registry from '../../data/capability-registry.json' with { type: 'json' };
import audit from '../../data/pdf-repository-audit.json' with { type: 'json' };

const NATIVE = { 'cubigato/thinkcar-tc-reader': { status: 'ready', mode: 'format-adapter', route: '/api/ecu/thinkdiag/import', detail: 'TC kayıtları: gerçek örnekle doğrulanmış okuyucu, birimler, CSV/JSON ve istatistik.' } };
const SERVICE_REPOS = new Set(['ollama/ollama', 'ggml-org/llama.cpp', 'mudler/localai', 'vllm-project/vllm', 'lostruins/koboldcpp', 'oobabooga/text-generation-webui']);
const GRAPH_STATUSES = new Set(['ready', 'stale', 'degraded', 'unavailable', 'invalid']);
const NOTEBOOKLM_COACH = 'artemnovitckii/notebooklm-coach';

export function repositoryCodeGraphIntegration(status = 'unavailable') {
  const normalized = String(status || 'unavailable').toLowerCase();
  const graphStatus = GRAPH_STATUSES.has(normalized) ? normalized : 'unavailable';
  return {
    status: graphStatus,
    mode: 'code-graph',
    generator: 'graphify-or-native',
    capabilities: graphStatus === 'ready' ? [...CODE_GRAPH_CAPABILITIES] : [],
    detail: graphStatus === 'ready'
      ? 'Repository dependency, symbol-neighborhood and impact-analysis intelligence is current for the validated source commit.'
      : 'Repository graph state is visible, but structural capabilities are not advertised until the graph is validated as current.'
  };
}

export function repositoryIntegrations() {
  const metadata = new Map(registry.entries.map(row => [row.repo.toLowerCase(), row]));
  const seeds = new Map([...CURATED_CAPABILITY_SEEDS, ...OBD_PDF_SEEDS].map(row => [row.repo.toLowerCase(), row]));
  const evidence = new Map(audit.results.map(row => [row.repo.toLowerCase(), row]));
  return Object.entries(provenance).map(([repo, pdf]) => {
    const key = repo.toLowerCase(), seed = seeds.get(key), row = metadata.get(key), native = NATIVE[key], verified = evidence.get(key);
    let integration = native || { status: 'source-only', mode: 'repository-tools', route: '/api/tools/cloud/jobs', detail: 'Kaynak inceleme/arama bağlantısı hazır. Projenin kendi çalışma ortamı ve özel adaptörü henüz bağlı değil.' };
    if (!native && SERVICE_REPOS.has(key)) integration = { status: 'configuration-required', mode: 'openai-compatible', route: '/api/credentials', detail: 'OpenAI uyumlu sağlayıcı bağlantısı kullanılabilir; çalışan servis URL’si ve model ayarı gerekli. Yerel servis için bilgisayar açık olmalı.' };
    if (!native && seed?.executionTarget === 'device') integration = { status: 'hardware-required', mode: 'device-bridge', route: '/api/ecu/device/jobs', detail: 'Bu repoya uygun fiziksel arayüz ve doğrulanmış adaptör gerekli. THINKDIAG2 için ELM327/J2534 uyumluluğu varsayılmaz.' };
    if (!native && seed?.executionTarget === 'catalog-only') integration = { status: 'reference', mode: 'repository-tools', route: '/api/tools/cloud/jobs', detail: seed.restriction || 'Öğrenme/kaynak materyali; çalıştırılabilir servis değil.' };
    return { repo, url: 'https://github.com/' + repo, category: seed?.category || 'uncategorized', pdf,
      metadata_verified: Boolean(verified?.source_commit || row?.metadataAvailable), license: verified?.license || row?.license || null, admission: row?.status || 'not-checked', canonical_repo: verified?.canonical_repo || row?.canonicalRepo || repo,
      source_verification: verified?.status || 'not-checked', readme_sha256: verified?.readme_sha256 || null,
      source_commit: verified?.source_commit || null, checked_at: verified?.checked_at || row?.checkedAt || null, integration };
  }).sort((a, b) => a.repo.localeCompare(b.repo));
}

function repoTeam(category = '') {
  const value = String(category || '').toLowerCase();
  if (/design|image|visual|diagram|slide|presentation|ui|frontend/.test(value)) return 'Design';
  if (/research|search|seo|social|content|youtube|marketing|growth/.test(value)) return 'Growth';
  if (/calendar|mail|document|workflow|productivity|operations/.test(value)) return 'Operations';
  if (/model|llm|serving|agent|orchestration|memory|rag/.test(value)) return 'Scale';
  return 'Build';
}

function repoPricing(license) {
  const value = String(license || '').toUpperCase();
  return /MIT|APACHE|BSD|ISC|MPL|GPL|LGPL|AGPL|UNLICENSE/.test(value) ? 'free' : 'unknown';
}

function repoRuntime(row) {
  if (String(row?.canonical_repo || row?.repo || '').toLowerCase() === NOTEBOOKLM_COACH) return 'reference-only';
  const status = String(row?.integration?.status || '').toLowerCase();
  if (status === 'ready') return 'ready';
  if (status === 'configuration-required' || status === 'hardware-required') return 'connection-required';
  if (status === 'degraded') return 'degraded';
  if (status === 'source-only' || status === 'reference') return 'reference-only';
  return 'unavailable';
}

function repoRecord(row) {
  const canonical = String(row?.canonical_repo || row?.repo || '').trim();
  const runtimeState = repoRuntime(row);
  return normalizeIntegration({
    id: `repo:${canonical.toLowerCase()}`,
    name: canonical || row?.repo || 'Repository integration',
    team: repoTeam(row?.category),
    surface: row?.integration?.mode === 'device-bridge' ? 'device' : 'worker',
    sourceType: 'github-skill',
    capabilities: [row?.category, ...(row?.integration?.capabilities || [])].filter(Boolean),
    pricing: repoPricing(row?.license),
    authState: runtimeState === 'connection-required' ? 'required' : 'none',
    runtimeState,
    adapterId: row?.integration?.mode || null,
    route: row?.integration?.route || null,
    provenance: {
      repo: row?.repo || canonical,
      canonicalRepo: canonical || null,
      url: row?.url || (canonical ? `https://github.com/${canonical}` : null),
      license: row?.license || null,
      sourceCommit: row?.source_commit || null,
      sourceVerification: row?.source_verification || null
    },
    notes: String(row?.integration?.detail || '')
  });
}

function connectorState(seed, providerState = {}) {
  if (seed.surface !== 'chatgpt') return seed;
  const key = seed.id.replace(/-chatgpt$/, '');
  const camel = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const state = providerState?.chatgpt?.[key] || providerState?.chatgpt?.[camel] || {};
  if (!state || typeof state !== 'object' || !('connected' in state)) return seed;
  return normalizeIntegration({ ...seed, authState: state.connected ? 'connected' : (seed.runtimeState === 'connection-required' ? 'required' : 'unknown') });
}

function nativeGoogleRecords(providerState = {}) {
  const googleConnected = Boolean(providerState?.google?.connected);
  const youtubeConnected = Boolean(providerState?.youtube?.connected ?? providerState?.google?.youtube);
  const state = connected => connected ? 'ready' : 'connection-required';
  const auth = connected => connected ? 'connected' : 'required';
  return [
    normalizeIntegration({ id:'gmail', name:'Gmail', team:'Operations', surface:'worker', sourceType:'api', capabilities:['mail-read'], pricing:'free-plan', authState:auth(googleConnected), runtimeState:state(googleConnected), adapterId:'google-oauth', route:'/api/gmail/messages', notes:'JARVIS Google OAuth surface.' }),
    normalizeIntegration({ id:'google-drive', name:'Google Drive', team:'Operations', surface:'worker', sourceType:'api', capabilities:['drive-read'], pricing:'free-plan', authState:auth(googleConnected), runtimeState:state(googleConnected), adapterId:'google-oauth', route:'/api/drive/files', notes:'JARVIS Google OAuth surface.' }),
    normalizeIntegration({ id:'youtube', name:'YouTube', team:'Growth', surface:'worker', sourceType:'api', capabilities:['youtube-read','youtube-upload'], pricing:'free-plan', authState:auth(youtubeConnected), runtimeState:state(youtubeConnected), adapterId:'google-oauth', route:'/api/google/connect', notes:'JARVIS YouTube authorization reuses Google OAuth.' })
  ];
}

export function buildFreeIntegrationCatalog({ repositoryIntegrations: repositoryRows = repositoryIntegrations(), providerState = {} } = {}) {
  const byKey = new Map();
  for (const seed of FREE_INTEGRATION_SEEDS) byKey.set(seed.id, connectorState(seed, providerState));
  for (const seed of SCREENSHOT_INTEGRATION_SEEDS) byKey.set(seed.id, seed);
  for (const record of nativeGoogleRecords(providerState)) byKey.set(record.id, record);
  const seenRepos = new Set();
  for (const row of repositoryRows || []) {
    const canonical = String(row?.canonical_repo || row?.repo || '').toLowerCase();
    if (!canonical || seenRepos.has(canonical)) continue;
    seenRepos.add(canonical);
    const record = repoRecord(row);
    byKey.set(record.id, record);
  }
  return [...byKey.values()].sort((a, b) => a.team.localeCompare(b.team) || a.name.localeCompare(b.name));
}
