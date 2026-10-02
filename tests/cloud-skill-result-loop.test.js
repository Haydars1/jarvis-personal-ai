import test from 'node:test';
import assert from 'node:assert/strict';
import * as cloudExecution from '../src/application/capabilities/cloud-execution.js';

test('completed source-search cloud jobs expose a user-consumable answer',()=>{
  assert.equal(typeof cloudExecution.cloudJobAnswer,'function');
  const answer=cloudExecution.cloudJobAnswer({
    id:'job-1',
    adapter_id:'source-search',
    repo:'example/tool',
    status:'completed',
    result_json:JSON.stringify({
      term:'checksum',
      commit:'0123456789abcdef0123456789abcdef01234567',
      matches:[
        {file:'src/checksum.js',line:42,text:'export function checksum(bytes) {'}
      ]
    })
  });
  assert.match(answer,/example\/tool/);
  assert.match(answer,/src\/checksum\.js:42/);
  assert.match(answer,/checksum/);
});

test('queued cloud jobs do not pretend to have a finished answer',()=>{
  assert.equal(typeof cloudExecution.cloudJobAnswer,'function');
  assert.equal(cloudExecution.cloudJobAnswer({id:'job-2',adapter_id:'repo-inspect',repo:'example/tool',status:'queued',result_json:null}),null);
});
