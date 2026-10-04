import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyCapabilityPolicy,
  isPolicyExecutable,
  scanCapabilitySource
} from '../src/lib/capability-security-v2.js';

test('static scanner detects destructive, privilege and secret-access risks', () => {
  const findings=scanCapabilitySource({text:'sudo rm -rf /tmp/demo && node -e "console.log(process.env.API_KEY)"'});
  const kinds=new Set(findings.map(item=>item.kind));
  assert.ok(kinds.has('destructive-command'));
  assert.ok(kinds.has('privilege-escalation'));
  assert.ok(kinds.has('secret-access'));
});

test('critical findings block automatic execution', () => {
  const policy=classifyCapabilityPolicy({text:'sudo rm -rf ./workspace',workspaceWrite:true,network:true});
  assert.equal(policy.decision,'blocked');
  assert.equal(policy.policy_class,'production-prohibited');
  assert.equal(isPolicyExecutable(policy),false);
});

test('secret access plus network upload is blocked', () => {
  const policy=classifyCapabilityPolicy({text:'const token=process.env.TOKEN; fetch(url,{method:"POST"})',network:true});
  assert.equal(policy.decision,'blocked');
  assert.equal(policy.reason,'secret_exfiltration_risk');
});

test('safe pure read source is executable under pure-read policy', () => {
  const policy=classifyCapabilityPolicy({text:'Read README.md and return parsed headings.'});
  assert.equal(policy.policy_class,'pure-read');
  assert.equal(policy.decision,'approved');
  assert.equal(isPolicyExecutable(policy),true);
});

test('networked workspace write is forced into sandbox-network-readwrite', () => {
  const policy=classifyCapabilityPolicy({text:'Fetch a public page and write result into workspace output.json',network:true,workspaceWrite:true});
  assert.equal(policy.policy_class,'sandbox-network-readwrite');
  assert.equal(policy.decision,'approved');
});

test('device write requires explicit confirmation policy', () => {
  const policy=classifyCapabilityPolicy({text:'Run supported service routine',deviceWrite:true});
  assert.equal(policy.policy_class,'device-write-confirmed');
  assert.equal(policy.requires_confirmation,true);
  assert.equal(isPolicyExecutable(policy),true);
});

test('explicit auto-execute false remains reference-only', () => {
  const policy=classifyCapabilityPolicy({text:'analysis helper',autoExecute:false,restriction:'analysis only'});
  assert.equal(policy.decision,'reference_only');
  assert.equal(policy.policy_class,'reference-only');
  assert.equal(isPolicyExecutable(policy),false);
});

test('paid or credential-dependent source stays reference-only until configured', () => {
  const policy=classifyCapabilityPolicy({text:'SEO data connector',network:true,requiresPaidApi:true,requiresCredentials:true});
  assert.equal(policy.decision,'reference_only');
  assert.equal(policy.reason,'external_prerequisite_not_configured');
  assert.ok(policy.requirements.includes('paid-api'));
  assert.ok(policy.requirements.includes('credentials'));
});
