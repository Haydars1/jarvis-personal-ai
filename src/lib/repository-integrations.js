import { CURATED_CAPABILITY_SEEDS } from './open-source-capabilities.js';
import { OBD_PDF_SEEDS } from './obd-pdf-seeds.js';
import provenance from '../../data/pdf-repository-provenance.json' with { type: 'json' };
import registry from '../../data/capability-registry.json' with { type: 'json' };
import audit from '../../data/pdf-repository-audit.json' with { type: 'json' };

const NATIVE = { 'cubigato/thinkcar-tc-reader': { status: 'ready', mode: 'format-adapter', route: '/api/ecu/thinkdiag/import', detail: 'TC kayıtları: gerçek örnekle doğrulanmış okuyucu, birimler, CSV/JSON ve istatistik.' } };
const SERVICE_REPOS = new Set(['ollama/ollama', 'ggml-org/llama.cpp', 'mudler/localai', 'vllm-project/vllm', 'lostruins/koboldcpp', 'oobabooga/text-generation-webui']);
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
