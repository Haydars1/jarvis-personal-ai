// Video observations are untrusted evidence, not executable instructions.
const CATALOG = Object.freeze([
  { id: 'jenkins', name: 'Jenkins', capability: 'ci-cd', risk: 'medium', pattern: /\bjenkins\b|\bjenkinsfile\b/iu, next: 'Compare with existing GitHub Actions before adding Jenkins infrastructure' },
  { id: 'github-actions', name: 'GitHub Actions', capability: 'ci-cd', risk: 'medium', pattern: /github\s*actions?|\.github\/workflows/iu, next: 'Reuse existing repository workflows' },
  { id: 'docker', name: 'Docker', capability: 'containers', risk: 'medium', pattern: /\bdocker\b|\bdockerfile\b/iu, next: 'Check container and runner compatibility' },
  { id: 'kubernetes', name: 'Kubernetes', capability: 'orchestration', risk: 'high', pattern: /\bkubernetes\b|\bk8s\b/iu, next: 'Requires managed cluster and separate permissions' },
  { id: 'n8n', name: 'n8n', capability: 'workflow-automation', risk: 'medium', pattern: /\bn8n\b/iu, next: 'Compare with existing automation runner' },
  { id: 'openhands', name: 'OpenHands', capability: 'coding-agent', risk: 'high', pattern: /\bopenhands\b/iu, next: 'Sandbox execution and review all changes' },
  { id: 'ollama', name: 'Ollama', capability: 'local-llm', risk: 'medium', pattern: /\bollama\b/iu, next: 'Connect an authorized local inference endpoint' },
  { id: 'playwright', name: 'Playwright', capability: 'browser-automation', risk: 'medium', pattern: /\bplaywright\b/iu, next: 'Restrict domains and permissions' },
  { id: 'codex', name: 'Codex', capability: 'coding-agent', risk: 'medium', pattern: /\bcodex\b/iu, next: 'Use an authorized coding connector or agent' },
  { id: 'ffmpeg', name: 'FFmpeg', capability: 'media-processing', risk: 'low', pattern: /\bffmpeg\b/iu, next: 'Process media in an isolated runner' },
  { id: 'whisper', name: 'Whisper', capability: 'speech-to-text', risk: 'low', pattern: /\bwhisper\b/iu, next: 'Prefer the existing transcription route' },
  { id: 'winols', name: 'WinOLS', capability: 'ecu-file-analysis', risk: 'high', pattern: /\bwinols\b/iu, next: 'Verify license and ECU safety' },
  { id: 'kt200', name: 'KT200', capability: 'ecu-device', risk: 'high', pattern: /\bkt200(?:\s*ii|\s*2)?\b/iu, next: 'Use an authorized local device bridge' },
  { id: 'cloudflare-workers', name: 'Cloudflare Workers', capability: 'serverless', risk: 'medium', pattern: /\bcloudflare\s*workers?\b|\bwrangler\b/iu, next: 'Reuse existing Worker runtime' }
]);

export const VIDEO_SKILL_CATALOG = Object.freeze(CATALOG.map(({ pattern, ...metadata }) => Object.freeze(metadata)));

const REPOSITORY_CAPABILITIES = Object.freeze({
  jenkins: {
    match: 'existing-alternative',
    name: 'GitHub Actions',
    source_path: '.github/workflows/video-skill-validation.yml',
    note: 'Existing CI workflow covers test/build automation; this does not mean Jenkins itself is installed.'
  },
  'github-actions': {
    match: 'repository-code-present',
    name: 'GitHub Actions',
    source_path: '.github/workflows/video-skill-validation.yml',
    note: 'Workflow is present in repository; live permissions and run success need independent checks.'
  },
  whisper: {
    match: 'repository-code-present',
    name: 'Cloudflare Whisper route',
    source_path: 'src/application/capabilities/youtube-learning.js',
    note: 'Transcription implementation is in code; live AI binding and model functionality require verification.'
  },
  'cloudflare-workers': {
    match: 'repository-code-present',
    name: 'Cloudflare Worker runtime',
    source_path: 'src/app-entry.js',
    note: 'Worker entry code is present; production deployment is a separate state.'
  }
});


// Vision may report names outside the curated catalog. All remain unverified.
function openVocabularyNames(text, knownNames) {
  const names = [];
  const seen = new Set(knownNames.map(name => name.toLocaleLowerCase('tr-TR')));
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:\[(?:\d+(?:[.,]\d+)?|\d{1,2}:\d{2}(?::\d{2})?)\]\s*)?(?:[-*]\s*)?(?:ARAÇ|TOOL|SKILL|PLUGIN)\s*:\s*([^|:]{2,70})(?:\s*\|\s*(?:KANIT|EVIDENCE)\s*:\s*(.{2,240}))?\s*$/iu);
    if (!match) continue;
    const name = match[1].trim();
    if (!/^[\p{L}\p{N}][\p{L}\p{N} .+_/#-]{1,69}$/u.test(name)) continue;
    const normalized = name.toLocaleLowerCase('tr-TR');
    if (seen.has(normalized) || /^(bilinmiyor|unknown|none|yok|belirsiz)$/iu.test(name)) continue;
    seen.add(normalized);
    names.push({
      id: 'proposed:' + [...normalized].map(char => /[a-z0-9]/.test(char) ? char : '-' + char.codePointAt(0).toString(16)).join('').slice(0, 140),
      name, capability: 'unclassified', risk: 'unassessed',
      evidence: (match[2] || line.trim()).slice(0, 240),
      evidence_type: 'reported-tool-name',
      jarvis: { status: 'candidate', next_step: 'Verify the official publisher, purpose, license and API before implementing', installed: false },
      chatgpt: { status: 'connector-check-required', installed: null },
      execution_enabled: false, verification: 'tool-name-observed-not-validated'
    });
    if (names.length >= 12) break;
  }
  return names;
}

export function discoverVideoSkills(input = {}) {
  const text = [input.transcript, input.screen_text, input.notes].filter(x => typeof x === 'string').join('\n');
  if (!text.trim()) return [];
  const curated = CATALOG.flatMap(item => {
    const match = item.pattern.exec(text);
    if (!match) return [];
    const offset = match.index || 0;
    const excerpt = text.slice(Math.max(0, offset - 70), Math.min(text.length, offset + 120)).replace(/\s+/g, ' ').trim();
    return [{
      id: item.id, name: item.name, capability: item.capability, risk: item.risk,
      repo_capability: REPOSITORY_CAPABILITIES[item.id] || null,
      evidence: excerpt, evidence_type: input.transcript ? 'video-text' : 'screen-or-notes',
      jarvis: { status: 'candidate', next_step: item.next, installed: false },
      chatgpt: { status: 'connector-check-required', installed: null },
      execution_enabled: false, verification: 'name-detected-not-functionally-tested'
    }];
  });
  const generic = openVocabularyNames(text, curated.map(item => item.name));
  return [...curated, ...generic];
}
