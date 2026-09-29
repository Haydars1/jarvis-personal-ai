import test from 'node:test';
import assert from 'node:assert/strict';
import { capabilityProfile, classifyCapability, providerPreference } from '../src/lib/capability-policy.js';
import { scoreProvider, taskKind } from '../src/lib/orchestration.js';

test('classifies capability-specific work', () => {
  assert.equal(classifyCapability('Instagram için haftalık reels içerik planı hazırla'), 'social_strategy');
  assert.equal(classifyCapability('Bu ECU BIN dosyasını ORI MOD karşılaştır'), 'ecu_file_analysis');
  assert.equal(classifyCapability('Araçta uzun kodlama byte 3 adaptasyon yapacağız'), 'vehicle_coding');
  assert.equal(classifyCapability('Servis reset ve basic setting işlemini planla'), 'service_procedure');
  assert.equal(classifyCapability('DPF off haritasını bul'), 'emissions_modification');
  assert.equal(taskKind('Güncel kaynaklarla ayrıntılı rapor hazırla'), 'reporting');
});

test('profiles expose tool plans and task-specific provider preferences', () => {
  assert.ok(capabilityProfile('social_strategy').tools.includes('social-growth'));
  assert.ok(capabilityProfile('ecu_diagnostics').tools.includes('device-bridge'));
  assert.ok(providerPreference('reporting','gemini') > providerPreference('reporting','groq'));
  assert.ok(providerPreference('coding','anthropic') > providerPreference('coding','together'));
});

test('provider score changes by task rather than fixed global order', () => {
  const common={capabilities:'["chat","research","coding","reasoning"]',samples:10,successes:9,failures:1,avg_latency_ms:1500,priority:10};
  const geminiReport=scoreProvider({...common,provider:'gemini'},'reporting');
  const groqReport=scoreProvider({...common,provider:'groq'},'reporting');
  const anthropicCoding=scoreProvider({...common,provider:'anthropic'},'coding');
  const groqCoding=scoreProvider({...common,provider:'groq'},'coding');
  assert.ok(geminiReport > groqReport);
  assert.ok(anthropicCoding > groqCoding);
});
