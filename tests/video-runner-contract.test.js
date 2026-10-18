import test from 'node:test';
import assert from 'node:assert/strict';
import {createVideoJob,verifyVideoJobSignature} from '../local-bridge/video-runner-contract.mjs';
test('creates signed Turkish video request with no publishing or paid usage',()=>{
 const job=createVideoJob({topic:'ECU diagnosis',aspect:'9:16'},{secret:'test-only',runnerUrl:'https://runner.example'});
 assert.equal(job.url,'https://runner.example/jobs');
 assert.equal(JSON.parse(job.body).auto_publish,false);
 assert.equal(JSON.parse(job.body).allow_paid_services,false);
 assert.equal(verifyVideoJobSignature('test-only',job.body,job.headers['x-jarvis-signature']),true);
});
test('rejects missing configuration and insecure runner',()=>{
 assert.throws(()=>createVideoJob({topic:'x'}),/configuration/);
 assert.throws(()=>createVideoJob({topic:'x'},{secret:'x',runnerUrl:'http://localhost:1234'}),/HTTPS/);
});
test('rejects invalid aspect',()=>assert.throws(()=>createVideoJob({topic:'x',aspect:'3:2'},{secret:'x',runnerUrl:'https://runner.example'}),/aspect/));
