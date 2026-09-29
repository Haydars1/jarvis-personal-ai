import test from 'node:test';
import assert from 'node:assert/strict';
import { cadencePlan } from '../src/application/social/growth.js';

const base=1_700_000_000_000;
const day=24*60*60*1000;

test('social cadence understands weekly Turkish requests',()=>{
  const c=cadencePlan('Instagram için haftada bir reel paylaş',base);
  assert.equal(c.id,'weekly');
  assert.equal(c.interval_ms,7*day);
  assert.equal(c.first_at,base+7*day);
});

test('social cadence understands daily requests',()=>{
  const c=cadencePlan('Her gün bir video hazırla ve paylaş',base);
  assert.equal(c.id,'daily');
  assert.equal(c.interval_ms,day);
});

test('social cadence understands every N weeks',()=>{
  const c=cadencePlan('2 haftada bir reels paylaş',base);
  assert.equal(c.id,'every_2_weeks');
  assert.equal(c.interval_ms,14*day);
});
