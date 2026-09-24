import test from 'node:test';
import assert from 'node:assert/strict';
import { capabilityTags, licensePolicy } from '../src/application/ecu/github-intelligence.js';

test('GitHub ECU intelligence distinguishes reusable and architecture-only licenses', () => {
  assert.equal(licensePolicy('MIT').reuse,'ADAPT_WITH_ATTRIBUTION');
  assert.equal(licensePolicy('Apache-2.0').reuse,'ADAPT_WITH_ATTRIBUTION');
  assert.equal(licensePolicy('GPL-3.0').reuse,'ARCHITECTURE_ONLY');
  assert.equal(licensePolicy(null).reuse,'REVIEW_REQUIRED');
});

test('GitHub ECU intelligence extracts implementation capability tags', () => {
  const text=[
    'identify ECU family and fingerprint software version',
    'scan maps and classify torque limiter / driver wish',
    'A2L ASAP2 RECORD_LAYOUT and COMPU_METHOD parser',
    'stock.bin tuned.bin cook recipe with context_before and context_after',
    'checksum CRC32 correction',
    'DTC diagnostic trouble code manager',
  ].join('\n');
  const tags=capabilityTags(text,'openremap/core/services/recipes/patcher.py');
  for(const tag of ['IDENTIFY','MAP_DETECTION','A2L_DAMOS','CHECKSUM','ORI_MOD_DIFF','PATCH_RECIPE','DTC','STAGE1']){
    assert.ok(tags.includes(tag),tag);
  }
});
