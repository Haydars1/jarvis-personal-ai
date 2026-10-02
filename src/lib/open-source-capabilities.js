import { PDF_GUIDE_ADDITIONAL_SEEDS } from './pdf-guide-seeds.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const PERMISSIVE_LICENSES = new Set([
  'MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'Unlicense', 'CC0-1.0'
]);
const COPYLEFT_LICENSES = new Set([
  'GPL-2.0', 'GPL-2.0-only', 'GPL-2.0-or-later',
  'GPL-3.0', 'GPL-3.0-only', 'GPL-3.0-or-later',
  'AGPL-3.0', 'AGPL-3.0-only', 'AGPL-3.0-or-later',
  'LGPL-2.1', 'LGPL-2.1-only', 'LGPL-2.1-or-later',
  'LGPL-3.0', 'LGPL-3.0-only', 'LGPL-3.0-or-later',
  'MPL-2.0'
]);
const RISK_RE = /\b(malware|ransomware|keylogger|spyware|rootkit|botnet|phishing|credential[-\s]?stealer|password[-\s]?stealer|remote[-\s]?access[-\s]?trojan)\b/i;

export const CAPABILITY_DISCOVERY_QUERIES = Object.freeze([
  { category: 'local-llm', executionTarget: 'local-cpu', query: 'local LLM inference ollama llama.cpp archived:false' },
  { category: 'coding-agent', executionTarget: 'local-cpu', query: 'coding agent CLI AI pair programming archived:false' },
  { category: 'agent-framework', executionTarget: 'local-cpu', query: 'multi agent framework autonomous agent archived:false' },
  { category: 'browser-agent', executionTarget: 'local-cpu', query: 'browser agent playwright automation AI archived:false' },
  { category: 'computer-use', executionTarget: 'local-cpu', query: 'computer use desktop automation agent archived:false' },
  { category: 'workflow-rpa', executionTarget: 'external-service', query: 'self hosted workflow automation RPA archived:false' },
  { category: 'crawler-scraper', executionTarget: 'local-cpu', query: 'web crawler scraping browser automation archived:false' },
  { category: 'research-search', executionTarget: 'local-cpu', query: 'open source AI research search engine archived:false' },
  { category: 'youtube-teaching', executionTarget: 'external-service', query: 'YouTube transcript source cited learning coach NotebookLM archived:false' },
  { category: 'image-generation', executionTarget: 'local-gpu', query: 'ComfyUI stable diffusion image generation archived:false' },
  { category: 'image-processing', executionTarget: 'local-cpu', query: 'image upscaler background removal local archived:false' },
  { category: 'video-generation', executionTarget: 'local-gpu', query: 'video generation ComfyUI Wan LTX archived:false' },
  { category: 'video-editing-render', executionTarget: 'local-cpu', query: 'ffmpeg remotion video rendering automation archived:false' },
  { category: 'video-capture-streaming', executionTarget: 'local-cpu', query: 'video capture streaming recording open source archived:false' },
  { category: 'speech-to-text', executionTarget: 'local-cpu', query: 'whisper speech to text local inference archived:false' },
  { category: 'text-to-speech', executionTarget: 'local-gpu', query: 'local text to speech TTS voice synthesis archived:false' },
  { category: 'ocr-document', executionTarget: 'local-cpu', query: 'OCR document parser local AI archived:false' },
  { category: 'rag-vector-memory', executionTarget: 'local-cpu', query: 'vector database RAG local memory archived:false' },
  { category: 'fine-tuning', executionTarget: 'local-gpu', query: 'LLM fine tuning training LoRA archived:false' },
  { category: 'mcp-tooling', executionTarget: 'local-cpu', query: 'MCP server model context protocol archived:false' },
  { category: 'social-automation', executionTarget: 'external-service', query: 'social media automation instagram facebook scheduler archived:false' },
  { category: 'smart-home', executionTarget: 'local-cpu', query: 'smart home local automation home assistant archived:false' },
  { category: 'voice-assistant', executionTarget: 'local-cpu', query: 'offline voice assistant wake word archived:false' },
  { category: 'iot-messaging', executionTarget: 'local-cpu', query: 'MQTT IoT messaging self hosted archived:false' },
  { category: 'messaging-bot', executionTarget: 'external-service', query: 'telegram bot framework archived:false' },
  { category: 'devops-observability', executionTarget: 'external-service', query: 'self hosted observability devops automation archived:false' },
  { category: 'media-download-archive', executionTarget: 'local-cpu', query: 'media downloader web archive local archived:false' },
  { category: 'dev-tool', executionTarget: 'local-cpu', query: 'open source developer editor IDE archived:false' },
  { category: 'cad-design', executionTarget: 'local-cpu', query: 'open source CAD parametric 3d archived:false' },
  { category: 'ecu-file-analysis', executionTarget: 'local-cpu', query: 'ECU tuning editor binary calibration archived:false' },
  { category: 'ecu-firmware', executionTarget: 'device', query: 'open source ECU firmware engine control archived:false' },
  { category: 'ecu-diagnostics', executionTarget: 'device', query: 'automotive ECU diagnostic OBD tool archived:false' },
  { category: 'can-uds-obd', executionTarget: 'device', query: 'CAN UDS OBD ISO14229 automotive archived:false' },
  { category: 'device-bridge', executionTarget: 'device', query: 'J2534 passthru automotive diagnostic archived:false' },
  { category: 'vehicle-dataset', executionTarget: 'local-cpu', query: 'automotive DBC CAN definitions archived:false' },
  { category: 'vehicle-platform', executionTarget: 'device', query: 'open source vehicle platform driver assistance archived:false' },
  { category: 'binary-analysis', executionTarget: 'local-cpu', query: 'firmware reverse engineering binary analysis archived:false' },
  { category: 'data-analysis', executionTarget: 'local-cpu', query: 'local data analysis dataframe agent archived:false' },
  { category: 'audio-processing', executionTarget: 'local-cpu', query: 'audio processing ffmpeg local AI archived:false' },
  { category: 'translation', executionTarget: 'local-cpu', query: 'local machine translation inference archived:false' },
  { category: 'automation-catalog', executionTarget: 'external-service', query: 'awesome MCP servers local AI automation archived:false' },
  { category: 'learning-resource', executionTarget: 'catalog-only', query: 'AI learning guide tutorial course archived:false' }
]);

const BASE_CURATED_CAPABILITY_SEEDS = Object.freeze([
  { repo: 'ollama/ollama', category: 'local-llm', executionTarget: 'local-cpu' },
  { repo: 'ggml-org/llama.cpp', category: 'local-llm', executionTarget: 'local-cpu' },
  { repo: 'open-webui/open-webui', category: 'local-llm', executionTarget: 'local-cpu' },
  { repo: 'Aider-AI/aider', category: 'coding-agent', executionTarget: 'local-cpu' },
  { repo: 'browser-use/browser-use', category: 'browser-agent', executionTarget: 'local-cpu' },
  { repo: 'microsoft/playwright-mcp', category: 'browser-agent', executionTarget: 'local-cpu' },
  { repo: 'n8n-io/n8n', category: 'workflow-rpa', executionTarget: 'external-service' },
  { repo: 'activepieces/activepieces', category: 'workflow-rpa', executionTarget: 'external-service' },
  { repo: 'apify/crawlee', category: 'crawler-scraper', executionTarget: 'local-cpu' },
  { repo: 'artemnovitckii/notebooklm-coach', category: 'youtube-teaching', executionTarget: 'catalog-only', autoExecute: false, restriction: 'GitHub license metadata is NOASSERTION; reference/provenance only. JARVIS executes its own clean-room YouTube teaching adapter.' },
  { repo: 'comfyanonymous/ComfyUI', category: 'image-generation', executionTarget: 'local-gpu' },
  { repo: 'Lightricks/LTX-Video', category: 'video-generation', executionTarget: 'local-gpu' },
  { repo: 'Wan-Video/Wan2.1', category: 'video-generation', executionTarget: 'local-gpu' },
  { repo: 'remotion-dev/remotion', category: 'video-editing-render', executionTarget: 'local-cpu' },
  { repo: 'FFmpeg/FFmpeg', category: 'video-editing-render', executionTarget: 'local-cpu' },
  { repo: 'ggerganov/whisper.cpp', category: 'speech-to-text', executionTarget: 'local-cpu' },
  { repo: 'idiap/coqui-ai-TTS', category: 'text-to-speech', executionTarget: 'local-gpu' },
  { repo: 'PaddlePaddle/PaddleOCR', category: 'ocr-document', executionTarget: 'local-cpu' },
  { repo: 'qdrant/qdrant', category: 'rag-vector-memory', executionTarget: 'local-cpu' },
  { repo: 'chroma-core/chroma', category: 'rag-vector-memory', executionTarget: 'local-cpu' },
  { repo: 'modelcontextprotocol/servers', category: 'mcp-tooling', executionTarget: 'local-cpu' },
  { repo: 'punkpeye/awesome-mcp-servers', category: 'automation-catalog', executionTarget: 'external-service' },
  { repo: 'gitroomhq/postiz-app', category: 'social-automation', executionTarget: 'external-service' },
  { repo: 'mdabrowski1990/uds', category: 'can-uds-obd', executionTarget: 'device' },
  { repo: 'Schildkroet/CANgaroo', category: 'can-uds-obd', executionTarget: 'device' },
  { repo: 'farzadnadiri/MCP-CAN', category: 'can-uds-obd', executionTarget: 'device' },
  { repo: 'miikasyvanen/FastECU', category: 'ecu-diagnostics', executionTarget: 'device' },
  { repo: 'Switchleg1/SimosTools', category: 'ecu-file-analysis', executionTarget: 'device' },
  { repo: 'jeremyhahn/ecutools', category: 'ecu-file-analysis', executionTarget: 'device' },
  { repo: 'RallyPat/LibreTune', category: 'ecu-file-analysis', executionTarget: 'local-cpu' }
]);

export const CURATED_CAPABILITY_SEEDS = Object.freeze([
  ...BASE_CURATED_CAPABILITY_SEEDS,
  ...PDF_GUIDE_ADDITIONAL_SEEDS
]);

const TASK_CATEGORY_PRIORITY = Object.freeze({
  chat: ['local-llm', 'voice-assistant'],
  coding: ['coding-agent', 'agent-framework', 'dev-tool', 'local-llm', 'mcp-tooling'],
  research: ['research-search', 'crawler-scraper', 'browser-agent', 'media-download-archive', 'rag-vector-memory', 'local-llm'],
  reporting: ['research-search', 'ocr-document', 'rag-vector-memory', 'local-llm'],
  youtube_teaching: ['youtube-teaching', 'speech-to-text', 'rag-vector-memory', 'crawler-scraper'],
  social_strategy: ['social-automation', 'workflow-rpa', 'video-generation', 'video-editing-render', 'image-generation', 'text-to-speech'],
  video_creation: ['video-generation', 'video-editing-render', 'video-capture-streaming', 'image-generation', 'image-processing', 'text-to-speech'],
  image: ['image-generation', 'image-processing'],
  audio: ['speech-to-text', 'text-to-speech', 'audio-processing'],
  translation: ['translation', 'local-llm'],
  ecu_diagnostics: ['ecu-diagnostics', 'can-uds-obd', 'vehicle-dataset', 'device-bridge', 'local-llm'],
  ecu_file_analysis: ['ecu-file-analysis', 'binary-analysis', 'vehicle-dataset', 'local-llm'],
  vehicle_coding: ['can-uds-obd', 'ecu-diagnostics', 'vehicle-dataset', 'device-bridge'],
  service_procedure: ['can-uds-obd', 'ecu-diagnostics', 'device-bridge'],
  performance_calibration: ['ecu-file-analysis', 'binary-analysis', 'local-llm'],
  emissions_modification: ['ecu-file-analysis', 'binary-analysis']
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function licenseId(repo) {
  return String(repo?.license?.spdx_id || repo?.license || '').trim();
}

function safeTopics(repo) {
  return Array.isArray(repo?.topics) ? repo.topics.map(value => String(value)) : [];
}

function pushedAgeDays(repo, now) {
  const pushed = Date.parse(String(repo?.pushed_at || ''));
  if (!Number.isFinite(pushed)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Number(now) - pushed) / DAY_MS);
}

function listField(value, fallback = []) {
  return Array.isArray(value) ? value.map(item => String(item)) : [...fallback];
}

export function evaluateRepository(repo = {}, now = Date.now()) {
  const reasons = [];
  const license = licenseId(repo);
  const topics = safeTopics(repo);
  const riskText = [repo?.full_name, repo?.name, repo?.description, ...topics].filter(Boolean).join(' ');

  if (repo?.archived || repo?.disabled) {
    return { status: 'rejected', score: 0, license, reasons: ['repository archived or disabled'] };
  }
  if (RISK_RE.test(riskText)) {
    return { status: 'rejected', score: 0, license, reasons: ['risk metadata matched blocked abuse category'] };
  }

  let status = 'quarantine';
  let score = 35;

  if (PERMISSIVE_LICENSES.has(license)) {
    status = 'accepted';
    score += 20;
  } else if (COPYLEFT_LICENSES.has(license)) {
    status = 'external-only';
    score += 10;
    reasons.push('copyleft license requires external-service boundary');
  } else {
    reasons.push('license missing, unknown or not allowlisted');
    score -= 10;
  }

  const ageDays = pushedAgeDays(repo, now);
  if (ageDays <= 30) score += 20;
  else if (ageDays <= 180) score += 15;
  else if (ageDays <= 365) score += 10;
  else if (ageDays <= 730) score += 5;
  else if (Number.isFinite(ageDays)) score -= 15;
  else {
    score -= 15;
    reasons.push('missing pushed_at metadata');
  }

  if (ageDays > 1095 && status === 'accepted') {
    status = 'quarantine';
    reasons.push('repository stale for more than three years');
  }

  const stars = Math.max(0, Number(repo?.stargazers_count || 0));
  const forks = Math.max(0, Number(repo?.forks_count || 0));
  score += Math.min(15, Math.floor(Math.log10(stars + 1) * 5));
  score += Math.min(10, Math.floor(Math.log10(forks + 1) * 4));
  if (repo?.description) score += 3;
  if (repo?.fork) score -= 5;

  score = clamp(Math.round(score), 0, 100);
  if (status === 'quarantine') score = Math.min(score, 55);

  return { status, score, license, reasons };
}

export function normalizeRepository(repo = {}, hints = {}, now = Date.now()) {
  const admission = evaluateRepository(repo, now);
  const category = String(hints.category || 'uncategorized');
  const executionTarget = String(hints.executionTarget || 'external-service');
  const fullName = String(repo?.full_name || repo?.name || '').trim();
  return {
    repo: fullName,
    name: String(repo?.name || fullName.split('/').pop() || fullName),
    url: String(repo?.html_url || (fullName ? `https://github.com/${fullName}` : '')),
    description: String(repo?.description || ''),
    category,
    categories: [category],
    executionTarget,
    executionTargets: [executionTarget],
    status: admission.status,
    score: admission.score,
    license: admission.license || null,
    reasons: [...admission.reasons],
    stars: Math.max(0, Number(repo?.stargazers_count || 0)),
    forks: Math.max(0, Number(repo?.forks_count || 0)),
    language: repo?.language ? String(repo.language) : null,
    pushedAt: repo?.pushed_at ? String(repo.pushed_at) : null,
    topics: safeTopics(repo).sort(),
    source: String(hints.source || 'github-search'),
    catalogSource: hints.catalogSource ? String(hints.catalogSource) : null,
    guidePage: Number.isFinite(Number(hints.guidePage)) ? Number(hints.guidePage) : null,
    autoExecute: hints.autoExecute !== false,
    restriction: hints.restriction ? String(hints.restriction) : null,
    requiresModelLicenseCheck: ['image-generation', 'video-generation', 'text-to-speech', 'local-llm', 'fine-tuning'].includes(category),
    adapter: hints.adapter || null
  };
}

export function openSourceCandidates(kind = 'chat', registry = [], runtimeContext = {}) {
  const priorities = TASK_CATEGORY_PRIORITY[String(kind || 'chat')] || TASK_CATEGORY_PRIORITY.chat;
  const availableTargets = new Set(listField(runtimeContext.availableTargets, ['cloud', 'external-service']));
  const health = runtimeContext.health && typeof runtimeContext.health === 'object' ? runtimeContext.health : {};
  const includeUnadapted = runtimeContext.includeUnadapted === true;
  const candidates = [];

  for (const entry of Array.isArray(registry) ? registry : []) {
    if (!entry || !['accepted', 'external-only'].includes(String(entry.status))) continue;
    if (entry.autoExecute === false) continue;
    const categories = listField(entry.categories, entry.category ? [entry.category] : []);
    const matchIndexes = categories.map(category => priorities.indexOf(category)).filter(index => index >= 0);
    if (!matchIndexes.length) continue;
    const targets = listField(entry.executionTargets, entry.executionTarget ? [entry.executionTarget] : []);
    if (!targets.some(target => availableTargets.has(target))) continue;

    const repo = String(entry.repo || '');
    const repoHealth = health[repo] || {};
    if (repoHealth.available === false) continue;

    const adapterReady = Boolean(entry.adapterReady || entry.adapter?.status === 'ready' || entry.adapter?.type === 'builtin');
    if (!adapterReady && !includeUnadapted) continue;

    const bestMatch = Math.min(...matchIndexes);
    let routingScore = Number(entry.score || 0) + Math.max(10, 50 - bestMatch * 10);
    if (Number.isFinite(Number(repoHealth.successRate))) routingScore += Math.round(clamp(Number(repoHealth.successRate), 0, 1) * 10);
    if (Number(repoHealth.consecutiveFailures || 0) >= 2) routingScore -= 20;

    candidates.push({
      ...entry,
      runnable: adapterReady,
      routingScore: Math.round(routingScore),
      executionMode: kind === 'emissions_modification' ? 'analysis-only' : 'execute'
    });
  }

  return candidates.sort((a, b) => b.routingScore - a.routingScore || String(a.repo).localeCompare(String(b.repo)));
}

export const CAPABILITY_TASK_CATEGORY_PRIORITY = TASK_CATEGORY_PRIORITY;

export const CAPABILITY_LICENSE_POLICY = Object.freeze({
  permissive: [...PERMISSIVE_LICENSES].sort(),
  externalOnly: [...COPYLEFT_LICENSES].sort()
});